import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { BrandProvider } from "@/components/brand-provider";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-heading",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const { getBrandSettingsAction } = await import("@/app/actions/branding");
    const settings = await getBrandSettingsAction();
    const businessName = settings?.businessName || "LMX8 IMPORTS";
    const tagline = settings?.tagline || "Your Goods. Our Priority.";
    const title = `${businessName} | ${tagline}`;
    const description = `${tagline} Premium product sourcing, importation, and logistics management from China to Ghana.`;
    const favicon = settings?.faviconUrl || settings?.brandMarkUrl || settings?.mainLogoUrl;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        siteName: businessName,
      },
      ...(favicon ? { icons: { icon: favicon } } : {}),
    };
  } catch {
    return {
      title: "LMX8 IMPORTS | From China to Ghana",
      description: "Your Goods. Our Priority. Premium product sourcing, importation, and logistics management from China to Ghana.",
    };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let initialBranding = null;
  try {
    const { getBrandSettingsAction } = await import("@/app/actions/branding");
    initialBranding = await getBrandSettingsAction();
  } catch {
    // Ignore server-side branding fetch errors, fallback to default
  }

  return (
    <html lang="en" className={`${inter.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <BrandProvider initialBranding={initialBranding}>{children}</BrandProvider>
      </body>
    </html>
  );
}
