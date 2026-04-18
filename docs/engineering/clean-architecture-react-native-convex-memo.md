# Engineering memo: Clean Architecture, Screaming Architecture, and this repo

**Status:** Reference (design alignment, not a policy change)  
**Audience:** Engineers, reviewers, and coding agents  
**Scope:** How Uncle Bob’s **Clean Architecture** and **Screaming Architecture**
ideas apply to **React Native + Convex** here, and what we concluded about our
current layout.

---

## 1. Questions we set out to answer

- How well do **Clean Architecture** (dependency rule, use cases, replaceable
  outer layers) and **Screaming Architecture** (structure reflects the **product**,
  not the framework) extend to **React** and especially **React Native**?
- How does that change when the backend is **serverless** (Convex functions,
  adapters, generated clients) rather than a classic monolith?
- For **this repository**: given a **Convex** backend (ongoing **domain /
  adapter / DB** refactor) and an RN app whose **heavy UX** lives in
  `src/features/` and **light UI** in `src/components/`, with **no** top-level
  `src/domain/`, where do we already match those patterns, and where might we
  improve **without** cargo-cult layering?

External discussion that informed the framing (not normative for this memo):
[Uncle Bob — We’ve Failed You](https://levelup.gitconnected.com/uncle-bob-weve-failed-you-7a988971c0e8),
[Screaming Architecture (Medium)](https://medium.com/@anujguptaninja/screaming-architecture-building-applications-that-clearly-define-their-purpose-b9a905612c8e).

---

## 2. Codebase context (snapshot)

### Backend (`convex/`)

- **`convex/domain/`** — Business rules, pipelines, orchestration logic expressed
  without depending on Convex **entrypoint implementations**; may import **types**
  from `convex/functions/*/schemas.ts` where they describe persisted or API
  shapes. Documented in `convex/domain/README.md`.
- **`convex/adapters/`** — Boundary-specific fetch/resolve/transform (e.g. WSF),
  with a designed public surface (e.g. `convex/adapters/index.ts`).
- **`convex/functions/`** — Convex registration, `ctx`, reads/writes, and **thin**
  orchestration that calls domain and adapters.
- Intended flow (from domain README):
  `functions → adapters → domain → functions/persistence` (with
  `convex/shared/` for generic helpers).

### Frontend (`src/`)

- **No** dedicated `src/domain/` tree; project conventions elsewhere mention
  domain logic under `src/domain/` as an aspiration, but the app is organized
  primarily by **feature** and **UI tier**.
- **`src/features/`** — Heavier concerns: maps, timelines, shells, data wiring,
  and mixed **presentation + client-side derivation** (e.g. render pipelines).
- **`src/components/`** — Lighter, reusable UI (including timeline primitives,
  design-system wrappers).
- **`src/data/contexts/`** — Integration with Convex-backed data and related
  client state.

### Cross-cutting discipline

- **`docs/engineering/imports-and-module-boundaries-memo.md`** — Folder-as-module,
  narrow public `index.ts` surfaces, staged enforcement. This supports **Clean
  Architecture** in practice by making boundaries explicit and refactor-safe.

---

## 3. How we map “Clean” and “Screaming” to RN + serverless

### Clean Architecture

- **Still applies:** Keep **domain rules** (policies, calculations, invariants) in
  modules that do not import UI, navigation, or vendor SDKs **at the boundary you
  control**. On the client, that often means **plain TypeScript** colocated with
  a feature or shared module; **components and hooks** act as adapters.
- **Harder on the client:** React’s execution model (hooks, concurrent rendering)
  intertwines **when** logic runs with the framework; strict “inner rings” are
  usually **feature-local** or **shared policy** modules, not a single global
  cake.
- **Serverless twist:** The “infrastructure” ring is **function endpoints**,
  persistence helpers, and **generated clients**. The dependency rule remains
  useful if **domain** code does not import Convex entrypoint implementations,
  while **functions** own `ctx` and I/O.

### Screaming Architecture

- **Fits RN well:** **Feature-first** folders (`VesselTimeline`, `MapFeatures`,
  `TimelineFeatures`) **scream** ferry/timeline/map purpose more than a purely
  technical split (`screens`, `hooks`, `redux`).
- **Pragmatic mix:** Product-shaped **features** plus a **shared** layer for
  design system, navigation, and cross-cutting utilities.

---

## 4. Conclusions for *this* repo

### Backend

- The **documented** split (`functions` / `adapters` / `domain` / persistence) and
  the **dependency direction** (domain not depending on function *implementations*)
  align with Clean Architecture’s **intent**, adapted to Convex.
- **Functions-owned orchestration** (e.g. tick execution wiring `ActionCtx` to
  domain modules) matches **use cases at the edge**, **policies and entities**
  in the center—as long as domain stays free of Convex glue except types and
  declared contracts.
- **Module boundaries** (imports memo, entry files) are the practical mechanism
  that keeps those layers honest over time.

### Frontend

- **“No client domain layer” is incomplete:** Significant **client-side
  “domain”** already exists **inside features**—for example, explicit **render
  pipelines** that transform backend contracts into render state, with
  documentation of **backend vs client responsibilities** (see
  `src/features/VesselTimeline/docs/ARCHITECTURE.md` and the
  `renderPipeline/` entrypoints).
- The main gap is **not** the absence of a folder named `domain`, but **inconsistent
  extraction** of pure logic vs UI, and **no shared home** for **cross-feature
  client-only** rules (formatting invariants, client state machines) when they
  genuinely belong on the client.
- **Authoritative business rules** should remain **server-side** unless there is
  an explicit strategy to share or duplicate safely (generated types, documented
  parity tests, etc.). A large `src/domain/` that mirrors Convex logic without
  that strategy is a **liability**.

### Where Uncle Bob’s patterns help less

- Imposing a **full enterprise-style inner platform** on the RN app is usually
  **low ROI**; the UI framework **is** the outer layer.
- **Enforcement** without tooling (lint/path rules) tends to decay; prefer the
  staged approach in the imports memo.

---

## 5. Directional guidance (if we choose to tighten)

1. **Within features:** Prefer **feature-local** pure modules (`renderPipeline/`,
   `policy/`, `model/`) with **tests**, and keep components as **thin** adapters.
   This is “Clean” at **feature** scale and preserves Screaming folder names.
2. **Shared client policy:** Introduce something like **`src/domain/`** or
   **`src/shared/domain/`** only for **shared, client-only** rules that are not
   server-authoritative—not as a dump for all business logic.
3. **Dependency direction inside pipelines:** Where practical, avoid **inner**
   pure transforms importing **design-system defaults**; inject theme/layout at
   the edge so the core pipeline depends on **data + types**, not `@/components/...`
   theme modules (incremental cleanup when touching code).
4. **Keep documenting boundaries** between **server contract**, **client
   derivation**, and **presentation** (as VesselTimeline already does for
   backbone vs active interval vs indicator).

---

## 6. Related documents

- `docs/engineering/imports-and-module-boundaries-memo.md`
- `convex/domain/README.md`
- `src/features/VesselTimeline/docs/ARCHITECTURE.md`
- `docs/engineering/vessel-orchestrator-functions-owned-orchestration-memo.md`
  (or successor memos in the same folder for orchestrator migration context)

---

## 7. Document history

- **2026-04-17:** Initial memo (questions, codebase snapshot, conclusions,
  directional guidance).
