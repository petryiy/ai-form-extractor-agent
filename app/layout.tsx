import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Requirement Elicitation Agent",
  description: "Guided B2B SaaS requirement collection with validated structured output."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
