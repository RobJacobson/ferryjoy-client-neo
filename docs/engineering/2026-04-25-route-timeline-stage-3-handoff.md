# Route Timeline Stage 3 Handoff

**Date:** 2026-04-25  
**Primary docs:**
- [2026-04-25-route-timeline-read-model-memo.md](./2026-04-25-route-timeline-read-model-memo.md)
- [2026-04-25-route-timeline-read-model-prd.md](./2026-04-25-route-timeline-read-model-prd.md)
- [2026-04-25-route-timeline-stage-1-handoff.md](./2026-04-25-route-timeline-stage-1-handoff.md)
- [2026-04-25-route-timeline-stage-2-handoff.md](./2026-04-25-route-timeline-stage-2-handoff.md)

## Purpose

Implement Stage 3 of the route timeline read model: the public Convex query that
loads existing event rows for a route and `SailingDay`, calls the pure Stage 2
builder, and returns the Stage 1 `RouteTimelineSnapshot` schema.

This stage should stay backend-only. Do not implement frontend context,
selectors, `VesselTimeline` refactoring, or new timeline UI.

## Required Reading

Before editing, read:

- [docs/convex_rules.mdc](../convex_rules.mdc)
- [.cursor/rules/code-style.mdc](../../.cursor/rules/code-style.mdc)
- [2026-04-25-route-timeline-read-model-memo.md](./2026-04-25-route-timeline-read-model-memo.md)
- [2026-04-25-route-timeline-read-model-prd.md](./2026-04-25-route-timeline-read-model-prd.md)

Review implemented Stage 1 and Stage 2 files:

- [convex/functions/routeTimeline/schemas.ts](../../convex/functions/routeTimeline/schemas.ts)
- [convex/domain/routeTimeline/buildRouteTimelineSnapshot.ts](../../convex/domain/routeTimeline/buildRouteTimelineSnapshot.ts)
- [convex/domain/routeTimeline/tests/buildRouteTimelineSnapshot.test.ts](../../convex/domain/routeTimeline/tests/buildRouteTimelineSnapshot.test.ts)

Review existing event loading patterns:

- [convex/functions/vesselTimeline/backbone/loadVesselTimelineBackbone.ts](../../convex/functions/vesselTimeline/backbone/loadVesselTimelineBackbone.ts)
- [convex/functions/events/eventsScheduled/queries.ts](../../convex/functions/events/eventsScheduled/queries.ts)
- [convex/functions/events/eventsActual/queries.ts](../../convex/functions/events/eventsActual/queries.ts)
- [convex/functions/events/eventsPredicted/queries.ts](../../convex/functions/events/eventsPredicted/queries.ts)

## Implementation Scope

Expected files:

- `convex/functions/routeTimeline/queries.ts`
- `convex/functions/routeTimeline/index.ts`

Optional helper files are fine if they keep the query file small, but avoid
premature abstraction.

The public query should be named:

```ts
getRouteTimelineSnapshot
```

## Query Contract

Implement:

```ts
getRouteTimelineSnapshot({
  RouteAbbrev,
  SailingDay,
  VesselAbbrev?,
  WindowStart?,
  WindowEnd?,
})
```

Return:

```ts
routeTimelineSnapshotSchema
```

The return shape must remain the same for:

- full route/day
- one vessel in a route/day
- route/day with time-window metadata
- one vessel with time-window metadata

## Loading Policy

The query should load existing rows from:

- `eventsScheduled`
- `eventsActual`
- `eventsPredicted`

Then it should call:

```ts
buildRouteTimelineSnapshot(...)
```

from `convex/domain/routeTimeline`.

Important: live `VesselLocation` data should not be loaded or embedded in this
snapshot. It remains a separate data source for active indicator motion.

## Route Filtering

The scheduled event schema does not currently expose `RouteAbbrev`. Stage 3
must identify the correct way to load the route/day scheduled rows using
existing data access patterns and indexes.

Before adding new indexes or helper queries, inspect the current schema and
query helpers. Prefer existing indexed loaders when they already provide the
right scope.

If a new indexed helper is needed, keep it narrow and document why.

## Window Scope Policy

For Stage 3, `WindowStart` and `WindowEnd` may be passed through to
`Scope` without clipping visits, matching Stage 2 behavior.

Do not implement hard clipping unless it can preserve adjacent context. A
future trip-page window containing:

```text
A departure -> B arrival
```

must eventually preserve enough context for:

```text
A arrival -> A departure -> B arrival -> B departure
```

If clipping is deferred, make that explicit in tests and comments.

## Registration / Exports

Update `convex/functions/routeTimeline/index.ts` to export the query module in
the style used by nearby Convex function modules.

If the repo's main `convex/functions/index.ts` should expose route timeline
functions after the public query exists, update it as part of this stage.
Follow the file's current guidance and conventions.

## Tests To Add Or Update

Add focused tests where practical for query-level loading behavior. If the repo
does not have a simple pattern for testing Convex public queries directly,
prefer testing any new loader helper as a pure or narrowly mocked unit.

At minimum, preserve and run Stage 2 builder tests.

Useful cases:

- full route/day query uses the stable snapshot shape
- `VesselAbbrev` arg is passed into builder scope and marks `IsPartial`
- `WindowStart` / `WindowEnd` are passed into builder scope and mark
  `IsPartial`
- no live vessel location data appears in the snapshot
- the query uses `routeTimelineSnapshotSchema` as its return validator

## Non-Goals

Do not:

- refactor `VesselTimeline`
- add frontend route timeline context
- add frontend selectors
- implement single-trip timeline UI
- include live `VesselLocation` data
- persist a new table
- redesign the Stage 1 schema unless a real query contract issue is discovered
- change Stage 2 dock-visit assembly unless needed to wire the query correctly

## Acceptance Criteria

- `getRouteTimelineSnapshot` is a public Convex query using new function syntax.
- The query has explicit arg validators and `routeTimelineSnapshotSchema` as
  its return validator.
- The query loads scheduled, actual, and predicted rows through indexed helper
  paths.
- The query calls `buildRouteTimelineSnapshot(...)`.
- The query supports `RouteAbbrev`, `SailingDay`, optional `VesselAbbrev`, and
  optional `WindowStart` / `WindowEnd` args.
- The route timeline function module exports the query cleanly.
- Live `VesselLocation` data remains separate.
- Existing Stage 2 builder tests pass.
- `bun run convex:typecheck` passes.
- `bun run type-check` passes.

## Verification Commands

Run:

```sh
bun test convex/domain/routeTimeline/tests/buildRouteTimelineSnapshot.test.ts
bun run convex:typecheck
bun run type-check
```

If formatting/linting changes are needed, run:

```sh
bun run check:fix
```

If you add query/loader tests, run those focused tests too.

## Copy-Paste Note

Please implement Stage 3 of the route timeline read model. Read
`docs/engineering/2026-04-25-route-timeline-read-model-memo.md`,
`docs/engineering/2026-04-25-route-timeline-read-model-prd.md`,
`docs/engineering/2026-04-25-route-timeline-stage-3-handoff.md`,
`docs/convex_rules.mdc`, and `.cursor/rules/code-style.mdc` first. Add the
public Convex query `getRouteTimelineSnapshot` under
`convex/functions/routeTimeline`, with args `{ RouteAbbrev, SailingDay,
VesselAbbrev?, WindowStart?, WindowEnd? }`, returning
`routeTimelineSnapshotSchema`. Load existing scheduled/actual/predicted event
rows through appropriate indexed helper paths, call
`buildRouteTimelineSnapshot(...)`, and keep live `VesselLocation` data separate.
Do not add frontend context, selectors, `VesselTimeline` refactors, or new UI
yet. Verify with
`bun test convex/domain/routeTimeline/tests/buildRouteTimelineSnapshot.test.ts`,
`bun run convex:typecheck`, and `bun run type-check`.
