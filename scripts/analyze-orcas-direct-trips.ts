#!/usr/bin/env bun

/**
 * Analyze Direct Trips from Orcas Island (ORI)
 *
 * This script downloads schedule data from the WSF API for Route 9 (San Juan Islands
 * interisland service) and identifies which trips from Orcas Island are direct versus
 * indirect.
 *
 * Direct trips connect consecutive terminals in a vessel's journey (e.g., ORI→SHI).
 * Indirect trips skip intermediate terminals (e.g., ORI→LOP when ORI→SHI→LOP exists).
 *
 * The script identifies direct trips by finding, for each departure time and vessel,
 * the trip with the shortest duration - this is the direct trip to the first terminal
 * in the vessel's journey.
 */

import type { Schedule } from "ws-dottie/wsf-schedule";
import { fetchScheduleByTripDateAndRouteId } from "ws-dottie/wsf-schedule";
import { getSailingDay } from "../src/shared/utils/getSailingDay";

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a trip departing from Orcas Island with metadata for analysis.
 */
interface OrcasTrip {
  /** Vessel ID */
  VesselID: number;
  /** Vessel name */
  VesselName: string;
  /** ISO timestamp of departure */
  DepartingTime: string;
  /** ISO timestamp of arrival */
  ArrivingTime: string;
  /** Terminal ID of the arrival terminal */
  arrivingTerminalID: number;
  /** Name of the arrival terminal */
  arrivingTerminalName: string;
  /** Duration of the trip in minutes */
  durationMinutes: number;
}

/**
 * Summary of direct trips from ORI to a specific terminal.
 */
interface DirectTripSummary {
  /** Terminal ID of the destination */
  arrivingTerminalID: number;
  /** Terminal name of the destination */
  arrivingTerminalName: string;
  /** Number of direct trips to this terminal */
  directTripCount: number;
  /** Number of indirect trips to this terminal */
  indirectTripCount: number;
  /** All departure times for direct trips */
  directDepartureTimes: string[];
}

// ============================================================================
// Configuration
// ============================================================================

const ORCAS_TERMINAL_ID = 15;
const _ORCAS_TERMINAL_NAME = "Orcas Island";
const ROUTE_ID = 9;

/**
 * Date range for analysis. Use a 90-day range to capture comprehensive data
 * across the full schedule period.
 */
const START_DATE = new Date("2026-01-24");
const END_DATE = new Date("2026-04-24");

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate the duration between two timestamps in minutes.
 *
 * @param departure - ISO timestamp of departure
 * @param arrival - ISO timestamp of arrival
 * @returns Duration in minutes
 */
const calculateDuration = (departure: string, arrival: string): number => {
  const departTime = new Date(departure).getTime();
  const arriveTime = new Date(arrival).getTime();
  return Math.round((arriveTime - departTime) / (1000 * 60));
};

/**
 * Format a date as YYYY-MM-DD for WSF API calls.
 *
 * @param date - Date object to format
 * @returns Formatted date string
 */
const formatDateForApi = (date: Date): string => {
  return getSailingDay(date);
};

/**
 * Format a time for display (HH:MM).
 *
 * @param isoTimestamp - ISO timestamp to format
 * @returns Formatted time string
 */
const formatTime = (isoTimestamp: string): string => {
  return new Date(isoTimestamp).toISOString().substring(11, 16);
};

// ============================================================================
// Core Analysis Functions
// ============================================================================

/**
 * Extract all trips departing from Orcas Island from a schedule.
 *
 * @param schedule - Schedule data from WSF API
 * @returns Array of trips departing from ORI with metadata
 */
const extractOrcasTrips = (schedule: Schedule): OrcasTrip[] => {
  const orcasTrips: OrcasTrip[] = [];

  for (const combo of schedule.TerminalCombos) {
    if (combo.DepartingTerminalID === ORCAS_TERMINAL_ID) {
      for (const time of combo.Times) {
        const departTime = String(time.DepartingTime);
        const arriveTime = String(time.ArrivingTime);
        orcasTrips.push({
          VesselID: time.VesselID,
          VesselName: time.VesselName,
          DepartingTime: departTime,
          ArrivingTime: arriveTime,
          arrivingTerminalID: combo.ArrivingTerminalID,
          arrivingTerminalName: combo.ArrivingTerminalName,
          durationMinutes: calculateDuration(departTime, arriveTime),
        });
      }
    }
  }

  return orcasTrips;
};

/**
 * Group trips by vessel, departure date, and departure time.
 * Trips in the same group share the same physical sailing of a vessel.
 *
 * @param trips - Array of ORI trips
 * @returns Map of grouped trips keyed by "vesselID|date|time"
 */
const groupTripsByVesselAndTime = (
  trips: OrcasTrip[]
): Map<string, OrcasTrip[]> => {
  const groups = new Map<string, OrcasTrip[]>();

  for (const trip of trips) {
    const departDate = getSailingDay(new Date(trip.DepartingTime));
    const departTime = new Date(trip.DepartingTime)
      .toISOString()
      .substring(11, 16);
    const key = `${trip.VesselID}|${departDate}|${departTime}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)?.push(trip);
  }

  return groups;
};

/**
 * Identify direct trips by finding the shortest duration trip for each
 * vessel and departure time. This works because the direct trip is always
 * the first leg of a vessel's journey.
 *
 * @param trips - Array of ORI trips
 * @returns Set of trip keys that represent direct trips
 */
const identifyDirectTrips = (trips: OrcasTrip[]): Set<string> => {
  const directTripKeys = new Set<string>();
  const groups = groupTripsByVesselAndTime(trips);

  for (const [_groupKey, groupTrips] of Array.from(groups.entries())) {
    // Sort by duration (ascending) to find the shortest trip
    const sortedTrips = [...groupTrips].sort(
      (a, b) => a.durationMinutes - b.durationMinutes
    );

    // The trip with the shortest duration is the direct trip
    const directTrip = sortedTrips[0];
    const tripKey = `${directTrip.VesselID}|${directTrip.DepartingTime}|${directTrip.arrivingTerminalID}`;

    directTripKeys.add(tripKey);
  }

  return directTripKeys;
};

/**
 * Generate a summary of direct trips from ORI to each destination terminal.
 *
 * @param trips - Array of ORI trips
 * @param directTripKeys - Set of keys identifying direct trips
 * @returns Map of terminal ID to direct trip summary
 */
const generateSummary = (
  trips: OrcasTrip[],
  directTripKeys: Set<string>
): Map<number, DirectTripSummary> => {
  const summary = new Map<number, DirectTripSummary>();

  for (const trip of trips) {
    const tripKey = `${trip.VesselID}|${trip.DepartingTime}|${trip.arrivingTerminalID}`;
    const isDirect = directTripKeys.has(tripKey);

    if (!summary.has(trip.arrivingTerminalID)) {
      summary.set(trip.arrivingTerminalID, {
        arrivingTerminalID: trip.arrivingTerminalID,
        arrivingTerminalName: trip.arrivingTerminalName,
        directTripCount: 0,
        indirectTripCount: 0,
        directDepartureTimes: [],
      });
    }

    const terminalSummary = summary.get(trip.arrivingTerminalID)!;

    if (isDirect) {
      terminalSummary.directTripCount++;
      terminalSummary.directDepartureTimes.push(
        `${getSailingDay(new Date(trip.DepartingTime))} ${formatTime(trip.DepartingTime)}`
      );
    } else {
      terminalSummary.indirectTripCount++;
    }
  }

  return summary;
};

/**
 * Print the analysis results in a human-readable format.
 *
 * @param summary - Map of terminal ID to direct trip summary
 * @param totalTrips - Total number of trips from ORI
 */
const printResults = (
  summary: Map<number, DirectTripSummary>,
  totalTrips: number
): void => {
  console.log("=".repeat(70));
  console.log("Direct Trips Analysis from Orcas Island (ORI)");
  console.log("=".repeat(70));
  console.log(`Route: ${ROUTE_ID} (San Juan Islands interisland service)`);
  console.log(
    `Date Range: ${formatDateForApi(START_DATE)} to ${formatDateForApi(END_DATE)}`
  );
  console.log(`Total trips from ORI: ${totalTrips}`);
  console.log("");

  console.log("Terminal Connections:");
  console.log("-".repeat(70));

  // Sort summaries by terminal name for readability
  const sortedSummaries = Array.from(summary.values()).sort((a, b) =>
    a.arrivingTerminalName.localeCompare(b.arrivingTerminalName)
  );

  for (const item of sortedSummaries) {
    const isDirect = item.directTripCount > 0;
    const status = isDirect ? "✓ DIRECT" : "✗ INDIRECT ONLY";

    console.log(
      `\n${status} - ORI → ${item.arrivingTerminalName} (${item.arrivingTerminalID})`
    );
    console.log(`  Direct trips:   ${item.directTripCount}`);
    console.log(`  Indirect trips: ${item.indirectTripCount}`);

    if (isDirect) {
      console.log(`  Direct departure times:`);
      for (const time of item.directDepartureTimes) {
        console.log(`    - ${time}`);
      }
    }
  }

  console.log("");
  console.log("=".repeat(70));
  console.log("Summary of Direct Terminal Connections:");
  console.log("=".repeat(70));

  const directConnections = sortedSummaries.filter(
    (s) => s.directTripCount > 0
  );
  if (directConnections.length === 0) {
    console.log("No direct terminal connections found from ORI.");
  } else {
    for (const item of directConnections) {
      console.log(
        `- ORI → ${item.arrivingTerminalName}: ${item.directTripCount} direct trips`
      );
    }
  }

  console.log("");
  console.log("=".repeat(70));
  console.log("Indirect-Only Terminal Connections:");
  console.log("=".repeat(70));

  const indirectOnly = sortedSummaries.filter((s) => s.directTripCount === 0);
  if (indirectOnly.length === 0) {
    console.log("No indirect-only terminal connections from ORI.");
  } else {
    for (const item of indirectOnly) {
      console.log(
        `- ORI → ${item.arrivingTerminalName}: 0 direct trips (all ${item.indirectTripCount} are indirect)`
      );
    }
  }
};

// ============================================================================
// Main Execution
// ============================================================================

/**
 * Main function to execute the analysis.
 */
const main = async (): Promise<void> => {
  console.log("Fetching schedule data from WSF API...");
  console.log("");

  const allTrips: OrcasTrip[] = [];

  // Iterate through the date range and fetch schedules
  const currentDate = new Date(START_DATE);
  while (currentDate <= END_DATE) {
    const tripDate = formatDateForApi(currentDate);
    console.log(`Fetching schedule for ${tripDate}...`);

    try {
      const schedule = await fetchScheduleByTripDateAndRouteId({
        params: {
          TripDate: tripDate,
          RouteID: ROUTE_ID,
        },
      });

      const trips = extractOrcasTrips(schedule);
      console.log(`  Found ${trips.length} trips from ORI`);
      allTrips.push(...trips);
    } catch (error) {
      console.error(`  Error fetching schedule for ${tripDate}:`, error);
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log("");
  console.log(`Total trips collected: ${allTrips.length}`);

  if (allTrips.length === 0) {
    console.log("No trips found. Exiting.");
    return;
  }

  // Analyze the trips
  const directTripKeys = identifyDirectTrips(allTrips);
  const summary = generateSummary(allTrips, directTripKeys);

  // Print results
  console.log("");
  printResults(summary, allTrips.length);
};

// Execute the main function
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
