import { useNavigate } from "react-router-dom";
import { api } from "./api";

function DocumentPage() {
  const navigate = useNavigate();

  const uploadPdf = async (e) => {
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    await api.post("/upload-pdf", formData);
    alert("PDF Uploaded");
  };

  return (
    <div>
      <h2>Select an option</h2>

      <button onClick={() => navigate("/sign")}>
        Sign Digitally
      </button>

      <br /><br />

      <input type="file" onChange={uploadPdf} />
    </div>
  );
}

export default DocumentPage;
