import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import HelloSign from "hellosign-embedded";
import { api } from "./api";

function SignPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const [status, setStatus] = useState(null);
  const navigate = useNavigate();

  const clientId = import.meta.env.VITE_DROPBOX_SIGN_CLIENT_ID || "18cf67e16badba297d5924f7f457477d";
  console.log("Using Client ID:", clientId);

  const client = new HelloSign({
    clientId: clientId
  });

  useEffect(() => {
    const initSigning = async () => {
      try {
        const res = await api.post("/create-signature", {
          email: "user@test.com",
          name: "Test User"
        },
        {
          headers: {
            "Content-Type": "application/json"
          }
        }
        );

        if (res.data.error) {
          setError(res.data.error);
          setLoading(false);
          return;
        }

        setRequestId(res.data.signature_request_id);

        client.open(res.data.sign_url, {
          testMode: true,
          skipDomainVerification: true, // Useful for local development
          container: document.getElementById("sign-container"),
        });

        client.on("sign", (data) => {
          console.log("Document signed!", data);
          setStatus("Signed successfully!");
          checkStatus(res.data.signature_request_id);
        });

        client.on("error", (data) => {
          console.error("Signing error", data);
          setError("An error occurred during signing.");
        });

        setLoading(false);
      } catch (err) {
        console.error("Failed to initialize signing", err);
        setError("Failed to connect to the server.");
        setLoading(false);
      }
    };

    initSigning();

    return () => {
      client.close();
    };
  }, []);

  const checkStatus = async (id) => {
    try {
      const res = await api.get(`/signature-status/${id}`);
      setStatus(res.data.status ? "Complete" : "Pending");
    } catch (err) {
      console.error("Status check failed", err);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '1000px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Sign Document</h2>
        <button onClick={() => navigate("/")}>Back</button>
      </div>

      {loading && <p>Initializing secure signing session...</p>}
      {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}

      {status && (
        <div className={`status-badge ${status === 'Complete' ? 'status-complete' : 'status-pending'}`}>
          Status: {status}
        </div>
      )}

      <div
        id="sign-container"
        style={{
          width: '100%',
          height: '700px',
          marginTop: '1rem',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '12px',
          overflow: 'hidden'
        }}
      >
        {!loading && !error && !status && (
          <p style={{ padding: '2rem', opacity: 0.5 }}>Loading signing interface...</p>
        )}
      </div>
    </div>
  );
}

export default SignPage;

