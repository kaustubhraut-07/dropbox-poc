from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil
import json
from typing import List

from models import TemplateCreateRequest, SignatureRequestFromTemplate
from dropbox_service import DropboxSignService

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# In-memory storage for template mapping (State Code -> Template ID)
template_store = {}
TEMPLATE_STORE_FILE = "template_store.json"

# In-memory storage for signed documents
signed_documents = []
SIGNED_DOCS_FILE = "signed_documents.json"

def load_templates():
    global template_store, signed_documents
    if os.path.exists(TEMPLATE_STORE_FILE):
        with open(TEMPLATE_STORE_FILE, "r") as f:
            template_store = json.load(f)
    if os.path.exists(SIGNED_DOCS_FILE):
        with open(SIGNED_DOCS_FILE, "r") as f:
            signed_documents = json.load(f)

def save_templates():
    with open(TEMPLATE_STORE_FILE, "w") as f:
        json.dump(template_store, f)

def save_signed_docs():
    with open(SIGNED_DOCS_FILE, "w") as f:
        json.dump(signed_documents, f)

load_templates()

dropbox_service = DropboxSignService()

@app.post("/templates/create")
async def create_template(
    title: str = Form(...),
    subject: str = Form(...),
    message: str = Form(...),
    state_code: str = Form(...),
    fields_json: str = Form(...),
    file: UploadFile = File(...)
):
    try:
        # Save file temporarily
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Parse fields
        fields = json.loads(fields_json)
        if "fields" in fields:
            fields = fields["fields"]

        # Create template via Dropbox Sign
        template_id = dropbox_service.create_template(
            file_path=file_path,
            fields=fields,
            title=title,
            subject=subject,
            message=message
        )

        # Store template mapping
        template_store[state_code] = template_id
        save_templates()

        return {
            "status": "success",
            "template_id": template_id,
            "state_code": state_code
        }

    except Exception as e:
        print(f"Error creating template: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/templates/send")
async def send_signature_request(request: SignatureRequestFromTemplate):
    try:
        template_id = request.template_id
        if not template_id and request.state_code:
            template_id = template_store.get(request.state_code)

        if not template_id:
            raise HTTPException(status_code=404, detail="Template not found for the given state code.")

        response = dropbox_service.send_with_template(
            template_id=template_id,
            signer_email=request.signer_email,
            signer_name=request.signer_name,
            custom_fields=request.custom_fields
        )

        return {
            "status": "success",
            "signature_request_id": response.signature_request_id,
            "signing_url": response.signing_url if hasattr(response, 'signing_url') else None
        }

    except Exception as e:
        print(f"Error sending signature request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/signature-request/{id}")
async def get_signature_request(id: str):
    try:
        response = dropbox_service.get_signature_request(id)
        return response
    except Exception as e:
        print(f"Error fetching signature request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/templates")
async def list_templates():
    return template_store

@app.get("/signed-documents")
async def list_signed_documents():
    return signed_documents

@app.post("/webhook")
async def webhook(json_data: str = Form(None, alias="json")):
    try:
        if not json_data:
            return "HelloSign Will Use This URL"

        event_data = json.loads(json_data)
        event_type = event_data.get("event", {}).get("event_type")
        print(f"🔔 Webhook received: {event_type}")

        if event_type == "signature_request_signed":
            sig_request = event_data.get("signature_request", {})
            request_id = sig_request.get("signature_request_id")
            # Extract form field values
            responses = sig_request.get("responses", [])
            print(f"✅ Document signed: {request_id}")
            
            doc_data = {
                "signature_request_id": request_id,
                "signer_email": sig_request.get("signatures", [{}])[0].get("signer_email_address"),
                "signer_name": sig_request.get("signatures", [{}])[0].get("signer_name"),
                "responses": responses,
                "signed_at": sig_request.get("signatures", [{}])[0].get("signed_at")
            }
            
            # Check if already exists to avoid duplicates
            if not any(d["signature_request_id"] == request_id for d in signed_documents):
                signed_documents.append(doc_data)
                save_signed_docs()
                print(f"💾 Saved signed document data for: {request_id}")

            print("📝 FIELD VALUES (RESPONSES):")
            for resp in responses:
                print(f"   - {resp.get('name')} ({resp.get('api_id')}): {resp.get('value')}")

        return "HelloSign Will Use This URL"
    except Exception as e:
        print(f"❌ Webhook Error: {e}")
        return "HelloSign Will Use This URL"

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


