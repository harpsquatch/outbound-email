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