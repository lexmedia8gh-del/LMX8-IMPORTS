import type { Metadata } from "next";
import "./globals.css";
import { BrandProvider } from "@/components/brand-provider";
import { getBrandSettingsAction } from "@/app/actions/branding";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  try {
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
    initialBranding = await getBrandSettingsAction();
  } catch (err) {
    console.warn("[RootLayout] Unable to load initial branding on server:", err);
  }

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <BrandProvider initialBranding={initialBranding}>{children}</BrandProvider>
      </body>
    </html>
  );
}
