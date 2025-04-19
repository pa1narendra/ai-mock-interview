import type { Metadata } from "next";
import { Mona_Sans} from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const mona_sans = Mona_Sans({
  variable: "--font-mona-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pavan's Interview Prep",
  description: "A Customized AI Platform for Interview Preparation to students for free",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${mona_sans.className} antialiased pattern`}
      >
        {children}

        <Toaster />

      </body>
    </html>
  );
}
