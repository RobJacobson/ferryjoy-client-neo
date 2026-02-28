# AnimatedList

A generic, scroll-driven animated list component for React Native. Built with `react-native-reanimated` for smooth 60fps animations, supporting any data type through a flexible `renderItem` callback.

## Features

- 🎯 **Generic type system** - Works with any data type
- 🔄 **Scroll-driven animations** - Items animate based on scroll position
- ⚡ **Reanimated 3** - UI thread performance with worklets
- 📐 **Bidirectional** - Vertical or horizontal layouts
- 🎛️ **Imperative control** - Programmatic scroll via ref
- 📊 **Scroll callbacks** - Track when scroll settles
- 🎭 **Optional animations** - Animation system is opt-in
- 🔑 **Custom keys** - Stable keys for dynamic lists
- 📱 **React 19** - Modern patterns without `forwardRef`

## Core Concepts

### AnimatedList Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Parent Component                        │
│                                                         │
│  <AnimatedList                                          │
│    data={items}                                         │
│    renderItem={MyCard}                                  │
│    layout={{ itemSize: 200, spacing: 8 }}               │
│    itemAnimationStyle={fadeAndScale}                    │
│  />                                                     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              AnimatedList Component                     │
│                                                         │
│  Animated.ScrollView (snap to each item)                │
│    ├── SharedValue scrollIndex                          │
│    │   └── Derived from scrollOffset                    │
│    └── AnimatedListItems (one per data item)            │
│          ├── Animated.View (wraps item)                 │
│          ├── itemAnimationStyle (optional)              │
│          └── renderItem content                         │
└─────────────────────────────────────────────────────────┘
```

### Reanimated Concepts

AnimatedList relies heavily on Reanimated's worklet system. Here's what you need to understand:

#### SharedValue
A thread-safe value that can be read and modified from both JavaScript and UI thread.

```typescript
const scrollIndex = useDerivedValue(() => {
  // This runs on UI thread (60fps)
  return scrollOffset.value / itemStride;
});
```

**Key Points:**
- `.value` accesses the current value
- Can be read in worklets (UI thread functions)
- Cannot be directly accessed from regular JavaScript (use `.value`)

#### Worklet Functions
Functions marked with `"worklet";` that run on the UI thread:

```typescript
const myAnimation: ItemAnimationStyle = (scrollIndex, index, layout) => {
  "worklet"; // ← Required! Runs on UI thread

  const distance = Math.abs(scrollIndex.value - index);
  return {
    opacity: interpolate(distance, [0, 2], [1, 0]),
  };
};
```

**Key Points:**
- Must have `"worklet";` directive as first statement
- Runs on UI thread (not JS thread) - critical for smooth animation
- Can read `SharedValue` directly (`.value`)
- Cannot access JavaScript APIs (useState, useEffect, etc.)

#### useDerivedValue
Derives a new `SharedValue` from one or more others:

```typescript
const scrollIndex = useDerivedValue(() => {
  // Automatically re-runs when scrollOffset.value changes
  return scrollOffset.value / itemStride;
});
```

**Key Points:**
- Creates a reactive derived value
- Runs on UI thread
- Re-evaluates when dependencies change

#### useAnimatedStyle
Creates an animated style object that updates automatically:

```typescript
const animatedStyle = useAnimatedStyle(() => {
  return {
    opacity: interpolate(scrollIndex.value, [0, 1], [1, 0]),
  };
});

// Use it on an Animated.View
<Animated.View style={animatedStyle} />
```

**Key Points:**
- Returns a style object that updates on the UI thread
- Can read `SharedValue` values
- Must be used with `Animated.View`, not regular `View`

#### useAnimatedReaction
Runs a side effect when a derived value changes:

```typescript
useAnimatedReaction(
  () => {
    // First function: compute value to track
    if (!onScrollEnd) return undefined;
    const activeIndex = Math.round(scrollIndex.value);
    return activeIndex;
  },
  (activeIndex) => {
    // Second function: side effect when value changes
    if (activeIndex !== undefined) {
      scheduleOnRN(onScrollEnd, activeIndex);
    }
  },
  [onScrollEnd] // Dependencies
);
```

**Key Points:**
- First function computes a value to watch
- Second function runs when that value changes
- Use `scheduleOnRN` to call React Native functions
- Essential for bridging between UI thread and React Native

#### scheduleOnUI vs scheduleOnRN

- **`scheduleOnUI`**: Schedule a worklet to run on UI thread
  ```typescript
  scheduleOnUI(() => {
    "worklet";
    scrollTo(scrollRef, x, y, animated);
  });
  ```

- **`scheduleOnRN`**: Schedule a React Native callback to run on JS thread
  ```typescript
  scheduleOnRN(onScrollEnd, activeIndex);
  ```

### Scroll Index Normalization

AnimatedList converts pixel scroll position to a normalized "scroll index":

```
Pixels: 0     200     400     600     800    (itemSize: 200)
Index:  0      1       2       3       4
        ↑      ↑       ↑       ↑       ↑
     Active   Item 1  Item 2  Item 3  Item 4
```

When the list scrolls to 400 pixels, `scrollIndex.value` is `2.0`.

**Partial positions:**
```
Pixels: 300
Index:   1.5
Meaning:  Halfway between item 1 and item 2
```

This allows smooth interpolation between items!

## Quick Start

### Basic Usage

```typescript
import { AnimatedList } from "@/features/AnimatedList";

const MyList = () => {
  const data = [
    { id: 1, title: "Item 1" },
    { id: 2, title: "Item 2" },
    { id: 3, title: "Item 3" },
  ];

  return (
    <View className="flex-1 p-4">
      <AnimatedList
        data={data}
        renderItem={(item) => <MyCard item={item} />}
        layout={{
          direction: "vertical",
          itemSize: 200,
          spacing: 8,
        }}
      />
    </View>
  );
};
```

### With Animations

```typescript
import {
  AnimatedList,
  calculateDistanceFromActive,
} from "@/features/AnimatedList";

// Define your animation function
const demoAnimationStyle: ItemAnimationStyle = (scrollIndex, index) => {
  "worklet";
  const distance = calculateDistanceFromActive(index, scrollIndex.value);

  return {
    opacity: interpolate(
      distance,
      [0, 1, 2],
      [1, 0.6, 0.3],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        scale: interpolate(distance, [0, 1], [1, 0.9], Extrapolation.CLAMP),
      },
    ],
  };
};

// Use it
<AnimatedList
  data={data}
  renderItem={(item) => <MyCard item={item} />}
  layout={{ direction: "vertical", itemSize: 200, spacing: 8 }}
  itemAnimationStyle={demoAnimationStyle}
/>
```

### With Imperative Scroll Control

```typescript
import { useRef } from "react";
import type { AnimatedListRef } from "@/features/AnimatedList";

const MyList = () => {
  const listRef = useRef<AnimatedListRef>(null);

  const scrollToItem3 = () => {
    listRef.current?.scrollToIndex(3, true); // Animated
  };

  const jumpToItem5 = () => {
    listRef.current?.scrollToIndex(5, false); // Instant
  };

  return (
    <>
      <Button onPress={scrollToItem3}>Scroll to Item 3</Button>
      <Button onPress={jumpToItem5}>Jump to Item 5</Button>

      <AnimatedList
        ref={listRef}
        data={data}
        renderItem={(item) => <MyCard item={item} />}
        layout={{ direction: "vertical", itemSize: 200, spacing: 8 }}
      />
    </>
  );
};
```

### With Scroll Callbacks

```typescript
import { useState } from "react";

const MyList = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <>
      <Text>Current: {activeIndex}</Text>

      <AnimatedList
        data={data}
        renderItem={(item) => <MyCard item={item} />}
        layout={{ direction: "vertical", itemSize: 200, spacing: 8 }}
        onScrollEnd={(index) => {
          setActiveIndex(index);
          console.log("Scroll settled on:", index);
        }}
      />
    </>
  );
};
```

### With Parallax Effects

```typescript
import { useSharedValue, useAnimatedStyle } from "react-native-reanimated";

const MyParallaxList = () => {
  const scrollOffset = useSharedValue(0);

  const backgroundStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -scrollOffset.value * 0.3 }],
  }));

  return (
    <>
      <Animated.View style={backgroundStyle} className="absolute inset-0">
        <BackgroundImage />
      </Animated.View>

      <AnimatedList
        scrollOffset={scrollOffset} // Provide your own scroll tracking
        data={data}
        renderItem={(item) => <MyCard item={item} />}
        layout={{ direction: "horizontal", itemSize: 280, spacing: 8 }}
      />
    </>
  );
};
```

## API Reference

### AnimatedList Component

```typescript
<AnimatedList
  data={T[]}                             // Required: Array of items to render
  renderItem={RenderItem<T>}             // Required: Function to render each item
  layout={AnimatedListLayout}            // Required: Layout configuration
  itemAnimationStyle={yourAnimationStyle} // Optional: Custom animation worklet
  scrollOffset={SharedValue<number>}     // Optional: External scroll tracking for parallax
  onScrollEnd={(activeIndex) => void}    // Optional: Callback when scroll settles
  ref={React.Ref<AnimatedListRef>}       // Optional: Ref for imperative control
  keyExtractor={(item, index) => string} // Optional: Custom key generator
  itemClassName={string}                 // Optional: Custom className for item wrapper
/>
```

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `T[]` | ✅ Yes | Array of items to render |
| `renderItem` | `RenderItem<T>` | ✅ Yes | Function to render each item |
| `layout` | `AnimatedListLayout` | ✅ Yes | Layout configuration |
| `itemAnimationStyle` | `ItemAnimationStyle` | ❌ No | Custom animation worklet function |
| `scrollOffset` | `SharedValue<number>` | ❌ No | External scroll offset for parallax effects |
| `onScrollEnd` | `(activeIndex: number) => void` | ❌ No | Callback when scroll settles on an item |
| `ref` | `React.Ref<AnimatedListRef>` | ❌ No | Ref for imperative `scrollToIndex` control |
| `keyExtractor` | `(item: T, index: number) => string` | ❌ No | Custom key generator for items |
| `itemClassName` | `string` | ❌ No | Custom className for item wrapper (defaults to `"overflow-hidden"`) |

### AnimatedListLayout

```typescript
type AnimatedListLayout = {
  direction?: "horizontal" | "vertical"; // Default: "vertical"
  itemSize: number;                      // Required: height (vertical) or width (horizontal)
  spacing?: number;                       // Default: 0
};
```

### RenderItem

```typescript
type RenderItem<T> = (
  item: T,                    // The data item
  index: number               // The item's index in the list
) => React.ReactNode;        // Rendered component
```

**Note:** Unlike some list components, AnimatedList's `renderItem` does not pass `animationState`. The component handles animations internally when `itemAnimationStyle` is provided. If you need scroll position in your item, create your own animation function.

### itemClassName

```typescript
itemClassName?: string
```

Optional className for the item wrapper. Uses Tailwind's `cn()` utility to merge with the default `"overflow-hidden"` class. Any custom classes will take precedence.

**Default:** `"overflow-hidden"`

**Example:**

```typescript
// Default behavior
<AnimatedList
  data={data}
  renderItem={MyCard}
  layout={layout}
/>

// Custom className
<AnimatedList
  data={data}
  renderItem={MyCard}
  layout={layout}
  itemClassName="overflow-visible rounded-xl" // Overrides default
/>
```

### ItemAnimationStyle

```typescript
type ItemAnimationStyle = (
  scrollIndex: SharedValue<number>,  // Current scroll position (normalized)
  index: number,                     // Item index
  layout: AnimatedListLayout          // Layout configuration
) => AnimatedStyleResult;            // Animated style object
```

**Must be a worklet function:**

```typescript
const myAnimation: ItemAnimationStyle = (scrollIndex, index, layout) => {
  "worklet"; // ← Required first line!

  // Calculate animation based on scroll position
  const distance = Math.abs(scrollIndex.value - index);

  return {
    opacity: 1 - distance * 0.5,
    transform: [{ scale: Math.max(0.5, 1 - distance * 0.2) }],
  };
};
```

### AnimatedListRef

```typescript
type AnimatedListRef = {
  scrollToIndex: (index: number, animated?: boolean) => void;
};
```

**Methods:**

- `scrollToIndex(index, animated?)` - Scroll to a specific item
  - `index`: Zero-based index to scroll to
  - `animated`: Whether to animate (default: `true`)
  - **Silent clamping:** Out-of-bounds indices are clamped to valid range

```typescript
listRef.current?.scrollToIndex(5, true);   // Animated scroll to index 5
listRef.current?.scrollToIndex(10, false); // Instant jump to index 10
listRef.current?.scrollToIndex(-5);        // Clamped to 0
listRef.current?.scrollToIndex(999);       // Clamped to last item
```

## Animation System

### Helper Functions

AnimatedList provides utility functions for common animation patterns:

#### `calculateDistanceFromActive`

```typescript
import { calculateDistanceFromActive } from "@/features/AnimatedList";

const distance = calculateDistanceFromActive(
  index,         // Item index
  scrollIndexValue // SharedValue scroll position
);
```

Returns the absolute distance from the active (centered) item.

**Example:**
```typescript
const animation: ItemAnimationStyle = (scrollIndex, index) => {
  "worklet";
  const distance = calculateDistanceFromActive(index, scrollIndex.value);

  // 0 = active item, 1 = one away, 2 = two away, etc.
  return {
    opacity: interpolate(distance, [0, 2], [1, 0.2], Extrapolation.CLAMP),
  };
};
```

#### `isItemActive`

```typescript
import { isItemActive } from "@/features/AnimatedList";

const isActive = isItemActive(
  index,         // Item index
  scrollIndexValue // SharedValue scroll position
);
```

Returns `true` if the item is currently within the "active" zone (within 0.5 of center).

**Example:**
```typescript
const animation: ItemAnimationStyle = (scrollIndex, index) => {
  "worklet";
  const active = isItemActive(index, scrollIndex.value);

  return {
    opacity: active ? 1 : 0.3,
    transform: [{ scale: active ? 1 : 0.9 }],
  };
};
```

### Animation Patterns

#### Fade Effect

```typescript
const fadeAnimation: ItemAnimationStyle = (scrollIndex, index) => {
  "worklet";
  const distance = calculateDistanceFromActive(index, scrollIndex.value);

  return {
    opacity: interpolate(
      distance,
      [0, 1, 2],
      [1, 0.6, 0.3],
      Extrapolation.CLAMP
    ),
  };
};
```

#### Scale Effect

```typescript
const scaleAnimation: ItemAnimationStyle = (scrollIndex, index) => {
  "worklet";
  const distance = calculateDistanceFromActive(index, scrollIndex.value);

  return {
    transform: [
      {
        scale: interpolate(
          distance,
          [0, 1, 2],
          [1.0, 0.95, 0.9],
          Extrapolation.CLAMP
        ),
      },
    ],
  };
};
```

#### Combined Effects

```typescript
const fadeAndScale: ItemAnimationStyle = (scrollIndex, index) => {
  "worklet";
  const distance = calculateDistanceFromActive(index, scrollIndex.value);

  return {
    opacity: interpolate(
      distance,
      [0, 1, 2],
      [1, 0.6, 0.3],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        scale: interpolate(
          distance,
          [0, 1, 2],
          [1.0, 0.95, 0.9],
          Extrapolation.CLAMP
        ),
      },
    ],
  };
};
```

#### Parallax (Move with Scroll)

```typescript
const parallaxEffect: ItemAnimationStyle = (scrollIndex, index) => {
  "worklet";
  // Offset from active position
  const offset = scrollIndex.value - index;

  return {
    transform: [
      {
        translateX: offset * 20, // Shift horizontally based on offset
      },
    ],
  };
};
```

## Technical Details

### Thread Safety

AnimatedList carefully manages which operations run on which thread:

| Thread | Operations | Performance |
|--------|-------------|-------------|
| **JavaScript** | Component rendering, state management, callbacks | ✅ Normal React performance |
| **UI Thread** | Scroll tracking, animation calculations, style updates | ✅ 60fps smooth animations |

**Why this matters:**
- JavaScript thread can be blocked by heavy computations
- UI thread must run smoothly for good UX (16ms per frame)
- Reanimated moves animation logic to UI thread

### Scroll Event Handling

AnimatedList uses `scrollEventThrottle={16}` (~60fps) for optimal performance:

```typescript
<Animated.ScrollView
  scrollEventThrottle={16}  // Updates every ~16ms
  snapToOffsets={snapOffsets}
  decelerationRate="fast"
  ...
/>
```

### Snap Behavior

Items snap to predefined positions:

```typescript
const snapOffsets = data.map((_, index) => index * (itemSize + spacing));
// [0, 208, 416, 624, ...] for itemSize=200, spacing=8
```

**Snap settings:**
- `snapToEnd={false}` - Can scroll past last item
- `snapToStart={false}` - Can scroll before first item
- `decelerationRate="fast"` - Snap quickly after release

### Division by Zero Protection

The component includes protection against invalid item sizes:

```typescript
const itemStride = Math.max(1, itemSize + spacing);
const scrollIndex = useDerivedValue(() => scrollOffset.value / itemStride);
```

**Why:** If `itemSize + spacing` is somehow 0, division would cause `Infinity` or crashes.

### Scroll End Callback Optimization

The `onScrollEnd` callback only fires when scroll settles within the tolerance range and prevents duplicate triggers:

```typescript
const lastTriggeredIndex = useRef<number | null>(null);

useAnimatedReaction(
  () => {
    if (!onScrollEnd) return null;
    const currentScrollIndex = scrollIndex.value;
    const activeIndex = Math.round(currentScrollIndex);
    const distanceFromIndex = Math.abs(currentScrollIndex - activeIndex);
    const settled = distanceFromIndex < tolerance;
    return settled ? activeIndex : null;
  },
  (activeIndex) => {
    if (activeIndex !== null && onScrollEnd) {
      // Only trigger when index changes, preventing duplicate callbacks
      if (activeIndex !== lastTriggeredIndex.current) {
        lastTriggeredIndex.current = activeIndex;
        scheduleOnRN(onScrollEnd, activeIndex);
      }
    }
  },
  [onScrollEnd, tolerance]
);
```

## Best Practices

### 1. Use NativeWind for Styling

AnimatedList uses NativeWind for styling. Continue this pattern:

```typescript
// ✅ Good
<View className="flex-1 p-4">
  <Text className="font-bold text-lg">Title</Text>
</View>

// ❌ Avoid (unless necessary)
<View style={{ flex: 1, padding: 16 }}>
  <Text style={{ fontWeight: 'bold', fontSize: 18 }}>Title</Text>
</View>
```

### 2. Mark Worklet Functions Correctly

Always add `"worklet";` as the first line:

```typescript
// ✅ Correct
const myAnimation: ItemAnimationStyle = (scrollIndex, index, layout) => {
  "worklet"; // ← First statement!
  // ... rest of function
};

// ❌ Wrong
const myAnimation: ItemAnimationStyle = (scrollIndex, index, layout) => {
  const distance = scrollIndex.value - index; // Not a worklet!
  "worklet"; // Too late!
};
```

### 3. Use Extrapolation.CLAMP for Smooth Transitions

Clamp prevents values from going outside the interpolation range:

```typescript
// ✅ Good - Values stay in range [0, 2]
opacity: interpolate(
  distance,
  [0, 1, 2],
  [1, 0.6, 0.3],
  Extrapolation.CLAMP
)

// ❌ May cause unexpected values >2 or <0
opacity: interpolate(
  distance,
  [0, 1, 2],
  [1, 0.6, 0.3]
  // No extrapolation specified!
)
```

### 4. Provide Key Extractors for Dynamic Lists

If your list can be reordered or items can be inserted/removed:

```typescript
// ✅ Good - Stable keys
<AnimatedList
  keyExtractor={(item) => item.id}
  data={items}
  renderItem={MyCard}
  layout={layout}
/>

// ❌ Fragile - Reorder causes issues
<AnimatedList
  // No keyExtractor, uses String(index)
  data={items}
  renderItem={MyCard}
  layout={layout}
/>
```

### 5. Parent Controls Layout Padding

AnimatedList does NOT handle padding/margin for positioning items. The parent component is responsible:

```typescript
// ✅ Good - Parent handles layout
<View className="flex-1 p-4">
  <AnimatedList
    data={data}
    renderItem={MyCard}
    layout={{ direction: "vertical", itemSize: 200, spacing: 8 }}
  />
</View>
```

### 6. Use scheduleOnRN for Callbacks

When calling React Native functions from worklets, always use `scheduleOnRN` to bridge from UI thread to React Native:

```typescript
useAnimatedReaction(
  () => {
    if (!onScrollEnd) return null;
    const currentScrollIndex = scrollIndex.value;
    const activeIndex = Math.round(currentScrollIndex);
    const distanceFromIndex = Math.abs(currentScrollIndex - activeIndex);
    const settled = distanceFromIndex < tolerance;
    return settled ? activeIndex : null;
  },
  (activeIndex) => {
    if (activeIndex !== null && onScrollEnd) {
      // Use scheduleOnRN to call the callback on React Native thread
      scheduleOnRN(onScrollEnd, activeIndex); // ✅ Correct
    }
  },
  [onScrollEnd, tolerance]
);
```

## Limitations

### Current Implementation

1. **Fixed Item Size**
   - All items must have the same size
   - No support for variable height/width per item
   - **Workaround:** Use a single item size that fits all content

2. **No Built-in Animations**
   - Animation is opt-in via `itemAnimationStyle` prop
   - By design - keeps component flexible
   - **Workaround:** Provide your own `ItemAnimationStyle`

3. **Simple Animation System**
   - No built-in animation composition utilities
   - Cannot easily combine multiple animation presets
   - **Future enhancement:** Consider animation composition API

4. **Key Generation**
   - Defaults to `String(index)` if no `keyExtractor` provided
   - **Workaround:** Provide `keyExtractor` for dynamic lists

### Performance Considerations

- **Large datasets:** Not yet tested with 100+ items
- **Complex animations:** Multiple items animating simultaneously may impact performance
- **Deep item trees:** Complex item components may affect frame rate

## Future Enhancements

### Potential Improvements

- [ ] **Animation composition utilities**
  - API to combine multiple animation functions
  - Example: `composeAnimations(fade, scale, parallax)`

- [ ] **Variable item sizes**
  - Support dynamic heights/widths per item
  - Challenge: Snap offsets become more complex

- [ ] **RTL (Right-to-Left) support**
  - Mirror horizontal layout for RTL languages
  - Challenge: Direction-aware transforms

- [ ] **Loop/continuous scrolling**
  - Infinite scroll wrapping from last to first item
  - Challenge: Scroll offset calculation

- [ ] **Pagination indicators**
  - Built-in dots or page indicators
  - Challenge: Design system integration

- [ ] **Performance optimization**
  - Test with large datasets (100+ items)
  - Consider virtualization if needed

- [ ] **Animation presets**
  - Common animations (fade, scale, slide) built-in
  - Easy onboarding for new users

### Migration Path

When considering replacing `RoutesCarousel`:

1. **Maintain backward compatibility** during migration
2. **Preserve existing parallax effects** using `scrollOffset` prop
3. **Handle placeholder items** (RoutesCarousel has blank first item)
4. **Gradual rollout** - Test with small feature sets first

## File Structure

```
src/features/AnimatedList/
├── AnimatedList.tsx           # Main component
├── AnimatedListItem.tsx       # Internal item wrapper
├── types.ts                  # TypeScript definitions
├── utils.ts                  # Helper functions
├── index.ts                  # Public exports
└── demo/                    # Demo components (internal)
    ├── AnimatedListDemo.tsx   # Demo app
    ├── AnimatedListDemoCard.tsx  # Demo card component
    ├── useAnimatedListDemoStyle.ts  # Demo animation
    └── index.ts             # Demo exports
```

## Code Quality

- ✅ **Linting:** No linter errors in AnimatedList implementation
- ✅ **Type Safety:** Full TypeScript strict mode compliance
- ✅ **Documentation:** All exported functions have TSDoc
- ✅ **Style Compliance:** Follows project code style guide
- ✅ **React 19:** Modern patterns without `forwardRef`, `useMemo`, or `useCallback` (Compiler handles optimization)
- ✅ **Testing:** Demo app validates functionality

## Running the Demo

```typescript
import { AnimatedListDemo } from "@/features/AnimatedList";

const ChatScreen = () => {
  return (
    <View className="flex-1 bg-black">
      <AnimatedListDemo />
    </View>
  );
};
```

**Demo Features:**
- Toggle between vertical/horizontal layout
- Real-time scroll progress display
- Programmatic scroll controls (Start, Previous, Next, End)
- Smooth scroll-driven animations

## Troubleshooting

### Animations Not Working

**Problem:** Items render but don't animate.

**Solutions:**
1. Ensure animation function has `"worklet";` as first line
2. Check that `itemAnimationStyle` prop is passed
3. Verify animation function returns a valid style object

### Scroll Callbacks Not Firing

**Problem:** `onScrollEnd` never triggers.

**Solutions:**
1. Ensure callback is not undefined
2. Check that items are large enough to scroll between
3. Verify snap behavior is working correctly

### TypeScript Errors

**Problem:** Type errors when using component.

**Solutions:**
1. Import types: `import type { AnimatedListRef } from "@/features/AnimatedList";`
2. Ensure generic type is specified: `<AnimatedList<MyDataType>`
3. Check that `renderItem` returns `React.ReactNode`

### Performance Issues

**Problem:** List scrolling is choppy.

**Solutions:**
1. Reduce animation complexity
2. Simplify item components
3. Check for expensive operations in render functions
4. Ensure no React Native state updates in worklets

## Credits

Built for the FerryJoy project using:
- React Native
- React Native Reanimated 3
- React Native Worklets
- NativeWind for styling

See `demo/` folder for usage examples and patterns.
