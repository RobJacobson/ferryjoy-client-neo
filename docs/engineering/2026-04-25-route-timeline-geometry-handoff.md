# Route Timeline Geometry Handoff

**Date:** 2026-04-25  
**Primary docs:**
- [2026-04-25-route-timeline-read-model-memo.md](./2026-04-25-route-timeline-read-model-memo.md)
- [2026-04-25-route-timeline-read-model-prd.md](./2026-04-25-route-timeline-read-model-prd.md)
- [2026-04-25-route-timeline-selectors-handoff.md](./2026-04-25-route-timeline-selectors-handoff.md)

## Purpose

Implement the next route timeline layer: pure visual-span and axis-geometry
derivation from selected `DockVisit[]`.

The route timeline snapshot, frontend context, and domain selectors now exist.
This stage should translate selected dock visits into render-ready timing spans
and absolute axis geometry that future timeline components can consume.

Keep this stage pure and renderer-agnostic. Do not refactor `VesselTimeline`,
draw UI, or implement active vessel-location behavior yet.

## Required Reading

Before editing, read:

- [docs/convex_rules.mdc](../convex_rules.mdc)
- [.cursor/rules/code-style.mdc](../../.cursor/rules/code-style.mdc)
- [2026-04-25-route-timeline-read-model-memo.md](./2026-04-25-route-timeline-read-model-memo.md)
- [2026-04-25-route-timeline-read-model-prd.md](./2026-04-25-route-timeline-read-model-prd.md)
- [2026-04-25-route-timeline-selectors-handoff.md](./2026-04-25-route-timeline-selectors-handoff.md)

Review existing geometry/compression logic:

- [src/features/VesselTimeline/renderPipeline/toRenderRows.ts](../../src/features/VesselTimeline/renderPipeline/toRenderRows.ts)
- [src/features/VesselTimeline/renderPipeline/toActiveIndicator.ts](../../src/features/VesselTimeline/renderPipeline/toActiveIndicator.ts)
- [src/features/VesselTimeline/rowEventTime.ts](../../src/features/VesselTimeline/rowEventTime.ts)
- [src/features/VesselTimeline/config.ts](../../src/features/VesselTimeline/config.ts)
- [src/components/timeline/viewState.ts](../../src/components/timeline/viewState.ts)

Review the new selector module:

- [src/features/RouteTimelineModel/selectors.ts](../../src/features/RouteTimelineModel/selectors.ts)

## Implementation Scope

Extend the route timeline model module with pure derivation helpers.

Expected files:

- `src/features/RouteTimelineModel/visualSpans.ts`
- `src/features/RouteTimelineModel/axisGeometry.ts`
- `src/features/RouteTimelineModel/index.ts`
- `src/features/RouteTimelineModel/tests/visualSpans.test.ts`
- `src/features/RouteTimelineModel/tests/axisGeometry.test.ts`

If two files feel too granular, one well-organized file is acceptable. Keep the
public module API narrow.

## Visual Span Goals

Derive ordered spans from `RouteTimelineDockVisit[]`.

Conceptual spans:

```text
dock span: visit.Arrival -> visit.Departure
crossing span: visit.Departure -> nextVisit.Arrival
start placeholder span: missing Arrival -> first Departure
terminal-tail span: final Arrival -> missing Departure
```

Suggested shape:

```ts
type RouteTimelineVisualSpan = {
  id: string;
  kind: "at-dock" | "crossing";
  edge: "normal" | "start-of-day" | "terminal-tail";
  fromVisitKey?: string;
  toVisitKey?: string;
  startBoundary?: RouteTimelineBoundary;
  endBoundary?: RouteTimelineBoundary;
};
```

The exact type can vary, but it should preserve enough identity and boundary
data for later `VesselTimeline` render-state derivation.

## Axis Geometry Goals

Add a pure geometry function that converts visual spans into absolute axis
positions.

The geometry layer should own:

- schedule-first duration math for stable sizing
- display-time precedence for progress calculations
- nonlinear duration compression
- minimum span height
- start-of-day dock cap behavior
- absolute start/end y positions
- content height

Suggested output:

```ts
type RouteTimelineAxisSpan = RouteTimelineVisualSpan & {
  actualDurationMinutes: number;
  visualDurationMinutes: number;
  y: number;
  heightPx: number;
  startY: number;
  endY: number;
};

type RouteTimelineAxisGeometry = {
  spans: RouteTimelineAxisSpan[];
  contentHeightPx: number;
};
```

The exact naming can vary. The key design point is that future rows, track fill,
terminal backgrounds, and indicators should consume one shared axis geometry
instead of recomputing layout independently.

## Time Precedence

Follow the current `VesselTimeline` policy:

- layout sizing uses schedule-first stability
- display/progress uses actual, then predicted, then scheduled

For route timeline boundaries this likely maps to:

```text
layout time: EventScheduledTime -> EventActualTime -> EventPredictedTime
display time: EventActualTime -> EventPredictedTime -> EventScheduledTime
```

Be explicit and test both policies.

## Compression Policy

Mirror the current `VesselTimeline` behavior initially:

- exponent-based duration compression
- minimum height
- start-of-day dock visual cap

Avoid tuning visuals in this stage. The goal is to preserve the existing mental
model while moving geometry into a shared pure layer.

## Non-Goals

Do not:

- call Convex queries
- add React context
- use live `VesselLocation` data
- implement active indicator placement from location/distance
- refactor `VesselTimeline`
- render UI
- build single-trip vertical or horizontal timeline components
- add terminal-card styling logic beyond geometry metadata needed later

## Tests To Add

Add focused pure tests.

Visual span tests:

- empty visits produce empty spans
- A visit plus B visit produces dock/crossing/dock-style spans where
  boundaries exist
- missing first arrival produces a start-of-day span
- missing final departure produces a terminal-tail span
- crossing span is derived from current departure to next arrival

Axis geometry tests:

- content height is sum of compressed span heights
- minimum height is applied
- exponent compression is applied
- start-of-day dock cap is applied
- layout time uses schedule-first precedence
- display/progress helper uses actual/predicted/scheduled precedence if added
- invalid/missing boundary times degrade to zero duration plus minimum height

## Acceptance Criteria

- Visual-span derivation is pure and tested.
- Axis geometry derivation is pure and tested.
- The module imports route timeline domain types from
  `convex/functions/routeTimeline`.
- No React, Convex query, live location, or UI code is introduced.
- Existing selector tests still pass.
- `bun test src/features/RouteTimelineModel/tests/visualSpans.test.ts
  src/features/RouteTimelineModel/tests/axisGeometry.test.ts` passes.
- `bun run type-check` passes.
- `bun run check:fix` passes.

## Verification Commands

Run:

```sh
bun test src/features/RouteTimelineModel/tests/selectors.test.ts
bun test src/features/RouteTimelineModel/tests/visualSpans.test.ts src/features/RouteTimelineModel/tests/axisGeometry.test.ts
bun run type-check
bun run check:fix
```

If file names differ, adjust the focused test paths accordingly.

## Copy-Paste Note

Please implement the next route timeline stage: pure visual-span and
axis-geometry derivation from selected `DockVisit[]`. Read
`docs/engineering/2026-04-25-route-timeline-read-model-memo.md`,
`docs/engineering/2026-04-25-route-timeline-read-model-prd.md`,
`docs/engineering/2026-04-25-route-timeline-selectors-handoff.md`,
`docs/engineering/2026-04-25-route-timeline-geometry-handoff.md`,
`docs/convex_rules.mdc`, and `.cursor/rules/code-style.mdc` first. Extend
`src/features/RouteTimelineModel` with pure helpers that derive ordered visual
spans from `DockVisit[]` and then compute compressed absolute axis geometry.
Mirror the current `VesselTimeline` policies: schedule-first layout timing,
actual/predicted/scheduled display timing, exponent-based compression, minimum
height, and start-of-day dock capping. Keep this stage pure and
renderer-agnostic: no Convex calls, React context, live `VesselLocation`, active
indicator placement, `VesselTimeline` refactor, or new UI. Add focused tests
for visual spans and geometry and verify with the RouteTimelineModel tests,
`bun run type-check`, and `bun run check:fix`.
