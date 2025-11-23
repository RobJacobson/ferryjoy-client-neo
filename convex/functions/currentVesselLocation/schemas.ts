import {
  type ConvexVesselLocation,
  toDomainVesselLocation,
  vesselLocationValidationSchema,
} from "../vesselLocation/schemas";

/**
 * Reuse the same validation schema as vesselLocations
 */
export const currentVesselLocationValidationSchema =
  vesselLocationValidationSchema;

/**
 * Export type for use in domain layer (reuses ConvexVesselLocation type)
 */
export type CurrentVesselLocation = ConvexVesselLocation;

/**
 * Export conversion functions for consistency with other schema files
 */
export { toDomainVesselLocation as toDomainCurrentVesselLocation };
