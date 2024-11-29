import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

type SystemStatus = {
  openai: {
    status: 'ok' | 'error' | 'unknown';
    message?: string;
    lastCheck: string;
  };
  pinecone: {
    status: 'ok' | 'error' | 'unknown';
    message?: string;
    indexStats?: {
      dimensions: number;
      totalVectorCount: number;
      indexFullness: number;
    };
    lastCheck: string;
  };
  system: {
    uptime: string;
    memoryUsage: {
      used: string;
      total: string;
      percentage: number;
    };
    dockerStats: {
      cpu: string;
      memory: string;
      network: string;
    };
  };
};

export default function Monitoring() {
  const router = useRouter();
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/system/status');
        const data = await response.json();
        setStatus(data);
      } catch (err) {
        setError('Failed to fetch system status');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const StatusBadge = ({ status }: { status: 'ok' | 'error' | 'unknown' }) => (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        status === 'ok'
          ? 'bg-green-100 text-green-800'
          : status === 'error'
          ? 'bg-red-100 text-red-800'
          : 'bg-gray-100 text-gray-800'
      }`}
    >
      {status === 'ok' ? 'Healthy' : status === 'error' ? 'Error' : 'Unknown'}
    </span>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>System Monitoring - Chat with YouTube</title>
      </Head>

      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">System Monitoring</h1>
            <button
              onClick={() => router.push('/')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Back to App
            </button>
          </div>

          {loading ? (
            <div className="mt-6 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="mt-6 bg-red-50 p-4 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* API Status */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-6 w-6 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          API Status
                        </dt>
                        <dd className="flex items-center justify-between mt-1">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              OpenAI
                            </div>
                            <StatusBadge status={status?.openai.status || 'unknown'} />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              Pinecone
                            </div>
                            <StatusBadge status={status?.pinecone.status || 'unknown'} />
                          </div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pinecone Stats */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-6 w-6 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Pinecone Index Stats
                        </dt>
                        <dd className="mt-1">
                          {status?.pinecone.indexStats ? (
                            <div className="space-y-1">
                              <div className="text-sm text-gray-900">
                                Vectors: {status.pinecone.indexStats.totalVectorCount.toLocaleString()}
                              </div>
                              <div className="text-sm text-gray-900">
                                Dimensions: {status.pinecone.indexStats.dimensions}
                              </div>
                              <div className="text-sm text-gray-900">
                                Index Fullness: {(status.pinecone.indexStats.indexFullness * 100).toFixed(1)}%
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">No stats available</span>
                          )}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* System Resources */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-6 w-6 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                        />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          System Resources
                        </dt>
                        <dd className="mt-1 space-y-1">
                          <div className="text-sm text-gray-900">
                            Uptime: {status?.system.uptime}
                          </div>
                          <div className="text-sm text-gray-900">
                            Memory: {status?.system.memoryUsage.used} / {status?.system.memoryUsage.total} ({status?.system.memoryUsage.percentage}%)
                          </div>
                          <div className="text-sm text-gray-900">
                            CPU: {status?.system.dockerStats.cpu}
                          </div>
                          <div className="text-sm text-gray-900">
                            Network I/O: {status?.system.dockerStats.network}
                          </div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
