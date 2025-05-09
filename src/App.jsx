import React, { useState, useEffect, useRef } from 'react';
import OpenAI from 'openai';
import ReactMarkdown from 'react-markdown';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faRobot, 
  faCode, 
  faPen, 
  faGraduationCap, 
  faBars, 
  faPlus, 
  faPaperPlane, 
  faTrash, 
  faTimes,
  faEdit,
  faSave,
  faUserPlus,
  faCheck,
  faExclamationTriangle,
  faFileUpload,
  faFile,
  faFileAlt,
  faFileCode,
  faTimes as faTimesCircle,
  faHourglass,
  faStop,
  faDownload,
  faEye,
  faFileWord,
  faFilePdf,
  faFileExport,
  faEllipsisV
} from '@fortawesome/free-solid-svg-icons';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { CodeBlock } from './codeblock';
import { FileAttachments } from './documentviewer';
import './App.css';
import { LinkRenderer } from './linkrenderer';

// Initialize OpenAI client with the API key
// Note: Using the API key client-side is for demonstration only.
// In production, use a backend server to handle API calls securely.
const openai = new OpenAI({
  baseURL: 'https://sociallyshaped.net/v1',
  apiKey: 'anything',
  dangerouslyAllowBrowser: true,
});

// Default agents as a starting point
const defaultAgents = {
  default: {
    name: "General Assistant",
    systemPrompt: "You are a helpful assistant.",
    avatar: "faRobot",
    isDefault: true
  },
  coder: {
    name: "Code Expert",
    systemPrompt: "You are an expert programmer. Provide detailed code examples and explanations when asked about programming topics.",
    avatar: "faCode",
    isDefault: true
  },
  creative: {
    name: "Creative Writer",
    systemPrompt: "You are a creative writing assistant. Help with storytelling, poetry, and creative content.",
    avatar: "faPen",
    isDefault: true
  },
  teacher: {
    name: "Educational Tutor",
    systemPrompt: "You are an educational tutor. Explain concepts clearly and provide examples to help with learning.",
    avatar: "faGraduationCap",
    isDefault: true
  }
};

// Loading state messages that will cycle
const loadingStates = ["Thinking", "Reasoning", "Gathering data", "Responding"];

// Map of available icons for custom agents
const availableIcons = {
  faRobot,
  faCode,
  faPen,
  faGraduationCap,
  faUserPlus,
  faEdit
};

// Maximum file size in bytes (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed file types
const ALLOWED_FILE_TYPES = [
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'text/css',
  'text/javascript',
  'application/json',
  'application/xml',
  'application/javascript'
];

function App() {
  // State for agents (loaded from localStorage)
  const [agents, setAgents] = useState({});
  
  // State for chat history management
  const [chatHistory, setChatHistory] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  
  // State for agent selection and management
  const [currentAgent, setCurrentAgent] = useState('default');
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [newAgentData, setNewAgentData] = useState({
    id: '',
    name: '',
    systemPrompt: '',
    avatar: 'faRobot'
  });
  const [agentError, setAgentError] = useState('');
  
  // State variables for chat functionality
  const [messages, setMessages] = useState([
    { role: "system", content: "" },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadingStateIndex, setLoadingStateIndex] = useState(0);
  const messageListRef = useRef(null);
  const [showSidebar, setShowSidebar] = useState(false); // Default to hiding sidebar on all screens
  const loadingIntervalRef = useRef(null);
  const textareaRef = useRef(null);
  
  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [fileError, setFileError] = useState("");
  const fileInputRef = useRef(null);

  // Input queue for pre-connection questions
  const [inputQueue, setInputQueue] = useState([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [isConnected, setIsConnected] = useState(true); // Assume connected initially

  // Auto-scroll control
  const [autoScroll, setAutoScroll] = useState(true);
  const lastScrollPositionRef = useRef(0);
  const isUserScrollingRef = useRef(false);

  // Stream controller for stopping generation
  const [abortController, setAbortController] = useState(null);
  const [isStopping, setIsStopping] = useState(false);

  // Export chat state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportChatId, setExportChatId] = useState(null);
  const [exportFormat, setExportFormat] = useState('text');
  const [exportPreview, setExportPreview] = useState('');
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  // Message export state
  const [showMessageExportModal, setShowMessageExportModal] = useState(false);
  const [exportMessageIndex, setExportMessageIndex] = useState(null);
  const [messageExportFormat, setMessageExportFormat] = useState('text');
  const [messageExportPreview, setMessageExportPreview] = useState('');
  const [isGeneratingMessagePreview, setIsGeneratingMessagePreview] = useState(false);
  const [showMessageMenu, setShowMessageMenu] = useState(null);

  // Check if screen is mobile size
  const [isMobile, setIsMobile] = useState(false);
  
  // Remember sidebar state (but now we'll use it differently)
  const [sidebarPreference, setSidebarPreference] = useState(() => {
    const savedPreference = localStorage.getItem('sidebarPreference');
    return savedPreference ? JSON.parse(savedPreference) : false; // Default to hiding sidebar
  });

  // Load agents from localStorage on initial render
  useEffect(() => {
    const savedAgents = localStorage.getItem('chatAgents');
    if (savedAgents) {
      setAgents(JSON.parse(savedAgents));
    } else {
      // Initialize with default agents if none exist
      setAgents(defaultAgents);
      localStorage.setItem('chatAgents', JSON.stringify(defaultAgents));
    }
  }, []);

  // Load chat history from localStorage on initial render
  useEffect(() => {
    const savedHistory = localStorage.getItem('chatHistory');
    if (savedHistory) {
      setChatHistory(JSON.parse(savedHistory));
    }
  }, []);

  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    if (chatHistory.length > 0) {
      localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
    }
  }, [chatHistory]);

  // Save agents to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(agents).length > 0) {
      localStorage.setItem('chatAgents', JSON.stringify(agents));
    }
  }, [agents]);

  // Save sidebar preference to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarPreference', JSON.stringify(sidebarPreference));
  }, [sidebarPreference]);

  // Load specific chat when currentChatId changes
  useEffect(() => {
    if (currentChatId) {
      const chat = chatHistory.find(chat => chat.id === currentChatId);
      if (chat) {
        setMessages(chat.messages);
        setCurrentAgent(chat.agent || 'default');
        // Load uploaded files if they exist
        setUploadedFiles(chat.uploadedFiles || []);
      }
    }
  }, [currentChatId, chatHistory]);

  // Update system message when current agent changes
  useEffect(() => {
    if (agents[currentAgent]) {
      setMessages(prev => {
        const systemMessage = { role: "system", content: agents[currentAgent].systemPrompt };
        if (prev.length > 0 && prev[0].role === "system") {
          return [systemMessage, ...prev.slice(1)];
        }
        return [systemMessage, ...prev];
      });
    }
  }, [currentAgent, agents]);

  // Handle scrolling behavior during streaming
  useEffect(() => {
    const handleScroll = () => {
      if (!messageListRef.current) return;
      
      const { scrollTop, scrollHeight, clientHeight } = messageListRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      
      // Update auto-scroll based on user scroll position
      if (isStreaming) {
        if (isAtBottom) {
          setAutoScroll(true);
        } else if (!isUserScrollingRef.current) {
          // Only disable auto-scroll if this is a user-initiated scroll
          isUserScrollingRef.current = true;
          setAutoScroll(false);
          
          // Save the current scroll position
          lastScrollPositionRef.current = scrollTop;
        }
      } else {
        // Reset user scrolling flag when not streaming
        isUserScrollingRef.current = false;
      }
    };

    const messageList = messageListRef.current;
    if (messageList) {
      messageList.addEventListener('scroll', handleScroll);
    }

    return () => {
      if (messageList) {
        messageList.removeEventListener('scroll', handleScroll);
      }
    };
  }, [isStreaming]);

  // Auto-scroll to bottom when new messages are added if autoScroll is true
  useEffect(() => {
    if (messageListRef.current && autoScroll) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    } else if (messageListRef.current && isUserScrollingRef.current) {
      // Maintain the user's scroll position during streaming
      messageListRef.current.scrollTop = lastScrollPositionRef.current;
    }
  }, [messages, autoScroll]);

  // Auto-resize textarea height based on content
  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to auto to get the correct scrollHeight
      textareaRef.current.style.height = 'auto';
      
      // Set the height to the scrollHeight to fit the content
      const scrollHeight = textareaRef.current.scrollHeight;
      
      // Limit the height to 3 lines (approximately 72px)
      const maxHeight = 72;
      
      textareaRef.current.style.height = 
        scrollHeight > maxHeight ? `${maxHeight}px` : `${scrollHeight}px`;
    }
  }, [inputValue]);

  // Cycle through loading states when isStreaming is true
  useEffect(() => {
    if (isStreaming) {
      // Clear any existing interval
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
      }
      
      // Set up new interval to cycle through loading states
      loadingIntervalRef.current = setInterval(() => {
        setLoadingStateIndex(prev => (prev + 1) % loadingStates.length);
      }, 800); // Change state every 800ms
    } else {
      // Clear interval when not streaming
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
        loadingIntervalRef.current = null;
      }
      // Reset loading state index
      setLoadingStateIndex(0);
    }
    
    // Clean up interval on component unmount
    return () => {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
      }
    };
  }, [isStreaming]);

  // Process input queue when connection is established or queue changes
  useEffect(() => {
    const processQueue = async () => {
      if (inputQueue.length > 0 && isConnected && !isProcessingQueue && !isStreaming) {
        setIsProcessingQueue(true);
        
        // Get the first item from the queue
        const nextInput = inputQueue[0];
        
        // Remove the first item from the queue
        setInputQueue(prev => prev.slice(1));
        
        // Process the input
        await handleSubmitInternal(nextInput);
        
        setIsProcessingQueue(false);
      }
    };
    
    processQueue();
  }, [inputQueue, isConnected, isProcessingQueue, isStreaming]);

  // Simulate connection check (in a real app, this would check the actual API connection)
  useEffect(() => {
    const checkConnection = async () => {
      try {
        // This is a simplified connection check
        // In a real app, you would make a lightweight API call to check connection
        setIsConnected(true);
      } catch (error) {
        setIsConnected(false);
        console.error("Connection check failed:", error);
      }
    };
    
    // Check connection initially and then every 30 seconds
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Clean up abort controller when component unmounts
  useEffect(() => {
    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [abortController]);

  // Generate export preview when format changes
  useEffect(() => {
    if (showExportModal && exportChatId) {
      generateExportPreview(exportChatId, exportFormat);
    }
  }, [exportFormat, exportChatId, showExportModal]);

  // Generate message export preview when format changes
  useEffect(() => {
    if (showMessageExportModal && exportMessageIndex !== null) {
      generateMessageExportPreview(exportMessageIndex, messageExportFormat);
    }
  }, [messageExportFormat, exportMessageIndex, showMessageExportModal]);

  // Close message menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMessageMenu !== null && !event.target.closest('.message-menu') && 
          !event.target.closest('.message-actions-button')) {
        setShowMessageMenu(null);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showMessageMenu]);

  // Check if screen is mobile size
  useEffect(() => {
    const checkMobileSize = () => {
      const isMobileView = window.innerWidth <= 768;
      setIsMobile(isMobileView);
    };
    
    // Check on initial load
    checkMobileSize();
    
    // Add event listener for window resize
    window.addEventListener('resize', checkMobileSize);
    
    // Clean up
    return () => {
      window.removeEventListener('resize', checkMobileSize);
    };
  }, []);

  // Handle stopping text generation
  const handleStopGeneration = () => {
    if (abortController) {
      setIsStopping(true);
      abortController.abort();
      
      // Add a small delay to allow the abort to process
      setTimeout(() => {
        setIsStreaming(false);
        setIsStopping(false);
        setAbortController(null);
        
        // Update the last message to indicate it was stopped
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg.role === "assistant" && lastMsg.isStreaming) {
            const updatedMsg = { 
              ...lastMsg, 
              isStreaming: false,
              wasStopped: true
            };
            return [...prev.slice(0, -1), updatedMsg];
          }
          return prev;
        });
        
        // Update chat history
        if (currentChatId) {
          setChatHistory(prev => prev.map(chat => {
            if (chat.id === currentChatId) {
              const updatedChatMessages = [...chat.messages];
              const lastMsgIndex = updatedChatMessages.length - 1;
              if (lastMsgIndex >= 0 && 
                  updatedChatMessages[lastMsgIndex].role === "assistant" && 
                  updatedChatMessages[lastMsgIndex].isStreaming) {
                updatedChatMessages[lastMsgIndex] = {
                  ...updatedChatMessages[lastMsgIndex],
                  isStreaming: false,
                  wasStopped: true
                };
              }
              return { ...chat, messages: updatedChatMessages };
            }
            return chat;
          }));
        }
      }, 100);
    }
  };

  // Generate an introduction message from the agent with streaming
  const generateIntroduction = async (agentType, chatId) => {
    if (!agents[agentType]) return;
    
    setIsStreaming(true);
    
    const systemPrompt = agents[agentType].systemPrompt;
    const introPrompt = `You are ${agents[agentType].name}. ${systemPrompt} Introduce yourself in ONE very short sentence (max 15 words). Be concise and friendly.`;
    
    // Add empty assistant message with loading state
    const initialMessages = [
      { role: "system", content: systemPrompt },
      { role: "assistant", content: "", isStreaming: true }
    ];
    
    setMessages(initialMessages);
    
    // Update chat history with initial empty message
    setChatHistory(prev => prev.map(chat => {
      if (chat.id === chatId) {
        return { ...chat, messages: initialMessages };
      }
      return chat;
    }));
    
    try {
      // Create a new AbortController for this stream
      const controller = new AbortController();
      setAbortController(controller);
      
      const stream = await openai.chat.completions.create({
        model: "meta-llama/Llama-3.3-70B-Instruct",
        messages: [{ role: "system", content: introPrompt }],
        max_tokens: 50,
        stream: true,
      }, { signal: controller.signal });
      
      let introMessage = "";
      
      for await (const event of stream) {
        const chunk = event.choices[0]?.delta?.content || "";
        introMessage += chunk;
        
        // Update messages state with streaming content
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          const updatedMsg = {
            ...lastMsg,
            content: introMessage,
          };
          return [...prev.slice(0, -1), updatedMsg];
        });
        
        // Update chat history with streaming content
        setChatHistory(prev => prev.map(chat => {
          if (chat.id === chatId) {
            const updatedChatMessages = [...chat.messages];
            updatedChatMessages[updatedChatMessages.length - 1] = {
              ...updatedChatMessages[updatedChatMessages.length - 1],
              content: introMessage
            };
            return { ...chat, messages: updatedChatMessages };
          }
          return chat;
        }));
        
        if (event.choices[0]?.finish_reason) {
          // Stream ended
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            const updatedMsg = { ...lastMsg, isStreaming: false };
            return [...prev.slice(0, -1), updatedMsg];
          });
          
          // Update chat history with final response
          setChatHistory(prev => prev.map(chat => {
            if (chat.id === chatId) {
              const updatedChatMessages = [...chat.messages];
              updatedChatMessages[updatedChatMessages.length - 1] = {
                ...updatedChatMessages[updatedChatMessages.length - 1],
                isStreaming: false
              };
              return { ...chat, messages: updatedChatMessages };
            }
            return chat;
          }));
        }
      }
    } catch (error) {
      // Check if this is an abort error (user clicked stop)
      if (error.name === 'AbortError') {
        console.log('Introduction generation was stopped by the user');
      } else {
        console.error("Error streaming introduction:", error);
        
        // Fallback introduction if API call fails
        const fallbackIntro = `Hi! I'm ${agents[agentType].name}.`;
        
        // Update messages state with fallback
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          const updatedMsg = {
            ...lastMsg,
            content: fallbackIntro,
            isStreaming: false,
          };
          return [...prev.slice(0, -1), updatedMsg];
        });
        
        // Update chat history with fallback
        setChatHistory(prev => prev.map(chat => {
          if (chat.id === chatId) {
            const updatedChatMessages = [...chat.messages];
            updatedChatMessages[updatedChatMessages.length - 1] = {
              ...updatedChatMessages[updatedChatMessages.length - 1],
              content: fallbackIntro,
              isStreaming: false
            };
            return { ...chat, messages: updatedChatMessages };
          }
          return chat;
        }));
      }
    } finally {
      setIsStreaming(false);
      setAbortController(null);
    }
  };

  // Create a new chat
  const createNewChat = async (agentType = 'default') => {
    if (!agents[agentType]) {
      agentType = 'default';
    }
    
    const newChatId = Date.now().toString();
    const newChat = {
      id: newChatId,
      title: `New Chat (${agents[agentType].name})`,
      agent: agentType,
      messages: [{ role: "system", content: agents[agentType].systemPrompt }],
      uploadedFiles: [],
      createdAt: new Date().toISOString()
    };
    
    setChatHistory(prev => [newChat, ...prev]);
    setCurrentChatId(newChatId);
    setMessages(newChat.messages);
    setCurrentAgent(agentType);
    
    // Auto-hide sidebar on all screens
    setShowSidebar(false);
    
    setUploadedFiles([]);
    
    // Generate introduction after creating the chat
    await generateIntroduction(agentType, newChatId);
  };

  // Update chat title based on first user message
  const updateChatTitle = (chatId, userMessage) => {
    setChatHistory(prev => prev.map(chat => {
      if (chat.id === chatId) {
        // Use first 30 characters of user message as title
        const newTitle = userMessage.length > 30 
          ? userMessage.substring(0, 30) + '...' 
          : userMessage;
        return { ...chat, title: newTitle };
      }
      return chat;
    }));
  };

  // Delete a chat from history
  const deleteChat = (chatId, e) => {
    e.stopPropagation();
    setChatHistory(prev => prev.filter(chat => chat.id !== chatId));
    if (currentChatId === chatId) {
      createNewChat();
    }
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    setFileError("");
    const files = Array.from(e.target.files);
    
    if (files.length === 0) return;
    
    // Process each file
    const filePromises = files.map(file => {
      return new Promise((resolve, reject) => {
        // Check file size
        if (file.size > MAX_FILE_SIZE) {
          reject(`File ${file.name} exceeds the maximum size limit of 5MB`);
          return;
        }
        
        // Check file type
        if (!ALLOWED_FILE_TYPES.includes(file.type) && 
            !file.name.endsWith('.js') && 
            !file.name.endsWith('.py') && 
            !file.name.endsWith('.jsx') && 
            !file.name.endsWith('.ts') && 
            !file.name.endsWith('.tsx') && 
            !file.name.endsWith('.md') && 
            !file.name.endsWith('.txt')) {
          reject(`File ${file.name} is not a supported text file type`);
          return;
        }
        
        // Read file content
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve({
            id: Date.now() + Math.random().toString(36).substring(2, 9),
            name: file.name,
            type: file.type,
            size: file.size,
            content: event.target.result,
            uploadedAt: new Date().toISOString()
          });
        };
        reader.onerror = () => reject(`Error reading file ${file.name}`);
        reader.readAsText(file);
      });
    });
    
    // Process all files
    Promise.allSettled(filePromises)
      .then(results => {
        const successfulUploads = results
          .filter(result => result.status === 'fulfilled')
          .map(result => result.value);
        
        const errors = results
          .filter(result => result.status === 'rejected')
          .map(result => result.reason);
        
        if (errors.length > 0) {
          setFileError(errors.join('. '));
        }
        
        if (successfulUploads.length > 0) {
          const newFiles = [...uploadedFiles, ...successfulUploads];
          setUploadedFiles(newFiles);
          
          // Update chat history with uploaded files
          if (currentChatId) {
            setChatHistory(prev => prev.map(chat => {
              if (chat.id === currentChatId) {
                return { ...chat, uploadedFiles: newFiles };
              }
              return chat;
            }));
          }
        }
      });
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove an uploaded file
  const removeFile = (fileId) => {
    const updatedFiles = uploadedFiles.filter(file => file.id !== fileId);
    setUploadedFiles(updatedFiles);
    
    // Update chat history
    if (currentChatId) {
      setChatHistory(prev => prev.map(chat => {
        if (chat.id === currentChatId) {
          return { ...chat, uploadedFiles: updatedFiles };
        }
        return chat;
      }));
    }
  };

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

  // Prepare file content for inclusion in the prompt
  const prepareFileContentForPrompt = () => {
    if (uploadedFiles.length === 0) return '';
    
    let fileContent = '\n\nUPLOADED FILES:\n\n';
    
    uploadedFiles.forEach((file, index) => {
      fileContent += `FILE ${index + 1}: ${file.name}\n`;
      fileContent += '```\n';
      
      // Truncate very large files to prevent token limit issues
      const maxContentLength = 10000; // Approximately 2500 tokens
      let truncatedContent = file.content;
      if (file.content.length > maxContentLength) {
        truncatedContent = file.content.substring(0, maxContentLength) + 
          '\n... [Content truncated due to length] ...\n';
      }
      
      fileContent += truncatedContent;
      fileContent += '\n```\n\n';
    });
    
    fileContent += 'Please use the content of these files to inform your response.\n';
    
    return fileContent;
  };

  // Internal function to handle message submission
  const handleSubmitInternal = async (userMessageContent) => {
    // Create a new chat if none exists
    if (!currentChatId) {
      await createNewChat(currentAgent);
      // Queue the message for after chat creation
      setInputQueue(prev => [...prev, userMessageContent]);
      return;
    }
    
    // Prepare user message with file content if files are uploaded
    const fileContent = prepareFileContentForPrompt();
    
    // If there's no input but files are uploaded, create a default message
    if (!userMessageContent && uploadedFiles.length > 0) {
      userMessageContent = "I've uploaded some files. Please analyze them.";
    }
    
    // Append file content to user message if files are uploaded
    let fullUserMessageContent = userMessageContent;
    if (fileContent) {
      fullUserMessageContent += fileContent;
    }
    
    // Create user message with files attached
    const userMessage = { 
      role: "user", 
      content: fullUserMessageContent,
      // Store the original message without file content for display
      displayContent: userMessageContent,
      // Store attached files for document viewer
      attachedFiles: uploadedFiles.length > 0 ? [...uploadedFiles] : null
    };
    
    // Update messages state
    const updatedMessages = [
      ...messages,
      userMessage,
      { role: "assistant", content: "", isStreaming: true },
    ];
    
    setMessages(updatedMessages);
    
    // Update chat history
    setChatHistory(prev => prev.map(chat => {
      if (chat.id === currentChatId) {
        // Update chat title if this is the first user message
        if (chat.messages.filter(msg => msg.role === "user").length === 0) {
          updateChatTitle(currentChatId, userMessageContent || "File analysis");
        }
        return { ...chat, messages: updatedMessages };
      }
      return chat;
    }));
    
    setIsStreaming(true);
    // Reset auto-scroll when starting a new response
    setAutoScroll(true);

    try {
      // Create a new AbortController for this stream
      const controller = new AbortController();
      setAbortController(controller);
      
      const stream = await openai.chat.completions.create({
        model: "meta-llama/Llama-3.3-70B-Instruct",
        messages: updatedMessages
          .filter(msg => !msg.isStreaming) // Exclude the empty assistant message
          .map(msg => ({
            role: msg.role,
            content: msg.content // Use the full content with file content for the API
          })),
        stream: true,
      }, { signal: controller.signal });

      let fullResponse = "";
      
      for await (const event of stream) {
        const chunk = event.choices[0]?.delta?.content || "";
        fullResponse += chunk;
        
        // Update messages state
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          const updatedMsg = {
            ...lastMsg,
            content: fullResponse,
          };
          return [...prev.slice(0, -1), updatedMsg];
        });
        
        // Update chat history
        setChatHistory(prev => prev.map(chat => {
          if (chat.id === currentChatId) {
            const updatedChatMessages = [...chat.messages];
            updatedChatMessages[updatedChatMessages.length - 1] = {
              ...updatedChatMessages[updatedChatMessages.length - 1],
              content: fullResponse
            };
            return { ...chat, messages: updatedChatMessages };
          }
          return chat;
        }));
        
        if (event.choices[0]?.finish_reason) {
          // Stream ended
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            const updatedMsg = { ...lastMsg, isStreaming: false };
            return [...prev.slice(0, -1), updatedMsg];
          });
          
          // Update chat history with final response
          setChatHistory(prev => prev.map(chat => {
            if (chat.id === currentChatId) {
              const updatedChatMessages = [...chat.messages];
              updatedChatMessages[updatedChatMessages.length - 1] = {
                ...updatedChatMessages[updatedChatMessages.length - 1],
                isStreaming: false
              };
              return { ...chat, messages: updatedChatMessages };
            }
            return chat;
          }));
        }
      }
    } catch (error) {
      // Check if this is an abort error (user clicked stop)
      if (error.name === 'AbortError') {
        console.log('Generation was stopped by the user');
        // The state updates are handled in the handleStopGeneration function
      } else {
        console.error("Error streaming from OpenAI API:", error);
        const errorMessage = "Error: Unable to generate response. Please try again.";
        
        // Update messages state with error
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          const updatedMsg = {
            ...lastMsg,
            content: errorMessage,
            isStreaming: false,
          };
          return [...prev.slice(0, -1), updatedMsg];
        });
        
        // Update chat history with error
        setChatHistory(prev => prev.map(chat => {
          if (chat.id === currentChatId) {
            const updatedChatMessages = [...chat.messages];
            updatedChatMessages[updatedChatMessages.length - 1] = {
              ...updatedChatMessages[updatedChatMessages.length - 1],
              content: errorMessage,
              isStreaming: false
            };
            return { ...chat, messages: updatedChatMessages };
          }
          return chat;
        }));
      }
    } finally {
      setIsStreaming(false);
      setAbortController(null);
    }
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    if ((!inputValue.trim() && uploadedFiles.length === 0) || isStreaming) return;
    
    const userInput = inputValue.trim();
    setInputValue("");
    
    // If not connected or already streaming, add to queue
    if (!isConnected || isStreaming || isProcessingQueue) {
      setInputQueue(prev => [...prev, userInput]);
      
      // Add a temporary message to show the queued message
      const tempUserMessage = { 
        role: "user", 
        content: userInput,
        displayContent: userInput,
        isQueued: true,
        attachedFiles: uploadedFiles.length > 0 ? [...uploadedFiles] : null
      };
      
      setMessages(prev => [...prev, tempUserMessage]);
      
      // Update chat history with queued message
      if (currentChatId) {
        setChatHistory(prev => prev.map(chat => {
          if (chat.id === currentChatId) {
            return { 
              ...chat, 
              messages: [...chat.messages, tempUserMessage]
            };
          }
          return chat;
        }));
      }
    } else {
      // Process immediately if connected and not streaming
      handleSubmitInternal(userInput);
    }
  };

  // Handle key press in textarea
  const handleKeyPress = (e) => {
    // Submit on Enter (without Shift key)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Switch agent type
  const switchAgent = (agentType) => {
    if (currentAgent !== agentType && agents[agentType]) {
      setCurrentAgent(agentType);
      createNewChat(agentType);
    }
  };

  // Open agent modal for creating a new agent
  const openCreateAgentModal = () => {
    setEditingAgent(null);
    setNewAgentData({
      id: `custom_${Date.now()}`,
      name: '',
      systemPrompt: '',
      avatar: 'faRobot'
    });
    setAgentError('');
    setShowAgentModal(true);
  };

  // Open agent modal for editing an existing agent
  const openEditAgentModal = (agentId, e) => {
    e.stopPropagation();
    
    if (agents[agentId]) {
      setEditingAgent(agentId);
      setNewAgentData({
        id: agentId,
        name: agents[agentId].name,
        systemPrompt: agents[agentId].systemPrompt,
        avatar: agents[agentId].avatar
      });
      setAgentError('');
      setShowAgentModal(true);
    }
  };

  // Save a new or edited agent
  const saveAgent = () => {
    // Validate inputs
    if (!newAgentData.name.trim()) {
      setAgentError('Agent name is required');
      return;
    }
    
    if (!newAgentData.systemPrompt.trim()) {
      setAgentError('System prompt is required');
      return;
    }
    
    const agentId = editingAgent || newAgentData.id;
    
    // Update agents state
    setAgents(prev => ({
      ...prev,
      [agentId]: {
        name: newAgentData.name,
        systemPrompt: newAgentData.systemPrompt,
        avatar: newAgentData.avatar,
        isDefault: prev[agentId]?.isDefault || false
      }
    }));
    
    // Close modal and reset state
    setShowAgentModal(false);
    setEditingAgent(null);
    setNewAgentData({
      id: '',
      name: '',
      systemPrompt: '',
      avatar: 'faRobot'
    });
    setAgentError('');
  };

  // Delete a custom agent
  const deleteAgent = (agentId, e) => {
    e.stopPropagation();
    
    // Don't allow deleting default agents
    if (agents[agentId]?.isDefault) {
      return;
    }
    
    // Create a copy of agents without the deleted one
    const updatedAgents = { ...agents };
    delete updatedAgents[agentId];
    
    // Update agents state
    setAgents(updatedAgents);
    
    // If the current agent is being deleted, switch to default
    if (currentAgent === agentId) {
      switchAgent('default');
    }
  };

  // Render the icon for an agent
  const renderAgentIcon = (iconName) => {
    const IconComponent = availableIcons[iconName] || faRobot;
    return <FontAwesomeIcon icon={IconComponent} />;
  };

  // Open export modal for a chat
  const openExportModal = (chatId, e) => {
    if (e) e.stopPropagation();
    
    setExportChatId(chatId);
    setExportFormat('text');
    setShowExportModal(true);
    
    // Generate initial preview
    generateExportPreview(chatId, 'text');
  };

  // Open export modal for a single message
  const openMessageExportModal = (messageIndex) => {
    setExportMessageIndex(messageIndex);
    setMessageExportFormat('text');
    setShowMessageExportModal(true);
    setShowMessageMenu(null);
    
    // Generate initial preview
    generateMessageExportPreview(messageIndex, 'text');
  };

  // Toggle message menu
  const toggleMessageMenu = (index, e) => {
    e.stopPropagation();
    if (showMessageMenu === index) {
      setShowMessageMenu(null);
    } else {
      setShowMessageMenu(index);
    }
  };

  // Generate preview for export
  const generateExportPreview = async (chatId, format) => {
    setIsGeneratingPreview(true);
    
    const chat = chatHistory.find(c => c.id === chatId);
    if (!chat) {
      setExportPreview('Chat not found');
      setIsGeneratingPreview(false);
      return;
    }
    
    const agentName = agents[chat.agent]?.name || 'Assistant';
    
    try {
      if (format === 'text') {
        // Generate text preview
        let textContent = `# ${chat.title}\n`;
        textContent += `Date: ${new Date(chat.createdAt).toLocaleString()}\n`;
        textContent += `Agent: ${agentName}\n\n`;
        
        // Add messages
        chat.messages.forEach(msg => {
          if (msg.role === 'system') return; // Skip system messages
          
          const sender = msg.role === 'user' ? 'You' : agentName;
          
          // For user messages, use displayContent if available
          let content = msg.role === 'user' && msg.displayContent 
            ? msg.displayContent 
            : msg.content;
            
          textContent += `## ${sender}:\n${content}\n\n`;
        });
        
        setExportPreview(textContent);
      } else if (format === 'word') {
        // Generate Word preview (simplified for preview)
        let wordPreview = `# ${chat.title} (Word Document Preview)\n\n`;
        wordPreview += `This is a preview of how the Word document will look.\n`;
        wordPreview += `The actual Word document will have proper formatting.\n\n`;
        
        chat.messages.forEach(msg => {
          if (msg.role === 'system') return; // Skip system messages
          
          const sender = msg.role === 'user' ? 'You' : agentName;
          
          // For user messages, use displayContent if available
          let content = msg.role === 'user' && msg.displayContent 
            ? msg.displayContent 
            : msg.content;
            
          wordPreview += `## ${sender}:\n${content}\n\n`;
        });
        
        setExportPreview(wordPreview);
      } else if (format === 'pdf') {
        // Generate PDF preview (simplified for preview)
        let pdfPreview = `# ${chat.title} (PDF Preview)\n\n`;
        pdfPreview += `This is a preview of how the PDF will look.\n`;
        pdfPreview += `The actual PDF will have proper formatting.\n\n`;
        
        chat.messages.forEach(msg => {
          if (msg.role === 'system') return; // Skip system messages
          
          const sender = msg.role === 'user' ? 'You' : agentName;
          
          // For user messages, use displayContent if available
          let content = msg.role === 'user' && msg.displayContent 
            ? msg.displayContent 
            : msg.content;
            
          pdfPreview += `## ${sender}:\n${content}\n\n`;
        });
        
        setExportPreview(pdfPreview);
      }
    } catch (error) {
      console.error('Error generating export preview:', error);
      setExportPreview('Error generating preview');
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  // Generate preview for message export
  const generateMessageExportPreview = async (messageIndex, format) => {
    setIsGeneratingMessagePreview(true);
    
    if (messageIndex === null || messageIndex >= messages.length) {
      setMessageExportPreview('Message not found');
      setIsGeneratingMessagePreview(false);
      return;
    }
    
    const message = messages[messageIndex];
    const agentName = agents[currentAgent]?.name || 'Assistant';
    const sender = message.role === 'user' ? 'You' : agentName;
    
    try {
      if (format === 'text') {
        // Generate text preview
        let textContent = `# Message from ${sender}\n`;
        textContent += `Date: ${new Date().toLocaleString()}\n\n`;
        
        // For user messages, use displayContent if available
        let content = message.role === 'user' && message.displayContent 
          ? message.displayContent 
          : message.content;
          
        textContent += `${content}\n`;
        
        setMessageExportPreview(textContent);
      } else if (format === 'word') {
        // Generate Word preview (simplified for preview)
        let wordPreview = `# Message from ${sender} (Word Document Preview)\n\n`;
        wordPreview += `This is a preview of how the Word document will look.\n`;
        wordPreview += `The actual Word document will have proper formatting.\n\n`;
        
        // For user messages, use displayContent if available
        let content = message.role === 'user' && message.displayContent 
          ? message.displayContent 
          : message.content;
          
        wordPreview += `${content}\n`;
        
        setMessageExportPreview(wordPreview);
      } else if (format === 'pdf') {
        // Generate PDF preview (simplified for preview)
        let pdfPreview = `# Message from ${sender} (PDF Preview)\n\n`;
        pdfPreview += `This is a preview of how the PDF will look.\n`;
        pdfPreview += `The actual PDF will have proper formatting.\n\n`;
        
        // For user messages, use displayContent if available
        let content = message.role === 'user' && message.displayContent 
          ? message.displayContent 
          : message.content;
          
        pdfPreview += `${content}\n`;
        
        setMessageExportPreview(pdfPreview);
      }
    } catch (error) {
      console.error('Error generating message export preview:', error);
      setMessageExportPreview('Error generating preview');
    } finally {
      setIsGeneratingMessagePreview(false);
    }
  };

  // Export chat to selected format
  const exportChat = async () => {
    const chat = chatHistory.find(c => c.id === exportChatId);
    if (!chat) return;
    
    const agentName = agents[chat.agent]?.name || 'Assistant';
    const fileName = `chat_${chat.id}_${new Date().toISOString().split('T')[0]}`;
    
    try {
      if (exportFormat === 'text') {
        // Export as text file
        let textContent = `# ${chat.title}\n`;
        textContent += `Date: ${new Date(chat.createdAt).toLocaleString()}\n`;
        textContent += `Agent: ${agentName}\n\n`;
        
        // Add messages
        chat.messages.forEach(msg => {
          if (msg.role === 'system') return; // Skip system messages
          
          const sender = msg.role === 'user' ? 'You' : agentName;
          
          // For user messages, use displayContent if available
          let content = msg.role === 'user' && msg.displayContent 
            ? msg.displayContent 
            : msg.content;
            
          textContent += `## ${sender}:\n${content}\n\n`;
        });
        
        // Create and download text file
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, `${fileName}.txt`);
      } else if (exportFormat === 'word') {
        // Export as Word document
        const doc = new Document({
          sections: [{
            properties: {},
            children: [
              new Paragraph({
                text: chat.title,
                heading: HeadingLevel.HEADING_1,
              }),
              new Paragraph({
                children: [
                  new TextRun(`Date: ${new Date(chat.createdAt).toLocaleString()}`),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun(`Agent: ${agentName}`),
                ],
                spacing: {
                  after: 200,
                },
              }),
            ],
          }],
        });
        
        // Add messages to Word document
        chat.messages.forEach(msg => {
          if (msg.role === 'system') return; // Skip system messages
          
          const sender = msg.role === 'user' ? 'You' : agentName;
          
          // For user messages, use displayContent if available
          let content = msg.role === 'user' && msg.displayContent 
            ? msg.displayContent 
            : msg.content;
          
          // Add sender as heading
          doc.addSection({
            children: [
              new Paragraph({
                text: sender,
                heading: HeadingLevel.HEADING_2,
              }),
              // Split content by lines and add each as a paragraph
              ...content.split('\n').map(line => 
                new Paragraph({
                  text: line,
                })
              ),
              new Paragraph({
                text: '',
                spacing: {
                  after: 200,
                },
              }),
            ],
          });
        });
        
        // Generate and download Word document
        Packer.toBlob(doc).then(blob => {
          saveAs(blob, `${fileName}.docx`);
        });
      } else if (exportFormat === 'pdf') {
        // For PDF, we'll use a workaround since we can't directly generate PDFs in the browser
        // We'll create a text file with instructions to convert to PDF
        let textContent = `# ${chat.title}\n`;
        textContent += `Date: ${new Date(chat.createdAt).toLocaleString()}\n`;
        textContent += `Agent: ${agentName}\n\n`;
        textContent += `NOTE: This is a text export that you can convert to PDF using a PDF converter tool.\n\n`;
        
        // Add messages
        chat.messages.forEach(msg => {
          if (msg.role === 'system') return; // Skip system messages
          
          const sender = msg.role === 'user' ? 'You' : agentName;
          
          // For user messages, use displayContent if available
          let content = msg.role === 'user' && msg.displayContent 
            ? msg.displayContent 
            : msg.content;
            
          textContent += `## ${sender}:\n${content}\n\n`;
        });
        
        // Create and download text file (for PDF conversion)
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, `${fileName}_for_pdf.txt`);
      }
      
      // Close export modal after successful export
      setShowExportModal(false);
    } catch (error) {
      console.error('Error exporting chat:', error);
      alert('Error exporting chat. Please try again.');
    }
  };

  // Export single message to selected format
  const exportMessage = async () => {
    if (exportMessageIndex === null || exportMessageIndex >= messages.length) return;
    
    const message = messages[exportMessageIndex];
    const agentName = agents[currentAgent]?.name || 'Assistant';
    const sender = message.role === 'user' ? 'You' : agentName;
    const fileName = `message_${Date.now()}_${message.role}`;
    
    try {
      if (messageExportFormat === 'text') {
        // Export as text file
        let textContent = `# Message from ${sender}\n`;
        textContent += `Date: ${new Date().toLocaleString()}\n\n`;
        
        // For user messages, use displayContent if available
        let content = message.role === 'user' && message.displayContent 
          ? message.displayContent 
          : message.content;
          
        textContent += `${content}\n`;
        
        // Create and download text file
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, `${fileName}.txt`);
      } else if (messageExportFormat === 'word') {
        // Export as Word document
        const doc = new Document({
          sections: [{
            properties: {},
            children: [
              new Paragraph({
                text: `Message from ${sender}`,
                heading: HeadingLevel.HEADING_1,
              }),
              new Paragraph({
                children: [
                  new TextRun(`Date: ${new Date().toLocaleString()}`),
                ],
                spacing: {
                  after: 200,
                },
              }),
            ],
          }],
        });
        
        // For user messages, use displayContent if available
        let content = message.role === 'user' && message.displayContent 
          ? message.displayContent 
          : message.content;
        
        // Add content to Word document
        doc.addSection({
          children: [
            // Split content by lines and add each as a paragraph
            ...content.split('\n').map(line => 
              new Paragraph({
                text: line,
              })
            ),
          ],
        });
        
        // Generate and download Word document
        Packer.toBlob(doc).then(blob => {
          saveAs(blob, `${fileName}.docx`);
        });
      } else if (messageExportFormat === 'pdf') {
        // For PDF, we'll use a workaround since we can't directly generate PDFs in the browser
        // We'll create a text file with instructions to convert to PDF
        let textContent = `# Message from ${sender}\n`;
        textContent += `Date: ${new Date().toLocaleString()}\n\n`;
        textContent += `NOTE: This is a text export that you can convert to PDF using a PDF converter tool.\n\n`;
        
        // For user messages, use displayContent if available
        let content = message.role === 'user' && message.displayContent 
          ? message.displayContent 
          : message.content;
          
        textContent += `${content}\n`;
        
        // Create and download text file (for PDF conversion)
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, `${fileName}_for_pdf.txt`);
      }
      
      // Close export modal after successful export
      setShowMessageExportModal(false);
    } catch (error) {
      console.error('Error exporting message:', error);
      alert('Error exporting message. Please try again.');
    }
  };

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  // Close sidebar
  const closeSidebar = () => {
    setShowSidebar(false);
  };

  // Select a chat from history
  const selectChat = (chatId) => {
    setCurrentChatId(chatId);
    // Auto-hide sidebar on all screens
    setShowSidebar(false);
  };

  return (
    <div className={`app-container ${showSidebar ? 'sidebar-visible' : 'sidebar-hidden'}`}>
      {/* Sidebar overlay for all screens */}
      {showSidebar && (
        <div className="sidebar-overlay show" onClick={() => setShowSidebar(false)}></div>
      )}
      
      {/* Sidebar for chat history */}
      <div className={`sidebar ${showSidebar ? 'show' : ''}`}>
        <div className="sidebar-header">
          <h2>Chat History</h2>
          <button className="close-sidebar" onClick={closeSidebar}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        
        <div className="agent-section">
          <div className="agent-section-header">
            <h3>Agents</h3>
            <button className="create-agent-button" onClick={openCreateAgentModal}>
              <FontAwesomeIcon icon={faUserPlus} />
              <span>Create Agent</span>
            </button>
          </div>
          
          <div className="agent-list">
            {Object.entries(agents).map(([key, agent]) => (
              <div 
                key={key} 
                className={`agent-item ${currentAgent === key ? 'active' : ''}`}
                onClick={() => switchAgent(key)}
              >
                <span className="agent-avatar">
                  {renderAgentIcon(agent.avatar)}
                </span>
                <span className="agent-name">{agent.name}</span>
                <div className="agent-actions">
                  <button 
                    className="edit-agent" 
                    onClick={(e) => openEditAgentModal(key, e)}
                    title="Edit agent"
                  >
                    <FontAwesomeIcon icon={faEdit} />
                  </button>
                  {!agent.isDefault && (
                    <button 
                      className="delete-agent" 
                      onClick={(e) => deleteAgent(key, e)}
                      title="Delete agent"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="chat-history-header">
          <h3>Recent Chats</h3>
        </div>
        
        <div className="chat-history-list">
          {chatHistory.length === 0 ? (
            <div className="no-history">No chat history yet</div>
          ) : (
            chatHistory.map(chat => (
              <div 
                key={chat.id} 
                className={`chat-history-item ${currentChatId === chat.id ? 'active' : ''}`}
                onClick={() => selectChat(chat.id)}
              >
                <div className="chat-history-title">
                  <span className="agent-indicator">
                    {agents[chat.agent] ? renderAgentIcon(agents[chat.agent].avatar) : renderAgentIcon('faRobot')}
                  </span>
                  {chat.title}
                </div>
                <div className="chat-actions">
                  <button 
                    className="export-chat" 
                    onClick={(e) => openExportModal(chat.id, e)}
                    title="Export chat"
                  >
                    <FontAwesomeIcon icon={faFileExport} />
                  </button>
                  <button 
                    className="delete-chat" 
                    onClick={(e) => deleteChat(chat.id, e)}
                    title="Delete chat"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Main chat interface */}
      <div className="chat-page">
        <div className="chat-header">
          <button 
            className={`sidebar-toggle ${showSidebar ? 'active' : ''}`} 
            onClick={toggleSidebar}
            title={showSidebar ? "Hide sidebar" : "Show sidebar"}
          >
            <FontAwesomeIcon icon={faBars} />
          </button>
          <div className="current-agent">
            <span className="agent-avatar">
              {agents[currentAgent] ? renderAgentIcon(agents[currentAgent].avatar) : renderAgentIcon('faRobot')}
            </span>
            {agents[currentAgent]?.name || "General Assistant"}
            {isStreaming && (
              <span className="loading-state-indicator">
                {loadingStates[loadingStateIndex]}
              </span>
            )}
            {!isConnected && (
              <span className="connection-status">
                <FontAwesomeIcon icon={faExclamationTriangle} /> Offline
              </span>
            )}
            {inputQueue.length > 0 && (
              <span className="queue-indicator">
                <FontAwesomeIcon icon={faHourglass} /> {inputQueue.length} in queue
              </span>
            )}
          </div>
          <div className="header-actions">
            {currentChatId && (
              <button 
                className="export-button" 
                onClick={() => openExportModal(currentChatId)}
                title="Export current chat"
              >
                <FontAwesomeIcon icon={faFileExport} />
                <span>Export</span>
              </button>
            )}
            <button className="new-chat-button" onClick={() => createNewChat(currentAgent)}>
              <FontAwesomeIcon icon={faPlus} /> 
              <span>New Chat</span>
            </button>
          </div>
        </div>
        
        <div className="chat-container">
          <div 
            className="message-list" 
            ref={messageListRef}
            onWheel={() => {
              if (isStreaming) {
                isUserScrollingRef.current = true;
              }
            }}
          >
            {messages
              .filter((msg) => msg.role !== "system") // Hide system messages
              .length === 0 ? (
              <div className="empty-chat">
                <h2>Start a new conversation with {agents[currentAgent]?.name || "General Assistant"}</h2>
                <p>Type a message below to begin</p>
              </div>
            ) : (
              messages
                .filter((msg) => msg.role !== "system") // Hide system messages
                .map((msg, index) => {
                  // Calculate the actual index in the messages array
                  const actualIndex = messages.findIndex((m, i) => i >= index && m.role !== "system");
                  
                  return (
                    <div key={index} className={`message ${msg.role} ${msg.isQueued ? 'queued' : ''} ${msg.wasStopped ? 'stopped' : ''}`}>
                      <div className="message-header">
                        <strong>{msg.role === "user" ? "You" : agents[currentAgent]?.name || "Assistant"}: </strong>
                        
                        {/* Only show actions menu for assistant messages that are not streaming */}
                        {msg.role === "assistant" && !msg.isStreaming && (
                          <div className="message-actions">
                            <button 
                              className="message-actions-button"
                              onClick={(e) => toggleMessageMenu(actualIndex, e)}
                              title="Message actions"
                            >
                              <FontAwesomeIcon icon={faEllipsisV} />
                            </button>
                            
                            {showMessageMenu === actualIndex && (
                              <div className="message-menu">
                                <button 
                                  className="message-menu-item"
                                  onClick={() => openMessageExportModal(actualIndex)}
                                >
                                  <FontAwesomeIcon icon={faFileExport} />
                                  <span>Export message</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {msg.role === "assistant" ? (
                        <>
                          <ReactMarkdown
                            components={{
                              code: CodeBlock,
                              a: LinkRenderer,
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                          {msg.wasStopped && (
                            <div className="stopped-indicator">
                              Generation stopped
                            </div>
                          )}
                        </>
                      ) : (
                        // For user messages, show the display content (without file content)
                        msg.displayContent || msg.content.split('\n\nUPLOADED FILES:')[0]
                      )}
                      
                      {/* Show file attachments if present */}
                      {msg.attachedFiles && msg.attachedFiles.length > 0 && (
                        <FileAttachments files={msg.attachedFiles} />
                      )}
                      
                      {msg.role === "assistant" && msg.isStreaming && msg.content === "" && (
                        <span className="loading-state-indicator">
                          {loadingStates[loadingStateIndex]}
                        </span>
                      )}
                      {msg.isQueued && (
                        <span className="queued-indicator">
                          <FontAwesomeIcon icon={faHourglass} /> Queued
                        </span>
                      )}
                    </div>
                  );
                })
            )}
            {!autoScroll && isStreaming && (
              <button 
                className="scroll-to-bottom"
                onClick={() => {
                  setAutoScroll(true);
                  if (messageListRef.current) {
                    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
                  }
                }}
              >
                ↓ New content
              </button>
            )}
          </div>
          
          {/* File upload area */}
          {uploadedFiles.length > 0 && (
            <div className="uploaded-files-container">
              <div className="uploaded-files-header">
                <h3>Uploaded Files</h3>
                <span className="file-count">{uploadedFiles.length} file(s)</span>
              </div>
              <div className="uploaded-files-list">
                {uploadedFiles.map(file => (
                  <div key={file.id} className="uploaded-file">
                    <div className="file-icon">
                      <FontAwesomeIcon icon={getFileIcon(file.name)} />
                    </div>
                    <div className="file-info">
                      <div className="file-name" title={file.name}>{file.name}</div>
                      <div className="file-size">{formatFileSize(file.size)}</div>
                    </div>
                    <button 
                      className="remove-file" 
                      onClick={() => removeFile(file.id)}
                      title="Remove file"
                    >
                      <FontAwesomeIcon icon={faTimesCircle} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {fileError && (
            <div className="file-error">
              <FontAwesomeIcon icon={faExclamationTriangle} /> {fileError}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="chat-input-form">
            <div className="chat-input-wrapper">
              <div className="input-container">
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={`Message ${agents[currentAgent]?.name || "Assistant"}...${!isConnected ? ' (Offline - messages will be queued)' : ''}`}
                  disabled={isStreaming && inputQueue.length === 0}
                  className="chat-textarea"
                  rows={1}
                />
                {isStreaming ? (
                  <button 
                    type="button" 
                    onClick={handleStopGeneration}
                    disabled={isStopping}
                    className="stop-button"
                    title="Stop generation"
                  >
                    <FontAwesomeIcon icon={faStop} />
                  </button>
                ) : (
                  <button 
                    type="submit" 
                    disabled={(isStreaming && inputQueue.length === 0) || (!inputValue.trim() && uploadedFiles.length === 0)} 
                    className="send-button"
                    title={!isConnected ? "Message will be queued" : "Send message"}
                  >
                    <FontAwesomeIcon icon={faPaperPlane} />
                  </button>
                )}
              </div>
              
              <label className="file-upload-label" title="Upload text files">
                <FontAwesomeIcon icon={faFileUpload} />
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  multiple
                  accept=".txt,.js,.py,.jsx,.ts,.tsx,.md,.json,.csv,.html,.css,.xml"
                  disabled={isStreaming && inputQueue.length === 0}
                />
              </label>
            </div>
            {inputQueue.length > 0 && (
              <div className="queue-status">
                <FontAwesomeIcon icon={faHourglass} /> {inputQueue.length} message{inputQueue.length > 1 ? 's' : ''} queued
              </div>
            )}
          </form>
        </div>
      </div>
      
      {/* Agent creation/editing modal */}
      {showAgentModal && (
        <div className="modal-overlay">
          <div className="agent-modal">
            <div className="modal-header">
              <h2>{editingAgent ? 'Edit Agent' : 'Create New Agent'}</h2>
              <button className="close-modal" onClick={() => setShowAgentModal(false)}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <div className="modal-body">
              {agentError && (
                <div className="error-message">
                  <FontAwesomeIcon icon={faExclamationTriangle} /> {agentError}
                </div>
              )}
              
              <div className="form-group">
                <label htmlFor="agent-name">Agent Name</label>
                <input
                  id="agent-name"
                  type="text"
                  value={newAgentData.name}
                  onChange={(e) => setNewAgentData({...newAgentData, name: e.target.value})}
                  placeholder="e.g., Marketing Expert"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="agent-icon">Agent Icon</label>
                <div className="icon-selector">
                  {Object.entries(availableIcons).map(([iconName, _]) => (
                    <button
                      key={iconName}
                      className={`icon-option ${newAgentData.avatar === iconName ? 'selected' : ''}`}
                      onClick={() => setNewAgentData({...newAgentData, avatar: iconName})}
                    >
                      {renderAgentIcon(iconName)}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="system-prompt">System Prompt</label>
                <textarea
                  id="system-prompt"
                  value={newAgentData.systemPrompt}
                  onChange={(e) => setNewAgentData({...newAgentData, systemPrompt: e.target.value})}
                  placeholder="Enter instructions for the AI agent..."
                  rows={6}
                />
                <p className="help-text">
                  This prompt defines how the AI will behave. Be specific about the agent's expertise, tone, and limitations.
                </p>
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="cancel-button" onClick={() => setShowAgentModal(false)}>
                Cancel
              </button>
              <button className="save-button" onClick={saveAgent}>
                <FontAwesomeIcon icon={faSave} /> {editingAgent ? 'Update Agent' : 'Create Agent'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export chat modal */}
      {showExportModal && (
        <div className="modal-overlay">
          <div className="export-modal">
            <div className="modal-header">
              <h2>Export Chat</h2>
              <button className="close-modal" onClick={() => setShowExportModal(false)}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Export Format</label>
                <div className="format-selector">
                  <button 
                    className={`format-option ${exportFormat === 'text' ? 'selected' : ''}`}
                    onClick={() => setExportFormat('text')}
                  >
                    <FontAwesomeIcon icon={faFileAlt} />
                    <span>Text</span>
                  </button>
                  <button 
                    className={`format-option ${exportFormat === 'word' ? 'selected' : ''}`}
                    onClick={() => setExportFormat('word')}
                  >
                    <FontAwesomeIcon icon={faFileWord} />
                    <span>Word</span>
                  </button>
                  <button 
                    className={`format-option ${exportFormat === 'pdf' ? 'selected' : ''}`}
                    onClick={() => setExportFormat('pdf')}
                  >
                    <FontAwesomeIcon icon={faFilePdf} />
                    <span>PDF</span>
                  </button>
                </div>
              </div>
              
              <div className="preview-container">
                <div className="preview-header">
                  <h3>Preview</h3>
                </div>
                <div className="preview-content">
                  {isGeneratingPreview ? (
                    <div className="preview-loading">
                      <FontAwesomeIcon icon={faHourglass} spin />
                      <span>Generating preview...</span>
                    </div>
                  ) : (
                    <pre>{exportPreview}</pre>
                  )}
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="cancel-button" onClick={() => setShowExportModal(false)}>
                Cancel
              </button>
              <button 
                className="export-button" 
                onClick={exportChat}
                disabled={isGeneratingPreview}
              >
                <FontAwesomeIcon icon={faDownload} /> Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export message modal */}
      {showMessageExportModal && (
        <div className="modal-overlay">
          <div className="export-modal">
            <div className="modal-header">
              <h2>Export Message</h2>
              <button className="close-modal" onClick={() => setShowMessageExportModal(false)}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Export Format</label>
                <div className="format-selector">
                  <button 
                    className={`format-option ${messageExportFormat === 'text' ? 'selected' : ''}`}
                    onClick={() => setMessageExportFormat('text')}
                  >
                    <FontAwesomeIcon icon={faFileAlt} />
                    <span>Text</span>
                  </button>
                  <button 
                    className={`format-option ${messageExportFormat === 'word' ? 'selected' : ''}`}
                    onClick={() => setMessageExportFormat('word')}
                  >
                    <FontAwesomeIcon icon={faFileWord} />
                    <span>Word</span>
                  </button>
                  <button 
                    className={`format-option ${messageExportFormat === 'pdf' ? 'selected' : ''}`}
                    onClick={() => setMessageExportFormat('pdf')}
                  >
                    <FontAwesomeIcon icon={faFilePdf} />
                    <span>PDF</span>
                  </button>
                </div>
              </div>
              
              <div className="preview-container">
                <div className="preview-header">
                  <h3>Preview</h3>
                </div>
                <div className="preview-content">
                  {isGeneratingMessagePreview ? (
                    <div className="preview-loading">
                      <FontAwesomeIcon icon={faHourglass} spin />
                      <span>Generating preview...</span>
                    </div>
                  ) : (
                    <pre>{messageExportPreview}</pre>
                  )}
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="cancel-button" onClick={() => setShowMessageExportModal(false)}>
                Cancel
              </button>
              <button 
                className="export-button" 
                onClick={exportMessage}
                disabled={isGeneratingMessagePreview}
              >
                <FontAwesomeIcon icon={faDownload} /> Export
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
