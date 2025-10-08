import { useState, useEffect } from 'react';
import templates, { EmailTemplate } from '../data/templates';
import { createDraft, scrapeWebsite } from '../utils/api';

// Define types for batch email processing
interface BatchEmail {
  id: string;
  recipientEmail: string;
  status: 'pending' | 'processing' | 'analyzing' | 'processed' | 'error' | 'success';
  progress: number;
  template?: EmailTemplate;
  subject?: string;
  body?: string;
  error?: string;
  companyInfo?: {
    name: string;
    industry: string;
    businessFocus: string;
    designFocus: string;
    devFocus: string;
    aiFocus: string;
    analysisDetails?: string;
  };
  processingDetails?: {
    startTime: number;
    endTime?: number;
    steps: {
      name: string;
      status: 'pending' | 'in-progress' | 'completed' | 'error';
      timestamp: number;
      details?: string;
    }[];
  };
}

const BatchEmailProcessor = () => {
  console.log("BatchEmailProcessor component loaded");
  
  // State for user information (shared across all emails)
  const [userCompany, setUserCompany] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  
  // State for template selection
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  
  // State for batch emails
  const [batchEmails, setBatchEmails] = useState<BatchEmail[]>([]);
  const [emailInput, setEmailInput] = useState<string>('');
  const [bulkEmailInput, setBulkEmailInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [globalError, setGlobalError] = useState<string>('');
  const [authUrl, setAuthUrl] = useState<string>('');
  const [needsAuth, setNeedsAuth] = useState<boolean>(false);
  
  // Add a new state for the selected email details
  const [selectedEmailDetails, setSelectedEmailDetails] = useState<BatchEmail | null>(null);
  
  // Extract information from email functions
  const extractDomain = (email: string): string => {
    if (!email || !email.includes('@')) return '';
    return email.split('@')[1];
  };
  
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
  
  // Handle adding emails to the batch
  const handleAddEmail = () => {
    if (!emailInput.trim() || !emailInput.includes('@')) {
      setGlobalError('Please enter a valid email address');
      return;
    }
    
    // Check if email already exists in the batch
    if (batchEmails.some(email => email.recipientEmail === emailInput.trim())) {
      setGlobalError('This email is already in the batch');
      return;
    }
    
    const newEmail: BatchEmail = {
      id: Date.now().toString(),
      recipientEmail: emailInput.trim(),
      status: 'pending',
      progress: 0,
    };
    
    setBatchEmails(prev => [...prev, newEmail]);
    setEmailInput('');
    setGlobalError('');
  };

  // Handle bulk import of emails
  const handleBulkImport = () => {
    const emails = bulkEmailInput
      .split(',') // Split by comma only
      .map(email => email.trim())
      .filter(email => email && email.includes('@'));
    
    // Filter out duplicates and already added emails
    const existingEmails = new Set(batchEmails.map(email => email.recipientEmail));
    const newEmails = emails.filter(email => !existingEmails.has(email));
    
    if (newEmails.length === 0) {
      setGlobalError('No new valid emails found');
      return;
    }
    
    const newBatchEmails = newEmails.map(email => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      recipientEmail: email,
      status: 'pending' as const,
      progress: 0,
    }));
    
    setBatchEmails(prev => [...prev, ...newBatchEmails]);
    setBulkEmailInput('');
    setGlobalError('');
  };
  
  // Handle removing an email from the batch
  const handleRemoveEmail = (id: string) => {
    setBatchEmails(prev => prev.filter(email => email.id !== id));
  };

  // Handle clearing all emails
  const handleClearAll = () => {
    setBatchEmails([]);
  };

  // Handle template change
  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    console.log("Template selected:", e.target.value);
    setSelectedTemplateId(e.target.value);
  };

  const addProcessingStep = (
    email: BatchEmail, 
    step: string, 
    status: 'pending' | 'in-progress' | 'completed' | 'error', 
    details?: string
  ): BatchEmail => {
    // Create a new object without modifying status
    const emailCopy = { ...email };
    
    if (!emailCopy.processingDetails) {
      emailCopy.processingDetails = {
        startTime: Date.now(),
        steps: []
      };
    }
    
    // Only add the step to the processing history
    emailCopy.processingDetails.steps.push({
      name: step,
      status,
      timestamp: Date.now(),
      details
    });
    
    if (status === 'completed' || status === 'error') {
      emailCopy.processingDetails.endTime = Date.now();
    }
    
    return emailCopy;
  };

  // Process a single email
  const processEmail = async (email: BatchEmail): Promise<BatchEmail> => {
    console.log("Processing email:", email.recipientEmail);
    try {
      // Set to processing first and initialize processing details
      let updatedEmail: BatchEmail = { 
        ...email, 
        status: 'processing', 
        progress: 20 
      };
      
      updatedEmail = addProcessingStep(updatedEmail, 'initialization', 'completed', 'Started processing email');
      
      // Get template
      const template = templates.find(t => t.id === selectedTemplateId);
      if (!template) {
        console.error("No template found with ID:", selectedTemplateId);
        updatedEmail = addProcessingStep(updatedEmail, 'template-selection', 'error', 'Template not found');
        return { 
          ...updatedEmail, 
          status: 'error', 
          error: 'No template selected',
          progress: 100
        };
      }
      
      updatedEmail = addProcessingStep(updatedEmail, 'template-selection', 'completed', `Selected template: ${template.name}`);
      console.log("Using template:", template.name);
      
      // Analyze company website
      const domain = extractDomain(email.recipientEmail);
      if (!domain) {
        console.error("Invalid email domain for:", email.recipientEmail);
        updatedEmail = addProcessingStep(updatedEmail, 'domain-analysis', 'error', 'Invalid email domain');
        return { 
          ...updatedEmail, 
          status: 'error', 
          error: 'Invalid email domain',
          progress: 100
        };
      }
      
      // Set analyzing status before scraping
      const analyzingEmail: BatchEmail = { ...updatedEmail, status: 'analyzing', progress: 30 };
      // Update email status in batch
      setBatchEmails(prev => 
        prev.map(e => e.recipientEmail === email.recipientEmail ? analyzingEmail : e)
      );
      
      console.log(`Calling scrapeWebsite API for domain: ${domain}`);
      
      // Scrape website data
      let result;
      try {
        result = await scrapeWebsite(domain);
        console.log(`Scrape result for ${domain}:`, result);
      } catch (scrapeError) {
        console.error(`Error scraping website for ${domain}:`, scrapeError);
        result = {
          success: false,
          error: scrapeError instanceof Error ? scrapeError.message : 'Failed to scrape website',
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
      
      if (!result.success) {
        console.warn(`Web search unsuccessful for domain: ${domain}. Using fallback values.`);
        updatedEmail = addProcessingStep(updatedEmail, 'scrape-website', 'error', 
          `Web search failed: ${result.error || 'Unknown error'}. Using fallback values.`);
      } else {
        updatedEmail = addProcessingStep(updatedEmail, 'scrape-website', 'completed', 
          `Successfully scraped ${domain}`);
      }
      
      // Log the exact structure of the search data
      console.log('Search data structure for debugging:', {
        industry: result.industry,
        design_focus: result.design_focus,
        dev_focus: result.dev_focus,
        ai_focus: result.ai_focus,
        business_focus: result.business_focus,
        raw: result
      });
      
      // Update progress
      updatedEmail.progress = 40;
      
      // Extract clean company name
      const cleanCompanyName = extractCompanyFromEmail(email.recipientEmail);
      updatedEmail = addProcessingStep(updatedEmail, 'extract-company-info', 'completed', `Extracted company name: ${cleanCompanyName}`);
      
      // Generate a vision/product line from the company data (same as in EmailTemplateSelector)
      const productVisionLine = result.description 
        ? `${result.description.split('.')[0]}`
        : `innovative solutions in ${result.industry || 'technology'}`;
      
      // Extract information with fallbacks
      const companyInfo = {
        name: result.company_name || cleanCompanyName,
        industry: result.industry || 'technology',
        businessFocus: result.business_focus || 'business growth and digital transformation',
        designFocus: result.design_focus || "UI/UX optimization for improved user engagement",
        devFocus: result.dev_focus || "Scalable, AI-powered architecture",
        aiFocus: result.ai_focus || "Custom AI solutions for automation and efficiency"
      };
      
      console.log(`Company info for ${domain} after processing:`, companyInfo);
      
      // Add detailed analysis steps
      // Industry analysis
      updatedEmail = addProcessingStep(updatedEmail, 'analyze-industry', 'in-progress', 'Determining industry classification');
      updatedEmail = addProcessingStep(updatedEmail, 'analyze-industry', 'completed', `Industry identified: ${companyInfo.industry}`);
      
      // Design focus analysis
      updatedEmail = addProcessingStep(updatedEmail, 'analyze-design-focus', 'in-progress', 'Identifying design priorities');
      updatedEmail = addProcessingStep(updatedEmail, 'analyze-design-focus', 'completed', 
        `Design focus identified: ${companyInfo.designFocus}`);
      
      // Dev focus analysis
      updatedEmail = addProcessingStep(updatedEmail, 'analyze-dev-focus', 'in-progress', 'Identifying development priorities');
      updatedEmail = addProcessingStep(updatedEmail, 'analyze-dev-focus', 'completed', 
        `Development focus identified: ${companyInfo.devFocus}`);
      
      // AI focus analysis
      updatedEmail = addProcessingStep(updatedEmail, 'analyze-ai-focus', 'in-progress', 'Analyzing AI integration priorities');
      updatedEmail = addProcessingStep(updatedEmail, 'analyze-ai-focus', 'completed', 
        `AI focus identified: ${companyInfo.aiFocus}`);
      
      // Fill in template placeholders (following the exact same logic as EmailTemplateSelector)
      updatedEmail = addProcessingStep(updatedEmail, 'prepare-template', 'in-progress', 'Customizing email template');
      let subject = template.subject;
      let body = template.body;
      
      // First handle the special auto-populated fields with exact placeholder names
      const specialFields = {
        "Recipient's Company": companyInfo.name,
        "Industry": companyInfo.industry,
        "industry": companyInfo.industry,
        "specific achievement or aspect of their business": companyInfo.businessFocus,
        "Insert a line about their product, vision": productVisionLine
      };
      
      // Replace special fields first
      Object.entries(specialFields).forEach(([placeholder, value]) => {
        if (value) {
          const regex = new RegExp(`\\[${placeholder}\\]`, 'g');
          subject = subject.replace(regex, value);
          body = body.replace(regex, value);
        }
      });
      
      updatedEmail = addProcessingStep(updatedEmail, 'template-customization', 'in-progress', 'Filling in special fields');
      
      // Then handle any remaining placeholders
      const recipientName = extractNameFromEmail(email.recipientEmail);
      
      const placeholderValues = {
        "Recipient": recipientName,
        "Recipient's Company": companyInfo.name,
        "Your Name": userName,
        "Your Company": userCompany,
        "design_focus": companyInfo.designFocus,
        "dev_focus": companyInfo.devFocus,
        "ai_focus": companyInfo.aiFocus
      };
      
      // Apply replacements
      Object.entries(placeholderValues).forEach(([placeholder, value]) => {
        if (value) {
          const regex = new RegExp(`\\[${placeholder}\\]`, 'g');
          subject = subject.replace(regex, value);
          body = body.replace(regex, value);
        }
      });
      
      updatedEmail = addProcessingStep(updatedEmail, 'template-customization', 'completed', 'All placeholders filled successfully');
      
      // Final check for any remaining placeholders - provide fallbacks
      const remainingPlaceholders = {
        "Recipient": "there",
        "Recipient's Company": companyInfo.name,
        "Your Name": userName || "Me",
        "Your Company": userCompany || "Our Company",
        "industry": companyInfo.industry,
        "Industry": companyInfo.industry,
        "specific achievement or aspect of their business": companyInfo.businessFocus,
        "Insert a line about their product, vision": productVisionLine,
        "design_focus": companyInfo.designFocus,
        "dev_focus": companyInfo.devFocus,
        "ai_focus": companyInfo.aiFocus
      };
      
      // Check for any leftover placeholders and replace them
      Object.entries(remainingPlaceholders).forEach(([placeholder, value]) => {
        const regex = new RegExp(`\\[${placeholder}\\]`, 'g');
        if (subject.match(regex) || body.match(regex)) {
          console.log(`Found remaining placeholder [${placeholder}], replacing with fallback value`);
          subject = subject.replace(regex, value);
          body = body.replace(regex, value);
        }
      });
      
      // Final pass - replace any remaining [placeholders] with empty string to avoid sending emails with placeholders
      subject = subject.replace(/\[[^\]]+\]/g, '');
      body = body.replace(/\[[^\]]+\]/g, '');
      
      console.log("Email content after final replacements:", {
        subject: subject.substring(0, 50) + "...",
        bodyLength: body.length
      });
      
      updatedEmail.subject = subject;
      updatedEmail.body = body;
      updatedEmail.companyInfo = companyInfo;
      updatedEmail.progress = 75;
      
      updatedEmail = addProcessingStep(updatedEmail, 'prepare-draft', 'in-progress', 'Preparing email draft for sending');
      console.log(`Calling createDraft API for: ${email.recipientEmail}`);
      
      // Create the draft email
      const draftResult = await createDraft({
        recipient_email: email.recipientEmail,
        subject,
        body
      });
      
      console.log(`Draft result for ${email.recipientEmail}:`, draftResult);
      
      if (!draftResult.success) {
        if (draftResult.auth_required && draftResult.auth_url) {
          console.log("Authentication required for Gmail");
          setNeedsAuth(true);
          setAuthUrl(draftResult.auth_url || '');
          updatedEmail = addProcessingStep(updatedEmail, 'create-draft', 'error', 'Authentication required');
          return { 
            ...updatedEmail, 
            status: 'error', 
            error: 'Authentication required',
            progress: 100
          };
        }
        
        console.error("Failed to create draft:", draftResult.error);
        updatedEmail = addProcessingStep(updatedEmail, 'create-draft', 'error', draftResult.error || 'Failed to create draft');
        return { 
          ...updatedEmail, 
          status: 'error', 
          error: draftResult.error || 'Failed to create draft',
          progress: 100
        };
      }
      
      // Success!
      console.log(`Successfully created draft for: ${email.recipientEmail}`);
      updatedEmail = addProcessingStep(updatedEmail, 'create-draft', 'completed', 'Draft created successfully');
      return {
        ...updatedEmail,
        status: 'success',
        progress: 100
      };
    } catch (err) {
      console.error("Exception in processEmail:", err);
      let errorEmail: BatchEmail = { ...email, status: 'error', progress: 100 };
      errorEmail = addProcessingStep(errorEmail, 'process-email', 'error', err instanceof Error ? err.message : 'Unknown error occurred');
      return {
        ...errorEmail,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error occurred',
        progress: 100
      };
    }
  };

  // Process all emails
  const processAllEmails = async () => {
    console.log("Process button clicked - processAllEmails running");
    console.log("Current batch emails:", batchEmails);
    
    if (batchEmails.length === 0) {
      setGlobalError('No emails to process');
      return;
    }
    
    if (!selectedTemplateId) {
      setGlobalError('Please select a template');
      return;
    }
    
    if (!userName || !userCompany) {
      setGlobalError('Please enter your name and company name');
      return;
    }
    
    setIsProcessing(true);
    setGlobalError('');
    
    try {
      // Group emails by domain to process each domain only once
      const domainGroups: { [domain: string]: BatchEmail[] } = {};
      const domainData: { [domain: string]: any } = {};
      
      // First, group emails by domain
      batchEmails.forEach(email => {
        // Skip already processed emails
        if (email.status === 'success') return;
        
        const domain = extractDomain(email.recipientEmail);
        if (!domain) return;
        
        if (!domainGroups[domain]) {
          domainGroups[domain] = [];
        }
        domainGroups[domain].push(email);
      });
      
      console.log(`Grouped emails by domain:`, Object.keys(domainGroups).map(domain => 
        `${domain}: ${domainGroups[domain].length} emails`
      ));
      
      // Process each domain once
      for (const domain of Object.keys(domainGroups)) {
        console.log(`Processing domain: ${domain} with ${domainGroups[domain].length} emails`);
        
        // Update emails for this domain to "analyzing" status
        domainGroups[domain].forEach(email => {
          // Update batch emails with analyzing status
          setBatchEmails(prev => prev.map(e => 
            e.recipientEmail === email.recipientEmail ? 
            { ...e, status: 'analyzing', progress: 30 } : e
          ));
        });
        
        // Scrape website data once per domain
        let scrapeResult;
        try {
          console.log(`Scraping website for domain: ${domain}`);
          scrapeResult = await scrapeWebsite(domain);
          console.log(`Scrape result for ${domain}:`, scrapeResult);
          
          // Store domain data for all emails with this domain
          domainData[domain] = {
            success: scrapeResult.success,
            company_name: scrapeResult.company_name || domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1),
            industry: scrapeResult.industry || 'technology',
            business_focus: scrapeResult.business_focus || 'business growth and digital transformation',
            design_focus: scrapeResult.design_focus || "UI/UX optimization for improved user engagement",
            dev_focus: scrapeResult.dev_focus || "Scalable, AI-powered architecture",
            ai_focus: scrapeResult.ai_focus || "Custom AI solutions for automation and efficiency",
            description: scrapeResult.description || `A company providing solutions in the ${scrapeResult.industry || 'technology'} industry`,
            error: scrapeResult.error,
          };
          
          console.log(`Domain data stored for ${domain}:`, domainData[domain]);
        } catch (scrapeError) {
          console.error(`Error scraping domain ${domain}:`, scrapeError);
          domainData[domain] = {
            success: false,
            error: scrapeError instanceof Error ? scrapeError.message : 'Failed to scrape website',
            company_name: domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1),
            industry: 'technology',
            business_focus: 'business growth and digital transformation',
            design_focus: "UI/UX optimization for improved user engagement",
            dev_focus: "Scalable, AI-powered architecture",
            ai_focus: "Custom AI solutions for automation and efficiency",
            description: `A company providing solutions in the technology industry`
          };
        }
        
        // If there are multiple emails for this domain, only process the first one
        // and mark the rest as processed
        if (domainGroups[domain].length > 1) {
          try {
            // Get the first email
            const primaryEmail = domainGroups[domain][0];
            
            // Create a modified processEmail function that uses pre-scraped data
            const result = await processEmailWithDomainData(primaryEmail, domainData[domain], domainGroups[domain]);
            
            // If the primary email was processed successfully
            if (result.status === 'success') {
              // Update all emails from this domain with the success status and completed info
              const updatedEmails = domainGroups[domain].map(email => {
                // Skip the primary email since it's already been updated
                if (email.id === primaryEmail.id) {
                  return result;
                }
                
                // For additional emails, create a copy of the result
                const emailCopy: BatchEmail = { 
                  ...email,
                  status: 'success',
                  progress: 100,
                  subject: result.subject,
                  body: result.body,
                  companyInfo: result.companyInfo
                };
                
                // Add processing details specific to this email
                const processingDetails = result.processingDetails ? 
                  { ...result.processingDetails } : 
                  { startTime: Date.now(), steps: [] };
                
                processingDetails.steps = [
                  ...processingDetails.steps.filter(step => 
                    !step.name.includes('create-draft') && !step.name.includes('multi-recipient')
                  ),
                  {
                    name: 'multi-recipient-handling',
                    status: 'completed' as const,
                    timestamp: Date.now(),
                    details: `Included in combined email with ${domainGroups[domain].length - 1} other recipient(s)`
                  }
                ];
                
                emailCopy.processingDetails = processingDetails;
                
                return emailCopy;
              });
              
              // Update all emails in the batch at once
              setBatchEmails(prev => {
                // Create a map for faster lookup
                const updatedEmailsMap = new Map(updatedEmails.map(email => [email.id, email]));
                
                return prev.map(email => 
                  updatedEmailsMap.has(email.id) ? updatedEmailsMap.get(email.id)! : email
                );
              });
              
              console.log(`Updated ${updatedEmails.length} emails for domain ${domain} with combined email status`);
            } else if (result.status === 'error' && result.error === 'Authentication required') {
              // If authentication is required, stop processing
              console.log("Authentication required, stopping batch");
              break;
            } else {
              // If there was an error with the primary email, update all emails with the error
              setBatchEmails(prev => {
                return prev.map(email => 
                  domainGroups[domain].some(e => e.id === email.id) ?
                  { 
                    ...email, 
                    status: 'error', 
                    error: result.error || 'Error processing domain emails',
                    progress: 100
                  } : email
                );
              });
            }
          } catch (domainError) {
            console.error(`Error processing domain ${domain}:`, domainError);
            
            // Update all emails in this domain with the error
            setBatchEmails(prev => {
              return prev.map(email => 
                domainGroups[domain].some(e => e.id === email.id) ?
                { 
                  ...email, 
                  status: 'error', 
                  error: domainError instanceof Error ? domainError.message : 'Error processing domain emails',
                  progress: 100
                } : email
              );
            });
          }
        } else {
          // For domains with only one email, process it normally
          try {
            // There's only one email in the domain
            const email = domainGroups[domain][0];
            
            // Process the single email
            const result = await processEmailWithDomainData(email, domainData[domain]);
            
            // Update the batch with the result
            setBatchEmails(prev => {
              const updated = prev.map(e => e.id === email.id ? result : e);
              console.log("Updated email:", {
                email: result.recipientEmail,
                newStatus: result.status
              });
              return updated;
            });
            
            // If we need authentication, stop processing
            if (result.status === 'error' && result.error === 'Authentication required') {
              console.log("Authentication required, stopping batch");
              break;
            }
          } catch (emailError) {
            console.error(`Error processing email ${domainGroups[domain][0].recipientEmail}:`, emailError);
            
            // Update email with error status
            setBatchEmails(prev => {
              const updated = prev.map(e => e.id === domainGroups[domain][0].id ? {
                ...e,
                status: 'error' as const,
                error: emailError instanceof Error ? emailError.message : 'Processing error',
                progress: 100
              } : e);
              return updated;
            });
          }
        }
      }
      
      console.log('Batch processing completed');
    } catch (error) {
      console.error("Error in batch processing:", error);
      setGlobalError('An error occurred during processing: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Process an email with pre-scraped domain data
  const processEmailWithDomainData = async (email: BatchEmail, domainData: any, allEmailsForDomain: BatchEmail[] = []): Promise<BatchEmail> => {
    console.log(`Processing email with domain data:`, email.recipientEmail);
    try {
      // Set to processing first and initialize processing details
      let updatedEmail: BatchEmail = { 
        ...email, 
        status: 'processing', 
        progress: 20 
      };
      
      updatedEmail = addProcessingStep(updatedEmail, 'initialization', 'completed', 'Started processing email');
      
      // Get template
      const template = templates.find(t => t.id === selectedTemplateId);
      if (!template) {
        console.error("No template found with ID:", selectedTemplateId);
        updatedEmail = addProcessingStep(updatedEmail, 'template-selection', 'error', 'Template not found');
        return { 
          ...updatedEmail, 
          status: 'error', 
          error: 'No template selected',
          progress: 100
        };
      }
      
      updatedEmail = addProcessingStep(updatedEmail, 'template-selection', 'completed', `Selected template: ${template.name}`);
      
      // Get domain
      const domain = extractDomain(email.recipientEmail);
      if (!domain) {
        console.error("Invalid email domain for:", email.recipientEmail);
        updatedEmail = addProcessingStep(updatedEmail, 'domain-analysis', 'error', 'Invalid email domain');
        return { 
          ...updatedEmail, 
          status: 'error', 
          error: 'Invalid email domain',
          progress: 100
        };
      }
      
      // Skip scraping, use the provided domain data
      if (!domainData.success) {
        updatedEmail = addProcessingStep(updatedEmail, 'scrape-website', 'error', 
          `Web search failed: ${domainData.error || 'Unknown error'}. Using fallback values.`);
      } else {
        updatedEmail = addProcessingStep(updatedEmail, 'scrape-website', 'completed', 
          `Using cached data for ${domain}`);
      }
      
      // Extract clean company name
      const cleanCompanyName = extractCompanyFromEmail(email.recipientEmail);
      updatedEmail = addProcessingStep(updatedEmail, 'extract-company-info', 'completed', `Company name: ${domainData.company_name || cleanCompanyName}`);
      
      // Update progress
      updatedEmail.progress = 40;
      
      // Generate a vision/product line from the company data
      const productVisionLine = domainData.description 
        ? `${domainData.description.split('.')[0]}`
        : `innovative solutions in ${domainData.industry || 'technology'}`;
      
      // Extract information with fallbacks
      const companyInfo = {
        name: domainData.company_name || cleanCompanyName,
        industry: domainData.industry || 'technology',
        businessFocus: domainData.business_focus || 'business growth and digital transformation',
        designFocus: domainData.design_focus || "UI/UX optimization for improved user engagement",
        devFocus: domainData.dev_focus || "Scalable, AI-powered architecture",
        aiFocus: domainData.ai_focus || "Custom AI solutions for automation and efficiency"
      };
      
      console.log(`Company info for ${email.recipientEmail}:`, companyInfo);
      
      // Add detailed analysis steps
      updatedEmail = addProcessingStep(updatedEmail, 'analyze-industry', 'completed', `Industry: ${companyInfo.industry}`);
      updatedEmail = addProcessingStep(updatedEmail, 'analyze-design-focus', 'completed', `Design focus: ${companyInfo.designFocus}`);
      updatedEmail = addProcessingStep(updatedEmail, 'analyze-dev-focus', 'completed', `Dev focus: ${companyInfo.devFocus}`);
      updatedEmail = addProcessingStep(updatedEmail, 'analyze-ai-focus', 'completed', `AI focus: ${companyInfo.aiFocus}`);
      
      // Fill in template placeholders
      updatedEmail = addProcessingStep(updatedEmail, 'prepare-template', 'in-progress', 'Customizing email template');
      let subject = template.subject;
      let body = template.body;
      
      // First handle the special auto-populated fields with exact placeholder names
      const specialFields = {
        "Recipient's Company": companyInfo.name,
        "Industry": companyInfo.industry,
        "industry": companyInfo.industry,
        "specific achievement or aspect of their business": companyInfo.businessFocus,
        "Insert a line about their product, vision": productVisionLine
      };
      
      // Replace special fields first
      Object.entries(specialFields).forEach(([placeholder, value]) => {
        if (value) {
          const regex = new RegExp(`\\[${placeholder}\\]`, 'g');
          subject = subject.replace(regex, value);
          body = body.replace(regex, value);
        }
      });
      
      updatedEmail = addProcessingStep(updatedEmail, 'template-customization', 'in-progress', 'Filling in special fields');
      
      // Check if we need to handle multiple recipients from same domain
      // If this is the primary email and we have other emails for this domain
      const isMultipleRecipients = allEmailsForDomain.length > 1;
      
      let recipientName = extractNameFromEmail(email.recipientEmail);
      
      // For multiple recipients, combine names
      if (isMultipleRecipients) {
        // Extract names of all recipients
        const allNames = allEmailsForDomain.map(e => extractNameFromEmail(e.recipientEmail));
        
        // Format the recipient names for the email
        if (allNames.length === 2) {
          recipientName = `${allNames[0]} and ${allNames[1]}`;
        } else if (allNames.length > 2) {
          recipientName = `${allNames.slice(0, -1).join(', ')}, and ${allNames[allNames.length - 1]}`;
        }
        
        updatedEmail = addProcessingStep(updatedEmail, 'multi-recipient', 'completed', 
          `Combining ${allEmailsForDomain.length} recipients from ${domain}`);
      }
      
      // Then handle any remaining placeholders
      const placeholderValues = {
        "Recipient": recipientName,
        "Recipient's Company": companyInfo.name,
        "Your Name": userName,
        "Your Company": userCompany,
        "design_focus": companyInfo.designFocus,
        "dev_focus": companyInfo.devFocus,
        "ai_focus": companyInfo.aiFocus
      };
      
      // Apply replacements
      Object.entries(placeholderValues).forEach(([placeholder, value]) => {
        if (value) {
          const regex = new RegExp(`\\[${placeholder}\\]`, 'g');
          subject = subject.replace(regex, value);
          body = body.replace(regex, value);
        }
      });
      
      updatedEmail = addProcessingStep(updatedEmail, 'template-customization', 'completed', 'All placeholders filled successfully');
      
      // Final check for any remaining placeholders - provide fallbacks
      const remainingPlaceholders = {
        "Recipient": "there",
        "Recipient's Company": companyInfo.name,
        "Your Name": userName || "Me",
        "Your Company": userCompany || "Our Company",
        "industry": companyInfo.industry,
        "Industry": companyInfo.industry,
        "specific achievement or aspect of their business": companyInfo.businessFocus,
        "Insert a line about their product, vision": productVisionLine,
        "design_focus": companyInfo.designFocus,
        "dev_focus": companyInfo.devFocus,
        "ai_focus": companyInfo.aiFocus
      };
      
      // Check for any leftover placeholders and replace them
      Object.entries(remainingPlaceholders).forEach(([placeholder, value]) => {
        const regex = new RegExp(`\\[${placeholder}\\]`, 'g');
        if (subject.match(regex) || body.match(regex)) {
          console.log(`Found remaining placeholder [${placeholder}], replacing with fallback value`);
          subject = subject.replace(regex, value);
          body = body.replace(regex, value);
        }
      });
      
      // Final pass - replace any remaining [placeholders] with empty string to avoid sending emails with placeholders
      subject = subject.replace(/\[[^\]]+\]/g, '');
      body = body.replace(/\[[^\]]+\]/g, '');
      
      console.log("Email content after final replacements:", {
        subject: subject.substring(0, 50) + "...",
        bodyLength: body.length
      });
      
      updatedEmail.subject = subject;
      updatedEmail.body = body;
      updatedEmail.companyInfo = companyInfo;
      updatedEmail.progress = 75;
      
      updatedEmail = addProcessingStep(updatedEmail, 'prepare-draft', 'in-progress', 'Preparing email draft for sending');
      
      // Handle multiple recipients by including them all in the same email
      let recipientEmails;
      if (isMultipleRecipients) {
        recipientEmails = allEmailsForDomain.map(e => e.recipientEmail).join(',');
        console.log(`Sending combined email to ${allEmailsForDomain.length} recipients:`, recipientEmails);
      } else {
        recipientEmails = email.recipientEmail;
      }
      
      console.log(`Calling createDraft API for: ${recipientEmails}`);
      
      // Create the draft email with all recipients
      const draftResult = await createDraft({
        recipient_email: recipientEmails,
        subject,
        body
      });
      
      console.log(`Draft result for ${recipientEmails}:`, draftResult);
      
      if (!draftResult.success) {
        if (draftResult.auth_required && draftResult.auth_url) {
          console.log("Authentication required for Gmail");
          setNeedsAuth(true);
          setAuthUrl(draftResult.auth_url || '');
          updatedEmail = addProcessingStep(updatedEmail, 'create-draft', 'error', 'Authentication required');
          return { 
            ...updatedEmail, 
            status: 'error', 
            error: 'Authentication required',
            progress: 100
          };
        }
        
        console.error("Failed to create draft:", draftResult.error);
        updatedEmail = addProcessingStep(updatedEmail, 'create-draft', 'error', draftResult.error || 'Failed to create draft');
        return { 
          ...updatedEmail, 
          status: 'error', 
          error: draftResult.error || 'Failed to create draft',
          progress: 100
        };
      }
      
      // Success!
      const successMessage = isMultipleRecipients ? 
        `Successfully created combined draft for ${allEmailsForDomain.length} recipients` : 
        'Draft created successfully';
      
      console.log(`${successMessage}: ${recipientEmails}`);
      updatedEmail = addProcessingStep(updatedEmail, 'create-draft', 'completed', successMessage);
      
      return {
        ...updatedEmail,
        status: 'success',
        progress: 100
      };
    } catch (err) {
      console.error("Exception in processEmailWithDomainData:", err);
      let errorEmail: BatchEmail = { ...email, status: 'error', progress: 100 };
      errorEmail = addProcessingStep(errorEmail, 'process-email', 'error', err instanceof Error ? err.message : 'Unknown error occurred');
      return {
        ...errorEmail,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error occurred',
        progress: 100
      };
    }
  };

  // Add this new function after processEmailWithDomainData
  const refreshDomainData = async (domain: string) => {
    console.log(`Manually refreshing data for domain: ${domain}`);
    
    // Find all emails with this domain
    const emailsForDomain = batchEmails.filter(
      email => extractDomain(email.recipientEmail) === domain
    );
    
    if (emailsForDomain.length === 0) {
      console.log(`No emails found for domain: ${domain}`);
      return;
    }
    
    // Update emails for this domain to "analyzing" status
    emailsForDomain.forEach(email => {
      setBatchEmails(prev => prev.map(e => 
        e.recipientEmail === email.recipientEmail ? 
        { ...e, status: 'analyzing', progress: 30 } : e
      ));
    });
    
    try {
      // Scrape website data
      console.log(`Scraping website for domain: ${domain}`);
      const scrapeResult = await scrapeWebsite(domain);
      console.log(`Scrape result for ${domain}:`, scrapeResult);
      
      // Use the domain data to process each email
      const domainData = {
        success: scrapeResult.success,
        company_name: scrapeResult.company_name || domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1),
        industry: scrapeResult.industry || 'technology',
        business_focus: scrapeResult.business_focus || 'business growth and digital transformation',
        design_focus: scrapeResult.design_focus || "UI/UX optimization for improved user engagement",
        dev_focus: scrapeResult.dev_focus || "Scalable, AI-powered architecture",
        ai_focus: scrapeResult.ai_focus || "Custom AI solutions for automation and efficiency",
        description: scrapeResult.description || `A company providing solutions in the ${scrapeResult.industry || 'technology'} industry`,
        error: scrapeResult.error,
      };
      
      // If there are multiple emails for this domain, only process the first one
      if (emailsForDomain.length > 1) {
        try {
          // Get the first email
          const primaryEmail = emailsForDomain[0];
          
          // Process the primary email with all recipients
          const result = await processEmailWithDomainData(primaryEmail, domainData, emailsForDomain);
          
          // If the primary email was processed successfully
          if (result.status === 'success') {
            // Update all emails from this domain with the success status and completed info
            const updatedEmails = emailsForDomain.map(email => {
              // Skip the primary email since it's already been updated
              if (email.id === primaryEmail.id) {
                return result;
              }
              
              // For additional emails, create a copy of the result
              const emailCopy: BatchEmail = { 
                ...email,
                status: 'success',
                progress: 100,
                subject: result.subject,
                body: result.body,
                companyInfo: result.companyInfo
              };
              
              // Add processing details specific to this email
              const processingDetails = result.processingDetails ? 
                { ...result.processingDetails } : 
                { startTime: Date.now(), steps: [] };
              
              processingDetails.steps = [
                ...processingDetails.steps.filter(step => 
                  !step.name.includes('create-draft') && !step.name.includes('multi-recipient')
                ),
                {
                  name: 'multi-recipient-handling',
                  status: 'completed' as const,
                  timestamp: Date.now(),
                  details: `Included in combined email with ${emailsForDomain.length - 1} other recipient(s)`
                }
              ];
              
              emailCopy.processingDetails = processingDetails;
              
              return emailCopy;
            });
            
            // Update all emails in the batch at once
            setBatchEmails(prev => {
              // Create a map for faster lookup
              const updatedEmailsMap = new Map(updatedEmails.map(email => [email.id, email]));
              
              return prev.map(email => 
                updatedEmailsMap.has(email.id) ? updatedEmailsMap.get(email.id)! : email
              );
            });
            
            console.log(`Updated ${updatedEmails.length} emails for domain ${domain} with combined email status`);
          } else {
            // If there was an error with the primary email, update all emails with the error
            setBatchEmails(prev => {
              return prev.map(email => 
                emailsForDomain.some(e => e.id === email.id) ?
                { 
                  ...email, 
                  status: 'error', 
                  error: result.error || 'Error processing domain emails',
                  progress: 100
                } : email
              );
            });
          }
        } catch (domainError) {
          console.error(`Error processing domain ${domain}:`, domainError);
          
          // Update all emails in this domain with the error
          setBatchEmails(prev => {
            return prev.map(email => 
              emailsForDomain.some(e => e.id === email.id) ?
              { 
                ...email, 
                status: 'error', 
                error: domainError instanceof Error ? domainError.message : 'Error processing domain emails',
                progress: 100
              } : email
            );
          });
        }
      } else {
        // For domains with only one email, process it normally
        try {
          // There's only one email in the domain
          const email = emailsForDomain[0];
          
          // Process the single email
          const result = await processEmailWithDomainData(email, domainData);
          
          // Update the batch with the result
          setBatchEmails(prev => {
            const updated = prev.map(e => e.id === email.id ? result : e);
            console.log("Updated email after refresh:", {
              email: result.recipientEmail,
              newStatus: result.status
            });
            return updated;
          });
        } catch (emailError) {
          console.error(`Error processing email ${emailsForDomain[0].recipientEmail} after domain refresh:`, emailError);
          
          // Update email with error status
          setBatchEmails(prev => {
            const updated = prev.map(e => e.id === emailsForDomain[0].id ? {
              ...e,
              status: 'error' as const,
              error: emailError instanceof Error ? emailError.message : 'Processing error',
              progress: 100
            } : e);
            return updated;
          });
        }
      }
      
      console.log(`Domain refresh completed for: ${domain}`);
    } catch (error) {
      console.error(`Error refreshing domain ${domain}:`, error);
      
      // Update emails with error
      emailsForDomain.forEach(email => {
        setBatchEmails(prev => prev.map(e => 
          e.recipientEmail === email.recipientEmail ? 
          { 
            ...e, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Failed to analyze domain',
            progress: 100 
          } : e
        ));
      });
    }
  };

  // Function to show details for an email
  // Render authentication screen if needed
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
          After authentication, please come back and try again.
        </p>
        <button
          onClick={() => setNeedsAuth(false)}
          className="mt-6 px-4 py-2 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition-colors"
        >
          Back to Batch Email
        </button>
      </div>
    );
  }

  // Add useEffect hooks to monitor state changes
  useEffect(() => {
    console.log("Template selected:", selectedTemplateId);
  }, [selectedTemplateId]);

  useEffect(() => {
    console.log("isProcessing changed:", isProcessing);
  }, [isProcessing]);

  useEffect(() => {
    console.log("Batch emails updated, count:", batchEmails.length);
  }, [batchEmails]);

  useEffect(() => {
    // Reset global error message when user makes changes
    if (globalError) {
      setGlobalError('');
    }
  }, [selectedTemplateId, emailInput, bulkEmailInput]);

  // Add function to show details
  const showEmailDetails = (email: BatchEmail) => {
    setSelectedEmailDetails(email);
  };

  // Function to close the details modal
  const closeEmailDetails = () => {
    setSelectedEmailDetails(null);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 shadow-md rounded-lg p-6">
      {/* User information section */}
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
              disabled={isProcessing}
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
              disabled={isProcessing}
            />
          </div>
        </div>
      </div>
      
      {globalError && (
        <div className="mb-4 p-3 bg-red-900/30 text-red-400 border border-red-800 rounded">
          {globalError}
        </div>
      )}
      
      {/* Template selection */}
      <div className="mb-6">
        <label className="block text-gray-300 text-sm font-bold mb-2">
          Select Email Template
        </label>
        <select
          className="shadow appearance-none bg-gray-800 border border-gray-700 rounded w-full py-2 px-3 text-gray-200 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          value={selectedTemplateId}
          onChange={(e) => {
            console.log("Template dropdown changed:", e.target.value);
            handleTemplateChange(e);
          }}
          disabled={isProcessing}
        >
          <option value="">Select a template...</option>
          {templates.map(template => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </div>
      
      {/* Email batch management */}
      <div className="mb-6">
        <h3 className="text-gray-300 text-lg font-bold mb-3">
          Recipient Emails
        </h3>
        
        {/* Add single email */}
        <div className="mb-4">
          <label className="block text-gray-300 text-sm font-bold mb-2">
            Add Recipient Email
          </label>
          <div className="flex space-x-2">
            <input
              type="email"
              className="shadow appearance-none bg-gray-800 border border-gray-700 rounded flex-grow py-2 px-3 text-gray-200 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="recipient@example.com"
              disabled={isProcessing}
              onKeyPress={(e) => e.key === 'Enter' && handleAddEmail()}
            />
            <button
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-opacity-50"
              onClick={handleAddEmail}
              disabled={isProcessing}
            >
              Add
            </button>
          </div>
        </div>
        
        {/* Bulk import */}
        <div className="mb-4">
          <label className="block text-gray-300 text-sm font-bold mb-2">
            Bulk Import (paste multiple emails)
          </label>
          <div className="space-y-2">
            <textarea
              className="shadow appearance-none bg-gray-800 border border-gray-700 rounded w-full py-2 px-3 text-gray-200 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent h-24 resize-none"
              placeholder="Paste multiple emails separated by commas"
              value={bulkEmailInput}
              onChange={(e) => setBulkEmailInput(e.target.value)}
              disabled={isProcessing}
            />
            <button
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-opacity-50 w-full"
              onClick={handleBulkImport}
              disabled={isProcessing || !bulkEmailInput.trim()}
            >
              Import Emails
            </button>
          </div>
        </div>
        
        {/* Email list with progress indicators */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-gray-300 font-bold">
              Emails to Process ({batchEmails.length})
            </h4>
            <button
              className="text-gray-400 hover:text-gray-300 text-sm"
              onClick={handleClearAll}
              disabled={isProcessing || batchEmails.length === 0}
            >
              Clear All
            </button>
          </div>
          
          {batchEmails.length === 0 ? (
            <div className="bg-gray-800 p-4 rounded text-gray-400 text-center">
              No emails added yet
            </div>
          ) : (
            <div className="bg-gray-800 rounded divide-y divide-gray-700">
              {(() => {
                // Group emails by domain for display
                const domains = new Map<string, BatchEmail[]>();
                batchEmails.forEach(email => {
                  const domain = extractDomain(email.recipientEmail) || 'unknown';
                  if (!domains.has(domain)) {
                    domains.set(domain, []);
                  }
                  domains.get(domain)!.push(email);
                });
                
                // Render emails grouped by domain
                return Array.from(domains.entries()).map(([domain, emailsForDomain]) => (
                  <div key={domain} className="border-b border-gray-700 last:border-b-0">
                    {/* Domain header */}
                    <div className="bg-gray-700 px-3 py-2 text-sm text-gray-300 flex justify-between items-center">
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd" />
                        </svg>
                        <span>{domain}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-xs bg-purple-900/40 text-purple-400 px-2 py-0.5 rounded mr-2">
                          {emailsForDomain.length} {emailsForDomain.length === 1 ? 'email' : 'emails'}
                        </span>
                        <button 
                          onClick={() => refreshDomainData(domain)}
                          disabled={isProcessing || emailsForDomain.some(e => e.status === 'analyzing')}
                          className="text-gray-400 hover:text-teal-400 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Refresh domain analysis"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    {/* Emails for this domain */}
                    {emailsForDomain.map(email => (
                      <div key={email.id} className="p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="text-gray-200 font-medium">{email.recipientEmail}</span>
                            {email.companyInfo?.name && (
                              <span className="ml-2 text-gray-400 text-sm">
                                ({email.companyInfo.name})
                              </span>
                            )}
                          </div>
                          {/* Email action buttons */}
                          <div className="flex items-center">
                            {/* Info button */}
                            <div 
                              className="flex-none mr-2 cursor-pointer text-gray-500 hover:text-blue-500"
                              onClick={() => showEmailDetails(email)}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                              </svg>
                            </div>
                            
                            {/* Remove button */}
                            <button
                              className="text-gray-500 hover:text-gray-300"
                              onClick={() => handleRemoveEmail(email.id)}
                              disabled={isProcessing}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        
                        {/* Status indicator and progress bar */}
                        <div className="flex items-center">
                          <div className="w-full bg-gray-700 rounded-full h-2.5 mr-2">
                            <div 
                              className={`h-2.5 rounded-full ${
                                email.status === 'error' ? 'bg-red-600' : 
                                email.status === 'success' ? 'bg-green-600' : 'bg-blue-600'
                              }`}
                              style={{ width: `${email.progress}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-400 w-16 text-right">
                            {email.status === 'pending' ? 'Pending' :
                             email.status === 'analyzing' ? 'Analyzing' :
                             email.status === 'processed' ? 'Processed' :
                             email.status === 'error' ? 'Error' : 'Success'}
                          </span>
                        </div>
                        
                        {/* Error message if applicable */}
                        {email.status === 'error' && email.error && (
                          <div className="mt-1 text-red-400 text-sm">
                            {email.error}
                          </div>
                        )}
                        
                        {/* Company info if available */}
                        {email.companyInfo && (
                          <div className="mt-2 text-gray-400 text-xs space-y-1">
                            {email.status === 'success' && (
                              <>
                                <div><span className="text-teal-400">Company:</span> {email.companyInfo.name}</div>
                                <div><span className="text-teal-400">Industry:</span> {email.companyInfo.industry}</div>
                                <div><span className="text-teal-400">Design Focus:</span> {email.companyInfo.designFocus}</div>
                                <div><span className="text-teal-400">Dev Focus:</span> {email.companyInfo.devFocus}</div>
                                <div><span className="text-teal-400">AI Focus:</span> {email.companyInfo.aiFocus}</div>
                                {email.processingDetails?.steps.some(step => 
                                  step.name === 'scrape-website' && step.status === 'error') && (
                                  <div className="mt-1 text-yellow-400 italic">
                                    <svg className="inline-block w-3 h-3 mr-1 mb-0.5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path>
                                    </svg>
                                    Using fallback values
                                  </div>
                                )}
                                {email.processingDetails?.steps.some(step => 
                                  step.name === 'multi-recipient-handling' || step.name === 'multi-recipient') && (
                                  <div className="mt-1 text-purple-400 italic">
                                    <svg className="inline-block w-3 h-3 mr-1 mb-0.5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path>
                                    </svg>
                                    Combined email
                                  </div>
                                )}
                              </>
                            )}
                            {email.status === 'analyzing' && (
                              <div className="flex items-center">
                                <span className="text-teal-400 mr-2">Analyzing company data...</span>
                                <svg className="animate-spin h-3 w-3 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
        
        {/* Process button */}
        <div className="flex justify-center mt-6 flex-col items-center">
          <button
            className={`px-6 py-3 font-bold rounded-md transition-colors ${
              isProcessing 
                ? 'bg-gray-700 text-gray-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50'
            }`}
            onClick={(e) => {
              console.log("Process button clicked (event):", e.type);
              // Call the process function directly
              processAllEmails();
            }}
            disabled={isProcessing || batchEmails.length === 0 || !selectedTemplateId}
            type="button"
          >
            {isProcessing ? (
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing {batchEmails.filter(e => e.status !== 'success').length} Emails...
              </div>
            ) : (
              `Process ${batchEmails.length} Email${batchEmails.length !== 1 ? 's' : ''}`
            )}
          </button>
          
          {/* Debug button - only visible in development */}
          {process.env.NODE_ENV !== 'production' && (
            <button
              className="mt-2 px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded"
              onClick={() => {
                console.log("Debug button clicked");
                console.log("Current state:", {
                  batchEmails,
                  isProcessing,
                  selectedTemplateId,
                  userName,
                  userCompany
                });
                if (batchEmails.length > 0) {
                  // Process just the first email as a test
                  const testEmail = batchEmails[0];
                  console.log("Testing with email:", testEmail);
                  processEmail(testEmail).then(result => {
                    console.log("Test processing result:", result);
                    setBatchEmails(prev => prev.map(e => e.id === testEmail.id ? result : e));
                  }).catch(err => {
                    console.error("Test processing error:", err);
                  });
                }
              }}
            >
              Debug (Process First Email Only)
            </button>
          )}
        </div>
      </div>
      
      {/* Stats summary */}
      {batchEmails.length > 0 && (
        <div className="mt-6 p-4 bg-gray-800 rounded">
          <h4 className="text-gray-300 font-bold mb-3">Summary</h4>
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-gray-900 p-3 rounded text-center">
              <div className="text-2xl font-bold text-gray-200">
                {batchEmails.length}
              </div>
              <div className="text-gray-400 text-sm">Total</div>
            </div>
            <div className="bg-gray-900 p-3 rounded text-center">
              <div className="text-2xl font-bold text-purple-400">
                {Array.from(new Set(batchEmails.map(e => extractDomain(e.recipientEmail)).filter(Boolean))).length}
              </div>
              <div className="text-gray-400 text-sm">Domains</div>
            </div>
            <div className="bg-gray-900 p-3 rounded text-center">
              <div className="text-2xl font-bold text-blue-400">
                {batchEmails.filter(e => e.status === 'pending' || e.status === 'analyzing').length}
              </div>
              <div className="text-gray-400 text-sm">Pending</div>
            </div>
            <div className="bg-gray-900 p-3 rounded text-center">
              <div className="text-2xl font-bold text-green-400">
                {batchEmails.filter(e => e.status === 'success').length}
              </div>
              <div className="text-gray-400 text-sm">Success</div>
            </div>
            <div className="bg-gray-900 p-3 rounded text-center">
              <div className="text-2xl font-bold text-red-400">
                {batchEmails.filter(e => e.status === 'error').length}
              </div>
              <div className="text-gray-400 text-sm">Failed</div>
            </div>
          </div>
        </div>
      )}

      {/* Email Details Modal */}
      {selectedEmailDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-3/4 max-w-3xl max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Email Processing Details</h3>
              <button 
                onClick={closeEmailDetails}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            
            {/* Email Info */}
            <div className="mb-4 pb-2 border-b">
              <div className="flex items-center mb-2">
                <span className="font-medium mr-2">Recipient:</span>
                <span>{selectedEmailDetails.recipientEmail}</span>
              </div>
              
              {/* Show combined email recipients if this email is part of a combined email */}
              {selectedEmailDetails.processingDetails?.steps.some(step => 
                step.name === 'multi-recipient-handling' || step.name === 'multi-recipient') && (
                <div className="flex items-center mb-2">
                  <span className="font-medium mr-2">Combined with:</span>
                  <span className="text-purple-600 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path>
                    </svg>
                    {selectedEmailDetails.processingDetails?.steps.find(step => 
                      step.name === 'multi-recipient-handling' || step.name === 'multi-recipient')?.details || 
                      'Other recipients from the same domain'}
                  </span>
                </div>
              )}
              
              <div className="flex items-center mb-2">
                <span className="font-medium mr-2">Status:</span>
                <span className={`px-2 py-1 rounded text-xs inline-block 
                  ${selectedEmailDetails.status === 'success' ? 'bg-green-100 text-green-800' : 
                    selectedEmailDetails.status === 'error' ? 'bg-red-100 text-red-800' : 
                    selectedEmailDetails.status === 'analyzing' ? 'bg-blue-100 text-blue-800' : 
                    selectedEmailDetails.status === 'processing' ? 'bg-yellow-100 text-yellow-800' : 
                    'bg-gray-100 text-gray-800'}
                `}>
                  {selectedEmailDetails.status}
                </span>
              </div>
              {selectedEmailDetails.error && (
                <div className="flex items-center mb-2">
                  <span className="font-medium mr-2">Error:</span>
                  <span className="text-red-500">{selectedEmailDetails.error}</span>
                </div>
              )}
            </div>
            
            {/* Company Info in Modal */}
            {selectedEmailDetails.companyInfo && (
              <div className="mb-4 pb-2 border-b">
                <h4 className="font-medium mb-2 flex items-center">
                  Company Information
                  {selectedEmailDetails.processingDetails?.steps.some(step => 
                    step.name === 'scrape-website' && step.status === 'error') && (
                    <span className="ml-2 text-xs text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path>
                      </svg>
                      Using fallback values
                    </span>
                  )}
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="font-medium">Name:</span> {selectedEmailDetails.companyInfo.name || 'N/A'}</div>
                  <div><span className="font-medium">Industry:</span> {selectedEmailDetails.companyInfo.industry || 'N/A'}</div>
                  <div><span className="font-medium">Design Focus:</span> {selectedEmailDetails.companyInfo.designFocus || 'N/A'}</div>
                  <div><span className="font-medium">Dev Focus:</span> {selectedEmailDetails.companyInfo.devFocus || 'N/A'}</div>
                  <div><span className="font-medium">AI Focus:</span> {selectedEmailDetails.companyInfo.aiFocus || 'N/A'}</div>
                  <div><span className="font-medium">Business Focus:</span> {selectedEmailDetails.companyInfo.businessFocus || 'N/A'}</div>
                </div>
              </div>
            )}
            
            {/* Processing Timeline */}
            {selectedEmailDetails.processingDetails && (
              <div className="mb-4">
                <h4 className="font-medium mb-2">Processing Timeline</h4>
                <div className="border-l-2 border-blue-300 ml-2 pl-4 space-y-3">
                  {selectedEmailDetails.processingDetails.steps.map((step, index) => (
                    <div key={index} className="relative">
                      <div className="absolute -left-[1.25rem] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-blue-500"></div>
                      <div className="mb-1 text-sm">
                        <span className={`font-medium ${
                          step.status === 'completed' ? 'text-green-600' : 
                          step.status === 'error' ? 'text-red-600' : 
                          step.status === 'in-progress' ? 'text-blue-600' : 
                          'text-gray-600'
                        }`}>
                          {step.name}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          {new Date(step.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      {step.details && (
                        <div className="text-xs text-gray-600">{step.details}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Email Content */}
            {(selectedEmailDetails.subject || selectedEmailDetails.body) && (
              <div className="mb-4">
                <h4 className="font-medium mb-2">Email Content</h4>
                {selectedEmailDetails.subject && (
                  <div className="mb-2">
                    <span className="font-medium">Subject:</span>
                    <div className="mt-1 p-2 border rounded bg-gray-50">{selectedEmailDetails.subject}</div>
                  </div>
                )}
                {selectedEmailDetails.body && (
                  <div>
                    <span className="font-medium">Body:</span>
                    <div className="mt-1 p-2 border rounded bg-gray-50 whitespace-pre-wrap">{selectedEmailDetails.body}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchEmailProcessor;