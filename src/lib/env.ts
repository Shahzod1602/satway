import { z } from "zod";

// Validated once, server-side. Fail fast on missing critical config rather
// than crashing deep inside a request with a confusing `undefined` error.

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXTAUTH_SECRET: z
    .string()
    .min(16, "NEXTAUTH_SECRET must be set to a strong random value (>=16 chars)"),
  NEXTAUTH_URL: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

let cached: z.infer<typeof schema> | null = null;

export function env() {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `  - ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${msg}`);
  }
  // In production, reject the known dev placeholder secret outright.
  if (
    parsed.data.NODE_ENV === "production" &&
    parsed.data.NEXTAUTH_SECRET.includes("change-me")
  ) {
    throw new Error("NEXTAUTH_SECRET is still the dev placeholder — set a real secret in production.");
  }
  cached = parsed.data;
  return cached;
}

/** Vertex AI config, validated lazily because it's only needed for AI features. */
export function vertexConfig() {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || "global";
  if (!project) {
    throw new Error("GOOGLE_CLOUD_PROJECT is not configured — AI test generation is unavailable.");
  }
  return { project, location, model: process.env.GEMINI_MODEL || "gemini-2.5-pro" };
}
