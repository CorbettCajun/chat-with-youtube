import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function SetupComplete() {
  const router = useRouter();
  const [configStatus, setConfigStatus] = useState<'checking' | 'configured' | 'error'>('checking');
  const [error, setError] = useState('');

  useEffect(() => {
    const checkConfig = async () => {
      try {
        const response = await fetch('/api/config-status');
        const data = await response.json();

        if (data.configured) {
          setConfigStatus('configured');
        } else {
          setConfigStatus('error');
          setError(data.message);
        }
      } catch (err) {
        setConfigStatus('error');
        setError('Failed to verify configuration');
      }
    };

    checkConfig();
  }, []);

  const nextSteps = [
    {
      title: 'Try the Application',
      description: 'Start by uploading a YouTube video URL to chat with its content.',
      link: '/',
      linkText: 'Go to Home',
    },
    {
      title: 'Check Monitoring',
      description: 'View application metrics and logs in Grafana.',
      link: 'http://localhost:3000',
      linkText: 'Open Grafana',
    },
    {
      title: 'Read Documentation',
      description: 'Learn more about the application features and configuration.',
      link: 'https://github.com/yourusername/chat-with-youtube#readme',
      linkText: 'View Docs',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>Setup Complete - Chat with YouTube</title>
      </Head>

      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {configStatus === 'checking' ? 'Verifying Setup...' :
             configStatus === 'configured' ? 'Setup Complete!' :
             'Setup Error'}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {configStatus === 'checking' ? 'Please wait while we verify your configuration...' :
             configStatus === 'configured' ? 'Your Chat with YouTube application is ready to use!' :
             `Error: ${error}`}
          </p>
        </div>

        {configStatus === 'checking' && (
          <div className="flex justify-center">
            <svg className="animate-spin h-10 w-10 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}

        {configStatus === 'configured' && (
          <div className="mt-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Next Steps</h3>
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {nextSteps.map((step, index) => (
                  <li key={index}>
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-blue-600 truncate">
                            {step.title}
                          </h4>
                          <p className="mt-1 text-sm text-gray-500">
                            {step.description}
                          </p>
                        </div>
                        <div className="ml-4">
                          <a
                            href={step.link}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            {step.linkText}
                          </a>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {configStatus === 'error' && (
          <div className="mt-8">
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Configuration Error
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                  <div className="mt-4">
                    <div className="-mx-2 -my-1.5 flex">
                      <button
                        type="button"
                        onClick={() => router.push('/setup')}
                        className="px-2 py-1.5 rounded-md text-sm font-medium text-red-800 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Try Setup Again
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
