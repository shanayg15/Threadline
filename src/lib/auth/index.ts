import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import * as users from "@/lib/db/repos/users";
import { authConfig } from "./config";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

// Compared against when the email is unknown, so authorize takes ~constant time
// whether or not the account exists (avoids a user-enumeration timing side channel).
const DUMMY_HASH = bcrypt.hashSync("threadline-dummy-password", 10);

/**
 * Full Auth.js instance (Node runtime — uses the DB + bcrypt). Credentials are
 * verified against `users.passwordHash` using the SAME bcrypt hasher as the M2
 * seed, so seeded logins work. On success, brandId/role/userId flow into the JWT
 * via the callbacks in `authConfig`.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await users.getByEmail(parsed.data.email.toLowerCase().trim());
        if (!user) {
          await bcrypt.compare(parsed.data.password, DUMMY_HASH);
          return null;
        }

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          brandId: user.brandId,
          role: user.role,
        };
      },
    }),
  ],
});
