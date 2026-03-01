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

Calculates dimensions for a single parallax background layer. Use this hook for components with one layer. For multiple layers, use the pure functions directly.

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
const numScrollableIntervals = scrollableRange / itemStride;
parallaxDistance = numScrollableIntervals × (multiplier / 100) × maxParallaxPx

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
parallaxDistance = (scrollableRange / itemStride) × (multiplier / 100) × maxParallaxPx
```

The carousel exposes `scrollableRange` (total pixels it can scroll) and `itemStride` (one scroll step in pixels). The parallax system uses these values without needing to know how many cards are in the carousel.

**Example with scrollableRange of 800px and itemStride of 200px (4 scroll intervals), landscape mode:**

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
- ✅ Simplified `useBackgroundLayout` API for single-layer components
- ✅ Removed factory functions for multi-layer components; use pure functions directly
- ✅ Simplified `ParallaxLayer` (removed optional scrollProgress prop, always uses context)
- ✅ Decoupled parallax system from carousel card count - carousel now exposes `scrollableRange` and `itemStride` via ref

**Architecture Benefits:**
- Parallax system no longer knows about card count or carousel data structure
- Clear separation: Carousel describes its scrollable dimensions, parallax adjusts accordingly
- More testable - parallax functions work with any scrollable range
- Type-safe contract via AnimatedListRef interface

The architecture is **sound and maintainable**. The complexity exists because we're solving a hard problem (multi-layer parallax with varying depths), not because of poor design.

## Decoupling from Carousel Card Count

The parallax system is now **decoupled from carousel card count**. Previously, the parallax calculations required `TOTAL_CAROUSEL_ITEMS`, creating tight coupling between the parallax system and carousel data structure.

### How It Works Now

**Carousel (AnimatedList) exposes scroll dimensions:**
- `scrollableRange`: Total pixels the carousel can scroll = `(data.length - 1) × (itemSize + spacing)`
- `itemStride`: One scroll step in pixels = `itemSize + spacing`

**Parallax system uses these dimensions:**
- `computeParallaxDistance(scrollableRange, parallaxMultiplier, itemStride, maxParallaxPx)`
- `computeLayerContainerWidth(screenWidth, scrollableRange, parallaxMultiplier, itemStride, maxParallaxPx)`

### Data Flow

```
index.tsx
  │
  ├─> RoutesCarousel (carouselRef)
  │     └─> AnimatedList
  │           └─> Exposes: scrollableRange, itemStride via ref
  │
  └─> Background (receives: scrollableRange, itemStride)
        ├─> Sky
        └─> AnimatedWaves
              └─> computeParallaxDistance(scrollableRange, ...)
```

### Benefits

- **Separation of concerns**: Carousel describes its dimensions, parallax adjusts without knowing about cards
- **Testability**: Parallax functions work with any scrollable range, not tied to card count
- **Maintainability**: Adding/removing cards doesn't require parallax system changes
- **Type safety**: Clear contract via `AnimatedListRef` interface
