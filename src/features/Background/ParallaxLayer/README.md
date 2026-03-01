# Parallax Layer Implementation

## Overview

This document explains the parallax implementation used in the FerryJoy app's homepage. The parallax effect creates depth by having background layers move at different speeds as the user scrolls through the route carousel.

### Key Components

- **ParallaxProvider** - Provides scroll progress via React Context
- **ParallaxLayer** - Applies scroll-driven translation to background layers
- **useBackgroundLayout** - Calculates parallax distance and layer container width
- **AnimatedList** (RoutesCarousel) - Generates scroll progress values

### Visual Result

The parallax effect creates a multi-layered scene with:
- **Sky** (slowest movement) - Pink gradient with sunburst
- **Background Grass** (slow-medium) - Behind ocean
- **Ocean Waves** (medium) - Animated water with 8 layers
- **Foreground Grass** (fastest) - Closest to viewer

## Architecture Diagram

```
┌────────────────────────────────────────────────────────-────────┐
│                         index.tsx                               │
│  ┌───────────────────────────────────────────────────-───────┐  │
│  │ ParallaxProvider (scrollProgress: SharedValue)            │  │
│  │                                                           │  │
│  │  ┌─────────────-─┐         ┌──────────────────────────┐   │  │
│  │  │  Background   │         │   RoutesCarousel         │   │  │
│  │  │               │         │                          │   │  │
│  │  │  ┌────────┐   │         │  ┌────────────────────┐  │   │  │
│  │  │  │  Sky   │   │◄──────-─┤  │ v AnimatedList     │  │   │  │
│  │  │  │        │   │         │  │                    │  │   │  │
│  │  │  │        │   │         │  │ scrollProgressSink │──┼─-─┼──┘
│  │  │  │        │   │         │  │       (write)      │  │   │
│  │  │  └────────┘   │         │  └────────────────────┘  │   │
│  │  │               │         │                          │   │
│  │  │ ┌─────────-─┐ │         └──────────────────────────┘   │
│  │  │ │ Animated  │ │                                        │
│  │  │ │  Waves    │ │                                        │
│  │  │ │           │ │                                        │
│  │  │ │• BG Grass │ │                                        │
│  │  │ │• Ocean    │ │                                        │
│  │  │ │• FG Grass │ │                                        │
│  │  │ └─────────-─┘ │                                        │
│  │  └────────-──────┘                                        │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

Scroll Flow:
1. User scrolls AnimatedList (horizontal carousel)
2. scrollProgress calculated: 0 (first item) → 1 (last item)
3. AnimatedList writes to scrollProgressSink SharedValue
4. ParallaxProvider makes scrollProgress available via Context
5. Each ParallaxLayer reads scrollProgress and applies translateX
```

## Data Flow

```
User Scrolls Carousel
        │
        ▼
┌───────────────────────┐
│ AnimatedList          │
│ - Captures scrollX    │
│ - Calculates scroll   │
│   progress (0-1)      │
│ - Writes to sink      │
└──────────┬────────────┘
           │ scrollProgressSink.value = progress
           ▼
┌───────────────────────┐
│ scrollProgress        │
│ SharedValue (0-1)     │
│ (in index.tsx)        │
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│ ParallaxProvider      │
│ Context value         │
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│ ParallaxLayer         │
│ useAnimatedStyle(     │
│   translateX =        │
│   -progress × width   │
│ )                     │
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│ Background Layers     │
│ (Sky, Waves)          │
│ Move at different     │
│ speeds                │
└───────────────────────┘
```

## Component Breakdown

### 1. ParallaxProvider & ParallaxContext

**Location:** `ParallaxLayer/ParallaxContext.tsx`

Provides scroll progress to all parallax consumers without prop drilling.

```typescript
// Context holds the scroll progress SharedValue
ParallaxContext: SharedValue<number> | null

// Provider wraps the entire component tree
<ParallaxProvider scrollProgress={scrollProgress}>
  <Background />      // Consumes via useParallaxContext()
  <RoutesCarousel />  // Writes to scrollProgressSink
</ParallaxProvider>
```

**Why Context?** Avoids passing scrollProgress through multiple component layers.

### 2. ParallaxLayer

**Location:** `ParallaxLayer/ParallaxLayer.tsx`

A reusable wrapper that applies parallax translation to any content.

```typescript
<ParallaxLayer parallaxDistance={pixels}>
  {/* Content moves left as scroll progresses */}
  <YourContent />
</ParallaxLayer>
```

**How it works:**
- Reads `scrollProgress` from ParallaxProvider context
- Uses `useAnimatedStyle` to compute `translateX = -scrollProgress × parallaxDistance`
- Higher `parallaxDistance` = faster movement = closer depth

**Example:**
- Sky: `parallaxDistance = 8%` (far away, moves slowly)
- FG Grass: `parallaxDistance = 100%` (close, moves quickly)

### 3. useBackgroundLayout Hook

**Location:** `useBackgroundLayout.ts`

Calculates dimensions for parallax layers to prevent empty space at edges.

**Coordinate system:**
```
- Layer starts at x=0 (left-aligned to viewport)
- As scrollProgress goes 0→1, layer translates LEFT
- translateX = -scrollProgress × parallaxDistance
- Layer must extend right to cover: screenWidth + parallaxDistance
```

**Key calculations:**

```typescript
// 1. Base parallax pixels (orientation-aware)
maxParallaxPx = 100 (portrait) or 200 (landscape)

// 2. Parallax distance for a layer
parallaxDistance = (numCards - 1) × (multiplier / 100) × maxParallaxPx

// 3. Required layer container width (must extend past viewport)
layerContainerWidth = screenWidth + parallaxDistance
```

**Why needed?** As the layer translates left, the right edge must extend past the viewport to avoid showing white space.

### 4. AnimatedList (RoutesCarousel)

**Location:** `AnimatedList/AnimatedList.tsx`

Generates scroll progress from user's carousel interactions.

**Scroll progress calculation:**

```typescript
// From pixel scroll to normalized index
scrollIndex = scrollX / itemStride

// Normalized to 0-1 range
scrollProgress = Math.min(1, Math.max(0, scrollIndex / (data.length - 1)))

// Written to sink for parallax to read
scrollProgressSink.value = scrollProgress
```

**Key features:**
- `useDerivedValue` for efficient calculation
- `useAnimatedReaction` to write to sink (avoids ref timing issues)
- `scrollEventThrottle={16}` (60 FPS updates)

### 5. Background Layers

#### Sky

**Location:** `Background/Sky/Sky.tsx`

```typescript
<Sky parallaxMultiplier={SKY_PARALLAX_MULTIPLIER}>  // 8%
  {/* Linear gradient + sunburst */}
</Sky>
```

- Uses `useBackgroundLayout` to calculate dimensions
- Wrapped in `ParallaxLayer` with `parallaxDistance`
- Slowest layer (appears farthest away)

#### AnimatedWaves

**Location:** `Background/Waves/AnimatedWaves.tsx`

Three layer groups with interpolated parallax multipliers:

```typescript
BACKGROUND_GRASS:  10-30%  // Behind ocean
OCEAN:            20-60%  // 8 wave layers
FOREGROUND_GRASS: 80-100% // Closest to viewer
```

**Precomputed specs:**

```typescript
type WaveRenderSpec = {
  key: string;
  zIndex: number;
  parallaxMultiplier: number;
  waveProps: WaveLayerViewProps;
};

// Created at module load time (performance)
const LAYER_SPECS = [
  ...BACKGROUND_SPECS,
  ...OCEAN_SPECS,
  ...FOREGROUND_SPECS,
];
```

Each spec is wrapped in a `ParallaxLayer` with its own `parallaxDistance`.

## Parallax Math Explained

### The Core Formula

```
translateX = -scrollProgress × parallaxDistance
```

**Coordinate system:**
```
- Layer starts at x=0 (left-aligned to viewport)
- As scrollProgress goes 0→1, layer translates LEFT
- translateX = -scrollProgress × parallaxDistance
- Layer must extend right to cover: screenWidth + parallaxDistance
```

Where:
- `scrollProgress`: 0 (first card) → 1 (last card)
- `parallaxDistance`: How far layer moves when progress = 1
- Negative sign: Layer moves LEFT as user scrolls RIGHT

### Calculating Parallax Distance

```typescript
parallaxDistance = (numCards - 1) × (multiplier / 100) × maxParallaxPx
```

**Example with 5 cards, landscape mode:**

| Layer | Multiplier | Calculation | Parallax Distance |
|-------|------------|-------------|-------------------|
| Sky | 8% | 4 × 0.08 × 200 | 64px |
| Ocean (avg) | 40% | 4 × 0.40 × 200 | 320px |
| FG Grass | 100% | 4 × 1.00 × 200 | 800px |

### Required Layer Container Width

```typescript
layerContainerWidth = screenWidth + parallaxDistance
```

At `scrollProgress = 1`, the layer has translated left by `parallaxDistance`. The right edge must still be at the viewport right edge, so:

```
initialRightEdge = screenWidth
finalRightEdge = screenWidth - parallaxDistance
layerContainerWidth = screenWidth + parallaxDistance
finalRightEdge = (screenWidth + parallaxDistance) - parallaxDistance = screenWidth ✓
```

## Comparison with Other Implementations

### Common Patterns in React Native Parallax

Based on research of popular implementations:

#### 1. **react-native-reanimated-carousel** Approach

```typescript
// Uses interpolate for item-based parallax
const parallaxLayout = (value: number) => {
  const translate = interpolate(
    value,
    [-1, 0, 1],
    [-size + offset, 0, size - offset]
  );
  const scale = interpolate(
    value,
    [-1, 0, 1],
    [adjacentScale, scrollingScale, adjacentScale]
  );
  return { transform: [{ translateX: translate }, { scale }] };
};
```

**Key difference:** Their approach is **item-centric** (each carousel item parallaxes), ours is **background-centric** (entire background layers move).

#### 2. **Simple ScrollView Parallax**

```typescript
// Uses scroll position directly
const scrollY = useSharedValue(0);
const parallaxStyle = useAnimatedStyle(() => ({
  transform: [{ translateY: -scrollY.value * 0.5 }],
}));
```

**Key difference:** They use raw scroll position, we normalize to 0-1 progress.

#### 3. **React Native Parallax ScrollView** (Library)

```typescript
// Uses onScroll listener with sticky headers
<ParallaxScrollView
  parallaxHeaderHeight={300}
  stickyHeaderHeight={80}
  renderParallaxHeader={() => <Image />}
/>
```

**Key difference:** They handle header parallax specifically, we have custom multi-layer system.

### Our Architecture's Strengths

1. **Decoupled scroll source:** `AnimatedList` doesn't know about parallax; just writes to sink
2. **Reusable layers:** `ParallaxLayer` can wrap any component
3. **Orientation-aware:** Automatically adjusts for landscape (doubled movement)
4. **Deterministic math:** All calculations are explicit and predictable
5. **Precomputed specs:** Wave layers are pre-configured at module load time

### Complexity Points

1. **Multiple abstraction layers:** Context → Provider → Hook → Layer
2. **Width calculations:** Parallax width vs required width can be confusing
3. **Coordinate system:** Negative translation, left-aligned positioning
4. **Multiple SharedValues:** scrollProgressSink, scrollProgress (internal), scrollX (AnimatedList)
5. **Precomputation vs runtime:** Some specs computed at module load (waves), some at render (sky)

## Simplification Opportunities

### Option 1: Flatten the Abstraction Stack

**Current:**
```
index.tsx → ParallaxProvider → ParallaxContext → ParallaxLayer
```

**Simplified:**
```typescript
// Pass scrollProgress directly to Background
<Background scrollProgress={scrollProgress}>

// Background passes to layers internally
<Sky scrollProgress={scrollProgress} />
```

**Tradeoff:** More prop passing, less magic.

### Option 2: Simplify useBackgroundLayout Return

**Current:** `useBackgroundLayout` returns 4 values (now simplified to 2 + functions)

**Simplified (already implemented):**
```typescript
// For single layer (e.g., Sky)
const { parallaxDistance, layerContainerWidth } = useBackgroundLayout({
  parallaxMultiplier: SKY_PARALLAX_MULTIPLIER,
});

// For multiple layers (e.g., Waves)
const { computeParallaxDistance, computeLayerContainerWidth } = useBackgroundLayout({
  parallaxMultiplier: PARALLAX_WAVES_MAX,
});
const skyConfig = {
  distance: computeParallaxDistance(8),
  width: computeLayerContainerWidth(8),
};
```

**Tradeoff:** Already implemented! Simpler API, still flexible.

### Option 3: Use Raw Scroll Position

**Current:** Normalized progress (0-1) → converted to pixels

**Simplified:**
```typescript
// Direct pixel-based parallax
<ParallaxLayer scrollX={scrollX} pixelsMultiplier={0.08}>
```

**Tradeoff:** Breaks abstraction, couples to carousel dimensions.

### Option 4: Precompute All Widths

**Current:** Wave specs precomputed, sky computes at render

**Simplified:**
```typescript
// Precompute all specs at module load
const SKY_SPEC = {
  parallaxWidth: computedOnce,
  requiredWidth: computedOnce,
};
```

**Tradeoff:** Breaks on orientation change (need to recompute).

## Recommended Improvements

Based on analysis, here are the most impactful improvements:

### 1. Clarify Width Terminology (High Impact, Low Effort)

Rename to avoid confusion:

```typescript
// Current (confusing)
parallaxWidth  // Actually: total movement distance
requiredWidth  // Actually: layer container width

// Suggested (clearer)
parallaxDistance    // How far layer moves (total)
layerContainerWidth // Width of layer container
```

### 2. Document the Coordinate System (High Impact, Low Effort)

Add visual comments in code:

```typescript
// Coordinate system:
// - Layer starts at x=0 (left-aligned to viewport)
// - As scrollProgress goes 0→1, layer translates LEFT
// - translateX = -scrollProgress × parallaxDistance
// - Layer must extend right to cover: screenWidth + parallaxDistance
```

### 3. Simplify useBackgroundLayout Return (Medium Impact, Medium Effort)

Currently returns 4 values. Could be:

```typescript
// Option A: Single config object
const config = useBackgroundLayout({ multiplier });
const { parallaxDistance, layerContainerWidth } = config;

// Option B: Hook for each layer directly
const skyConfig = useParallaxLayer(SKY_PARALLAX_MULTIPLIER);
// Returns: { parallaxDistance, layerContainerWidth }
```

### 4. Consider React Native Reanimated Carousel (If Rebuilding)

If starting from scratch, consider:

```typescript
<Carousel
  customAnimation={parallaxLayout}
  renderItem={...}
/>
```

**But:** Our current approach works well and is more flexible for custom backgrounds.

## Performance Considerations

### Current Optimizations

1. **UI thread animations:** All transforms use `useAnimatedStyle` (worklets)
2. **Precomputed specs:** Wave layer specs calculated once at module load
3. **Throttled scroll:** `scrollEventThrottle={16}` (60 FPS max)
4. **Derived values:** `useDerivedValue` for efficient calculation

### Performance Metrics

- **60 FPS target:** Scroll updates throttled to 16ms
- **SharedValue updates:** Minimal overhead (Reanimated optimized)
- **Re-renders:** Background layers don't re-render (only transform updates)

### Potential Issues

1. **Many layers:** ~15 wave layers could be heavy on low-end devices
2. **Overscan:** `railWidthPx` includes extra margin (may use extra memory)
3. **Context overhead:** Reading from Context on every frame

### Optimization Opportunities

1. **Reduce wave count:** Currently 8 ocean layers, could test with 4-6
2. **Memoize specs:** Some specs could be computed once per orientation
3. **Avoid Context:** Pass scrollProgress prop directly (eliminates Context lookup)

## Testing the Parallax Effect

### Manual Testing Checklist

- [ ] Scroll from first to last card smoothly
- [ ] No white space appears at layer edges
- [ ] Sky moves slower than waves
- [ ] FG grass moves faster than BG grass
- [ ] Ocean waves animate smoothly (oscillation)
- [ ] Rotate device: parallax doubles in landscape
- [ ] Fast scroll: layers stay synchronized
- [ ] Snap to card: parallax settles correctly

### Debug Mode

Add to `ParallaxContext.tsx`:

```typescript
if (__DEV__) {
  useAnimatedReaction(
    () => scrollProgress.value,
    (progress) => {
      console.log(`Parallax progress: ${progress.toFixed(2)}`);
    }
  );
}
```

## Summary

Our parallax implementation is **sophisticated and working well**, with recent improvements reducing complexity:

**Strengths:**
- Clean separation of concerns
- Reusable components
- Proper math for preventing edge artifacts
- Orientation-aware
- Performant (UI thread)
- Clear coordinate system documentation
- Descriptive variable names

**Improvements Completed:**
- ✅ Renamed confusing width variables (parallaxWidth → parallaxDistance, requiredWidth → layerContainerWidth)
- ✅ Documented coordinate system in all key files
- ✅ Simplified `useBackgroundLayout` API (removed unnecessary return values, added clearer computation functions)
- ✅ Simplified `ParallaxLayer` (removed optional scrollProgress prop, always uses context)

The architecture is **sound and maintainable**. The complexity exists because we're solving a hard problem (multi-layer parallax with varying depths), not because of poor design.
