# RoutesCarousel Refactoring - Phase 2 Complete

## Summary

Phase 2 created the adapter layer that bridges RoutesCarousel's domain-specific API to AnimatedList's generic implementation. The adapter handles all domain concerns while keeping AnimatedList completely clean.

## Changes Made

### New File: `src/features/RoutesCarousel/RoutesCarouselAdapter.tsx`

Created a thin adapter component that:

1. **Accepts RoutesCarousel props** - Same API as original RoutesCarousel
2. **Transforms data** - Prepends invisible placeholder to terminal cards
3. **Converts layout** - Maps `CarouselLayout` to `AnimatedListLayout`
4. **Handles rendering** - Distinguishes between placeholder and RouteCard items
5. **Bridges APIs** - Connects RoutesCarousel to AnimatedList
6. **Uses animation** - Passes `routesCarouselAnimation` as `itemAnimationStyle`

### Updated: `src/features/RoutesCarousel/index.ts`

Added export for `RoutesCarouselAdapter` so it can be imported by consumers.

## Architecture

### Before Phase 2
```
RoutesCarousel (ScrollView + custom logic)
  └─ RoutesCarouselItem (animation worklet)
      └─ RouteCard (content)
```

### After Phase 2
```
RoutesCarouselAdapter (thin wrapper)
  ├─ AnimatedList (generic, reusable)
  │   └─ routesCarouselAnimation (domain worklet)
  └─ RouteCard (content)
```

## Key Design Decisions

### 1. Placeholder as Data, Not Prop
The invisible placeholder is managed as data:

```typescript
type CarouselItem =
  | { isPlaceholder: true; width: number; height: number }
  | { isPlaceholder: false; data: TerminalCardData };
```

**Why this approach:**
- No special handling in AnimatedList
- Clean separation of concerns
- Placeholder rendered via `renderItem` callback
- Easy to maintain and test

**Implementation:**
```typescript
const carouselData: CarouselItem[] = [
  { isPlaceholder: true, width: slotWidth, height: slotHeight },
  ...terminalCards.map((card): CarouselItem => ({ isPlaceholder: false, data: card })),
];
```

### 2. Layout Conversion
Simple transformation from domain layout to generic layout:

```typescript
const animatedListLayout = {
  direction: "horizontal" as const,
  itemSize: slotWidth,
  spacing,
};
```

**Why this works:**
- `CarouselLayout` has domain-specific fields (slotHeight, snapInterval, sidePadding, contentPadding)
- `AnimatedListLayout` only needs direction, itemSize, and spacing
- Adapter discards unused fields (sidePadding, contentPadding go to parent)

### 3. Rendering Logic in renderItem
The adapter handles rendering domain-specific content:

```typescript
const renderItem = (item: CarouselItem): React.ReactNode => {
  if (item.isPlaceholder) {
    // Invisible placeholder for alignment
    return <View style={{ opacity: 0, pointerEvents: "none" }} />;
  }
  // Actual RouteCard with blur target
  return <RouteCard blurTargetRef={blurTargetRef} {...item.data} />;
};
```

**Benefits:**
- AnimatedList doesn't know about RouteCard
- Animation applied by AnimatedList via `itemAnimationStyle`
- Placeholder rendered transparently
- BlurTargetRef passed through only to RouteCard

### 4. Key Extraction
Stable keys for React rendering:

```typescript
const keyExtractor = (item: CarouselItem): string => {
  return item.isPlaceholder ? "__placeholder__" : item.data.terminalSlug;
};
```

**Why:**
- Placeholder uses fixed key (always same element)
- Cards use unique terminalSlug from data
- Prevents unnecessary re-renders

## What Was NOT Changed

- ❌ AnimatedList remains untouched
- ❌ No new props or special cases added to AnimatedList
- ❌ RoutesCarousel original implementation unchanged
- ❌ RoutesCarouselSection unchanged
- ❌ RoutesCarouselItem unchanged (will be deleted in Phase 3)

## Comparison: Original vs Adapter

### Original RoutesCarousel.tsx

**Lines involved:** 102-148

```typescript
return (
  <View className="relative flex-1 items-center justify-center">
    <Animated.ScrollView
      ref={animatedRef}
      horizontal
      contentContainerStyle={{ gap: spacing, paddingHorizontal: sidePadding, ... }}
      scrollEventThrottle={16}
      snapToInterval={snapInterval}
      ...
    >
      <View key="__placeholder__" style={{ opacity: 0, ... }} />
      {terminalCards.map((item, index) => (
        <RoutesCarouselItem index={index + 1} scrollX={scrollXNormalized} ... >
          <RouteCard ... />
        </RoutesCarouselItem>
      ))}
    </Animated.ScrollView>
  </View>
);
```

**Key characteristics:**
- Direct ScrollView management
- Manual snap intervals
- Custom RoutesCarouselItem wrapper for animations
- Index offset (index + 1) for placeholder
- Internal scroll normalization

### New RoutesCarouselAdapter.tsx

**Lines involved:** 129-141

```typescript
return (
  <View className="relative flex-1 items-center justify-center">
    <AnimatedList
      ref={ref}
      data={carouselData}
      renderItem={renderItem}
      layout={animatedListLayout}
      itemAnimationStyle={routesCarouselAnimation}
      scrollOffset={scrollX}
      keyExtractor={keyExtractor}
    />
  </View>
);
```

**Key characteristics:**
- Delegates to AnimatedList
- No scroll management
- No animation wrapping (handled by itemAnimationStyle)
- No index offset (placeholder in data array)
- External scroll offset passed through

## Migration Benefits

### 1. Reduced Complexity
- **Before:** ~150 lines of custom scroll logic
- **After:** ~145 lines, but most is simple data transformation
- **Result:** Cleaner separation of concerns

### 2. Reusable Animation
- Animation extracted as `routesCarouselAnimation`
- Can be reused in other contexts
- Follows `ItemAnimationStyle` interface

### 3. Testable Components
- Adapter can be tested independently
- AnimatedList already tested via demo
- RouteCard already exists and tested

### 4. Maintainability
- Domain logic isolated to adapter
- Animation logic isolated to worklet
- Generic logic in AnimatedList

## TypeScript Benefits

### Discriminated Union Types

```typescript
type CarouselItem =
  | { isPlaceholder: true; width: number; height: number }
  | { isPlaceholder: false; data: TerminalCardData };
```

**Benefits:**
- Type narrowing when checking `item.isPlaceholder`
- Compile-time guarantees about data availability
- No runtime errors from accessing wrong properties

**Example usage:**
```typescript
if (item.isPlaceholder) {
  // TypeScript knows item has width and height
  return <View style={{ width: item.width, height: item.height }} />;
}
// TypeScript knows item.data exists here
return <RouteCard {...item.data} />;
```

### Explicit Type Annotations

```typescript
...terminalCards.map(
  (card): CarouselItem => ({ isPlaceholder: false, data: card })
)
```

**Why explicit return type:**
- Ensures TypeScript validates the mapped object
- Catches type mismatches at compile time
- Self-documenting code

## Testing Verification

- ✅ No linter errors
- ✅ TypeScript type checking passes
- ✅ Discriminated union types properly typed
- ✅ Key extractor signature matches AnimatedList expectations
- ✅ Animation worklet properly integrated

## Next Steps (Phase 3)

Phase 3 will complete the refactoring by:

1. **Replace RoutesCarousel implementation** with RoutesCarouselAdapter
2. **Update RoutesCarouselSection** to work with new implementation
3. **Delete RoutesCarouselItem.tsx** (functionality moved to adapter + worklet)
4. **Optionally:** Update useCarouselLayout or keep for backward compatibility

**Goal:** RoutesCarousel now uses AnimatedList under the hood, with identical external behavior.

## Code References

### Adapter Structure
```1:145:src/features/RoutesCarousel/RoutesCarouselAdapter.tsx
/**
 * RoutesCarouselAdapter – Adapts RoutesCarousel API to AnimatedList.
 * Handles data transformation, layout conversion, and rendering logic
 * for domain-specific RoutesCarousel on top of generic AnimatedList.
 */
...

type CarouselItem =
  | { isPlaceholder: true; width: number; height: number }
  | { isPlaceholder: false; data: TerminalCardData };

const RoutesCarouselAdapter = ({ ref, blurTargetRef, scrollX, layout, terminalCards }) => {
  // Transform layout
  const animatedListLayout = { direction: "horizontal", itemSize: slotWidth, spacing };

  // Transform data (prepend placeholder)
  const carouselData: CarouselItem[] = [
    { isPlaceholder: true, width: slotWidth, height: slotHeight },
    ...terminalCards.map((card): CarouselItem => ({ isPlaceholder: false, data: card })),
  ];

  // Render items (placeholder vs RouteCard)
  const renderItem = (item: CarouselItem): React.ReactNode => {
    if (item.isPlaceholder) {
      return <View style={{ opacity: 0, pointerEvents: "none" }} />;
    }
    return <RouteCard blurTargetRef={blurTargetRef} {...item.data} />;
  };

  return (
    <AnimatedList
      ref={ref}
      data={carouselData}
      renderItem={renderItem}
      layout={animatedListLayout}
      itemAnimationStyle={routesCarouselAnimation}
      scrollOffset={scrollX}
      keyExtractor={keyExtractor}
    />
  );
};
```

### Usage in Phase 3

When we replace RoutesCarousel.tsx, we'll simply change the implementation:

```typescript
// Old
import RoutesCarousel from "./RoutesCarousel";

// New
import RoutesCarousel from "./RoutesCarouselAdapter";

// No other changes needed - same props, same API
```

This makes Phase 3 a straightforward implementation swap with minimal risk.
