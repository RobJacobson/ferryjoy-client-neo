/**
 * RoutesCarousel imperative ref type.
 */

/**
 * Imperative handle for programmatic carousel navigation.
 *
 * Enables button-based navigation, jumping to specific terminals, and initial positioning.
 * Compatible with AnimatedList's AnimatedListRef type.
 *
 * scrollToIndex() clamps index to valid range and snaps to nearest item.
 * Always use optional chaining: `carouselRef.current?.scrollToIndex(index)`.
 */
export type RoutesCarouselRef = {
  scrollToIndex: (index: number, animated?: boolean) => void;
};
