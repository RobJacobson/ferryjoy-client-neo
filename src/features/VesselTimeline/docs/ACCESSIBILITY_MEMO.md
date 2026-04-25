# VesselTimeline Accessibility Memo

`VesselTimeline` is a strong candidate for a dual-representation accessibility
strategy:

- keep the current visual timeline for sighted users
- derive a separate semantic representation for assistive technology

That recommendation still matches the current architecture. The feature already
separates:

- merged boundary events
- semantic dock/sea segments
- render-time geometry

That is the important boundary: assistive technology should consume the
semantic model, not the pixel geometry.

## Current Risk

The current renderer is visually expressive, but likely awkward for screen
reader users if exposed directly.

Relevant code:

- [VesselTimelineContent.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/VesselTimelineContent.tsx)
- [TimelineRowContent.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/components/timeline/timelineRow/TimelineRowContent.tsx)
- [TimelineRowLabel.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/components/timeline/timelineRow/TimelineRowLabel.tsx)
- [TimelineRowTimes.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/components/timeline/timelineRow/TimelineRowTimes.tsx)
- [TimelineRowMarker.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/components/timeline/timelineRow/TimelineRowMarker.tsx)

Why:

- the timeline is layout-heavy and spatial
- one logical event is split across multiple visual subtrees
- abbreviations and decorative text are optimized for scanning, not speech
- overlays, markers, blur, and track chrome are useful visually but likely
  noisy in the accessibility tree

The practical risk is a fragmented reading experience instead of a clean
chronological narration of the vessel’s journey.

## Why The Current Architecture Helps

The feature already gives us the right semantic units.

- merged boundary events are ordered and stable
- dock and sea segments are already explicit
- live state is separate from the stable journey structure
- the active indicator is already modeled separately from the rows

That means we do not need to make the visual layout itself accessible. We can
derive a better accessibility model from the same underlying data.

## Recommended Direction

If we enhance accessibility here, the safest path is:

1. keep the existing visual timeline
2. derive a semantic summary and chronological list from the same render-state
   inputs
3. expose that semantic representation to accessibility
4. hide decorative visual-only timeline chrome from the accessibility tree

This is safer than trying to make the current layered visual subtree read well
item by item.

## Preferred Accessible Representation

A chronological list is the best default representation for screen readers.

Why it fits:

- chronology matters more than spacing
- the journey is naturally ordered
- users can navigate item by item
- each item can be phrased in plain language

Example spoken items:

- "Arrive Lopez Island. Scheduled 5:10 PM. Actual 5:01 PM."
- "Depart Lopez Island for Friday Harbor. Scheduled 5:15 PM. Actual 5:17 PM."
- "At sea to Friday Harbor. Speed 7 knots. 0.2 miles remaining."
- "Arrive Friday Harbor. Scheduled 5:50 PM. Estimated 5:54 PM."

## Recommended UX Model

The most useful accessible structure would be:

- a top summary region
- a chronological semantic list of segments and boundary events
- optional deeper detail later if we decide it is needed

The summary should answer the top-level questions quickly:

- which vessel and day is this
- where is the vessel now
- what is the next important event
- is the vessel on time, delayed, or out of service

Example:

"Issaquah timeline for Friday, March 18. Currently at sea to Friday Harbor.
Estimated arrival 5:54 PM. About 4 minutes late."

## Likely Implementation Shape

The best implementation is probably not "make the current visual subtree
accessible." Instead, add a dedicated semantic layer derived from the same
inputs.

Likely additions:

- `buildTimelineSummaryLabel(...)`
- `buildRowAccessibilityLabel(...)`
- `AccessibleVesselTimelineList`

A likely shape in or around
[VesselTimelineContent.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/VesselTimelineContent.tsx):

- keep the current visual timeline renderer
- add a summary component for the current vessel state
- add a semantic list component for assistive technology
- hide decorative visual-only elements from accessibility

I would prefer the semantic list as the primary accessibility representation,
with the visual subtree hidden from screen-reader focus.

## Accessibility Semantics To Prefer

For each logical item:

- use one accessible parent
- give it one complete `accessibilityLabel`
- use natural language
- expand abbreviations
- avoid splitting one idea across several focus targets

For the visual subtree:

- hide decorative descendants from accessibility
- ensure shadow text is not announced twice
- ensure icons and markers do not announce when decorative
- keep track/background/overlay layers out of focus order

In practice that likely means some combination of:

- `accessible={false}`
- `importantForAccessibility="no-hide-descendants"`
- `accessibilityElementsHidden`

depending on target platform behavior.

## Good Spoken Language

Prefer labels like:

- "Arrive Friday Harbor"
- "Depart Lopez Island for Friday Harbor"
- "Scheduled 5:10 PM"
- "Actual 5:01 PM"
- "Estimated 5:54 PM"
- "At sea"
- "Docked at Friday Harbor"
- "Out of service"

Avoid:

- `Arv`
- `Dep`
- `To`
- unexplained terminal abbreviations
- decorative or icon-driven meaning

If abbreviations remain visible in the UI, spoken labels should still expand
them.

## What Should Stay Out Of The Accessibility Tree

These are good candidates to mark as decorative:

- timeline track
- terminal card backgrounds
- active indicator overlay
- marker chrome
- shadow/decorative label layers
- duplicate decorative time layers

The principle is simple: expose the journey meaning once, not every visual
piece used to render it.

## Live Updates

Because `VesselTimeline` has live status and an active indicator, accessibility
should separate stable history from current live state.

Recommended behavior:

- keep the event list stable and chronological
- announce current status in the summary region
- use polite live updates only for meaningful changes
- do not re-announce the full timeline for minor position changes

Good live announcements:

- "Now departed Lopez Island."
- "Now at sea to Friday Harbor."
- "Now docked at Friday Harbor."
- "Estimated arrival updated to 5:54 PM."

Noisy updates to avoid:

- every animation tick
- tiny continuous progress changes
- rereading all rows after each location update

## Guidance For Future Work

- Build accessibility from semantic rows and live state, not from row height or
  overlay geometry.
- Prefer one clear accessible item per dock or sea segment.
- Keep the visual timeline expressive, but hide decorative chrome from
  assistive tech.
- If we add this work later, start with a summary plus semantic list before
  trying to perfect every visual row.
