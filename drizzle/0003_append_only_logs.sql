-- Custom SQL migration file, put your code below! --
-- Defense-in-depth: enforce the append-only invariant for the compliance logs at
-- the database layer, not just by repo convention. Row-level triggers fire even
-- for superusers, so UPDATE/DELETE on these tables fails closed regardless of who
-- holds the connection. INSERT (and table DDL) remain unaffected.
CREATE OR REPLACE FUNCTION threadline_forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'append-only table %: % is not allowed', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION threadline_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER consent_log_append_only
  BEFORE UPDATE OR DELETE ON "consent_log"
  FOR EACH ROW EXECUTE FUNCTION threadline_forbid_mutation();