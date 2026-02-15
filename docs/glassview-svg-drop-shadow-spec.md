# Engineering Specification: SVG Drop Shadow for GlassView

**Status:** Deprecated / Reference Implementation  
**Date:** February 2025  
**Context:** FerryJoy Client Neo — Glass-style UI with semi-transparent panels

---

## 1. Problem Statement

### 1.1 Native Shadow Limitations

React Native's built-in shadow APIs (`shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`, `elevation`) do **not** work reliably with semi-transparent backgrounds:

- **iOS:** Shadows require an opaque background to render. With `bg-white/25` (25% opacity), the shadow typically does not appear at all.
- **Android:** `elevation` can produce inconsistent or invisible results with transparent views.
- **RN 0.76+ `boxShadow`:** Casts around the border box but still has opaque-background requirements on iOS.

### 1.2 Desired Behavior

- Drop shadow visible **only outside** the glass panel edges
- No darkening of the glass interior (the semi-transparent area)
- No third-party native modules (Expo compatibility)
- Reuse existing `react-native-svg` dependency (already used by AnimatedWave)

---

## 2. Implementation Overview

### 2.1 Technique: Layered Offset + SVG Mask

The implementation uses two techniques already proven in this codebase:

1. **Layered offset rects** — Same pattern as `AnimatedWave.tsx` (see `src/features/Background/Waves/config.ts`). Multiple semi-transparent black `Rect` elements are drawn with small offsets `[dx, dy]` to simulate a soft shadow falloff.
2. **SVG Mask** — A mask cuts out the glass interior so the shadow is visible only in the exterior "ring" around the panel. Without this mask, the layered rects would show through the semi-transparent glass and darken it.

### 2.2 Component Structure

```
GlassView (shadow=false, default)
└── View  ← Single view, original layout (no wrapper)

GlassView (shadow=true)
└── View (wrapper: flex: 1, position: relative)
    ├── View (shadow container: absolute, pointer-events: none)
    │   └── Svg
    │       ├── Defs
    │       │   └── Mask (white full area, black center = glass shape)
    │       └── G (mask applied)
    │           └── Rect × N (layered shadow layers)
    └── View (glass content: flex: 1, onLayout)
        └── children
```

### 2.3 Critical Layout Constraint

**The wrapper must participate in the flex layout.** When `shadow=true`:

- The **wrapper** receives `flex: 1` (via StyleSheet) and the user's `style` so it expands to fill the parent (e.g., BlurView).
- The **inner glass View** receives `flex: 1`, `minHeight: 0`, and the user's `className` so it fills the wrapper and lays out children correctly.

If the wrapper does not have `flex: 1`, it will collapse to zero height (sizing to its absolutely positioned shadow, which is out of flow), and the glass content will not display.

---

## 3. Implementation Details

### 3.1 Shadow Config Constants

```typescript
const SHADOW_OPACITY = 0.06;           // Per-layer opacity
const SHADOW_LAYERS: [number, number][] = [
  [6, 6],  // Furthest layer
  [4, 4],
  [2, 2],  // Closest layer
];
const SHADOW_PADDING = 8;              // Extra SVG extent (max offset + margin)
const DEFAULT_RADIUS = 8;              // Matches Tailwind rounded-lg
```

**Tuning:** Increase `SHADOW_OPACITY` or add more layers for a stronger shadow. Adjust `SHADOW_LAYERS` offsets for different falloff.

### 3.2 Mask Logic

SVG masks use luminance: **white = visible**, **black = hidden**.

1. Full rect `(0, 0, svgW, svgH)` filled white → show shadow everywhere initially.
2. Inner rect `(0, 0, w, h)` with `rx`/`ry` for rounded corners, filled black → hide shadow in the glass area.

Result: Shadow appears only in the exterior band around the panel.

### 3.3 Layout Measurement

- `onLayout` on the glass content View captures `width` and `height`.
- Shadow SVG is sized to `(w + SHADOW_PADDING, h + SHADOW_PADDING)`.
- Shadow is not rendered until `layout` is non-null and dimensions are positive (avoids flash of incorrect size).

### 3.4 Props

| Prop          | Type    | Default | Description                                           |
|---------------|---------|---------|-------------------------------------------------------|
| `shadow`      | boolean | `false` | Enable SVG drop shadow (opt-in to avoid layout cost) |
| `borderRadius`| number  | `8`     | Corner radius for shadow; must match `rounded-*` className |

### 3.5 Usage

```tsx
// Without shadow (default) — single View, no wrapper
<GlassView className="flex-1 gap-4 rounded-[24px] p-4">
  {children}
</GlassView>

// With shadow — pass borderRadius to match rounded corners
<GlassView
  shadow
  borderRadius={24}
  className="flex-1 gap-4 rounded-[24px] p-4"
>
  {children}
</GlassView>
```

---

## 4. Known Issues & Unresolved Problems

### 4.1 Layout Breakage with Shadow Enabled

When `shadow={true}`, the wrapper structure caused layout issues in `RouteCard`:

- Outer GlassView did not hug the BlurView (no height except padding).
- Destination buttons did not render.

**Root cause:** The flex chain (BlurView → wrapper → inner View) may behave differently with certain parent containers (e.g., BlurView, aspect-ratio containers). The wrapper’s `flex: 1` did not reliably propagate in all cases.

**Workaround:** Keep `shadow={false}` as default. When re-enabling, test thoroughly in RouteCard and other nested layouts (BlurView, aspect ratios, carousels).

### 4.2 Mask ID Collision

The mask uses a fixed ID `"glass-shadow-mask"`. If multiple GlassViews with `shadow={true}` render on the same screen, SVG mask IDs could collide. **Fix:** Use a unique ID per instance (e.g., `useId()` or a counter).

### 4.3 Performance

- Each GlassView with shadow renders an extra SVG, Defs, Mask, G, and N Rect elements.
- `onLayout` triggers a state update and re-render when dimensions are known.
- For lists (e.g., many RouteCards), consider keeping shadow disabled or profiling.

---

## 5. Third-Party Library Findings

### 5.1 react-native-shadow-2

| Aspect   | Detail                                                                 |
|----------|------------------------------------------------------------------------|
| Weekly   | ~44K                                                                   |
| Expo     | Compatible (no native modules; uses `react-native-svg`)                |
| Approach | SVG gradient-based shadows                                             |
| Transparent | Works — uses SVG, not native shadow APIs                           |
| Note     | Maintainer recommends RN 0.76+ built-in shadows; those still fail for transparent views |

**Verdict:** Best third-party option for Expo + transparent views. Requires `react-native-svg` (already in project).

### 5.2 react-native-drop-shadow

| Aspect   | Detail                                                                 |
|----------|------------------------------------------------------------------------|
| Weekly   | ~21K                                                                   |
| Expo     | Native modules; likely requires dev build, not Expo Go                 |
| Approach | Bitmap rendering — captures view, blurs, tints                         |
| Transparent | Works — alpha mask for shadow cast                                 |
| Limits   | 2048×2048 Android bitmap; performance cost with many shadows          |

**Verdict:** Good for transparent views but adds native dependency and build complexity.

### 5.3 react-native-fast-shadow

| Aspect   | Detail                                                                 |
|----------|------------------------------------------------------------------------|
| Transparent | **Does not work** — known issue; shadow shows through transparent content |
| Best for | Opaque rounded rectangles on Android                                  |

**Verdict:** Not suitable for glass/transparent panels.

### 5.4 React Native 0.76+ Built-in

- `boxShadow`: Still needs opaque background on iOS for reliable rendering.
- `dropShadow` (filter): Android-only; alpha-based, would work on Android but not cross-platform.

---

## 6. Recommendation

1. **Default:** Keep `shadow={false}`. Use the simple single-View GlassView for layout stability.
2. **Future:** If shadow is required:
   - Re-enable with `shadow={true}` and debug layout in BlurView/carousel contexts.
   - Or integrate `react-native-shadow-2` as a drop-in wrapper for a more battle-tested approach.
3. **Custom implementation:** The spec above documents the full technique; it can be reverted to and refined (e.g., unique mask IDs, layout debugging) when needed.

---

## 7. Reference Implementation (Code Snapshot)

The implementation lives in `src/components/GlassView.tsx`. Key elements:

- Early return when `!shadow` for the original single-View structure.
- `Defs` + `Mask` with white full rect and black inner rect.
- `G` with `mask` prop wrapping the layered `Rect` shadow elements.
- Wrapper with `flex: 1`; inner View with `flex: 1`, `minHeight: 0`.
- `onLayout` for dynamic sizing of the shadow SVG.
