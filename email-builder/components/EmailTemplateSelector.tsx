import { useState } from 'react';
import templates, { EmailTemplate } from '../data/templates';
import { createDraft } from '../utils/api';

const EmailTemplateSelector = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [customSubject, setCustomSubject] = useState<string>('');
  const [customBody, setCustomBody] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [authUrl, setAuthUrl] = useState<string>('');
  const [needsAuth, setNeedsAuth] = useState<boolean>(false);

  const handleTemplateChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const templateId = event.target.value;
    const template = templates.find(t => t.id === templateId) || null;
    
    setSelectedTemplate(template);
    if (template) {
      setCustomSubject(template.subject);
      setCustomBody(template.body);
    } else {
      setCustomSubject('');
      setCustomBody('');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!selectedTemplate || !recipientEmail) {
      setError('Please select a template and enter a recipient email.');
      return;
    }

    setLoading(true);
    setSuccess(false);
    setError('');
    setNeedsAuth(false);

    try {
      const result = await createDraft({
        recipient_email: recipientEmail,
        subject: customSubject,
        body: customBody
      });

      if (result.success) {
        setSuccess(true);
        // Reset fields after successful submission
        setRecipientEmail('');
        setSelectedTemplate(null);
        setCustomSubject('');
        setCustomBody('');
      } else if (result.auth_required && result.auth_url) {
        // Authentication required
        setNeedsAuth(true);
        setAuthUrl(result.auth_url);
      } else {
        setError(result.error || 'Failed to create draft.');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (needsAuth && authUrl) {
    return (
      <div className="bg-gray-900 border border-gray-800 shadow-md rounded-lg p-6 text-center">
        <h2 className="text-xl font-bold mb-4 text-white">Authentication Required</h2>
        <p className="mb-6 text-gray-400">Please authenticate with your Google account to create email drafts.</p>
        <a 
          href={authUrl}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 inline-block transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          Authenticate with Google
        </a>
        <p className="mt-4 text-sm text-gray-500">
          After authentication, please come back and try creating the draft again.
        </p>
        <button
          onClick={() => setNeedsAuth(false)}
          className="mt-6 px-4 py-2 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition-colors"
        >
          Back to Email Form
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 shadow-md rounded-lg p-6">
      {success && (
        <div className="mb-4 p-3 bg-green-900/30 text-green-400 border border-green-800 rounded">
          Draft created successfully! Check your Gmail drafts.
        </div>
      )}
      
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 text-red-400 border border-red-800 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="template">
            Email Template
          </label>
          <select
            id="template"
            className="shadow appearance-none bg-gray-800 border border-gray-700 rounded w-full py-2 px-3 text-gray-200 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            value={selectedTemplate?.id || ''}
            onChange={handleTemplateChange}
          >
            <option value="">Select a template...</option>
            {templates.map(template => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="recipient">
            Recipient Email
          </label>
          <input
            id="recipient"
            type="email"
            className="shadow appearance-none bg-gray-800 border border-gray-700 rounded w-full py-2 px-3 text-gray-200 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="recipient@example.com"
            required
          />
        </div>

        {selectedTemplate && (
          <>
            <div className="mb-4">
              <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="subject">
                Subject
              </label>
              <input
                id="subject"
                type="text"
                className="shadow appearance-none bg-gray-800 border border-gray-700 rounded w-full py-2 px-3 text-gray-200 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="body">
                Email Body
              </label>
              <textarea
                id="body"
                className="shadow appearance-none bg-gray-800 border border-gray-700 rounded w-full py-2 px-3 text-gray-200 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent h-64 resize-none"
                value={customBody}
                onChange={(e) => setCustomBody(e.target.value)}
                required
              />
            </div>
          </>
        )}

        <div className="flex items-center justify-between">
          <button
            type="submit"
            className={`bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating Draft...
              </div>
            ) : 'Create Draft'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EmailTemplateSelector; 