import os
from dotenv import load_dotenv
import dropbox_sign
from dropbox_sign import ApiClient, SignatureRequestApi, EmbeddedApi, Configuration

# Load environment variables from .env file
load_dotenv()

api_key = os.getenv("DROPBOX_SIGN_API_KEY")
client_id = os.getenv("DROPBOX_SIGN_CLIENT_ID")

if not api_key:
    print("❌ WARNING: DROPBOX_SIGN_API_KEY is not set in .env")
if not client_id:
    print("❌ WARNING: DROPBOX_SIGN_CLIENT_ID is not set in .env")

# Configure API key authorization: api_key
configuration = Configuration(
    username=api_key,
)

client = ApiClient(configuration)
signature_api = SignatureRequestApi(client)
embedded_api = EmbeddedApi(client)

CLIENT_ID = client_id
if CLIENT_ID:
    print(f"✅ Backend using Client ID: {CLIENT_ID[:4]}...{CLIENT_ID[-4:]}")
else:
    print("❌ Backend CLIENT_ID is MISSING!")


