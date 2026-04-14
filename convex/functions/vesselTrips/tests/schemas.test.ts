import { describe, expect, it } from "bun:test";
import {
  vesselTripMlPayloadSchema,
  vesselTripSchema,
  vesselTripStoredSchema,
} from "../schemas";

/**
 * Read the Convex validator optionality flag for one object field.
 *
 * Convex validators expose a stable `fields` map. We use it here to lock in
 * that `TripKey` is required across the persisted row shape and public write
 * payloads, without depending on mutation execution plumbing in unit tests.
 */
const getFieldOptionality = (
  schema: {
    fields: Record<
      string,
      {
        isOptional?: unknown;
      }
    >;
  },
  fieldName: string
) => schema.fields[fieldName]?.isOptional;

describe("vessel trip schemas", () => {
  it("requires TripKey on stored trip rows", () => {
    expect(getFieldOptionality(vesselTripStoredSchema, "TripKey")).toBe(
      "required"
    );
  });

  it("requires TripKey on hydrated trip reads", () => {
    expect(getFieldOptionality(vesselTripSchema, "TripKey")).toBe("required");
  });

  it("requires TripKey on mutation payloads before persistence", () => {
    expect(getFieldOptionality(vesselTripMlPayloadSchema, "TripKey")).toBe(
      "required"
    );
  });
});
