import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "./api";

function DocumentPage() {
  const navigate = useNavigate();
  const [selectedOption, setSelectedOption] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      await api.post("/upload-pdf", formData);
      alert("PDF Uploaded successfully!");
      setSelectedOption("upload");
    } catch (error) {
      console.error("Upload failed", error);
      alert("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSignClick = () => {
    setSelectedOption("sign");
    navigate("/sign");
  };

  return (
    <div className="container">
      <h1>Document Portal</h1>
      <p>Please choose how you would like to proceed with your document.</p>

      <div className="options-grid">
        <div 
          className={`option-card ${selectedOption === 'sign' ? 'selected' : ''}`}
          onClick={handleSignClick}
        >
          <div className="icon">✍️</div>
          <h3>Digital Signature</h3>
          <p>Sign the document electronically using Dropbox Sign.</p>
          <button onClick={(e) => { e.stopPropagation(); handleSignClick(); }}>
            Sign Now
          </button>
        </div>

        <div 
          className={`option-card ${selectedOption === 'upload' ? 'selected' : ''}`}
        >
          <div className="icon">📁</div>
          <h3>PDF Upload</h3>
          <p>Already have a signed copy? Upload it here.</p>
          
          <label className="upload-label">
            {isUploading ? "Uploading..." : "Choose File"}
            <input 
              type="file" 
              className="upload-input" 
              onChange={handleUpload}
              disabled={isUploading}
              accept=".pdf"
            />
          </label>
          {selectedOption === 'upload' && (
            <div className="status-badge status-complete">Uploaded</div>
          )}
        </div>
      </div>

      {selectedOption && (
        <div style={{ marginTop: '2rem', opacity: 0.7 }}>
          Selected: {selectedOption === 'sign' ? 'Digital Signature' : 'PDF Upload'}
        </div>
      )}
    </div>
  );
}

export default DocumentPage;

