import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * ESLint config — includes WrapShop-specific import boundaries:
 *
 *   • Client code (anything without a leading `import "server-only"`) must NOT
 *     reach into `@/server/**`. The `server-only` package enforces this at
 *     runtime; this rule surfaces it at build time.
 *   • Modules must not import each other cross-domain. Talk via
 *     `@/server/services/*` or `@/lib/*`.
 *   • Bare `@/server/db` is discouraged outside of the narrow allowlist —
 *     tenant-scoped writes go through `dbFor()` from `@/server/db-scoped`.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "node_modules/**",
    "next-env.d.ts",
  ]),
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // Forbid `useState` / hooks imported directly from `react` in Server
      // Components is already caught by Next; keep TS strictness.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Client code must never import @/server/*
    files: [
      "src/modules/**/*.{ts,tsx}",
      "src/hooks/**/*.{ts,tsx}",
      "src/stores/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server/*", "@/server"],
              message:
                "Client / module code must not import from @/server. Route through tRPC or a Server Component.",
            },
          ],
        },
      ],
    },
  },
  {
    // Warn against bare `@/server/db` outside of the narrow allowlist.
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/server/db.ts",
      "src/server/db-scoped.ts",
      "src/server/auth/**",
      "src/server/integrations/**/webhooks.ts",
      "src/server/features/service.ts",
      "src/app/onboarding/actions.ts",
      "src/app/auth/callback/route.ts",
      "src/app/(app)/admin/integrations/page.tsx",
      "prisma/seed.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "@/server/db",
              importNames: ["prisma"],
              message:
                "Prefer `dbFor(orgId)` from @/server/db-scoped for tenant safety.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
