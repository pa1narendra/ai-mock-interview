import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#050a12",
};

export const metadata: Metadata = {
  title: {
    default: "Mockstar — AI Voice Mock Interviews",
    template: "%s | Mockstar",
  },
  description:
    "Rehearse real interviews out loud with an AI interviewer. Tailored questions, live voice conversation, and scored feedback in minutes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-body`}>
        {children}
        <Toaster theme="dark" position="top-center" />
      </body>
    </html>
  );
}
