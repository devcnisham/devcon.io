"use client";

import * as React from "react";
import { AuthAlert } from "@/features/auth/components/auth-alert";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  forgotPasswordSchema,
  type ForgotPasswordValues,
} from "@/features/auth/lib/schemas";
import {
  forgotPasswordAction,
  issueCsrfToken,
} from "@/features/auth/lib/actions";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ForgotPasswordForm({ csrfToken }: { csrfToken: string }) {
  const [formError, setFormError] = React.useState<string | null>(null);
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [sentMessage, setSentMessage] = React.useState<string | null>(null);

  // A page render cannot write the CSRF cookie (Server Components cannot
  // modify cookies), so the token is written to its cookie copy on mount.
  React.useEffect(() => {
    void issueCsrfToken(csrfToken);
  }, [csrfToken]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await forgotPasswordAction(values.email, csrfToken);
      if (!result.ok) {
        setFormError(result.message);
        return;
      }
      setSentTo(values.email.trim());
      setSentMessage(result.message ?? null);
    } catch {
      setFormError("Something went wrong. Try again.");
    }
  });

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4">
        <AuthAlert
          variant="success"
          title="Check your email"
          message={
            sentMessage ??
            `If an account exists for ${sentTo}, a reset link is on its way.`
          }
        />
        <p className="text-muted-foreground text-sm">
          The link expires in 60 minutes. Nothing arrived? Check spam, or{" "}
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="text-foreground underline underline-offset-4"
          >
            try another address
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {formError ? <AuthAlert variant="error" message={formError} /> : null}

      <FieldGroup>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={!!errors.email}
            disabled={isSubmitting}
            {...register("email")}
          />
          <FieldDescription>
            We will send a reset link to this address.
          </FieldDescription>
          <FieldError errors={[errors.email]} />
        </Field>
      </FieldGroup>

      <SubmitButton pending={isSubmitting} pendingLabel="Sending link…">
        Send reset link
      </SubmitButton>
    </form>
  );
}
