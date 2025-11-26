import { Circle, Defs, Pattern, Rect } from "react-native-svg";

// Paper texture configuration constants
const DEFAULT_PATTERN_SIZE = 96;
const DEFAULT_SPECKLE_COUNT = 100;
const DEFAULT_MAX_SPECKLE_SIZE = 1;
const DEFAULT_MAX_SPECKLE_ALPHA = 0.1;

// Constant pattern ID (each SVG has its own Defs, so this is safe)
export const PAPER_TEXTURE_PATTERN_ID = "paper-texture";

// Generate Circle elements once at module scope using default constants
const SPECKLE_CIRCLES = (() => {
  const circles = [];
  for (let i = 0; i < DEFAULT_SPECKLE_COUNT; i++) {
    const cx = Math.random() * DEFAULT_PATTERN_SIZE;
    const cy = Math.random() * DEFAULT_PATTERN_SIZE;
    const r = 0.4 + Math.random() * (DEFAULT_MAX_SPECKLE_SIZE - 0.4);
    const opacity = 0.05 + Math.random() * (DEFAULT_MAX_SPECKLE_ALPHA - 0.05);

    circles.push(
      <Circle
        key={`speckle-${i}`}
        cx={cx}
        cy={cy}
        r={r}
        fill={`rgba(0,0,0,${opacity})`}
      />
    );
  }
  return circles;
})();

export const PaperTexture = () => {
  return (
    <Defs>
      {/* Paper texture pattern - works on React Native */}
      <Pattern
        id={PAPER_TEXTURE_PATTERN_ID}
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
        {/* Pre-generated speckles for organic paper texture */}
        {SPECKLE_CIRCLES}
      </Pattern>
    </Defs>
  );
};
