import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  code({ className, children, ...props }) {
    const isInline = !className;
    const match = /language-(\w+)/.exec(className ?? "");

    if (isInline) {
      return (
        <code className="bg-gray-200 rounded px-1 py-0.5 text-sm font-mono" {...props}>
          {children}
        </code>
      );
    }

    return (
      <div className="relative group my-3">
        {match && (
          <div className="text-xs text-gray-500 px-4 py-1 bg-gray-200 rounded-t-lg border-b border-gray-300 font-mono">
            {match[1]}
          </div>
        )}
        <pre className="bg-gray-900 text-gray-100 rounded-b-lg rounded-tr-lg overflow-x-auto p-4 text-sm leading-relaxed">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      </div>
    );
  },
  pre({ children }) {
    return <>{children}</>;
  },
  p({ children }) {
    return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
  },
  ul({ children }) {
    return <ul className="list-disc pl-6 mb-2 space-y-1">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="list-decimal pl-6 mb-2 space-y-1">{children}</ol>;
  },
  li({ children }) {
    return <li className="leading-relaxed">{children}</li>;
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto my-3">
        <table className="min-w-full border-collapse border border-gray-300 text-sm">
          {children}
        </table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th className="border border-gray-300 bg-gray-100 px-3 py-2 font-semibold text-left">
        {children}
      </th>
    );
  },
  td({ children }) {
    return <td className="border border-gray-300 px-3 py-2">{children}</td>;
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline"
      >
        {children}
      </a>
    );
  },
  h1({ children }) {
    return <h1 className="text-xl font-bold mb-2 mt-4">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="text-lg font-bold mb-2 mt-3">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="text-base font-bold mb-1 mt-3">{children}</h3>;
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-4 border-gray-300 pl-4 my-2 italic text-gray-600">
        {children}
      </blockquote>
    );
  },
  hr() {
    return <hr className="my-4 border-gray-300" />;
  },
};

export function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
