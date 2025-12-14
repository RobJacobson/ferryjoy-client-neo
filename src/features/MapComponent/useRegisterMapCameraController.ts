import { useEffect } from "react";

import type { MapCameraController } from "@/data/contexts";
import type { CameraState } from "./shared";

type RegisterController = (controller: MapCameraController) => () => void;

type FlyToImpl = (target: CameraState, durationMs: number) => void;

type Params = {
  /** Function provided by MapCameraControllerContext to register the controller. */
  registerController: RegisterController;
  /** Updates the canonical camera state in MapStateContext. */
  updateCameraState: (cameraState: CameraState) => void;
  /** Platform-specific imperative flyTo implementation (MapboxRN vs react-map-gl). */
  flyToImpl: FlyToImpl;
  /** Default fly duration used when the caller omits `options.durationMs`. */
  defaultDurationMs?: number;
};

/**
 * Shared hook to register the cross-platform MapCameraController.
 *
 * This centralizes controller semantics (default duration and syncing the
 * canonical camera state) while letting each platform provide a flyToImpl
 * that performs the imperative map operation.
 *
 * @example
 * ```ts
 * useRegisterMapCameraController({
 *   registerController,
 *   updateCameraState,
 *   flyToImpl: (target, durationMs) => {
 *     mapRef.current?.flyTo({ center: target.centerCoordinate, duration: durationMs });
 *   },
 * });
 * ```
 */
export function useRegisterMapCameraController({
  registerController,
  updateCameraState,
  flyToImpl,
  defaultDurationMs = 800,
}: Params) {
  useEffect(() => {
    const unregister = registerController({
      flyTo: (target, options) => {
        const durationMs = options?.durationMs ?? defaultDurationMs;
        flyToImpl(target, durationMs);

        // Keep canonical camera state in sync with programmatic moves
        updateCameraState(target);
      },
    });

    return () => {
      unregister();
    };
  }, [defaultDurationMs, flyToImpl, registerController, updateCameraState]);
}
