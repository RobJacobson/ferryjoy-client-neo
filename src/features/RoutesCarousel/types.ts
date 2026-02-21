/**
 * RoutesCarousel shared types.
 */

/**
 * Imperative handle for programmatic carousel navigation.
 * Allows parent components to scroll to specific indices.
 */
export type RoutesCarouselRef = {
  scrollToIndex: (index: number) => void;
};
