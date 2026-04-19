/**
 * Vessel-location normalization and batch validation for raw WSF feed rows.
 *
 * This module owns the Stage B business transformation from raw transport rows
 * into canonical `ConvexVesselLocation` POJOs. The surrounding functions layer
 * handles fetch, dedupe, and persistence.
 */

import {
  resolveTerminalByAbbrev,
  resolveVessel,
  type TerminalIdentity,
  type VesselIdentity,
} from "adapters";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { dateToEpochMs, optionalDateToEpochMs } from "shared/convertDates";
import { calculateDistanceInMiles } from "shared/distanceUtils";
import { deriveTripIdentity } from "shared/tripIdentity";
import type { VesselLocation as WsfVesselLocation } from "ws-dottie/wsf-vessels/core";

const warnedUnknownMarineLocations = new Set<string>();

/**
 * Maps raw WSF feed rows into canonical vessel-location rows.
 *
 * Rows that fail normalization are skipped individually with a warning so one
 * bad feed row does not poison the full batch.
 *
 * @param rows - Raw vessel-location rows from the WSF transport layer
 * @param vessels - Backend vessel identity rows used for abbreviation lookup
 * @param terminals - Backend terminal identity rows used for normalization
 * @returns Successfully normalized vessel-location rows only
 */
export const mapWsfVesselLocations = (
  rows: ReadonlyArray<WsfVesselLocation>,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): ConvexVesselLocation[] => {
  const locations: ConvexVesselLocation[] = [];

  for (const row of rows) {
    try {
      locations.push(normalizeWsfVesselLocationRow(row, vessels, terminals));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.warn(
        `[vesselLocation] Skipping feed row (VesselID=${row.VesselID}, VesselName=${JSON.stringify(row.VesselName ?? "")}): ${detail}`
      );
    }
  }

  return locations;
};

/**
 * Ensures a non-empty raw batch produced at least one normalized row.
 *
 * @param rawRowCount - Number of rows returned by the transport layer
 * @param locations - Successfully normalized vessel-location rows
 * @returns Nothing when the batch is usable
 * @throws Error when the transport returned rows but every row failed conversion
 */
export const assertUsableVesselLocationBatch = (
  rawRowCount: number,
  locations: ReadonlyArray<ConvexVesselLocation>
): void => {
  if (rawRowCount > 0 && locations.length === 0) {
    throw new Error(
      `All ${rawRowCount} vessel location rows failed conversion; see warnings above.`
    );
  }
};

/**
 * Normalizes one raw WSF vessel-location row into canonical storage shape.
 *
 * @param row - Raw WSF vessel-location row
 * @param vessels - Backend vessel identity rows used for vessel resolution
 * @param terminals - Backend terminal identity rows used for terminal normalization
 * @returns Canonical vessel-location row
 */
const normalizeWsfVesselLocationRow = (
  row: WsfVesselLocation,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): ConvexVesselLocation => {
  const vesselName = (row.VesselName ?? "").trim();
  const rawDepartingTerminalAbbrev = (row.DepartingTerminalAbbrev ?? "").trim();
  const rawDepartingTerminalName = (row.DepartingTerminalName ?? "").trim();
  const rawArrivingTerminalAbbrev =
    row.ArrivingTerminalAbbrev?.trim() ?? undefined;
  const rawArrivingTerminalName = row.ArrivingTerminalName?.trim() ?? undefined;
  const resolvedVessel = resolveVessel(vesselName, vessels);
  const resolvedDepartingTerminal = rawDepartingTerminalAbbrev
    ? resolveTerminalByAbbrev(rawDepartingTerminalAbbrev, terminals)
    : null;
  const resolvedArrivingTerminal = rawArrivingTerminalAbbrev
    ? resolveTerminalByAbbrev(rawArrivingTerminalAbbrev, terminals)
    : null;

  if (!rawDepartingTerminalAbbrev) {
    throw new Error(
      "Missing departing terminal abbreviation in vessel location."
    );
  }

  if (!resolvedDepartingTerminal) {
    warnAboutUnknownMarineLocation("departing", rawDepartingTerminalAbbrev);
  }

  if (rawArrivingTerminalAbbrev && !resolvedArrivingTerminal) {
    warnAboutUnknownMarineLocation("arriving", rawArrivingTerminalAbbrev);
  }

  const departingTerminalAbbrev =
    resolvedDepartingTerminal?.TerminalAbbrev ?? rawDepartingTerminalAbbrev;
  const arrivingTerminalAbbrev =
    resolvedArrivingTerminal?.TerminalAbbrev ?? rawArrivingTerminalAbbrev;
  const departingTerminalName =
    resolvedDepartingTerminal?.TerminalName ?? rawDepartingTerminalName;
  const arrivingTerminalName =
    resolvedArrivingTerminal?.TerminalName ?? rawArrivingTerminalName;
  const scheduledDepartureMs = optionalDateToEpochMs(row.ScheduledDeparture);
  const tripIdentity = deriveTripIdentity({
    vesselAbbrev: resolvedVessel.VesselAbbrev,
    departingTerminalAbbrev,
    arrivingTerminalAbbrev,
    scheduledDepartureMs,
  });

  return {
    VesselID: row.VesselID,
    VesselName: vesselName,
    VesselAbbrev: resolvedVessel.VesselAbbrev,
    DepartingTerminalID: row.DepartingTerminalID,
    DepartingTerminalName: departingTerminalName,
    DepartingTerminalAbbrev: departingTerminalAbbrev,
    ArrivingTerminalID: row.ArrivingTerminalID ?? undefined,
    ArrivingTerminalName: arrivingTerminalName,
    ArrivingTerminalAbbrev: arrivingTerminalAbbrev,
    Latitude: row.Latitude,
    Longitude: row.Longitude,
    Speed: row.Speed,
    Heading: row.Heading,
    InService: row.InService,
    AtDock: row.AtDock,
    LeftDock: optionalDateToEpochMs(row.LeftDock),
    Eta: optionalDateToEpochMs(row.Eta),
    ScheduledDeparture: scheduledDepartureMs,
    RouteAbbrev: row.OpRouteAbbrev?.[0] ?? undefined,
    VesselPositionNum: row.VesselPositionNum ?? undefined,
    TimeStamp: dateToEpochMs(row.TimeStamp),
    ScheduleKey: tripIdentity.ScheduleKey,
    DepartingDistance: getDistanceToTerminal(
      row.Latitude,
      row.Longitude,
      departingTerminalAbbrev,
      terminals
    ),
    ArrivingDistance: getDistanceToTerminal(
      row.Latitude,
      row.Longitude,
      arrivingTerminalAbbrev,
      terminals
    ),
  };
};

/**
 * Measures the vessel's distance from a known terminal when that terminal can
 * be resolved from backend identity data.
 *
 * @param latitude - Vessel latitude in decimal degrees
 * @param longitude - Vessel longitude in decimal degrees
 * @param terminalAbbrev - Terminal abbreviation from the raw feed
 * @param terminals - Backend terminal identity rows used for coordinate lookup
 * @returns Distance in miles, or `undefined` when the terminal cannot be resolved
 */
const getDistanceToTerminal = (
  latitude: number,
  longitude: number,
  terminalAbbrev: string | undefined | null,
  terminals: ReadonlyArray<TerminalIdentity>
): number | undefined => {
  if (!terminalAbbrev) {
    return undefined;
  }

  const terminal = resolveTerminalByAbbrev(terminalAbbrev, terminals) ?? null;

  return calculateDistanceInMiles(
    latitude,
    longitude,
    terminal?.Latitude,
    terminal?.Longitude
  );
};

/**
 * Warns once per role and terminal abbreviation when the raw feed references a
 * marine location missing from backend terminal identity data.
 *
 * @param role - Whether the unresolved terminal is departing or arriving
 * @param terminalAbbrev - Unknown terminal abbreviation from the raw feed
 * @returns Nothing after the one-time warning check completes
 */
const warnAboutUnknownMarineLocation = (
  role: "departing" | "arriving",
  terminalAbbrev: string
): void => {
  const key = `${role}:${terminalAbbrev.toUpperCase()}`;

  if (warnedUnknownMarineLocations.has(key)) {
    return;
  }

  warnedUnknownMarineLocations.add(key);
  console.warn(
    `[vesselLocation] Unknown ${role} marine location in backend terminal lookup: ${terminalAbbrev}`
  );
};
