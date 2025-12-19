import os
from dropbox_sign import ApiClient, SignatureRequestApi, EmbeddedApi

client = ApiClient()
client.username = os.getenv("DROPBOX_SIGN_API_KEY")

signature_api = SignatureRequestApi(client)
embedded_api = EmbeddedApi(client)

CLIENT_ID = os.getenv("DROPBOX_SIGN_CLIENT_ID")
