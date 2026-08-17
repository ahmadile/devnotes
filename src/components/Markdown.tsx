import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Clipboard, Check, Info, Lightbulb, AlertTriangle, Star, HelpCircle } from 'lucide-react';

interface MarkdownProps {
  content: string;
  className?: string;
}

// Identity helper preserved for compatibility
export const renderTextWithCodeHighlights = (node: React.ReactNode): React.ReactNode => {
  return node;
};

// Preserve raw text as authored or pasted by the user without destructive regex backtick insertion
export const autoFormatMarkdown = (text: string): string => {
  return text || '';
};

export const Markdown: React.FC<MarkdownProps> = ({ content, className }) => {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          code({ className: codeClassName, children, ...props }) {
            const match = /language-(\w+)/.exec(codeClassName || '');
            const isInline = !match;
            const codeString = String(children).replace(/\n$/, '');

            if (isInline) {
              return (
                <code 
                  className="font-mono text-xs bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 px-1.5 py-0.5 rounded font-semibold"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return <CodeBlock language={match[1]} value={codeString} />;
          },
          blockquote({ children }) {
            return <Callout>{renderTextWithCodeHighlights(children)}</Callout>;
          },
          h1: ({ children }) => (
            <h1 className="text-xl font-extrabold text-indigo-400 border-b border-indigo-500/20 pb-1.5 mt-6 mb-4 font-sans tracking-wide">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-bold text-sky-400 mt-5 mb-3 font-sans">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-emerald-400 mt-4 mb-2 font-sans">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="leading-relaxed text-foreground/90 my-3 text-sm font-sans whitespace-pre-line">
              {renderTextWithCodeHighlights(children)}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1.5 my-3 pl-2 text-foreground/85 text-sm font-sans">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1.5 my-3 pl-2 text-foreground/85 text-sm font-sans">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed text-foreground/90 font-sans marker:text-indigo-400">
              {renderTextWithCodeHighlights(children)}
            </li>
          ),
          a: ({ href, children }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 underline underline-offset-4 decoration-indigo-500/30 transition-all font-semibold"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-indigo-200">
              {renderTextWithCodeHighlights(children)}
            </strong>
          ),
          pre: ({ children }) => (
            <div className="my-4 overflow-hidden rounded-xl border border-border/70 bg-secondary/40 shadow-md">
              {children}
            </div>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-5 rounded-xl border border-border/80 bg-secondary/20 shadow-md backdrop-blur-sm">
              <table className="min-w-full divide-y divide-border/60 text-xs font-sans">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-secondary/80 border-b border-indigo-500/30 text-foreground font-semibold">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 text-left font-bold text-indigo-300 uppercase tracking-wider text-[11px]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 border-t border-border/30 text-foreground/90 align-middle">
              {renderTextWithCodeHighlights(children)}
            </td>
          ),
          tr: ({ children }) => (
            <tr className="even:bg-secondary/15 hover:bg-indigo-500/10 transition-colors">
              {children}
            </tr>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

// Code block with copy functionality
const CodeBlock: React.FC<{ language: string; value: string }> = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border/60 bg-secondary/35 shadow-lg group/code">
      <div className="flex items-center justify-between px-4 py-1.5 bg-secondary/60 border-b border-border/40 text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
        <span>{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-foreground transition-colors p-1 rounded hover:bg-secondary cursor-pointer"
          title="Copy Code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Clipboard className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          padding: '16px',
          background: 'transparent',
          fontSize: '12px',
          lineHeight: '1.6',
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};

// Callout / blockquote with GitHub-style alert parsing
const Callout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  let type: 'note' | 'tip' | 'warning' | 'important' | 'info' = 'info';
  let cleanChildren = children;

  // Walk through blockquote children to detect [!NOTE], [!TIP], etc.
  const childArray = React.Children.toArray(children);
  for (let i = 0; i < childArray.length; i++) {
    const child = childArray[i];
    if (React.isValidElement(child)) {
      const element = child as React.ReactElement<any>;
      if (element.props && element.props.children) {
        const innerList = React.Children.toArray(element.props.children);
        if (innerList.length > 0 && typeof innerList[0] === 'string') {
          const text = innerList[0].trim();
          const alertPatterns: Array<{ prefix: string; alertType: 'note' | 'tip' | 'warning' | 'important' | 'info' }> = [
            { prefix: '[!NOTE]', alertType: 'note' },
            { prefix: '[!TIP]', alertType: 'tip' },
            { prefix: '[!WARNING]', alertType: 'warning' },
            { prefix: '[!IMPORTANT]', alertType: 'important' },
          ];
          for (const { prefix, alertType } of alertPatterns) {
            if (text.startsWith(prefix)) {
              type = alertType;
              const cleaned = text.replace(prefix, '').trim();
              const newChild = React.cloneElement(element, {}, [cleaned, ...innerList.slice(1)]);
              const newArray = [...childArray];
              newArray[i] = newChild;
              cleanChildren = newArray;
              break;
            }
          }
          break; // Only check the first text-bearing element
        }
      }
    }
  }

  const styleMap = {
    note: {
      border: 'border-l-4 border-indigo-500/60 bg-indigo-500/5',
      icon: <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />,
      title: 'Note',
      titleColor: 'text-indigo-400'
    },
    tip: {
      border: 'border-l-4 border-emerald-500/60 bg-emerald-500/5',
      icon: <Lightbulb className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />,
      title: 'Tip',
      titleColor: 'text-emerald-400'
    },
    warning: {
      border: 'border-l-4 border-amber-500/60 bg-amber-500/5',
      icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />,
      title: 'Warning',
      titleColor: 'text-amber-400'
    },
    important: {
      border: 'border-l-4 border-rose-500/60 bg-rose-500/5',
      icon: <Star className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />,
      title: 'Important',
      titleColor: 'text-rose-400'
    },
    info: {
      border: 'border-l-4 border-primary/50 bg-secondary/35',
      icon: <HelpCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />,
      title: '',
      titleColor: 'text-primary'
    }
  };

  const styles = styleMap[type];

  return (
    <div className={`p-4 rounded-r-xl my-4 text-sm font-sans flex gap-3 ${styles.border}`}>
      {styles.icon}
      <div className="flex-1 min-w-0 space-y-1">
        {styles.title && (
          <span className={`text-xs font-bold uppercase tracking-wider ${styles.titleColor}`}>
            {styles.title}
          </span>
        )}
        <div className="text-foreground/90">{cleanChildren}</div>
      </div>
    </div>
  );
};
