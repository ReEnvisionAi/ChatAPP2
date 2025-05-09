import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Sandpack } from '@codesandbox/sandpack-react';
import { nightOwl } from '@codesandbox/sandpack-themes';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faCode, faCopy, faCheck } from '@fortawesome/free-solid-svg-icons';

export const CodeBlock = ({ node, inline, className, children, ...props }) => {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const [showSandpack, setShowSandpack] = useState(false);
  const [copied, setCopied] = useState(false);

  // Check if this is JavaScript/React code that can be run in Sandpack
  const isJavaScript = language === 'js' || language === 'jsx' || language === 'javascript';
  const isReact = language === 'jsx' || language === 'tsx' || language === 'react';
  const canRunInSandpack = isJavaScript || isReact;
  
  const code = String(children).replace(/\n$/, '');

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Prepare files for Sandpack
  const getFiles = () => {
    if (isReact) {
      // For React code, set up App.js with the code
      return {
        '/App.js': {
          code: code.includes('export default') || code.includes('ReactDOM.render') 
            ? code 
            : `import React from 'react';\n\n${code}\n\nexport default App;`,
        },
        '/index.js': {
          code: `import React from 'react';\nimport ReactDOM from 'react-dom';\nimport App from './App';\n\nReactDOM.render(<App />, document.getElementById('root'));`,
          hidden: true,
        },
      };
    } else {
      // For vanilla JavaScript, use index.js
      return {
        '/index.js': { code },
        '/index.html': {
          code: `<!DOCTYPE html>
<html>
  <head>
    <title>JavaScript Example</title>
    <meta charset="UTF-8" />
  </head>
  <body>
    <div id="app"></div>
    <script src="index.js"></script>
  </body>
</html>`,
          hidden: true,
        },
      };
    }
  };

  if (inline) {
    // Style for inline code
    return <code className="inline-code" {...props}>{children}</code>;
  } else {
    // Code block with syntax highlighting and optional Sandpack
    return (
      <div className="code-block-container">
        <div className="code-block-header">
          <span className="code-language">{language || 'text'}</span>
          <div className="code-actions">
            {canRunInSandpack && (
              <button 
                className="code-action-button"
                onClick={() => setShowSandpack(!showSandpack)}
                title={showSandpack ? "Hide live preview" : "Show live preview"}
              >
                <FontAwesomeIcon icon={showSandpack ? faCode : faPlay} />
                <span>{showSandpack ? "Hide Preview" : "Run Code"}</span>
              </button>
            )}
            <button 
              className="code-action-button"
              onClick={copyToClipboard}
              title="Copy code"
            >
              <FontAwesomeIcon icon={copied ? faCheck : faCopy} />
              <span>{copied ? "Copied!" : "Copy"}</span>
            </button>
          </div>
        </div>
        
        <SyntaxHighlighter
          style={oneDark}
          language={language}
          PreTag="div"
          {...props}
        >
          {code}
        </SyntaxHighlighter>
        
        {showSandpack && canRunInSandpack && (
          <div className="sandpack-container">
            <Sandpack
              template={isReact ? "react" : "vanilla"}
              theme={nightOwl}
              files={getFiles()}
              options={{
                showNavigator: false,
                showTabs: true,
                showLineNumbers: true,
                showInlineErrors: true,
                closableTabs: false,
                wrapContent: true,
                editorHeight: 400,
                editorWidthPercentage: 60,
              }}
            />
          </div>
        )}
      </div>
    );
  }
};
