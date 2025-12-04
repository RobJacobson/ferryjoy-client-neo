import { Defs, Line, Pattern, Rect } from "react-native-svg";

// Paper grains configuration constants
const DEFAULT_PATTERN_SIZE = 72;
const DEFAULT_GRAIN_COUNT = 25;
const DEFAULT_MIN_LENGTH = 3;
const DEFAULT_MAX_LENGTH = 10;
const DEFAULT_MAX_ALPHA = 0.08;

// Constant pattern ID (each SVG has its own Defs, so this is safe)
export const PAPER_GRAINS_PATTERN_ID = "paper-grains";

// Generate Line elements once at module scope using default constants
const GRAIN_LINES = (() => {
  const lines = [];
  for (let i = 0; i < DEFAULT_GRAIN_COUNT; i++) {
    const x1 = Math.random() * DEFAULT_PATTERN_SIZE;
    const y1 = Math.random() * DEFAULT_PATTERN_SIZE;
    const length =
      DEFAULT_MIN_LENGTH +
      Math.random() * (DEFAULT_MAX_LENGTH - DEFAULT_MIN_LENGTH);
    const rotation = Math.random() * 360;
    const opacity = 0.02 + Math.random() * (DEFAULT_MAX_ALPHA - 0.02);

    // Calculate end point based on rotation
    const radians = (rotation * Math.PI) / 180;
    const x2 = x1 + Math.cos(radians) * length;
    const y2 = y1 + Math.sin(radians) * length;

    // Random stroke width between 0.5 and 1.5
    const strokeWidth = 0.5 + Math.random() * 1;

    lines.push(
      <Line
        key={`grain-${i}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={`rgba(0,0,0,${opacity})`}
        strokeWidth={strokeWidth}
      />
    );
  }
  return lines;
})();

export const PaperGrains = () => {
  return (
    <Defs>
      {/* Paper grains pattern - works on React Native */}
      <Pattern
        id={PAPER_GRAINS_PATTERN_ID}
        x="0"
        y="0"
        width={DEFAULT_PATTERN_SIZE}
        height={DEFAULT_PATTERN_SIZE}
        patternUnits="userSpaceOnUse"
      >
        <Rect
          width={DEFAULT_PATTERN_SIZE}
          height={DEFAULT_PATTERN_SIZE}
          fill="transparent"
        />
        {/* Pre-generated grain lines for organic paper texture */}
        {GRAIN_LINES}
      </Pattern>
    </Defs>
  );
};
