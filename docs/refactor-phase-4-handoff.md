# RoutesCarousel Refactoring - Phase 4 Handoff

## Issue Introduced

During Phase 4 refactoring, carousel scrolling and navigation buttons stopped working. User reports:
- Cannot scroll/drag to next card from home screen
- "Next" navigation button does not respond when pressed

## Root Cause Analysis

The placeholder View at index 0 is likely blocking touch events that should reach the AnimatedList's ScrollView. Even though `pointerEvents: "none"` was added, there may be additional issues:

### Current Implementation

```typescript
// src/features/RoutesCarousel/RouteCard.tsx

if (isPlaceholder) {
  return (
    <View
      className="flex-1"
      style={{ opacity: 0, pointerEvents: "none" } as const}
    />
  );
}
```

### Why This Might Not Be Sufficient

1. **AnimatedListItem Wrapper**: Each item (including placeholder) is wrapped in `AnimatedListItem` which is an `Animated.View` with `overflow-hidden` class. This may affect event propagation.

2. **Container Structure**: The RoutesCarousel returns:
   ```typescript
   return (
     <View className="relative flex-1">
       <AnimatedList ... />
       <TerminalCarouselNav ... />
     </View>
   ```
   TerminalCarouselNav uses `absolute` positioning which relies on this container.

3. **Placeholder Position**: The placeholder is at index 0, which is the first visible/interactive area. If touch events aren't properly passing through, users interact with "nothing".

## Investigation Steps for Next Agent

### Step 1: Verify Touch Event Propagation

Test if touches are reaching the AnimatedList by adding temporary debug logging to AnimatedList's ScrollView:

```typescript
// src/features/AnimatedList/AnimatedList.tsx

<Animated.ScrollView
  ...
  onScroll={(event) => {
    console.log('Scroll event:', event.nativeEvent);
  }}
  onScrollBegin={(event) => {
    console.log('Scroll begin:', event.nativeEvent);
  }}
  onTouchStart={(event) => {
    console.log('Touch start:', event.nativeEvent);
  }}
  ...
>
```

If no touch events are logged when swiping/dragging on the carousel area, touch events are not reaching the ScrollView.

### Step 2: Check AnimatedListItem Layer

The `AnimatedListItem` wrapper might be interfering. Inspect:

```typescript
// src/features/AnimatedList/AnimatedListItem.tsx (lines 54-62)

<Animated.View
  style={[itemSizeStyle, animatedStyle]}
  className={cn("overflow-hidden", itemClassName)}
  testID={`animated-list-item-${index}`}
>
  {renderItem(item, index)}
</Animated.View>
```

**Potential issue**: The `Animated.View` wrapper might not be passing touch events through properly for the placeholder item.

### Step 3: Verify Placeholder Implementation

The placeholder implementation might need adjustment. Options:

#### Option A: Use Empty Fragment for Placeholder
Don't render any View for placeholder items:

```typescript
// src/features/RoutesCarousel/RouteCard.tsx

if (isPlaceholder) {
  return null;
}
```

**Concern**: This might cause layout issues if AnimatedList expects a component.

#### Option B: Pass Through AnimatedListItem Props
Modify the placeholder to be more explicit about being invisible but interactive-transparent:

```typescript
// src/features/RoutesCarousel/RouteCard.tsx

if (isPlaceholder) {
  return (
    <View
      className="flex-1"
      style={{
        opacity: 0,
        pointerEvents: "none",
        // Ensure it doesn't consume any layout space beyond what AnimatedList allocates
        height: "100%",
        width: "100%",
      } as const}
      // Critical: Ensure no event handling
      onTouchStart={() => {}}
      onTouchMove={() => {}}
      onTouchEnd={() => {}}
    />
  );
}
```

#### Option C: Fix at AnimatedList Level
If the issue is with `AnimatedListItem` not respecting `pointerEvents`, we may need to pass this through:

```typescript
// src/features/AnimatedList/AnimatedListItem.tsx

<Animated.View
  style={[itemSizeStyle, animatedStyle]}
  className={cn("overflow-hidden", itemClassName)}
  // Pass through pointerEvents if item has it
  pointerEvents={item.pointerEvents ?? "auto"}
  testID={`animated-list-item-${index}`}
>
  {renderItem(item, index)}
</Animated.View>
```

This would require updating the item type to support optional `pointerEvents`.

### Step 4: Check Navigation Button References

Verify the `scrollToIndex` method is being called correctly:

```typescript
// src/features/RoutesCarousel/TerminalCarouselNav.tsx (lines 46-57)

{showPrev && (
  <NavButtonContainer positionClass="left-2">
    <TerminalNavButton
      direction="prev"
      onPress={() => {
        console.log('Prev pressed, currentIndex:', currentIndex);
        carouselRef.current?.scrollToIndex(currentIndex - 1);
      }}
      accessibilityLabel="Previous terminal"
    />
  </NavButtonContainer>
)}
```

And in AnimatedList, verify the ref is forwarding scrollToIndex correctly:

```typescript
// src/features/AnimatedList/AnimatedList.tsx (lines 70-88)

useImperativeHandle(
  ref,
  () => ({
    scrollToIndex: (index: number, animated = true) => {
      console.log('scrollToIndex called with:', index);
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
```

### Step 5: Verify AnimatedList Props

Check that `RoutesCarousel` is passing correct props to AnimatedList:

```typescript
// src/features/RoutesCarousel/RoutesCarousel.tsx (lines 124-132)

<AnimatedList
  ref={carouselRef}
  data={carouselData}
  renderItem={renderItem}
  layout={layout}
  itemAnimationStyle={routesCarouselAnimation}
  scrollOffset={scrollX}
  keyExtractor={keyExtractor}
/>
```

**Check**:
- `ref={carouselRef}` - ✓ Used
- `scrollOffset={scrollX}` - ✓ Provided (this allows external tracking)
- `layout` - ✓ Correct structure
- `data` - ✓ Includes placeholder
- `renderItem` - ✓ Returns RouteCard
- `keyExtractor` - ✓ Handles placeholder

### Step 6: Compare with Working Demo

Compare with `AnimatedListDemo.tsx` to see what's different:

```typescript
// src/features/AnimatedList/demo/AnimatedListDemo.tsx (lines 89-100)

<AnimatedList
  ref={listViewRef}
  data={data}
  renderItem={(item) => <AnimatedListDemoCard item={item} />}
  layout={{
    direction,
    itemSize,
    spacing: SPACING,
  }}
  itemAnimationStyle={demoAnimationStyle}
  onScrollEnd={handleScrollEnd}
/>
```

**Key differences**:
- Demo doesn't use `scrollOffset` prop (AnimatedList tracks internally)
- Demo uses `onScrollEnd` callback
- RoutesCarousel passes `scrollOffset={scrollX}` for external parallax tracking

This might be a clue - passing `scrollOffset` might interfere with internal scroll tracking in AnimatedList.

## Most Likely Root Cause

**Hypothesis**: The placeholder View, even with `pointerEvents: "none"`, combined with the `AnimatedListItem` wrapper (which is an `Animated.View`), is creating a touch event sink that prevents the ScrollView from receiving gesture recognizers.

**Alternative Hypothesis**: Passing `scrollOffset={scrollX}` to AnimatedList might be overriding or conflicting with its internal scroll tracking, preventing gesture recognition.

## Recommended Resolution Path

1. **Quick fix**: Try removing `pointerEvents: "none"` first - it may be causing the issue
2. **If that fails**: Change placeholder to `return null` or return empty fragment
3. **If that fails**: Remove the `scrollOffset` prop from AnimatedList usage (let AnimatedList track internally, use `onScrollEnd` to update `scrollProgress`)
4. **If that fails**: Modify `AnimatedListItem` to respect and pass through `pointerEvents` from rendered content

## Testing Checklist

After implementing fix, verify:
- [ ] Can swipe/drag to scroll through cards
- [ ] "Previous" button scrolls to previous card
- [ ] "Next" button scrolls to next card  
- [ ] Parallax background still responds to scroll
- [ ] RouteCard animations still work correctly
- [ ] No console errors or warnings

## Files to Investigate

1. `src/features/RoutesCarousel/RoutesCarousel.tsx` - Main carousel component
2. `src/features/RoutesCarousel/RouteCard.tsx` - Placeholder handling
3. `src/features/RoutesCarousel/TerminalCarouselNav.tsx` - Navigation buttons
4. `src/features/AnimatedList/AnimatedList.tsx` - Scroll handling
5. `src/features/AnimatedList/AnimatedListItem.tsx` - Item wrapper

## Expected Outcome

After fixing, the carousel should behave exactly like the AnimatedList demo - fully interactive with scroll gestures and navigation buttons, while maintaining all the architectural improvements from Phase 4 (simplified structure, no adapter, clean RouteCard API).
