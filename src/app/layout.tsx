import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { BrandProvider } from "@/components/brand-provider";

export const dynamic = "force-dynamic";

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
    const businessName = settings?.businessName || "LMX8 IMPORTS";
    const tagline = settings?.tagline || "Your Goods. Our Priority.";
    const title = `${businessName} | ${tagline}`;
    const description = `${tagline} Premium product sourcing, importation, and logistics management from China to Ghana.`;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        siteName: businessName,
      },
      ...(settings?.favicon ? { icons: { icon: settings.favicon } } : {}),
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
