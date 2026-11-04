import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { FileError } from "./access";
export const FILE_BUCKET = "project-files";
export function fileStorage() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from(FILE_BUCKET);
}
export async function signedFile(path: string): Promise<string> {
  const { data, error } = await fileStorage().createSignedUrl(path, 300);
  if (error || !data)
    throw new FileError(503, "The download is unavailable. Try again.");
  return data.signedUrl;
}
