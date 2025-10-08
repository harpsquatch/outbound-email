const Header = () => {
  return (
    <header className="border-b border-gray-800 py-4 mb-8">
      <div className="max-w-5xl mx-auto px-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
          </div>
          <span className="text-xl font-bold">Cold Email Automation</span>
        </div>
        <div className="flex items-center text-sm text-gray-400">
          <span className="mr-3">Powered by Gmail API</span>
          <span className="bg-green-900 text-green-400 px-2 py-1 rounded text-xs">Batch Processing</span>
        </div>
      </div>
    </header>
  );
};

export default Header; 