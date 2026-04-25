# VesselTimeline Route Model Adapter Handoff

**Date:** 2026-04-25  
**Primary docs:**
- [2026-04-25-route-timeline-read-model-memo.md](./2026-04-25-route-timeline-read-model-memo.md)
- [2026-04-25-route-timeline-read-model-prd.md](./2026-04-25-route-timeline-read-model-prd.md)
- [2026-04-25-route-timeline-selectors-handoff.md](./2026-04-25-route-timeline-selectors-handoff.md)
- [2026-04-25-route-timeline-geometry-handoff.md](./2026-04-25-route-timeline-geometry-handoff.md)

## Purpose

Implement the next integration step: a pure adapter that converts the new route
timeline model into the existing `VesselTimeline` render-state shape.

This should be a parallel path, not an immediate replacement of the production
`VesselTimeline` query/render pipeline. The goal is to prove that the new
`RouteTimelineSnapshot -> DockVisit[] -> visual spans -> axis geometry` model
can drive the existing vertical timeline renderer.

## Current Foundation

Already implemented:

```text
RouteTimelineSnapshot backend schema/query
  -> ConvexRouteTimelineContext
  -> RouteTimelineModel selectors
  -> visual spans
  -> axis geometry
```

Missing bridge:

```text
RouteTimelineAxisGeometry
  -> VesselTimelineRenderState-compatible data
```

## Required Reading

Before editing, read:

- [docs/convex_rules.mdc](../convex_rules.mdc)
- [.cursor/rules/code-style.mdc](../../.cursor/rules/code-style.mdc)
- [2026-04-25-route-timeline-read-model-memo.md](./2026-04-25-route-timeline-read-model-memo.md)
- [2026-04-25-route-timeline-read-model-prd.md](./2026-04-25-route-timeline-read-model-prd.md)
- [2026-04-25-route-timeline-geometry-handoff.md](./2026-04-25-route-timeline-geometry-handoff.md)

Review current `VesselTimeline` render pipeline interfaces:

- [src/features/VesselTimeline/types.ts](../../src/features/VesselTimeline/types.ts)
- [src/features/VesselTimeline/renderPipeline/fromRouteTimelineModel.ts](../../src/features/VesselTimeline/renderPipeline/fromRouteTimelineModel.ts)
- [src/features/VesselTimeline/VesselTimelineContent.tsx](../../src/features/VesselTimeline/VesselTimelineContent.tsx)

Review new route timeline model:

- [src/features/RouteTimelineModel/selectors.ts](../../src/features/RouteTimelineModel/selectors.ts)
- [src/features/RouteTimelineModel/visualSpans.ts](../../src/features/RouteTimelineModel/visualSpans.ts)
- [src/features/RouteTimelineModel/axisGeometry.ts](../../src/features/RouteTimelineModel/axisGeometry.ts)

## Implementation Scope

Add a pure adapter that starts from route timeline model data and returns a
`VesselTimelineRenderState` or a closely related static render state.

Recommended path:

- `src/features/VesselTimeline/renderPipeline/fromRouteTimelineModel.ts`
- `src/features/VesselTimeline/renderPipeline/tests/fromRouteTimelineModel.test.ts`

Alternative path is acceptable if module ownership is clearer, but avoid
putting this inside a UI component file.

## Suggested Flow

The adapter should likely do:

```text
RouteTimelineSnapshot
  -> selectVesselDockVisits(snapshot, vesselAbbrev)
  -> selectDockVisitVisualSpans(dockVisits)
  -> deriveRouteTimelineAxisGeometry(spans, layout-compatible config)
  -> TimelineRenderRow[]
  -> rowLayouts
  -> terminalCards
  -> contentHeightPx
  -> activeRowIndex / activeIndicator placeholder
```

Start with **static render state** if active indicator adaptation gets thorny:

- rows
- row layouts
- terminal cards
- content height
- active row index default
- `activeIndicator: null`

That is enough to validate the new model can render the timeline scaffold.

## Static Row Mapping

Map visual spans into existing shared renderer rows:

- `at-dock` visual span -> `TimelineRenderRow.kind = "at-dock"`
- `crossing` visual span -> `TimelineRenderRow.kind = "at-sea"` for
  compatibility with the existing renderer naming
- use span axis height for `displayHeightPx`
- derive start/end render events from span boundaries
- preserve terminal labels and time points

Use the existing `TimelineRenderRow` and `TimelineRenderEvent` contracts from
`src/components/timeline`.

## Terminal Cards

Recreate or reuse the current terminal-card geometry behavior:

- dock span followed by crossing span from the same terminal should be able to
  render as one merged terminal background
- standalone dock spans should still get a terminal card
- terminal-tail behavior should remain visually sensible

Do not over-optimize this in the first pass. It is acceptable to produce the
same terminal-card geometry shape as the current pipeline with clear tests.

## Active Indicator

Prefer deferring live active indicator support unless it remains simple.

If included, keep it pure and compatible with the current policy:

- active interval ownership from actual boundaries
- dock progress by display time
- crossing progress by display time or later by live `VesselLocation`

Do not wire live `VesselLocation` into this adapter in the first pass unless the
work stays small. The adapter can return `activeIndicator: null` while proving
static scaffold rendering.

## Compressed Start Edge

Important design question:

The current production path compresses a long first dock row through
`isCompressedStartDockRow(...)`, which checks previous-day
`ScheduledDeparture`. The current route timeline boundary shape does not carry
that exact previous-day field.

Options:

1. mark the first long real dock span as a compressed start edge in the adapter
2. extend the route timeline boundary/schema in a later backend pass
3. accept only missing-arrival `start-of-day` capping until more metadata is
   available

Do not silently change this behavior without a test or explicit note. If the
adapter cannot preserve current behavior yet, document the gap in the test or
module comment.

## Non-Goals

Do not:

- remove the current `getVesselTimelineBackbone` path
- change the public `VesselTimeline` component to use the new adapter by
  default
- refactor `VesselTimelineContent`
- build single-trip timeline UI
- add route selection integration
- call Convex from the adapter
- use live `VesselLocation` unless active indicator support is explicitly
  scoped and tested

## Tests To Add

Add focused pure adapter tests.

Required cases:

- empty snapshot or missing vessel yields empty render state
- dock/crossing/dock spans map to at-dock/at-sea/at-dock rows
- row heights and `contentHeightPx` come from axis geometry
- row layout y positions match axis span positions
- render event time points preserve scheduled/predicted/actual fields
- crossing row start label points to destination terminal
- terminal-tail span maps to final row behavior
- terminal card geometry covers dock rows in a way compatible with current
  rendering

Optional:

- compare a small fixture against current event-first render-state expectations
- active indicator remains null in this static adapter stage
- compressed start edge gap is documented or tested

## Acceptance Criteria

- A pure adapter exists from route timeline model data to
  `VesselTimelineRenderState` or a clearly named static subset.
- The current production `VesselTimeline` behavior is not changed.
- The adapter uses `RouteTimelineModel` selectors/spans/geometry rather than
  rebuilding event adjacency itself.
- Tests cover row mapping, geometry transfer, and terminal-card basics.
- Existing `RouteTimelineModel` tests still pass.
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

If the adapter test path differs, adjust the focused command accordingly.

## Copy-Paste Note

Please implement the next route timeline integration step: a pure adapter from
the new `RouteTimelineModel` into the existing `VesselTimeline` render-state
shape. Read
`docs/engineering/2026-04-25-vessel-timeline-route-model-adapter-handoff.md`,
`docs/engineering/2026-04-25-route-timeline-read-model-memo.md`,
`docs/engineering/2026-04-25-route-timeline-read-model-prd.md`,
`docs/engineering/2026-04-25-route-timeline-geometry-handoff.md`,
`docs/convex_rules.mdc`, and `.cursor/rules/code-style.mdc` first. Add a pure
adapter, likely under `src/features/VesselTimeline/renderPipeline`, that takes
a `RouteTimelineSnapshot` plus vessel scope, uses the new selectors, visual
spans, and axis geometry, and returns a `VesselTimelineRenderState` or static
render-state subset for the existing vertical timeline renderer. Start with
static scaffold data: rows, row layouts, terminal cards, content height, and
`activeIndicator: null` if live indicator support is too large. Do not replace
the production `VesselTimeline` path yet, do not call Convex, and do not build
new UI. Add focused adapter tests and verify with the RouteTimelineModel tests,
the adapter test, `bun run type-check`, and `bun run check:fix`.
