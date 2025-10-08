from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import gmail_integration
import ai_generator  # New import for AI functionality
import web_scraper  # New import for web scraping functionality
from email_refiner import refine_email_content
from company_analyzer import enhance_company_data
from ai_prompts import analyze_company
import os
import tempfile

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

class AIContentRequest(BaseModel):
    placeholder: str
    recipient_email: str
    template_name: str

class WebScrapingRequest(BaseModel):
    domain: str

class RefineEmailRequest(BaseModel):
    subject: str
    body: str
    recipient_email: str
    industry: Optional[str] = None
    company_name: Optional[str] = None

@app.post("/create-draft")
async def create_draft(
    recipient_email: str = Form(...),
    subject: str = Form(...),
    body: str = Form(...),
    attachment: Optional[UploadFile] = File(None)
):
    try:
        # Check if authenticated, if not, get auth URL
        if not gmail_integration.check_auth():
            auth_url = gmail_integration.get_authorization_url()
            return {"success": False, "auth_required": True, "auth_url": auth_url}
        
        # Handle attachment if provided
        attachment_path = None
        if attachment:
            # Create a temporary file to store the attachment
            with tempfile.NamedTemporaryFile(delete=False) as temp_file:
                content = await attachment.read()
                temp_file.write(content)
                attachment_path = temp_file.name
        
        # Create the draft with attachment
        draft_id = gmail_integration.create_draft(
            recipient_email=recipient_email,
            subject=subject,
            body=body,
            attachment_path=attachment_path
        )
        
        # Clean up temporary file if it exists
        if attachment_path and os.path.exists(attachment_path):
            os.unlink(attachment_path)
        
        return {"success": True, "draft_id": draft_id}
    except Exception as e:
        # Clean up temporary file if it exists
        if attachment_path and os.path.exists(attachment_path):
            os.unlink(attachment_path)
        raise HTTPException(status_code=500, detail=f"Failed to create draft: {str(e)}")

@app.post("/generate-ai-content")
async def generate_ai_content(request: AIContentRequest):
    try:
        content = ai_generator.generate_placeholder_content(
            placeholder=request.placeholder,
            recipient_email=request.recipient_email,
            template_name=request.template_name
        )
        return {"success": True, "content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate AI content: {str(e)}")

@app.post("/scrape-website")
async def scrape_website(request: WebScrapingRequest):
    try:
        print(f"Analyzing company: {request.domain}")
        result = analyze_company(request.domain)
        
        if not result.get("success"):
            print(f"Analysis failed for {request.domain}: {result.get('error', 'Unknown error')}")
            # Return a partial result with default values
            return {
                "success": False,
                "error": result.get("error", "Failed to analyze company"),
                "searchData": {
                    "company_name": request.domain.split('.')[0].capitalize(),
                    "industry": "technology",
                    "business_focus": "digital transformation and growth",
                    "design_focus": "UI/UX optimization for improved user engagement",
                    "development_focus": "Scalable, AI-powered architecture",
                    "ai_integration_focus": "Custom AI solutions for automation and efficiency",
                    "description": f"A company in the technology industry providing innovative solutions."
                }
            }
        
        print(f"Analysis successful for {request.domain}")
        return result
        
    except Exception as e:
        print(f"Exception analyzing company {request.domain}: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "searchData": {
                "company_name": request.domain.split('.')[0].capitalize(),
                "industry": "technology",
                "business_focus": "digital transformation and growth",
                "design_focus": "UI/UX optimization for improved user engagement",
                "development_focus": "Scalable, AI-powered architecture",
                "ai_integration_focus": "Custom AI solutions for automation and efficiency",
                "description": f"A company in the technology industry providing innovative solutions."
            }
        }

@app.post("/refine-email")
async def refine_email(request: RefineEmailRequest):
    try:
        print(f"Refining email for {request.company_name}")
        
        result = refine_email_content(
            request.subject,
            request.body,
            request.recipient_email,
            {
                "industry": request.industry,
                "company_name": request.company_name
            }
        )
        
        print("Refinement completed successfully")
        
        return {
            "success": True,
            "subject": result["subject"],
            "body": result["body"]
        }
    except Exception as e:
        print(f"Refinement failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 