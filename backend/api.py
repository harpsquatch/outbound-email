from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import gmail_integration

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class EmailDraft(BaseModel):
    recipient_email: str
    subject: str
    body: str

@app.post("/create-draft")
async def create_draft(email_draft: EmailDraft):
    try:
        # Check if authenticated, if not, get auth URL
        if not gmail_integration.check_auth():
            auth_url = gmail_integration.get_authorization_url()
            return {"success": False, "auth_required": True, "auth_url": auth_url}
        
        # If authenticated, create the draft
        draft_id = gmail_integration.create_draft(
            recipient_email=email_draft.recipient_email,
            subject=email_draft.subject,
            body=email_draft.body
        )
        return {"success": True, "draft_id": draft_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create draft: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 