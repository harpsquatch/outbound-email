import os
import requests
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get API key from environment variables
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

def generate_placeholder_content(placeholder, recipient_email, template_name):
    """Generate content for a placeholder using AI."""
    if not OPENAI_API_KEY:
        raise Exception("OpenAI API key not found in environment variables")
    
    # Extract domain from email for company research
    domain = recipient_email.split('@')[-1] if '@' in recipient_email else None
    company_name = domain.split('.')[0].capitalize() if domain else "the company"
    
    # Create specific prompts based on placeholder type
    if placeholder == "specific achievement or aspect of their business":
        if domain and domain != "gmail.com" and domain != "hotmail.com" and domain != "outlook.com" and domain != "yahoo.com":
            # For business domains, create a prompt about their core business
            prompt = f"Based on the company name '{company_name}' from domain '{domain}', what is likely their main business focus or value proposition? Provide a brief, specific description of what problem they likely solve for customers. Keep it concise (25 words or less)."
        else:
            # For generic emails, create a generic placeholder
            prompt = "Generate a generic business value proposition that would be impressive to mention in a cold email (25 words or less)."
    elif placeholder == "Industry":
        if domain and domain != "gmail.com" and domain != "hotmail.com" and domain != "outlook.com" and domain != "yahoo.com":
            prompt = f"Based on the company name '{company_name}' from domain '{domain}', what industry is this company likely in? Respond with just the industry name."
        else:
            prompt = "Generate a specific industry name that would be relevant for B2B sales outreach. Respond with just the industry name."
    elif placeholder == "specific dates/times":
        prompt = "Suggest 3 professional meeting time slots for next week. Format as 'Tuesday at 10 AM ET, Wednesday at 3 PM ET, Thursday at 1 PM ET'. Respond with just the formatted time slots."
    else:
        # General fallback prompt for other placeholders
        prompt = f"Generate appropriate content for the placeholder '{placeholder}' in a professional email. Keep it concise, specific, and realistic. Respond with just the content for the placeholder."

    try:
        # Call OpenAI API
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "gpt-3.5-turbo",
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant that generates concise, professional email content. Respond only with the exact text requested without any additional commentary, explanations, or quotation marks."},
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 50,
                "temperature": 0.7
            }
        )
        
        # Parse response
        result = response.json()
        if "choices" in result and len(result["choices"]) > 0:
            content = result["choices"][0]["message"]["content"].strip()
            
            # Remove any quotes that might be in the response
            content = content.replace('"', '').replace("'", "")
            
            return content
        else:
            print(f"API Error: {result}")
            raise Exception("Invalid response from OpenAI API")
            
    except Exception as e:
        print(f"Generation error: {str(e)}")
        
        # Return fallback values if API call fails
        fallbacks = {
            "specific achievement or aspect of their business": f"innovative solutions in the {company_name} sector",
            "Industry": "Technology",
            "specific dates/times": "Tuesday at 10 AM ET, Wednesday at 3 PM ET, Thursday at 1 PM ET"
        }
        
        # Return fallback or sanitized placeholder
        return fallbacks.get(placeholder, f"[{placeholder}]") 