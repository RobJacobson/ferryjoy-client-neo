import fs from "node:fs";
import path from "node:path";

import type { CameraState } from "@/features/MapComponent/shared";
import { mapProjectionUtils } from "@/shared/utils/mapProjection";
import { wsfRoutesData } from "@/data/routes";
import { terminalLocations } from "@/data/terminalLocations";

type TerminalLocation = {
  TerminalName: string;
  TerminalAbbrev: string;
  Latitude: number;
  Longitude: number;
};

type RouteJson = {
  routeAbbrev: string;
  description: string;
  terminals: string[];
};

const MAP_DIMENSIONS = { width: 375, height: 812 } as const;

const START_CAMERA: CameraState = {
  centerCoordinate: [-122.3321, 47.6062],
  zoomLevel: 6,
  heading: 0,
  pitch: 0,
};

const TERMINAL_DEFAULTS: Omit<CameraState, "centerCoordinate"> = {
  zoomLevel: 10,
  heading: 0,
  pitch: 45,
};

const ROUTE_DEFAULTS: Omit<CameraState, "centerCoordinate"> = {
  zoomLevel: 10,
  heading: 0,
  pitch: 0,
};

const computeRouteCamera = (terminals: TerminalLocation[]): CameraState => {
  const lons = terminals.map((t) => t.Longitude);
  const lats = terminals.map((t) => t.Latitude);

  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const bounds = {
    southwest: [minLon, minLat] as const,
    northeast: [maxLon, maxLat] as const,
  };

  const partial = mapProjectionUtils.fitBounds(bounds, MAP_DIMENSIONS, 60);

  return {
    centerCoordinate:
      partial.centerCoordinate ??
      ([(minLon + maxLon) / 2, (minLat + maxLat) / 2] as const),
    zoomLevel: partial.zoomLevel ?? 8,
    heading: 0,
    pitch: 0,
  };
};

const sortKeys = <T extends Record<string, unknown>>(obj: T): T => {
  const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = obj[k];
  return out as T;
};

const main = () => {
  const terminalsByAbbrev = terminalLocations as Record<
    string,
    TerminalLocation
  >;

  const entities: Record<
    string,
    {
      slug: string;
      kind: "terminal" | "route";
      title: string;
      camera: CameraState;
      terminals?: string[];
    }
  > = {};

  // Terminals
  for (const [abbrev, t] of Object.entries(terminalsByAbbrev)) {
    const slug = abbrev.toLowerCase();
    entities[slug] = {
      slug,
      kind: "terminal",
      title: t.TerminalName,
      camera: {
        centerCoordinate: [t.Longitude, t.Latitude],
        ...TERMINAL_DEFAULTS,
      },
    };
  }

  // Routes
  const routes = Object.values(wsfRoutesData.routes) as RouteJson[];
  for (const r of routes) {
    const slug = r.routeAbbrev;
    const routeTerminals: TerminalLocation[] = r.terminals
      .map((abbrev) => terminalsByAbbrev[abbrev])
      .filter(Boolean);

    const camera =
      routeTerminals.length >= 2
        ? computeRouteCamera(routeTerminals)
        : routeTerminals.length === 1
          ? {
              centerCoordinate: [
                routeTerminals[0].Longitude,
                routeTerminals[0].Latitude,
              ] as const,
              ...ROUTE_DEFAULTS,
            }
          : {
              centerCoordinate: START_CAMERA.centerCoordinate,
              ...ROUTE_DEFAULTS,
            };

    entities[slug] = {
      slug,
      kind: "route",
      title: r.description,
      terminals: r.terminals.map((t) => t.toLowerCase()),
      camera,
    };
  }

  // Add combined carousel route that doesn't exist in routes JSON
  // (Southworth / Vashon / Fauntleroy)
  const combinedSlug = "fau-sou-vai";
  const combinedTerminals = ["FAU", "SOU", "VAI"]
    .map((a) => terminalsByAbbrev[a])
    .filter(Boolean);
  if (combinedTerminals.length) {
    entities[combinedSlug] = {
      slug: combinedSlug,
      kind: "route",
      title: "Southworth / Vashon / Fauntleroy",
      terminals: ["fau", "sou", "vai"],
      camera:
        combinedTerminals.length >= 2
          ? computeRouteCamera(combinedTerminals)
          : {
              centerCoordinate: [
                combinedTerminals[0].Longitude,
                combinedTerminals[0].Latitude,
              ] as const,
              ...ROUTE_DEFAULTS,
            },
    };
  }

  const sorted = sortKeys(entities);

  const outPath = path.join(process.cwd(), "src/data/mapEntities.ts");

  const file = `/* eslint-disable */\n/**\n * GENERATED FILE\n *\n * Single source of truth for map deep links, titles, camera targets,\n * and animation/sheet defaults.\n *\n * Edit this file directly if you want to hand-tune cameras.\n * To regenerate initial values from WSF JSON assets, run:\n *   npx tsx scripts/generateMapEntities.ts\n */\n\nimport type { CameraState } from "@/features/MapComponent/shared";\n\nexport type MapEntityKind = "terminal" | "route";\n\nexport type MapEntity = {\n  slug: string;\n  kind: MapEntityKind;\n  title: string;\n  camera: CameraState;\n  terminals?: readonly string[];\n};\n\nexport const MAP_NAV_CONFIG = {\n  startCamera: ${JSON.stringify(START_CAMERA, null, 2)} as const satisfies CameraState,\n  flyTo: {\n    delayMs: 50,\n    durationMs: 800,\n    // Set to null to respect per-entity camera.zoomLevel\n    targetZoomOverride: 10 as number | null,\n  },\n  bottomSheet: {\n    snapPoints: ["25%", "50%", "85%"] as const,\n    initialIndex: 0 as const,\n  },\n} as const;\n\nexport const MAP_ENTITIES: Record<string, MapEntity> = ${JSON.stringify(sorted, null, 2)};\n\nexport const getMapEntity = (slug: string): MapEntity | null => {\n  const key = slug.toLowerCase();\n  return MAP_ENTITIES[key] ?? MAP_ENTITIES[slug] ?? null;\n};\n`;

  fs.writeFileSync(outPath, file, "utf8");
  console.log(`Wrote ${outPath} with ${Object.keys(sorted).length} entities`);
};

main();
