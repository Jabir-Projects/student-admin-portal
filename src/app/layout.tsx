import type { Metadata } from "next";
import "./globals.css";

const themeInitializationScript = `
(function () {
  try {
    var storedTheme = localStorage.getItem("sist-color-theme");
    var theme = storedTheme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (_) {}
})();
`;

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
      data-theme="light"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeInitializationScript }}
        />
      </head>
      <body className="bg-background text-foreground flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}
