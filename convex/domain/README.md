# Convex domain modules

`convex/domain/` owns backend business rules after inputs have already been
translated into backend-owned shapes.

The intended backend flow is:

```text
convex/functions -> convex/adapters -> convex/domain -> convex/functions/persistence
```

Layer responsibilities:

- **`convex/functions/`** — Convex registration, `ctx`, reads, writes, and thin
  orchestration
- **`convex/adapters/`** — WSF fetch wrappers, raw payload types, and
  boundary-specific translation into backend inputs
- **`convex/domain/`** — business rules, classification, lifecycle decisions,
  and reusable pipelines
- **`convex/shared/`** — generic helpers with no vendor-specific boundary story

Vessel sailing-day timeline logic is split by pipeline:

- **`timelineBackbone/`** — Query-time merge and ordering of scheduled, actual, and predicted rows (`buildTimelineBackbone`).
- **`timelineReseed/`** — Same-day reseed: schedule seeding, history hydration, live reconciliation (`buildReseedTimelineSlice` and related helpers).
- **`timelineRows/`** — Shared row builders and projection helpers used by backbone, reseed, and mutations.
- **`scheduledTrips/`** — Schedule transformation for `ConvexScheduledTrip` rows: direct/indirect classification, estimates, official crossing-time policy, prefetch row policies (`applyPrefetchSchedulePolicies`, `buildInitialScheduledTripRow`), and the `runScheduleTransformPipeline` entrypoint (used by scheduled-trips sync, WSF adapter ingress, and timeline reseed).
- **`vesselOrchestration/`** — **`updateVesselTrips/`** (pure trip-update pipeline, **continuity**, `vesselTripsBuildTripAdapters`, **`tripLifecycle/`** helpers); `updateTimeline/`; `updateVesselPredictions/`; eligibility; docs. Live location bulk upsert runs in `functions/vesselOrchestrator` (`actions.ts`). Post-fetch ping orchestration is being untangled incrementally. Map: [`vesselOrchestration/architecture.md`](vesselOrchestration/architecture.md).

Import these modules directly; there is no `vesselTimeline` domain barrel.

## Tests and import conventions

- **Tests**: substantive behavior (pipelines, builders, branching, continuity,
  orchestration) belongs in `convex/domain/**/tests/`. Keep
  `convex/functions/**/tests/` for schema validators, query/mutation wiring, and
  adapter smoke tests where `ctx.runQuery` / `ctx.runMutation` behavior is what
  you are protecting.
- **Imports**: domain code must not depend on functions-layer **implementation**
  modules (actions, internal wiring, Convex-only glue). Import **types** from
  `convex/functions/*/schemas.ts` where they describe persisted or API shapes.
  Convex entrypoints in `convex/functions/` call adapters and domain modules;
  domain code never imports Convex entrypoint implementations.
