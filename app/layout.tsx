import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Support Copilot",
  description: "A grounded support investigation assistant with visible evidence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
