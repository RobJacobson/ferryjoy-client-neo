# Convex functions: comment standards

This memo records **comment and documentation conventions for `convex/functions`** (and aligned backend modules). It combines the project **code style** rule set with agreements from recent reviews.

**Authority:** `.cursor/rules/code-style.mdc` (Comments section) remains primary; this document adds Convex-specific nuance and examples.

---

## Module (`/** ... */` at top of file)

- Every file gets a **module-level** block describing its role and how it fits the broader backend (roughly 2–4 lines).
- **Exception:** a barrel **`index.ts`** that **only** re-exports sibling modules must have **no** module comment and **no** other file-level comments—the exports themselves are the documentation.
- No `@param` / `@returns` at module scope.

---

## Functions (TSDoc)

- **Exported and internal** functions use TSDoc so IntelliSense stays useful.
- Follow the template in code-style: **one-line summary**, optional **detail paragraph** (how/why, coupling to other modules), **`@param`** for each parameter, and **`@returns`** on every function.
- **Helpers:** The extra paragraph may be omitted only when the helper is **obvious** (e.g. a trivial one-liner). Non-trivial helpers (dedupe, equality, shard merging) get a full block including **`@param`** / **`@returns`** (still include **`@returns`** on trivial helpers when the signature returns **`null`** or **`Promise<void>`**, per the rule above).
- Use **plain backticks** for symbols and paths (`upsertActualDockRows`, `mergePingEventWrites`). Avoid Markdown bold inside code fragments in TSDoc.

### Query / mutation summaries

- The **first sentence should state the contract precisely**: prefer **“Returns …”** / **“Reads …”** over vague **“Loads …”** when the job is to return data to a caller. **Internal, non-registered** helpers that query `ctx.db` should still say what is **returned** (including `null`) in the summary or in **`@returns`**, even if the function name uses “load” or “fetch.”
- Name parameters as they appear in code (e.g. **`VesselAbbrev`**) when that matches the schema. For registered mutations, prefer **`@param args.field`** (or **`args.model`**) over a single opaque **`args`** line when the shape is the real contract.
- The detail paragraph should explain **domain meaning** (what table, what a row represents, who consumes it) when that is not obvious from names alone—not **implementation trivia** such as which index is used, unless that detail answers a real reader question. For **guards** (e.g. refusing to delete the active production tag), state the **operational risk** (orphaned config, missing rows for live reads), not only the fact that a check runs.

### Registered Convex functions

- Convex’s own rules still apply: **`args`**, **`returns`**, and **`handler`** with validators (`docs/convex_rules.mdc`). Every registered function should have an explicit **`returns`** validator, not only TSDoc.
- When the validator uses **literal** return shapes (e.g. `v.object({ success: v.literal(true) })`), the handler may need **`as const`** on the returned object (e.g. `return { success: true } as const`) so TypeScript does not widen to `boolean` and break the handler type.
- **`@returns` in TSDoc:** Always document the return type, **including** when the Convex/API surface is **`null`** (`returns: v.null()`), **`Promise<void>`** helpers, or “no value” completions—state what **`null`** means in domain terms or that the function completes without a useful return value (brief is fine; redundancy with the validator is acceptable).

---

## Mutations and return values

- **Default:** mutations and internal persistence helpers **do not return diagnostic objects** (`updated`, `reason`, etc.) unless a **real caller** needs them (client, orchestrator branch, tests, **or operator/CLI scripts** that branch on a small summary). Prefer **side effects only** + tests that assert DB effects where possible—reduces YAGNI surface.
- Small, stable payloads like **`{ deleted: n }`**, **`{ renamed: n }`**, or **`{ success: true }`** for those callers are fine; avoid large debug-shaped objects.

---

## Inline comments (`//`)

### When to use

- Code-style: comment **non-obvious** intent—invariants, coupling, business rules, error policy. Prefer **why** over **what**.
- **Convex “thin accessors”** (single indexed read, straightforward return): often **no** inline comments.
- **Complex backend logic** (multiple loops, several **`ctx.db`** calls, equality helpers, merge/dedupe): treat inline comments as **expected**. They should **group work into phases** (e.g. read → insert vs compare → replace) and explain **what each persistence touch is for**.

### Style

- **One physical line per inline comment** (no multi-line `//` continuations).
- Prefer **full sentences**, often starting with an **imperative verb** (“Reads …”, “Builds …”, “Deletes …”).
- Do **not** restate the code (“check if null” above `if (x === null)`).
- When a variable name is dense (**`nextByEventKey`**, **`surviveEventKeys`**), the comment should say **what it represents** and **how downstream code uses it** (e.g. allow-list for deletes, feed for upserts).

### What to avoid

- Comments that only name an index or low-level mechanism unless that mechanism is the **actual story** (prefer table + domain outcome).
- Long **stacked** comments before one statement—prefer **one** clear line per statement or phase.

---

## Schema / type fields

- Default: **no** per-prop comments in validators when names and types carry meaning.
- Add prop comments when **interaction between fields** or conditional behavior is not obvious from types (code-style).
- Prefer **TSDoc** (`/** */`) for re-exported types (e.g. re-exporting domain `ModelType` next to validators) instead of a bare **`//`** above the export.

---

## Colocation vs shared files (`helpers`, persistence modules)

- Decide **per function**, not “does anything import `helpers.ts`?” If a DB read/write primitive is only needed from **one** other module, **colocate** it with that caller (or keep it private to that file). If **two or more** files need the **same** primitive, a **shared** module is justified.
- Prefer a name that reflects **persistence** (table-scoped reads/writes, “repository”-shaped) over a generic **`helpers.ts`** when the file is almost entirely `ctx.db` access; “helpers” is better reserved for small cross-cutting utilities.
- **Barrel `index.ts` files** (re-exports only): no module comment (see **Module** above). For **new** barrels, prefer **explicit** `export { … } from "…"` over star exports when practical (see `.cursor/rules/code-style.mdc` **Barrel files**).

---

## Query error handling (comments and structure)

- **Default:** do not wrap ordinary **`ctx.db`** reads in **`try` / `catch`** only to rethrow a generic **`ConvexError`**; that rarely documents intent in comments better than the default failure path and can hide the original error. Use structured error mapping when the product or API contract **requires** a specific code or message.

---

## Quick checklist (Convex function file)

1. Module TSDoc at top (unless this file is a barrel-only `index.ts`; see **Module** above).
2. TSDoc on every non-trivial function; helpers justified if tiny/obvious.
3. Registered functions: **`args`**, **`returns`**, and handler; TSDoc **`@returns`** matches validator; use **`as const`** when literals widen.
4. Inline comments only where complexity warrants; **one line each**; verbs + domain meaning.
5. Mutations: return only what callers need; avoid debug-shaped return payloads.
6. Align with Biome; use **`biome-ignore`** only with **why**.
