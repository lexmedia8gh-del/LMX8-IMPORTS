"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminSession, getSession } from "@/lib/auth";
import { 
  getBrandSettings, 
  clearBrandingCache, 
  BrandSettingsType, 
  ResolvedBrandSettings, 
  DEFAULT_BRANDING, 
  ensureBrandSettingsTable 
} from "@/lib/branding";
import { STORAGE_BUCKET, generateSignedUrl, generateSignedUploadUrl, deleteFileFromStorage } from "@/lib/storage";
import { revalidatePath } from "next/cache";

// Helper to resolve Supabase storage paths to short-lived signed URLs for safe browser display
async function resolveLogoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  try {
    const url = await generateSignedUrl(path, 3600, STORAGE_BUCKET); // 1 hour expiry
    return url || path;
  } catch (e) {
    console.error(`[Branding Action] Error signing url for ${path}:`, e);
    return path;
  }
}

export async function getBrandSettingsAction() {
  const settings = await getBrandSettings();
  
  // Resolve signed URLs for each uploaded asset
  const [
    mainLogoUrl,
    lightLogoUrl,
    darkLogoUrl,
    brandMarkUrl,
    faviconUrl,
    invoiceLogoUrl,
    invoiceFooterLogoUrl,
    invoiceStampUrl,
  ] = await Promise.all([
    resolveLogoUrl(settings.mainLogo),
    resolveLogoUrl(settings.lightLogo),
    resolveLogoUrl(settings.darkLogo),
    resolveLogoUrl(settings.brandMark),
    resolveLogoUrl(settings.favicon),
    resolveLogoUrl(settings.invoiceLogo),
    resolveLogoUrl(settings.invoiceFooterLogo),
    resolveLogoUrl(settings.invoiceStamp),
  ]);

  return {
    ...settings,
    mainLogoUrl,
    lightLogoUrl,
    darkLogoUrl,
    brandMarkUrl,
    faviconUrl,
    invoiceLogoUrl,
    invoiceFooterLogoUrl,
    invoiceStampUrl,
    // Provide string representation of original paths for DB referencing
    paths: {
      mainLogo: settings.mainLogo,
      lightLogo: settings.lightLogo,
      darkLogo: settings.darkLogo,
      brandMark: settings.brandMark,
      favicon: settings.favicon,
      invoiceLogo: settings.invoiceLogo,
      invoiceFooterLogo: settings.invoiceFooterLogo,
      invoiceStamp: settings.invoiceStamp,
    }
  };
}

export async function updateBrandIdentityAction(data: {
  businessName: string;
  shortName: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}) {
  const admin = await requireAdminSession();

  // Color format validation
  const hexRegex = /^#[0-9A-Fa-f]{6}$/;
  if (!hexRegex.test(data.primaryColor) || !hexRegex.test(data.secondaryColor) || !hexRegex.test(data.accentColor)) {
    return { error: "Colors must be valid 6-character Hex codes (e.g., #141B47)." };
  }

  if (!data.businessName.trim() || !data.shortName.trim()) {
    return { error: "Business name and short name cannot be empty." };
  }

  try {
    await ensureBrandSettingsTable();
    const settings = await prisma.brandSettings.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        businessName: data.businessName,
        shortName: data.shortName,
        tagline: data.tagline,
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        accentColor: data.accentColor,
        updatedBy: admin.id,
      },
      update: {
        businessName: data.businessName,
        shortName: data.shortName,
        tagline: data.tagline,
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        accentColor: data.accentColor,
        updatedBy: admin.id,
      },
    });

    clearBrandingCache();
    try {
      revalidatePath("/", "layout");
    } catch (e) {
      // Non-blocking in background/test contexts
    }

    // Log the change
    await prisma.auditLog.create({
      data: {
        action: "BRANDING_UPDATED",
        entityType: "BrandSettings",
        entityId: "singleton",
        description: `Branding identity and colors updated by ${admin.name}. Name: ${data.businessName}, Colors: ${data.primaryColor}, ${data.secondaryColor}, ${data.accentColor}`,
        adminId: admin.id,
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error("[Branding Action] Error updating brand identity:", error);
    return { error: error?.message || "Failed to update brand settings." };
  }
}

export async function initiateBrandingAssetUploadAction(
  assetType: keyof Omit<BrandSettingsType, "businessName" | "shortName" | "tagline" | "primaryColor" | "secondaryColor" | "accentColor">,
  filename: string,
  mimeType: string,
  size: number
) {
  const admin = await requireAdminSession();

  // File size validation (max 5MB)
  const MAX_SIZE = 5 * 1024 * 1024;
  if (size > MAX_SIZE) {
    return { error: "Branding files are restricted to a maximum of 5MB." };
  }

  // File format validation
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/svg+xml",
    "image/x-icon",
    "image/vnd.microsoft.icon",
  ];
  if (!allowedMimeTypes.includes(mimeType)) {
    return { error: `Unsupported file type (${mimeType}). Allowed formats: JPG, PNG, WEBP, GIF, SVG, ICO.` };
  }

  // Generate safe storage path
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueId = crypto.randomUUID();
  const objectPath = `branding/${assetType}/${uniqueId}-${safeFilename}`;

  const uploadResult = await generateSignedUploadUrl(objectPath, STORAGE_BUCKET);

  if ("error" in uploadResult) {
    console.error("[Branding Action] Direct upload auth failed:", uploadResult.error);
    return { error: `Direct upload auth failed: ${uploadResult.error}` };
  }

  return {
    success: true,
    signedUrl: uploadResult.signedUrl,
    token: uploadResult.token,
    objectPath: uploadResult.path,
  };
}

export async function confirmBrandingAssetUploadAction(
  assetType: keyof Omit<BrandSettingsType, "businessName" | "shortName" | "tagline" | "primaryColor" | "secondaryColor" | "accentColor">,
  objectPath: string
) {
  const admin = await requireAdminSession();

  if (!objectPath.startsWith(`branding/${assetType}/`)) {
    return { error: "Invalid path verification for branding upload." };
  }

  try {
    // 1. Fetch current settings to see if there is an old file to clean up
    await ensureBrandSettingsTable();
    const current = await prisma.brandSettings.findUnique({
      where: { id: "singleton" },
    });

    const oldPath = current ? (current[assetType] as string | null) : null;

    // 2. Perform the database update
    await prisma.brandSettings.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        [assetType]: objectPath,
        updatedBy: admin.id,
      },
      update: {
        [assetType]: objectPath,
        updatedBy: admin.id,
      },
    });

    clearBrandingCache();
    try {
      revalidatePath("/", "layout");
    } catch (e) {}

    // 3. Delete the old file from Supabase storage asynchronously to clean up space
    if (oldPath && oldPath !== objectPath && !oldPath.startsWith("http")) {
      deleteFileFromStorage(oldPath, STORAGE_BUCKET).catch(err => {
        console.warn(`[Branding Action] Non-blocking warn cleaning up old branding asset at ${oldPath}:`, err);
      });
    }

    // 4. Log the audit
    await prisma.auditLog.create({
      data: {
        action: "BRANDING_LOGO_UPDATED",
        entityType: "BrandSettings",
        entityId: "singleton",
        description: `Branding asset '${assetType}' updated with file path '${objectPath}' by ${admin.name}`,
        adminId: admin.id,
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error("[Branding Action] Error confirming logo upload:", error);
    return { error: error?.message || "Failed to finalize logo save." };
  }
}

export async function removeBrandingAssetAction(
  assetType: keyof Omit<BrandSettingsType, "businessName" | "shortName" | "tagline" | "primaryColor" | "secondaryColor" | "accentColor">
) {
  const admin = await requireAdminSession();

  try {
    await ensureBrandSettingsTable();
    const current = await prisma.brandSettings.findUnique({
      where: { id: "singleton" },
    });

    if (!current) return { success: true };

    const oldPath = current[assetType] as string | null;

    await prisma.brandSettings.update({
      where: { id: "singleton" },
      data: {
        [assetType]: null,
        updatedBy: admin.id,
      },
    });

    clearBrandingCache();
    try {
      revalidatePath("/", "layout");
    } catch (e) {}

    if (oldPath && !oldPath.startsWith("http")) {
      deleteFileFromStorage(oldPath, STORAGE_BUCKET).catch(err => {
        console.warn(`[Branding Action] Non-blocking warn deleting branding asset at ${oldPath}:`, err);
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "BRANDING_LOGO_REMOVED",
        entityType: "BrandSettings",
        entityId: "singleton",
        description: `Branding asset '${assetType}' reset to default fallback by ${admin.name}`,
        adminId: admin.id,
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error("[Branding Action] Error resetting branding asset:", error);
    return { error: error?.message || "Failed to reset asset." };
  }
}
