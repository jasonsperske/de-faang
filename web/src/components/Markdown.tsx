import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children, className, components }: { children: string; className?: string; components?: Components }) {
  return (
    <div className={`md ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ a: ({ node: _n, ...props }) => <a {...props} target="_blank" rel="noreferrer" />, ...components }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
