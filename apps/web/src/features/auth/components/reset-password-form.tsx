"use client";

import * as React from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthAlert } from "@/features/auth/components/auth-alert";
import { PasswordField } from "@/features/auth/components/password-field";
import { PasswordStrength } from "@/features/auth/components/password-strength";
import { SubmitButton } from "@/features/auth/components/submit-button";
import {
  resetPasswordSchema,
  type ResetPasswordValues,
} from "@/features/auth/lib/schemas";
import {
  issueCsrfToken,
  resetPasswordAction,
} from "@/features/auth/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

/**
 * `token` comes from the reset link. With no backend yet it is only checked for
 * presence — an absent token renders the invalid-link state so that path is
 * reachable.
 */
export function ResetPasswordForm({
  token,
  csrfToken,
}: {
  token?: string;
  csrfToken: string;
}) {
  const [formError, setFormError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  // A page render cannot write the CSRF cookie (Server Components cannot
  // modify cookies), so the token is written to its cookie copy on mount.
  React.useEffect(() => {
    void issueCsrfToken(csrfToken);
  }, [csrfToken]);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const password = useWatch({ control, name: "password" });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await resetPasswordAction(values.password, csrfToken);
      if (!result.ok) {
        setFormError(result.message);
        return;
      }
      setDone(true);
    } catch {
      setFormError("Something went wrong. Try again.");
    }
  });

  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <AuthAlert
          variant="error"
          title="This link is invalid or expired"
          message="Reset links work once and expire after 60 minutes."
        />
        <Button
          nativeButton={false}
          render={<Link href="/forgot-password" />}
          className="w-full"
          size="lg"
        >
          Request a new link
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <AuthAlert
          variant="success"
          title="Password updated"
          message="Sign in with your new password."
        />
        <Button
          nativeButton={false}
          render={<Link href="/login" />}
          className="w-full"
          size="lg"
        >
          Go to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {formError ? <AuthAlert variant="error" message={formError} /> : null}

      <FieldGroup>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">New password</FieldLabel>
          <PasswordField
            id="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            disabled={isSubmitting}
            {...register("password")}
          />
          <PasswordStrength value={password} />
          <FieldError errors={[errors.password]} />
        </Field>

        <Field data-invalid={!!errors.confirmPassword}>
          <FieldLabel htmlFor="confirmPassword">
            Confirm new password
          </FieldLabel>
          <PasswordField
            id="confirmPassword"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
            disabled={isSubmitting}
            {...register("confirmPassword")}
          />
          <FieldError errors={[errors.confirmPassword]} />
        </Field>
      </FieldGroup>

      <SubmitButton pending={isSubmitting} pendingLabel="Updating password…">
        Update password
      </SubmitButton>
    </form>
  );
}
