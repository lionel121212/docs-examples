// Minimal D1 stand-in on node:sqlite for tests.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

class Stmt {
  constructor(
    private db: DatabaseSync,
    private sql: string,
    private args: unknown[] = [],
  ) {}
  bind(...args: unknown[]) {
    return new Stmt(this.db, this.sql, args);
  }
  async first<T>() {
    return (this.db.prepare(this.sql).get(...(this.args as any[])) ?? null) as T | null;
  }
  async all<T>() {
    return { results: this.db.prepare(this.sql).all(...(this.args as any[])) as T[] };
  }
  async run() {
    this.db.prepare(this.sql).run(...(this.args as any[]));
    return { success: true };
  }
  runSync() {
    this.db.prepare(this.sql).run(...(this.args as any[]));
  }
}

export function makeD1(): D1Database {
  const db = new DatabaseSync(":memory:");
  for (const m of ["0001_accounts.sql", "0002_password_reset.sql"])
    db.exec(readFileSync(new URL(`../migrations/${m}`, import.meta.url), "utf8"));
  return {
    prepare: (sql: string) => new Stmt(db, sql),
    batch: async (stmts: Stmt[]) => {
      db.exec("BEGIN");
      try {
        for (const s of stmts) s.runSync();
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      return [];
    },
  } as unknown as D1Database;
}
