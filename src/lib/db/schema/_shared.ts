import { timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Reusable column builders. These return a fresh builder on each call (column
 * names are derived from the object key via the snake_case casing setting, so no
 * explicit name is passed here). Kept free of table references to avoid import
 * cycles — foreign keys are declared inline in each table.
 */
export const uuidPk = () => uuid().primaryKey().defaultRandom();

export const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
