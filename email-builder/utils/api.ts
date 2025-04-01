import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

interface EmailDraftData {
  recipient_email: string;
  subject: string;
  body: string;
}

interface DraftResponse {
  success: boolean;
  draft_id?: string;
  error?: string;
  auth_required?: boolean;
  auth_url?: string;
}

interface AIContentRequest {
  placeholder: string;
  recipient_email: string;
  template_name: string;
}

interface AIContentResponse {
  success: boolean;
  content?: string;
  error?: string;
}

interface WebScrapingRequest {
  domain: string;
}

interface WebScrapingResponse {
  success: boolean;
  company_name?: string;
  industry?: string;
  achievements?: string[];
  description?: string;
  error?: string;
}

interface RefineEmailRequest {
  subject: string;
  body: string;
  recipient_email: string;
  industry?: string;
  company_name?: string;
}

interface RefineEmailResponse {
  success: boolean;
  subject?: string;
  body?: string;
  error?: string;
}

export const createDraft = async (draftData: EmailDraftData): Promise<DraftResponse> => {
  try {
    const response = await axios.post(`${API_BASE_URL}/create-draft`, draftData);
    
    // Check if authentication is required
    if (response.data.auth_required === true && response.data.auth_url) {
      return {
        success: false,
        auth_required: true,
        auth_url: response.data.auth_url
      };
    }
    
    return {
      success: true,
      draft_id: response.data.draft_id
    };
  } catch (error: any) {
    console.error('Error creating draft:', error);
    return {
      success: false,
      error: error.response?.data?.detail || 'Failed to create draft'
    };
  }
};

export const generateAIContent = async (requestData: AIContentRequest): Promise<AIContentResponse> => {
  try {
    const response = await axios.post(`${API_BASE_URL}/generate-ai-content`, requestData);
    
    return {
      success: true,
      content: response.data.content
    };
  } catch (error: any) {
    console.error('Error generating AI content:', error);
    return {
      success: false,
      error: error.response?.data?.detail || 'Failed to generate AI content'
    };
  }
};

export const scrapeWebsite = async (domain: string): Promise<WebScrapingResponse> => {
  try {
    const response = await axios.post(`${API_BASE_URL}/scrape-website`, { domain });
    
    return {
      success: true,
      company_name: response.data.company_name,
      industry: response.data.industry,
      achievements: response.data.achievements,
      description: response.data.description
    };
  } catch (error: any) {
    console.error('Error scraping website:', error);
    return {
      success: false,
      error: error.response?.data?.detail || 'Failed to scrape website'
    };
  }
};

export const refineEmailContent = async ({
  subject,
  body,
  recipient_email,
  industry,
  company_name
}: RefineEmailRequest): Promise<RefineEmailResponse> => {
  try {
    const response = await axios.post(`${API_BASE_URL}/refine-email`, {
      subject,
      body,
      recipient_email,
      industry: industry || '',
      company_name: company_name || ''
    });
    
    return {
      success: true,
      subject: response.data.subject,
      body: response.data.body
    };
  } catch (error: any) {
    console.error('Error refining email:', error);
    return {
      success: false,
      error: error.response?.data?.detail || 'Failed to refine email'
    };
  }
}; 