import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source for pdfjs - Using a more reliable CDN link matching the version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const FIELD_TYPES = [
    { id: 'text', label: 'Text Field', color: 'blue', hex: '#3b82f6' },
    { id: 'signature', label: 'Signature', color: 'red', hex: '#ef4444' },
    { id: 'initials', label: 'Initials', color: 'orange', hex: '#f97316' },
    { id: 'checkbox', label: 'Checkbox', color: 'green', hex: '#22c55e' },
    { id: 'date_signed', label: 'Date Signed', color: 'purple', hex: '#a855f7' },
    { id: 'email', label: 'Email', color: 'teal', hex: '#14b8a6' },
];

const AdminPage = () => {
    const [title, setTitle] = useState('Tax Exemption Certificate');
    const [subject, setSubject] = useState('Please sign the Tax Exemption Certificate');
    const [message, setMessage] = useState('This is a required document for your state.');
    const [stateCode, setStateCode] = useState('NY');
    const [fields, setFields] = useState([]);
    const [selectedType, setSelectedType] = useState('text');

    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [pdfDoc, setPdfDoc] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [scale, setScale] = useState(1.5);
    const [draggingIndex, setDraggingIndex] = useState(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const renderTaskRef = useRef(null);

    const onFileChange = async (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setPdfLoading(true);
        setFields([]); // Clear fields when new file is uploaded

        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const typedarray = new Uint8Array(event.target.result);
                    const loadingTask = pdfjsLib.getDocument({
                        data: typedarray,
                        cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
                        cMapPacked: true,
                    });
                    const pdf = await loadingTask.promise;
                    setPdfDoc(pdf);
                    setCurrentPage(1);
                    setPdfLoading(false);
                } catch (err) {
                    console.error("Error loading PDF:", err);
                    alert("Failed to load PDF. Please try another file.");
                    setPdfLoading(false);
                }
            };
            reader.readAsArrayBuffer(selectedFile);
        } catch (err) {
            console.error("FileReader error:", err);
            setPdfLoading(false);
        }
    };

    const renderPage = async () => {
        if (!pdfDoc || !canvasRef.current) return;

        // Cancel any ongoing render task
        if (renderTaskRef.current) {
            renderTaskRef.current.cancel();
        }

        try {
            const page = await pdfDoc.getPage(currentPage);
            const viewport = page.getViewport({ scale });
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };

            const renderTask = page.render(renderContext);
            renderTaskRef.current = renderTask;
            await renderTask.promise;
            renderTaskRef.current = null;
        } catch (err) {
            if (err.name !== 'RenderingCancelledException') {
                console.error("Render error:", err);
            }
        }
    };

    useEffect(() => {
        renderPage();
    }, [pdfDoc, currentPage, scale]);

    const handleMouseDown = (e, index) => {
        e.stopPropagation();
        setDraggingIndex(index);
        const field = fields[index];
        setDragStart({
            x: e.clientX - (field.x * scale),
            y: e.clientY - (field.y * scale)
        });
    };

    const handleMouseMove = (e) => {
        if (draggingIndex === null) return;

        const newX = (e.clientX - dragStart.x) / scale;
        const newY = (e.clientY - dragStart.y) / scale;

        const newFields = [...fields];
        newFields[draggingIndex] = {
            ...newFields[draggingIndex],
            x: Math.round(newX),
            y: Math.round(newY)
        };
        setFields(newFields);
    };

    const handleMouseUp = () => {
        setDraggingIndex(null);
    };

    const handleCanvasClick = (e) => {
        if (!pdfDoc || draggingIndex !== null) return;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const pdfX = Math.round((x / scale));
        const pdfY = Math.round((y / scale));

        const fieldName = prompt(`Enter name for this ${selectedType} field:`, `${selectedType}_${fields.length + 1}`);
        if (!fieldName) return;

        const newField = {
            name: fieldName,
            type: selectedType === 'email' ? 'text' : selectedType, // Map email to text for API
            displayType: selectedType, // Keep original type for UI
            page: currentPage,
            x: pdfX,
            y: pdfY,
            width: selectedType === 'checkbox' ? 20 : (selectedType === 'signature' ? 120 : 150),
            height: selectedType === 'checkbox' ? 20 : (selectedType === 'signature' ? 30 : 20),
            required: true
        };

        setFields([...fields, newField]);
    };

    const toggleRequired = (index) => {
        const newFields = [...fields];
        newFields[index].required = !newFields[index].required;
        setFields(newFields);
    };

    const removeField = (index) => {
        setFields(fields.filter((_, i) => i !== index));
    };

    const clearFields = () => {
        if (window.confirm("Are you sure you want to clear all fields?")) {
            setFields([]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) return alert("Please select a PDF file");
        if (fields.length === 0) return alert("Please add at least one field");

        setLoading(true);
        const formData = new FormData();
        formData.append('title', title);
        formData.append('subject', subject);
        formData.append('message', message);
        formData.append('state_code', stateCode);
        formData.append('fields_json', JSON.stringify({ fields }));
        formData.append('file', file);

        try {
            const response = await axios.post('http://localhost:8000/templates/create', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setResult(response.data);
            alert("Template created successfully!");
        } catch (error) {
            console.error("Error creating template", error);
            alert("Error: " + (error.response?.data?.detail || error.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto bg-gray-50 min-h-screen font-sans text-gray-900">
            <header className="flex flex-col md:flex-row justify-between items-center mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-indigo-900">Template Designer</h1>
                    <p className="text-gray-500 text-sm font-medium mt-1">Design reusable document templates for Dropbox Sign</p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                    <a href="/user" className="text-xs font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest mr-2">User View →</a>
                    <div className="flex flex-wrap items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200">
                        <span className="text-[10px] font-bold text-gray-400 uppercase px-2">Field Type:</span>
                        {FIELD_TYPES.map(type => (
                            <button
                                key={type.id}
                                onClick={() => setSelectedType(type.id)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all transform active:scale-95 ${selectedType === type.id
                                    ? `bg-indigo-600 text-white shadow-lg`
                                    : `bg-white text-gray-600 hover:bg-gray-100 border border-gray-200`
                                    }`}
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Panel: Settings */}
                <aside className="lg:col-span-3 space-y-6">
                    <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h2 className="text-lg font-bold mb-4 flex items-center">
                            <span className="bg-indigo-100 text-indigo-600 p-1.5 rounded-lg mr-2">
                                <svg className="w-5 h-5" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </span>
                            Template Settings
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">State Code</label>
                                <input type="text" value={stateCode} onChange={(e) => setStateCode(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="e.g. NY" required />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Template Title</label>
                                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" required />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Email Subject</label>
                                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" required />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Upload PDF</label>
                                <div className="relative group">
                                    <input type="file" accept=".pdf" onChange={onFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" required={!pdfDoc} />
                                    <div className="bg-gray-50 border-2 border-dashed border-gray-200 group-hover:border-indigo-400 rounded-xl p-4 text-center transition-all">
                                        <svg className="w-6 h-6 mx-auto text-gray-400 group-hover:text-indigo-500 mb-2" width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                        <span className="text-xs font-bold text-gray-500 group-hover:text-indigo-600">{file ? file.name : "Choose PDF File"}</span>
                                    </div>
                                </div>
                            </div>

                            <button type="submit" disabled={loading || !pdfDoc} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black text-sm shadow-xl shadow-indigo-200 hover:bg-indigo-700 disabled:bg-gray-200 disabled:shadow-none transition-all transform active:scale-[0.98] mt-4">
                                {loading ? "CREATING..." : "CREATE TEMPLATE"}
                            </button>
                        </form>
                    </section>

                    <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold">Placed Fields</h2>
                            {fields.length > 0 && (
                                <button onClick={clearFields} className="text-[10px] font-black text-red-500 hover:text-red-700 uppercase tracking-tighter">Clear All</button>
                            )}
                        </div>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {fields.length === 0 ? (
                                <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                    <p className="text-xs font-bold text-gray-400">No fields placed yet</p>
                                </div>
                            ) : (
                                fields.map((f, i) => {
                                    const typeInfo = FIELD_TYPES.find(t => t.id === (f.displayType || f.type)) || FIELD_TYPES[0];
                                    return (
                                        <div key={i} className="group flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-indigo-200 transition-all">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: typeInfo.hex }}></div>
                                                <div>
                                                    <p className="text-xs font-black text-gray-800 leading-none">{f.name}</p>
                                                    <p className="text-[9px] font-bold text-gray-400 uppercase mt-1">Page {f.page} • {typeInfo.label}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => toggleRequired(i)}
                                                    className={`text-[9px] font-black px-1.5 py-0.5 rounded border transition-colors ${f.required ? 'bg-indigo-100 text-indigo-600 border-indigo-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}
                                                    title="Toggle Required"
                                                >
                                                    {f.required ? 'REQ' : 'OPT'}
                                                </button>
                                                <button onClick={() => removeField(i)} className="text-gray-300 hover:text-red-500 transition-colors">
                                                    <svg className="w-4 h-4" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </section>
                </aside>

                {/* Main Panel: PDF Preview */}
                <main className="lg:col-span-9 space-y-4">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="bg-gray-900 p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex items-center space-x-6">
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={!pdfDoc || currentPage === 1}
                                        className="p-2 text-gray-400 hover:text-white disabled:opacity-20 transition-colors"
                                    >
                                        <svg className="w-5 h-5" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                                    </button>
                                    <span className="text-[10px] font-black text-white w-20 text-center uppercase tracking-widest">
                                        {pdfDoc ? `PAGE ${currentPage} / ${pdfDoc.numPages}` : "NO PDF"}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(pdfDoc.numPages, prev + 1))}
                                        disabled={!pdfDoc || currentPage === pdfDoc?.numPages}
                                        className="p-2 text-gray-400 hover:text-white disabled:opacity-20 transition-colors"
                                    >
                                        <svg className="w-5 h-5" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                    </button>
                                </div>
                                <div className="hidden sm:block h-4 w-px bg-gray-700"></div>
                                <div className="flex items-center space-x-2">
                                    <button onClick={() => setScale(prev => Math.max(0.5, prev - 0.25))} className="p-2 text-gray-400 hover:text-white transition-colors">
                                        <svg className="w-5 h-5" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg>
                                    </button>
                                    <span className="text-[10px] font-black text-white w-12 text-center">{Math.round(scale * 100)}%</span>
                                    <button onClick={() => setScale(prev => Math.min(3, prev + 0.25))} className="p-2 text-gray-400 hover:text-white transition-colors">
                                        <svg className="w-5 h-5" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className="flex items-center space-x-2 bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700">
                                    <div className="w-2 h-2 rounded-full animate-pulse bg-green-500"></div>
                                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Live Editor</span>
                                </div>
                            </div>
                        </div>

                        <div
                            ref={containerRef}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            className="relative bg-gray-200 p-4 sm:p-8 flex justify-center overflow-auto max-h-[800px] min-h-[400px] sm:min-h-[600px] custom-scrollbar"
                        >
                            {pdfLoading && (
                                <div className="absolute inset-0 z-50 bg-gray-200 bg-opacity-80 flex flex-col items-center justify-center">
                                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                                    <p className="text-sm font-black text-indigo-900 uppercase tracking-widest">Loading Document...</p>
                                </div>
                            )}

                            <div className="relative shadow-2xl bg-white">
                                <canvas
                                    ref={canvasRef}
                                    onClick={handleCanvasClick}
                                    className="cursor-crosshair block"
                                />

                                {/* Visual indicators for fields */}
                                {fields.filter(f => f.page === currentPage).map((f, i) => {
                                    const typeInfo = FIELD_TYPES.find(t => t.id === (f.displayType || f.type)) || FIELD_TYPES[0];
                                    return (
                                        <div
                                            key={i}
                                            onMouseDown={(e) => handleMouseDown(e, fields.indexOf(f))}
                                            className={`absolute border-2 flex items-center justify-center text-[9px] font-black overflow-hidden shadow-sm transition-all cursor-move select-none ${f.required ? 'border-solid' : 'border-dashed'} ${draggingIndex === fields.indexOf(f) ? 'z-50 ring-2 ring-indigo-400 ring-offset-2' : 'z-10'}`}
                                            style={{
                                                left: `${f.x * scale}px`,
                                                top: `${f.y * scale}px`,
                                                width: `${f.width * scale}px`,
                                                height: `${f.height * scale}px`,
                                                borderColor: typeInfo.hex,
                                                backgroundColor: draggingIndex === fields.indexOf(f) ? `${typeInfo.hex}44` : `${typeInfo.hex}22`,
                                                color: typeInfo.hex,
                                            }}
                                        >
                                            <span className="bg-white bg-opacity-90 px-1 rounded shadow-sm">
                                                {f.name}{f.required ? '*' : ''}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {!pdfDoc && !pdfLoading && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 space-y-4 p-8">
                                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center border-4 border-white shadow-inner">
                                        <svg className="w-10 h-10 text-gray-300" width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-black text-gray-500 uppercase tracking-widest">No Document Loaded</p>
                                        <p className="text-xs font-medium text-gray-400 mt-1">Upload a PDF to start placing fields</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-indigo-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between shadow-lg shadow-indigo-100 gap-4">
                        <div className="flex items-center space-x-4">
                            <div className="bg-indigo-700 p-2 rounded-xl">
                                <svg className="w-5 h-5" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest leading-none">Quick Tip</p>
                                <p className="text-[10px] font-medium text-indigo-200 mt-1">Select a field type from the top bar, then click anywhere on the document to place it.</p>
                            </div>
                        </div>
                        <div className="text-center sm:text-right">
                            <p className="text-[10px] font-black text-indigo-300 uppercase tracking-tighter">Total Fields</p>
                            <p className="text-xl font-black leading-none">{fields.length}</p>
                        </div>
                    </div>
                </main>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
                #root { max-width: 100% !important; margin: 0 !important; padding: 0 !important; text-align: left !important; }
                body { display: block !important; }
            `}} />
        </div>
    );
};

export default AdminPage;
