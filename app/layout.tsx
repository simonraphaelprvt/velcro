import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VELCRO",
  description: "Personal AI Assistant",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-velcro-bg font-sans antialiased">{children}</body>
    </html>
  );
}
