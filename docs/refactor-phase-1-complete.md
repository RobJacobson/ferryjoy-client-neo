# RoutesCarousel Refactoring - Phase 1 Complete

## Summary

Phase 1 focused on extracting the RoutesCarousel animation logic into a reusable worklet that can be used with AnimatedList. No changes were made to AnimatedList itself - it remains clean and generic.

## Changes Made

### New File: `src/features/RoutesCarousel/routesCarouselAnimation.ts`

Created a standalone animation worklet function that:

1. **Extracts animation logic from `RoutesCarouselItem`** (lines 54-97)
2. **Implements the `ItemAnimationStyle` interface** from AnimatedList
3. **Provides the same visual effects:**
   - Opacity: 7-point interpolation (fades in/out from center)
   - Scale: 3-point interpolation (shrinks away from center)
   - Rotate: 3-point interpolation (tilts ±45deg)
   - Z-index: 3-point interpolation (elevates center item)

4. **Follows worklet requirements:**
   - `"worklet";` directive as first statement
   - Runs on UI thread for 60fps performance
   - Uses `SharedValue` for reactive scroll tracking

### Updated: `src/features/RoutesCarousel/index.ts`

Added export for `routesCarouselAnimation` so it can be imported by consumers.

## What Was NOT Changed

- ❌ AnimatedList remains untouched - no new props, no special cases
- ❌ No viewport-based layout logic added
- ❌ No contentPadding prop
- ❌ No placeholderItem prop
- ❌ No domain-specific coupling to AnimatedList

## Key Design Decisions

### 1. Layout Independence
The original `useCarouselLayout` used `useWindowDimensions()` and `useSafeAreaInsets()` to calculate card sizes from the full viewport. This is being replaced by:

- **`useAnimatedListLayout`** already uses `LayoutChangeEvent` and `scrollViewSize` state
- **Generic dimension tracking** - no assumptions about full-window layout
- **Parent handles padding** - any visual spacing goes in parent container, not in AnimatedList

This keeps AnimatedList agnostic about its size and surrounding layout concerns.

### 2. Placeholder as Data, Not Component Feature
The invisible placeholder item is a data concern, not a component feature:

- **No `placeholderItem` prop** added to AnimatedList
- **Domain-specific solution** - RoutesCarousel will prepend a placeholder object to its data array
- **Render function handles it** - `renderItem` will check for placeholder and render invisible View

This keeps AnimatedList simple and prevents special cases.

### 3. Animation as Domain Logic
The RoutesCarousel animation is specific to this use case:

- **Stays in `src/features/RoutesCarousel/`** - domain-specific feature
- **Exported for reuse** - can be used by any component wanting this exact animation
- **Worklet format** - compatible with AnimatedList's `itemAnimationStyle` prop

This is the right abstraction level: animation logic is reusable, but belongs to the domain that needs it.

## Testing

- ✅ No linter errors
- ✅ TypeScript type checking passes
- ✅ Animation worklet is properly formatted with `"worklet";` directive
- ✅ Export added to index file for easy importing

## Next Steps (Phase 2)

Phase 2 will create the adapter layer that:

1. **Transforms data** - prepends placeholder to terminal cards array
2. **Converts layout** - maps `CarouselLayout` to `AnimatedListLayout`
3. **Creates renderItem** - handles placeholder vs RouteCard rendering
4. **Bridges APIs** - connects RoutesCarousel props to AnimatedList props
5. **Uses the animation** - passes `routesCarouselAnimation` as `itemAnimationStyle`

The adapter will be a thin component in `src/features/RoutesCarousel/RoutesCarouselAdapter.tsx`.

## Migration Path

Current state:
```
RoutesCarousel (ScrollView + custom logic)
  └─ RoutesCarouselItem (animation worklet)
```

After Phase 2:
```
RoutesCarouselAdapter (thin wrapper)
  └─ AnimatedList (generic, reusable)
      └─ routesCarouselAnimation (domain worklet)
```

After Phase 3:
```
RoutesCarousel (now uses adapter internally)
  └─ RoutesCarouselAdapter
      └─ AnimatedList
```

## Code References

### Original Animation (RoutesCarouselItem.tsx)
```54:97:src/features/RoutesCarousel/RoutesCarouselItem.tsx
const zIndexStyle = useAnimatedStyle(() => ({
  zIndex: Math.round(
    interpolate(
      scrollX.value,
      [index - 2, index, index + 2],
      [0, 10, 0],
      Extrapolation.CLAMP
    )
  ),
}));
const animatedStyle = useAnimatedStyle(() => ({
  opacity: interpolate(
    scrollX.value,
    [index - 2, index - 1, index - 0.5, index, index + 0.5, index + 1, index + 2],
    [0, 0.1, 0.8, 1, 0.8, 0.1, 0],
    Extrapolation.CLAMP
  ),
  transform: [
    {
      scale: interpolate(
        scrollX.value,
        [index - 1, index, index + 1],
        [0.75, 1, 0.75],
        Extrapolation.CLAMP
      ),
    },
    {
      rotate: `${interpolate(
        scrollX.value,
        [index - 1, index, index + 1],
        [45, 0, -45],
        Extrapolation.CLAMP
      )}deg`,
    },
  ],
}));
```

### Extracted Animation (routesCarouselAnimation.ts)
```18:78:src/features/RoutesCarousel/routesCarouselAnimation.ts
export const routesCarouselAnimation = (
  scrollIndex: SharedValue<number>,
  index: number,
  _layout: AnimatedListLayout
): AnimatedStyleResult => {
  "worklet";

  const zIndex = Math.round(
    interpolate(
      scrollIndex.value,
      [index - 2, index, index + 2],
      [0, 10, 0],
      Extrapolation.CLAMP
    )
  );

  const opacity = interpolate(
    scrollIndex.value,
    [index - 2, index - 1, index - 0.5, index, index + 0.5, index + 1, index + 2],
    [0, 0.1, 0.8, 1, 0.8, 0.1, 0],
    Extrapolation.CLAMP
  );

  const scale = interpolate(
    scrollIndex.value,
    [index - 1, index, index + 1],
    [0.75, 1, 0.75],
    Extrapolation.CLAMP
  );

  const rotate = interpolate(
    scrollIndex.value,
    [index - 1, index, index + 1],
    [45, 0, -45],
    Extrapolation.CLAMP
  );

  return {
    opacity,
    transform: [{ scale }, { rotate: `${rotate}deg` }],
    zIndex,
  };
};
```

Note: The animation logic is identical, but now in the `ItemAnimationStyle` worklet format expected by AnimatedList. The `_layout` parameter is unused (prefixed with underscore) but required for API compatibility.
