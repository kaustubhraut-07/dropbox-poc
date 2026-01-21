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
    ApiException
)
from dropbox_sign_client import api_key, client_id

class DropboxSignService:
    def __init__(self):
        self.configuration = Configuration(username=api_key)
        self.api_client = ApiClient(self.configuration)
        self.template_api = TemplateApi(self.api_client)
        self.signature_api = SignatureRequestApi(self.api_client)
        self.client_id = client_id

    def create_template(self, file_path: str, fields: List[dict], title: str, subject: str, message: str):
        try:
            # 1. Define Signer Roles
            # For simplicity, we assume one role "Client" as per requirements
            roles = [SubTemplateRole(name="Client", order=0)]

            # 2. Map Fields to form_fields_per_document
            form_fields = []
            for field in fields:
                field_data = {
                    "api_id": field["name"],
                    "name": field["name"],
                    "type": field["type"],
                    "x": field["x"],
                    "y": field["y"],
                    "width": field["width"],
                    "height": field["height"],
                    "required": field.get("required", True),
                    "signer": field.get("signer_role", "Client"),
                    "page": field["page"],
                    "document_index": 0  # Required by Python SDK for flat list
                }
                form_fields.append(field_data)

            # 3. Create Request
            request = TemplateCreateRequest(
                title=title,
                subject=subject,
                message=message,
                signer_roles=roles,
                files=[open(file_path, "rb")],
                form_fields_per_document=form_fields, # Flat list in Python SDK
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
                    role="Client",
                    email_address=signer_email,
                    name=signer_name
                )
            ]

            request = SignatureRequestSendWithTemplateRequest(
                template_ids=[template_id],
                signers=signers,
                client_id=self.client_id,
                test_mode=True
            )

            if custom_fields:
                # Map custom fields if needed
                pass

            response = self.signature_api.signature_request_send_with_template(request)
            return response.signature_request

        except ApiException as e:
            print(f"Exception when calling SignatureRequestApi->signature_request_send_with_template: {e}\n")
            raise e
