import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SplashScreen from "./components/splash-screen";
import OfflineAuthProvider from "./components/offline-auth-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "AcoustiField",
  description: "Fiches de pose d’enregistreurs acoustiques pour le suivi des chauves-souris",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AcoustiField",
  },
  icons: {
    icon: [
      { url: "/favicon-16.png?v=3", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png?v=3", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/icon-180.png?v=3", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#c2762a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <OfflineAuthProvider>
          <SplashScreen />
          {children}
        </OfflineAuthProvider>
      </body>
    </html>
  );
}
