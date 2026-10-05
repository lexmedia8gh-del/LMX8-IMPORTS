import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { BrandProvider } from "@/components/brand-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  try {
    const { getBrandSettings } = await import("@/lib/branding");
    const settings = await getBrandSettings();
    const title = `${settings.businessName} | ${settings.tagline}`;
    const description = `${settings.tagline} Premium product sourcing, importation, and logistics management from China to Ghana.`;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        siteName: settings.businessName,
      },
      icons: settings.favicon
        ? {
            icon: settings.favicon,
            apple: settings.favicon,
          }
        : undefined,
    };
  } catch {
    return {
      title: "LMX8 IMPORTS | From China to Ghana",
      description: "Your Goods. Our Priority. Premium product sourcing, importation, and logistics management from China to Ghana.",
    };
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <BrandProvider>{children}</BrandProvider>
      </body>
    </html>
  );
}
