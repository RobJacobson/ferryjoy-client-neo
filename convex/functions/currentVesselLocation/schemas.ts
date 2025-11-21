import {
  type ConvexVesselLocation,
  vesselLocationValidationSchema,
} from "../vesselLocation/schemas";

// Reuse the same validation schema as vesselLocations
export const currentVesselLocationValidationSchema =
  vesselLocationValidationSchema;

// Export type for use in domain layer (reuses ConvexVesselLocation type)
export type CurrentVesselLocation = ConvexVesselLocation;
