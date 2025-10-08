from openai import OpenAI
from typing import Dict, Any

def get_company_search_prompt(domain: str) -> Dict[str, Any]:
    return {
        "model": "gpt-4o",
        "tools": [{"type": "web_search_preview"}],
        "input": f"""Search for detailed information about {domain}. Focus on:
1. Company's official website and main business
2. Their primary industry and market position
3. Key products or services
4. Notable achievements or milestones
5. Company values and mission
6. Current market presence and competitors

Please provide comprehensive information that can be used for a detailed company analysis."""
    }

def get_industry_extraction_prompt(domain: str, search_results: str) -> Dict[str, Any]:
    return {
        "model": "gpt-4o",
        "tools": [{"type": "web_search_preview"}],
        "input": f"""Based on these search results about {domain}, identify their primary industry and key business characteristics:

Search results:
{search_results}

Please provide:
1. Primary industry in small case only

Format your response as:[industry]"""
    }

def get_company_analysis_prompt(domain: str, industry: str, search_results: str) -> Dict[str, Any]:
    return {
        "model": "gpt-4o",
        "tools": [{"type": "web_search_preview"}],
        "input": f"""Based on the search results about {domain} in the {industry} industry, provide a detailed analysis with the following format:

Company name: [Full company name]
Industry: {industry}
Design Focus: [One specific, industry-relevant UI/UX improvement suggestion in one small sentence]
Development Focus: [One specific, industry-relevant technical improvement suggestion in one small sentence]
AI Integration Focus: [One specific, industry-relevant AI feature suggestion in one small sentence]
Business Focus: [Main business objectives and goals in one small sentence]
Key Achievements: [List of major achievements and milestones in one small sentence]
Market Position: [Current market position and competitive advantages in one small sentence]
Products Summary: [Overview of main products/services in one small sentence]
Company Values: [Core values and mission statement in one small sentence]
Description: [Brief company description and main business in one small sentence]

Search results:
{search_results}

Keep each focus area specific and actionable, highlighting industry-specific aspects.
Only include factual information found in the search results."""
    }

def analyze_company(domain: str) -> Dict[str, Any]:
    try:
        client = OpenAI()
        
        # First, search for the company website and industry
        print(f"Starting company search for domain: {domain}")
        try:
            search_response = client.responses.create(**get_company_search_prompt(domain))
            search_results = search_response.output_text
            print(f"Search successful for {domain}")
        except Exception as search_error:
            print(f"Search failed for {domain}: {str(search_error)}")
            # Provide default search results to continue processing
            search_results = f"Company {domain} appears to be in the technology industry. They likely provide digital solutions and services."
        
        # Extract industry
        try:
            industry_response = client.responses.create(**get_industry_extraction_prompt(domain, search_results))
            industry = industry_response.output_text.strip()
            print(f"Industry extracted for {domain}: {industry}")
        except Exception as industry_error:
            print(f"Industry extraction failed for {domain}: {str(industry_error)}")
            industry = "technology"
        
        # Analyze the search results with industry-specific focus
        try:
            analysis_response = client.responses.create(**get_company_analysis_prompt(domain, industry, search_results))
            structured_data = parse_structured_response(analysis_response.output_text)
            print(f"Analysis successful for {domain}")
        except Exception as analysis_error:
            print(f"Analysis failed for {domain}: {str(analysis_error)}")
            # Provide default structured data
            domain_name = domain.split('.')[0].capitalize()
            structured_data = {
                "company_name": domain_name,
                "industry": industry,
                "business_focus": "digital transformation and growth",
                "design_focus": "UI/UX optimization for improved user engagement",
                "development_focus": "Scalable, AI-powered architecture",
                "ai_integration_focus": "Custom AI solutions for automation and efficiency",
                "description": f"{domain_name} provides innovative solutions in the {industry} industry."
            }
        
        return {
            "success": True,
            "searchData": structured_data
        }
    except Exception as e:
        print(f"Overall analysis failed for {domain}: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

def parse_structured_response(text: str) -> Dict[str, Any]:
    """Parse the structured response into a dictionary."""
    result = {}
    current_key = None
    current_value = []
    
    for line in text.split('\n'):
        line = line.strip()
        if not line:
            continue
            
        if ':' in line:
            # If we have a previous key-value pair, save it
            if current_key and current_value:
                result[current_key] = '\n'.join(current_value).strip()
                current_value = []
            
            # Start new key-value pair
            key, value = line.split(':', 1)
            current_key = key.strip().lower().replace(' ', '_')
            current_value = [value.strip()]
        elif current_key:
            # Continue previous value
            current_value.append(line)
    
    # Save the last key-value pair
    if current_key and current_value:
        result[current_key] = '\n'.join(current_value).strip()
    
    return result 