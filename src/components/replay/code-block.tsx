"use client";

import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
  showCopy?: boolean;
  numbered?: boolean;
  maxHeight?: string;
}

export function CodeBlock({
  code,
  language,
  className,
  showCopy = true,
  numbered = false,
  maxHeight = "max-h-96",
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  const lines = code.replace(/\n$/, "").split("\n");

  return (
    <div
      className={cn(
        "relative rounded-lg border border-border/70 bg-black/40 overflow-hidden",
        className,
      )}
    >
      {showCopy && (
        <button
          onClick={copy}
          className="absolute right-2 top-2 z-10 inline-flex h-7 items-center gap-1.5 rounded-md border border-border/60 bg-background/70 px-2 text-[11px] font-medium text-muted-foreground backdrop-blur transition hover:text-foreground hover:border-border"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Copy
            </>
          )}
        </button>
      )}
      {language && (
        <div className="border-b border-border/50 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
          {language}
        </div>
      )}
      <div
        className={cn(
          "scrollbar-thin overflow-auto p-3 text-[12.5px] leading-relaxed",
          maxHeight,
        )}
      >
        <pre className="font-mono">
          {numbered ? (
            <code>
              {lines.map((line, i) => (
                <div key={i} className="flex">
                  <span className="mr-4 inline-block w-8 shrink-0 select-none text-right text-muted-foreground/40">
                    {i + 1}
                  </span>
                  <span className="whitespace-pre-wrap break-words text-foreground/90">
                    {line || " "}
                  </span>
                </div>
              ))}
            </code>
          ) : (
            <code className="whitespace-pre-wrap break-words text-foreground/90">
              {code}
            </code>
          )}
        </pre>
      </div>
    </div>
  );
}
