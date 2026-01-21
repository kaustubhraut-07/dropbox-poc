import os
import json
from typing import List
from dropbox_sign import (
    ApiClient,
    Configuration,
    TemplateApi,
    SignatureRequestApi,
    TemplateCreateRequest,
    SubTemplateRole,
    SubFormFieldsPerDocumentBase,
    SubFormFieldRule,
    SignatureRequestSendWithTemplateRequest,
    SubSignatureRequestTemplateSigner,
    SignatureRequestCreateEmbeddedWithTemplateRequest,
    EmbeddedApi,
    ApiException
)
from dropbox_sign_client import api_key, client_id

class DropboxSignService:
    def __init__(self):
        self.configuration = Configuration(username=api_key)
        self.api_client = ApiClient(self.configuration)
        self.template_api = TemplateApi(self.api_client)
        self.signature_api = SignatureRequestApi(self.api_client)
        self.embedded_api = EmbeddedApi(self.api_client)
        self.client_id = client_id

    def create_template(self, file_path: str, fields: List[dict], title: str, subject: str, message: str):
        try:
            # 1. Define Signer Roles
            # Using "Signer" as a more standard role name
            roles = [SubTemplateRole(name="Signer", order=0)]

            # 2. Map Fields to SDK models
            from dropbox_sign import (
                SubFormFieldsPerDocumentText,
                SubFormFieldsPerDocumentSignature,
                SubFormFieldsPerDocumentInitials,
                SubFormFieldsPerDocumentCheckbox,
                SubFormFieldsPerDocumentDateSigned
            )

            form_fields = []
            for field in fields:
                field_type = field["type"]
                # Common parameters for all field types
                params = {
                    "api_id": field["name"],
                    "name": field["name"],
                    "type": field_type, # Explicitly required by SDK models
                    "x": field["x"],
                    "y": field["y"],
                    "width": field["width"],
                    "height": field["height"],
                    "required": field.get("required", True),
                    "signer": 0, # Use integer index for TemplateCreateRequest
                    "page": field["page"],
                    "document_index": 0
                }

                if field_type == "text":
                    form_fields.append(SubFormFieldsPerDocumentText(**params))
                elif field_type == "signature":
                    form_fields.append(SubFormFieldsPerDocumentSignature(**params))
                elif field_type == "initials":
                    form_fields.append(SubFormFieldsPerDocumentInitials(**params))
                elif field_type == "checkbox":
                    params["is_checked"] = False # Required by SDK
                    form_fields.append(SubFormFieldsPerDocumentCheckbox(**params))
                elif field_type == "date_signed":
                    form_fields.append(SubFormFieldsPerDocumentDateSigned(**params))
                else:
                    # Default to text if type is unknown
                    form_fields.append(SubFormFieldsPerDocumentText(**params))

            # 3. Create Request
            with open(file_path, "rb") as f:
                request = TemplateCreateRequest(
                    title=title,
                    subject=subject,
                    message=message,
                    signer_roles=roles,
                    files=[f],
                    form_fields_per_document=form_fields,
                    test_mode=True
                )

                # 4. Call API
                response = self.template_api.template_create(request)
                return response.template.template_id

        except ApiException as e:
            print(f"Exception when calling TemplateApi->template_create: {e}\n")
            raise e
        except Exception as e:
            print(f"General error in create_template: {e}")
            raise e

    def send_with_template(self, template_id: str, signer_email: str, signer_name: str, custom_fields: dict = None):
        try:
            signers = [
                SubSignatureRequestTemplateSigner(
                    role="Signer",
                    email_address=signer_email,
                    name=signer_name
                )
            ]

            # Use Embedded Request to avoid email delivery restrictions in test mode
            request = SignatureRequestCreateEmbeddedWithTemplateRequest(
                template_ids=[template_id],
                signers=signers,
                client_id=self.client_id,
                test_mode=True
            )

            if custom_fields:
                # Map custom fields if needed
                pass

            # 1. Create the embedded signature request
            response = self.signature_api.signature_request_create_embedded_with_template(request)
            signature_request = response.signature_request
            
            # 2. Get the sign_url for the first signature
            signature_id = signature_request.signatures[0].signature_id
            embedded_response = self.embedded_api.embedded_sign_url(signature_id)
            
            # Add the sign_url to the signature_request object for the frontend
            signature_request.signing_url = embedded_response.embedded.sign_url
            
            return signature_request

        except ApiException as e:
            print(f"Exception when calling Dropbox Sign API: {e}\n")
            raise e

    def get_signature_request(self, signature_request_id: str):
        try:
            response = self.signature_api.signature_request_get(signature_request_id)
            return response.signature_request
        except ApiException as e:
            print(f"Exception when calling SignatureRequestApi->signature_request_get: {e}\n")
            raise e
