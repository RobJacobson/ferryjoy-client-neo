# Map Animation Implementation Review

> Note: This document predates the current map navigation refactor. For the up-to-date implementation,
> see `MAP_NAVIGATION_AND_ANIMATION.md`, plus:
> - `src/features/MapComponent/useRegisterMapCameraController.ts`
> - `src/features/MapNavigation/useMapSlugCameraAnimation.ts`

## Current Implementation Analysis

### Native Implementation (`MapComponent.tsx`)
- **Method**: `Camera.setCamera()` with `animationMode: "flyTo"`
- **State Management**: `hasAnimated`, `mapLoaded` flags
- **Delay**: 1000ms before animation starts
- **Cleanup**: Proper timeout cleanup

### Web Implementation (`MapComponent.web.tsx`)
- **Method**: `mapRef.current.flyTo()` with `essential: true`
- **State Management**: `hasAnimated`, `mapLoaded`, `isAnimatingRef`
- **Delay**: 1000ms before animation starts
- **Post-animation**: Additional setTimeout to sync viewState after animation
- **Complexity**: Extra logic to prevent viewState updates during animation

## Alternative Approaches

### 1. **Current Approach (Native API Methods)**
**Pros:**
- ✅ Uses native map library APIs (most reliable)
- ✅ Smooth, hardware-accelerated animations
- ✅ Handles edge cases (zoom limits, coordinate wrapping)
- ✅ Native libraries optimize animation paths

**Cons:**
- ❌ Limited control over easing curves
- ❌ Platform-specific implementations
- ❌ Code duplication between platforms

### 2. **Manual Animation with requestAnimationFrame**
**Pros:**
- ✅ Full control over animation curve/easing
- ✅ Can implement custom easing functions
- ✅ Unified code across platforms

**Cons:**
- ❌ More complex to implement
- ❌ Must handle edge cases manually
- ❌ Performance overhead
- ❌ Risk of janky animations

### 3. **CSS Transitions (Web Only)**
**Pros:**
- ✅ Simple for basic transforms
- ✅ Hardware accelerated

**Cons:**
- ❌ Not applicable to map libraries (they use canvas/WebGL)
- ❌ Can't control map-specific properties (zoom, pitch, bearing)

### 4. **Animation Libraries (e.g., Framer Motion, React Spring)**
**Pros:**
- ✅ Rich easing options
- ✅ Unified API
- ✅ Good performance

**Cons:**
- ❌ Additional dependency
- ❌ Still need to interface with map libraries
- ❌ May conflict with map's internal state management

### 5. **State Machine (e.g., XState)**
**Pros:**
- ✅ Clear state transitions
- ✅ Better testability
- ✅ Handles edge cases systematically

**Cons:**
- ❌ Overkill for simple animation
- ❌ Additional complexity and dependency

## Recommendations

### Best Approach: **Hybrid - Extract Common Logic to Custom Hook**

Create a shared hook that handles the common animation logic, while keeping platform-specific implementations for the actual animation calls.

**Advantages:**
1. ✅ DRY - eliminates code duplication
2. ✅ Maintains native library benefits
3. ✅ Easier to test and maintain
4. ✅ Can add features (cancellation, progress callbacks) in one place

**Implementation Strategy:**
```typescript
// useMapTransition.ts
export const useMapTransition = ({
  transitionTo,
  transitionDuration,
  onAnimationStart,
  onAnimationComplete,
}) => {
  // Common logic: hasAnimated, mapLoaded tracking
  // Returns: { shouldAnimate, triggerAnimation, cancelAnimation }
}

// MapComponent.tsx (Native)
const { triggerAnimation } = useMapTransition({...});
// Use Camera.setCamera() when triggerAnimation is called

// MapComponent.web.tsx (Web)
const { triggerAnimation } = useMapTransition({...});
// Use mapRef.flyTo() when triggerAnimation is called
```

### Additional Improvements

1. **Animation Cancellation**
   - Add ability to cancel in-flight animations
   - Clean up on unmount
   - Handle prop changes during animation

2. **Configurable Delay**
   - Make 1000ms delay configurable or adaptive
   - Could detect map readiness more reliably

3. **Animation Progress Callbacks**
   - Allow parent components to track animation progress
   - Useful for UI updates during transitions

4. **Easing Options**
   - Expose easing curve options (if supported by libraries)
   - Default to smooth, natural-feeling curves

5. **Error Handling**
   - Handle cases where animation fails
   - Fallback to instant transition if needed

## Code Consolidation Opportunities

### Extract to `shared.ts`:
- Animation state management logic
- Common timing constants
- Animation trigger conditions

### Platform-Specific Files:
- Keep actual animation calls (setCamera vs flyTo)
- Platform-specific refs and event handlers
- Platform-specific cleanup logic

## Conclusion

**Current approach is good** - using native map library APIs is the right choice. The main improvements are:
1. Extract common logic to reduce duplication
2. Add animation cancellation support
3. Make delays/config more flexible
4. Simplify web implementation's state sync logic

The native API approach is superior to manual animation because:
- Map libraries handle complex coordinate transformations
- They optimize for performance
- They respect map constraints (zoom limits, etc.)
- They provide smooth, professional animations

