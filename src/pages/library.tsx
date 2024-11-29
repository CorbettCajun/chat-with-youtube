import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Container, Typography, Button, Box, CircularProgress, Alert, 
  TextField, InputAdornment, FormControl, InputLabel, Select, MenuItem, Grid } from '@mui/material';
import { Add, Search } from '@mui/icons-material';
import { toast } from 'react-toastify';
import dynamic from 'next/dynamic';
import type { DocumentMetadata } from '../types/documents';

// Define API response types
interface ConfigResponse {
  configured: boolean;
  missingSecrets: string[];
  message: string;
  details?: {
    openai?: boolean;
    pinecone?: boolean;
    youtube?: boolean;
  };
}

interface DocumentResponse extends DocumentMetadata {
  dateAdded?: string;
  chunks?: number;
}

// Dynamic imports
const UploadModal = dynamic(() => import('../components/UploadModal'), {
  ssr: false,
  loading: () => <CircularProgress />
});

const DocumentList = dynamic(() => import('../components/DocumentList'), {
  ssr: false,
  loading: () => <CircularProgress />
});

export default function Library() {
  // State
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'youtube' | 'document'>('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [showAPIGuide, setShowAPIGuide] = useState(false);

  // Check configuration status
  useEffect(() => {
    const checkConfiguration = async () => {
      try {
        const response = await fetch('/api/config-status');
        const data = await response.json() as ConfigResponse;
        setIsConfigured(data.configured);
        if (!data.configured) {
          void router.push('/setup');
        }
      } catch (err) {
        setError('Failed to check configuration status');
        console.error(err);
      }
    };

    void checkConfiguration();
  }, [router]);

  // Fetch documents
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        console.log('Fetching documents, isConfigured:', isConfigured);
        const response = await fetch('/api/documents');
        console.log('Response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Fetch error response:', errorText);
          throw new Error(`Failed to fetch documents: ${errorText}`);
        }
        
        const data = await response.json() as DocumentResponse[];
        console.log('Fetched documents:', data);
        
        // Convert dateAdded to createdAt for type compatibility
        const formattedData = data.map((doc: DocumentResponse): DocumentMetadata => ({
          ...doc,
          createdAt: doc.dateAdded || new Date().toISOString(),
          chunks: doc.chunks || 0,
        }));
        
        setDocuments(formattedData);
        setFilteredDocuments(formattedData);
      } catch (err) {
        console.error('Full fetch error:', err);
        setError('Failed to fetch documents: ' + (err instanceof Error ? err.message : 'Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    if (isConfigured) {
      void fetchDocuments();
    } else {
      console.log('Not configured, skipping document fetch');
      setLoading(false);
    }
  }, [isConfigured]);

  // Filter documents
  useEffect(() => {
    let filtered = [...documents];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(doc => 
        doc.title.toLowerCase().includes(query) ||
        doc.description?.toLowerCase().includes(query)
      );
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(doc => doc.type === typeFilter);
    }

    setFilteredDocuments(filtered);
  }, [documents, searchQuery, typeFilter]);

  // Handle document upload
  const handleUpload = async (data: { type: 'file' | 'url' | 'text', content: string, title?: string }) => {
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      await response.json();
      
      // Refresh document list
      const docsResponse = await fetch('/api/documents');
      const docsData = await docsResponse.json() as DocumentResponse[];
      const formattedData = docsData.map((doc: DocumentResponse): DocumentMetadata => ({
        ...doc,
        createdAt: doc.dateAdded || new Date().toISOString(),
        chunks: doc.chunks || 0,
      }));
      setDocuments(formattedData);
      
      toast.success('Document uploaded successfully!');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload document');
    }
  };

  // Handle document deletion
  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      setDocuments(docs => docs.filter(doc => doc.id !== id));
      toast.success('Document deleted successfully!');
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete document');
    }
  };

  // Handle chat navigation
  const handleChat = (id: string) => {
    void router.push(`/chat?document=${id}`);
  };

  // API Integration Guide Component
  const APIIntegrationGuide = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    
    const endpoints = [
      {
        name: 'Config Status',
        method: 'GET',
        url: '/api/config-status',
        description: 'Check application configuration status',
        curlExample: `curl ${baseUrl}/api/config-status`,
        pythonExample: `
import requests

response = requests.get('${baseUrl}/api/config-status')
print(response.json())
        `,
        nodeExample: `
const axios = require('axios');

axios.get('${baseUrl}/api/config-status')
  .then(response => console.log(response.data))
  .catch(error => console.error(error));
        `
      },
      {
        name: 'List Documents',
        method: 'GET',
        url: '/api/documents',
        description: 'Get a list of all uploaded documents',
        curlExample: `curl ${baseUrl}/api/documents`,
        pythonExample: `
import requests

response = requests.get('${baseUrl}/api/documents')
print(response.json())
        `,
        nodeExample: `
const axios = require('axios');

axios.get('${baseUrl}/api/documents')
  .then(response => console.log(response.data))
  .catch(error => console.error(error));
        `
      },
      {
        name: 'Get Document',
        method: 'GET',
        url: '/api/documents/[id]',
        description: 'Get details of a specific document',
        curlExample: `curl ${baseUrl}/api/documents/your-document-id`,
        pythonExample: `
import requests

document_id = 'your-document-id'
response = requests.get(f'${baseUrl}/api/documents/{document_id}')
print(response.json())
        `,
        nodeExample: `
const axios = require('axios');

const documentId = 'your-document-id';
axios.get(\`${baseUrl}/api/documents/\${documentId}\`)
  .then(response => console.log(response.data))
  .catch(error => console.error(error));
        `
      },
      {
        name: 'Delete Document',
        method: 'DELETE',
        url: '/api/documents/[id]',
        description: 'Delete a specific document',
        curlExample: `curl -X DELETE ${baseUrl}/api/documents/your-document-id`,
        pythonExample: `
import requests

document_id = 'your-document-id'
response = requests.delete(f'${baseUrl}/api/documents/{document_id}')
print(response.json())
        `,
        nodeExample: `
const axios = require('axios');

const documentId = 'your-document-id';
axios.delete(\`${baseUrl}/api/documents/\${documentId}\`)
  .then(response => console.log(response.data))
  .catch(error => console.error(error));
        `
      },
      {
        name: 'Upload Document',
        method: 'POST',
        url: '/api/upload',
        description: 'Upload document files',
        curlExample: `curl -X POST -F "file=@document.pdf" ${baseUrl}/api/upload`,
        pythonExample: `
import requests

with open('document.pdf', 'rb') as file:
    files = {'file': file}
    response = requests.post('${baseUrl}/api/upload', files=files)
print(response.json())
        `,
        nodeExample: `
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const formData = new FormData();
formData.append('file', fs.createReadStream('document.pdf'));

axios.post('${baseUrl}/api/upload', formData, {
  headers: formData.getHeaders()
})
.then(response => console.log(response.data))
.catch(error => console.error(error));
        `
      },
      {
        name: 'Upload Text',
        method: 'POST',
        url: '/api/upload/text',
        description: 'Upload text content',
        curlExample: `curl -X POST -H "Content-Type: application/json" -d '{"title":"My Document", "text":"Content here"}' ${baseUrl}/api/upload/text`,
        pythonExample: `
import requests

data = {
    'title': 'My Document',
    'text': 'Content here'
}
response = requests.post('${baseUrl}/api/upload/text', json=data)
print(response.json())
        `,
        nodeExample: `
const axios = require('axios');

const data = {
  title: 'My Document',
  text: 'Content here'
};

axios.post('${baseUrl}/api/upload/text', data)
  .then(response => console.log(response.data))
  .catch(error => console.error(error));
        `
      },
      {
        name: 'Upload URL',
        method: 'POST',
        url: '/api/upload/url',
        description: 'Upload content from a URL (e.g., YouTube video)',
        curlExample: `curl -X POST -H "Content-Type: application/json" -d '{"url":"https://youtube.com/watch?v=example"}' ${baseUrl}/api/upload/url`,
        pythonExample: `
import requests

data = {
    'url': 'https://youtube.com/watch?v=example'
}
response = requests.post('${baseUrl}/api/upload/url', json=data)
print(response.json())
        `,
        nodeExample: `
const axios = require('axios');

const data = {
  url: 'https://youtube.com/watch?v=example'
};

axios.post('${baseUrl}/api/upload/url', data)
  .then(response => console.log(response.data))
  .catch(error => console.error(error));
        `
      },
      {
        name: 'Process Text',
        method: 'POST',
        url: '/api/process-text',
        description: 'Process and analyze text content',
        curlExample: `curl -X POST -H "Content-Type: application/json" -d '{"text":"Your text content"}' ${baseUrl}/api/process-text`,
        pythonExample: `
import requests

data = {
    'text': 'Your text content'
}
response = requests.post('${baseUrl}/api/process-text', json=data)
print(response.json())
        `,
        nodeExample: `
const axios = require('axios');

const data = {
  text: 'Your text content'
};

axios.post('${baseUrl}/api/process-text', data)
  .then(response => console.log(response.data))
  .catch(error => console.error(error));
        `
      },
      {
        name: 'System Status',
        method: 'GET',
        url: '/api/system/status',
        description: 'Get system status and health information',
        curlExample: `curl ${baseUrl}/api/system/status`,
        pythonExample: `
import requests

response = requests.get('${baseUrl}/api/system/status')
print(response.json())
        `,
        nodeExample: `
const axios = require('axios');

axios.get('${baseUrl}/api/system/status')
  .then(response => console.log(response.data))
  .catch(error => console.error(error));
        `
      },
      {
        name: 'Health Check',
        method: 'GET',
        url: '/api/health',
        description: 'Check if the API is operational',
        curlExample: `curl ${baseUrl}/api/health`,
        pythonExample: `
import requests

response = requests.get('${baseUrl}/api/health')
print(response.json())
        `,
        nodeExample: `
const axios = require('axios');

axios.get('${baseUrl}/api/health')
  .then(response => console.log(response.data))
  .catch(error => console.error(error));
        `
      },
      {
        name: 'YouTube Channel Status',
        method: 'GET',
        url: '/api/youtube/status',
        description: 'Get YouTube integration status',
        curlExample: `curl ${baseUrl}/api/youtube/status`,
        pythonExample: `
import requests

response = requests.get('${baseUrl}/api/youtube/status')
print(response.json())
        `,
        nodeExample: `
const axios = require('axios');

axios.get('${baseUrl}/api/youtube/status')
  .then(response => console.log(response.data))
  .catch(error => console.error(error));
        `
      },
      {
        name: 'Process YouTube Channel',
        method: 'POST',
        url: '/api/youtube/process-channel',
        description: 'Process and index a YouTube channel',
        curlExample: `curl -X POST -H "Content-Type: application/json" -d '{"channelId":"channel-id-here"}' ${baseUrl}/api/youtube/process-channel`,
        pythonExample: `
import requests

data = {
    'channelId': 'channel-id-here'
}
response = requests.post('${baseUrl}/api/youtube/process-channel', json=data)
print(response.json())
        `,
        nodeExample: `
const axios = require('axios');

const data = {
  channelId: 'channel-id-here'
};

axios.post('${baseUrl}/api/youtube/process-channel', data)
  .then(response => console.log(response.data))
  .catch(error => console.error(error));
        `
      },
      {
        name: 'Pinecone Stats',
        method: 'GET',
        url: '/api/pinecone-stats',
        description: 'Get Pinecone vector database statistics',
        curlExample: `curl ${baseUrl}/api/pinecone-stats`,
        pythonExample: `
import requests

response = requests.get('${baseUrl}/api/pinecone-stats')
print(response.json())
        `,
        nodeExample: `
const axios = require('axios');

axios.get('${baseUrl}/api/pinecone-stats')
  .then(response => console.log(response.data))
  .catch(error => console.error(error));
        `
      },
      {
        name: 'LangChain Query',
        method: 'POST',
        url: '/api/langchain',
        description: 'Query documents using LangChain',
        curlExample: `curl -X POST -H "Content-Type: application/json" -d '{"query":"your question here","documentId":"optional-document-id"}' ${baseUrl}/api/langchain`,
        pythonExample: `
import requests

data = {
    'query': 'your question here',
    'documentId': 'optional-document-id'  # Optional
}
response = requests.post('${baseUrl}/api/langchain', json=data)
print(response.json())
        `,
        nodeExample: `
const axios = require('axios');

const data = {
  query: 'your question here',
  documentId: 'optional-document-id'  // Optional
};

axios.post('${baseUrl}/api/langchain', data)
  .then(response => console.log(response.data))
  .catch(error => console.error(error));
        `
      },
      {
        name: 'Test OpenAI Connection',
        method: 'GET',
        url: '/api/test/openai',
        description: 'Test OpenAI API connection',
        curlExample: `curl ${baseUrl}/api/test/openai`,
        pythonExample: `
import requests

response = requests.get('${baseUrl}/api/test/openai')
print(response.json())
        `,
        nodeExample: `
const axios = require('axios');

axios.get('${baseUrl}/api/test/openai')
  .then(response => console.log(response.data))
  .catch(error => console.error(error));
        `
      },
      {
        name: 'Test Pinecone Key',
        method: 'GET',
        url: '/api/test/pinecone-key',
        description: 'Test Pinecone API key',
        curlExample: `curl ${baseUrl}/api/test/pinecone-key`,
        pythonExample: `
import requests

response = requests.get('${baseUrl}/api/test/pinecone-key')
print(response.json())
        `,
        nodeExample: `
const axios = require('axios');

axios.get('${baseUrl}/api/test/pinecone-key')
  .then(response => console.log(response.data))
  .catch(error => console.error(error));
        `
      },
      {
        name: 'Test Pinecone Index',
        method: 'GET',
        url: '/api/test/pinecone-index',
        description: 'Test Pinecone index connection',
        curlExample: `curl ${baseUrl}/api/test/pinecone-index`,
        pythonExample: `
import requests

response = requests.get('${baseUrl}/api/test/pinecone-index')
print(response.json())
        `,
        nodeExample: `
const axios = require('axios');

axios.get('${baseUrl}/api/test/pinecone-index')
  .then(response => console.log(response.data))
  .catch(error => console.error(error));
        `
      },
      {
        name: 'Test YouTube API',
        method: 'GET',
        url: '/api/test/youtube',
        description: 'Test YouTube API connection',
        curlExample: `curl ${baseUrl}/api/test/youtube`,
        pythonExample: `
import requests

response = requests.get('${baseUrl}/api/test/youtube')
print(response.json())
        `,
        nodeExample: `
const axios = require('axios');

axios.get('${baseUrl}/api/test/youtube')
  .then(response => console.log(response.data))
  .catch(error => console.error(error));
        `
      }
    ];

    return (
      <Box sx={{ mt: 4, p: 3, bgcolor: 'background.paper', borderRadius: 2 }}>
        <Typography variant="h4" gutterBottom>
          API Integration Guide
        </Typography>
        {endpoints.map((endpoint, index) => (
          <Box key={index} sx={{ mb: 4 }}>
            <Typography variant="h6">{endpoint.name} Endpoint</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {endpoint.description}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mr: 2 }}>
                {endpoint.method}
              </Typography>
              <Typography variant="body2" color="primary">
                {baseUrl}{endpoint.url}
              </Typography>
            </Box>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2">cURL Example:</Typography>
              <pre style={{ 
                backgroundColor: '#f4f4f4', 
                padding: '10px', 
                borderRadius: '4px', 
                overflowX: 'auto' 
              }}>
                {endpoint.curlExample}
              </pre>
            </Box>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2">Python Example:</Typography>
              <pre style={{ 
                backgroundColor: '#f4f4f4', 
                padding: '10px', 
                borderRadius: '4px', 
                overflowX: 'auto' 
              }}>
                {endpoint.pythonExample}
              </pre>
            </Box>
            
            <Box>
              <Typography variant="subtitle2">Node.js Example:</Typography>
              <pre style={{ 
                backgroundColor: '#f4f4f4', 
                padding: '10px', 
                borderRadius: '4px', 
                overflowX: 'auto' 
              }}>
                {endpoint.nodeExample}
              </pre>
            </Box>
          </Box>
        ))}
      </Box>
    );
  };

  if (!isConfigured) {
    return <CircularProgress />;
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ my: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Typography variant="h4" component="h1">
            Document Library
          </Typography>
          <Box>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setShowAPIGuide(!showAPIGuide)}
              sx={{ mr: 2 }}
            >
              API Guide
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<Add />}
              onClick={() => setShowUploadModal(true)}
            >
              Upload Document
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 4 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ mb: 4 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth variant="outlined">
                <InputLabel>Content Type</InputLabel>
                <Select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as 'all' | 'youtube' | 'document')}
                  label="Content Type"
                >
                  <MenuItem value="all">All Types</MenuItem>
                  <MenuItem value="youtube">YouTube Videos</MenuItem>
                  <MenuItem value="document">Documents</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" my={4}>
            <CircularProgress />
          </Box>
        ) : filteredDocuments.length > 0 ? (
          <DocumentList
            documents={filteredDocuments}
            onDelete={handleDelete}
            onChat={handleChat}
            showTechnicalDetails={false}
          />
        ) : (
          <Box textAlign="center" my={4}>
            <Typography variant="h6" color="text.secondary">
              No documents found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Upload a document or video to get started
            </Typography>
          </Box>
        )}
      </Box>

      {showUploadModal && (
        <UploadModal
          open={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onUpload={handleUpload}
        />
      )}

      {showAPIGuide && (
        <APIIntegrationGuide />
      )}
    </Container>
  );
}
