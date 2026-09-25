import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ebook Formatter — Format Print-Ready eBooks in Minutes",
  description:
    "Upload a manuscript to measure it, review the spelling findings, pick a genre, and export a print-ready PDF, EPUB, DOCX, RTF or TXT.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
