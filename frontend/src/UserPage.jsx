import React, { useState, useEffect } from 'react';
import axios from 'axios';
import HelloSign from 'hellosign-embedded';

const clientId = import.meta.env.VITE_DROPBOX_SIGN_CLIENT_ID || "18cf67e16badba297d5924f7f457477d";

const UserPage = () => {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [stateCode, setStateCode] = useState('');
    const [templates, setTemplates] = useState({});
    const [loading, setLoading] = useState(false);
    const [signUrl, setSignUrl] = useState(null);

    const client = new HelloSign({
        clientId: clientId
    });

    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const response = await axios.get('http://localhost:8000/templates');
                console.log("📦 Templates loaded from backend store:", response.data);
                setTemplates(response.data);
                if (Object.keys(response.data).length > 0) {
                    setStateCode(Object.keys(response.data)[0]);
                }
            } catch (error) {
                console.error("Error fetching templates", error);
            }
        };
        fetchTemplates();
    }, []);

    const handleSend = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await axios.post('http://localhost:8000/templates/send', {
                signer_email: email,
                signer_name: name,
                state_code: stateCode
            });
            console.log("Signature request response:", response.data);

            if (response.data.signing_url) {
                setSignUrl(response.data.signing_url);

                client.open(response.data.signing_url, {
                    testMode: true,
                    skipDomainVerification: true,
                    allowCancel: true,
                    message: "Please sign the document to complete the process."
                });

                client.on('sign', async (data) => {
                    console.log("Document signed!", data);
                    alert("Document signed successfully!");

                    // Fetch and log the field values (responses)
                    try {
                        const details = await axios.get(`http://localhost:8000/signature-request/${data.signature_request_id}`);
                        console.log("📝 SIGNED FIELD VALUES:", details.data.responses);
                    } catch (err) {
                        console.error("Error fetching signed data:", err);
                    }
                });

                client.on('error', (data) => {
                    console.error("Signing error", data);
                });
            } else {
                alert("Signature request sent! Please check your email for the signing link.");
            }
        } catch (error) {
            console.error("Error sending request", error);
            alert("Error: " + (error.response?.data?.detail || error.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
                <div className="bg-indigo-600 p-8 text-white text-center relative">
                    <a href="/admin" className="absolute top-4 left-4 text-[10px] font-black uppercase tracking-widest text-indigo-200 hover:text-white transition-colors">← Admin Designer</a>
                    <h1 className="text-3xl font-extrabold">Sign Document</h1>
                    <p className="mt-2 text-indigo-100">Enter your details to receive a signature request</p>
                </div>

                <form onSubmit={handleSend} className="p-8 space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-black-700 uppercase tracking-wider">Select State / Template</label>
                        <select
                            value={stateCode}
                            onChange={(e) => setStateCode(e.target.value)}
                            className="mt-2 block w-full border-2 border-gray-200 rounded-xl text-black p-3 focus:border-indigo-500 focus:ring-0 transition-colors"
                            required
                        >
                            {Object.keys(templates).length > 0 ? (
                                Object.keys(templates).map(code => (
                                    <option key={code} value={code}>{code}</option>
                                ))
                            ) : (
                                <option value="" disabled>No templates available</option>
                            )}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-black uppercase tracking-wider">Full Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-2 block w-full border-2 border-black text-black rounded-xl p-3 focus:border-indigo-500 focus:ring-0 transition-colors"
                            placeholder="John Doe"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-black uppercase tracking-wider">Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-2 block w-full border-2 border-black text-black rounded-xl p-3 focus:border-indigo-500 focus:ring-0 transition-colors"
                            placeholder="john@example.com"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !stateCode}
                        className="w-full bg-indigo-600 text-white py-4 px-6 rounded-xl hover:bg-indigo-700 disabled:bg-gray-300 font-extrabold shadow-lg transition-all transform active:scale-95"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Sending Request...
                            </span>
                        ) : 'Send Signature Request'}
                    </button>
                </form>

                {signUrl && (
                    <div className="p-8 bg-indigo-50 border-t border-indigo-100 text-center">
                        <p className="text-sm text-indigo-800 font-medium">Signing page opened in a new tab.</p>
                        <a href={signUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-indigo-600 font-bold underline">
                            Click here if it didn't open
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserPage;
