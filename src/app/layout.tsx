import type { Metadata } from "next";
import { Playfair_Display, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Golden Hour — Vintage Film Color Grade",
  description:
    "Drop a photo, dial in the warmth, and watch it become golden-hour film. A cinematic color-grade editor that runs entirely in your browser.",
  keywords: [
    "Golden Hour",
    "film grain",
    "color grade",
    "photo editor",
    "vintage film",
    "WebGL",
  ],
  authors: [{ name: "Golden Hour" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Golden Hour — Vintage Film Color Grade",
    description:
      "Drop a photo, dial in the warmth, watch it become golden-hour film.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Golden Hour — Vintage Film Color Grade",
    description:
      "Drop a photo, dial in the warmth, watch it become golden-hour film.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${playfair.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground font-sans`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
