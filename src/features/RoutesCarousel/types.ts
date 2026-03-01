/**
 * RoutesCarousel imperative ref type.
 */

import type { AnimatedListRef } from "@/features/AnimatedList";

/**
 * Imperative handle for programmatic carousel navigation.
 *
 * Enables button-based navigation, jumping to specific terminals, and initial positioning.
 * Compatible with AnimatedList's AnimatedListRef type.
 *
 * scrollToIndex() clamps index to valid range and snaps to nearest item.
 * Always use optional chaining: `carouselRef.current?.scrollToIndex(index)`.
 * scrollProgress and scrollIndex provide real-time scroll state for parallax effects.
 */
export type RoutesCarouselRef = AnimatedListRef;
