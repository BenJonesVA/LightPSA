import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { NavShell } from "@/components/nav-shell";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PSA",
  description: "Professional Services Automation & Ticketing",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("psa-theme");if(t==="dark")document.documentElement.setAttribute("data-theme","dark");}catch(e){}`,
          }}
        />
      </head>
      <body
        className={`${plexSans.variable} ${plexMono.variable} min-h-screen antialiased`}
        style={{ fontFamily: "var(--font)" }}
      >
        <NavShell>{children}</NavShell>
      </body>
    </html>
  );
}
