# Convex functions: comment standards

This memo records **comment and documentation conventions for `convex/functions`** (and aligned backend modules). It combines the project **code style** rule set with agreements from recent reviews.

**Authority:** `.cursor/rules/code-style.mdc` (Comments section) remains primary; this document adds Convex-specific nuance and examples.

---

## Module (`/** ... */` at top of file)

- Every file gets a **module-level** block describing its role and how it fits the broader backend (roughly 2–4 lines).
- No `@param` / `@returns` at module scope.

---

## Functions (TSDoc)

- **Exported and internal** functions use TSDoc so IntelliSense stays useful.
- Follow the template in code-style: **one-line summary**, optional **detail paragraph** (how/why, coupling to other modules), **`@param`** for each parameter, **`@returns`** when the return carries meaning.
- **Helpers:** The extra paragraph may be omitted only when the helper is **obvious** (e.g. a trivial one-liner). Non-trivial helpers (dedupe, equality, shard merging) get a full block including **`@param`** / **`@returns`** when relevant.
- Use **plain backticks** for symbols and paths (`upsertActualDockRows`, `mergePingEventWrites`). Avoid Markdown bold inside code fragments in TSDoc.

### Query / mutation summaries

- The **first sentence should state the contract precisely**: prefer **“Returns …”** / **“Reads …”** over vague **“Loads …”** when the job is to return data.
- Name parameters as they appear in code (e.g. **`VesselAbbrev`**) when that matches the schema.
- The detail paragraph should explain **domain meaning** (what table, what a row represents, who consumes it) when that is not obvious from names alone—not **implementation trivia** such as which index is used, unless that detail answers a real reader question.

### Registered Convex functions

- Convex’s own rules still apply: **`args`**, **`returns`**, and **`handler`** with validators (`docs/convex_rules.mdc`).
- **`@returns` in TSDoc:** Spell out nothing meaningful for “fire-and-forget” mutations if **`returns: v.null()`** already documents the API. Avoid redundant prose like “returns undefined” for async functions with no return value; **`Promise<void>`** in TypeScript is enough for helpers.

---

## Mutations and return values

- **Default:** mutations and internal persistence helpers **do not return diagnostic objects** (`updated`, `reason`, etc.) unless a **real caller** needs them (client, orchestrator branch, or tests asserting behavior via return value). Prefer **side effects only** + tests that assert DB effects where possible—reduces YAGNI surface.

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

---

## Quick checklist (Convex function file)

1. Module TSDoc at top.
2. TSDoc on every non-trivial function; helpers justified if tiny/obvious.
3. Inline comments only where complexity warrants; **one line each**; verbs + domain meaning.
4. Mutations: return only what callers need; avoid debug-shaped return payloads.
5. Align with Biome; use **`biome-ignore`** only with **why**.
