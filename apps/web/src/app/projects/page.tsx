import { projectsWithFiles } from "@/lib/server/files/projects";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";

export const metadata: Metadata = {
  title: "Projects",
};

export default async function ProjectsPage() {
  const projects = await projectsWithFiles();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm">
            Everything you are building in this workspace.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/projects/new" />}>
          <Plus className="size-4" />
          New project
        </Button>
      </div>

      {projects.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}/files`}
              className="hover:bg-muted/50 focus-visible:ring-ring rounded-xl border p-5 transition-colors focus-visible:ring-2"
            >
              <h2 className="font-semibold">{project.name}</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {project.description ||
                  "Open documents, slides, spreadsheets, and project chat."}
              </p>
              <span className="mt-4 block text-sm underline">Open files →</span>
            </Link>
          ))}
        </div>
      ) : (
        <Empty>
          <EmptyTitle>No projects yet</EmptyTitle>
          <EmptyDescription>
            Create one to take it from idea through to production.
          </EmptyDescription>
          <Button nativeButton={false} render={<Link href="/projects/new" />}>
            Create your first project
          </Button>
        </Empty>
      )}
    </div>
  );
}
