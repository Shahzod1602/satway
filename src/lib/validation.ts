import { z } from "zod";

/** Parse and validate a JSON request body against a Zod schema. */
export async function parseJson<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new z.ZodError([
      { code: "custom", message: "Invalid JSON body.", path: [] },
    ]);
  }
  return schema.parse(raw);
}

// Reusable field schemas.
export const emailSchema = z
  .email("Enter a valid email address.")
  .trim()
  .toLowerCase()
  .max(254);

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(200);

export const otpCodeSchema = z.string().regex(/^\d{6}$/, "Code must be 6 digits.");
