import type React from "react";
import { StyleSheet, View } from "react-native";
import Svg, {
  Defs,
  FeBlend,
  FeComposite,
  FeFlood,
  FeGaussianBlur,
  FeOffset,
  Filter,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";
import { PAPER_TEXTURE_PATTERN_ID, PaperTexture } from "./PaperTexture";

export interface WaveProps {
  /**
   * The height (amplitude) of the wave in pixels
   */
  height: number;

  /**
   * The period (wavelength) of the wave - lower values create more frequent waves
   */
  period: number;

  /**
   * The color of the wave. Can be a solid color or a gradient definition
   */
  color: string | WaveGradient;

  /**
   * Width of the wave container (defaults to 100%)
   * Can be a number (pixels) or percentage string like "100%"
   */
  width?: number | `${number}%`;

  /**
   * Border color for the papercraft effect
   */
  borderColor?: string;

  /**
   * Border width in pixels
   */
  borderWidth?: number;

  /**
   * Shadow color for depth effect (include alpha in rgba format)
   */
  shadowColor?: string;

  /**
   * Shadow offset
   */
  shadowOffset?: { x: number; y: number };

  /**
   * Shadow blur radius
   */
  shadowRadius?: number;

  /**
   * Vertical offset from the top of the container
   */
  offsetY?: number;

  /**
   * Phase shift for the wave (0-1, where 1 is a full period)
   */
  phase?: number;
}

export interface WaveGradient {
  type: "linear";
  colors: string[];
  start?: { x: string; y: string };
  end?: { x: string; y: string };
}

export const Wave: React.FC<WaveProps> = ({
  height,
  period,
  color,
  width = "100%",
  borderColor = "rgba(255, 255, 255, 0.35)",
  borderWidth = 1.5,
  shadowColor = "rgba(0, 0, 0, 0.75)",
  shadowOffset = { x: -2, y: 5 },
  shadowRadius = 10,
  offsetY = 0,
  phase = 0,
}) => {
  // Generate SVG viewBox dimensions
  const viewBoxWidth = 800;
  // Extend waves down by 2000px - container overflow will clip
  const viewBoxHeight = 2000;

  // Generate wave path using sine function
  const generateWavePath = () => {
    const points: string[] = [];
    const numPoints = 100;
    const phaseOffset = phase * period * Math.PI * 2;

    for (let i = 0; i <= numPoints; i++) {
      const x = (i / numPoints) * viewBoxWidth;
      const normalizedX = (x / viewBoxWidth) * period;
      const y =
        Math.sin(normalizedX * Math.PI * 2 + phaseOffset) * (height / 2) +
        height / 2 +
        offsetY;

      if (i === 0) {
        points.push(`M ${x} ${y}`);
      } else {
        points.push(`L ${x} ${y}`);
      }
    }

    // Complete the path by drawing to bottom corners and back
    points.push(`L ${viewBoxWidth} ${viewBoxHeight}`);
    points.push(`L 0 ${viewBoxHeight}`);
    points.push("Z");

    return points.join(" ");
  };

  const wavePath = generateWavePath();
  const isGradient = typeof color === "object";
  const gradientId = `wave-gradient-${Math.random().toString(36).slice(2, 9)}`;
  const shadowFilterId = `shadow-filter-${gradientId}`;

  // Determine fill color
  const fillColor = isGradient ? `url(#${gradientId})` : color;

  return (
    <View
      style={[
        styles.container,
        {
          width,
        },
      ]}
    >
      <Svg
        width="100%"
        height={2000}
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="none"
      >
        <Defs>
          <PaperTexture />

          {/* SVG drop shadow filter for web and native */}
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
            <FeFlood floodColor={shadowColor} result="flood" />
            <FeComposite
              in="flood"
              in2="blur"
              operator="in"
              result="coloredBlur"
            />
            <FeBlend in="SourceGraphic" in2="coloredBlur" mode="normal" />
          </Filter>

          {isGradient && (
            <LinearGradient
              id={gradientId}
              x1={(color as WaveGradient).start?.x || "0%"}
              y1={(color as WaveGradient).start?.y || "0%"}
              x2={(color as WaveGradient).end?.x || "0%"}
              y2={(color as WaveGradient).end?.y || "100%"}
            >
              {(color as WaveGradient).colors.map((c, index) => (
                <Stop
                  key={`${gradientId}-${index}-${c}`}
                  offset={`${(index / ((color as WaveGradient).colors.length - 1)) * 100}%`}
                  stopColor={c}
                />
              ))}
            </LinearGradient>
          )}
        </Defs>

        <Path
          d={wavePath}
          fill={fillColor}
          stroke={borderColor}
          strokeWidth={borderWidth}
          filter={`url(#${shadowFilterId})`}
        />

        {/* Overlay texture pattern */}
        <Path
          d={wavePath}
          fill={`url(#${PAPER_TEXTURE_PATTERN_ID})`}
          pointerEvents="none"
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    alignSelf: "stretch",
    overflow: "visible",
  },
});
