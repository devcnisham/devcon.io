import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Shared shell for every auth screen: title, description, body, and an
 * optional footer line with a single link.
 */
export function AuthCard({
  title,
  description,
  children,
  footerText,
  footerLinkLabel,
  footerLinkHref,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footerText?: string;
  footerLinkLabel?: string;
  footerLinkHref?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {children}
        {footerText && footerLinkLabel && footerLinkHref ? (
          <p className="text-muted-foreground text-center text-sm">
            {footerText}{" "}
            <Link
              href={footerLinkHref}
              className="text-foreground font-medium underline underline-offset-4"
            >
              {footerLinkLabel}
            </Link>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
