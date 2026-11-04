import "server-only";

import { createSupabaseServerClient } from "@/lib/server/supabase";
import { setSessionProvider } from "@/features/auth/server";
import { mapSupabaseSession } from "@/features/auth/server/session-provider";

/**
 * Boot-time wiring that crosses feature boundaries — lives in lib, not in a
 * feature, because features never import each other.
 *
 * The provider contract (token) is satisfied by asking Supabase for the
 * current session; Supabase's own cookie is the token. The existing
 * SESSION_COOKIE is still written by the login action so middleware's
 * existence check keeps working unchanged.
 */
export async function registerAuthSessionProvider(): Promise<void> {
  setSessionProvider(async () => {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getSession();
    return data.session ? mapSupabaseSession(data.session) : null;
  });
}
