# Convex adapters

`convex/adapters/` holds **integration** code: vendor APIs, mapping into backend-owned types, and pure **resolve** helpers that match feed fields to identity rows.

See **`docs/handoffs/backend-layering-actions-and-domain-memo-2026-04-16.md`** for the agreed **folder layout** (`fetch/`, `resolve/`, `pipelines/`, `utils/`), **`Wsf`** filename convention, and **remaining work**.

## What belongs here

- WSF (and future vendor) **fetch + map** toward Convex DTOs
- **Resolve** helpers (no `ctx`, no network)
- **Pipelines**: multi-step integration workflows (prefer one file per pipeline under `pipelines/`)
- Small **utils** shared by adapter modules (e.g. retry), not domain policy

## What does not belong here

- Convex `query` / `mutation` / `action` registration (use `convex/functions/`)
- Business rules owned by `convex/domain/`
- Generic utilities with no boundary story (use `convex/shared/`)

## Import guidance

- `convex/functions/` may call adapters for fetch/translate before domain or mutations.
- `convex/domain/` should not call `ws-dottie` or other HTTP clients—receive **already-fetched** data or depend on types only.
- Prefer imports from **`adapters`** or **`adapters/fetch/...`** per `convex/tsconfig.json` paths.
