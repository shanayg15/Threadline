import { pgTable, text, uuid } from "drizzle-orm/pg-core";

import { createdAt, uuidPk } from "./_shared";
import { brands } from "./brands";
import { userRole } from "./enums";

/** `users` — dashboard users belonging to a brand. */
export const users = pgTable("users", {
  id: uuidPk(),
  brandId: uuid()
    .notNull()
    .references(() => brands.id),
  email: text().notNull().unique(),
  name: text(),
  passwordHash: text().notNull(),
  role: userRole().notNull().default("owner"),
  createdAt: createdAt(),
});
