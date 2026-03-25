# VesselTimeline Accessibility Memo

The `VesselTimeline` feature is a strong candidate for a dual-representation
accessibility strategy: keep the current visual timeline for sighted users, and
derive a separate semantic reading model for screen readers from the same
vessel/day event flow.

That recommendation follows directly from the current architecture in
[ARCHITECTURE.md](./ARCHITECTURE.md). The feature is already event-based, not
pixel-based at the data level. The backend returns an ordered vessel/day event
feed, the frontend converts adjacent events into semantic dock/sea rows, and
only then does the renderer turn those rows into fixed-height visual geometry.
That separation is exactly what we want for accessibility: assistive technology
should consume the semantic model, not the geometric one.

## Findings

The current implementation is visually expressive but likely difficult for
screen reader users.

- The primary renderer in
  [TimelineContent.tsx](./../components/TimelineContent.tsx) is layout-driven. It
  uses a scrollable canvas, fixed row heights, absolute overlays, a central
  track, terminal card backgrounds, and an active indicator. That is great for
  visual comprehension but does not naturally produce a meaningful reading
  order.
- The row UI in
  [TimelineRowContent.tsx](../../components/timeline/timelineRow/TimelineRowContent.tsx)
  splits one logical event across several independent subtrees: label, times,
  and marker.
- The label layer in
  [TimelineRowEventLabel.tsx](../../components/timeline/timelineRow/TimelineRowEventLabel.tsx)
  uses stylized decorative text and abbreviations like `Arv`, `To`, and
  terminal abbreviations. Those are compact visually, but not ideal for spoken
  output.
- The time layer in
  [TimelineRowEventTimes.tsx](../../components/timeline/timelineRow/TimelineRowEventTimes.tsx)
  renders both decorative shadow text and visible text, which risks duplicate
  or noisy announcements if exposed directly.
- The center marker in
  [TimelineRowMarker.tsx](../../components/timeline/timelineRow/TimelineRowMarker.tsx)
  is visually helpful, but likely decorative from an accessibility perspective
  unless it conveys unique status not expressed elsewhere.

The biggest practical risk is that a screen reader user may hear a fragmented
or repetitive sequence of partial information rather than a clean chronological
narration of the vessel's journey.

## Why The Architecture Helps

The architecture already gives you the right semantic units.

From [ARCHITECTURE.md](./ARCHITECTURE.md):

- The backend returns a sorted array of vessel/day dock events.
- The frontend constructs semantic rows from adjacent events.
- Row kinds already distinguish `at-dock` vs `at-sea`.
- Live data is already separated conceptually from stable schedule geometry.
- The active indicator is a separate concept from the underlying journey
  events.

This means accessibility can be implemented by deriving a spoken journey model
from the row/event render-state flow without changing the visual timeline math.

## Recommendation

Use a dual-layer accessibility design.

1. Preserve the existing visual timeline for sighted users.
2. Add a semantic screen-reader representation derived from the same `rows` and
   `activeIndicator`.
3. Hide decorative visual-only timeline elements from the accessibility tree.
4. Present each stop or segment as a single synthesized accessible item.

This is the safest and cleanest approach because it avoids forcing the spatial
layout itself to serve as the accessibility model.

## Preferred Accessible Representation

A list is the best default representation for screen readers.

A list works well because:

- chronology matters more than spacing
- events are naturally ordered
- users can swipe item-by-item through the journey
- each item can be summarized in plain language

Example spoken items:

- "Arrive Lopez Island. Scheduled 5:10 PM. Actual 5:01 PM."
- "Depart Lopez Island for Friday Harbor. Scheduled 5:15 PM. Actual 5:17 PM."
- "At sea to Friday Harbor. Speed 7 knots. 0.2 miles remaining."
- "Arrive Friday Harbor. Scheduled 5:50 PM. Estimated 5:54 PM."

That is much easier to navigate than exposing the current layered visuals
directly.

## Recommended UX Model

I'd recommend three accessible layers:

- A summary region at the top
- A chronological semantic list of events and segments
- Optional expandable detail within each item if needed later

The summary region should answer the top-level questions immediately:

- Which vessel and day is this?
- Where is the vessel now?
- What is the next important event?
- Is the vessel on time, delayed, or out of service?

For example:

"Issaquah timeline for Friday, March 18. Currently at sea to Friday Harbor.
Estimated arrival 5:54 PM. About 4 minutes late."

That gives context before the user enters the event list.

## Implementation Strategy

The best implementation is not to make the current visual subtree accessible
item-by-item. Instead, derive a dedicated semantic component from the render
state.

Suggested additions:

- `buildTimelineSummaryLabel(activeIndicator, rows, vessel metadata)`
- `buildRowAccessibilityLabel(row, maybeExpandedNames)`
- `AccessibleVesselTimelineList`

A likely structure in [TimelineContent.tsx](./../components/TimelineContent.tsx):

- Keep existing visual renderer as `VisualTimeline`
- Add `VesselTimelineAccessibilitySummary`
- Add `AccessibleVesselTimelineList`
- When a screen reader is enabled, either:
  - show only the semantic list, or
  - leave the visual timeline on screen but hide it from the accessibility tree

I prefer showing the semantic list to assistive tech and hiding the visual
timeline subtree from accessibility. It is less fragile and easier to reason
about.

## Accessibility Semantics To Use

For each semantic list item:

- make the container accessible
- give it one complete `accessibilityLabel`
- use one accessible parent rather than many nested accessible children
- keep the label in natural language
- avoid unexplained abbreviations

For the visual subtree:

- hide decorative children from accessibility
- ensure duplicate shadow text is not exposed
- ensure icons do not announce if they are only decorative
- ensure track/background/blur overlays do not participate in focus order

In practice that means the timeline renderer should likely use patterns such
as:

- `importantForAccessibility="no-hide-descendants"`
- `accessible={false}`
- `accessibilityElementsHidden`

depending on the specific RN target and component.

## What Should Be Hidden From Accessibility

These elements are good candidates to mark as decorative:

- timeline track in [TimelineContent.tsx](./../components/TimelineContent.tsx)
- terminal card backgrounds in
  [TimelineContent.tsx](./../components/TimelineContent.tsx)
- active indicator visual overlay in
  [TimelineContent.tsx](./../components/TimelineContent.tsx)
- marker chrome in
  [TimelineRowMarker.tsx](../../components/timeline/timelineRow/TimelineRowMarker.tsx)
- shadow/decorative label layers in
  [TimelineRowEventLabel.tsx](../../components/timeline/timelineRow/TimelineRowEventLabel.tsx)
- duplicate decorative time layers in
  [TimelineRowEventTimes.tsx](../../components/timeline/timelineRow/TimelineRowEventTimes.tsx)

## How To Phrase Spoken Labels

Spoken labels should use expanded, task-oriented language.

Prefer:

- "Arrive Friday Harbor"
- "Depart Lopez Island for Friday Harbor"
- "Scheduled 5:10 PM"
- "Actual 5:01 PM"
- "Estimated 5:54 PM"
- "Current segment"
- "At sea"
- "Docked at Friday Harbor"
- "Out of service"

Avoid:

- `Arv`
- `Dep`
- `To`
- unexplained terminal abbreviations
- icon-driven meaning
- decorative names read separately from the event sentence

If abbreviations must remain visible, the spoken label should expand them.

## How To Model Timeline Items

The semantic item model should follow journey meaning, not visual geometry.

Even if the visual timeline uses adaptive sizing, a screen reader should not
hear geometry-driven concepts. It should hear the actual state:

- "Docked at Friday Harbor for 3 hours"
- "Long layover at Friday Harbor"
- "Departing Friday Harbor at 6:20 PM"

The accessibility model should be based on semantic boundaries and real-world
status, not display-height heuristics.

## Live Updates

Because this component has a live active indicator, accessibility should
separate stable history from live status.

Recommended behavior:

- The event list should remain stable and chronological.
- The current vessel state should be announced in a summary region.
- If live status updates, the summary may use polite live-region semantics where
  supported.
- Do not continuously re-announce the entire timeline as the vessel moves.
- Avoid frequent accessibility churn for minor position changes unless they
  materially change user understanding.

Examples of meaningful live announcements:

- "Now departed Lopez Island."
- "Now at sea to Friday Harbor."
- "Now docked at Friday Harbor."
- "Estimated arrival updated to 5:54 PM."

Examples of noisy updates to avoid:

- repeated small progress changes
- every animation tick of the active indicator
- re-reading all visible timeline items after each location update

## Alternative Patterns

If you do not want a separate semantic list, there are two workable
alternatives.

First alternative: flatten each visual row into one accessible parent.

- Each `TimelineRow` becomes one accessible element
- All descendants are hidden from accessibility
- `accessibilityLabel` is synthesized from row semantics

This is a reasonable compromise, but it is more brittle because the visual
structure still drives the accessible tree.

Second alternative: provide a user-facing mode switch.

- "Visual timeline"
- "Accessible list"

This can be useful for all users, not just screen reader users, especially if
some low-vision or cognitive-access users prefer the simpler list even when not
using VoiceOver or TalkBack.

## Best-Practice Checklist

The implementation should aim for the following:

- Provide a concise timeline summary at the top.
- Expose one semantic item per meaningful event or segment.
- Use natural-language labels, not visual shorthand.
- Hide decorative visual layers from accessibility.
- Keep event order chronological and stable.
- Do not depend on spacing, color, iconography, or motion for meaning.
- Separate current/live status from historical events.
- Expand abbreviations in spoken output.
- Ensure adaptive row sizing is described semantically, not visually.
- Test with VoiceOver and TalkBack on real devices.
- Verify swipe order, rotor/navigation landmarks, repeated announcements, and
  live update behavior.

## Suggested Implementation Order

I'd sequence the work like this:

1. Add a summary label builder from existing render state.
2. Add a semantic list component derived from `rows` and `activeIndicator`.
3. Hide the visual timeline subtree from accessibility when the semantic list
   is present.
4. Add plain-language expansion for terminal and event abbreviations.
5. Tune live update behavior for the current vessel status.
6. Run manual screen reader testing and refine wording.

## Conclusion

The core issue is not that the component is "too visual" to make accessible.
The core issue is that the accessible representation should come from the
feature's event/row semantics, not from its pixel layout.

The good news is that your current architecture already supports this cleanly.
The feature has a backend-owned ordered event feed, a frontend semantic row
render-state layer, and a separate visual renderer. That makes `VesselTimeline` a strong
fit for a semantic list + visual timeline approach, which is likely the most
robust, maintainable, and user-friendly accessibility solution for this
component.
