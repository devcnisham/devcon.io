import Link from "next/link";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export default function LandingPage() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        {siteConfig.name}
      </h1>
      <p className="text-muted-foreground max-w-xl text-lg">
        {siteConfig.description}. Landing copy is a placeholder until the
        product scope is defined.
      </p>
      <div className="flex gap-3">
        <Button size="lg" nativeButton={false} render={<Link href="/signup" />}>
          Get started
        </Button>
        <Button
          size="lg"
          variant="outline"
          nativeButton={false}
          render={<Link href="/dashboard" />}
        >
          View dashboard
        </Button>
      </div>
    </section>
  );
}
