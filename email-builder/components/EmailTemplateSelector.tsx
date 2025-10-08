import { useState, useEffect } from 'react';
import templates, { EmailTemplate } from '../data/templates';
import { createDraft, generateAIContent, scrapeWebsite, refineEmailContent } from '../utils/api';

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
  
  // New state variables for placeholders
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({
    "Recipient": "",
    "Recipient's Company": "",
    "Your Name": "",
    "design_focus": "",
    "dev_focus": "",
    "ai_focus": "",
    "specific achievement or aspect of their business": ""
  });
  const [generatingAI, setGeneratingAI] = useState<boolean>(false);

  // Add state for user information
  const [userCompany, setUserCompany] = useState<string>('');
  const [userName, setUserName] = useState<string>('');

  // Add state to store and display comprehensive company information
  const [companyInfo, setCompanyInfo] = useState<{
    loading: boolean;
    name: string;
    industry: string;
    subIndustries: string[];
    businessFocus: string;
    description: string;
    keyAchievements: string[];
    values: string[];
    marketPosition: string;
    productsSummary: string[];
    websiteUrl: string;
    isAIEnhanced: boolean;
  }>({
    loading: false,
    name: '',
    industry: '',
    subIndustries: [],
    businessFocus: '',
    description: '',
    keyAchievements: [],
    values: [],
    marketPosition: '',
    productsSummary: [],
    websiteUrl: '',
    isAIEnhanced: false
  });

  // Add a new state for tracking the refinement process
  const [refiningEmail, setRefiningEmail] = useState<boolean>(false);

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

  // Function to extract placeholders from text
  const extractPlaceholders = (text: string): string[] => {
    const regex = /\[(.*?)\]/g;
    const matches = text.match(regex) || [];
    // Remove duplicates and brackets
    return [...new Set(matches)].map(p => p.replace(/[\[\]]/g, ''));
  };

  // Function to extract company from email
  const extractCompanyFromEmail = (email: string): string => {
    if (!email || !email.includes('@')) return '';
    
    const domain = email.split('@')[1];
    if (!domain) return '';
    
    // Get the company name (part before the first dot)
    let company = domain.split('.')[0];
    
    // Clean up the company name
    company = company
      // Replace common domain prefixes
      .replace(/^www\./, '')
      // Replace hyphens and underscores with spaces
      .replace(/[-_]/g, ' ')
      // Capitalize words
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    // Special case handling for common TLDs and suffixes
    company = company
      .replace(/\b(Com|Net|Org|Inc|Ltd|Llc)\b/gi, '')
      .trim();
    
    return company;
  };
  
  // Function to extract recipient name from email
  const extractNameFromEmail = (email: string): string => {
    if (!email || !email.includes('@')) return '';
    
    // Get the part before @
    const localPart = email.split('@')[0];
    
    // Convert something like "john.doe" or "john_doe" to "John Doe"
    return localPart
      .replace(/[._]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Add a function to extract domain from email
  const extractDomain = (email: string): string => {
    if (!email || !email.includes('@')) return '';
    return email.split('@')[1];
  };

  // Inside your component, add a function to filter out unwanted placeholders
  const filterPlaceholders = (allPlaceholders: string[]): string[] => {
    const unwantedPlaceholders = [
      "Your Company",
      "Your Name",
      "specific dates/times",
      "Your Position"
    ];
    
    return allPlaceholders.filter(placeholder => !unwantedPlaceholders.includes(placeholder));
  };

  // Modified update placeholders function
  useEffect(() => {
    if (selectedTemplate) {
      const bodyPlaceholders = extractPlaceholders(selectedTemplate.body);
      const subjectPlaceholders = extractPlaceholders(selectedTemplate.subject);
      const allPlaceholders = [...new Set([...subjectPlaceholders, ...bodyPlaceholders])];
      
      // Filter out the unwanted placeholders
      const filteredPlaceholders = filterPlaceholders(allPlaceholders);
      
      setPlaceholders(filteredPlaceholders);
      
      // Initialize placeholder values for the filtered placeholders
      const initialValues: Record<string, string> = {};
      filteredPlaceholders.forEach(p => {
        initialValues[p] = '';
      });
      
      setPlaceholderValues(initialValues);
    } else {
      setPlaceholders([]);
      setPlaceholderValues({});
    }
  }, [selectedTemplate]);
  
  // Update placeholders whenever recipient email changes
  useEffect(() => {
    if (recipientEmail && placeholders.includes("Recipient")) {
      // Extract name from email address
      const recipientName = extractNameFromEmail(recipientEmail);
      
      // Update the placeholder value
      setPlaceholderValues(prev => ({
        ...prev,
        "Recipient": recipientName
      }));
    }
  }, [recipientEmail]);
  
  // Update placeholders whenever user info changes
  useEffect(() => {
    if (Object.keys(placeholderValues).length > 0) {
      setPlaceholderValues(prev => ({
        ...prev,
        "Your Company": userCompany,
        "Your Name": userName
      }));
    }
  }, [userCompany, userName]);

  // Update email content when placeholder values change or user info changes
  useEffect(() => {
    if (selectedTemplate) {
      let updatedBody = selectedTemplate.body;
      let updatedSubject = selectedTemplate.subject;
      
      // First handle the special auto-populated fields with exact placeholder names
      const specialFields = {
        "Recipient's Company": companyInfo.name,
        "Industry": companyInfo.industry || "this industry",
        "industry": companyInfo.industry || "this industry",
        "specific achievement or aspect of their business": companyInfo.businessFocus
      };

      // Replace special fields first
      Object.entries(specialFields).forEach(([placeholder, value]) => {
        if (value) {
          const regex = new RegExp(`\\[${placeholder}\\]`, 'g');
          updatedBody = updatedBody.replace(regex, value);
          updatedSubject = updatedSubject.replace(regex, value);
        }
      });

      // Then handle any remaining placeholders
      Object.entries(placeholderValues).forEach(([key, value]) => {
        if (value) {
          const regex = new RegExp(`\\[${key}\\]`, 'g');
          updatedBody = updatedBody.replace(regex, value);
          updatedSubject = updatedSubject.replace(regex, value);
        }
      });

      setCustomBody(updatedBody);
      setCustomSubject(updatedSubject);
    }
  }, [selectedTemplate, placeholderValues, companyInfo]);

  // Function to apply company info to placeholder values
  const applyCompanyInfoToPlaceholders = (info: typeof companyInfo) => {
    const updates: Record<string, string> = {};
    
    // Only update if the placeholders exist and have values
    if ((placeholders.includes("Industry") || placeholders.includes("industry")) && info.industry) {
      if (placeholders.includes("Industry")) {
        updates["Industry"] = info.industry;
      }
      if (placeholders.includes("industry")) {
        updates["industry"] = info.industry;
      }
    }
    
    if (placeholders.includes("specific achievement or aspect of their business") && info.businessFocus) {
      updates["specific achievement or aspect of their business"] = info.businessFocus;
    }
    
    if (placeholders.includes("Recipient's Company") && info.name) {
      updates["Recipient's Company"] = info.name;
    }
    
    // Add more contextual mappings
    if (placeholders.includes("specific dates/times")) {
      // Generate time slots that make sense (not dependent on company info)
      const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const times = ['10 AM ET', '1 PM ET', '3 PM ET', '4 PM ET'];
      
      // Pick 3 random combinations
      const timeSlots = [];
      for (let i = 0; i < 3; i++) {
        const day = daysOfWeek[Math.floor(Math.random() * daysOfWeek.length)];
        const time = times[Math.floor(Math.random() * times.length)];
        timeSlots.push(`${day} at ${time}`);
      }
      
      updates["specific dates/times"] = timeSlots.join(', ');
    }
    
    // Apply the updates if we have any
    if (Object.keys(updates).length > 0) {
      setPlaceholderValues(prev => ({
        ...prev,
        ...updates
      }));
    }
  };

  // Update the useEffect for email analysis
  useEffect(() => {
    // Clear any previous analysis state when email changes
    if (!recipientEmail || !recipientEmail.includes('@')) {
      setCompanyInfo(prev => ({ ...prev, loading: false }));
      return;
    }

    const domain = extractDomain(recipientEmail);
    // Only analyze if we have a new domain that hasn't been analyzed
    if (domain && (!companyInfo.name || !companyInfo.websiteUrl.includes(domain))) {
      fetchCompanyInfo();
    }
  }, [recipientEmail]);

  // Update the fetchCompanyInfo function
  const fetchCompanyInfo = async () => {
    if (!recipientEmail) {
      return;
    }
    
    setCompanyInfo(prev => ({ ...prev, loading: true }));
    
    try {
      const domain = extractDomain(recipientEmail);
      if (!domain) {
        setCompanyInfo(prev => ({ ...prev, loading: false }));
        return;
      }
      
      const result = await scrapeWebsite(domain);
      
      if (result.success) {
        const cleanCompanyName = extractCompanyFromEmail(recipientEmail);
        
        // Generate a vision/product line from the company data
        const productVisionLine = result.description 
          ? `${result.description.split('.')[0]}`
          : `innovative solutions in ${result.industry || 'their industry'}`;

        // Update company info
        setCompanyInfo({
          loading: false,
          name: cleanCompanyName,
          industry: result.industry || '',
          businessFocus: result.business_focus || '',
          description: result.description || '',
          keyAchievements: result.key_achievements || [],
          values: result.values || [],
          marketPosition: result.market_position || '',
          productsSummary: result.products_summary || [],
          websiteUrl: `https://${domain}`,
          isAIEnhanced: result.ai_enhanced || false,
          subIndustries: []
        });

        // Update placeholders with the correct key
        setPlaceholderValues(prev => ({
          ...prev,
          "Recipient's Company": cleanCompanyName,
          "industry": result.industry || '',
          "Industry": result.industry || '',
          "Insert a line about their product, vision": productVisionLine,
          "design_focus": result.design_focus || "UI/UX optimization for improved user engagement",
          "dev_focus": result.dev_focus || "Scalable, AI-powered architecture",
          "ai_focus": result.ai_focus || "Custom AI solutions for automation and efficiency"
        }));

        // Debug log to verify the values
        console.log('Updated placeholders:', {
          company: cleanCompanyName,
          vision: productVisionLine,
          placeholders: placeholderValues
        });
      } else {
        setCompanyInfo(prev => ({ ...prev, loading: false }));
      }
    } catch (err) {
      console.error('Analysis failed:', err);
      setCompanyInfo(prev => ({ ...prev, loading: false }));
    }
  };

  // Helper function to extract the most relevant business focus from scraped data
  const extractBusinessFocus = (scrapedData: any): string => {
    // Try to extract business focus in order of reliability
    
    // 1. First check if there's an explicit mission/purpose statement
    if (scrapedData.mission_statement && scrapedData.mission_statement.length > 10) {
      // Clean and format the mission statement
      const mission = scrapedData.mission_statement.trim();
      if (mission.length > 100) {
        return mission.substring(0, 97) + '...';
      }
      return mission;
    }
    
    // 2. If there's a business_focus field directly, use that
    if (scrapedData.business_focus && scrapedData.business_focus.length > 10) {
      return scrapedData.business_focus;
    }
    
    // 3. Look for value proposition statements in description
    if (scrapedData.description) {
      // Common patterns for value proposition statements
      const patterns = [
        /we (?:provide|offer|deliver|create|build|help|enable|empower) ([\w\s,]+)/i,
        /our (?:mission|goal|focus|aim) is to ([\w\s,]+)/i,
        /(?:dedicated|committed) to ([\w\s,]+)/i,
        /(?:specialize|focus) (?:in|on) ([\w\s,]+)/i
      ];
      
      for (const pattern of patterns) {
        const match = pattern.exec(scrapedData.description);
        if (match && match[1] && match[1].length > 10) {
          const focus = match[1].trim();
          if (focus.length > 100) {
            return focus.substring(0, 97) + '...';
          }
          return focus;
        }
      }
    }
    
    // 4. If we have products, create a focus statement based on them
    if (scrapedData.products && scrapedData.products.length > 0) {
      const productTypes = scrapedData.products.slice(0, 2).join(' and ');
      return `providing ${productTypes} in the ${scrapedData.industry || 'market'}`;
    }
    
    // 5. If we have achievements, use the first one
    if (scrapedData.achievements && scrapedData.achievements.length > 0) {
      const achievement = scrapedData.achievements[0].trim();
      return `known for ${achievement.toLowerCase()}`;
    }
    
    // 6. Fallback to a generic statement based on industry
    if (scrapedData.industry) {
      return `delivering innovative solutions in the ${scrapedData.industry} space`;
    }
    
    // Final fallback
    return "providing quality products and services to their customers";
  };

  // Modified handleGenerateAI to use existing company info when possible
  const handleGenerateAI = async (placeholder: string) => {
    if (!recipientEmail) {
      setError('Please enter a recipient email first');
      return;
    }
    
    // Check if we can use existing company info instead of making an API call
    if (companyInfo.name) {
      if (placeholder === "Industry" && companyInfo.industry) {
        setPlaceholderValues(prev => ({
          ...prev,
          [placeholder]: companyInfo.industry
        }));
        return;
      }
      
      if (placeholder === "specific achievement or aspect of their business" && companyInfo.businessFocus) {
        setPlaceholderValues(prev => ({
          ...prev,
          [placeholder]: companyInfo.businessFocus
        }));
        return;
      }
      
      if (placeholder === "Recipient's Company") {
        setPlaceholderValues(prev => ({
          ...prev,
          [placeholder]: companyInfo.name
        }));
        return;
      }
    }
    
    // For other placeholders or if company info isn't available, proceed with AI generation
    setGeneratingAI(true);
    
    try {
      const result = await generateAIContent({
        placeholder,
        recipient_email: recipientEmail,
        template_name: selectedTemplate?.name || ''
      });
      
      if (result.success) {
        setPlaceholderValues(prev => ({
          ...prev,
          [placeholder]: result.content
        }));
      } else {
        setError(result.error || 'Failed to generate content');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setGeneratingAI(false);
    }
  };

  // Update the handleRefineEmail function
  const handleRefineEmail = async () => {
    if (!customBody || !customSubject) {
      setError('Please fill in the email content before refining.');
      return;
    }
    
    setRefiningEmail(true);
    setError('');
    
    try {
      const result = await refineEmailContent({
        subject: customSubject,
        body: customBody,
        recipient_email: recipientEmail,
        industry: companyInfo.industry || '',
        company_name: companyInfo.name || ''
      });
      
      if (result.success) {
        setCustomSubject(result.subject);
        setCustomBody(result.body);
      } else {
        setError(result.error || 'Failed to refine email content.');
      }
    } catch (err) {
      setError('An unexpected error occurred while refining the email.');
      console.error(err);
    } finally {
      setRefiningEmail(false);
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

  // For UI clarity, rename the placeholder display name
  const getDisplayName = (placeholder: string): string => {
    const displayNames: Record<string, string> = {
      "Insert a line about their product, vision": "Company Vision/Product Line",
      "design_focus": "Design Focus",
      "dev_focus": "Development Focus",
      "ai_focus": "AI Integration Focus"
    };
    return displayNames[placeholder] || placeholder;
  };

  // Update the isAutoPopulatedField function
  const isAutoPopulatedField = (placeholder: string): boolean => {
    return [
      "Recipient",
      "Recipient's Company",
      "Insert a line about their product, vision", // Exact match is important
      "design_focus",
      "dev_focus",
      "ai_focus"
    ].includes(placeholder);
  };

  // Add a debug useEffect to track placeholder values
  useEffect(() => {
    console.log('Current placeholder values:', placeholderValues);
  }, [placeholderValues]);

  // Add helper function to generate focus areas based on company info
  const generateFocusAreas = (companyInfo: any) => {
    const industry = companyInfo.industry?.toLowerCase() || '';
    const businessFocus = companyInfo.businessFocus?.toLowerCase() || '';

    // Default focus areas
    let designFocus = "UI/UX optimization for improved user engagement";
    let devFocus = "Scalable, AI-powered architecture";
    let aiFocus = "Custom AI solutions for automation and efficiency";

    // Customize based on industry and business focus
    if (industry.includes('ecommerce') || businessFocus.includes('ecommerce')) {
      designFocus = "Conversion-optimized UI/UX for higher sales";
      devFocus = "Scalable e-commerce architecture with AI-powered recommendations";
      aiFocus = "Personalized shopping experiences and inventory optimization";
    } else if (industry.includes('saas') || businessFocus.includes('saas')) {
      designFocus = "Intuitive SaaS interfaces for improved user retention";
      devFocus = "Microservices architecture with AI-powered features";
      aiFocus = "Intelligent automation and predictive analytics";
    } else if (industry.includes('fintech') || businessFocus.includes('finance')) {
      designFocus = "Secure, compliant financial interfaces";
      devFocus = "High-performance, secure transaction processing";
      aiFocus = "AI-powered risk assessment and fraud detection";
    }
    // Add more industry-specific customizations as needed

    return { designFocus, devFocus, aiFocus };
  };

  // Add a function to handle generating focus areas
  const handleGenerateFocusAreas = async () => {
    if (!companyInfo.businessFocus) {
      setError('Please wait for company analysis to complete first');
      return;
    }

    setGeneratingAI(true);
    try {
      const result = await generateAIContent({
        placeholder: "focus_areas",
        business_focus: companyInfo.businessFocus,
        industry: companyInfo.industry,
        company_name: companyInfo.name
      });

      if (result.success) {
        setPlaceholderValues(prev => ({
          ...prev,
          "design_focus": result.design_focus,
          "dev_focus": result.dev_focus,
          "ai_focus": result.ai_focus
        }));
      } else {
        setError(result.error || 'Failed to generate focus areas');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setGeneratingAI(false);
    }
  };

  // Add a useEffect to trigger focus area generation when business focus is available
  useEffect(() => {
    if (companyInfo.businessFocus && !placeholderValues["design_focus"]) {
      handleGenerateFocusAreas();
    }
  }, [companyInfo.businessFocus]);

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
      {/* User configuration section */}
      <div className="mb-6 border-b border-gray-800 pb-4">
        <h3 className="text-gray-300 text-lg font-bold mb-3">
          Your Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-300 text-sm font-bold mb-2">
              Your Company Name
            </label>
            <input
              type="text"
              className="shadow appearance-none bg-gray-800 border border-gray-700 rounded w-full py-2 px-3 text-gray-200 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              value={userCompany}
              onChange={(e) => setUserCompany(e.target.value)}
              placeholder="Enter your company name"
            />
          </div>
          <div>
            <label className="block text-gray-300 text-sm font-bold mb-2">
              Your Name
            </label>
            <input
              type="text"
              className="shadow appearance-none bg-gray-800 border border-gray-700 rounded w-full py-2 px-3 text-gray-200 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>
        </div>
      </div>
      
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
          <div className="flex space-x-2">
            <div className="relative flex-grow">
              <input
                id="recipient"
                type="email"
                className="shadow appearance-none bg-gray-800 border border-gray-700 rounded w-full py-2 px-3 text-gray-200 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="recipient@example.com"
                required
              />
              {/* Show analysis status indicator */}
              {recipientEmail && recipientEmail.includes('@') && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  {companyInfo.loading ? (
                    <svg className="animate-spin h-5 w-5 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : companyInfo.name ? (
                    <svg className="h-5 w-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                  ) : null}
                </div>
              )}
            </div>
            {/* Keep the manual button as a fallback */}
            <button
              type="button"
              className={`bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-opacity-50 ${
                companyInfo.loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={fetchCompanyInfo}
              disabled={companyInfo.loading || !recipientEmail}
            >
              {companyInfo.loading ? 'Analyzing...' : 'Re-analyze'}
            </button>
          </div>
          {/* Add a subtle status message */}
          {recipientEmail && recipientEmail.includes('@') && (
            <p className="mt-1 text-sm text-gray-400">
              {companyInfo.loading ? 
                'Analyzing company information...' : 
                companyInfo.name ? 
                  `Analyzed ${companyInfo.name}` : 
                  'Enter a valid email to analyze company'}
            </p>
          )}
        </div>

        {companyInfo.name && (
          <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
            <h3 className="text-gray-300 text-lg font-bold mb-3 flex items-center">
              <span>Company Insights</span>
              {companyInfo.websiteUrl && (
                <a 
                  href={companyInfo.websiteUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-2 text-sm text-teal-400 hover:text-teal-300"
                >
                  Visit Website
                </a>
              )}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Company name and industry */}
              <div className="bg-gray-900 p-3 rounded">
                <div className="mb-3">
                  <p className="text-gray-400 text-sm mb-1">Company Name:</p>
                  <p className="text-white font-medium">{companyInfo.name}</p>
                </div>
                
                {companyInfo.industry && (
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Industry:</p>
                    <p className="text-white">{companyInfo.industry}</p>
                  </div>
                )}
              </div>
              
              {/* Business focus and market position */}
              <div className="bg-gray-900 p-3 rounded">
                {companyInfo.businessFocus && (
                  <div className="mb-3">
                    <p className="text-gray-400 text-sm mb-1">Business Focus:</p>
                    <p className="text-white">{companyInfo.businessFocus}</p>
                  </div>
                )}
                
                {companyInfo.marketPosition && (
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Market Position:</p>
                    <p className="text-white">{companyInfo.marketPosition}</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Tabs for different types of information */}
            <div className="mt-4 border-t border-gray-700 pt-4">
              <div className="flex flex-wrap -mb-px">
                {/* Add tabs for different sections */}
                <button
                  type="button"
                  className="inline-block px-4 py-2 text-sm font-medium text-center text-teal-400 border-b-2 border-teal-400 rounded-t-lg active"
                  onClick={() => {/* Tab handling logic */}}
                >
                  Overview
                </button>
                
                {companyInfo.productsSummary.length > 0 && (
                  <button
                    type="button"
                    className="inline-block px-4 py-2 text-sm font-medium text-center text-gray-400 border-b-2 border-transparent rounded-t-lg hover:text-gray-300 hover:border-gray-600"
                    onClick={() => {/* Tab handling logic */}}
                  >
                    Products
                  </button>
                )}
                
                {companyInfo.keyAchievements.length > 0 && (
                  <button
                    type="button"
                    className="inline-block px-4 py-2 text-sm font-medium text-center text-gray-400 border-b-2 border-transparent rounded-t-lg hover:text-gray-300 hover:border-gray-600"
                    onClick={() => {/* Tab handling logic */}}
                  >
                    Achievements
                  </button>
                )}
                
                {/* Add a tab for team information */}
                <button
                  type="button"
                  className="inline-block px-4 py-2 text-sm font-medium text-center text-gray-400 border-b-2 border-transparent rounded-t-lg hover:text-gray-300 hover:border-gray-600"
                  onClick={() => {/* Tab handling logic */}}
                >
                  Team
                </button>
              </div>
              
              {/* Tab content - Overview (always shown by default) */}
              <div className="py-4">
                {companyInfo.description && (
                  <div className="mb-4">
                    <p className="text-gray-400 text-sm mb-1">Company Description:</p>
                    <p className="text-white text-sm leading-relaxed">{companyInfo.description}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {companyInfo.industry && (
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Industry:</p>
                      <p className="text-white text-sm">{companyInfo.industry}</p>
                    </div>
                  )}
                  
                  {companyInfo.businessFocus && (
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Business Focus:</p>
                      <p className="text-white text-sm">{companyInfo.businessFocus}</p>
                    </div>
                  )}
                </div>
                
                {companyInfo.values.length > 0 && (
                  <div className="mt-4">
                    <p className="text-gray-400 text-sm mb-1">Company Values:</p>
                    <div className="flex flex-wrap gap-2">
                      {companyInfo.values.map((value, i) => (
                        <span key={i} className="bg-gray-700 text-gray-200 text-xs px-2 py-1 rounded">
                          {value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Practical email writing tips based on the company analysis */}
            <div className="mt-4 border-t border-gray-700 pt-4">
              <p className="text-gray-300 text-sm font-bold mb-2">Email Writing Tips:</p>
              <ul className="list-disc pl-5 text-gray-400 text-sm space-y-1">
                <li>Address their specific focus on <span className="text-teal-400">{companyInfo.businessFocus}</span></li>
                {companyInfo.industry && <li>Reference your experience in the <span className="text-teal-400">{companyInfo.industry}</span> industry</li>}
                {companyInfo.values.length > 0 && <li>Align with their values: <span className="text-teal-400">{companyInfo.values.slice(0, 2).join(', ')}</span></li>}
                {companyInfo.keyAchievements.length > 0 && <li>Mention their achievement: <span className="text-teal-400">{companyInfo.keyAchievements[0]}</span></li>}
              </ul>
            </div>
          </div>
        )}

        {selectedTemplate && placeholders.length > 0 && (
          <div className="mb-6">
            <h3 className="text-gray-300 text-lg font-bold mb-3">
              Fill in Placeholders
            </h3>
            <div className="space-y-4">
              {placeholders.map(placeholder => {
                const isRecipientField = placeholder === "Recipient";
                const isAutoField = isAutoPopulatedField(placeholder);
                const isFocusField = ["design_focus", "dev_focus", "ai_focus"].includes(placeholder);
                
                return (
                  <div key={placeholder} className="flex flex-col space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-gray-300 text-sm font-bold">
                        {getDisplayName(placeholder)} <span className="text-gray-500 text-xs">(Original: [{placeholder}])</span>
                      </label>
                      
                      {isFocusField && (
                        <button
                          type="button"
                          className="text-sm text-purple-400 hover:text-purple-300"
                          onClick={handleGenerateFocusAreas}
                          disabled={generatingAI || !companyInfo.businessFocus}
                        >
                          {generatingAI ? 'Generating...' : 'Regenerate Focus Areas'}
                        </button>
                      )}
                    </div>
                    
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        className={`shadow appearance-none bg-gray-800 border ${
                          isAutoField ? 'border-teal-700' : 'border-gray-700'
                        } rounded w-full py-2 px-3 text-gray-200 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent`}
                        value={placeholderValues[placeholder] || ''}
                        onChange={(e) => {
                          if (!isAutoField) {
                            setPlaceholderValues(prev => ({
                              ...prev,
                              [placeholder]: e.target.value
                            }));
                          }
                        }}
                        placeholder={isFocusField ? 'Generating based on business focus...' : `Enter ${getDisplayName(placeholder)}`}
                        readOnly={isAutoField}
                      />
                    </div>
                    
                    {isFocusField && (
                      <p className="text-xs text-gray-400 mt-1">
                        AI-generated based on company's business focus and industry
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

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

        <div className="flex items-center space-x-3">
          <button
            type="button"
            className={`bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 transition-colors ${
              refiningEmail ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            onClick={handleRefineEmail}
            disabled={refiningEmail || !customBody || !customSubject}
          >
            {refiningEmail ? (
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Refining...
              </div>
            ) : 'Refine with AI'}
          </button>
          
          <button
            type="submit"
            className={`bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={loading || refiningEmail}
          >
            {loading ? 'Creating Draft...' : 'Create Draft'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EmailTemplateSelector; 