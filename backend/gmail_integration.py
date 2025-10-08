import os
import pickle
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from email.mime.application import MIMEApplication
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

# Path to signature image and company PDF
SIGNATURE_IMAGE_PATH = os.path.join(os.path.dirname(__file__), 'assets', 'signature.png')
COMPANY_PDF_PATH = os.path.join(os.path.dirname(__file__), 'assets', 'company_pdfs', 'Decodes.pdf')

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

def create_draft(recipient_email, subject, body, attachment_path=None):
    """Create an email draft in Gmail with optional attachment and signature."""
    try:
        service = get_gmail_service()
        
        # Create multipart message
        message = MIMEMultipart('mixed')
        message['to'] = recipient_email
        message['subject'] = subject
        
        # Create the multipart/alternative part to hold the text and HTML versions
        msg_alternative = MIMEMultipart('alternative')
        
        # Add text body (plain text version)
        text_part = MIMEText(body, 'plain')
        msg_alternative.attach(text_part)
        
        # Convert Markdown-style formatting to HTML
        # Handle bold text
        formatted_body = body.replace('**', '<strong>', 1)
        while '**' in formatted_body:
            formatted_body = formatted_body.replace('**', '</strong>', 1)
            if '**' in formatted_body:
                formatted_body = formatted_body.replace('**', '<strong>', 1)
        
        # Handle bullet points
        formatted_body = formatted_body.replace('\n• ', '\n<li>')
        formatted_body = formatted_body.replace('\n</li>', '</li>\n')
        
        # If there are bullet points, wrap them in a ul tag
        if '<li>' in formatted_body:
            # Split the text into lines
            lines = formatted_body.split('\n')
            in_list = False
            for i in range(len(lines)):
                if lines[i].strip().startswith('<li>') and not in_list:
                    lines[i] = '<ul>' + lines[i]
                    in_list = True
                elif in_list and (i == len(lines) - 1 or not lines[i+1].strip().startswith('<li>')):
                    lines[i] = lines[i] + '</ul>'
                    in_list = False
            formatted_body = '\n'.join(lines)
        
        # Convert newlines to <br> tags
        formatted_body = formatted_body.replace('\n', '<br>')
        
        # Add HTML body with signature
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6;">
        {formatted_body}
        <br><br>
        <img src="cid:signature" alt="Signature" style="max-width: 200px;">
        </body>
        </html>
        """
        html_part = MIMEText(html_body, 'html')
        msg_alternative.attach(html_part)
        
        # Attach the alternative part to the main message
        message.attach(msg_alternative)
        
        # Add signature image
        if os.path.exists(SIGNATURE_IMAGE_PATH):
            with open(SIGNATURE_IMAGE_PATH, 'rb') as f:
                img = MIMEImage(f.read())
                img.add_header('Content-ID', '<signature>')
                img.add_header('Content-Disposition', 'inline')
                message.attach(img)
        
        # Add Decodes.pdf to every email
        if os.path.exists(COMPANY_PDF_PATH):
            with open(COMPANY_PDF_PATH, 'rb') as f:
                pdf = MIMEApplication(f.read())
                pdf.add_header(
                    'Content-Disposition', 
                    'attachment', 
                    filename='Decodes.pdf'
                )
                message.attach(pdf)
        
        # Add any additional attachment if provided
        if attachment_path and os.path.exists(attachment_path):
            with open(attachment_path, 'rb') as f:
                attachment = MIMEApplication(f.read())
                attachment.add_header(
                    'Content-Disposition', 
                    'attachment', 
                    filename=os.path.basename(attachment_path)
                )
                message.attach(attachment)
        
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