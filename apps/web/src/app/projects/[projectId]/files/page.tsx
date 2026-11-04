import { notFound, redirect } from "next/navigation";
import { FileWorkspace } from "@/features/files";
import { authorizeProject, FileError } from "@/lib/server/files/access";
export const metadata = { title: "Project files" };
export default async function ProjectFilesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  try {
    await authorizeProject(projectId);
  } catch (error) {
    if (error instanceof FileError && error.status === 401)
      redirect(
        `/login?next=${encodeURIComponent(`/projects/${projectId}/files`)}`
      );
    notFound();
  }
  return <FileWorkspace projectId={projectId} />;
}
