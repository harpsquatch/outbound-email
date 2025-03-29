import os
import pickle
import base64
from email.mime.text import MIMEText
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import Flow
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# If modifying these scopes, delete the token.pickle file.
SCOPES = ['https://www.googleapis.com/auth/gmail.compose']
TOKEN_FILE = 'token.pickle'
REDIRECT_URI = 'http://127.0.0.1:63924'

# Get credentials from environment variables
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')

def get_gmail_service():
    """Get authenticated Gmail API service."""
    creds = None
    
    # Load token from file if it exists
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, 'rb') as token:
            creds = pickle.load(token)
    
    # If credentials don't exist or are invalid, get new ones
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            # Create flow using client ID and secret from environment variables
            flow = Flow.from_client_config(
                {
                    "web": {
                        "client_id": GOOGLE_CLIENT_ID,
                        "client_secret": GOOGLE_CLIENT_SECRET,
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                        "redirect_uris": [REDIRECT_URI]
                    }
                },
                SCOPES
            )
            # Use the specific redirect URI allowed in GCP
            flow.redirect_uri = REDIRECT_URI
            creds = flow.run_local_server(port=63924)
        
        # Save the credentials for the next run
        with open(TOKEN_FILE, 'wb') as token:
            pickle.dump(creds, token)
    
    return build('gmail', 'v1', credentials=creds)

def check_auth():
    """Check if the user is authenticated."""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return False
        
    try:
        get_gmail_service()
        return True
    except Exception:
        return False

def get_authorization_url():
    """Get the OAuth authorization URL."""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return "Error: Google client ID or client secret not found in environment variables"
        
    try:
        # Create flow using client ID and secret from environment variables
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [REDIRECT_URI]
                }
            },
            SCOPES
        )
        # Use the specific redirect URI allowed in GCP
        flow.redirect_uri = REDIRECT_URI
        auth_url, _ = flow.authorization_url(prompt='consent')
        return auth_url
    except Exception as e:
        return f"Error: {str(e)}"

def create_draft(recipient_email, subject, body):
    """Create an email draft in Gmail."""
    try:
        service = get_gmail_service()
        
        # Create message
        message = MIMEText(body)
        message['to'] = recipient_email
        message['subject'] = subject
        
        # Encode the message
        encoded_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
        
        # Create the draft
        draft = service.users().drafts().create(
            userId='me',
            body={'message': {'raw': encoded_message}}
        ).execute()
        
        return draft['id']
    except Exception as e:
        raise Exception(f"Failed to create draft: {str(e)}") 