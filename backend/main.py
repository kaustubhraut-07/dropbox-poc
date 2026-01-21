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
# In production, this would be a database.
template_store = {}
TEMPLATE_STORE_FILE = "template_store.json"

def load_templates():
    global template_store
    if os.path.exists(TEMPLATE_STORE_FILE):
        with open(TEMPLATE_STORE_FILE, "r") as f:
            template_store = json.load(f)

def save_templates():
    with open(TEMPLATE_STORE_FILE, "w") as f:
        json.dump(template_store, f)

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
            "signing_url": response.signatures[0].signing_url if hasattr(response.signatures[0], 'signing_url') else None
        }

    except Exception as e:
        print(f"Error sending signature request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/templates")
async def list_templates():
    return template_store

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
            print(f"📝 Field values: {responses}")
            # In production, persist this data to DB

        return "HelloSign Will Use This URL"
    except Exception as e:
        print(f"❌ Webhook Error: {e}")
        return "HelloSign Will Use This URL"

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


