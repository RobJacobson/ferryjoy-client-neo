import type { CameraState } from "@/features/MapFeatures/MapComponent/shared";

export type FlyToConfig = {
  /** Delay between snap and fly, in milliseconds. */
  delayMs: number;
  /** Fly animation duration, in milliseconds. */
  durationMs: number;
  /**
   * Optional shared zoom override for all slug navigations.
   * When null/undefined, per-entity `camera.zoomLevel` is used.
   */
  targetZoomOverride?: number | null;
};

/**
 * Default policy for whether we should animate when entering /map/:slug.
 *
 * Current rule:
 * - animate when prev is null (true deep link)
 * - animate from home
 * - animate within /map stack
 */
/**
 * Returns whether the slug screen should animate given the previous pathname.
 *
 * @param prev - The previous pathname (or null for a true deep link / first render)
 */
export function shouldAnimateFromPreviousPath(prev: string | null): boolean {
  if (!prev) return true;
  if (prev === "/" || prev === "/index") return true;
  return prev.includes("/map");
}

/**
 * Resolves the final camera target, applying any shared zoom override.
 */
/**
 * Computes the final target camera, applying any shared zoom override.
 *
 * @param entityCamera - The canonical target camera stored on the map entity
 * @param flyTo - Fly-to settings (currently only uses `targetZoomOverride`)
 */
export function resolveTargetCamera(
  entityCamera: CameraState,
  flyTo: Pick<FlyToConfig, "targetZoomOverride">
): CameraState {
  const targetZoom = flyTo.targetZoomOverride ?? entityCamera.zoomLevel;
  return {
    ...entityCamera,
    zoomLevel: targetZoom,
  };
}
