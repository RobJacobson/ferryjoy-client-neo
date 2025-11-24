/**
 * Generic ScaledMarker component for map markers
 * Applies scaling and 3D transforms to marker content
 * Children are responsible for visual appearance and styling
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import { useMapState } from "@/shared/contexts";

/**
 * A marker component that applies scaling and 3D transforms to its children.
 *
 * @param children - The visual content of the marker
 * @param scale - The scale factor to apply to the marker
 * @param className - Optional CSS class name for styling
 * @returns A scaled marker component with appropriate transforms applied
 */
export const ScaledMarker = ({
  children,
  scale,
  className,
}: {
  children: ReactNode;
  scale: number;
  className?: string;
}) => {
  const { cameraState } = useMapState();

  return (
    <View
      className={className}
      style={{
        transform: [
          { rotateX: `${cameraState.pitch}deg` },
          { scale },
        ],
      }}
    >
      {children}
    </View>
  );
};
