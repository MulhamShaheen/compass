import type { Metadata, Viewport } from "next";
import { Orbitron, Rajdhani, Share_Tech_Mono } from "next/font/google";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

const brand = Orbitron({ weight: ["700", "900"], subsets: ["latin"], variable: "--font-brand" });
const display = Rajdhani({ weight: ["500", "600", "700"], subsets: ["latin"], variable: "--font-display" });
const mono = Share_Tech_Mono({ weight: "400", subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Compass",
  description: "Life is one long storyline. Compass is the window onto it.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

/** Applies the saved appearance before first paint, so there is no flash. */
const THEME_SCRIPT = `try{var t=localStorage.getItem("compass-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${brand.variable} ${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
