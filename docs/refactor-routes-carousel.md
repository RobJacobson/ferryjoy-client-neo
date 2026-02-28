You're absolutely right on all three points. Let me reconsider Phase 1 with your feedback:

## Re-evaluating Your Points

### 1. ContentPadding
**You're correct** - this is just layout that belongs in the parent, not in AnimatedList. Looking at the code:

```14:16:src/features/RoutesCarousel/useCarouselLayout.ts
const BASE_PADDING = 24;
```

And it's used for:
```50:56:src/features/RoutesCarousel/useCarouselLayout.ts
contentPadding: {
  paddingTop: BASE_PADDING + insets.top,
  paddingBottom: BASE_PADDING + insets.bottom,
},
```

This is purely visual spacing to prevent cards from covering status bar/home indicator. The parent component wrapping AnimatedList can handle this with simple padding/margin. **No special handling needed in AnimatedList.**

### 2. Placeholder Item
**You're correct** - the placeholder is just a data concern. It's:

```122:128:src/features/RoutesCarousel/RoutesCarousel.tsx
<View
  key="__placeholder__"
  style={[
    { width: slotWidth, height: slotHeight },
    { opacity: 0, pointerEvents: "none" } as ViewStyle,
  ]}
/>
```

It's invisible, non-interactive, and purely for visual alignment. The approach should be:
- Prepend a special placeholder object to the data array before passing to AnimatedList
- Handle rendering in the `renderItem` callback (render invisible View for placeholder items)
- No special knowledge needed in AnimatedList
- No performance concerns worth special-casing

### 3. Viewport-Based Layout
**You're correct** - I was overcomplicating this. `AnimatedList` already has everything needed:

- `useAnimatedListLayout` uses `onLayout` to capture ScrollView dimensions
- Calculates centering padding: `(scrollViewSize - itemSize) / 2`
- This is exactly what we need - no window dimensions, no viewport coupling

The `useCarouselLayout` hook uses `useWindowDimensions()` and `useSafeAreaInsets()` because it's calculating card sizes from the viewport. That's domain-specific logic that stays in RoutesCarousel.

## Revised Phase 1 Plan

**Goal:** Create the RoutesCarousel animation worklet that can be used with AnimatedList's existing `itemAnimationStyle` prop.

### Step 1: Extract RoutesCarousel Animation as Worklet

Create `useRoutesCarouselAnimation.ts` (or just export a function) that extracts the animation from `RoutesCarouselItem`:

```typescript
const routesCarouselAnimation: ItemAnimationStyle = (
  scrollIndex: SharedValue<number>,
  index: number,
  layout: AnimatedListLayout
): AnimatedStyleResult => {
  "worklet";
  
  // Extract the animation logic from RoutesCarouselItem lines 54-97
  // This is the same interpolation logic for opacity, scale, rotate, zIndex
};
```

This stays in `src/features/RoutesCarousel/` - it's domain-specific animation logic.

### Step 2: Create Data Transformation Helper

Create a helper that transforms terminal cards to include the placeholder:

```typescript
const transformTerminalCardsWithPlaceholder = (
  terminalCards: TerminalCardData[],
  layout: CarouselLayout
) => {
  return [
    { isPlaceholder: true, ...layout }, // Add placeholder with dimensions
    ...terminalCards.map(card => ({ ...card, isPlaceholder: false }))
  ];
};
```

**That's it for Phase 1.**

---

## Revised Phase 2 Plan

**Goal:** Create the adapter that bridges RoutesCarousel's API to AnimatedList.

### Create `RoutesCarouselAdapter.tsx`

A thin component that:
1. Takes RoutesCarousel's existing props
2. Converts `useCarouselLayout` → `AnimatedListLayout`
3. Prepend placeholder to data array
4. Creates `renderItem` that handles placeholder vs RouteCard
5. Passes everything to AnimatedList with `itemAnimationStyle`

The adapter knows about domain specifics (placeholder, blurTargetRef, RouteCard props), but AnimatedList remains generic.

---

## Revised Phase 3 Plan

**Goal:** Replace RoutesCarousel implementation with the adapter.

Same as before - swap the implementation, update RoutesCarouselSection to work with new approach, delete `RoutesCarouselItem.tsx`.

---

## Summary of Changes

**What's NOT added to AnimatedList:**
- ❌ No `contentPadding` prop
- ❌ No `placeholderItem` prop  
- ❌ No viewport-based layout mode
- ❌ No special cases at all

**What stays in RoutesCarousel (domain layer):**
- Placeholder data transformation
- Animation worklet (RoutesCarousel-specific)
- Layout conversion (useCarouselLayout → AnimatedListLayout)
- RouteCard rendering logic

**What AnimatedList gains:**
- Nothing - it already has everything needed

This keeps AnimatedList clean and generic. All domain-specific logic stays in RoutesCarousel, which just becomes a thin adapter on top of AnimatedList.

Does this revised plan align better with your goals?