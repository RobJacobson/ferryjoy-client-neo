/**
 * Style helper for absolutely positioned boxes centered on an anchor point.
 */

import type { DimensionValue, ViewStyle } from "react-native";

type AbsoluteCenteredBoxStyleOptions = {
  width: number;
  height?: number;
  isVertical?: boolean;
};

/**
 * Builds an absolute-positioned box style centered around its top/left anchor.
 *
 * This is useful for timeline dots and indicators that are positioned along an
 * axis using a single anchor coordinate and need half-size offsets applied in
 * both directions.
 *
 * When `isVertical` is provided, the helper also applies the standard timeline
 * start-anchor coordinates: top `0` and left `"50%"` for vertical, or top
 * `"50%"` and left `0` for horizontal.
 *
 * @param options - Box dimensions for the centered absolute box
 * @returns Absolute box style with half-size offsets applied
 */
export const getAbsoluteCenteredBoxStyle = ({
  width,
  height = width,
  isVertical,
}: AbsoluteCenteredBoxStyleOptions): ViewStyle => {
  const axisAnchorStyle:
    | Record<string, never>
    | {
        top: DimensionValue;
        left: DimensionValue;
      } =
    isVertical === undefined
      ? ({} as Record<string, never>)
      : {
          top: isVertical ? 0 : "50%",
          left: isVertical ? "50%" : 0,
        };

  return {
    position: "absolute",
    ...axisAnchorStyle,
    width,
    height,
    marginTop: -height / 2,
    marginLeft: -width / 2,
  };
};
