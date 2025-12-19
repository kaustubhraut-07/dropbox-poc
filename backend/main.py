from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil

# ✅ Import SDK models DIRECTLY from dropbox_sign
from dropbox_sign import (
    SignatureRequestCreateEmbeddedRequest,
    SubSignatureRequestSigner,
    ApiException,
)

# ✅ Import initialized clients from your wrapper
from dropbox_sign_client import (
    signature_api,
    embedded_api,
    CLIENT_ID,
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# -------------------------------
# Create Signature Request
# -------------------------------
@app.post("/create-signature")
def create_signature(email: str, name: str):
    try:
        request = SignatureRequestCreateEmbeddedRequest(
            title="Demo Agreement",
            subject="Please sign this document",
            message="Sign digitally",
            signers=[
                SubSignatureRequestSigner(
                    email_address=email,
                    name=name,
                    order=0,
                )
            ],
            files=["sample.pdf"],  # must exist in backend folder
            client_id=CLIENT_ID,
        )

        response = signature_api.signature_request_create_embedded(request)
        signature_id = response.signature_request.signatures[0].signature_id

        sign_url_response = embedded_api.embedded_sign_url(signature_id)

        return {
            "sign_url": sign_url_response.embedded.sign_url
        }

    except ApiException as e:
        return {"error": str(e)}

# -------------------------------
# Upload Signed PDF
# -------------------------------
@app.post("/upload-pdf")
def upload_pdf(file: UploadFile = File(...)):
    file_path = f"{UPLOAD_DIR}/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "status": "uploaded",
        "file": file.filename
    }

# -------------------------------
# Webhook (Optional)
# -------------------------------
@app.post("/webhook")
def webhook(event: dict):
    print("Webhook received:", event)
    return {"status": "ok"}
