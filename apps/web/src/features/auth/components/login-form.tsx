"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthAlert } from "@/features/auth/components/auth-alert";
import { PasswordField } from "@/features/auth/components/password-field";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { loginSchema, type LoginValues } from "@/features/auth/lib/schemas";
import { issueCsrfToken, loginAction } from "@/features/auth/lib/actions";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function LoginForm({ csrfToken }: { csrfToken: string }) {
  const [formError, setFormError] = React.useState<string | null>(null);

  // A page render cannot write the CSRF cookie (Server Components cannot
  // modify cookies), so the token is written to its cookie copy on mount.
  React.useEffect(() => {
    void issueCsrfToken(csrfToken);
  }, [csrfToken]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await loginAction({ ...values, csrfToken });
      if (!result.ok) setFormError(result.message);
    } catch {
      setFormError("Something went wrong. Try again.");
    }
  });

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
          <FieldError errors={[errors.email]} />
        </Field>

        <Field data-invalid={!!errors.password}>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Link
              href="/forgot-password"
              className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordField
            id="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            disabled={isSubmitting}
            {...register("password")}
          />
          <FieldError errors={[errors.password]} />
        </Field>
      </FieldGroup>

      <SubmitButton pending={isSubmitting} pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
