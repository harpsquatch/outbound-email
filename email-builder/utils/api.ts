import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

interface EmailDraftData {
  recipient_email: string;
  subject: string;
  body: string;
  attachment?: File;
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
  error?: string;
  company_name: string;
  industry: string;
  business_focus: string;
  description: string;
  key_achievements: string;
  values: string;
  market_position: string;
  products_summary: string;
  ai_enhanced: boolean;
  design_focus: string;
  dev_focus: string;
  ai_focus: string;
  achievements: string;
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
    const formData = new FormData();
    formData.append('recipient_email', draftData.recipient_email);
    formData.append('subject', draftData.subject);
    formData.append('body', draftData.body);
    
    if (draftData.attachment) {
      formData.append('attachment', draftData.attachment);
    }
    
    const response = await axios.post(`${API_BASE_URL}/create-draft`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
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

export async function scrapeWebsite(domain: string): Promise<WebScrapingResponse> {
    try {
        const response = await fetch(`${API_BASE_URL}/scrape-website`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ domain }),
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to scrape website');
        }

        // The backend now returns structured data directly
        return {
            success: true,
            company_name: data.searchData.company_name || '',
            industry: data.searchData.industry || '',
            business_focus: data.searchData.business_focus || '',
            description: data.searchData.description || '',
            key_achievements: data.searchData.key_achievements || '',
            values: data.searchData.values || '',
            market_position: data.searchData.market_position || '',
            products_summary: data.searchData.products_summary || '',
            ai_enhanced: true,
            design_focus: data.searchData.design_focus || '',
            dev_focus: data.searchData.development_focus || '',
            ai_focus: data.searchData.ai_integration_focus || '',
            achievements: data.searchData.key_achievements || ''
        };
    } catch (error) {
        console.error('Error performing web search:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to scrape website',
            company_name: '',
            industry: '',
            business_focus: '',
            description: '',
            key_achievements: '',
            values: '',
            market_position: '',
            products_summary: '',
            ai_enhanced: false,
            design_focus: '',
            dev_focus: '',
            ai_focus: '',
            achievements: ''
        };
    }
}

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