# Handoff: Audit Convex functions and simplify error handling

**Date:** 2026-04-16  
**Audience:** engineers or agents doing a repo-wide pass on `convex/functions/**`  
**Status:** actionable audit checklist (not yet executed)

## Purpose

Systematically review **every registered Convex function** (`query`, `mutation`, `action`, and internal variants) and **remove defensive error handling that does not add product value**—especially:

- Broad `try` / `catch` blocks around routine `ctx.db` reads/writes that **re-throw** as `ConvexError` with a generic `code` (e.g. `"QUERY_FAILED"`) and `String(error)` in `details`.
- Patterns that **hide** the original failure (developer errors, `.unique()` cardinality failures, read/write limits) behind a uniform wrapper.

Align behavior with Convex’s documented model: **expected failures** are expressed by **return values** or **`ConvexError`**, while **bugs and platform limits** should surface clearly (logs, client rejection, observability)—not be swallowed.

**Official references (read before editing):**

- [Error handling overview](https://docs.convex.dev/functions/error-handling/) — categories of errors (application vs developer vs limits), client handling (e.g. error boundaries for queries), mutation rejection behavior.
- [Application errors (`ConvexError`)](https://docs.convex.dev/functions/error-handling/application-errors) — when to **return** a union vs **throw** `ConvexError`, structured `data` for the client, and why mutations use throw to **abort the transaction**.

## What to remove (default)

| Pattern | Rationale |
|--------|-----------|
| `try { await ctx.db... } catch { throw new ConvexError({ message, code: "QUERY_FAILED", ... }) }` on **simple queries** | `ctx.db` operations rarely throw in the “happy path”; when they throw (e.g. `.unique()` with **multiple** matches, bad args to `db.get`), wrapping loses the useful message and stacks. Prefer **no catch** unless you transform the error intentionally. |
| Same blanket catch on **`collect()` / `withIndex` / `first()`** where the only “failure” is a real bug | Let it throw; fix data or code. |
| Catching only to log `String(error)` and rethrow a generic error | Adds noise; Convex logs server-side errors already—see [Debugging](https://docs.convex.dev/functions/debugging) linked from the error-handling page. |

**Already improved in-repo (example):** `convex/functions/vesselLocation/queries.ts` — removed blanket `ConvexError` wrappers; `getByVesselAbbrev` returns `null` when `.unique()` finds no row and lets duplicate-row failures throw per Convex `unique()` semantics.

## What to keep or add (case-by-case)

These are **exceptions** to “delete all try/catch”—use judgment per function.

### Keep intentional `ConvexError` (application / expected failure)

Per [Application errors](https://docs.convex.dev/functions/error-handling/application-errors), throw `ConvexError` when:

- The function **must stop** and the client should show a **specific** outcome (e.g. “not allowed”, “duplicate”, “precondition failed”).
- You rely on **mutation rollback** (throwing aborts the transaction).
- You want **structured `data`** (e.g. `code`) for UI branching—**not** a generic `"QUERY_FAILED"` for every failure.

Prefer **stable error codes** in `data` if the client branches on them; avoid duplicating the same vague wrapper everywhere.

### Keep narrow catches that do real work

- **`instanceof ConvexError` rethrow** (preserve application errors) while mapping or logging others—only if the surrounding code has a clear contract (see `convex/functions/vesselTrips/mutations.ts` for an example pattern).
- **Actions** calling **external HTTP** / Node APIs: catch **specific** failures if you **retry**, **normalize** vendor errors into a typed result, or **must** avoid partial side effects. Actions are **not** auto-retried like queries/mutations; see [Errors in action functions](https://docs.convex.dev/functions/error-handling/#errors-in-action-functions) in the same error-handling doc.
- **`ctx.runQuery` / `ctx.runMutation` from actions**: handle failures if the action implements **compensation** or **user-facing** messaging; do not blanket-wrap every call identically.

### Prefer return values over throw when appropriate

For “expected” outcomes (not found, validation result), the docs recommend **return unions** or explicit result types so TypeScript forces handling—see “Returning different values” in [Application errors](https://docs.convex.dev/functions/error-handling/application-errors). Do not throw `ConvexError` for **normal** “no row” cases if the API is already `T | null`.

### Read/write limit errors

If a function hits [document or call limits](https://docs.convex.dev/production/state/limits), fixing the **query shape** (indexes, pagination) is the right fix—not catching and hiding. The [error-handling doc](https://docs.convex.dev/functions/error-handling/#readwrite-limit-errors) points to indexing and limits as the remedy.

## Suggested audit order

1. **All `queries.ts`** — highest concentration of generic `QUERY_FAILED` patterns (also check `vesselPings`, `predictions`, `scheduledTrips`, `keyValueStore`, `vesselTrips` per grep history).
2. **Mutations** — keep throws for **authorization** and **invariant violations**; remove catch-all rethrows around `ctx.db` unless transforming.
3. **Actions** — review each `catch` for fetch/scheduling; keep only those with clear semantics.

## Completion criteria

- No file uses a **copy-pasted** “failed to fetch X” `ConvexError` unless the message/`data` is **meaningful to the product** or replaces an error that must not leak in prod.
- **Application** failures use **`ConvexError`** with **discriminable** payloads where the client needs them; everything else either **returns** a typed result or **lets errors propagate**.
- Spot-check: `.unique()` call sites document or handle **0 vs 1 vs many** per Convex semantics (null vs doc vs throw).

---

**Related in-repo memo:** [Backend layering, actions, and domain](./backend-layering-actions-and-domain-memo-2026-04-16.md) (orthogonal to error style, but same `convex/functions` surface).
