/**
 * Thin mock layer over the three drizzle-orm operators our routes use. We
 * convert them to tagged objects (__op/__col) that db.mock.ts can interpret
 * without running real SQL.
 */

import { mock } from "bun:test";

mock.module("drizzle-orm", () => ({
  eq(col: any, val: any) {
    return {
      __op: "eq",
      args: [{ __col: col?.name ?? String(col) }, val],
    };
  },
  and(...conds: any[]) {
    return { __op: "and", args: conds };
  },
  or(...conds: any[]) {
    return { __op: "or", args: conds };
  },
  desc(col: any) {
    return { __op: "desc", args: [{ __col: col?.name ?? String(col) }] };
  },
  gte(col: any, val: any) {
    return {
      __op: "gte",
      args: [{ __col: col?.name ?? String(col) }, val],
    };
  },
  isNull(col: any) {
    return { __op: "isNull", args: [{ __col: col?.name ?? String(col) }] };
  },
  inArray(col: any, values: any[]) {
    return {
      __op: "inArray",
      args: [{ __col: col?.name ?? String(col) }, values],
    };
  },
  cosineDistance(col: any, _value: any) {
    // Tests don't exercise vector math; just return a marker so the SQL
    // builder doesn't choke. searchKB is integration-tested at runtime.
    return { __op: "cosineDistance", args: [col] };
  },
  sql(strings: TemplateStringsArray, ...values: any[]) {
    // Best-effort: callers may use `sql\`count(*)\`` etc. We don't evaluate;
    // we only return a marker the fake db can recognize as "no-op".
    return { __op: "sql", args: [strings, values] };
  },
}));
