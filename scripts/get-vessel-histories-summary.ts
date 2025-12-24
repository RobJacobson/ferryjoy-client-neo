#!/usr/bin/env tsx

import { writeFileSync } from "node:fs";
import {
  fetchVesselBasics,
  fetchVesselHistoriesByVesselAndDates,
} from "ws-dottie/wsf-vessels/core";
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";

/**
 * Get vessel history summary for December 19, 2025
 */
const getVesselHistoriesSummary = async () => {
  console.log("Getting vessel history summary for 2025-12-19");

  // Get all vessels
  const vessels = await fetchVesselBasics();

  console.log(`Found ${vessels.length} vessels`);

  const vesselHistories: VesselHistory[] = [];
  const terminalPairVessels = new Map<string, Set<string>>();

  // Get history for each vessel
  for (const vessel of vessels) {
    console.log(`Getting history for ${vessel.VesselName}`);

    try {
      const historyRecords = await fetchVesselHistoriesByVesselAndDates({
        params: {
          VesselName: vessel.VesselName || "",
          DateStart: "2025-12-19",
          DateEnd: "2025-12-19",
        },
      });

      if (historyRecords && historyRecords.length > 0) {
        vesselHistories.push(...historyRecords);

        // Group by directed terminal pairs (departure -> arrival)
        for (const record of historyRecords) {
          if (record.Departing && record.Arriving && record.Vessel) {
            const directedKey = `${record.Departing} → ${record.Arriving}`;
            const vesselSet = terminalPairVessels.get(directedKey) || new Set();
            vesselSet.add(record.Vessel);
            terminalPairVessels.set(directedKey, vesselSet);
          }
        }
      }
    } catch (error) {
      console.error(`Error getting history for ${vessel.VesselName}:`, error);
    }

    // Small delay to be respectful to the API
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Create summary table
  const summary = Array.from(terminalPairVessels.entries()).map(
    ([pair, vesselSet]) => ({
      terminalPair: pair,
      vessels: Array.from(vesselSet).sort(),
      vesselCount: vesselSet.size,
    })
  );

  summary.sort((a, b) => a.terminalPair.localeCompare(b.terminalPair));

  return {
    date: "2025-12-19",
    totalVessels: vessels.length,
    activeVessels: new Set(vesselHistories.map((h) => h.Vessel)).size,
    totalTrips: vesselHistories.length,
    terminalPairs: summary.length,
    summary,
  };
};

interface SummaryResult {
  date: string;
  totalVessels: number;
  activeVessels: number;
  totalTrips: number;
  terminalPairs: number;
  summary: Array<{
    terminalPair: string;
    vessels: string[];
    vesselCount: number;
  }>;
}

/**
 * Save the summary results to a markdown file
 */
const saveSummaryToMarkdown = (result: SummaryResult): void => {
  const outputPath = "vessel-history-summary-2025-12-19.md";

  let markdown = `# Vessel History Summary for 2025-12-19

## Overview

- **Total vessels in fleet**: ${result.totalVessels}
- **Active vessels on 2025-12-19**: ${result.activeVessels}
- **Total trips recorded**: ${result.totalTrips}
- **Terminal pairs served**: ${result.terminalPairs}

`;

  if (result.summary.length > 0) {
    markdown += "## Route Summary\n\n";

    // Create markdown table
    markdown += "| Route (Departure → Arrival) | Vessel Count | Vessels |\n";
    markdown += "|----------------------------|-------------|---------|\n";

    for (const item of result.summary) {
      const vesselList = item.vessels.join(", ");
      markdown += `| ${item.terminalPair} | ${item.vesselCount} | ${vesselList} |\n`;
    }

    markdown += "\n*Sorted alphabetically by route.*\n";
  } else {
    markdown += "## No Activity\n\nNo vessel activity found for 2025-12-19.\n";
  }

  markdown += `\n---\n*Generated on ${new Date().toISOString()}*`;

  writeFileSync(outputPath, markdown);
  console.log(`\nSummary saved to ${outputPath}`);
};

// Run the script
getVesselHistoriesSummary()
  .then(saveSummaryToMarkdown)
  .catch((error) => {
    console.error("Failed to get vessel history summary:", error);
    process.exit(1);
  });
