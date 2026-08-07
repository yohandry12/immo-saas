import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { QueryProvider } from "@/lib/QueryProvider";
import "./globals.css";

// Inter = substitut libre d'Airbnb Cereal (DESIGN.md : Circular/Inter/DM Sans).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Immo — Gestion locative",
  description:
    "Gérez vos immeubles au Cameroun à distance : loyers, baux, charges, Mobile Money.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
