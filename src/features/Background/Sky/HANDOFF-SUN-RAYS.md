# Handoff: Sun component — rays render as “little bumps”

## Corrected diagnosis

**Previous (wrong) diagnosis:** The sun was thought to be tiny because of viewport/unit scaling; we added a fixed-size container (120–140px) and 1:1 viewBox units so rays would be “25–50px.” The user confirmed this was wrong: changing units changed nothing.

**Actual situation:**
- The **sun is large on screen.** Sizing/viewport is not the issue.
- The **rays look like “little bumps”** — i.e. the **shape/geometry of the rays** is wrong, not their size.
- The problem is in **how each ray is drawn** (path geometry in `Sun.tsx`), not in layout or viewBox.

## Desired behavior

- **Sun** ([src/features/BackgroundFeatures/Sky/Sun.tsx](src/features/BackgroundFeatures/Sky/Sun.tsx)): Renders a sun with `rayCount` **rays** between `innerRadius` and `outerRadius`.
- Each ray should read as a **wedge/gear tooth**: a clear triangular-like shape from inner to outer radius, with **rounded tips** at both ends (quadratic Bézier, no sampling).
- User expectation: rays should be **visibly distinct** (like a gear with rounded teeth), not a smooth ring or a circle with small bumps.

## Current implementation (where to look)

**File:** [src/features/BackgroundFeatures/Sky/Sun.tsx](src/features/BackgroundFeatures/Sky/Sun.tsx)

- **Path builder:** `buildSunRayPaths` (lines ~116–162). For each ray index `i` it builds one closed path:
  - Vertices: A (inner, angleLeft), B (outer, angleLeft), C (outer, angleRight), D (inner, angleRight).
  - Outer cap: quadratic Bézier from B to C with control at `(outerRadius + outerBulge, midAngle)`.
  - Inner cap: quadratic Bézier from D to A with control at `(innerRadius - innerBulge, midAngle)`.
  - Path: `M A L B Q outerTip C L D Q innerTip A Z`.
- **Bulge constants:** `OUTER_CAP_BULGE_FRACTION = 0.35`, `INNER_CAP_BULGE_FRACTION = 0.35` (lines 19–21). Used so the caps bulge out/in and don’t look like a smooth circle.
- **Center:** Filled circle at center (radius `innerRadius`) to avoid a donut hole (line 72).

**Layout:** [src/features/BackgroundFeatures/Sky/SunburstLayout.tsx](src/features/BackgroundFeatures/Sky/SunburstLayout.tsx) centers the Sun in a 140×140px View at the same center as the sunburst; Sun receives `innerRadius=25`, `outerRadius=50`, `size=140`, `rayCount` from props. Layout is not the cause of “little bumps.”

## Likely cause of “little bumps”

The **ray shape** is wrong. Possibilities to investigate:

1. **Quadratic curve effect:** With control at `outerRadius + bulge` and `innerRadius - bulge`, the Q curves might still be too “soft,” so the boundary reads as a smooth wavy circle and each ray reads as a small bump instead of a clear wedge. Experiment with:
   - Larger bulge fractions so rays extend further.
   - Different cap strategy (e.g. circular arc, or two Q segments per cap) so the ray boundary is more pronounced.

2. **Angular width vs. radial extent:** Each ray spans `sliceAngle = 2π / rayCount`. If `rayCount` is large (e.g. 12 from Sky), each wedge is narrow. Combined with strong rounding, the wedge might read as a bump. Try fewer rays or a different balance of wedge width vs. cap roundness.

3. **Path winding or overlap:** Confirm path direction and that rays don’t overlap or cancel; check that fill is correct for the intended “teeth” appearance.

4. **Visual reference:** Compare to [Sunburst](src/features/BackgroundFeatures/Sky/Sunburst.tsx), which draws rays as **triangular wedges from center** (with optional spiral Bézier). Sun is different (annular rays, inner → outer with rounded caps), but the goal is a clearly **tooth-like** silhouette, not a smooth or bumpy circle.

## What not to do

- Do **not** spend more time on viewport size, container size, or “1:1 pixel” mapping. The user confirmed the sun is large and that changing units did nothing.
- Do **not** assume the fix is in SunburstLayout or Sky; the fix is in the **ray path geometry** in `Sun.tsx`.

## Suggested next steps for the next agent

1. Open [src/features/BackgroundFeatures/Sky/Sun.tsx](src/features/BackgroundFeatures/Sky/Sun.tsx) and focus on `buildSunRayPaths` and the bulge constants.
2. Draw or reason about one ray in the current setup: where the four vertices and two Q controls sit, and how the resulting path looks (wedge vs. bump).
3. Adjust geometry so each ray is unambiguously wedge-like (e.g. stronger bulge, different cap construction, or fewer rays) and verify on device/simulator that rays look like distinct rounded teeth, not little bumps.
4. Optionally add a brief comment in `Sun.tsx` that the ray paths are intentionally tuned for a “gear with rounded teeth” look so future changes don’t regress the shape.
