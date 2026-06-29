import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Apoyo Terremoto Venezuela",
  description:
    "Plataforma comunitaria de campañas de donación verificadas para los afectados por el terremoto en Venezuela.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8">
          {children}
        </main>
        <footer className="border-t border-border py-6 text-center text-sm text-muted">
          Apoyo Terremoto Venezuela · Plataforma comunitaria · Verifica siempre
          antes de donar.
        </footer>
      </body>
    </html>
  );
}
