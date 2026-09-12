import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Clipboard, Check, Info, Lightbulb, AlertTriangle, Star, HelpCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface MarkdownProps {
  content: string;
  className?: string;
}

// Pattern matching functions (e.g. foo(x)), decorators (@decorator), snake_case variables (in_range, run_n_times), and args/kwargs
const CODE_TOKEN_REGEX = /(@[a-zA-Z_][\w.]*|\b[a-zA-Z_]\w*\([^)]*\)|\b[a-zA-Z_]\w*_[a-zA-Z0-9_]+\b|\b(?:\*args|\*\*kwargs|defaultdict|Counter|DataFrame|Series)\b)/g;

export const renderTextWithCodeHighlights = (node: React.ReactNode): React.ReactNode => {
  if (typeof node === 'string') {
    if (!node.trim()) return node;
    const parts = node.split(CODE_TOKEN_REGEX);
    if (parts.length <= 1) return node;

    return parts.map((part, index) => {
      if (!part) return null;
      if (index % 2 === 1) {
        return (
          <code 
            key={index}
            className="font-mono text-xs bg-[#141417] text-zinc-200 border border-white/[0.08] px-1.5 py-0.5 rounded-md font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] inline-block mx-0.5 my-0.5"
          >
            {part}
          </code>
        );
      }
      return part;
    });
  }

  if (Array.isArray(node)) {
    return React.Children.map(node, child => renderTextWithCodeHighlights(child));
  }

  if (React.isValidElement(node)) {
    // Never rewrite inside existing code tags or links
    if (node.type === 'code' || node.type === 'a') {
      return node;
    }
    const props = node.props as { children?: React.ReactNode };
    if (props && props.children) {
      return React.cloneElement(node, {}, renderTextWithCodeHighlights(props.children));
    }
  }

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
                  className="font-mono text-xs bg-[#161619] text-zinc-200 border border-white/[0.08] px-1.5 py-0.5 rounded font-medium"
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
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight border-b border-white/[0.08] pb-2.5 mt-7 mb-4 font-sans">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold text-zinc-100 tracking-tight mt-7 mb-3 font-sans border-l-2 border-zinc-600 pl-3 flex items-center gap-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-zinc-200 tracking-tight mt-6 mb-2 font-sans border-l-2 border-zinc-700 pl-2.5">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="leading-relaxed text-zinc-300 my-3 text-sm font-sans whitespace-pre-line">
              {renderTextWithCodeHighlights(children)}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1.5 my-3 pl-2 text-zinc-300 text-sm font-sans">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1.5 my-3 pl-2 text-zinc-300 text-sm font-sans">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed text-zinc-300 font-sans marker:text-zinc-500">
              {renderTextWithCodeHighlights(children)}
            </li>
          ),
          a: ({ href, children }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-zinc-200 hover:text-white underline underline-offset-4 decoration-zinc-500/40 transition-colors font-medium"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-zinc-100 dark:text-zinc-100">
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
            <thead className="bg-secondary/60 border-b border-white/[0.08] text-zinc-200 font-semibold">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 text-left font-semibold text-zinc-300 uppercase tracking-wider text-[11px]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 border-t border-border/30 text-foreground/90 align-middle">
              {renderTextWithCodeHighlights(children)}
            </td>
          ),
          tr: ({ children }) => (
            <tr className="even:bg-secondary/15 hover:bg-white/[0.03] transition-colors">
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

  const isSchemaOrDiagram = 
    language === 'schema' || 
    language === 'ascii' || 
    language === 'diagram' || 
    (language === 'text' && /[│┌─┐▼▲┼├└═║]/.test(value)) ||
    /[│┌─┐▼▲┼├└═║]/.test(value);

  return (
    <div className={cn(
      "my-4 overflow-hidden rounded-xl border shadow-lg group/code",
      isSchemaOrDiagram 
        ? "bg-[#0b0b0e] border-white/[0.08]" 
        : "bg-secondary/35 border-border/60"
    )}>
      <div className="flex items-center justify-between px-4 py-1.5 bg-white/[0.02] border-b border-white/[0.06] text-[10px] font-mono tracking-widest text-zinc-400 uppercase">
        <span className="flex items-center gap-1.5">
          {isSchemaOrDiagram && <span className="text-amber-400">📐</span>}
          <span>{isSchemaOrDiagram ? 'Schéma Conceptuel' : (language || 'code')}</span>
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors p-1 rounded hover:bg-white/[0.06] cursor-pointer"
          title="Copier"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copié</span>
            </>
          ) : (
            <>
              <Clipboard className="w-3 h-3" />
              <span>Copier</span>
            </>
          )}
        </button>
      </div>
      {isSchemaOrDiagram ? (
        <pre className="p-4 sm:p-5 m-0 overflow-x-auto text-xs font-mono leading-[1.28] text-zinc-200 bg-transparent selection:bg-white/20 whitespace-pre">
          <code>{value}</code>
        </pre>
      ) : (
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
      )}
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
      border: 'border-l-2 border-sky-400/80 bg-[#0f0f12] border border-white/[0.06]',
      icon: <Info className="w-4 h-4 text-sky-400/90 shrink-0 mt-0.5" strokeWidth={1.5} />,
      title: 'Note',
      badgeClass: 'text-sky-400/90 font-mono text-[11px] uppercase tracking-wider'
    },
    tip: {
      border: 'border-l-2 border-emerald-400/80 bg-[#0f0f12] border border-white/[0.06]',
      icon: <Lightbulb className="w-4 h-4 text-emerald-400/90 shrink-0 mt-0.5" strokeWidth={1.5} />,
      title: 'Astuce',
      badgeClass: 'text-emerald-400/90 font-mono text-[11px] uppercase tracking-wider'
    },
    warning: {
      border: 'border-l-2 border-amber-400/80 bg-[#0f0f12] border border-white/[0.06]',
      icon: <AlertTriangle className="w-4 h-4 text-amber-400/90 shrink-0 mt-0.5" strokeWidth={1.5} />,
      title: 'Attention',
      badgeClass: 'text-amber-400/90 font-mono text-[11px] uppercase tracking-wider'
    },
    important: {
      border: 'border-l-2 border-rose-400/80 bg-[#0f0f12] border border-white/[0.06]',
      icon: <Star className="w-4 h-4 text-rose-400/90 shrink-0 mt-0.5" strokeWidth={1.5} />,
      title: 'Important',
      badgeClass: 'text-rose-400/90 font-mono text-[11px] uppercase tracking-wider'
    },
    info: {
      border: 'border-l-2 border-zinc-500/80 bg-[#0f0f12] border border-white/[0.06]',
      icon: <HelpCircle className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" strokeWidth={1.5} />,
      title: 'Info',
      badgeClass: 'text-zinc-400 font-mono text-[11px] uppercase tracking-wider'
    }
  };

  const styles = styleMap[type];

  return (
    <div className={`p-4 rounded-xl my-4 text-sm font-sans flex gap-3 ${styles.border}`}>
      {styles.icon}
      <div className="flex-1 min-w-0 space-y-1">
        {styles.title && (
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              "text-[10px] font-semibold uppercase tracking-wider",
              styles.badgeClass
            )}>
              {styles.title}
            </span>
          </div>
        )}
        <div className="text-zinc-300 leading-relaxed text-sm">{cleanChildren}</div>
      </div>
    </div>
  );
};
