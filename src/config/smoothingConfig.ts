export const smoothingConfig = {
  // Method to use: 'd3-basis' | 'd3-cardinal' | 'd3-catmullRom' | 'turf-bezier'
  method: "d3-catmulRom",

  // D3-specific parameters
  tension: 0.5, // Controls tension of the curve (0-1)

  // Turf bezier parameters (fallback)
  resolution: 20000,
  sharpness: 0.95,

  // Performance settings
  maxPoints: 50,

  // Data filtering
  minAgeSeconds: 30,
};
