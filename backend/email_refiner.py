import os
import requests
from dotenv import load_dotenv
import openai
from typing import Tuple

# Load environment variables
load_dotenv()

# Get API key from environment variables
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

# Configure OpenAI client
openai.api_key = "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"

def refine_email_content(subject: str, body: str, recipient_email: str, additional_info: dict):
    industry = additional_info.get("industry", "")
    company_name = additional_info.get("company_name", "")
    
    system_prompt = """You are an expert email editor specializing in business development and partnership emails. 
    Your task is to refine the email to be conversational and approachable yet still professional:
    1. ONLY modify text that appears to be placeholders or has grammatical or contextual errors
    2. DO NOT change the email's content, tone, or industry focus
    3. Preserve the original writer's voice and style while keeping human and quick to the point
    4. Make sure the email is not too long, keep it short and to the point
    
    The tone should be like a trusted advisor or colleague - human and quick to the point, professional enough for business context."""

    user_prompt = f"""Refine this email for {company_name} in the {industry} industry.
    Make it sound like a real person talking - casual but still professional:
    - Replace any stuffy corporate language with more conversational phrases
    - Write how you'd actually speak to a colleague (but without slang or unprofessional language)
    - Keep it friendly and approachable while maintaining expertise
    - Include conversational transitions and a natural flow
    Current Subject: {subject}
    Current Body: {body}"""

    try:
        # Validate input
        if not subject or not body:
            raise ValueError("Email subject and body cannot be empty")
            
        if len(body) < 50:
            raise ValueError("Email body is too short for meaningful refinement")
        
        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=2000
        )

        refined_content = response.choices[0].message.content
        
        # Parse the refined content to extract subject and body
        try:
            refined_parts = refined_content.split("\n", 1)
            refined_subject = refined_parts[0].replace("Subject: ", "").strip()
            refined_body = refined_parts[1].replace("Body: ", "").strip()
            
            # Additional validation
            if not refined_subject or len(refined_subject) < 10:
                refined_subject = subject
                print("Warning: Generated subject was too short, using original")
                
            if not refined_body or len(refined_body) < 100:
                raise ValueError("Generated email body is too short or empty")
        except Exception as parsing_error:
            print(f"Error parsing AI response: {str(parsing_error)}")
            raise ValueError("Error parsing refined email content") from parsing_error

        # Perform enhanced validation to ensure professional quality
        professional_score = validate_professional_tone(refined_body)
        if professional_score < 0.7:  # Threshold for professional content
            print(f"Warning: Professional score too low ({professional_score})")
            refined_body = enforce_professional_tone(refined_body, company_name)
    

        return {
            "subject": refined_subject,
            "body": refined_body
        }

    except Exception as e:
        print(f"Error in email refinement: {str(e)}")
        raise

def calculate_similarity(original: str, refined: str) -> float:
    """Calculate a simple similarity ratio between original and refined text"""
    # This is a simplified implementation - in production you might want to use
    # more sophisticated text similarity algorithms like cosine similarity
    original_words = set(original.lower().split())
    refined_words = set(refined.lower().split())
    
    if not original_words:
        return 0.0
        
    common_words = original_words.intersection(refined_words)
    return len(common_words) / len(original_words)

def validate_professional_tone(text: str) -> float:
    """Validate how professional the text sounds using simple heuristics"""
    # Simple implementation - could be replaced with a more sophisticated model
    casual_phrases = ["hey there", "what's up", "awesome", "cool", "yeah", "super", 
                      "totally", "btw", "gonna", "wanna", "gotta", "u", "ur", "thx"]
    
    professional_phrases = ["dear", "sincerely", "best regards", "thank you", "opportunity", 
                           "value", "solution", "expertise", "professional", "looking forward"]
    
    text_lower = text.lower()
    
    casual_count = sum(1 for phrase in casual_phrases if phrase in text_lower)
    professional_count = sum(1 for phrase in professional_phrases if phrase in text_lower)
    
    # Calculate a simple professional score
    total_markers = casual_count + professional_count
    if total_markers == 0:
        return 0.5  # Neutral if no markers found
        
    return professional_count / total_markers

def enforce_professional_tone(text: str, company_name: str) -> str:
    """Enforce a professional tone in the email"""
    # Simple implementation - in production you might want to use an LLM for this
    
    # Add formal greeting if missing
    if not any(greeting in text.lower() for greeting in ["dear", "hello", "hi", "greetings"]):
        text = f"Dear {company_name} Team,\n\n" + text
    
    # Add formal closing if missing
    if not any(closing in text.lower() for closing in ["sincerely", "regards", "thank you", "best"]):
        text = text + "\n\nBest regards,\n[Your Name]\n[Your Position]"
    
    # Replace casual phrases
    replacements = {
        "Hey": "Hello",
        "Hey there": "Hello",
        "What's up": "I hope this email finds you well",
        "Awesome": "Excellent",
        "Cool": "Impressive",
        "Yeah": "Yes",
        "Wanna": "Want to",
        "Gonna": "Going to",
        "BTW": "By the way",
        "Thanks": "Thank you",
        "Thx": "Thank you"
    }
    
    for casual, formal in replacements.items():
        text = text.replace(casual, formal)
        text = text.replace(casual.lower(), formal.lower())
    
    return text
