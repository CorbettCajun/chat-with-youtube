import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { toast } from 'react-toastify';
import axios from 'axios';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

interface SetupStep {
  title: string;
  description: string;
  help?: string;
  field: 'openaiKey' | 'pineconeKey' | 'pineconeIndex' | 'youtubeKey';
  placeholder: string;
  pattern?: string;
  testEndpoint: string;
}

export default function Setup() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [showSecrets, setShowSecrets] = useState({
    openaiKey: false,
    pineconeKey: false,
    youtubeKey: false
  });
  const [config, setConfig] = useState({
    openaiKey: '',
    pineconeKey: '',
    pineconeIndex: '',
    youtubeKey: ''
  });
  const [validation, setValidation] = useState({
    openaiKey: false,
    pineconeKey: false,
    pineconeIndex: false,
    youtubeKey: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const [value, setValue] = useState('');

  const toastConfig = {
    position: 'top-right',
    autoClose: 2000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  } as const;

  // Check if already configured
  useEffect(() => {
    const checkConfiguration = async () => {
      try {
        const response = await fetch('/api/config-status');
        const data = await response.json();
        
        if (data.configured) {
          router.replace('/chat');
          return;
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Configuration check error:', error);
        setLoading(false);
      }
    };

    checkConfiguration();
  }, [router]);

  // Load saved progress
  useEffect(() => {
    if (loading) return;

    const savedConfig = localStorage.getItem('setup_progress');
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      setConfig(parsed);
      // Determine the furthest valid step
      if (parsed.youtubeKey) setStep(4);
      else if (parsed.pineconeIndex) setStep(3);
      else if (parsed.pineconeKey) setStep(2);
    }
  }, [loading]);

  // Save progress
  useEffect(() => {
    localStorage.setItem('setup_progress', JSON.stringify(config));
  }, [config]);

  const steps: SetupStep[] = [
    {
      title: 'OpenAI API Key',
      description: 'Enter your OpenAI API key to enable text processing and embeddings.',
      field: 'openaiKey',
      placeholder: 'sk-...',
      pattern: '^sk-[a-zA-Z0-9]{48}$',
      testEndpoint: '/api/test/openai',
      help: 'https://platform.openai.com/account/api-keys'
    },
    {
      title: 'Pinecone API Key',
      description: 'Enter your Pinecone API key for vector storage.',
      field: 'pineconeKey',
      placeholder: 'Enter your Pinecone API key',
      testEndpoint: '/api/test/pinecone-key',
      help: 'https://app.pinecone.io/organizations/-/apikeys'
    },
    {
      title: 'Pinecone Index',
      description: 'Enter your Pinecone index name.',
      field: 'pineconeIndex',
      placeholder: 'Enter your Pinecone index name',
      testEndpoint: '/api/test/pinecone-index',
      help: 'https://app.pinecone.io/organizations/-/indexes'
    },
    {
      title: 'YouTube API Key',
      description: 'Enter your YouTube API key to enable video search.',
      field: 'youtubeKey',
      placeholder: 'Enter your YouTube API key',
      testEndpoint: '/api/test/youtube',
      help: 'https://console.cloud.google.com/apis/credentials'
    },
  ];

  const currentStep = steps[step - 1];
  if (!currentStep) {
    return <div>Invalid step</div>;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setValue(value);
    setError('');
    
    // Validate input pattern if exists
    const step = steps.find(s => s.field === name);
    if (step?.pattern) {
      const regex = new RegExp(step.pattern);
      setValidation(prev => ({
        ...prev,
        [name]: regex.test(value)
      }));
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setError('');
    }
  };

  const handleNext = async () => {
    if (await testConnection()) {
      // Save current step's value
      const newConfig = { ...config };
      newConfig[currentStep.field] = value;
      setConfig(newConfig);

      // If this is the last step, save configuration and redirect
      if (step === steps.length) {
        try {
          const saveResponse = await axios.post('/api/setup', newConfig);
          if (saveResponse.data.success) {
            toast.success('Configuration saved successfully!');
            router.replace('/chat');
          } else {
            const errorMessage = saveResponse.data.message || 'Failed to save configuration';
            toast.error(errorMessage);
            setError(errorMessage);
          }
        } catch (err: any) {
          console.error('Setup save error:', err);
          const errorMessage = err.response?.data?.message || err.message || 'Failed to save configuration';
          toast.error(errorMessage);
          setError(errorMessage);
        }
      } else {
        // Otherwise, proceed to next step
        setStep(step + 1);
        setValue('');
        setValidation(prev => ({
          ...prev,
          [currentStep.field]: true
        }));
      }
    }
  };

  const testConnection = async () => {
    try {
      setTesting(true);
      setError('');

      if (!value) {
        throw new Error(`${currentStep.title} is required`);
      }

      let requestBody = {};
      if (currentStep.field === 'openaiKey') {
        requestBody = { openaiKey: value };
      } else if (currentStep.field === 'pineconeKey') {
        requestBody = { pineconeKey: value };
      } else if (currentStep.field === 'pineconeIndex') {
        requestBody = {
          pineconeIndex: value,
          pineconeKey: config.pineconeKey
        };
      } else if (currentStep.field === 'youtubeKey') {
        requestBody = { youtubeKey: value };
      }

      const response = await axios.post(currentStep.testEndpoint, requestBody);
      
      if (response.data.success) {
        toast.success('Connection successful!');
        return true;
      } else {
        const errorMessage = response.data.message || 'Connection test failed';
        setError(errorMessage);
        toast.error(errorMessage);
        return false;
      }
    } catch (err: any) {
      console.error('Connection test error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Connection test failed';
      setError(errorMessage);
      toast.error(errorMessage);
      return false;
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>Setup - Chat with YouTube</title>
      </Head>

      {loading ? (
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Setup</h2>
            <p className="mt-1 text-sm text-gray-600">
              Configure your API keys to get started.
            </p>

            <div className="relative mt-2">
              <div className="absolute left-0 right-0 h-1 bg-gray-200">
                <div
                  className="h-1 bg-blue-600 transition-all duration-300"
                  style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {currentStep.title}
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  {currentStep.description}
                </p>
              </div>

              <div className="space-y-4">
                {(currentStep.field === 'openaiKey' || currentStep.field === 'pineconeKey' || currentStep.field === 'youtubeKey') && (
                  <div className="flex justify-end mb-2">
                    <button
                      type="button"
                      onClick={() => setShowSecrets(prev => ({
                        ...prev,
                        [currentStep.field]: !prev[currentStep.field as keyof typeof showSecrets]
                      }))}
                      className="text-sm text-gray-600 hover:text-gray-900 flex items-center"
                    >
                      {showSecrets[currentStep.field as keyof typeof showSecrets] ? 'Hide' : 'Show'}
                    </button>
                  </div>
                )}

                <div className="mt-4">
                  <div className="flex items-center justify-end">
                    {currentStep.help && (
                      <button
                        onClick={() => window.open(currentStep.help, '_blank')}
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline mb-2"
                      >
                        {currentStep.field === 'openaiKey' 
                          ? 'Get your API key from OpenAI'
                          : currentStep.field === 'pineconeKey'
                          ? 'Get your API key from Pinecone'
                          : currentStep.field === 'pineconeIndex'
                          ? 'View your Pinecone indexes'
                          : 'Get your API key from Google Cloud'}
                      </button>
                    )}
                  </div>

                  <div className="relative mt-1">
                    <input
                      type={
                        (currentStep.field === 'openaiKey' || 
                         currentStep.field === 'pineconeKey' || 
                         currentStep.field === 'youtubeKey') &&
                        !showSecrets[currentStep.field as keyof typeof showSecrets] 
                          ? 'password' 
                          : 'text'
                      }
                      name={currentStep.field}
                      id={currentStep.field}
                      value={value}
                      onChange={handleChange}
                      placeholder={currentStep.placeholder}
                      className={`block w-full rounded-md border ${
                        error ? 'border-red-300' : 'border-gray-300'
                      } shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2`}
                    />
                    {validation[currentStep.field as keyof typeof validation] && (
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      </div>
                    )}
                  </div>
                </div>
                {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
              </div>

              <div className="mt-6 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={step === 1}
                  className={`${
                    step === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  } py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={testing}
                  className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testing ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Testing...
                    </>
                  ) : (
                    'Next'
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <div className="flex space-x-4">
              {steps.map((s, i) => (
                <div
                  key={s.field}
                  className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    validation[s.field as keyof typeof validation]
                      ? 'bg-green-500 text-white'
                      : i + 1 === step
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {validation[s.field as keyof typeof validation] ? (
                    <CheckCircleIcon className="h-6 w-6" />
                  ) : (
                    i + 1
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
