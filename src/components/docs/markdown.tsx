"use client";

import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { CodeBlock } from "@/components/replay/code-block";
import { memo, useMemo } from "react";
import { slugify } from "@/lib/docs-utils";

interface MarkdownProps {
  content: string;
  className?: string;
}

/** Extracts fenced code language and source from a markdown code node. */
function getCodeProps(children: React.ReactNode): { lang?: string; code: string } {
  let code = "";
  let lang: string | undefined;
  const collect = (node: React.ReactNode) => {
    if (typeof node === "string") {
      code += node;
    } else if (Array.isArray(node)) {
      node.forEach(collect);
    } else if (node && typeof node === "object" && "props" in node) {
      const props = (node as React.ReactElement).props as {
        className?: string;
        children?: React.ReactNode;
      };
      if (props?.className?.startsWith("language-")) {
        lang = props.className.replace("language-", "");
      }
      if (props?.children) collect(props.children);
    }
  };
  collect(children);
  return { lang, code: code.replace(/\n$/, "") };
}

const components: Components = {
  h1: ({ children }) => (
    <h1
      id={slugify(String(children))}
      className="scroll-mt-24 text-[28px] font-semibold tracking-tight sm:text-[32px]"
    >
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2
      id={slugify(String(children))}
      className="scroll-mt-24 mt-10 border-b border-border/50 pb-2 text-[20px] font-semibold tracking-tight"
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      id={slugify(String(children))}
      className="scroll-mt-24 mt-6 text-[16px] font-semibold tracking-tight"
    >
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-4 text-[13.5px] font-semibold tracking-tight text-foreground/90">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="mt-4 text-[14.5px] leading-7 text-muted-foreground">
      {children}
    </p>
  ),
  a: ({ href, children }) => {
    const isInternal =
      typeof href === "string" && href.startsWith("?view=developers");
    return (
      <a
        href={href}
        className={cn(
          "font-medium underline decoration-primary/40 underline-offset-2 transition hover:decoration-primary",
          isInternal ? "text-primary" : "text-foreground hover:text-primary",
        )}
      >
        {children}
      </a>
    );
  },
  ul: ({ children }) => (
    <ul className="mt-4 list-disc space-y-1.5 pl-6 text-[14.5px] leading-7 text-muted-foreground marker:text-muted-foreground/50">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-4 list-decimal space-y-1.5 pl-6 text-[14.5px] leading-7 text-muted-foreground marker:text-muted-foreground/50">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="mt-4 border-l-2 border-primary/40 bg-primary/[0.04] py-1 pl-4 pr-3 text-[13.5px] italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8 border-border/50" />,
  table: ({ children }) => (
    <div className="mt-5 overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted/40">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border-b border-border/60 px-3 py-2 text-left font-semibold text-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/40 px-3 py-2 align-top text-muted-foreground">
      {children}
    </td>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.startsWith("language-");
    if (!isBlock) {
      return (
        <code className="rounded bg-muted/70 px-1.5 py-0.5 font-mono text-[12.5px] text-primary">
          {children}
        </code>
      );
    }
    return <code className="hidden">{children}</code>;
  },
  pre: ({ children }) => {
    const { lang, code } = getCodeProps(children);
    return (
      <div className="mt-4">
        <CodeBlock code={code} language={lang} maxHeight="max-h-[460px]" />
      </div>
    );
  },
};

export const Markdown = memo(function Markdown({
  content,
  className,
}: MarkdownProps) {
  const rendered = useMemo(
    () => <ReactMarkdown components={components}>{content}</ReactMarkdown>,
    [content],
  );
  return <div className={cn("docs-content", className)}>{rendered}</div>;
});
