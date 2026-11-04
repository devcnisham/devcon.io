"use client";

import * as React from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthAlert } from "@/features/auth/components/auth-alert";
import { PasswordField } from "@/features/auth/components/password-field";
import { PasswordStrength } from "@/features/auth/components/password-strength";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { signupSchema, type SignupValues } from "@/features/auth/lib/schemas";
import { issueCsrfToken, signupAction } from "@/features/auth/lib/actions";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function SignupForm({
  csrfToken,
  onSuccess,
}: {
  csrfToken: string;
  onSuccess?: () => void;
}) {
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);

  // A page render cannot write the CSRF cookie (Server Components cannot
  // modify cookies), so the token is written to its cookie copy on mount.
  React.useEffect(() => {
    void issueCsrfToken(csrfToken);
  }, [csrfToken]);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false as unknown as true,
    },
  });

  const password = useWatch({ control, name: "password" });
  const acceptTerms = useWatch({ control, name: "acceptTerms" });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await signupAction({ ...values, csrfToken });
      if (!result.ok) {
        setFormError(result.message);
        return;
      }
      setSubmitted(true);
      onSuccess?.();
    } catch {
      setFormError("Something went wrong. Try again.");
    }
  });

  if (submitted) {
    return (
      <div className="flex flex-col gap-4">
        <AuthAlert
          variant="success"
          message="Check your email to verify your account."
        />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {formError ? <AuthAlert variant="error" message={formError} /> : null}

      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input
            id="name"
            autoComplete="name"
            placeholder="Ada Lovelace"
            aria-invalid={!!errors.name}
            disabled={isSubmitting}
            {...register("name")}
          />
          <FieldError errors={[errors.name]} />
        </Field>

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
          <FieldLabel htmlFor="password">Password</FieldLabel>
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
          <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
          <PasswordField
            id="confirmPassword"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
            disabled={isSubmitting}
            {...register("confirmPassword")}
          />
          <FieldError errors={[errors.confirmPassword]} />
        </Field>

        <Field orientation="horizontal" data-invalid={!!errors.acceptTerms}>
          <Checkbox
            id="acceptTerms"
            checked={!!acceptTerms}
            disabled={isSubmitting}
            onCheckedChange={(checked) =>
              setValue("acceptTerms", checked as true, {
                shouldValidate: true,
              })
            }
          />
          <FieldLabel htmlFor="acceptTerms" className="font-normal">
            I agree to the terms of service and privacy policy
          </FieldLabel>
        </Field>
        <FieldError errors={[errors.acceptTerms]} />
      </FieldGroup>

      <SubmitButton pending={isSubmitting} pendingLabel="Creating account…">
        Create account
      </SubmitButton>

      <p className="text-muted-foreground text-center text-xs">
        By continuing you agree to our{" "}
        <Link href="/" className="underline underline-offset-4">
          terms
        </Link>
        .
      </p>
    </form>
  );
}
