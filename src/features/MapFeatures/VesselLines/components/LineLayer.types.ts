import type { Feature, LineString } from "geojson";

export interface LineLayerProps {
  /** GeoJSON LineString feature */
  line?: Feature<LineString>;
  /** Whether vessel is in service */
  inService: boolean;
  /** Unique identifier for line source */
  id: string;
  /** RGBA color values for the line [r, g, b, a] */
  rgbaColor: [number, number, number, number];
  /** Source ID for the map */
  sourceId: string;
  /** Layer ID for the map */
  layerId: string;
  /** Line gradient for styling */
  // biome-ignore lint/suspicious/noExplicitAny: Needed for cross-platform compatibility
  lineGradient: any;
  /** Optional gradient for the outer line layer */
  // biome-ignore lint/suspicious/noExplicitAny: Needed for cross-platform compatibility
  outerLineGradient?: any;
  /** Line width for styling */
  lineWidth: number;
  /** Optional width for an outer halo line */
  outerLineWidth?: number;
  /** Optional ID for the outer line layer */
  outerLayerId?: string;
  /** Optional layer that this line should sit below */
  belowLayerId?: string;
}
