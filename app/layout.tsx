import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YouTube Mystery & Crime Uploader",
  description: "Automated YouTube upload system for mystery and crime content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
