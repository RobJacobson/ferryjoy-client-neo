# VesselTimeline Route Model Simulator QA Handoff

**Date:** 2026-04-25

**Primary docs:**
- [2026-04-25-route-timeline-read-model-memo.md](./2026-04-25-route-timeline-read-model-memo.md)
- [2026-04-25-route-timeline-read-model-prd.md](./2026-04-25-route-timeline-read-model-prd.md)
- [2026-04-25-vessel-timeline-route-model-wiring-handoff.md](./2026-04-25-vessel-timeline-route-model-wiring-handoff.md)
- [2026-04-25-vessel-timeline-route-model-active-indicator-handoff.md](./2026-04-25-vessel-timeline-route-model-active-indicator-handoff.md)
- [2026-04-25-vessel-timeline-route-model-adapter-handoff.md](./2026-04-25-vessel-timeline-route-model-adapter-handoff.md)
- [2026-04-25-route-timeline-geometry-handoff.md](./2026-04-25-route-timeline-geometry-handoff.md)

## Purpose

Run iOS simulator QA for the route-model-backed `VesselTimeline` now that it is
the only supported path.

This stage is mostly observation and small targeted fixes. The goal is to
validate route-model behavior and catch regressions.

## Required Reading

Before testing or editing, read:

- [docs/convex_rules.mdc](../convex_rules.mdc)
- [.cursor/rules/code-style.mdc](../../.cursor/rules/code-style.mdc)
- [src/features/VesselTimeline/VesselTimeline.tsx](../../src/features/VesselTimeline/VesselTimeline.tsx)
- [src/features/VesselTimeline/renderPipeline/fromRouteTimelineModel.ts](../../src/features/VesselTimeline/renderPipeline/fromRouteTimelineModel.ts)
- [src/app/vessel-timeline-placeholder.tsx](../../src/app/vessel-timeline-placeholder.tsx)

## Current State

The iOS simulator should exercise:

```text
ConvexRouteTimelineProvider
  -> useRouteModelVesselTimelinePresentationState()
  -> fromRouteTimelineModel(...)
  -> VesselTimelineContent
```

The legacy path has been deleted and is no longer available for comparison.

## QA Setup

Use the vessel timeline placeholder screen in the iOS simulator. It already
passes `routeAbbrev` from the selected live vessel option into `VesselTimeline`,
which avoids waiting for the timeline component to rediscover route scope.

If a visual mismatch is found:

1. Reproduce with the same vessel, sailing day, and design variant.
2. Decide whether the mismatch is a route-model bug, adapter bug, data issue, or
   acceptable intentional difference.

## Vessels And States To Cover

Test at least one vessel in each state when the data is available:

- Before first actual departure.
- Actively crossing.
- Arrived and at dock.
- Near the end of its sailing day.
- Missing actuals or predictions.
- Departure-only first visit.
- Arrival-only terminal-tail final visit.

Prefer current in-service vessels first, then use another vessel/day if the
current route does not expose a particular edge case.

## Visual Checklist

Validate route-model output for:

- Row count and order.
- Dock rows versus crossing rows.
- Terminal abbreviations and display names.
- `Arv`, `Dep`, and `To` row labels.
- Scheduled, predicted, and actual time display.
- Row heights and compressed short intervals.
- Start-of-day dock treatment.
- Terminal-tail final row treatment.
- Terminal card placement and height.
- Marker appearance before and after the active row.
- Active indicator row ownership.
- Indicator vertical position.
- Indicator label minutes.
- Indicator title and subtitle.
- Indicator animation while crossing.
- Loading state while changing vessels.
- Retry/error state if Convex is disconnected.

## Fix Guidance

Prefer small, well-scoped fixes:

- If row selection is wrong, check `RouteTimelineModel` selectors and visual
  spans first.
- If row height or Y-position is wrong, check `axisGeometry`.
- If labels, terminal cards, or render-row fields are wrong, check
  `fromRouteTimelineModel`.
- If active row or indicator behavior is wrong, check
  `fromRouteTimelineModel` active-span and indicator helpers.
- If data is absent or duplicated, inspect the backend route timeline snapshot
  query and builder.
- Prefer making route-model behavior explicit and tested instead of introducing
  fallback transforms.

Add or update focused tests for every code fix. Avoid broad UI snapshot tests for
this stage unless they already exist locally.

## Non-Goals

Do not:

- Re-introduce the legacy pipeline.
- Add a temporary pipeline constant.
- Build the single-trip timeline UI.
- Add remote or environment feature flags.
- Move live vessel locations into route timeline snapshots.
- Change backend schema shape unless a real data-model bug is discovered.
- Refactor unrelated timeline prototypes.

## Acceptance Criteria

- The iOS simulator renders the route-model `VesselTimeline` by default.
- The tested vessels cover the major operational states listed above, or notes
  explain why a state was unavailable.
- Any route-model mismatches are documented.
- Any clear bugs found during QA are fixed with focused tests.
- `bun run type-check` passes.
- `bun run check:fix` passes.

## Verification Commands

After any code changes, run the relevant focused tests plus:

```sh
bun test src/features/RouteTimelineModel/tests/selectors.test.ts
bun test src/features/RouteTimelineModel/tests/visualSpans.test.ts src/features/RouteTimelineModel/tests/axisGeometry.test.ts
bun test src/features/VesselTimeline/renderPipeline/tests/fromRouteTimelineModel.test.ts
bun test src/features/VesselTimeline/tests/pipelineMode.test.ts
bun test src/features/VesselTimeline/hooks/tests/useVesselTimelinePresentationState.test.ts
bun run type-check
bun run check:fix
```

If QA produces only observations and no code changes, record those observations
in the final handoff response rather than creating code churn.

## Copy-Paste Note

Please run iOS simulator QA for the route-model-backed `VesselTimeline`. Read
`docs/engineering/2026-04-25-vessel-timeline-route-model-simulator-qa-handoff.md`,
`docs/engineering/2026-04-25-vessel-timeline-route-model-wiring-handoff.md`,
`docs/engineering/2026-04-25-vessel-timeline-route-model-active-indicator-handoff.md`,
`docs/convex_rules.mdc`, and `.cursor/rules/code-style.mdc` first. Use the
vessel timeline placeholder screen in the iOS simulator and check row order,
labels, times,
row heights, terminal cards, active row, active indicator position/copy/animation,
loading, and retry behavior across before-departure, crossing, at-dock, end-of-day,
missing-data, departure-only, and arrival-only cases. Fix small confirmed bugs
with focused tests, but do not add legacy fallback paths, add remote flags, build
single-trip UI, or change backend schemas unless a real
snapshot data bug is found. Finish with notes on mismatches found and run the
focused RouteTimelineModel/VesselTimeline tests plus `bun run type-check` and
`bun run check:fix` after any code changes.
