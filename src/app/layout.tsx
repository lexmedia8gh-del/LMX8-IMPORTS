import type { Metadata } from "next";
import "./globals.css";
import { BrandProvider } from "@/components/brand-provider";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "LMX8 IMPORTS | From China to Ghana",
  description: "Your Goods. Our Priority. Premium product sourcing, importation, and logistics management from China to Ghana.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <BrandProvider>{children}</BrandProvider>
      </body>
    </html>
  );
}
