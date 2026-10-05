import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kvesvhkixaufoiwqnfea.supabase.co";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "shipment-files";

let supabaseAdminInstance: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!supabaseServiceRoleKey) {
    return null;
  }
  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseAdminInstance;
}

/**
 * Ensures the private bucket exists in Supabase Storage.
 */
export async function ensurePrivateBucket(bucketName: string = STORAGE_BUCKET): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return false;

  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      console.error("[Storage] Error listing buckets:", error.message);
      return false;
    }

    const exists = buckets?.some((b) => b.name === bucketName);
    if (!exists) {
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: false, // Strict private bucket requirement
        fileSizeLimit: 15 * 1024 * 1024, // 15MB limit
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"],
      });
      if (createError) {
        console.error("[Storage] Error creating private bucket:", createError.message);
        return false;
      }
      console.log(`[Storage] Created private bucket: ${bucketName}`);
    }
    return true;
  } catch (err) {
    console.error("[Storage] Unexpected error checking bucket:", err);
    return false;
  }
}

/**
 * Uploads a file buffer to private Supabase Storage.
 */
export async function uploadFileToPrivateStorage(params: {
  bucket?: string;
  path: string;
  fileBuffer: Buffer | Uint8Array;
  contentType: string;
}): Promise<{ path: string } | { error: string }> {
  const supabase = getSupabaseAdminClient();
  const bucket = params.bucket || STORAGE_BUCKET;

  if (!supabase) {
    return {
      error: "SUPABASE_SERVICE_ROLE_KEY is not configured in .env. Real file storage requires Supabase service role key.",
    };
  }

  // Ensure bucket is created
  await ensurePrivateBucket(bucket);

  const { data, error } = await supabase.storage.from(bucket).upload(params.path, params.fileBuffer, {
    contentType: params.contentType,
    upsert: false,
  });

  if (error) {
    console.error("[Storage] Upload failed:", error.message);
    return { error: error.message };
  }

  return { path: data.path };
}

/**
 * Generates a short-lived signed URL for an authorized viewer.
 * Expiry defaults to 900 seconds (15 minutes).
 */
export async function generateSignedUrl(
  path: string,
  expiresInSeconds: number = 900,
  bucket: string = STORAGE_BUCKET
): Promise<string | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
    if (error) {
      console.error("[Storage] Error creating signed URL:", error.message);
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    console.error("[Storage] Failed to generate signed URL:", err);
    return null;
  }
}

/**
 * Generates a signed upload URL to allow direct client-side upload
 * without exposing the service role key or passing file bytes through Next.js.
 */
export async function generateSignedUploadUrl(
  path: string,
  bucket: string = STORAGE_BUCKET
): Promise<{ signedUrl: string; token: string; path: string } | { error: string }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { error: "Storage not configured." };
  }

  await ensurePrivateBucket(bucket);

  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
    if (error) {
      console.error("[Storage] Error creating signed upload URL:", error.message);
      return { error: error.message };
    }
    return { signedUrl: data.signedUrl, token: data.token, path: data.path };
  } catch (err: any) {
    console.error("[Storage] Failed to generate signed upload URL:", err);
    return { error: err?.message || "Storage exception" };
  }
}

/**
 * Permanently deletes a file from Supabase Storage.
 * Idempotent: Does not fail if the file is already gone.
 */
export async function deleteFileFromStorage(
  path: string,
  bucket: string = STORAGE_BUCKET
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { success: true }; // Graceful bypass when key not configured
  }

  try {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) {
      console.warn(`[Storage] Warning deleting object at ${path}:`, error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn(`[Storage] Exception deleting object at ${path}:`, err?.message || err);
    return { success: false, error: err?.message || "Storage deletion exception" };
  }
}
