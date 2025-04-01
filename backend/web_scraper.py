import requests
from bs4 import BeautifulSoup
import re
import logging
import time
from typing import Dict, List, Any
import random
from urllib.parse import urljoin

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# User agents to rotate through to avoid being blocked
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36'
]

def get_company_info(domain: str) -> Dict[str, Any]:
    """
    Scrape company information from a given domain.
    
    Args:
        domain: The domain to scrape (e.g., 'sugarcosmetics.com')
        
    Returns:
        Dictionary containing company info
    """
    result = {
        "company_name": "",
        "industry": "",
        "achievements": [],
        "description": "",
        "products": [],
        "business_focus": ""
    }
    
    # Ensure domain doesn't have http/https
    clean_domain = domain.replace("http://", "").replace("https://", "").split('/')[0]
    
    try:
        # Try to fetch and analyze multiple pages for better insights
        pages_to_check = [
            f"https://{clean_domain}",                  # Homepage
            f"https://{clean_domain}/about",            # About page
            f"https://{clean_domain}/about-us",         # Alternate about page
            f"https://{clean_domain}/company",          # Company page
            f"https://www.linkedin.com/company/{clean_domain.split('.')[0]}"  # LinkedIn
        ]
        
        all_text = ""
        
        for url in pages_to_check:
            try:
                page_content = fetch_page(url)
                if page_content:
                    all_text += " " + page_content
                    
                    # Process this page
                    soup = BeautifulSoup(page_content, 'html.parser')
                    
                    # Try to extract company name if not already found
                    if not result["company_name"]:
                        result["company_name"] = extract_company_name(soup, clean_domain)
                    
                    # Try to find industry information
                    if not result["industry"]:
                        result["industry"] = extract_industry(soup)
                    
                    # Gather achievements
                    achievements = extract_achievements(soup)
                    if achievements:
                        result["achievements"].extend(achievements)
                    
                    # Extract description if not already found
                    if not result["description"]:
                        result["description"] = extract_description(soup)
                    
                    # Find products
                    products = extract_products(soup)
                    if products:
                        result["products"].extend(products)
                
                # Brief pause between requests
                time.sleep(random.uniform(0.5, 1.5))
            except Exception as e:
                logger.warning(f"Error fetching {url}: {str(e)}")
                continue
        
        # Deduplicate achievements and products
        result["achievements"] = list(set(result["achievements"]))
        result["products"] = list(set(result["products"]))
        
        # Generate business focus from the accumulated data
        result["business_focus"] = generate_business_focus(
            result["description"], 
            result["achievements"], 
            result["products"],
            result["industry"],
            all_text
        )
        
    except Exception as e:
        logger.error(f"Error scraping {domain}: {str(e)}")
    
    # Fill in any gaps with domain-based defaults
    if not result["company_name"]:
        result["company_name"] = clean_domain.split('.')[0].title()
    
    if not result["industry"]:
        result["industry"] = guess_industry_from_domain(clean_domain)
    
    if not result["business_focus"]:
        result["business_focus"] = f"providing innovative solutions in the {result['industry']} sector"
    
    return result

def fetch_page(url: str) -> str:
    """Fetch a web page with error handling and rotating user agents."""
    try:
        headers = {
            'User-Agent': random.choice(USER_AGENTS),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        }
        
        response = requests.get(url, headers=headers, timeout=15)
        
        if response.status_code == 200:
            return response.text
        else:
            logger.warning(f"Failed to fetch {url}: Status code {response.status_code}")
            return ""
    except Exception as e:
        logger.warning(f"Error during request to {url}: {str(e)}")
        return ""

def extract_company_name(soup: BeautifulSoup, domain: str) -> str:
    """Extract company name from various common locations in a webpage."""
    # Try logo alt text
    logos = soup.select('img[alt*=logo], img[alt*=Logo], img[class*=logo], img[class*=Logo]')
    for logo in logos:
        alt = logo.get('alt', '')
        if alt and len(alt) > 2 and 'logo' not in alt.lower():
            return alt.strip()
    
    # Try page title
    if soup.title:
        title = soup.title.string
        if title:
            # Common patterns to remove
            patterns = [
                r'\s+[-|]\s+.*$',         # Remove "- Home" or "| Official Website"
                r'\s*[\(\[\{].*?[\)\]\}]', # Remove parentheses content
                r'Home\s*[-|]?\s*',        # Remove "Home -" or "Home |"
                r'Welcome\s*[-|]?\s*',     # Remove "Welcome to" 
                r'Official\s*[-|]?\s*',    # Remove "Official" 
                r'Website\s*[-|]?\s*'      # Remove "Website"
            ]
            clean_title = title.strip()
            for pattern in patterns:
                clean_title = re.sub(pattern, '', clean_title, flags=re.IGNORECASE)
            
            if clean_title and len(clean_title) > 2:
                return clean_title.strip()
    
    # Try h1 tags
    h1s = soup.select('h1')
    for h1 in h1s:
        text = h1.get_text().strip()
        if text and len(text) < 50:  # Avoid long headlines
            return text
    
    # Try schema.org structured data
    org_schemas = soup.select('[itemtype*="schema.org/Organization"]')
    for org in org_schemas:
        name = org.select_one('[itemprop="name"]')
        if name:
            return name.get_text().strip()
    
    # Fallback to domain-based name
    return domain.split('.')[0].title()

def extract_industry(soup: BeautifulSoup) -> str:
    """Try to extract industry information."""
    # Look for common industry indicators in meta tags
    meta_desc = soup.find('meta', attrs={'name': 'description'})
    meta_keywords = soup.find('meta', attrs={'name': 'keywords'})
    
    text_to_check = ""
    if meta_desc and meta_desc.get('content'):
        text_to_check += meta_desc.get('content', '') + " "
    if meta_keywords and meta_keywords.get('content'):
        text_to_check += meta_keywords.get('content', '') + " "
    
    # Add text from main sections
    for selector in ['main', '.main', '#main', '.content', '#content', 'article', '.about', '#about']:
        section = soup.select_one(selector)
        if section:
            text_to_check += section.get_text() + " "
    
    # Try to find LinkedIn industry section
    industry_section = soup.select_one('.org-top-card-summary__info-item, .industry-tag')
    if industry_section:
        industry_text = industry_section.get_text().strip()
        if industry_text and len(industry_text) < 50:
            return industry_text
    
    # Common industries (expanded list)
    industries = [
        "Cosmetics", "Beauty", "Makeup", "Skincare", "Personal Care",
        "Technology", "Software", "IT Services", "SaaS", "Cloud Computing", 
        "Healthcare", "Medical", "Pharmaceuticals", "Biotech", "Life Sciences",
        "Finance", "Banking", "Insurance", "Investment", "Wealth Management",
        "Education", "EdTech", "E-learning", "Academic", "Training",
        "Manufacturing", "Production", "Industrial", "Engineering", "Construction",
        "Retail", "E-commerce", "Consumer Goods", "Shopping", "Merchandising",
        "Consulting", "Professional Services", "Business Services", "Advisory",
        "Marketing", "Advertising", "Digital Marketing", "PR", "Communications",
        "Real Estate", "Property", "Housing", "Architecture", "Interior Design",
        "Energy", "Utilities", "Renewable Energy", "Oil & Gas", "Electricity",
        "Automotive", "Transportation", "Mobility", "Vehicles", "Auto Parts",
        "Agriculture", "Farming", "Food Production", "Agritech", "Cultivation",
        "Telecommunications", "Telecom", "Networking", "Internet Services", "Mobile",
        "Media", "Publishing", "Broadcasting", "News", "Digital Media",
        "Entertainment", "Gaming", "Film", "Music", "Arts",
        "Travel", "Tourism", "Hospitality", "Hotels", "Vacation",
        "Food & Beverage", "Restaurants", "Catering", "Food Service", "Culinary",
        "Fashion", "Apparel", "Clothing", "Textiles", "Accessories"
    ]
    
    # Check for industry mentions
    for industry in industries:
        pattern = r'\b' + re.escape(industry) + r'\b'
        if re.search(pattern, text_to_check, re.IGNORECASE):
            return industry
    
    # If no specific industry found, check for general categories
    broader_categories = {
        "Beauty & Cosmetics": ["beauty", "makeup", "cosmetic", "skin", "hair", "personal care", "salon"],
        "Technology": ["tech", "software", "digital", "online", "platform", "app", "web"],
        "Healthcare": ["health", "medical", "wellness", "therapy", "clinic", "doctor", "patient"],
        "Finance": ["finance", "banking", "money", "investment", "financial", "bank", "loan"],
        "Retail": ["shop", "store", "retail", "buy", "purchase", "product", "consumer"],
        "Education": ["education", "school", "learn", "student", "teach", "training", "course"]
    }
    
    for category, keywords in broader_categories.items():
        for keyword in keywords:
            if re.search(r'\b' + re.escape(keyword) + r'\b', text_to_check, re.IGNORECASE):
                return category
    
    return "Technology"  # Default fallback

def extract_achievements(soup: BeautifulSoup) -> List[str]:
    """Extract possible achievements or notable aspects of the business."""
    achievements = []
    
    # Look in sections that might contain achievements
    achievement_sections = [
        '.achievements', '#achievements', '.awards', '#awards',
        '.milestones', '#milestones', '.about-us', '#about-us',
        '.highlights', '#highlights', '.features', '#features',
        '.timeline', '#timeline', '.history', '#history'
    ]
    
    # Achievement-related words
    achievement_words = [
        'award', 'recognition', 'honor', 'prize', 'achievement', 
        'success', 'milestone', 'leader', 'innovation', 'breakthrough',
        'patent', 'launch', 'expand', 'growth', 'increase', 'improve',
        'first', 'best', 'top', 'leading', 'premier', 'excellence',
        'recognized', 'renowned', 'celebrated', 'distinguished',
        'trusted', 'certified', 'approved', 'endorsed', 'featured'
    ]
    
    # Check for achievement-like content in these sections
    for selector in achievement_sections:
        section = soup.select_one(selector)
        if section:
            # Look for list items
            items = section.select('li')
            if items:
                for item in items:
                    text = item.get_text().strip()
                    if text and len(text) > 15 and len(text) < 200:
                        achievements.append(text)
    
    # Look for paragraphs with achievement words
    paragraphs = soup.select('p')
    for p in paragraphs:
        text = p.get_text().strip()
        if text and 20 < len(text) < 200:  # Reasonable length
            for word in achievement_words:
                if re.search(r'\b' + re.escape(word) + r'\b', text, re.IGNORECASE):
                    achievements.append(text)
                    break
    
    # Clean and limit achievements
    clean_achievements = []
    seen_texts = set()
    
    for achievement in achievements:
        # Normalize text for comparison
        clean = re.sub(r'\s+', ' ', achievement).strip()
        
        # Skip duplicates
        normalized = clean.lower()
        if normalized in seen_texts:
            continue
        seen_texts.add(normalized)
        
        # Truncate if needed
        if len(clean) > 150:
            clean = clean[:147] + '...'
            
        clean_achievements.append(clean)
        
        # Limit to top 3 achievements
        if len(clean_achievements) >= 3:
            break
    
    return clean_achievements

def extract_description(soup: BeautifulSoup) -> str:
    """Extract a general company description."""
    # Try meta description first
    meta_desc = soup.find('meta', attrs={'name': 'description'})
    if meta_desc and meta_desc.get('content'):
        desc = meta_desc.get('content').strip()
        if len(desc) > 50:
            return desc
    
    # Try to find an about section
    about_selectors = [
        '.about', '#about', '.about-us', '#about-us', 
        '.company', '#company', '.description', '#description',
        '.mission', '#mission', '.vision', '#vision'
    ]
    
    for selector in about_selectors:
        section = soup.select_one(selector)
        if section:
            paras = section.select('p')
            if paras:
                # Combine paragraphs
                description = ' '.join([p.get_text().strip() for p in paras[:2]])
                description = re.sub(r'\s+', ' ', description).strip()
                if len(description) > 50:
                    return description
    
    # Try first substantial paragraphs in the body
    for p in soup.select('body p'):
        text = p.get_text().strip()
        if len(text) > 50 and len(text) < 300:
            return text
    
    return ""

def extract_products(soup: BeautifulSoup) -> List[str]:
    """Extract products or services offered by the company."""
    products = []
    
    # Look for product sections
    product_selectors = [
        '.products', '#products', '.services', '#services',
        '.offerings', '#offerings', '.solutions', '#solutions',
        '.shop', '#shop', '.catalog', '#catalog'
    ]
    
    for selector in product_selectors:
        section = soup.select_one(selector)
        if section:
            # Look for product names in headings
            for h in section.select('h2, h3, h4, .product-title, .product-name'):
                text = h.get_text().strip()
                if text and 3 < len(text) < 50:
                    products.append(text)
            
            # Look for product names in list items
            for li in section.select('li'):
                text = li.get_text().strip()
                if text and 3 < len(text) < 50:
                    products.append(text)
    
    # Look for product categories
    for a in soup.select('a[href*=product], a[href*=shop], a[href*=category]'):
        text = a.get_text().strip()
        if text and 3 < len(text) < 50 and not any(x in text.lower() for x in ['home', 'about', 'contact', 'more']):
            products.append(text)
    
    # Clean and limit products
    clean_products = []
    seen_products = set()
    
    for product in products:
        clean = re.sub(r'\s+', ' ', product).strip()
        normalized = clean.lower()
        
        # Skip duplicates and generic terms
        if normalized in seen_products or normalized in ['home', 'about us', 'contact', 'products', 'services']:
            continue
            
        seen_products.add(normalized)
        clean_products.append(clean)
        
        # Limit to reasonable number
        if len(clean_products) >= 5:
            break
    
    return clean_products

def generate_business_focus(description: str, achievements: List[str], products: List[str], industry: str, all_text: str) -> str:
    """Generate a concise business focus statement based on available information."""
    # If we have a good description, use it as a base
    if description and len(description) > 100:
        # Find purpose/mission statements
        purpose_patterns = [
            r'(?:we|our company|our mission is to) (provide|offer|deliver|create|build|help|enable|empower|transform)[\w\s,]+',
            r'(?:dedicated|committed) to [\w\s,]+',
            r'(?:specializ|focuse|concentrate)(?:e|ed|es|ing) (?:in|on) [\w\s,]+'
        ]
        
        for pattern in purpose_patterns:
            match = re.search(pattern, description, re.IGNORECASE)
            if match:
                # Extract and clean up the matched text
                focus = match.group(0)
                # Limit length
                if len(focus) > 100:
                    focus = focus[:97] + '...'
                return focus.strip()
    
    # If we have products, create a focus statement around them
    if products:
        product_types = ', '.join(products[:3])
        return f"providing {product_types} {'' if 'in the' in industry.lower() else 'in the '}{industry} industry"
    
    # If we have achievements, create a focus from the most significant one
    if achievements:
        return f"known for {achievements[0].lower() if achievements[0][0].isupper() else achievements[0]}"
    
    # Create a generic focus based on industry
    return f"delivering innovative solutions and services in the {industry} sector"

def guess_industry_from_domain(domain: str) -> str:
    """Make an educated guess about industry based on domain name."""
    domain_lower = domain.lower()
    
    # Common industry keywords in domains
    industry_keywords = {
        "beauty": "Beauty & Cosmetics",
        "cosmetic": "Beauty & Cosmetics",
        "makeup": "Beauty & Cosmetics",
        "tech": "Technology",
        "software": "Software Development",
        "digital": "Digital Services",
        "health": "Healthcare",
        "medical": "Healthcare",
        "pharma": "Pharmaceuticals",
        "bank": "Banking & Finance",
        "finance": "Financial Services",
        "invest": "Investment Services",
        "edu": "Education",
        "learn": "Education & Training",
        "school": "Education",
        "shop": "Retail",
        "store": "Retail",
        "food": "Food & Beverage",
        "restaurant": "Food & Beverage",
        "consult": "Consulting Services",
        "advisor": "Advisory Services",
        "travel": "Travel & Tourism",
        "hotel": "Hospitality",
        "media": "Media & Entertainment",
        "design": "Design Services",
        "creative": "Creative Services",
        "law": "Legal Services",
        "legal": "Legal Services",
        "energy": "Energy",
        "power": "Energy",
        "construct": "Construction",
        "build": "Construction & Engineering",
        "real": "Real Estate",
        "property": "Real Estate",
        "transport": "Transportation & Logistics",
        "logistics": "Logistics Services",
        "market": "Marketing Services",
        "fashion": "Fashion & Apparel",
        "cloth": "Fashion & Apparel",
        "wear": "Fashion & Apparel",
        "auto": "Automotive",
        "car": "Automotive",
        "insurance": "Insurance Services",
        "secure": "Security Services",
        "agri": "Agriculture",
        "farm": "Agriculture & Farming"
    }
    
    # Check domain against keywords
    for keyword, industry in industry_keywords.items():
        if keyword in domain_lower:
            return industry
    
    return "Technology"  # Default fallback 