from fastapi import FastAPI, UploadFile, File, HTTPException
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
        # Use the existing PDF in uploads or a default one
        pdf_path = os.path.join(UPLOAD_DIR, "Implementation-plan.pdf")
        
        if not os.path.exists(pdf_path):
            # Fallback to any pdf in uploads if the specific one is missing
            pdfs = [f for f in os.listdir(UPLOAD_DIR) if f.endswith(".pdf")]
            if pdfs:
                pdf_path = os.path.join(UPLOAD_DIR, pdfs[0])
            else:
                return {"error": "No PDF found in uploads folder to sign. Please upload a PDF first."}

        request = SignatureRequestCreateEmbeddedRequest(
            title="Demo Agreement",
            subject="Please sign this document",
            message="Please sign this document digitally via Dropbox Sign.",
            signers=[
                SubSignatureRequestSigner(
                    email_address=email,
                    name=name,
                    order=0,
                )
            ],
            files=[open(pdf_path, "rb")],
            client_id=CLIENT_ID,
            test_mode=True # Set to True for testing without using credits
        )

        response = signature_api.signature_request_create_embedded(request)
        signature_id = response.signature_request.signatures[0].signature_id
        request_id = response.signature_request.signature_request_id

        sign_url_response = embedded_api.embedded_sign_url(signature_id)

        return {
            "sign_url": sign_url_response.embedded.sign_url,
            "signature_request_id": request_id
        }

    except ApiException as e:
        print(f"ApiException: {e}")
        return {"error": str(e)}
    except Exception as e:
        print(f"General Exception: {e}")
        return {"error": str(e)}

# -------------------------------
# Get Signature Status
# -------------------------------
@app.get("/signature-status/{request_id}")
def get_signature_status(request_id: str):
    try:
        response = signature_api.signature_request_get(request_id)
        return {
            "status": response.signature_request.is_complete,
            "details": response.signature_request.to_dict()
        }
    except ApiException as e:
        return {"error": str(e)}

# -------------------------------
# Upload PDF
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
# Webhook
# -------------------------------
@app.post("/webhook")
def webhook(event: dict):
    print("Webhook received:", event)
    return {"status": "ok"}

