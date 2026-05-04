# Engineering memo: Split Convex validators from TS-native DTOs (`schemas.ts` vs `types.ts`)

**Status:** Agreed convention — ready for mechanical implementation  
**Audience:** Engineers and coding agents doing a **mechanical** cleanup under `convex/functions/**` **before** optional larger work on events pipelines.  
**Goal:** Split **`schemas.ts`** (Convex validators + epoch-ms wire types) from **`types.ts`** (table-aligned TS-native mirrors using `Date`, plus `to*` / `from*` converters) within each feature folder. Keep those mirrors under **`convex/functions/…`** — **not** in `convex/domain/`.

---

## Problem statement

Across `convex/functions/**/schemas.ts` we commonly mix:

- `v.*` validators and `Infer<>` types for persisted or argument payloads (**numeric timestamps** where Convex stores time),
- hand-written or inferred **TS-native** types whose fields use **`Date`**,
- **`toDomain…` / `toConvex…`-style converters** and shared date helpers.

That coupling makes files harder to scan, blurs the boundary between “what Convex validates” and “what our TypeScript code reasons about,” and encourages ambiguous naming (e.g. “domain” for objects that still live beside Convex functions).

We want **one predictable layout per feature folder** so future work (including events pipeline refactors) does not fight inconsistent patterns.

---

## Intended layout (per feature folder under `convex/functions/`)

Use **two modules** when a feature has both wire and TS-native shapes:

| Module | Owns | Must not become |
|--------|------|-----------------|
| **`schemas.ts`** | Shared **`v.*` field bundles**, object validators, **`Infer<>` wire types** (`Convex*` or clearly wire-named types). Epoch-ms (or other Convex-native scalars) only. | `Date`-shaped table mirrors, conversion helpers, or unrelated planner shapes (except trivial validator-only helpers if truly unavoidable). |
| **`types.ts`** | **TS-native DTOs** (`Date` fields where we expose time to TS), **canonical converters** between wire and TS-native shapes (`toVesselLocation`, `fromVesselLocation`, etc.), and **narrow exports** used by mutations/actions/tests. | New `v.*` validators duplicated from `schemas.ts`. |

**Naming**

- Prefer **`Convex*`** or **`*Wire`** / **`*Persisted`** for types inferred from validators / table-aligned payloads (numbers for times).
- Prefer **plain entity names** (`VesselLocation`, …) for TS-native DTOs in `types.ts`.
- Avoid **`toDomain*`** for converters that stay in `functions/` — use **`toVesselLocation`** / **`fromVesselLocation`** (or `normalizeConvexVesselLocation`) so “domain” is not implied by folder placement alone.

**Barrels**

- Update each folder’s **`index.ts`** only as needed: re-export wire types from `schemas.ts`, TS-native types and converters from `types.ts`, without widening public API unnecessarily (match existing barrel discipline).

**`convex/schema.ts`**

- Table definitions stay here; they reference validators from feature modules as today. This memo does **not** require reshaping the database schema — only **where TypeScript types and converters live** relative to function validators.

**`convex/shared/`**

- Keep **`convertDates`** (and similar) as **shared utilities** imported by `functions/…/types.ts` converters. Do **not** duplicate epoch/`Date` rules inside each feature unless there is a genuine exception (document it).

---

## Out of scope: domain types and business logic

Pure logic types already live under **`convex/domain`** (for example `convex/domain/events/types.ts`). **This memo does not ask anyone to refactor domain folders**, retitle modules, track down every planner DTO, or “fix” domain imports from table validators beyond what breaks when symbols move off `schemas.ts`.

Treat further cleanup there **as-needed** in separate, intentional changes. Trying to normalize all business types across `convex/` in one pass is easy to get wrong; the deliverable here is only the **functions-layer** `schemas.ts` / `types.ts` split.

When moved exports force **`convex/domain`** import path updates (TS-native mirror now exported from `functions/…/types.ts`), update those imports — **do not** redesign domain boundaries as part of that fix unless the owner expands scope.

---

## Relationship to `convex/domain/`

- Callers that already normalize epoch → `Date` at the functions boundary should keep doing so; this split makes **where** those types live obvious (`types.ts`).
- **Do not** move table-aligned TS-native mirrors into **`convex/domain/`** — they stay beside their Convex module in **`functions/…/types.ts`**.

---

## Current situation (examples)

- **`convex/functions/vesselLocation/schemas.ts`** defines validators, `Infer<>` wire types, **`toDomainVesselLocation`**, and **`VesselLocation`** derived from that converter — all in one file (validators + conversion + TS-native type mixed).

Other feature folders under `convex/functions/*/schemas.ts` may follow similar patterns; **inventory during implementation**.

---

## Intended result (acceptance criteria)

1. Every affected feature folder has a clear split:
   - **`schemas.ts`** = validators + `Infer<>` wire types only (no `Date`-field DTOs, no `to*` converters except edge cases called out in code review).
   - **`types.ts`** = TS-native DTOs + canonical converters importing shared date helpers.
2. Naming reflects layer: **`Convex*`** wire vs plain **`VesselLocation`** (etc.) in `types.ts`.
3. **Imports updated** across `convex/functions`, and anywhere else that imported moved symbols from `schemas.ts` (including `convex/domain` **only** as required by those moves), plus tests.
4. **`bun run check:fix`** and **`bun run type-check`** pass; for Convex-heavy touches, **`bun run convex:typecheck`** passes.
5. **No behavior change** intended — pure module moves / export rewires / renames. If a rename is public-facing (unlikely here), call it out explicitly.

---

## Implementation guide (mechanical)

Suggested order to reduce churn:

1. **Inventory:** List all `convex/functions/**/schemas.ts` files; note each file that exports converters or `Date`-oriented types (grep for `epochMsToDate`, `ReturnType<typeof to`, `Date`, `toDomain`).
2. **Per folder:**
   - Create **`types.ts`** with module comment describing wire vs TS-native split.
   - Move TS-native types and **`to*` / `from*`** functions from `schemas.ts` → `types.ts`.
   - Leave validators and `Infer<>` exports in **`schemas.ts`**; have **`types.ts`** import wire types from `./schemas` for converter signatures.
   - Fix **`index.ts`** re-exports for the folder.
3. **Ripgrep-driven import fixes:** Update all imports of moved symbols (prefer path **`functions/<feature>/types`** for TS-native symbols).
4. **Rename pass:** Replace misleading **`toDomain*`** names with **`toVesselLocation`**-style names **when** the implementation agent can do so without breaking external consumers (this repo’s app/server boundaries are internal to `convex/`).
5. **Tests:** Move or adjust test imports; run targeted tests if present for that feature.

**Explicit non-goals for this task**

- Do **not** start the **scheduled / actual / predicted** domain pipeline refactor in the same change set — this memo is preparatory hygiene only.
- Do **not** relocate TS-native **entity mirrors** (table-aligned `Date` shapes and converters) into **`convex/domain/`** — those stay in **`functions/…/types.ts`**.
- Do **not** refactor **`convex/domain/**`** type layout, enum ownership, or planner DTO homes beyond **minimal import rewires** caused by moving exports off `schemas.ts`.
- Avoid drive-by refactors unrelated to the schemas/types split.

---

## Verification checklist

- [ ] No `schemas.ts` under `convex/functions` exports large conversion surfaces unless documented exception.
- [ ] TS-native entity types live in **`types.ts`** next to their converters.
- [ ] Call sites import TS-native mirrors from **`types.ts`** where applicable; domain touched only for **broken imports** from moved exports, not broader refactors.
- [ ] No circular imports (`types.ts` imports `./schemas`, not the reverse).
- [ ] Formatting and typecheck CI commands pass.

---

## References

- Related architecture memo: `docs/engineering/2026-05-04-vessel-timeline-current-data-flow-memo.md` (event tables and write paths).
- Shared date helpers: `convex/shared/convertDates.ts` (or equivalent — verify path during implementation).
