import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFile, 
  faFileAlt, 
  faFileCode, 
  faChevronDown, 
  faChevronUp, 
  faDownload, 
  faCopy, 
  faCheck
} from '@fortawesome/free-solid-svg-icons';
import { saveAs } from 'file-saver';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Component to display file attachments in messages
export const FileAttachments = ({ files }) => {
  if (!files || files.length === 0) return null;
  
  return (
    <div className="file-attachments">
      <div className="file-attachments-header">
        <h4>Attached Files</h4>
        <span>{files.length} file(s)</span>
      </div>
      <div className="file-attachments-list">
        {files.map(file => (
          <DocumentViewer key={file.id} file={file} />
        ))}
      </div>
    </div>
  );
};

// Component to display and interact with a single document
const DocumentViewer = ({ file }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Get file icon based on file type/extension
  const getFileIcon = (fileName) => {
    if (fileName.endsWith('.js') || fileName.endsWith('.jsx') || 
        fileName.endsWith('.ts') || fileName.endsWith('.tsx')) {
      return faFileCode;
    } else if (fileName.endsWith('.md') || fileName.endsWith('.txt')) {
      return faFileAlt;
    } else {
      return faFile;
    }
  };
  
  // Format file size for display
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };
  
  // Get language for syntax highlighting
  const getLanguage = (fileName) => {
    if (fileName.endsWith('.js')) return 'javascript';
    if (fileName.endsWith('.jsx')) return 'jsx';
    if (fileName.endsWith('.ts')) return 'typescript';
    if (fileName.endsWith('.tsx')) return 'tsx';
    if (fileName.endsWith('.html')) return 'html';
    if (fileName.endsWith('.css')) return 'css';
    if (fileName.endsWith('.json')) return 'json';
    if (fileName.endsWith('.md')) return 'markdown';
    if (fileName.endsWith('.py')) return 'python';
    return 'text';
  };
  
  // Download file
  const downloadFile = () => {
    const blob = new Blob([file.content], { type: file.type || 'text/plain' });
    saveAs(blob, file.name);
  };
  
  // Copy file content to clipboard
  const copyContent = () => {
    navigator.clipboard.writeText(file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="document-viewer">
      <div 
        className="document-header" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="document-icon">
          <FontAwesomeIcon icon={getFileIcon(file.name)} />
        </div>
        <div className="document-info">
          <div className="document-name">{file.name}</div>
          <div className="document-meta">
            {formatFileSize(file.size)} • {new Date(file.uploadedAt).toLocaleString()}
          </div>
        </div>
        <div className="document-actions">
          <button 
            className="document-action-button"
            onClick={(e) => {
              e.stopPropagation();
              downloadFile();
            }}
            title="Download file"
          >
            <FontAwesomeIcon icon={faDownload} />
          </button>
          <button 
            className="document-action-button"
            onClick={(e) => {
              e.stopPropagation();
              copyContent();
            }}
            title={copied ? "Copied!" : "Copy content"}
          >
            <FontAwesomeIcon icon={copied ? faCheck : faCopy} />
          </button>
          <button className="document-expand-button" title={isExpanded ? "Collapse" : "Expand"}>
            <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} />
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="document-content">
          <SyntaxHighlighter
            language={getLanguage(file.name)}
            style={oneDark}
            customStyle={{ margin: 0, borderRadius: 0 }}
          >
            {file.content}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
};
