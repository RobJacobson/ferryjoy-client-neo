## Map navigation + animation (deep links)

This document explains how Ferryjoy’s Map tab deep links work, how camera animations are triggered, and which files/data drive map behavior.

### Goals
- **Deep linkable map views**:
  - `/map` shows the map tab (base view)
  - `/map/:slug` shows a “focused” map view for a **terminal** or a **route**
- **Predictable camera transitions**:
  - entering a slug screen should visibly animate (Seattle overview → target)
  - switching away to other tabs and coming back should **not** re-run the animation
- **Single source of truth (SSoT)** for terminal/route metadata used by map screens and animations.

---

## Navigation structure

### App routing tree (Expo Router)
- Root stack: `src/app/_layout.tsx`
  - `index` (home)
  - `(tabs)` (tab navigator)

- Tabs: `src/app/(tabs)/_layout.tsx`
  - `map` (folder route)
  - `terminals`, `vessels`, `schedules`, `chat`

### Map tab routes
Map is implemented as a folder route:
- `src/app/(tabs)/map/index.tsx`
  - base map screen (no deep-link focus)
- `src/app/(tabs)/map/[slug].tsx`
  - focused map screen for a terminal/route deep link
- `src/app/(tabs)/map/_layout.tsx`
  - nested stack header config for Map

### Header / back button behavior
- Header customization lives in `src/app/(tabs)/map/_layout.tsx`.
- The header shows a left button labeled **Home**.
- Press behavior:
  - `router.back()` if there’s a back stack (gives back animation)
  - else `router.replace("/")` (for true deep links with no history)

---

## Single source of truth: map entities

### SSoT file
All terminals/routes used by `/map/:slug` are defined in **one file**:
- `src/data/mapEntities.ts`

This file contains:
- **`MAP_ENTITIES`**: a record of every known terminal + route keyed by slug
  - `slug`: string (terminal slugs are lowercase abbreviations like `bbi`; routes are abbrevs like `ana-sj`)
  - `kind`: `"terminal" | "route"`
  - `title`: header + bottom sheet title
  - `camera`: canonical `CameraState` target `{ centerCoordinate, zoomLevel, heading, pitch }`

- **`MAP_NAV_CONFIG`**: shared defaults used by slug screens
  - `startCamera`: the “Seattle overview” camera (used for the snap step)
  - `flyTo`: duration and delay settings, plus optional `targetZoomOverride`
  - `bottomSheet`: default snap points and initial index

### Fail-fast behavior
Slug screens do **not** fall back to WSF JSON assets.
- If a slug is missing from `MAP_ENTITIES`, `/map/:slug` redirects to `src/app/+not-found.tsx`.

This ensures the map behavior is always driven by one TS data file.

### How `mapEntities.ts` is created
`src/data/mapEntities.ts` is currently generated from WSF JSON assets as a starting point.
- Generator script: `scripts/generateMapEntities.ts`
- To regenerate:

```bash
npx tsx scripts/generateMapEntities.ts
```

After generation, you can hand-tune camera targets in `src/data/mapEntities.ts`.

---

## Camera architecture

### Canonical camera type
The app uses a shared camera shape:
- `CameraState` in `src/features/MapComponent/shared.ts`

Fields:
- `centerCoordinate`: `[longitude, latitude]`
- `zoomLevel`: number
- `heading`: number
- `pitch`: number

### Camera control surface
Map screens animate using a cross-platform controller:
- Context: `src/data/contexts/MapCameraControllerContext.tsx`
- Provider is mounted in: `src/data/Providers.tsx`

Platform implementations register a controller:
- Native: `src/features/MapComponent/MapComponent.tsx`
  - uses `@rnmapbox/maps` camera ref and `setCamera({ animationMode, animationDuration, ... })`
- Web: `src/features/MapComponent/MapComponent.web.tsx`
  - uses MapRef and `flyTo({ center, zoom, bearing, pitch, duration })`

The controller API used by screens:
- `controller.flyTo(targetCameraState, { durationMs })`

Implementation detail:
- Native treats `durationMs: 0` as `animationMode: "none"` to perform an immediate snap.

---

## Animation structure

### Where the animation logic lives
- `src/app/(tabs)/map/[slug].tsx`

### When animation runs
The slug screen runs the animation only when:
- navigating from **Home** (`/` or `/index`), or
- navigating from another **map route** (path includes `/map`)

It does **not** re-run when:
- you leave the map tab for another tab and come back

This behavior is implemented using:
- `NavigationHistoryProvider` in `src/data/contexts/NavigationHistoryContext.tsx`
  - tracks `previousPathname` and `currentPathname` from `usePathname()`

### The 2-step animation (snap then fly)
To ensure the user actually sees an animation, slug navigation uses a two-phase transition:
1. **Snap** to `MAP_NAV_CONFIG.startCamera` with `durationMs: 0`
2. After `MAP_NAV_CONFIG.flyTo.delayMs`, **flyTo** the target camera

The final target camera is:
- `entity.camera` from `MAP_ENTITIES[slug]`
- optionally with `zoomLevel` overridden by `MAP_NAV_CONFIG.flyTo.targetZoomOverride`

### “Only once per focus” guards
`map/[slug]` keeps refs to prevent duplicate scheduling while focused:
- `lastAnimatedPathRef`
- `pendingAnimationPathRef`
- `flyToTimeoutRef`

On blur, it clears the timeout and resets refs so back-navigation can animate again.

---

## Bottom sheet

### Component
- `src/features/TerminalOrRouteBottomSheet/TerminalOrRouteBottomSheet.tsx`

### Defaults
Default snap points / initial index are defined in `MAP_NAV_CONFIG.bottomSheet` in:
- `src/data/mapEntities.ts`

The slug screen passes these values into the bottom sheet.

---

## Debug overlay

To help tune camera targets, a small overlay shows camera values:
- `src/features/MapDebugOverlay/MapDebugOverlay.tsx`

It’s mounted on:
- `src/app/(tabs)/map/index.tsx`
- `src/app/(tabs)/map/[slug].tsx`

---

## Quick reference: “Where do I change X?”
- **Add or adjust a terminal/route camera**: `src/data/mapEntities.ts` → `MAP_ENTITIES[slug].camera`
- **Change Seattle overview start**: `src/data/mapEntities.ts` → `MAP_NAV_CONFIG.startCamera`
- **Change flyTo duration/delay/zoom override**: `src/data/mapEntities.ts` → `MAP_NAV_CONFIG.flyTo`
- **Change bottom sheet default height**: `src/data/mapEntities.ts` → `MAP_NAV_CONFIG.bottomSheet`
- **Change when animation triggers**: `src/app/(tabs)/map/[slug].tsx`
- **Change header Home button**: `src/app/(tabs)/map/_layout.tsx`
