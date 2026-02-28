# RoutesCarousel Debug Handoff - Phase 4 Issues

## Current Status

After completing Phase 4 refactoring ( consolidating RoutesCarousel, removing adapter, simplifying RouteCard), the RoutesCarousel is **severely broken** with multiple layout and rendering issues.

## Symptoms Observed

1. **Placeholder card**: Renders as a square (not 3:4 aspect ratio) with green diagnostic background
2. **Photo placeholder area**: Shows as square, not maintaining 3:4 portrait aspect ratio
3. **BlurView sizing**: BlurView appears to "hug" the placeholder with padding instead of filling allocated space
4. **Terminal names**: NOT visible - only a grey bar appears (likely a collapsed Button component)
5. **Destination buttons**: NOT visible - the destinations section appears completely empty
6. **Overall layout**: Cards appear as broken/collapsed rectangles rather than full rounded cards with glassmorphism

## What We've Fixed So Far

### 1. Fixed Scroll Tracking (Priority 1 from initial diagnosis)
- **Problem**: `scrollOffset={scrollX}` prop was creating broken feedback loop
- **Solution**: Removed external `scrollOffset` prop, replaced with `onScrollEnd` callback
- **Status**: ✅ Working - swipe, parallax, and nav buttons all functional

### 2. Fixed Ref Type Mismatch
- **Problem**: `carouselRef` declared as `RoutesCarouselRef` but passed to `AnimatedList` (which expects `AnimatedListRef`)
- **Solution**: Both types have compatible interfaces, TypeScript allows this

### 3. Restored BlurView Explicit Dimensions (CRITICAL FIX)
- **Problem**: Phase 4 removed `width` and `height` props from RouteCard, tried to use `flex-1` + flex sizing
- **Root Cause**: **BlurView requires explicit pixel dimensions to render properly** - it cannot rely on flex sizing alone
- **Solution**: Added back `width` and `height` props to RouteCard, passing them explicitly from RoutesCarousel
- **Status**: ✅ Cards now render with BlurView effect (confirmed by green diagnostic background)
- **Code**: Lines 18-33 in RouteCard.tsx

### 4. Restored Opacity Animation
- **Problem**: Opacity was hardcoded to `1` for debugging cards
- **Solution**: Restored full 7-point opacity interpolation in routesCarouselAnimation.ts
- **Status**: ✅ Cards should now fade in/out based on scroll position

### 5. Fixed TypeScript Imports in routesCarouselAnimation.ts
- **Problem**: `Extrapolation` import was causing type error
- **Solution**: Changed to proper named import: `import { type ExtrapolationType, interpolate } from "react-native-reanimated";`
- **Status**: ✅ TypeScript compilation passes

### 6. Simplified RouteCard Layout Structure (ATTEMPTED)
- **Problem**: Nested flex containers were collapsing, causing severe clipping issues
- **Solution**: Removed nested `View` wrappers, using single-column layout with `gap-1`
- **Attempted**: Removed absolute positioning from terminal name button
- **Status**: ❌ **STILL BROKEN** - layout still severely disrupted

## Issues Still Present

Despite multiple fixes, the carousel is in a **non-functional state**:

### Critical Symptoms
1. **Aspect ratio broken**: Photo placeholder is square instead of 3:4 rectangle
2. **BlurView sizing**: Appears to have incorrect dimensions (possibly calculating wrong area)
3. **Content completely hidden**: Terminal names and destination buttons not rendering at all
4. **Layout collapse**: Flex containers not properly filling allocated space

### What We Know vs What We Don't Know

**Known Facts:**
- AnimatedList is working (scroll, animations, snap behavior confirmed)
- RoutesCarousel data flow is working (placeholder + terminal cards created)
- scroll tracking is working (parallax background updates on swipe/nav)
- BlurView is rendering (green placeholder visible)
- Navigation buttons can trigger scroll

**Unknowns:**
- Why is the photo placeholder square instead of 3:4?
- Why is BlurView not filling the allocated slot properly?
- Why are terminal names and destination buttons completely invisible?
- What is causing the "grey bar" appearance (collapsed Button component)?

## Diagnostic History

This has been a **step-by-step debugging process**:

1. **Initial symptom**: Cards invisible, placeholder visible
2. **Diagnostic 1**: Added green placeholder background → Confirmed placeholder rendering
3. **Diagnostic 2**: Disabled opacity animation (set to 1) → Confirmed not the issue
4. **Diagnostic 3**: Removed BlurView temporarily → Cards still invisible
   - **Conclusion**: BlurView requires explicit dimensions to render
5. **Fix 1**: Restored `width` and `height` props to RouteCard
   - **Result**: Cards visible with BlurView, but layout broken
6. **Diagnostic 4**: Removed `aspect-[3/4]` class
   - **Result**: Still only photo section visible
7. **Fix 2**: Removed absolute positioning from terminal name button
   - **Result**: Terminal name text still not rendering
8. **Attempted Layout Simplification**: Tried removing nested flex containers
   - **Result**: TypeScript error for unclosed JSX tag
9. **Fix 3**: Wrapped terminal name Text in View wrapper
   - **Result**: TypeScript compiles, but layout still broken

## Root Cause Hypotheses

### Hypothesis 1: AnimatedList Item Sizing Issue
The `AnimatedListItem` wrapper sets explicit dimensions via `itemSizeStyle`:
```typescript
// AnimatedList.tsx, lines 48-50
const itemSizeStyle: ViewStyle = isHorizontal
  ? { height: "100%", width: itemSize }
  : { width: "100%", height: itemSize };
```

But this might not be passing through correctly to BlurView, or BlurView might be constraining itself incorrectly.

### Hypothesis 2: Container Collapse
The outer container View with `flex-1 gap-1` might be collapsing instead of filling. The inner BlurView or its child Views might not be getting proper dimensions.

### Hypothesis 3: Aspect Ratio Override
The `aspect-[3/4]` class on the photo placeholder View (line 68) was creating a square. Removing it didn't fix the issue, suggesting:
- The View dimensions aren't what we expect
- The layout calculation in RoutesCarousel might be wrong
- There could be conflicting sizing constraints

### Hypothesis 4: Button Component Collapse
The "grey bar" that appears instead of destination buttons suggests the Button component from `@/components/ui` might have a collapsing issue or might be rendering but not visible due to overflow/opacity.

## Recommended Investigation Steps

### Step 1: Verify AnimatedList Item Sizing
Check if the `AnimatedListItem` wrapper is passing correct dimensions to the BlurView:
- Add console.log in AnimatedListItem to see what itemSizeStyle contains
- Verify itemSize value in RoutesCarousel.tsx
- Check if `itemSizeStyle` is actually being applied to the wrapper

### Step 2: Check BlurView Dimensions
Add diagnostic logging to see what dimensions BlurView is receiving:
- Add `console.log('BlurView width:', width, 'height:', height)` in RouteCard.tsx
- Verify if dimensions match expected itemSize
- Check if BlurView has any internal size calculation that differs

### Step 3: Verify Data Flow
Add console logging to verify data is flowing correctly:
- Log terminalCards array length
- Log carouselData array length
- Log terminalSlug and terminalName for each item in renderItem
- Verify isPlaceholder flag is set correctly

### Step 4: Compare with Working AnimatedList Demo
The AnimatedListDemo.tsx works correctly. Compare:
- Demo card rendering structure vs RouteCard.tsx
- Any differences in how dimensions are handled
- Check if demo has special handling for sizing that RouteCard lacks

### Step 5: Check Button Component
The Button component might be failing to render:
- Check if there are console errors when Button is pressed
- Verify Button's className and variant props
- Check if there's a styling issue making buttons invisible

### Step 6: Temporary Remove all Styling
As an emergency diagnostic, simplify RouteCard to absolute bare minimum:
- Remove all BlurView, borders, spacing classes
- Use simple colored Views for each section: photo, name, destinations
- This will reveal what's actually rendering vs what styling is hiding

## Next Agent Instructions

The current implementation has multiple issues that are **layered and complex**. The next agent should:

1. **Start from scratch with working structure**: 
   - Temporarily revert to Phase 3 implementation (which was working)
   - Or start from AnimatedListDemo structure
   
2. **Add comprehensive console logging**:
   - Every step of the rendering pipeline
   - Every dimension calculation
   - Every data transformation

3. **Test with minimal RouteCard**:
   - Create a test RouteCard that returns simple Views with colored backgrounds
   - See if this fixes all visibility issues

4. **Check AnimatedList implementation**:
   - Verify itemSizeStyle is being applied correctly
   - Check if there are any issues with how dimensions flow to child components

5. **Consider architectural changes**:
   - The adapter approach in Phase 3 was working
   - The consolidation in Phase 4 may have introduced fundamental incompatibilities
   - The new RouteCard API (single data prop) may not be working with the current data flow

## Files to Review

- `src/features/RoutesCarousel/RoutesCarousel.tsx` - Main carousel component
- `src/features/RoutesCarousel/RouteCard.tsx` - Card rendering (HEAVILY MODIFIED)
- `src/features/RoutesCarousel/routesCarouselAnimation.ts` - Animation worklet
- `src/features/AnimatedList/AnimatedList.tsx` - Scroll list implementation
- `src/features/AnimatedList/AnimatedListItem.tsx` - Item wrapper
- `src/features/AnimatedList/hooks/useAnimatedListLayout.ts` - Layout calculations

## Code Style Notes

This codebase follows these patterns:
- TypeScript strict mode
- TSDoc comments on all functions
- Biome formatting
- React 19 with Compiler
- NativeWind for styling

All changes must maintain these standards.

## Urgency Assessment

**This is a critical bug** preventing the user from selecting ferry routes. The refactoring has introduced severe regression. A fresh pair of eyes and systematic debugging approach is needed.

**Estimated effort**: 2-4 hours of focused debugging
**Recommended approach**: Consider rolling back to Phase 3 implementation and incrementally applying changes, rather than attempting to fix the heavily modified Phase 4 code.

---
Generated: 2026-02-27
Agent: Cursor AI Assistant
Context: RoutesCarousel refactoring debug session, Phase 4 catastrophic failure
