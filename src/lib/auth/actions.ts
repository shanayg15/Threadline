"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { z } from "zod";

import { db } from "@/lib/db/client";
import * as brands from "@/lib/db/repos/brands";
import { isUniqueViolation } from "@/lib/db/repos/_util";
import * as users from "@/lib/db/repos/users";
import { brands as brandsTable, users as usersTable } from "@/lib/db/schema";
import { signIn, signOut } from "./index";

/** Logout: clear the session and return to /login. */
export async function logout(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

/** Only allow same-origin relative paths as a post-login redirect (no open redirect). */
function safeRedirect(value: FormDataEntryValue | null): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/conversations";
}

/** Login: verify credentials and redirect into the console. */
export async function authenticate(
  _prev: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: safeRedirect(formData.get("callbackUrl")),
    });
  } catch (error) {
    // AuthError = bad credentials; anything else (e.g. the redirect) must propagate.
    if (error instanceof AuthError) return "Invalid email or password.";
    throw error;
  }
  return undefined;
}

const signupSchema = z.object({
  brandName: z.string().trim().min(2, "Brand name must be at least 2 characters."),
  name: z.string().trim().min(1, "Please enter your name."),
  email: z.email("Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "brand";
  let slug = base;
  let n = 1;
  while (await brands.getBySlug(slug)) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

/** Signup (V1 single-brand self-serve): create brand + owner, then sign in. */
export async function register(
  _prev: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const parsed = signupSchema.safeParse({
    brandName: formData.get("brandName"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Please check the form and try again.";
  }

  const { brandName, name, password } = parsed.data;
  const email = parsed.data.email.toLowerCase().trim();

  if (await users.getByEmail(email)) {
    return "An account with that email already exists.";
  }

  const slug = await uniqueSlug(brandName);
  const passwordHash = bcrypt.hashSync(password, 10);

  // Create brand + owner atomically: the unique index on users.email is the real
  // guard against a concurrent same-email signup, and a failed user insert must
  // not leave an orphan brand.
  try {
    await db.transaction(async (tx) => {
      const [brand] = await tx.insert(brandsTable).values({ name: brandName, slug }).returning();
      if (!brand) throw new Error("brand insert returned no row");
      await tx
        .insert(usersTable)
        .values({ brandId: brand.id, email, name, role: "owner", passwordHash });
    });
  } catch (error) {
    if (isUniqueViolation(error)) return "An account with that email already exists.";
    throw error;
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/onboarding" });
  } catch (error) {
    if (error instanceof AuthError) {
      return "Account created — please sign in.";
    }
    throw error;
  }
  return undefined;
}
