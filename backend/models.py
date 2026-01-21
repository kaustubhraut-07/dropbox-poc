from pydantic import BaseModel, Field
from typing import List, Optional

class TemplateField(BaseModel):
    name: str
    type: str  # text, signature, date, checkbox
    required: bool = True
    signer_role: str = "Client"
    page: int
    x: int
    y: int
    width: int
    height: int
    validation_type: Optional[str] = "none"

class TemplateCreateRequest(BaseModel):
    title: str
    subject: str
    message: str
    fields: List[TemplateField]
    state_code: str  # e.g., "NY", "CA"

class SignatureRequestFromTemplate(BaseModel):
    template_id: Optional[str] = None
    signer_email: str
    signer_name: str
    state_code: Optional[str] = None
    custom_fields: Optional[dict] = None
