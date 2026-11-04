import type { Metadata } from "next";
import Link from "next/link";
import { GitHubConnect } from "@/features/integrations/github";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Import from GitHub",
};

export default function GitHubImportPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Import from GitHub
        </h1>
        <p className="text-muted-foreground text-sm">
          Pick a repository and branch. devstep reads the file tree over the API
          to work out what the project is built with.
        </p>
      </div>

      {/*
        No OAuth App is registered, so the connect button would go nowhere.
        Saying that plainly beats offering a control that fails.
      */}
      <GitHubConnect
        status={{
          state: "unavailable",
          reason:
            "GitHub is not configured yet. Connecting needs a registered OAuth App (client ID and secret) and a signed-in session to hold the token — see docs/blocker.md.",
        }}
      />

      <p className="text-muted-foreground text-sm">
        Importing a folder from this machine works today —{" "}
        <Link
          href="/projects/import"
          className="text-foreground underline underline-offset-4"
        >
          import a local project
        </Link>
        .
      </p>

      <div>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/projects/new" />}
        >
          Back to project setup
        </Button>
      </div>
    </div>
  );
}
