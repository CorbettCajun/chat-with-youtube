import React from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Chip, 
  IconButton, 
  Grid, 
  Box, 
  Tooltip, 
  LinearProgress,
  Skeleton,
  Alert
} from '@mui/material';
import { 
  YouTube, 
  Description, 
  Delete, 
  Chat, 
  Storage, 
  Category as CategoryIcon,
  Error as ErrorIcon 
} from '@mui/icons-material';
import { DocumentMetadata } from '../types/documents';

interface DocumentListProps {
  documents: DocumentMetadata[];
  onDelete?: (id: string) => void;
  onChat?: (id: string) => void;
  showTechnicalDetails?: boolean;
  isLoading?: boolean;
}

const DocumentList: React.FC<DocumentListProps> = ({ 
  documents, 
  onDelete, 
  onChat, 
  showTechnicalDetails = false,
  isLoading = false
}) => {
  const getTypeIcon = (type: DocumentMetadata['type']) => {
    switch (type) {
      case 'youtube':
        return <YouTube color="error" />;
      case 'document':
        return <Description color="primary" />;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const getContentTypeLabel = (contentType?: string) => {
    if (!contentType) return '';
    return contentType.split('/').pop()?.toUpperCase() || contentType;
  };

  if (isLoading) {
    return (
      <Grid container spacing={2}>
        {[...Array(3)].map((_, index) => (
          <Grid item xs={12} sm={6} md={4} key={`skeleton-${index}`}>
            <Card>
              <Skeleton variant="rectangular" height={140} />
              <CardContent>
                <Skeleton variant="text" width="80%" />
                <Skeleton variant="text" width="60%" />
                <Box display="flex" gap={1} mb={2}>
                  <Skeleton variant="rectangular" width={60} height={24} />
                  <Skeleton variant="rectangular" width={60} height={24} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }

  if (!documents.length) {
    return (
      <Box textAlign="center" py={4}>
        <Typography variant="h6" color="text.secondary">
          No documents found
        </Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={2}>
      {documents.map((doc) => (
        <Grid item xs={12} sm={6} md={4} key={doc.id}>
          <Card 
            sx={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column',
              position: 'relative'
            }}
          >
            {doc.type === 'youtube' && doc.thumbnailUrl && (
              <Box
                component="img"
                sx={{
                  width: '100%',
                  height: 140,
                  objectFit: 'cover'
                }}
                src={doc.thumbnailUrl}
                alt=""
                aria-hidden="true"
              />
            )}
            <CardContent sx={{ flexGrow: 1 }}>
              <Box display="flex" alignItems="center" mb={1}>
                {getTypeIcon(doc.type)}
                <Typography 
                  variant="h6" 
                  component="h2" 
                  ml={1} 
                  noWrap
                  title={doc.title}
                >
                  {doc.title}
                </Typography>
              </Box>

              {doc.description && (
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  mb={2}
                  sx={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {doc.description}
                </Typography>
              )}

              <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                <Tooltip title={`Type: ${doc.type.toUpperCase()}`}>
                  <Chip 
                    size="small" 
                    label={doc.type.toUpperCase()} 
                    color={doc.type === 'youtube' ? 'error' : 'primary'} 
                  />
                </Tooltip>
                
                {doc.duration && (
                  <Tooltip title="Duration">
                    <Chip size="small" label={doc.duration} variant="outlined" />
                  </Tooltip>
                )}

                {doc.categories && doc.categories.length > 0 && (
                  <Tooltip title="Categories">
                    <Chip 
                      size="small" 
                      icon={<CategoryIcon sx={{ fontSize: 16 }} />}
                      label={doc.categories[0]} 
                      variant="outlined"
                    />
                  </Tooltip>
                )}

                {showTechnicalDetails && (
                  <>
                    {doc.chunks && (
                      <Tooltip title="Number of text chunks">
                        <Chip 
                          size="small" 
                          icon={<Storage sx={{ fontSize: 16 }} />}
                          label={`${doc.chunks} chunks`} 
                          variant="outlined" 
                        />
                      </Tooltip>
                    )}
                    {doc.contentType && (
                      <Tooltip title="Content Format">
                        <Chip 
                          size="small" 
                          label={getContentTypeLabel(doc.contentType)} 
                          variant="outlined" 
                        />
                      </Tooltip>
                    )}
                  </>
                )}
              </Box>

              {doc.status === 'processing' && (
                <Box mb={2}>
                  <Typography variant="caption" color="text.secondary" component="div">
                    Processing document...
                  </Typography>
                  <LinearProgress sx={{ mt: 1 }} />
                </Box>
              )}

              {doc.status === 'error' && doc.error && (
                <Alert 
                  severity="error" 
                  icon={<ErrorIcon />}
                  sx={{ mb: 2 }}
                >
                  {doc.error}
                </Alert>
              )}

              <Box 
                display="flex" 
                justifyContent="space-between" 
                alignItems="center"
                mt="auto"
              >
                <Tooltip title={`Added on ${formatDate(doc.createdAt)}`}>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(doc.createdAt)}
                  </Typography>
                </Tooltip>
                <Box>
                  {onChat && doc.status === 'completed' && (
                    <Tooltip title="Chat about this document">
                      <IconButton 
                        size="small" 
                        onClick={() => onChat(doc.id)}
                        aria-label="Chat about document"
                      >
                        <Chat />
                      </IconButton>
                    </Tooltip>
                  )}
                  {onDelete && (
                    <Tooltip title="Delete document">
                      <IconButton 
                        size="small" 
                        onClick={() => onDelete(doc.id)}
                        color="error"
                        aria-label="Delete document"
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default DocumentList;
