import type { Infer } from "convex/values";
import { vesselLocationValidationSchema } from "../vesselLocation/schemas";

// Reuse the same validation schema as vesselLocations
export const currentVesselLocationValidationSchema =
  vesselLocationValidationSchema;

// Export inferred types for use in domain layer
export type CurrentVesselLocation = Infer<
  typeof currentVesselLocationValidationSchema
>;
