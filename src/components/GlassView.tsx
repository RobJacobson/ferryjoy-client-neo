/**
 * GlassView – A reusable component with a semi-transparent glass effect.
 * Encapsulates border, background, and rounding logic for the project's aesthetic.
 * Optional SVG drop shadow (masked to exterior only) via the shadow prop.
 */

import { useCallback, useState } from "react";
import type { LayoutChangeEvent, ViewProps } from "react-native";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, G, Mask, Rect } from "react-native-svg";
import { cn } from "@/shared/utils/cn";

// ============================================================================
// Shadow config (layered offset, masked to exterior – no darkening of glass)
// ============================================================================

const SHADOW_OPACITY = 0.06;
const SHADOW_LAYERS: [number, number][] = [
  [6, 6],
  [4, 4],
  [2, 2],
];
const SHADOW_PADDING = 8;
const DEFAULT_RADIUS = 8;

// ============================================================================
// GlassView
// ============================================================================

export type GlassViewProps = ViewProps & {
  /** Corner radius for shadow (match your rounded-* className). */
  borderRadius?: number;
  /** Enable SVG drop shadow (default false to avoid layout cost). */
  shadow?: boolean;
};

/**
 * Renders a View with a semi-transparent glass effect.
 * Optional shadow: layered SVG rects masked to the exterior only so the
 * glass interior stays clear.
 *
 * @param props - ViewProps plus optional borderRadius and shadow
 */
export const GlassView = ({
  children,
  className,
  style,
  borderRadius = DEFAULT_RADIUS,
  shadow = false,
  onLayout,
  ...props
}: GlassViewProps) => {
  const [layout, setLayout] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      setLayout({ width, height });
      onLayout?.(e);
    },
    [onLayout],
  );

  const w = layout?.width ?? 0;
  const h = layout?.height ?? 0;
  const svgW = w + SHADOW_PADDING;
  const svgH = h + SHADOW_PADDING;
  const maskId = "glass-shadow-mask";

  if (!shadow) {
    return (
      <View
        {...props}
        onLayout={onLayout}
        style={style}
        className={cn("border border-white/40 bg-white/25", className)}
      >
        {children}
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, style]}>
      {layout && w > 0 && h > 0 && (
        <View
          style={[styles.shadowContainer, { width: svgW, height: svgH }]}
          pointerEvents="none"
        >
          <Svg
            width={svgW}
            height={svgH}
            viewBox={`0 0 ${svgW} ${svgH}`}
            style={styles.shadowSvg}
          >
            <Defs>
              <Mask id={maskId}>
                <Rect x={0} y={0} width={svgW} height={svgH} fill="white" />
                <Rect
                  x={0}
                  y={0}
                  width={w}
                  height={h}
                  rx={borderRadius}
                  ry={borderRadius}
                  fill="black"
                />
              </Mask>
            </Defs>
            <G mask={`url(#${maskId})`}>
              {SHADOW_LAYERS.map(([dx, dy]) => (
                <Rect
                  key={`shadow-${dx}-${dy}`}
                  x={dx}
                  y={dy}
                  width={w}
                  height={h}
                  rx={borderRadius}
                  ry={borderRadius}
                  fill="black"
                  fillOpacity={SHADOW_OPACITY}
                />
              ))}
            </G>
          </Svg>
        </View>
      )}
      <View
        {...props}
        onLayout={handleLayout}
        style={[styles.glass, style]}
        className={cn("border border-white/40 bg-black/25", className)}
      >
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    flex: 1,
  },
  glass: {
    flex: 1,
    minHeight: 0,
  },
  shadowContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 0,
  },
  shadowSvg: {
    position: "absolute",
    top: 0,
    left: 0,
  },
});
