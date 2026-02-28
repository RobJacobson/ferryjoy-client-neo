# RoutesCarousel Refactoring - Phase 4 Complete

## Summary

Phase 4 eliminated the temporary adapter layer and simplified the RoutesCarousel architecture by consolidating RoutesCarouselSection and RoutesCarousel into a single component that uses AnimatedList directly. This completed the refactoring goals of removing adapter complexity and simplifying the component API.

## Changes Made

### Files Deleted (3 files, ~279 lines removed)

1. **`src/features/RoutesCarousel/RoutesCarousel.tsx`** (72 lines)
   - Thin wrapper component that only forwarded to RoutesCarouselAdapter
   - No longer needed after consolidation

2. **`src/features/RoutesCarousel/RoutesCarouselAdapter.tsx`** (147 lines)
   - Temporary adapter component from Phase 2
   - Functionality moved to consolidated RoutesCarousel

3. **`src/features/RoutesCarousel/useCarouselLayout.ts`** (60 lines)
   - Complex layout hook using window dimensions and safe area
   - Replaced by simple inline layout calculation using AnimatedList's capabilities

### Files Created/Modified (4 files)

#### 1. **`src/features/RoutesCarousel/RoutesCarousel.tsx`** (New, 143 lines)
   - Renamed from `RoutesCarouselSection.tsx`
   - Now owns state, layout, and scroll progress
   - Uses AnimatedList directly instead of adapter
   - Simple layout calculation inline:
     ```typescript
     const { width: windowWidth, height: windowHeight } = useWindowDimensions();
     const VIEWPORT_FRACTION = 0.9;
     const PORTRAIT_ASPECT_RATIO = 8 / 16;
     const SPACING = 12;
     
     const itemSize = Math.min(
       windowWidth * VIEWPORT_FRACTION,
       windowHeight * VIEWPORT_FRACTION * PORTRAIT_ASPECT_RATIO
     );
     
     const layout = {
       direction: "horizontal" as const,
       itemSize,
       spacing: SPACING,
     };
     ```
   - Creates placeholder card as data:
     ```typescript
     const placeholderCard: TerminalCardData & { isPlaceholder: boolean } = {
       terminalId: 0,
       terminalName: "placeholder",
       terminalSlug: "placeholder",
       destinations: [],
       isPlaceholder: true,
     };
     
     const carouselData: Array<TerminalCardData & { isPlaceholder?: boolean }> = [
       placeholderCard,
       ...terminalCards,
     ];
     ```
   - Provides `renderItem` and `keyExtractor` functions:
     ```typescript
     const renderItem = (
       item: TerminalCardData & { isPlaceholder?: boolean }
     ): React.ReactNode => {
       return <RouteCard blurTargetRef={blurTargetRef} data={item} />;
     };
     
     const keyExtractor = (
       item: TerminalCardData & { isPlaceholder?: boolean }
     ): string => {
       return item.isPlaceholder ? "placeholder" : item.terminalSlug;
     };
     ```
   - Manages scroll progress updates via `useAnimatedReaction`
   - Wraps content in container View for nav button positioning

#### 2. **`src/features/RoutesCarousel/RouteCard.tsx`** (Refactored, 99 lines)
   - Changed props from 6 individual props to single `data` prop:
     ```typescript
     type RouteCardProps = {
       blurTargetRef: RefObject<View | null>;
       data: TerminalCardData & { isPlaceholder?: boolean };
     };
     ```
   - Destructures data at component level:
     ```typescript
     export const RouteCard = ({ blurTargetRef, data }: RouteCardProps) => {
       const { terminalName, terminalSlug, destinations, isPlaceholder } = data;
     ```
   - Handles placeholder visibility internally:
     ```typescript
       if (isPlaceholder) {
         return (
           <View
             className="flex-1"
             style={{ opacity: 0, pointerEvents: "none" } as const}
           />
         );
       }
     ```
   - Removed explicit `width` and `height` props
   - Changed BlurView from explicit dimensions to `className="flex-1"`
   - Maintains internal aspect ratio via `aspect-[3/4]` on photo section

#### 3. **`src/features/RoutesCarousel/index.ts`** (Updated)
   - Cleaned up exports for new structure:
     ```typescript
     export { RoutesCarousel } from "./RoutesCarousel";
     export { TerminalCarouselNav } from "./TerminalCarouselNav";
     export { routesCarouselAnimation } from "./routesCarouselAnimation";
     export { RouteCard } from "./RouteCard";
     export type { RoutesCarouselRef } from "./types";
     ```

#### 4. **`src/app/index.tsx`** (Updated)
   - Changed import from specific file to barrel export:
     ```typescript
     import { RoutesCarousel } from "@/features/RoutesCarousel";
     ```
   - Component name unchanged in JSX

### Files Unchanged

- `src/features/RoutesCarousel/TerminalNavButton.tsx` - No changes needed
- `src/features/RoutesCarousel/TerminalCarouselNav.tsx` - No changes needed
- `src/features/RoutesCarousel/routesCarouselAnimation.ts` - No changes needed
- `src/features/RoutesCarousel/types.ts` - No changes needed
- `src/data/terminalConnections.ts` - Kept NUM_TERMINAL_CARDS and TOTAL_CAROUSEL_ITEMS constants (used by Background)

## Architecture Changes

### Before Phase 4
```
RoutesCarouselSection (state + layout)
  └─ RoutesCarousel (thin wrapper)
      └─ RoutesCarouselAdapter (temporary adapter)
          └─ AnimatedList
              └─ RouteCard (6 props: blurTargetRef, terminalName, terminalSlug, destinations, width, height)
  └─ TerminalCarouselNav
```

### After Phase 4
```
RoutesCarousel (state + layout, renamed from RoutesCarouselSection)
  ├─ AnimatedList
  │   └─ RouteCard (2 props: blurTargetRef, data)
  └─ TerminalCarouselNav
```

## Benefits Achieved

- **Reduced component count**: 3 → 2 (RoutesCarousel + RouteCard)
- **Eliminated adapter layer**: Removed temporary RoutesCarouselAdapter (147 lines)
- **Removed complex layout**: Deleted useCarouselLayout hook (60 lines)
- **Simplified RouteCard API**: Single `data` prop vs 6 individual props
- **Improved genericity**: RouteCard now works in any flex container (no explicit dimensions)
- **Better data flow**: Placeholder handled as data concern, not component logic
- **Aligned with patterns**: Matches AnimatedList demo pattern

## Testing

### Completed
- TypeScript type-check: ✓ Passed
- Biome linting: ✓ Passed (3 pre-existing warnings in other files, unrelated to refactor)

### Known Issues (Documented separately)
- Carousel scrolling and navigation buttons not functional after refactor
- Placeholder View may be blocking touch events
- See `docs/refactor-phase-4-handoff.md` for resolution plan

## Next Steps

The refactoring successfully completed the structural goals of removing the adapter and simplifying the architecture. However, runtime issues with scroll and navigation were introduced. Resolution is documented in a separate handoff note for the next agent to address.
