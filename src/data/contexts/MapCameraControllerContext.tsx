import type { PropsWithChildren } from "react";
import { createContext, useContext, useRef, useState } from "react";

import type { CameraState } from "@/features/MapComponent/shared";

export type FlyToOptions = {
  durationMs?: number;
};

export type MapCameraController = {
  flyTo: (target: CameraState, options?: FlyToOptions) => void;
};

type MapCameraControllerContextType = {
  controller: MapCameraController | null;
  registerController: (controller: MapCameraController) => () => void;
};

const MapCameraControllerContext = createContext<
  MapCameraControllerContextType | undefined
>(undefined);

export const MapCameraControllerProvider = ({
  children,
}: PropsWithChildren) => {
  const [controller, setController] = useState<MapCameraController | null>(
    null
  );
  const controllerStackRef = useRef<MapCameraController[]>([]);

  const registerController = (next: MapCameraController) => {
    controllerStackRef.current.push(next);
    setController(next);

    return () => {
      const stack = controllerStackRef.current;
      const idx = stack.lastIndexOf(next);
      if (idx >= 0) stack.splice(idx, 1);
      setController(stack[stack.length - 1] ?? null);
    };
  };

  const value = {
    controller,
    registerController,
  };

  return (
    <MapCameraControllerContext value={value}>
      {children}
    </MapCameraControllerContext>
  );
};

export const useMapCameraController = () => {
  const context = useContext(MapCameraControllerContext);
  if (!context) {
    throw new Error(
      "useMapCameraController must be used within MapCameraControllerProvider"
    );
  }
  return context;
};
