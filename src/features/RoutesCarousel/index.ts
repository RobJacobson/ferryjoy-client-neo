/**
 * RoutesCarousel public exports.
 *
 * Provides terminal carousel component with scroll-driven animations and glassmorphism effects.
 */

/**
 * RoutesCarousel - Primary carousel component with 3D scroll animations.
 *
 * Features:
 * - Scroll-driven animations (rotate, scale, fade)
 * - Glassmorphism blur effects on cards
 * - Navigation buttons with smart visibility
 * - Scroll progress tracking for parallax background
 *
 * ## Integration Requirements
 *
 * **CRITICAL**: Requires BlurTargetView ref for glassmorphism effect.
 *
 * ```typescript
 * const blurTargetRef = useRef<View>(null);
 *
 * return (
 *   <BlurTargetView ref={blurTargetRef}>
 *     <RoutesCarousel blurTargetRef={blurTargetRef} />
 *   </BlurTargetView>
 * );
 * ```
 *
 * ## Component Hierarchy
 *
 * ```
 * RoutesCarousel
 *   ├─→ AnimatedList (scroll management, animations)
 *   │    └─→ RouteCard (individual card rendering)
 *   └─→ TerminalCarouselNav (navigation buttons)
 *        └─→ TerminalNavButton
 * ```
 *
 * See types.ts for RoutesCarouselRef imperative handle documentation.
 */

export { default as RoutesCarousel } from "./RoutesCarousel";
export type { RoutesCarouselRef } from "./types";
