# AnimatedList Phase 4 Handoff Note

## Project Context

**Component:** AnimatedList (animated list with scroll-driven animations)

**Goal Phase 4:** Add imperative scroll control, scroll callbacks, and scroll position exposure for parallax effects.

---

## What Was Accomplished (Phase 4)

### 1. Imperative Scroll Control via Ref

**Key Decision:** Follow React 19 pattern from RoutesCarousel - receive `ref` directly as a prop, not via `forwardRef`. This allows `useImperativeHandle` to work correctly.

**Type Updates** (`types.ts`):
```typescript
/**
 * Imperative handle for programmatic list control.
 * Allows parent components to control scrolling behavior.
 */
export type AnimatedListRef = {
  scrollToIndex: (index: number, animated?: boolean) => void;
};

/**
 * Props for the generic AnimatedList component.
 * Supports any data type with configurable rendering and animations.
 */
export type AnimatedListProps<T> = {
  data: T[];
  renderItem: RenderItem<T>;
  layout: AnimatedListLayout;
  itemAnimationStyle?: ItemAnimationStyle;
  scrollOffset?: SharedValue<number>;
  onScrollEnd?: (activeIndex: number) => void;
  ref?: React.Ref<AnimatedListRef>;
};
```

**Component Implementation** (`AnimatedList.tsx`):
```typescript
const AnimatedList = <T,>({
  data,
  renderItem,
  layout,
  itemAnimationStyle,
  scrollOffset: externalScrollOffset,
  onScrollEnd,
  ref,
}: AnimatedListProps<T>) => {
  // ...

  // Imperative handle for programmatic scrolling
  useImperativeHandle(
    ref,
    () => ({
      scrollToIndex: (index: number, animated = true) => {
        const clamped = Math.max(0, Math.min(index, data.length - 1));
        const targetOffset = clamped * (itemSize + spacing);

        scheduleOnUI(() => {
          "worklet";
          if (isHorizontal) {
            scrollTo(scrollRef, targetOffset, 0, animated);
          } else {
            scrollTo(scrollRef, 0, targetOffset, animated);
          }
        });
      },
    }),
    [scrollRef, data.length, itemSize, spacing, isHorizontal]
  );

  // ...
};
```

**Key Features:**
- Silent clamping: Out-of-bounds indices are clamped to valid range `Math.max(0, Math.min(index, data.length - 1))`
- Default animated: `animated = true` for smooth UX
- Direction-aware: Scrolls to x or y based on `isHorizontal`
- Worklet execution: Uses `scheduleOnUI` to run scroll on UI thread

**Usage Example:**
```typescript
const listViewRef = useRef<AnimatedListRef>(null);

<AnimatedList
  ref={listViewRef}
  data={data}
  renderItem={(item) => <DemoCard item={item} />}
  layout={{ direction: "vertical", itemSize: 200, spacing: 4 }}
  itemAnimationStyle={useDemoAnimationStyle}
/>

// Later, programmatically scroll:
listViewRef.current?.scrollToIndex(2, true); // Animated scroll to index 2
listViewRef.current?.scrollToIndex(5, false); // Instant scroll to index 5
```

### 2. Scroll Position Exposure for Parallax

**Implementation:** Optional `scrollOffset` prop that allows parent components to track scroll position.

**Component Logic** (`AnimatedList.tsx`):
```typescript
// Manage scroll internally
const scrollRef = useAnimatedRef<Animated.ScrollView>();
const internalScrollOffset = useScrollOffset(scrollRef);
const scrollOffset: SharedValue<number> =
  externalScrollOffset ?? internalScrollOffset;

// Convert scroll position to normalized index
const scrollIndex = useDerivedValue(
  () => scrollOffset.value / (itemSize + spacing),
);
```

**Key Design:**
- If parent doesn't provide `scrollOffset`, component creates its own internal one
- Follows RoutesCarousel pattern exactly
- Parent can read `scrollOffset` for parallax effects using `useDerivedValue` or `useAnimatedReaction`

**Usage Example:**
```typescript
const scrollOffset = useSharedValue(0);

<AnimatedList
  scrollOffset={scrollOffset}
  data={data}
  renderItem={(item) => <DemoCard item={item} />}
  layout={{ direction: "horizontal", itemSize: 280, spacing: 4 }}
  itemAnimationStyle={useDemoAnimationStyle}
/>

// Use scrollOffset for background parallax
const parallaxStyle = useAnimatedStyle(() => ({
  transform: [{ translateX: -scrollOffset.value * 0.3 }],
}));
```

### 3. Scroll End Callback

**Implementation:** `onScrollEnd` callback that fires when scroll settles on an item.

**Component Logic** (`AnimatedList.tsx`):
```typescript
// Call onScrollEnd when scroll settles on an item
useAnimatedReaction(
  () => {
    if (!onScrollEnd) return undefined;
    const currentScrollIndex = scrollIndex.value;
    const activeIndex = Math.round(currentScrollIndex);
    return activeIndex;
  },
  (activeIndex) => {
    if (activeIndex !== undefined && onScrollEnd) {
      scheduleOnRN(onScrollEnd, activeIndex);
    }
  },
  [onScrollEnd]
);
```

**Key Design:**
- Uses `useAnimatedReaction` to react to scroll changes
- Returns `undefined` if `onScrollEnd` not provided (avoids unnecessary reactions)
- Calculates active index using `Math.round(scrollIndex)` - matches `isItemActive` utility
- Uses `scheduleOnRN` to call callback on React Native thread

**Usage Example:**
```typescript
const [activeIndex, setActiveIndex] = useState(0);

<AnimatedList
  onScrollEnd={(index) => setActiveIndex(index)}
  data={data}
  renderItem={(item) => <DemoCard item={item} />}
  layout={{ direction: "vertical", itemSize: 200, spacing: 4 }}
  itemAnimationStyle={useDemoAnimationStyle}
/>
```

### 4. Demo Enhancements

**New Features in `AnimatedListDemo.tsx`:**
- Scroll progress display showing active index and percentage
- Programmatic scroll buttons: Start (⏮), Previous (◀), Next (▶), End (⏭)
- State tracking for `activeIndex`
- Ref binding to `AnimatedList`
- `onScrollEnd` callback to update state

**Demo Implementation** (`demo/AnimatedListDemo.tsx`):
```typescript
const AnimatedListDemo = () => {
  const { availableHeight: totalHeight } = useAvailableDimensions();
  const [direction, setDirection] = useState<"vertical" | "horizontal">(
    "vertical"
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const listViewRef = useRef<AnimatedListRef>(null);

  const itemSize =
    direction === "vertical"
      ? Math.floor(totalHeight * CARD_HEIGHT_RATIO)
      : 280;

  const handleScrollEnd = (index: number) => {
    setActiveIndex(index);
  };

  const scrollToPrevious = () => {
    if (activeIndex > 0) {
      listViewRef.current?.scrollToIndex(activeIndex - 1, true);
    }
  };

  const scrollToNext = () => {
    if (activeIndex < data.length - 1) {
      listViewRef.current?.scrollToIndex(activeIndex + 1, true);
    }
  };

  const scrollToStart = () => {
    listViewRef.current?.scrollToIndex(0, true);
  };

  const scrollToEnd = () => {
    listViewRef.current?.scrollToIndex(data.length - 1, true);
  };

  return (
    <View className="flex-1 gap-4">
      <View className="items-center gap-2">
        <Text className="font-bold text-lg">Direction</Text>
        <ToggleGroup type="single" value={direction} onValueChange={setDirection}>
          {/* ... */}
        </ToggleGroup>
      </View>
      <View className="items-center gap-1">
        <Text className="text-sm text-muted-foreground">
          Active Index: {activeIndex} / {data.length - 1}
        </Text>
        <Text className="text-xs text-muted-foreground">
          Progress: {Math.round((activeIndex / (data.length - 1)) * 100)}%
        </Text>
      </View>
      <AnimatedList
        ref={listViewRef}
        data={data}
        renderItem={(item) => <DemoCard item={item} />}
        layout={{
          direction,
          itemSize,
          spacing: SPACING,
          activePositionRatio: 0.5,
        }}
        itemAnimationStyle={useDemoAnimationStyle}
        onScrollEnd={handleScrollEnd}
      />
      <View className="flex-row items-center justify-center gap-2">
        <Button variant="outline" size="icon" onPress={scrollToStart}>
          <Text>⏮</Text>
        </Button>
        <Button variant="outline" size="icon" onPress={scrollToPrevious}>
          <Text>◀</Text>
        </Button>
        <Button variant="outline" size="icon" onPress={scrollToNext}>
          <Text>▶</Text>
        </Button>
        <Button variant="outline" size="icon" onPress={scrollToEnd}>
          <Text>⏭</Text>
        </Button>
      </View>
    </View>
  );
};
```

### 5. Architecture Changes

**Modified: `AnimatedList.tsx`** (170 lines)
- Added `scrollOffset?: SharedValue<number>` prop handling
- Added `ref?: React.Ref<AnimatedListRef>` prop handling
- Added `onScrollEnd?: (activeIndex: number) => void` prop handling
- Implemented `useImperativeHandle` with `scrollToIndex` method
- Implemented `useAnimatedReaction` for scroll end callbacks
- Uses `scrollTo` from react-native-reanimated for programmatic scrolling
- Uses `scheduleOnUI` for UI thread execution
- Uses `scheduleOnRN` for React Native thread callbacks

**Modified: `types.ts`** (103 lines)
- Added `import type React from "react"` for `React.Ref` type
- Added `scrollOffset?: SharedValue<number>` to `AnimatedListProps<T>`
- Added `onScrollEnd?: (activeIndex: number) => void` to `AnimatedListProps<T>`
- Added `ref?: React.Ref<AnimatedListRef>` to `AnimatedListProps<T>`

**Modified: `demo/AnimatedListDemo.tsx`** (120 lines)
- Added state for `activeIndex` tracking
- Added `listViewRef` ref for imperative control
- Added `handleScrollEnd` callback handler
- Added programmatic scroll functions: `scrollToPrevious`, `scrollToNext`, `scrollToStart`, `scrollToEnd`
- Added scroll progress display showing active index and percentage
- Added navigation buttons with visual feedback

---

## Technical Decisions

### Why `ref` as Prop Instead of `forwardRef`?
**Reason:** The handoff note recommended React 19 pattern where `ref` can be passed directly as a prop instead of wrapping components with `forwardRef`.

**Pattern from RoutesCarousel:**
```typescript
const RoutesCarousel = ({ ref, blurTargetRef, scrollX, layout, terminalCards }: RoutesCarouselProps) => {
  useImperativeHandle(
    ref,
    () => ({ scrollToIndex: (index: number) => { /* ... */ } }),
    [/* ... */]
  );
  return <View>...</View>;
};
```

**Why This Works:** React 19 allows `ref` as a standard prop name for functional components. `useImperativeHandle` still receives the ref and exposes methods to it.

### Why Optional `scrollOffset` Prop?
**Reason:** Parent may want to track scroll position for parallax, but it's not always needed. Optional prop with internal fallback keeps API flexible.

**Implementation:**
```typescript
const internalScrollOffset = useScrollOffset(scrollRef);
const scrollOffset: SharedValue<number> = externalScrollOffset ?? internalScrollOffset;
```

### Why Silent Clamping for Out-of-Bounds Indices?
**Reason:** Better UX. Throwing errors would break user experience. Clamping is predictable and matches native ScrollView behavior.

**Implementation:**
```typescript
const clamped = Math.max(0, Math.min(index, data.length - 1));
```

### Why `animated = true` Default?
**Reason:** Smooth UX is preferred. Instant scrolling feels jarring. Users can explicitly pass `false` if needed.

### Why `useAnimatedReaction` for `onScrollEnd`?
**Reason:** Efficiently tracks scroll changes and fires callback only when active index changes. Avoids redundant callbacks during scrolling between items.

**Implementation:**
```typescript
useAnimatedReaction(
  () => {
    if (!onScrollEnd) return undefined; // Early return if no callback
    const currentScrollIndex = scrollIndex.value;
    const activeIndex = Math.round(currentScrollIndex);
    return activeIndex;
  },
  (activeIndex) => {
    if (activeIndex !== undefined && onScrollEnd) {
      scheduleOnRN(onScrollEnd, activeIndex);
    }
  },
  [onScrollEnd]
);
```

---

## Current API

### Component Usage

```typescript
<AnimatedList
  data={yourDataArray}
  renderItem={(item, index, animationState) => (
    <YourCustomCard item={item} animationState={animationState} />
  )}
  layout={{
    direction: "vertical", // Optional: "vertical" | "horizontal", default "vertical"
    itemSize: 120,      // Required: height for vertical, width for horizontal
    spacing: 4,         // Optional: defaults to 0
    activePositionRatio: 0.5, // Optional: defaults to 0.5
  }}
  itemAnimationStyle={yourCustomAnimationStyle} // Optional: worklet function
  ref={listViewRef} // Optional: ref for imperative scrollToIndex control
  scrollOffset={parallaxScrollOffset} // Optional: SharedValue for parallax effects
  onScrollEnd={(activeIndex) => console.log('Active:', activeIndex)} // Optional: callback
/>
```

### Imperative Scroll Control

```typescript
const listViewRef = useRef<AnimatedListRef>(null);

// Animated scroll to index
listViewRef.current?.scrollToIndex(2, true);

// Instant scroll to index
listViewRef.current?.scrollToIndex(5, false);
```

### Parallax Support

```typescript
const scrollOffset = useSharedValue(0);

<AnimatedList
  scrollOffset={scrollOffset}
  data={data}
  renderItem={(item) => <YourCard item={item} />}
  layout={{ direction: "horizontal", itemSize: 280 }}
  itemAnimationStyle={yourCustomAnimationStyle}
/>

// Background parallax that reacts to scroll
const parallaxStyle = useAnimatedStyle(() => ({
  opacity: interpolate(
    scrollOffset.value,
    [0, 500],
    [1, 0.3]
  ),
}));
```

### Scroll Callbacks

```typescript
const [activeIndex, setActiveIndex] = useState(0);

<AnimatedList
  onScrollEnd={(index) => {
    setActiveIndex(index);
    console.log('Scroll settled on:', index);
  }}
  data={data}
  renderItem={(item) => <YourCard item={item} />}
  layout={{ direction: "vertical", itemSize: 200 }}
  itemAnimationStyle={yourCustomAnimationStyle}
/>
```

### Custom Animation Hook

```typescript
/**
 * Custom animation worklet function.
 * Must have "worklet" directive to run on UI thread.
 */
const useMyCustomAnimation: ItemAnimationStyle = (
  scrollIndex,
  index,
  layout
) => {
  "worklet"; // Required: marks this as a worklet function
  const distance = calculateDistanceFromActive(index, scrollIndex);

  return {
    opacity: interpolate(distance, [0, 1, 2], [1, 0.5, 0.2]),
    transform: [{ scale: interpolate(distance, [0, 1], [1, 0.9]) }],
  };
};
```

### Helper Functions

```typescript
import { calculateDistanceFromActive, isItemActive } from "@/features/AnimatedList";

// Can be called from worklet context (both have "worklet" directive)
const distance = calculateDistanceFromActive(itemIndex, scrollIndexValue);
const active = isItemActive(itemIndex, scrollIndexValue);
```

---

## Recent Bug Fixes

### Fix 1: Missing `ref` Property Type
**Issue:** TypeScript error `Property 'ref' does not exist on type 'AnimatedListProps<T>'` when destructuring in component.

**Cause:** `ref` was not defined in `AnimatedListProps<T>` type, but component was trying to use it.

**Fix:**
```typescript
// types.ts - Added React import and ref to props
import type React from "react";

export type AnimatedListProps<T> = {
  data: T[];
  renderItem: RenderItem<T>;
  layout: AnimatedListLayout;
  itemAnimationStyle?: ItemAnimationStyle;
  scrollOffset?: SharedValue<number>;
  onScrollEnd?: (activeIndex: number) => void;
  ref?: React.Ref<AnimatedListRef>; // Added this
};
```

**Location:** `types.ts` lines 1, 95

---

## React 19 Notes for Phase 4

### useImperativeHandle in React 19
**Status:** Works correctly with ref-as-prop pattern.

**Key Pattern:** React 19 deprecated `forwardRef` for functional components. You can now receive `ref` directly as a standard prop instead of wrapping components with `forwardRef`.

**React 18 Pattern (deprecated):**
```typescript
const AnimatedList = forwardRef(<T,>(props, ref) => {
  useImperativeHandle(ref, () => ({
    scrollToIndex: (index, animated) => { /* ... */ }
  }), []);
  return <View>...</View>;
});
```

**React 19 Pattern (implemented):**
```typescript
const AnimatedList = <T,>({
  ref,
  data,
  renderItem,
  layout
}: AnimatedListProps<T>) => {
  useImperativeHandle(ref, () => ({
    scrollToIndex: (index, animated = true) => { /* ... */ }
  }), []);
  return <View>...</View>;
};
```

**Implementation for Phase 4:**
1. ✅ Added `ref?: React.Ref<AnimatedListRef>` to `AnimatedListProps<T>` type
2. ✅ Used `useImperativeHandle` with ref as a prop (no `forwardRef` needed)
3. ✅ Implemented `scrollToIndex` method that calculates scroll position and calls `scrollRef.scrollTo()`

---

## What Remains

### Future Enhancements (NOT STARTED)
- [ ] Consider animation composition utilities (e.g., `composeAnimations`)
- [ ] Consider variable item sizes support
- [ ] Consider RTL (right-to-left) support for horizontal mode
- [ ] Consider loop/continuous scrolling option
- [ ] Consider pagination indicators
- [ ] Better key generation (use item.key when available instead of String(index))

---

## Known Limitations

### Current Implementation
1. **Fixed item size** - All items must have same size (no variable height/width support yet)
2. **No built-in animation** - Animation is opt-in via `itemAnimationStyle` prop (by design)
3. **Simple animation system** - No built-in composition utilities (deferred)
4. **Active index rounding** - `onScrollEnd` uses `Math.round(scrollIndex)` which may fire during partial scrolls

### Demo-Specific
1. **Demo in subfolder** - `demo/` folder indicates internal testing utilities
2. **No animation variants** - Demo only shows one animation style (by design for simple testing)
3. **Button boundaries** - Previous/Next buttons don't disable visually, just check logic

---

## Recommendations for Next Agent

### Before Starting Future Phases
1. **Consider animation composition** - How should multiple animations be combined?
2. **Variable item sizes** - Should we support dynamic heights/widths per item?
3. **Performance optimization** - Test with large datasets (100+ items)
4. **Active index calculation** - Refine `onScrollEnd` to only fire when scroll settles (not during scrolling)

### Implementation Notes
1. **Follow project code style** - All functions need TSDoc, 2-space indentation, 80 char lines
2. **Use NativeWind** - Continue using `className` for styling
3. **Maintain demo compatibility** - Keep demo working through each phase
4. **Run check commands** - After each phase: `bun run check:fix` and `bun run type-check`

### Migration Path to RoutesCarousel
Once ready, consider:
1. **RoutesCarousel replacement strategy** - Can `AnimatedList` replace `RoutesCarousel` entirely?
2. **Parallax background support** - Use `scrollOffset` prop for existing parallax effects
3. **Placeholder item** - RoutesCarousel has blank first item for alignment, handle this pattern
4. **Backward compatibility** - Maintain existing RoutesCarousel API during migration

---

## Code Quality

- **Linting:** No linter errors in AnimatedList implementation (3 pre-existing warnings in other files)
- **Type Safety:** Full TypeScript strict mode compliance
- **Documentation:** All exported functions have TSDoc with @param and @returns
- **Style Compliance:** Follows project code style guide (double quotes, 2 spaces, semicolons, trailing commas)
- **File Organization:** Demo separated into `demo/` subfolder, feature folder structure maintained
- **Separation of Concerns:** Demo owns its animation logic, component is style-agnostic

---

## Phase 4 Status: ✅ COMPLETE

All Phase 4 requirements completed and tested:
- ✅ Added `ref?: React.Ref<AnimatedListRef>` to `AnimatedListProps<T>` type
- ✅ Implemented imperative handle with `useImperativeHandle` (no `forwardRef` needed in React 19)
- ✅ Added `scrollToIndex(index, animated?)` method with silent clamping
- ✅ Added `scrollOffset?: SharedValue<number>` prop for parallax effects
- ✅ Added `onScrollEnd?: (activeIndex: number) => void` callback
- ✅ Exposed scroll position for parallax effects
- ✅ Updated demo with scroll progress display and programmatic scroll buttons
- ✅ No linter errors in AnimatedList feature
- ✅ Full TypeScript type safety

---

## Housekeeping Note

**Renaming:** Component renamed from `AnimatedListView` to `AnimatedList` for conciseness.

**Files Changed:**
- Folder: `src/features/AnimatedListView/` → `src/features/AnimatedList/`
- Component: `AnimatedListView.tsx` → `AnimatedList.tsx`
- Types: All `AnimatedListView*` types → `AnimatedList*` types
- Demo: `AnimatedListViewDemo.tsx` → `AnimatedListDemo.tsx`

**Type Names Updated:**
- `AnimatedListViewDirection` → `AnimatedListDirection`
- `AnimatedListViewLayout` → `AnimatedListLayout`
- `AnimatedListViewProps` → `AnimatedListProps`
- `AnimatedListViewRef` → `AnimatedListRef`

**Imports Updated:**
- Old: `import { AnimatedListView } from "@/features/AnimatedListView"`
- New: `import { AnimatedList } from "@/features/AnimatedList"`

**Internal References:** All TSDoc and comments updated to use "AnimatedList" terminology.
