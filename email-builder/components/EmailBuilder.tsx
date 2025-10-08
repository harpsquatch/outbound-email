import { useState, useEffect } from 'react';
import EmailTemplateSelector from './EmailTemplateSelector';
import BatchEmailProcessor from './BatchEmailProcessor';

const EmailBuilder = () => {
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  
  useEffect(() => {
    console.log("EmailBuilder activeTab changed:", activeTab);
  }, [activeTab]);

  return (
    <div>
      {/* Tab navigation */}
      <div className="border-b border-gray-800 mb-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => {
              console.log("Single email tab clicked");
              setActiveTab('single');
            }}
            className={`${
              activeTab === 'single'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-500'
            } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
            Single Email
          </button>
          <button
            onClick={() => {
              console.log("Batch emails tab clicked");
              setActiveTab('batch');
            }}
            className={`${
              activeTab === 'batch'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-500'
            } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
              <path d="M8 2H2a2 2 0 00-2 2v12a2 2 0 002 2h8v-4a2 2 0 012-2h4V7.414A2 2 0 0015.586 6L12 2.586A2 2 0 0010.586 2H8z" />
            </svg>
            Batch Emails
          </button>
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'single' ? (
          <div key="single-email">
            <EmailTemplateSelector />
          </div>
        ) : (
          <div key="batch-email">
            <BatchEmailProcessor />
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailBuilder; 