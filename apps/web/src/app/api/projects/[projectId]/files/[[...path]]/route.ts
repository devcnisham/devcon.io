import { handleFilesRequest } from "@/lib/server/files/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
type Context = { params: Promise<{ projectId: string; path?: string[] }> };
async function handle(request: Request, context: Context) {
  return handleFilesRequest(request, await context.params);
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
