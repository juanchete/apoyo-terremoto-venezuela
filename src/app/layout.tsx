import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
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
    <html
      lang="es"
      className={`${fraunces.variable} ${hanken.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <main className="flex-1 w-full max-w-6xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
          {children}
        </main>
        <footer className="mt-12 border-t border-border">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted">
            <span className="font-display text-base text-foreground">
              Apoyo Terremoto Venezuela
            </span>
            <span>Plataforma comunitaria · Verifica siempre antes de donar.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
