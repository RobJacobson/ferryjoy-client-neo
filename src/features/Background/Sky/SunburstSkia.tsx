// ============================================================================
// Sunburst Skia
// ============================================================================
// Skia version of the sunburst effect.
// Renders configurable rays with optional radial gradient and paper texture.
// GPU-accelerated for smooth rotation.
// ============================================================================

import {
  Canvas,
  Group,
  ImageShader,
  Path,
  RadialGradient,
  type SkImage,
  Skia,
  vec,
} from "@shopify/react-native-skia";
import { useMemo } from "react";
import { buildRayPaths, SUNBURST_VIEWBOX_SIZE } from "./Sunburst";

const PAPER_TEXTURE_OPACITY = 0.25;
const DEFAULT_SIZE = SUNBURST_VIEWBOX_SIZE;

export type SunburstSkiaProps = {
  /**
   * Skia Image for the paper texture.
   */
  paperTexture?: SkImage | null;
  /** Number of white rays (gaps = same count). */
  rayCount: number;
  /** Solid fill when gradient not used. */
  color?: string;
  /** Solid fill opacity when gradient not used. */
  opacity?: number;
  /** If set with endColor, use radial gradient center→edge. */
  startColor?: string;
  /** If set with startColor, use radial gradient center→edge. */
  endColor?: string;
  /** Rendered size in px. */
  size?: number;
  /**
   * Spiral curve strength for ray edges (0 = straight, ~0.15 = moderate).
   */
  spiralStrength?: number;
  /** Rotation in degrees. */
  rotation?: number;
};

/**
 * Renders a Skia sunburst: rays as curved triangles from center.
 *
 * @param props - Sunburst properties and optional paper texture
 */
const SunburstSkia = ({
  paperTexture,
  rayCount,
  color = "white",
  opacity = 0.5,
  startColor,
  endColor,
  size = DEFAULT_SIZE,
  spiralStrength = -0.15,
  rotation = 0,
}: SunburstSkiaProps) => {
  const useGradient =
    startColor != null &&
    startColor !== "" &&
    endColor != null &&
    endColor !== "";

  const center = size / 2;
  const radius = size / 2;

  const path = useMemo(() => {
    const strings = buildRayPaths(center, radius, rayCount, spiralStrength);
    return Skia.Path.MakeFromSVGString(strings.join(" "));
  }, [center, radius, rayCount, spiralStrength]);

  const SHADOW_ROTATIONS = [1.5, 1, 0.5];
  const SHADOW_OPACITY = 0.02;

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group
        origin={vec(center, center)}
        transform={[{ rotate: (rotation * Math.PI) / 180 }]}
      >
        {/* Pseudo-drop shadows */}
        {SHADOW_ROTATIONS.map((rot, i) => (
          <Group
            // biome-ignore lint/suspicious/noArrayIndexKey: deterministic
            key={`shadow-group-${i}`}
            origin={vec(center, center)}
            transform={[{ rotate: (rot * Math.PI) / 180 }]}
          >
            <Path path={path as any} color="black" opacity={SHADOW_OPACITY} />
          </Group>
        ))}

        {/* Rays */}
        <Path
          path={path as any}
          color={useGradient ? undefined : color}
          opacity={useGradient ? undefined : opacity}
          strokeWidth={0.5}
          style="fill"
        >
          {useGradient && (
            <RadialGradient
              c={vec(center, center)}
              r={radius}
              colors={[startColor as string, endColor as string]}
            />
          )}
        </Path>

        {/* Strokes */}
        <Path
          path={path as any}
          color="black"
          opacity={0.15}
          strokeWidth={0.5}
          style="stroke"
        />

        {/* Paper texture overlay */}
        {paperTexture && (
          <Path path={path as any} opacity={PAPER_TEXTURE_OPACITY}>
            <ImageShader
              image={paperTexture}
              tx="repeat"
              ty="repeat"
              rect={{ x: 0, y: 0, width: size, height: size }}
            />
          </Path>
        )}
      </Group>
    </Canvas>
  );
};

SunburstSkia.displayName = "SunburstSkia";

export default SunburstSkia;
