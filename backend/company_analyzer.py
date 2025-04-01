from typing import Dict, Any
import openai
from dotenv import load_dotenv
import os
import json

load_dotenv()
openai.api_key = os.getenv('OPENAI_API_KEY')

def extract_business_focus(description: str) -> str:
    """
    Extract a meaningful business focus/value proposition from the company description.
    """
    system_prompt = """
    You are an expert at identifying a company's core business focus and value proposition.
    Given a company description, extract or formulate a clear, concise business focus statement that:
    1. Highlights what makes the company unique
    2. Emphasizes their main value proposition
    3. Is specific but concise (1-2 sentences max)
    4. Uses active, impactful language
    5. Focuses on benefits/value rather than just features
    
    The statement should be immediately useful in a business email context.
    """

    user_prompt = f"""
    Based on this company description, provide a clear business focus/value proposition statement:
    
    {description}
    
    Requirements:
    - Keep it under 20 words
    - Make it specific and meaningful
    - Focus on their core value to customers
    - Use present tense, active voice
    - Don't use generic phrases like "leading provider" unless truly applicable
    """

    try:
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=100
        )
        
        business_focus = response.choices[0].message.content.strip()
        # Remove any quotes or extra formatting
        business_focus = business_focus.strip('"\'')
        return business_focus
    except Exception as e:
        print(f"Error extracting business focus: {str(e)}")
        return ""

def generate_focus_areas(business_focus: str, industry: str) -> dict:
    """
    Generate tailored focus areas based on the company's business focus and industry.
    """
    system_prompt = """
    You are an expert AI consultant who specializes in identifying specific technical opportunities for companies.
    Given a company's business focus and industry, generate three specific, tailored focus areas:
    1. Design focus: UI/UX and design opportunities 
    2. Development focus: Technical architecture and development opportunities
    3. AI integration focus: Specific AI/ML implementation opportunities

    Each focus area should be:
    - HEAVILY industry-specific with clear terminology and concepts from that industry
    - Include detailed technical approaches relevant to the specific industry
    - Mention specific industry tools, platforms, or methodologies where appropriate
    - Use industry jargon that demonstrates deep domain knowledge
    - Be extremely specific about how the focus area relates to that particular industry
    - One concise but detailed sentence
    - Focused on business value and competitive advantage
    """

    user_prompt = f"""
    Company Information:
    Industry: {industry}

    Generate three specific focus areas that would provide immediate value to this company:
    1. A design focus that would improve their user experience or customer interface
    2. A development focus that would enhance their technical capabilities
    3. An AI integration focus that would give them a competitive advantage

    Format as JSON with three fields:
    - design_focus
    - dev_focus
    - ai_focus
    """

    try:
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            response_format={ "type": "json_object" }
        )

        focus_areas = response.choices[0].message.content
        return json.loads(focus_areas)
    except Exception as e:
        print(f"Error generating focus areas: {str(e)}")
        return {
            "design_focus": "",
            "dev_focus": "",
            "ai_focus": ""
        }

def enhance_company_data(scraped_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enhance scraped company data using AI to make it more coherent and meaningful.
    """
    # First, ensure we have a description to work with
    description = scraped_data.get('description', '')
    if not description:
        # Try to construct a description from other available data
        description_parts = []
        if scraped_data.get('company_name'):
            description_parts.append(f"Company: {scraped_data['company_name']}")
        if scraped_data.get('products'):
            description_parts.append(f"Products/Services: {', '.join(scraped_data['products'])}")
        if scraped_data.get('achievements'):
            description_parts.append(f"Notable achievements: {', '.join(scraped_data['achievements'])}")
        description = ' '.join(description_parts)

    # Extract business focus first
    business_focus = extract_business_focus(description)
    industry = scraped_data.get('industry', '')

    # Generate focus areas based on business focus and industry
    focus_areas = generate_focus_areas(business_focus, industry)

    # Now proceed with the full analysis
    context = f"""
    Company Information:
    Name: {scraped_data.get('company_name', '')}
    Description: {description}
    Business Focus: {business_focus}
    Products/Services: {', '.join(scraped_data.get('products', []))}
    Achievements: {', '.join(scraped_data.get('achievements', []))}
    """

    system_prompt = """
    You are an expert business analyst. Analyze the provided company information and:
    1. Identify the primary industry and any sub-industries
    2. Highlight key achievements and market position
    3. Determine company values and culture
    4. Summarize products/services in a clear, concise way
    
    Format the response as structured data that can be easily parsed.
    Keep descriptions concise but meaningful.
    """

    try:
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Analyze this company:\n{context}"}
            ],
            temperature=0.5,
            response_format={ "type": "json_object" }
        )

        # Parse AI-enhanced data
        enhanced_data = response.choices[0].message.content
        
        # Merge AI-enhanced data with original scraped data and add the business focus
        final_data = {
            **scraped_data,
            **enhanced_data,
            "business_focus": business_focus,
            "design_focus": focus_areas["design_focus"],
            "dev_focus": focus_areas["dev_focus"],
            "ai_focus": focus_areas["ai_focus"],
            "ai_enhanced": True
        }

        return final_data

    except Exception as e:
        print(f"Error in AI enhancement: {str(e)}")
        # If enhancement fails, at least return the business focus
        return {
            **scraped_data,
            "business_focus": business_focus,
            "design_focus": focus_areas["design_focus"],
            "dev_focus": focus_areas["dev_focus"],
            "ai_focus": focus_areas["ai_focus"],
            "ai_enhanced": False
        } 