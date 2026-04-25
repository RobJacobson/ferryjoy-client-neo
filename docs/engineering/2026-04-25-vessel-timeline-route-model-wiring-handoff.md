# VesselTimeline Route Model Wiring Handoff

**Date:** 2026-04-25

**Primary docs:**
- [2026-04-25-route-timeline-read-model-memo.md](./2026-04-25-route-timeline-read-model-memo.md)
- [2026-04-25-route-timeline-read-model-prd.md](./2026-04-25-route-timeline-read-model-prd.md)
- [2026-04-25-route-timeline-frontend-context-handoff.md](./2026-04-25-route-timeline-frontend-context-handoff.md)
- [2026-04-25-route-timeline-selectors-handoff.md](./2026-04-25-route-timeline-selectors-handoff.md)
- [2026-04-25-route-timeline-geometry-handoff.md](./2026-04-25-route-timeline-geometry-handoff.md)
- [2026-04-25-vessel-timeline-route-model-adapter-handoff.md](./2026-04-25-vessel-timeline-route-model-adapter-handoff.md)
- [2026-04-25-vessel-timeline-route-model-active-indicator-handoff.md](./2026-04-25-vessel-timeline-route-model-active-indicator-handoff.md)

## Purpose

Wire the new route-timeline read model into the production `VesselTimeline`
experience for iOS simulator testing.

This document captures the wiring stage that introduced a temporary comparison
switch. That switch and legacy path have now been removed in favor of a
single route-model pipeline.

## Required Reading

Before editing, read:

- [docs/convex_rules.mdc](../convex_rules.mdc)
- [.cursor/rules/code-style.mdc](../../.cursor/rules/code-style.mdc)
- [src/features/VesselTimeline/VesselTimeline.tsx](../../src/features/VesselTimeline/VesselTimeline.tsx)
- [src/features/VesselTimeline/hooks/useVesselTimelinePresentationState.ts](../../src/features/VesselTimeline/hooks/useVesselTimelinePresentationState.ts)
- [src/data/contexts/convex/ConvexRouteTimelineContext.tsx](../../src/data/contexts/convex/ConvexRouteTimelineContext.tsx)
- [src/features/VesselTimeline/renderPipeline/fromRouteTimelineModel.ts](../../src/features/VesselTimeline/renderPipeline/fromRouteTimelineModel.ts)

## Current State

The active production `VesselTimeline` route-model contract is:

```text
ConvexRouteTimelineProvider
  -> useConvexRouteTimeline()
  -> fromRouteTimelineModel(...)
  -> VesselTimelineContent
```

The route-model adapter already produces rows, layout, terminal cards, active
row state, and the active indicator.

## Implementation Policy

The route-model path is now the only supported production path. Do not
re-introduce legacy fallback branches or temporary pipeline constants.

## Implementation Outline

1. Load route timeline data with `ConvexRouteTimelineProvider`.
2. Preserve the current vessel-scoped behavior by passing the current
   `vesselAbbrev` and `sailingDay`.
3. Feed the selected snapshot, vessel abbrev, current time, terminal-name lookup,
   and live `VesselLocation` into `fromRouteTimelineModel(...)`.
4. Keep live vessel location data separate from the route timeline snapshot.
   Route timeline data provides scaffolding; `VesselLocation` drives the live
   indicator.

## Open Integration Detail

The adapter requires:

```ts
getTerminalNameByAbbrev: (terminalAbbrev: string) => string | null;
vesselLocation?: VesselLocation | null;
```

Use existing app context/hooks for terminal lookup and live vessel location if
available near `VesselTimeline`. If those values are not already available at the
feature boundary, add the narrowest local plumbing needed. Avoid creating a new
global abstraction just for this testing stage.

## Loading And Error Policy

For the route-model path:

- Use the `ConvexRouteTimelineContext` loading and error state.
- Avoid an extra one-off query from inside the timeline renderer.
- Keep the old status-view behavior recognizable.
- If both old and new providers are mounted for comparison, avoid showing two
  independent loading states in the user-facing UI.

Preferred implementation is to mount only the provider needed by the constant.
Parallel mounting is acceptable only if it materially helps compare outputs and
does not complicate the user-visible state.

## Non-Goals

Do not:

- Add a remote feature-flag system.
- Add an Expo env flag for pipeline selection.
- Re-introduce the old pipeline.
- Build the single-trip timeline UI.
- Change backend schemas.
- Change route timeline query semantics.
- Move vessel live locations into route timeline snapshots.
- Add broad context abstractions unless the existing app shape clearly wants
  them.

## Tests To Add Or Update

Add focused coverage around route-model wiring:

- Route-model path builds render state with `fromRouteTimelineModel(...)`.
- Route-model loading state renders a status view.
- Route-model error state renders retry/error UI consistent with the old path.
- Missing vessel data still renders the existing empty/status behavior.

Keep tests focused on observable route-model behavior, not internal wiring flags.

## Simulator QA Checklist

In the iOS simulator, compare the new default path against the old path for at
least:

- A vessel before first actual departure.
- A vessel actively crossing.
- A vessel that has arrived and is at dock.
- A vessel near the end of its sailing day.
- A vessel/day with missing actuals or predictions.

Check:

- Row count and order.
- Dock/crossing labels.
- Row heights and terminal cards.
- Active row marker state.
- Indicator position, label, title, subtitle, and animation.
- Loading/retry behavior when switching vessels or sailing days.

## Acceptance Criteria

- `VesselTimeline` uses the route-model pipeline as the only supported path.
- Route timeline data comes from `ConvexRouteTimelineContext`.
- Live vessel location remains separate and feeds only live indicator behavior.
- No new backend queries or schemas are introduced.
- The app type-checks and formatting passes.
- Focused unit tests cover route-scope loading and route-model presentation
  behavior.
- The new default path is ready for iOS simulator QA.

## Verification Commands

Run:

```sh
bun test src/features/RouteTimelineModel/tests/selectors.test.ts
bun test src/features/RouteTimelineModel/tests/visualSpans.test.ts src/features/RouteTimelineModel/tests/axisGeometry.test.ts
bun test src/features/VesselTimeline/renderPipeline/tests/fromRouteTimelineModel.test.ts
bun test src/features/VesselTimeline/tests/pipelineMode.test.ts
bun test src/features/VesselTimeline/hooks/tests/useVesselTimelinePresentationState.test.ts
bun run type-check
bun run check:fix
```

Add any new focused tests for the wiring helper or hook and include them in the
verification run.

## Copy-Paste Message

Please implement the `VesselTimeline` route-model integration stage. Read
`docs/engineering/2026-04-25-vessel-timeline-route-model-wiring-handoff.md`,
`docs/engineering/2026-04-25-vessel-timeline-route-model-active-indicator-handoff.md`,
`docs/engineering/2026-04-25-vessel-timeline-route-model-adapter-handoff.md`,
`docs/engineering/2026-04-25-route-timeline-frontend-context-handoff.md`,
`docs/convex_rules.mdc`, and `.cursor/rules/code-style.mdc` first. Keep
`VesselTimeline` on the route-model-only path (`ConvexRouteTimelineProvider` +
`fromRouteTimelineModel(...)`) and keep live `VesselLocation` separate from the
route snapshot. Do not add remote flags, env flags, or legacy fallback branches.
Do not add backend schemas, one-off Convex reads, or single-trip UI. Add focused
tests for route-scope loading and route-model wiring behavior and verify with the
RouteTimelineModel tests, adapter tests, `bun run type-check`, and
`bun run check:fix`.
