import "server-only";
import { createSupabaseServerClient } from "@/lib/server/supabase";
import { env } from "@/lib/env";
import { fileDb as sql } from "./db";
export async function projectsWithFiles(): Promise<
  { id: string; name: string; description: string | null }[]
> {
  if (env.FILE_WORKSPACE_ENABLED !== "true") return [];
  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email_confirmed_at) return [];
  return await sql<
    { id: string; name: string; description: string | null }[]
  >`select p.id,p.name,p.description from projects p join workspaces w on w.id=p.workspace_id join workspace_members m on m.workspace_id=p.workspace_id where m.user_id=${data.user.id} and m.role in ('owner','admin','member','viewer') and p.deleted_at is null and w.deleted_at is null order by p.updated_at desc limit 200`;
}
