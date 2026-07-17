import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Clipboard, Check, Info, Lightbulb, AlertTriangle, Star, HelpCircle } from 'lucide-react';

interface MarkdownProps {
  content: string;
  className?: string;
}

export const autoFormatMarkdown = (text: string): string => {
  if (!text) return '';

  // Split text by protected contexts (HTML tags, markdown links/images, inline/block code, URLs, and emails)
  const parts = text.split(/(<[^>]+>|!?\[[^\]]*\]\([^)]*\)|```[\s\S]*?```|`[^`\n]+`|https?:\/\/[^\s/$.?#].[^\s]*|[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,})/g);

  // Combined regex to match programming terms:
  // 1. Relative calls/properties: .add, .add(), .foo.bar()
  // 2. Identifier-initiated property chains or function calls: obj.prop, obj.method(), func()
  // 3. Generic type patterns: list[str], List[int], Union[A, B]
  // 4. Standalone programming keywords (case-sensitive)
  const codeTermsRegex = /(\.[a-zA-Z_][a-zA-Z0-9_]*(?:\([^()]*(?:\([^()]*\)[^()]*)*\))?|[a-zA-Z_][a-zA-Z0-9_]*(?:\([^()]*(?:\([^()]*\)[^()]*)*\))?(?:\.[a-zA-Z_][a-zA-Z0-9_]*(?:\([^()]*(?:\([^()]*\)[^()]*)*\))?)+|[a-zA-Z_][a-zA-Z0-9_]*\([^()]*(?:\([^()]*\)[^()]*)*\)|\b(?:list|set|dict|tuple|List|Set|Tuple|Dict|Union|Optional|Vector|Map|Array)\s*\[[^\]]+\]|\b(?:dict|tuple|int|float|str|bool|Counter|Pandas|DataFrame|Series)\b)/g;

  const processedParts = parts.map((part, index) => {
    // Even indices are plain text outside of protected blocks
    if (index % 2 === 0) {
      return part.replace(codeTermsRegex, (match) => {
        // Exclude common abbreviations e.g. and i.e.
        const normalized = match.toLowerCase();
        if (normalized === 'e.g' || normalized === 'i.e') {
          return match;
        }
        return `\`${match}\``;
      });
    }
    // Odd indices are protected blocks, leave untouched
    return part;
  });

  return processedParts.join('');
};

export const Markdown: React.FC<MarkdownProps> = ({ content, className }) => {
  const formattedContent = React.useMemo(() => autoFormatMarkdown(content), [content]);

  return (
    <div className={className}>
      <ReactMarkdown
        rehypePlugins={[rehypeRaw]}
        components={{
          code({ className: codeClassName, children, ...props }) {
            const match = /language-(\w+)/.exec(codeClassName || '');
            const isInline = !match;
            const codeString = String(children).replace(/\n$/, '');

            if (isInline) {
              return (
                <code 
                  className="font-mono text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-1.5 py-0.5 rounded"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return <CodeBlock language={match[1]} value={codeString} />;
          },
          blockquote({ children }) {
            return <Callout>{children}</Callout>;
          },
          h1: ({ children }) => (
            <h1 className="text-xl font-extrabold text-indigo-400 border-b border-indigo-500/10 pb-1 mt-6 mb-4 font-sans tracking-wide">
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
            <p className="leading-relaxed text-foreground/85 my-3 text-sm font-sans">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1.5 my-3 pl-2 text-foreground/80 text-sm font-sans">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1.5 my-3 pl-2 text-foreground/80 text-sm font-sans">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed text-foreground/90 font-sans marker:text-indigo-400">
              {children}
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
              {children}
            </strong>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4 rounded-xl border border-border/60">
              <table className="min-w-full divide-y divide-border/60 bg-secondary/20 text-xs font-sans">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-secondary/60">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 text-left font-bold text-muted-foreground uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 border-t border-border/40 text-foreground/80">
              {children}
            </td>
          ),
        }}
      >
        {formattedContent}
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
