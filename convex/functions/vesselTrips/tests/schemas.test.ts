import { describe, expect, it } from "bun:test";
import {
  type ConvexVesselTrip,
  toDomainVesselTrip,
  vesselTripMlPayloadSchema,
  vesselTripSchema,
  vesselTripStoredSchema,
} from "../schemas";

const canonicalTimestampFields = [
  "ArriveOriginDockActual",
  "ArriveDestDockActual",
  "DepartOriginActual",
  "StartTime",
  "EndTime",
] as const;

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

  it("exposes canonical timestamp fields as optional on stored trip rows", () => {
    for (const fieldName of canonicalTimestampFields) {
      expect(getFieldOptionality(vesselTripStoredSchema, fieldName)).toBe(
        "optional"
      );
    }
  });

  it("requires TripKey on hydrated trip reads", () => {
    expect(getFieldOptionality(vesselTripSchema, "TripKey")).toBe("required");
  });

  it("exposes canonical timestamp fields on hydrated trip reads", () => {
    for (const fieldName of canonicalTimestampFields) {
      expect(getFieldOptionality(vesselTripSchema, fieldName)).toBe("optional");
    }
  });

  it("requires TripKey on mutation payloads before persistence", () => {
    expect(getFieldOptionality(vesselTripMlPayloadSchema, "TripKey")).toBe(
      "required"
    );
  });

  it("exposes canonical timestamp fields on mutation payloads", () => {
    for (const fieldName of canonicalTimestampFields) {
      expect(getFieldOptionality(vesselTripMlPayloadSchema, fieldName)).toBe(
        "optional"
      );
    }
  });

  it("round-trips canonical timestamp fields to domain Dates", () => {
    const trip = {
      VesselAbbrev: "CAT",
      DepartingTerminalAbbrev: "SDN",
      ArrivingTerminalAbbrev: "VAI",
      RouteAbbrev: "F1",
      TripKey: "CAT--2026-04-14--12:00--SDN-VAI",
      ScheduleKey: "CAT--2026-04-14--12:00--SDN-VAI",
      SailingDay: "2026-04-14",
      PrevTerminalAbbrev: "VAI",
      ArriveOriginDockActual: 1_712_000_000_000,
      ArriveDestDockActual: 1_712_000_600_000,
      DepartOriginActual: 1_712_000_300_000,
      StartTime: 1_712_000_100_000,
      EndTime: 1_712_000_900_000,
      ArriveDest: 1_712_000_600_000,
      AtDockActual: 1_712_000_100_000,
      TripStart: 1_712_000_100_000,
      AtDock: true,
      AtDockDuration: undefined,
      ScheduledDeparture: 1_712_000_050_000,
      LeftDock: 1_712_000_300_000,
      LeftDockActual: 1_712_000_300_000,
      TripDelay: undefined,
      Eta: undefined,
      TripEnd: 1_712_000_900_000,
      AtSeaDuration: undefined,
      TotalDuration: undefined,
      InService: true,
      TimeStamp: 1_712_000_100_000,
      PrevScheduledDeparture: 1_711_999_400_000,
      PrevLeftDock: 1_711_999_700_000,
      NextScheduleKey: undefined,
      NextScheduledDeparture: undefined,
      AtDockDepartCurr: undefined,
      AtDockArriveNext: undefined,
      AtDockDepartNext: undefined,
      AtSeaArriveNext: undefined,
      AtSeaDepartNext: undefined,
    } as ConvexVesselTrip;

    const domainTrip = toDomainVesselTrip(trip);

    expect(domainTrip.ArriveOriginDockActual).toBeInstanceOf(Date);
    expect(domainTrip.ArriveDestDockActual).toBeInstanceOf(Date);
    expect(domainTrip.DepartOriginActual).toBeInstanceOf(Date);
    expect(domainTrip.StartTime).toBeInstanceOf(Date);
    expect(domainTrip.EndTime).toBeInstanceOf(Date);
    expect(domainTrip.ArriveDest).toBeInstanceOf(Date);
    expect(domainTrip.TripStart).toBeInstanceOf(Date);
    expect(domainTrip.TripEnd).toBeInstanceOf(Date);
  });
});
