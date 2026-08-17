import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { generateSeedSql } from "@/scripts/generate-transitions-sql";
import { TRANSITIONS } from "@/lib/deals/machine";

describe("transition SQL generator", () => {
  it("emits one insert row per transition", () => {
    const sql = generateSeedSql();
    const rows = sql.match(/\('\w+',\s*'\w+',\s*'\w+',\s*'\w+',\s*(null|'\w+')\)/g) ?? [];
    expect(rows).toHaveLength(TRANSITIONS.length);
  });

  it("truncates before seeding so regeneration is idempotent", () => {
    expect(generateSeedSql()).toContain("truncate table public.deal_transitions");
  });

  it("checked-in seed file matches the generator output", () => {
    const normalize = (s: string) => s.replace(/\r\n/g, "\n");
    const onDisk = readFileSync("supabase/migrations/0005_transitions_seed.sql", "utf8");
    expect(normalize(onDisk)).toBe(normalize(generateSeedSql()));
  });
});
