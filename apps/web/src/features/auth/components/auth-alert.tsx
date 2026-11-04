"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** Error and success banners shared by every auth form. */
export function AuthAlert({
  variant,
  title,
  message,
}: {
  variant: "error" | "success";
  title?: string;
  message: string;
}) {
  const isError = variant === "error";
  return (
    <Alert
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className={isError ? "border-destructive/40 text-destructive" : undefined}
    >
      {isError ? (
        <AlertCircle className="size-4" />
      ) : (
        <CheckCircle2 className="size-4" />
      )}
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
