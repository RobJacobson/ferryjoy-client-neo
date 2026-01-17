#!/usr/bin/env bun

/**
 * Generate Terminal Connections Superset
 *
 * This script fetches terminal connections data from the WSF API for each day
 * over the next 90 days and generates a superset of all possible terminal
 * combinations. This ensures we have all terminal pairs in our static data,
 * even if a connection isn't valid on a particular day.
 *
 * Outputs data as a Record<number, TerminalMate[]> organized by DepartingTerminalID.
 *
 * Usage: bun run scripts/generate-terminal-connections.ts
 */

import { writeFile } from "node:fs/promises";

const API_BASE_URL =
  "https://www.wsdot.wa.gov/ferries/api/schedule/rest/terminalsandmates";
const API_ACCESS_CODE = "9e61c697-3c2f-490e-af96-72d4e8ecbc7e";

type TerminalMate = {
  DepartingTerminalID: number;
  DepartingDescription: string;
  ArrivingTerminalID: number;
  ArrivingDescription: string;
};

/**
 * Format date as YYYY-MM-DD string
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Fetch terminal connections for a specific date
 */
async function fetchTerminalConnections(date: string): Promise<TerminalMate[]> {
  const url = `${API_BASE_URL}/${date}?TripDate=${date}&apiaccesscode=${API_ACCESS_CODE}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    // Check if API returned an error message
    if (data.Message) {
      console.warn(`⚠️  ${date}: ${data.Message}`);
      return [];
    }

    // Check if data is an array
    if (!Array.isArray(data)) {
      console.warn(`⚠️  ${date}: Unexpected response format`);
      return [];
    }

    return data as TerminalMate[];
  } catch (error) {
    console.error(`❌ Error fetching ${date}:`, error);
    return [];
  }
}

/**
 * Generate a unique key for a terminal connection pair
 */
function getConnectionKey(connection: TerminalMate): string {
  return `${connection.DepartingTerminalID},${connection.ArrivingTerminalID}`;
}

/**
 * Main function to generate terminal connections superset
 */
async function main() {
  console.log("🔍 Generating terminal connections superset...\n");

  const today = new Date();
  const uniqueConnections = new Map<string, TerminalMate>();
  let successCount = 0;
  let errorCount = 0;
  let totalConnections = 0;

  // Fetch data for next 90 days
  for (let i = 0; i < 90; i++) {
    const date = addDays(today, i);
    const dateStr = formatDate(date);
    const connections = await fetchTerminalConnections(dateStr);

    if (connections.length > 0) {
      successCount++;
      totalConnections += connections.length;

      // Add all connections to the map (duplicates will be overwritten with same data)
      for (const connection of connections) {
        const key = getConnectionKey(connection);
        uniqueConnections.set(key, connection);
      }

      console.log(
        `✓ ${dateStr}: Found ${connections.length} connections (${uniqueConnections.size} unique total)`
      );
    } else {
      errorCount++;
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Group connections by DepartingTerminalID
  const connectionsByDepartingTerminal: Record<number, TerminalMate[]> = {};

  for (const connection of uniqueConnections.values()) {
    const departingId = connection.DepartingTerminalID;
    if (!connectionsByDepartingTerminal[departingId]) {
      connectionsByDepartingTerminal[departingId] = [];
    }
    connectionsByDepartingTerminal[departingId].push(connection);
  }

  // Sort each array by ArrivingTerminalID
  for (const departingId in connectionsByDepartingTerminal) {
    connectionsByDepartingTerminal[departingId].sort(
      (a, b) => a.ArrivingTerminalID - b.ArrivingTerminalID
    );
  }

  // Get sorted departing terminal IDs
  const departingTerminalIds = Object.keys(connectionsByDepartingTerminal)
    .map(Number)
    .sort((a, b) => a - b);

  const totalUniquePairs = uniqueConnections.size;

  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary:");
  console.log(`  Successfully fetched: ${successCount} days`);
  console.log(`  Failed/invalid: ${errorCount} days`);
  console.log(`  Total connections found: ${totalConnections}`);
  console.log(`  Unique terminal pairs: ${totalUniquePairs}`);
  console.log(`  Departing terminals: ${departingTerminalIds.length}`);
  console.log("=".repeat(60));

  // Generate TypeScript output
  console.log("\n📝 TypeScript constant:\n");
  console.log(
    "export const TERMINAL_CONNECTIONS: Record<number, TerminalMate[]> = {"
  );

  for (const departingId of departingTerminalIds) {
    const connections = connectionsByDepartingTerminal[departingId];
    console.log(`  ${departingId}: [`);

    for (const connection of connections) {
      console.log("    {");
      console.log(
        `      DepartingTerminalID: ${connection.DepartingTerminalID},`
      );
      console.log(
        `      DepartingDescription: "${connection.DepartingDescription}",`
      );
      console.log(
        `      ArrivingTerminalID: ${connection.ArrivingTerminalID},`
      );
      console.log(
        `      ArrivingDescription: "${connection.ArrivingDescription}",`
      );
      console.log("    },");
    }

    console.log("  ],");
  }

  console.log("};");

  // Also write to JSON file for reference
  const jsonOutput = JSON.stringify(connectionsByDepartingTerminal, null, 2);
  await writeFile(
    "scripts/terminal-connections-superset.json",
    jsonOutput,
    "utf-8"
  );
  console.log("\n💾 Also saved to: scripts/terminal-connections-superset.json");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
