/* eslint-disable */
/**
 * GENERATED FILE
 *
 * Single source of truth for map deep links, titles, camera targets,
 * and animation/sheet defaults.
 *
 * Edit this file directly if you want to hand-tune cameras.
 * To regenerate initial values from WSF JSON assets, run:
 *   npx tsx scripts/generateMapEntities.ts
 */

import type { CameraState } from "@/features/MapComponent/shared";

export type MapEntityKind = "terminal" | "route";

export type MapEntity = {
  slug: string;
  kind: MapEntityKind;
  title: string;
  camera: CameraState;
};

export const MAP_NAV_CONFIG = {
  startCamera: {
    centerCoordinate: [-122.3321, 47.6062],
    zoomLevel: 6,
    heading: 0,
    pitch: 60,
  } as const satisfies CameraState,
  flyTo: {
    delayMs: 50,
    durationMs: 10000,
    // Set to null to respect per-entity camera.zoomLevel
    targetZoomOverride: 10 as number | null,
  },
  bottomSheet: {
    snapPoints: ["25%", "50%", "85%"] as const,
    initialIndex: 0 as const,
  },
} as const;

export const MAP_ENTITIES: Record<string, MapEntity> = {
  ana: {
    slug: "ana",
    kind: "terminal",
    title: "Anacortes",
    camera: {
      centerCoordinate: [-122.677, 48.507351],
      zoomLevel: 10,
      heading: 0,
      pitch: 60,
    },
  },
  "ana-sj": {
    slug: "ana-sj",
    kind: "route",
    title: "Anacortes / San Juan Islands",
    camera: {
      centerCoordinate: [-122.84542200000001, 48.55236200276221],
      zoomLevel: 9.056054026382606,
      heading: 0,
      pitch: 60,
    },
  },
  bbi: {
    slug: "bbi",
    kind: "terminal",
    title: "Bainbridge Island",
    camera: {
      centerCoordinate: [-122.509617, 47.622339],
      zoomLevel: 10,
      heading: 0,
      pitch: 60,
    },
  },
  bre: {
    slug: "bre",
    kind: "terminal",
    title: "Bremerton",
    camera: {
      centerCoordinate: [-122.624089, 47.561847],
      zoomLevel: 10,
      heading: 0,
      pitch: 60,
    },
  },
  cli: {
    slug: "cli",
    kind: "terminal",
    title: "Clinton",
    camera: {
      centerCoordinate: [-122.349581, 47.9754],
      zoomLevel: 10,
      heading: 0,
      pitch: 60,
    },
  },
  cou: {
    slug: "cou",
    kind: "terminal",
    title: "Coupeville ",
    camera: {
      centerCoordinate: [-122.672603, 48.159008],
      zoomLevel: 10,
      heading: 0,
      pitch: 60,
    },
  },
  "ed-king": {
    slug: "ed-king",
    kind: "route",
    title: "Edmonds / Kingston",
    camera: {
      centerCoordinate: [-122.43985300000003, 47.80399284797744],
      zoomLevel: 10.68446843162215,
      heading: 0,
      pitch: 60,
    },
  },
  edm: {
    slug: "edm",
    kind: "terminal",
    title: "Edmonds",
    camera: {
      centerCoordinate: [-122.385378, 47.813378],
      zoomLevel: 10,
      heading: 0,
      pitch: 60,
    },
  },
  "f-s": {
    slug: "f-s",
    kind: "route",
    title: "Fauntleroy (West Seattle) / Southworth",
    camera: {
      centerCoordinate: [-122.44622100000001, 47.51813224476199],
      zoomLevel: 10.822022275121626,
      heading: 0,
      pitch: 60,
    },
  },
  "f-v-s": {
    slug: "f-v-s",
    kind: "route",
    title: "Fauntleroy (West Seattle) / Vashon",
    camera: {
      centerCoordinate: [-122.43016949999999, 47.517075357492494],
      zoomLevel: 11.38721572416178,
      heading: 0,
      pitch: 60,
    },
  },
  fau: {
    slug: "fau",
    kind: "terminal",
    title: "Fauntleroy",
    camera: {
      centerCoordinate: [-122.3967, 47.5232],
      zoomLevel: 10,
      heading: 0,
      pitch: 60,
    },
  },
  "fau-sou-vai": {
    slug: "fau-sou-vai",
    kind: "route",
    title: "Southworth / Vashon / Fauntleroy",
    camera: {
      centerCoordinate: [-122.44622100000001, 47.517075357492494],
      zoomLevel: 10.822022275121626,
      heading: 0,
      pitch: 60,
    },
  },
  frh: {
    slug: "frh",
    kind: "terminal",
    title: "Friday Harbor",
    camera: {
      centerCoordinate: [-123.013844, 48.535783],
      zoomLevel: 10,
      heading: 0,
      pitch: 60,
    },
  },
  kin: {
    slug: "kin",
    kind: "terminal",
    title: "Kingston",
    camera: {
      centerCoordinate: [-122.494328, 47.794606],
      zoomLevel: 10,
      heading: 0,
      pitch: 60,
    },
  },
  lop: {
    slug: "lop",
    kind: "terminal",
    title: "Lopez Island",
    camera: {
      centerCoordinate: [-122.882764, 48.570928],
      zoomLevel: 10,
      heading: 0,
      pitch: 60,
    },
  },
  muk: {
    slug: "muk",
    kind: "terminal",
    title: "Mukilteo",
    camera: {
      centerCoordinate: [-122.297, 47.9506],
      zoomLevel: 10,
      heading: 0,
      pitch: 60,
    },
  },
  "muk-cl": {
    slug: "muk-cl",
    kind: "route",
    title: "Mukilteo / Clinton",
    camera: {
      centerCoordinate: [-122.3232905, 47.96300148829611],
      zoomLevel: 11.735521143173061,
      heading: 0,
      pitch: 60,
    },
  },
  ori: {
    slug: "ori",
    kind: "terminal",
    title: "Orcas Island",
    camera: {
      centerCoordinate: [-122.943494, 48.597333],
      zoomLevel: 10,
      heading: 0,
      pitch: 60,
    },
  },
  p52: {
    slug: "p52",
    kind: "terminal",
    title: "Seattle",
    camera: {
      centerCoordinate: [-122.340472, 47.602501],
      zoomLevel: 10,
      heading: 0,
      pitch: 60,
    },
  },
  "pd-tal": {
    slug: "pd-tal",
    kind: "route",
    title: "Pt. Defiance / Tahlequah",
    camera: {
      centerCoordinate: [-122.5109195, 47.31924153139576],
      zoomLevel: 13.662297103396016,
      heading: 0,
      pitch: 60,
    },
  },
  pot: {
    slug: "pot",
    kind: "terminal",
    title: "Port Townsend",
    camera: {
      centerCoordinate: [-122.759039, 48.110847],
      zoomLevel: 10,
      heading: 0,
      pitch: 60,
    },
  },
  "pt-key": {
    slug: "pt-key",
    kind: "route",
    title: "Port Townsend / Coupeville",
    camera: {
      centerCoordinate: [-122.71582099999999, 48.13493314674583],
      zoomLevel: 11.018430412839686,
      heading: 0,
      pitch: 60,
    },
  },
  ptd: {
    slug: "ptd",
    kind: "terminal",
    title: "Point Defiance",
    camera: {
      centerCoordinate: [-122.514053, 47.306519],
      zoomLevel: 10,
      heading: 0,
      pitch: 60,
    },
  },
  "s-v": {
    slug: "s-v",
    kind: "route",
    title: "Southworth / Vashon",
    camera: {
      centerCoordinate: [-122.4796905, 47.512007010644545],
      zoomLevel: 12.447354600602734,
      heading: 0,
      pitch: 60,
    },
  },
  "sea-bi": {
    slug: "sea-bi",
    kind: "route",
    title: "Seattle / Bainbridge Island",
    camera: {
      centerCoordinate: [-122.4250445, 47.61242094067968],
      zoomLevel: 10.049874097008596,
      heading: 0,
      pitch: 60,
    },
  },
  "sea-br": {
    slug: "sea-br",
    kind: "route",
    title: "Seattle / Bremerton",
    camera: {
      centerCoordinate: [-122.48228050000002, 47.58217794631888],
      zoomLevel: 9.304190617781227,
      heading: 0,
      pitch: 60,
    },
  },
  shi: {
    slug: "shi",
    kind: "terminal",
    title: "Shaw Island",
    camera: {
      centerCoordinate: [-122.92965, 48.584792],
      zoomLevel: 10,
      heading: 0,
      pitch: 60,
    },
  },
  sid: {
    slug: "sid",
    kind: "terminal",
    title: "Sidney B.C.",
    camera: {
      centerCoordinate: [-123.396739, 48.643114],
      zoomLevel: 10,
      heading: 0,
      pitch: 60,
    },
  },
  sou: {
    slug: "sou",
    kind: "terminal",
    title: "Southworth",
    camera: {
      centerCoordinate: [-122.495742, 47.513064],
      zoomLevel: 10,
      heading: 0,
      pitch: 60,
    },
  },
  tah: {
    slug: "tah",
    kind: "terminal",
    title: "Tahlequah",
    camera: {
      centerCoordinate: [-122.507786, 47.331961],
      zoomLevel: 10,
      heading: 0,
      pitch: 60,
    },
  },
  vai: {
    slug: "vai",
    kind: "terminal",
    title: "Vashon Island",
    camera: {
      centerCoordinate: [-122.463639, 47.51095],
      zoomLevel: 10,
      heading: 0,
      pitch: 60,
    },
  },
};

export const getMapEntity = (slug: string): MapEntity | null => {
  const key = slug.toLowerCase();
  return MAP_ENTITIES[key] ?? MAP_ENTITIES[slug] ?? null;
};
