// ============================================================================
// Wave texture ready context
// ============================================================================
// Shared "texture loaded" state so all wave layers stay hidden (opacity 0) until
// the first SvgImage (paper texture) has loaded. Prevents the flash of colored
// waves before the raster texture appears.
// ============================================================================

import {
  createContext,
  memo,
  type ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

type WaveTextureReadyContextValue = {
  ready: boolean;
  markReady: () => void;
};

const WaveTextureReadyContext =
  createContext<WaveTextureReadyContextValue | null>(null);

/**
 * Returns the wave texture ready state and callback. When no provider is
 * present, returns ready: true so waves render immediately (no gate).
 */
export function useWaveTextureReady(): WaveTextureReadyContextValue {
  const ctx = useContext(WaveTextureReadyContext);
  if (!ctx) {
    return { ready: true, markReady: () => {} };
  }
  return ctx;
}

type WaveTextureReadyProviderProps = { children: ReactNode };

/**
 * Provider that holds "texture ready" state. Children (wave components) call
 * markReady() when their SvgImage onLoad fires; the first call flips ready
 * to true so all waves can show together.
 */
export const WaveTextureReadyProvider = memo(function WaveTextureReadyProvider({
  children,
}: WaveTextureReadyProviderProps) {
  const [ready, setReady] = useState(false);
  const didMark = useRef(false);
  const markReady = useCallback(() => {
    if (didMark.current) return;
    didMark.current = true;
    setReady(true);
  }, []);
  const value: WaveTextureReadyContextValue = { ready, markReady };
  return (
    <WaveTextureReadyContext.Provider value={value}>
      {children}
    </WaveTextureReadyContext.Provider>
  );
});
