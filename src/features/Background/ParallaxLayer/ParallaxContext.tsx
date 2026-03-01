// ============================================================================
// ParallaxContext
// ============================================================================
// Context for scroll-driven parallax. Provides scroll progress (0-1) to
// ParallaxLayer and other consumers without prop drilling.
// ============================================================================

import { createContext, type ReactNode, useContext } from "react";
import type { SharedValue } from "react-native-reanimated";

// ============================================================================
// Context
// ============================================================================

/** Context value: scroll progress SharedValue or null when outside provider. */
export const ParallaxContext = createContext<SharedValue<number> | null>(null);

// ============================================================================
// Provider
// ============================================================================

type ParallaxProviderProps = {
  /** Shared scroll progress (0 = first item, 1 = last item). */
  scrollProgress: SharedValue<number>;
  children: ReactNode;
};

/**
 * Provides scroll progress to ParallaxLayer and other parallax consumers.
 * Wrap Background and the scroll source (e.g. RoutesCarousel) in a parent
 * that creates the SharedValue, passes it here and to the scroll sink.
 *
 * @param scrollProgress - Shared scroll progress (0-1)
 * @param children - Tree containing parallax consumers (e.g. Background)
 */
export const ParallaxProvider = ({
  scrollProgress,
  children,
}: ParallaxProviderProps) => (
  <ParallaxContext.Provider value={scrollProgress}>
    {children}
  </ParallaxContext.Provider>
);

// ============================================================================
// Hook
// ============================================================================

/**
 * Returns scroll progress from ParallaxContext.
 * Returns null when used outside ParallaxProvider.
 *
 * @returns SharedValue scroll progress or null
 */
export const useParallaxContext = (): SharedValue<number> | null =>
  useContext(ParallaxContext);
