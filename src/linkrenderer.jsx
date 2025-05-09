import React from 'react';

// Custom link renderer for ReactMarkdown
export const LinkRenderer = ({ href, children }) => {
  // Check if the link is external
  const isExternal = href.startsWith('http') || href.startsWith('https');
  
  return (
    <a 
      href={href} 
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className="markdown-link"
    >
      {children}
    </a>
  );
};
