import { View } from "react-native";
import Svg, {
  Defs,
  FeBlend,
  FeComposite,
  FeFlood,
  FeGaussianBlur,
  FeOffset,
  Filter,
  Path,
} from "react-native-svg";
import { PAPER_GRAINS_PATTERN_ID, PaperGrains } from "./PaperGrains";

const VIEW_BOX_HEIGHT = 2000;

export const Wave = ({
  height,
  width,
  period,
  color,
  offsetX = 0,
  offsetY,
  borderColor = "rgba(255, 255, 255, 0.5)",
  borderWidth = 1,
  shadowColor = "rgba(0, 0, 0, 0.5)",
  shadowOffset = { x: -2, y: 5 },
  shadowRadius = 10,
  showPaperGrains = false,
  showLine = false,
  showShadow = false,
}: {
  height: number;
  width: number;
  period: number;
  color: string;
  offsetX?: number;
  offsetY: number;
  borderColor?: string;
  borderWidth?: number;
  shadowColor?: string;
  shadowOffset?: { x: number; y: number };
  shadowRadius?: number;
  showPaperGrains?: boolean;
  showLine?: boolean;
  showShadow?: boolean;
}) => {
  // Generate wave path using cubic bezier curves to approximate sine wave
  const generateWavePath = () => {
    try {
      const offsetCp = Math.round((period * 0.38) / 2);
      const y1 = 0 + offsetY;
      const y2 = height + offsetY;
      let x1 = 0 - offsetX;
      let x2 = period / 2 - offsetX;
      let x3 = period - offsetX;
      let pathData = `M ${x1} ${y1}`;

      // Add safety check to prevent infinite loops
      let iterations = 0;
      const maxIterations = Math.ceil(width / period) + 10;

      while (x1 < width && iterations < maxIterations) {
        pathData += ` C ${x1 + offsetCp} ${y1} ${x2 - offsetCp} ${y2} ${x2} ${y2}`;
        pathData += ` C ${x2 + offsetCp} ${y2} ${x3 - offsetCp} ${y1} ${x3} ${y1}`;
        x1 += period;
        x2 += period;
        x3 += period;
        iterations++;
      }
      // Complete the path by drawing to bottom corners and back
      pathData += ` L ${x1} ${y1}`;
      pathData += ` L ${x1} ${VIEW_BOX_HEIGHT}`;
      pathData += ` L ${0 - offsetX} ${VIEW_BOX_HEIGHT}`;
      pathData += " Z";
      return pathData;
    } catch (error) {
      // Return a simple fallback path if generation fails
      console.warn("Wave path generation failed:", error);
      return `M 0 ${offsetY} L ${width} ${offsetY} L ${width} ${VIEW_BOX_HEIGHT} L 0 ${VIEW_BOX_HEIGHT} Z`;
    }
  };

  let wavePath: string;
  try {
    wavePath = generateWavePath();
  } catch (error) {
    console.warn("Wave component error:", error);
    // Return empty view if everything fails
    return null;
  }

  // Generate unique filter ID to avoid conflicts on iOS
  const shadowFilterId = `wave-shadow-${offsetY}-${height}-${period}-${width}`;

  try {
    return (
      <View className="absolute overflow-visible" style={{ width: "100%" }}>
        <Svg
          width="100%"
          height={VIEW_BOX_HEIGHT}
          viewBox={`0 0 ${width} ${VIEW_BOX_HEIGHT}`}
          preserveAspectRatio="none"
        >
          <Defs>
            {showPaperGrains && <PaperGrains />}
            {showShadow && (
              <Filter
                id={shadowFilterId}
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
              >
                <FeOffset
                  in="SourceAlpha"
                  dx={shadowOffset.x}
                  dy={shadowOffset.y}
                  result="offset"
                />
                <FeGaussianBlur
                  in="offset"
                  stdDeviation={shadowRadius}
                  result="blur"
                />
                <FeFlood
                  floodColor={shadowColor || "rgba(0, 0, 0, 0.5)"}
                  result="flood"
                />
                <FeComposite
                  in="flood"
                  in2="blur"
                  operator="in"
                  result="coloredBlur"
                />
                <FeBlend in="SourceGraphic" in2="coloredBlur" mode="normal" />
              </Filter>
            )}
          </Defs>
          <Path
            d={wavePath}
            fill={color || "transparent"}
            {...(showLine && {
              stroke: borderColor || "transparent",
              strokeWidth: borderWidth,
            })}
            {...(showShadow && { filter: `url(#${shadowFilterId})` })}
          />
          {showPaperGrains && (
            <Path
              d={wavePath}
              fill={`url(#${PAPER_GRAINS_PATTERN_ID})`}
              pointerEvents="none"
            />
          )}
        </Svg>
      </View>
    );
  } catch (error) {
    console.warn("Wave component rendering error:", error);
    // Return null to fail gracefully without crashing the app
    return null;
  }
};
