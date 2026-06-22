import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ReplayAI — DVR for AI Agent Workflows",
  description:
    "Record every AI agent execution as a fully replayable session. Debug non-deterministic failures in minutes, not hours. Deterministic replay, visual timelines, diff view, and one-click test export.",
  keywords: [
    "ReplayAI",
    "AI agent debugging",
    "LLM observability",
    "agent replay",
    "LangChain debugging",
    "AI workflow tracing",
    "deterministic replay",
  ],
  authors: [{ name: "ReplayAI" }],
  openGraph: {
    title: "ReplayAI — DVR for AI Agent Workflows",
    description:
      "Record, replay, and debug AI agent executions. The dev tool for non-deterministic systems.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ReplayAI — DVR for AI Agent Workflows",
    description:
      "Record, replay, and debug AI agent executions. The dev tool for non-deterministic systems.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
