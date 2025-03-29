import os
import base64
from email.mime.text import MIMEText
from dotenv import load_dotenv
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
import pickle

# Load environment variables from .env file
load_dotenv()

# Get credentials from environment variables
CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')
REDIRECT_URI = 'http://127.0.0.1:63924'
SCOPES = ['https://www.googleapis.com/auth/gmail.compose']
TOKEN_FILE = 'token.pickle'

def get_gmail_service():
    """Authenticate and get the Gmail service."""
    creds = None
    
    # Try to load credentials from token.pickle
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
                        "client_id": CLIENT_ID,
                        "client_secret": CLIENT_SECRET,
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                        "redirect_uris": [REDIRECT_URI]
                    }
                },
                SCOPES
            )
            flow.redirect_uri = REDIRECT_URI
            
            # Get authorization URL for user to visit
            auth_url, _ = flow.authorization_url(prompt='consent')
            print(f"Please go to this URL and authorize the application: {auth_url}")
            
            # Wait for user to complete authorization
            auth_code = input("Enter the authorization code from the redirect URL: ")
            
            # Exchange authorization code for token
            flow.fetch_token(code=auth_code)
            creds = flow.credentials
            
            # Save credentials for next run
            with open(TOKEN_FILE, 'wb') as token:
                pickle.dump(creds, token)
    
    # Build and return the Gmail service
    return build('gmail', 'v1', credentials=creds)

def create_draft(email, subject, body):
    """Create a draft email."""
    try:
        # Get Gmail service
        service = get_gmail_service()
        
        # Create message
        message = MIMEText(body)
        message['to'] = email
        message['subject'] = subject
        
        # Encode the message
        encoded_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
        
        # Create the draft
        draft = service.users().drafts().create(
            userId='me',
            body={'message': {'raw': encoded_message}}
        ).execute()
        
        print(f"Draft created with ID: {draft['id']}")
        return draft['id']
    except Exception as e:
        print(f"Error creating draft: {str(e)}")
        return None

def main():
    # Simple test of draft creation
    email = input("Enter recipient email address: ")
    subject = input("Enter email subject: ")
    body = input("Enter email body: ")
    
    draft_id = create_draft(email, subject, body)
    if draft_id:
        print("Draft email created successfully! Check your Gmail drafts.")
    else:
        print("Failed to create draft email.")

if __name__ == "__main__":
    main()