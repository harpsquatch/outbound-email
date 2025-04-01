from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import gmail_integration
import ai_generator  # New import for AI functionality
import web_scraper  # New import for web scraping functionality
from email_refiner import refine_email_content
from company_analyzer import enhance_company_data

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
        # Get raw company data from web scraper
        company_data = web_scraper.get_company_info(request.domain)
        
        # Enhance the data with AI analysis
        enhanced_data = enhance_company_data(company_data)
        
        # Ensure business_focus is included in the response
        return {
            "success": True,
            "company_name": enhanced_data.get("company_name", ""),
            "industry": enhanced_data.get("industry", ""),
            "business_focus": enhanced_data.get("business_focus", ""),  # This will now be populated
            "description": enhanced_data.get("description", ""),
            "key_achievements": enhanced_data.get("key_achievements", []),
            "values": enhanced_data.get("values", []),
            "market_position": enhanced_data.get("market_position", ""),
            "ai_enhanced": enhanced_data.get("ai_enhanced", False)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze company: {str(e)}")

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