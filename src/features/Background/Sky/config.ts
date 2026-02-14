// ============================================================================
// Sky Feature Config
// ============================================================================
// Single source of truth for gradient, sunburst, sun, and paper texture.
// Colors use Tailwind palette. Index for pink: 0=50, 1=100, 2=200, 3=300, 4=400, 5=500.
// ============================================================================

/** Tailwind pink shades 50–500 (index 0–5). */
const pink = [
  "#fdf2f8", // 50
  "#fce7f3", // 100
  "#fbcfe8", // 200
  "#f9a8d4", // 300
  "#f472b6", // 400
  "#ec4899", // 500
] as const;

/** Tailwind orange for sun fill. */
const orange = {
  300: "#fdba74",
} as const;

/** Sky gradient and paper overlay. */
const gradient = {
  start: pink[3],
  end: "white",
} as const;

/** Sunburst layout, rotation, and radial gradient. */
const sunburst = {
  viewBoxSize: 1000,
  defaultSize: 2000,
  rayCount: 16,
  centerX: 25,
  centerY: 20,
  spiralStrength: -0.5,
  rotationDurationMs: 120_000,
  preserveAspectRatio: "xMidYMid slice" as const,
  startColor: pink[3],
  endColor: pink[2],
} as const;

/** Sun disc: layout, shadow, and ray path geometry. */
const sun = {
  innerRadiusPx: 40,
  outerRadiusPx: 50,
  sizePx: 140,
  viewBoxSize: 1000,
  shadowOpacity: 0.04,
  shadowLayers: [
    [-3, 3],
    [-2, 2],
    [-1, 1],
  ] as [number, number][],
  rayGeometry: {
    baseWidthFraction: 1,
    tipWidthFraction: 0.2,
    outerBulgeFraction: 0.2,
  },
} as const;

/** Paper texture opacity for Sky and Sunburst (aligns with Waves). */
const paperTextureOpacity = 0.25;

const config = {
  colors: { pink, orange },
  gradient,
  sunburst,
  sun,
  paperTextureOpacity,
};

export default config;
