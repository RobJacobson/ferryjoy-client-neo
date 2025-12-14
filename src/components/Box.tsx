import { View } from "react-native";
import Svg, { Rect } from "react-native-svg";

export const Box = ({
  width,
  height,
  xOffset,
  yOffset,
  color,
}: {
  width: number;
  height: number;
  xOffset: number;
  yOffset: number;
  color: string;
}) => {
  // Calculate SVG dimensions to accommodate the box at its offset position
  const svgWidth = Math.max(width, xOffset + width);
  const svgHeight = Math.max(height, yOffset + height);

  return (
    <View className="absolute overflow-hidden">
      <Svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      >
        <Rect
          x={xOffset}
          y={yOffset}
          width={width}
          height={height}
          fill={color}
        />
      </Svg>
    </View>
  );
};
