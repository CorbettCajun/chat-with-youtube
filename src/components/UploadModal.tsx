import React, { useState, ChangeEvent } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Tabs, Tab, Box } from '@mui/material';
import { CloudUpload, Link as LinkIcon, TextFields } from '@mui/icons-material';
import { toast } from 'react-toastify';

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onUpload: (data: { type: 'file' | 'url' | 'text', content: string, title?: string }) => Promise<void>;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`upload-tabpanel-${index}`}
      aria-labelledby={`upload-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function UploadModal({ open, onClose, onUpload }: UploadModalProps) {
  const [tabValue, setTabValue] = useState(0);
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    try {
      setUploading(true);

      switch (tabValue) {
        case 0: // File upload
          if (!file) {
            toast.error('Please select a file to upload');
            return;
          }
          const fileContent = await file.text();
          await onUpload({ type: 'file', content: fileContent, title: file.name });
          break;

        case 1: // URL input
          if (!url) {
            toast.error('Please enter a YouTube URL');
            return;
          }
          await onUpload({ type: 'url', content: url });
          break;

        case 2: // Text input
          if (!text) {
            toast.error('Please enter some text');
            return;
          }
          if (!textTitle) {
            toast.error('Please enter a title for your text');
            return;
          }
          await onUpload({ type: 'text', content: text, title: textTitle });
          break;
      }

      // Reset form
      setUrl('');
      setText('');
      setTextTitle('');
      setFile(null);
      onClose();
      toast.success('Content uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload content. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upload Content</DialogTitle>
      <DialogContent>
        <Tabs value={tabValue} onChange={handleTabChange} centered>
          <Tab icon={<CloudUpload />} label="File" />
          <Tab icon={<LinkIcon />} label="URL" />
          <Tab icon={<TextFields />} label="Text" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <input
            accept=".txt,.pdf,.doc,.docx"
            style={{ display: 'none' }}
            id="file-upload"
            type="file"
            onChange={handleFileChange}
          />
          <label htmlFor="file-upload">
            <Button variant="outlined" component="span" fullWidth>
              {file ? file.name : 'Choose File'}
            </Button>
          </label>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <TextField
            autoFocus
            margin="dense"
            label="YouTube URL"
            type="text"
            fullWidth
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <TextField
            margin="dense"
            label="Title"
            type="text"
            fullWidth
            value={textTitle}
            onChange={(e) => setTextTitle(e.target.value)}
            placeholder="Enter a title for your text"
          />
          <TextField
            margin="dense"
            label="Text Content"
            multiline
            rows={4}
            fullWidth
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter or paste your text here..."
          />
        </TabPanel>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={uploading}>
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          color="primary"
          disabled={uploading}
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
