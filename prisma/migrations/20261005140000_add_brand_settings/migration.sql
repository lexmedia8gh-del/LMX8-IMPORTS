-- CreateTable for BrandSettings
CREATE TABLE IF NOT EXISTS "BrandSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "businessName" TEXT NOT NULL DEFAULT 'LMX8 IMPORTS',
    "shortName" TEXT NOT NULL DEFAULT 'LMX8',
    "tagline" TEXT NOT NULL DEFAULT 'Your Goods. Our Priority.',
    "primaryColor" TEXT NOT NULL DEFAULT '#141B47',
    "secondaryColor" TEXT NOT NULL DEFAULT '#355DAF',
    "accentColor" TEXT NOT NULL DEFAULT '#F2901F',
    "mainLogo" TEXT,
    "lightLogo" TEXT,
    "darkLogo" TEXT,
    "brandMark" TEXT,
    "favicon" TEXT,
    "invoiceLogo" TEXT,
    "invoiceFooterLogo" TEXT,
    "invoiceStamp" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,

    CONSTRAINT "BrandSettings_pkey" PRIMARY KEY ("id")
);
