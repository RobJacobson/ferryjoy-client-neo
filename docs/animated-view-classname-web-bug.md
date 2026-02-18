# Bug: Animated.View with className="absolute inset-0" has height: 0 on Web

**Date:** February 17, 2026
**Component:** `Animated.View` from `react-native-reanimated`
**Platform:** React Native Web (Expo web)
**Severity:** High - Causes absolute-positioned elements to collapse

---

## Summary

`Animated.View` components from `react-native-reanimated` render with `height: 0` when using NativeWind's `className="absolute inset-0"` on the web platform. The same pattern works correctly on native (iOS/Android). The issue is resolved by using explicit inline `style` properties instead of `className`.

## Technical Details

### Behavior Matrix

| Component | Positioning Method | Platform | Height |
|-----------|-------------------|----------|--------|
| `View` (react-native) | `className="absolute inset-0"` | Native (iOS/Android) | ✅ Correct |
| `View` (react-native) | `className="absolute inset-0"` | Web | ✅ Correct |
| `Animated.View` | `className="absolute inset-0"` | Native (iOS/Android) | ✅ Correct |
| `Animated.View` | `className="absolute inset-0"` | Web | ❌ 0 (collapsed) |
| `Animated.View` | `style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}` | Web | ✅ Correct |

### Root Cause Analysis

The issue occurs specifically in the layout chain:

1. **Parent container** has valid dimensions (e.g., `width: 840, height: 1023`)
2. **ParallaxWaveLayer (Animated.View)** with `className="absolute inset-0"` collapses to `height: 0`
3. **Child Wave components** inherit the 0 height
4. **SVG elements** with `height="100%"` collapse

The `onLayout` events confirm the collapse:

```
ParallaxWaveLayer: { x: 0, y: 0, width: 2640, height: 0, left: 0, top: 0 }
Wave Animated.View: { x: 0, y: 0, width: 2640, height: 0, left: 0, top: 0 }
```

### Why This Is Likely a Bug

1. **Inconsistency**: Same pattern works on native but not web
2. **Inconsistency**: Regular `View` works with className on web
3. **Inconsistency**: `Animated.View` works with explicit styles on web
4. **Silent failure**: No console errors or warnings—just incorrect rendering
5. **Unexpected behavior**: `inset-0` should expand to `top: 0, right: 0, bottom: 0, left: 0`, which should work with absolute positioning

## Minimal Reproduction

### Option 1: Standalone Component

Create a new Expo web app and test with this minimal component:

```tsx
// AnimatedViewBugTest.tsx
import { View } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle } from "react-native-reanimated";

export default function AnimatedViewBugTest() {
  const sharedValue = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sharedValue.value }],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: "#ddd" }}>
      <View
        style={{
          position: "absolute",
          left: 50,
          top: 50,
          right: 50,
          bottom: 50,
          backgroundColor: "#ccc",
        }}
      >
        {/* Test 1: Animated.View with className - EXPECTED: height: 0 on web */}
        <Animated.View
          className="absolute inset-0"
          style={[animatedStyle, { backgroundColor: "#ff0000" }]}
        >
          <View style={{ backgroundColor: "#00ff00", padding: 10 }}>
            If you see red, bug is fixed. If you see nothing (height: 0), bug exists.
          </View>
        </Animated.View>

        {/* Test 2: Animated.View with explicit style - EXPECTED: works correctly */}
        <Animated.View
          style={[
            animatedStyle,
            {
              position: "absolute",
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "#0000ff",
            },
          ]}
        >
          <View style={{ backgroundColor: "#00ff00", padding: 10 }}>
            This blue box should be visible (baseline test).
          </View>
        </Animated.View>

        {/* Test 3: Regular View with className - EXPECTED: works correctly */}
        <View
          className="absolute inset-0"
          style={{ backgroundColor: "#ffff00", opacity: 0.7 }}
        >
          <View style={{ backgroundColor: "#00ff00", padding: 10 }}>
            This yellow box should be visible (regular View works).
          </View>
        </View>
      </View>
    </View>
  );
}
```

**Expected Results:**
- **Yellow box visible**: Confirms `View` + `className` works
- **Blue box visible**: Confirms `Animated.View` + explicit `style` works
- **Red box NOT visible**: Confirms the bug exists
- **DevTools**: Red `Animated.View` shows `height: 0`

### Option 2: One-Line Test

Even simpler—just check computed height in DevTools:

```tsx
import Animated from "react-native-reanimated";

export default function BugTest() {
  return (
    <div style={{ height: "100vh", position: "relative" }}>
      <Animated.View
        className="absolute inset-0"
        style={{ backgroundColor: "red" }}
      />
    </div>
  );
}
```

**In DevTools:**
- The `Animated.View` should have `height: 100vh` but shows `height: 0`

## Workaround

Use explicit inline `style` instead of `className`:

```tsx
// Broken on web:
<Animated.View className="absolute inset-0" style={[animatedStyle, otherStyles]} />

// Works on all platforms:
<Animated.View
  style={[
    animatedStyle,
    {
      position: "absolute",
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    },
    otherStyles,
  ]}
/>
```

## Affected Libraries

The bug involves interaction between these libraries:

1. **react-native-reanimated** - Provides `Animated.View` component
2. **nativewind** - Provides `className` prop for Tailwind CSS classes
3. **react-native-web** - Web renderer for React Native components

**Most likely location:** `react-native-reanimated` web implementation, since:
- Issue is specific to `Animated.View` (not regular `View`)
- Regular `View` works with NativeWind `className` on web
- Same pattern works on native platforms

**Alternative location:** `nativewind` handling of `Animated` components, since:
- `className` parsing may differ for `Animated` components
- NativeWind may need special handling for reanimated components

## Recommended Action

1. **Create minimal reproduction** (see above)
2. **File GitHub issue** at react-native-reanimated with:
   - Reproduction steps
   - Expected vs actual behavior
   - DevTools screenshot showing height: 0
   - Version numbers of all involved packages
3. **Include minimal repro** as a StackBlitz or CodeSandbox link

## Package Versions

From this project:
- `react-native-reanimated`: 3.x
- `nativewind`: 4.x
- `react-native-web`: 0.19.x (via Expo)
- `expo`: 51.x

**Report with actual versions from your `package.json`**

## Additional Notes

- No console errors or warnings—silently fails
- Works perfectly on native platforms
- Explicit `style` workaround is safe and cross-platform compatible
- Issue discovered during debugging collapsed height chain for wave components
- Diagnostic approach: Add background colors at each level and use `onLayout` to trace dimensions

---

**Memo created by:** AI Assistant
**For:** Future debugging and bug reporting
**Status:** Workaround in place; awaiting official fix
