import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shopping Concierge Harness",
  description: "GPT-Live multimodal agent harness demo",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
