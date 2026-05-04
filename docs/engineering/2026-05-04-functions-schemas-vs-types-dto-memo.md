# Engineering memo: Split Convex validators from TS-native DTOs (`schemas.ts` vs `types.ts`)

**Status:** Agreed convention — ready for mechanical implementation  
**Audience:** Engineers and coding agents doing a repo-wide cleanup **before** larger refactors under `convex/domain/events` (scheduled / actual / predicted pipelines)  
**Goal:** Separate **Convex wire shapes** (validators + epoch-ms fields) from **TypeScript-native DTOs** (`Date` fields, normalization helpers) while keeping **both** under `convex/functions/…` — **not** moving these DTOs into `convex/domain/`.

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
| **`schemas.ts`** | Shared **`v.*` field bundles**, object validators, **`Infer<>` wire types** (`Convex*` or clearly wire-named types). Epoch-ms (or other Convex-native scalars) only. | A grab-bag of business DTOs, `Date`-shaped interfaces, or conversion functions (except trivial validator-only helpers if truly unavoidable). |
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

## Relationship to `convex/domain/`

- **Domain code should receive clear TS semantics:** callers normalize **at the functions-layer boundary** (actions, mutations, thin orchestrators) so planners avoid “is this ms or Date?” confusion.
- **This cleanup does not move DTOs into `domain/`** — it **relocates and renames** them within `functions/` for clarity.
- If domain currently imports types from `functions/…/schemas.ts`, **after** the split those imports should prefer **`functions/…/types.ts`** for TS-native shapes and **`schemas.ts`** only when domain truly needs a validator-aligned wire type (ideally rare; prefer mapping at the edge).

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
3. **Imports updated** across `convex/functions`, `convex/domain`, and tests so nothing stalepoints at removed exports from `schemas.ts`.
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

- Do **not** start the **scheduled / actual / predicted** domain pipeline refactor in the same change set — this memo is preparatory hygiene.
- Do **not** relocate TS-native DTOs into **`convex/domain/`**.
- Avoid drive-by refactors unrelated to the schemas/types split.

---

## Verification checklist

- [ ] No `schemas.ts` under `convex/functions` exports large conversion surfaces unless documented exception.
- [ ] TS-native entity types live in **`types.ts`** next to their converters.
- [ ] Domain imports updated; no circular imports introduced (`types.ts` imports `./schemas`, not the reverse).
- [ ] Formatting and typecheck CI commands pass.

---

## References

- Related architecture memo: `docs/engineering/2026-05-04-vessel-timeline-current-data-flow-memo.md` (event tables and write paths).
- Shared date helpers: `convex/shared/convertDates.ts` (or equivalent — verify path during implementation).
