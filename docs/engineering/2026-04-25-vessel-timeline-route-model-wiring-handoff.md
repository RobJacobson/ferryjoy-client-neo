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

This is not a remote feature-flag rollout. Use a temporary in-code constant for
local testing. The constant should default to the new route-model pipeline. Once
the route-model path is visually and behaviorally confirmed, the old pipeline and
the temporary constant should be deleted.

## Required Reading

Before editing, read:

- [docs/convex_rules.mdc](../convex_rules.mdc)
- [.cursor/rules/code-style.mdc](../../.cursor/rules/code-style.mdc)
- [src/features/VesselTimeline/VesselTimeline.tsx](../../src/features/VesselTimeline/VesselTimeline.tsx)
- [src/features/VesselTimeline/hooks/useVesselTimelinePresentationState.ts](../../src/features/VesselTimeline/hooks/useVesselTimelinePresentationState.ts)
- [src/data/contexts/convex/ConvexRouteTimelineContext.tsx](../../src/data/contexts/convex/ConvexRouteTimelineContext.tsx)
- [src/data/contexts/convex/ConvexVesselTimelineContext.tsx](../../src/data/contexts/convex/ConvexVesselTimelineContext.tsx)
- [src/features/VesselTimeline/renderPipeline/fromRouteTimelineModel.ts](../../src/features/VesselTimeline/renderPipeline/fromRouteTimelineModel.ts)

## Current State

The production `VesselTimeline` still uses the old vessel-timeline backend
contract:

```text
ConvexVesselTimelineProvider
  -> useConvexVesselTimeline()
  -> getVesselTimelineRenderState(...)
  -> VesselTimelineContent
```

The new path now exists but is not wired into the screen:

```text
ConvexRouteTimelineProvider
  -> useConvexRouteTimeline()
  -> fromRouteTimelineModel(...)
  -> VesselTimelineContent
```

The route-model adapter already produces rows, layout, terminal cards, active
row state, and the active indicator.

## Implementation Policy

Add a temporary constant, defaulting to the new route-model pipeline:

```ts
const USE_ROUTE_TIMELINE_MODEL_PIPELINE = true;
```

Keep it local to the `VesselTimeline` feature. This is a testing switch, not a
product flag. Do not add remote config, environment variables, or persistent user
settings.

The old pipeline should remain available behind the constant for quick simulator
comparison during this stage. Do not delete the old Convex vessel timeline query,
old render pipeline, or old context in this stage.

## Implementation Outline

1. Update `VesselTimeline` data hosting so the route-model path can be selected
   by the constant.
2. When the constant is `true`, load route timeline data with
   `ConvexRouteTimelineProvider`.
3. Preserve the current vessel-scoped behavior by passing the current
   `vesselAbbrev` and `sailingDay`.
4. Feed the selected snapshot, vessel abbrev, current time, terminal-name lookup,
   and live `VesselLocation` into `fromRouteTimelineModel(...)`.
5. Keep live vessel location data separate from the route timeline snapshot.
   Route timeline data provides scaffolding; `VesselLocation` drives the live
   indicator.
6. When the constant is `false`, keep the current
   `ConvexVesselTimelineProvider` and `getVesselTimelineRenderState(...)` path
   working.

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
- Add an Expo env flag for this temporary switch.
- Delete the old pipeline yet.
- Build the single-trip timeline UI.
- Change backend schemas.
- Change route timeline query semantics.
- Move vessel live locations into route timeline snapshots.
- Add broad context abstractions unless the existing app shape clearly wants
  them.

## Tests To Add Or Update

Add focused coverage around the switch point:

- Constant-on path builds render state with `fromRouteTimelineModel(...)`.
- Constant-off path still uses the old render pipeline.
- Route-model loading state renders a status view.
- Route-model error state renders retry/error UI consistent with the old path.
- Missing vessel data still renders the existing empty/status behavior.

If the constant is module-private and awkward to test directly, extract the
selection logic into a small pure helper that accepts an explicit pipeline mode.
Keep that helper feature-local and temporary.

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

- `VesselTimeline` uses the route-model pipeline by default through a temporary
  in-code constant.
- The old pipeline remains available by flipping the constant.
- Route timeline data comes from `ConvexRouteTimelineContext`.
- Live vessel location remains separate and feeds only live indicator behavior.
- No new backend queries or schemas are introduced.
- The app type-checks and formatting passes.
- Focused unit tests cover the pipeline selection behavior.
- The new default path is ready for iOS simulator QA.

## Verification Commands

Run:

```sh
bun test src/features/RouteTimelineModel/tests/selectors.test.ts
bun test src/features/RouteTimelineModel/tests/visualSpans.test.ts src/features/RouteTimelineModel/tests/axisGeometry.test.ts
bun test src/features/VesselTimeline/renderPipeline/tests/fromRouteTimelineModel.test.ts
bun test src/features/VesselTimeline/renderPipeline/tests/getVesselTimelineRenderState.test.ts
bun run type-check
bun run check:fix
```

Add any new focused tests for the wiring helper or hook and include them in the
verification run.

## Copy-Paste Message

Please implement the next `VesselTimeline` route-model integration stage. Read
`docs/engineering/2026-04-25-vessel-timeline-route-model-wiring-handoff.md`,
`docs/engineering/2026-04-25-vessel-timeline-route-model-active-indicator-handoff.md`,
`docs/engineering/2026-04-25-vessel-timeline-route-model-adapter-handoff.md`,
`docs/engineering/2026-04-25-route-timeline-frontend-context-handoff.md`,
`docs/convex_rules.mdc`, and `.cursor/rules/code-style.mdc` first. Add a
temporary in-code constant, defaulting to the new route-model pipeline, so iOS
simulator testing uses `ConvexRouteTimelineProvider` plus
`fromRouteTimelineModel(...)` by default while preserving the old
`ConvexVesselTimelineProvider` path behind the constant for comparison. Keep
live `VesselLocation` separate from the route snapshot and pass it only into the
adapter for active indicator behavior. Do not add remote flags, env flags, new
backend schemas, one-off Convex reads, or single-trip UI. Add focused tests for
the pipeline selection/wiring behavior and verify with the RouteTimelineModel
tests, adapter tests, old render-pipeline tests, `bun run type-check`, and
`bun run check:fix`.
