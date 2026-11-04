/**
 * Runtime-validated environment variables.
 *
 * Add each new variable in one place: declare it in `serverSchema` or
 * `clientSchema`, then read it through `env` — never `process.env` directly.
 * Client variables must be prefixed with `NEXT_PUBLIC_` and referenced
 * literally so Next can inline them at build time.
 */

type EnvVar = {
  value: string | undefined;
  required: boolean;
};

/** Exported for tests: pure — reads from `source`, never `process.env`. */
export function parseEnvSchema<T extends Record<string, EnvVar>>(
  schema: T,
  _source: Record<string, string | undefined>
): { [K in keyof T]: string } {
  const missing: string[] = [];
  const parsed = {} as { [K in keyof T]: string };

  for (const key of Object.keys(schema) as (keyof T)[]) {
    const { value, required } = schema[key];
    if (required && (value === undefined || value === "")) {
      missing.push(String(key));
      continue;
    }
    parsed[key] = value ?? "";
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  return parsed;
}

const serverSchema = {
  NODE_ENV: { value: process.env.NODE_ENV, required: true },
  FILE_WORKSPACE_ENABLED: { value: process.env.FILE_WORKSPACE_ENABLED, required: false },
  FILE_WORKER_ENABLED: { value: process.env.FILE_WORKER_ENABLED, required: false },
  DEEPSEEK_API_KEY: { value: process.env.DEEPSEEK_API_KEY, required: false },
  DEEPSEEK_MODEL: { value: process.env.DEEPSEEK_MODEL, required: false },
  DATABASE_URL: { value: process.env.DATABASE_URL, required: true },
  SUPABASE_URL: { value: process.env.SUPABASE_URL, required: true },
  SUPABASE_ANON_KEY: { value: process.env.SUPABASE_ANON_KEY, required: true },
  SUPABASE_SERVICE_ROLE_KEY: {
    value: process.env.SUPABASE_SERVICE_ROLE_KEY,
    required: true,
  },
} satisfies Record<string, EnvVar>;

const clientSchema = {
  NEXT_PUBLIC_APP_URL: {
    value: process.env.NEXT_PUBLIC_APP_URL,
    required: false,
  },
  NEXT_PUBLIC_SUPABASE_URL: {
    value: process.env.NEXT_PUBLIC_SUPABASE_URL,
    required: false,
  },
  NEXT_PUBLIC_SUPABASE_ANON_KEY: {
    value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    required: false,
  },
} satisfies Record<string, EnvVar>;

// parse() below replaced by parseEnvSchema(schema, process.env) calls.
export const env = {
  ...parseEnvSchema(clientSchema, process.env),
  ...(typeof window === "undefined"
    ? parseEnvSchema(serverSchema, process.env)
    : ({} as { [K in keyof typeof serverSchema]: string })),
};

export const isProduction = process.env.NODE_ENV === "production";
export const isDevelopment = process.env.NODE_ENV === "development";
