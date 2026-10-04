import type { Metadata, Viewport } from "next";
import { Orbitron, Rajdhani, Share_Tech_Mono } from "next/font/google";
import { ServiceWorker } from "@/components/ServiceWorker";
import { ToastProvider } from "@/components/Toast";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const brand = Orbitron({ weight: ["700", "900"], subsets: ["latin"], variable: "--font-brand" });
const display = Rajdhani({ weight: ["500", "600", "700"], subsets: ["latin"], variable: "--font-display" });
const mono = Share_Tech_Mono({ weight: "400", subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.description,
  applicationName: BRAND.name,
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  // A private diary: keep every page out of search engines.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Night City is the default whatever the system setting, so one color fits.
  themeColor: BRAND.themeDark,
};

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
        <ServiceWorker />
      </body>
    </html>
  );
}
