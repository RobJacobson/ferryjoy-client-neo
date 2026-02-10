import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef } from "react";

import type { MapCameraController } from "@/data/contexts";
import type { CameraState } from "@/features/MapFeatures/MapComponent/shared";
import {
  shouldAnimateFromPreviousPath as defaultShouldAnimateFromPreviousPath,
  type FlyToConfig,
  resolveTargetCamera,
} from "./mapNavigationPolicy";

export type UseMapSlugCameraAnimationParams = {
  /** Imperative controller registered by the platform map implementation. */
  controller: MapCameraController | null;
  /** Current pathname for the focused screen (used to de-dupe scheduling while focused). */
  pathname: string;
  /** Previous pathname captured globally by NavigationHistoryProvider. */
  previousPathname: string | null;
  /** Camera target for the current slug entity (terminal or route). */
  entityCamera: CameraState | null;
  /** The “overview” camera we snap to before flying to the entity target. */
  startCamera: CameraState;
  /** Shared timing / zoom override settings for the fly step. */
  flyTo: FlyToConfig;
  /**
   * Optional override for the “should animate?” policy.
   * Defaults to the current app rule:
   * - animate when prev is null (true deep link)
   * - animate from home
   * - animate within /map stack
   */
  shouldAnimateFromPreviousPath?: (prev: string | null) => boolean;
};

/**
 * Runs the “snap then fly” camera animation when a /map/:slug screen becomes focused.
 *
 * This preserves the existing behavior from src/app/(tabs)/map/[slug].tsx:
 * - Only animate when arriving from Home or within the map stack.
 * - Do not re-run the animation due to rerenders while focused.
 * - On blur, clear any pending timeout and reset guards so back-nav can animate again.
 *
 * Implementation notes:
 * - We use `useFocusEffect` so the logic is tied to React Navigation focus/blur,
 *   not just React render/mount lifecycle.
 * - Guard refs live inside the hook to prevent callsites from duplicating this logic.
 */
export function useMapSlugCameraAnimation({
  controller,
  pathname,
  previousPathname,
  entityCamera,
  startCamera,
  flyTo,
  shouldAnimateFromPreviousPath,
}: UseMapSlugCameraAnimationParams) {
  const lastAnimatedPathRef = useRef<string | null>(null);
  const pendingAnimationPathRef = useRef<string | null>(null);
  const flyToTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shouldAnimate =
    shouldAnimateFromPreviousPath ?? defaultShouldAnimateFromPreviousPath;

  // Cleanup on blur only (so rerenders don't reset guard refs).
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (flyToTimeoutRef.current) {
          clearTimeout(flyToTimeoutRef.current);
          flyToTimeoutRef.current = null;
        }
        pendingAnimationPathRef.current = null;
        lastAnimatedPathRef.current = null;
      };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      if (!controller) return;
      if (!entityCamera) return;
      if (!shouldAnimate(previousPathname)) return;

      if (lastAnimatedPathRef.current === pathname) return;
      if (pendingAnimationPathRef.current === pathname) return;

      const targetCamera: CameraState = resolveTargetCamera(
        entityCamera,
        flyTo
      );

      // Cancel any in-flight scheduled animation (e.g. rerenders while focused)
      if (flyToTimeoutRef.current) {
        clearTimeout(flyToTimeoutRef.current);
        flyToTimeoutRef.current = null;
      }

      // Ensure the user actually sees the transition: snap to an overview first,
      // then animate to the target.
      pendingAnimationPathRef.current = pathname;
      controller.flyTo(startCamera, { durationMs: 0 });
      flyToTimeoutRef.current = setTimeout(() => {
        controller.flyTo(targetCamera, { durationMs: flyTo.durationMs });
        lastAnimatedPathRef.current = pathname;
        pendingAnimationPathRef.current = null;
        flyToTimeoutRef.current = null;
      }, flyTo.delayMs);
    }, [
      controller,
      entityCamera,
      flyTo,
      pathname,
      previousPathname,
      shouldAnimate,
      startCamera,
    ])
  );
}
