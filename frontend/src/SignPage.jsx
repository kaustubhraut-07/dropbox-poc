import { useEffect, useState } from "react";
import { api } from "./api";

function SignPage() {
  const [url, setUrl] = useState("");

  useEffect(() => {
    api.post("/create-signature", null, {
      params: {
        email: "user@test.com",
        name: "Test User"
      }
    }).then(res => {
      setUrl(res.data.sign_url);
    });
  }, []);

  return (
    <div>
      <h2>Sign Document</h2>

      {url && (
        <iframe
          src={url}
          width="100%"
          height="600px"
          title="Dropbox Sign"
        />
      )}
    </div>
  );
}

export default SignPage;
