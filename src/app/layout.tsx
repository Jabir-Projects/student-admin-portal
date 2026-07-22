import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  fallback: ["Segoe UI", "Arial", "sans-serif"],
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600"],
  variable: "--font-ibm-plex-mono",
  fallback: ["Cascadia Code", "Consolas", "monospace"],
});

export const metadata: Metadata = {
  title: {
    default: "Student Administration Portal",
    template: "%s | Student Administration Portal",
  },
  description:
    "A secure portal for students and university administration services.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={[
        inter.variable,
        ibmPlexMono.variable,
        "h-full antialiased",
      ].join(" ")}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}
