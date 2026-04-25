# VesselTimeline Route Model Active Indicator Handoff

**Date:** 2026-04-25  
**Primary docs:**
- [2026-04-25-route-timeline-read-model-memo.md](./2026-04-25-route-timeline-read-model-memo.md)
- [2026-04-25-route-timeline-read-model-prd.md](./2026-04-25-route-timeline-read-model-prd.md)
- [2026-04-25-route-timeline-geometry-handoff.md](./2026-04-25-route-timeline-geometry-handoff.md)
- [2026-04-25-vessel-timeline-route-model-adapter-handoff.md](./2026-04-25-vessel-timeline-route-model-adapter-handoff.md)

## Purpose

Implement active-row and active-indicator support in the route-model
`VesselTimeline` adapter.

The current route-model adapter proves the static scaffold works:

```text
RouteTimelineSnapshot
  -> DockVisits
  -> visual spans
  -> axis geometry
  -> rows / rowLayouts / terminalCards
  -> activeIndicator: null
```

This stage should add:

```text
route-model spans + actual boundary state + VesselLocation
  -> active span / active row
  -> indicator position + label/subtitle
```

Keep this as a parallel adapter path. Do not replace the production
`VesselTimeline` wiring yet.

## Required Reading

Before editing, read:

- [docs/convex_rules.mdc](../convex_rules.mdc)
- [.cursor/rules/code-style.mdc](../../.cursor/rules/code-style.mdc)
- [2026-04-25-vessel-timeline-route-model-adapter-handoff.md](./2026-04-25-vessel-timeline-route-model-adapter-handoff.md)
- [2026-04-25-route-timeline-geometry-handoff.md](./2026-04-25-route-timeline-geometry-handoff.md)

Review current production active-row/indicator logic:

- [src/features/VesselTimeline/renderPipeline/toActiveRow.ts](../../src/features/VesselTimeline/renderPipeline/toActiveRow.ts)
- [src/features/VesselTimeline/renderPipeline/toActiveIndicator.ts](../../src/features/VesselTimeline/renderPipeline/toActiveIndicator.ts)
- [src/features/VesselTimeline/renderPipeline/toRenderRows.ts](../../src/features/VesselTimeline/renderPipeline/toRenderRows.ts)
- [src/features/VesselTimeline/rowEventTime.ts](../../src/features/VesselTimeline/rowEventTime.ts)
- [convex/shared/activeTimelineInterval.ts](../../convex/shared/activeTimelineInterval.ts)

Review the route-model adapter and geometry:

- [src/features/VesselTimeline/renderPipeline/fromRouteTimelineModel.ts](../../src/features/VesselTimeline/renderPipeline/fromRouteTimelineModel.ts)
- [src/features/RouteTimelineModel/visualSpans.ts](../../src/features/RouteTimelineModel/visualSpans.ts)
- [src/features/RouteTimelineModel/axisGeometry.ts](../../src/features/RouteTimelineModel/axisGeometry.ts)

## Implementation Scope

Extend:

- `src/features/VesselTimeline/renderPipeline/fromRouteTimelineModel.ts`
- `src/features/VesselTimeline/renderPipeline/tests/fromRouteTimelineModel.test.ts`

Optional helper extraction is fine if the adapter file gets too large, but keep
the public API narrow.

## Adapter Args

Extend `fromRouteTimelineModel(...)` with:

```ts
vesselLocation?: VesselLocation | null;
now?: Date;
```

Use `now = new Date()` by default for parity with the current render pipeline.

## Active Span Policy

Resolve active ownership from boundary occurrence/actual state, matching the
current actual-only semantics:

- latest occurred/actual departure boundary -> active crossing span
- latest occurred/actual arrival boundary -> active dock span
- no occurred/actual boundaries -> opening dock span when present
- predicted and scheduled times should not change active ownership

Use route-model visual spans rather than rebuilding event adjacency.

Boundary occurrence should treat either of these as occurred:

```ts
EventOccurred === true || EventActualTime !== undefined
```

## Row Marker Policy

Once active row index is known:

- rows with index <= active row index should use `markerAppearance: "past"`
- rows after active row should use `markerAppearance: "future"`
- when no active row is found, keep all rows future and `activeRowIndex = -1`

This should match current `toRenderRows` behavior.

## Indicator Position Policy

Match the current `toActiveIndicator` behavior as closely as possible:

Crossing / at-sea span:

- use distance progress when both `vesselLocation.DepartingDistance` and
  `vesselLocation.ArrivingDistance` are present
- otherwise fall back to display-time progress

Dock span:

- terminal-tail: position `0`
- if no valid start display time or start is in the future: position `0.5`
- otherwise use display-time progress

Start-of-day compressed dock:

- if the route-model span is explicitly marked `start-of-day`, use the same
  eased progress policy as current compressed start dock rows
- do not silently solve the real-arrival overnight compression gap unless the
  required metadata is available and tested

Clamp progress to `[0, 1]`.

## Indicator Copy Policy

Match current copy where practical:

- label is minutes until span end, or `"--"` for terminal-tail
- title is `vesselLocation?.VesselName`
- dock subtitle: `At dock <terminal>`
- crossing subtitle: speed, arriving distance, and arriving terminal when
  available
- animate when at sea/crossing, vessel is in service, not at dock, and speed is
  above the current animation threshold

Prefer extracting shared helpers only if it reduces duplication cleanly.

## Non-Goals

Do not:

- replace production `VesselTimeline` wiring
- call Convex from the adapter
- add new UI
- refactor `VesselTimelineContent`
- build single-trip timeline UI
- change backend schemas
- solve the real-arrival compressed-start metadata gap without tests

## Tests To Add

Extend adapter tests.

Required cases:

- no actuals -> opening dock row active when present
- actual departure -> adjacent crossing row active
- actual arrival -> destination dock row active
- marker appearances update around active row
- crossing indicator uses distance progress when distances are available
- crossing indicator falls back to display-time progress when distances are
  missing
- dock indicator uses display-time progress
- dock indicator centers when start time is missing or in the future
- terminal-tail indicator uses position `0` and label `"--"`
- indicator label counts minutes until span end
- subtitle/animation behavior matches current policy

Keep existing static adapter tests passing.

## Acceptance Criteria

- `fromRouteTimelineModel(...)` can return active row index and active
  indicator from route-model data.
- Existing static scaffold behavior is preserved.
- Active ownership uses actual/occurred state only.
- Distance and time progress behavior matches current policy.
- The adapter remains pure and does not call Convex.
- Production `VesselTimeline` remains unchanged.
- RouteTimelineModel tests still pass.
- Adapter tests cover active-row and indicator behavior.
- `bun run type-check` passes.
- `bun run check:fix` passes.

## Verification Commands

Run:

```sh
bun test src/features/RouteTimelineModel/tests/selectors.test.ts
bun test src/features/RouteTimelineModel/tests/visualSpans.test.ts src/features/RouteTimelineModel/tests/axisGeometry.test.ts
bun test src/features/VesselTimeline/renderPipeline/tests/fromRouteTimelineModel.test.ts
bun run type-check
bun run check:fix
```

## Copy-Paste Note

Please implement the next route-model `VesselTimeline` adapter stage: active
row and active indicator support. Read
`docs/engineering/2026-04-25-vessel-timeline-route-model-active-indicator-handoff.md`,
`docs/engineering/2026-04-25-vessel-timeline-route-model-adapter-handoff.md`,
`docs/engineering/2026-04-25-route-timeline-geometry-handoff.md`,
`docs/convex_rules.mdc`, and `.cursor/rules/code-style.mdc` first. Extend
`fromRouteTimelineModel(...)` to accept optional `vesselLocation` and `now`,
resolve the active span from actual/occurred route-model boundaries, update
`activeRowIndex` and row marker appearances, and derive an active indicator
matching current `VesselTimeline` policy: distance progress for at-sea when
available, display-time fallback, dock progress by display time, terminal-tail
position `0` and label `"--"`, current subtitle/animation behavior, and no
active ownership from predicted/scheduled data. Keep this pure and parallel:
do not replace production `VesselTimeline` wiring, call Convex, change backend
schemas, or build UI. Add focused adapter tests and verify with the
RouteTimelineModel tests, the adapter test, `bun run type-check`, and
`bun run check:fix`.
