import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { RegisterServiceWorker } from "./register-sw";

export const metadata: Metadata = {
  title: "Lifestyle App",
  description: "Dein ruhiger Lifestyle-Coach.",
  appleWebApp: { capable: true, title: "Lifestyle" },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};

export const viewport: Viewport = { themeColor: "#0f766e" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
