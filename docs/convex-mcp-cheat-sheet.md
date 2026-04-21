# Convex MCP Cheat Sheet

This project already has Convex wired up, and the Convex MCP server has been installed for Codex on this machine.

Sources:
- https://docs.convex.dev/ai/convex-mcp-server
- https://stack.convex.dev/convex-mcp-server

## Project connection details

Project root:

```text
/Users/rob/code/ferryjoy/ferryjoy-client-neo
```

Deployment config file:

```text
/Users/rob/code/ferryjoy/ferryjoy-client-neo/.env.local
```

Current dev deployment from `.env.local`:

```text
CONVEX_DEPLOYMENT=dev:outstanding-caterpillar-504
EXPO_PUBLIC_CONVEX_URL=https://outstanding-caterpillar-504.convex.cloud
EXPO_PUBLIC_CONVEX_SITE_URL=https://outstanding-caterpillar-504.convex.site
```

Installed Codex MCP config:

```toml
[mcp_servers.convex]
command = "npx"
args = [
  "-y",
  "convex@latest",
  "mcp",
  "start",
  "--project-dir",
  "/Users/rob/code/ferryjoy/ferryjoy-client-neo",
  "--env-file",
  "/Users/rob/code/ferryjoy/ferryjoy-client-neo/.env.local"
]
```

That entry lives in:

```text
~/.codex/config.toml
```

## Credentials and auth

No new project-specific credential was needed during setup because this machine already had Convex CLI auth available.

What an agent should assume:

- The MCP server uses the local Convex CLI auth on the current machine.
- If tool calls fail with an authorization error, run a Convex login flow such as `bunx convex auth` or `npx convex dev`.
- Access to the Convex project is tied to a Convex account with permission on the `ferryjoy-client` project.
- Network access is required for real calls to Convex Cloud.

Local clue that auth already exists on this machine:

```text
~/.convex/config.json
```

## Exact command to start the server

For this repo:

```bash
npx -y convex@latest mcp start \
  --project-dir /Users/rob/code/ferryjoy/ferryjoy-client-neo \
  --env-file /Users/rob/code/ferryjoy/ferryjoy-client-neo/.env.local
```

Equivalent local package command also works:

```bash
npx convex mcp start \
  --project-dir /Users/rob/code/ferryjoy/ferryjoy-client-neo \
  --env-file /Users/rob/code/ferryjoy/ferryjoy-client-neo/.env.local
```

## Recommended agent workflow

When using the Convex MCP server, follow this order:

1. Call `status` first.
2. Read the returned `availableDeployments`.
3. Pick the `ownDev` deployment unless you explicitly need production.
4. Pass that `deploymentSelector` to later tools such as `tables`, `data`, `functionSpec`, `logs`, `run`, and `insights`.

For this project, `status` returned:

- `ownDev` at `https://outstanding-caterpillar-504.convex.cloud`
- `prod` at `https://compassionate-moose-340.convex.cloud`

Production note:

- Production was exposed as read-only in testing.
- Convex documents this as a safety feature.
- Production access requires explicit enablement flags, and mutating production is intentionally gated.

## Tools confirmed in this project

The MCP server advertised these tools during testing:

- `status`
- `data`
- `tables`
- `functionSpec`
- `run`
- `envList`
- `envGet`
- `envSet`
- `envRemove`
- `runOneoffQuery`
- `logs`
- `insights`

## Important behavior notes

- `status` returns `availableDeployments`, not a single top-level deployment selector.
- `data` requires an explicit `order` argument. Use `"asc"` or `"desc"`.
- `data` also accepts `limit` and optional `cursor`.
- In this installed environment, the Convex MCP stdio transport behaved as newline-delimited JSON over stdio.
- If Codex does not see a newly added MCP server immediately, opening a new thread or restarting the app may be required.

## Safe defaults for agents

Use these defaults unless the task clearly calls for something else:

- Deployment: dev / `ownDev`
- Data read order: `"desc"`
- Limit: `3` to `25` for exploratory reads
- Start with `tables` before `data`
- Prefer `functionSpec` before `run`
- Avoid production writes

## Example read flow

### 1. Get deployment selector

Call:

```json
{
  "name": "status",
  "arguments": {}
}
```

Look for:

```json
{
  "availableDeployments": [
    {
      "kind": "ownDev",
      "deploymentSelector": "ownDev:..."
    }
  ]
}
```

### 2. List tables

Call:

```json
{
  "name": "tables",
  "arguments": {
    "deploymentSelector": "ownDev:..."
  }
}
```

### 3. Read sample data

Call:

```json
{
  "name": "data",
  "arguments": {
    "deploymentSelector": "ownDev:...",
    "tableName": "terminalsIdentity",
    "order": "desc",
    "limit": 3
  }
}
```

## Tables observed during testing

- `activeVesselTrips`
- `completedVesselTrips`
- `eventsActual`
- `eventsPredicted`
- `eventsScheduled`
- `keyValueStore`
- `modelParameters`
- `scheduledTrips`
- `terminalsIdentity`
- `terminalsTopology`
- `vesselLocations`
- `vesselLocationsHistoric`
- `vesselPing`
- `vesselPings`
- `vesselsIdentity`

`keyValueStore` note: active ML production tag is stored as
`{ key: "productionVersionTag", value: "2026-03-04-prod" }`.

## Sample data observed during testing

### `terminalsIdentity`

```json
[
  {
    "TerminalAbbrev": "VIG",
    "TerminalName": "Vigor Shipyard",
    "TerminalID": -1002,
    "IsPassengerTerminal": false,
    "Latitude": 47.5845,
    "Longitude": -122.3579
  },
  {
    "TerminalAbbrev": "EAH",
    "TerminalName": "Eagle Harbor Maintenance Facility",
    "TerminalID": -1001,
    "IsPassengerTerminal": false,
    "Latitude": 47.62,
    "Longitude": -122.5153
  }
]
```

### `vesselsIdentity`

```json
[
  {
    "VesselAbbrev": "YAK",
    "VesselName": "Yakima",
    "VesselID": 38
  },
  {
    "VesselAbbrev": "WEN",
    "VesselName": "Wenatchee",
    "VesselID": 37
  }
]
```

### `activeVesselTrips`

```json
[
  {
    "VesselAbbrev": "SUQ",
    "DepartingTerminalAbbrev": "EAH",
    "AtDock": true,
    "InService": false,
    "TimeStamp": 1774743962000
  },
  {
    "VesselAbbrev": "CHM",
    "DepartingTerminalAbbrev": "EAH",
    "AtDock": true,
    "InService": false,
    "TimeStamp": 1774743964000
  }
]
```

## Key points from the Convex docs

From the official docs:

- Setup is a single MCP server command: `npx -y convex@latest mcp start`.
- You can scope the server to one repo with `--project-dir`.
- You can control deployment selection with flags such as `--prod`, `--preview-name`, `--deployment-name`, and `--env-file`.
- Production access is blocked by default as a safety measure.
- There is a separate explicit flag for enabling production deployments.
- You can disable specific tools with `--disable-tools`.
- Core tool categories are deployment inspection, tables/data access, function inspection/execution, insights, logs, and environment variable management.

## Key points from the Convex blog post

From the Stack post:

- Convex added an MCP server directly into the Convex CLI.
- The intended workflow is for the agent to call `status` once, get an opaque deployment selector, and reuse that selector for future tool calls.
- `tables`, `data`, `functionSpec`, and `run` are the main agent-facing building blocks.
- `runOneoffQuery` is designed to support read-only ad hoc JavaScript queries against deployment data.
- Convex chose a global MCP server model for broad compatibility across tools, even though project-scoped configuration is often nicer when available.
- The team emphasized simple stdio transport and tool-only exposure because MCP client support is still uneven.

## Short instructions for future agents

If you need to use Convex MCP in this repo:

1. Assume the server name is `convex`.
2. Target the repo at `/Users/rob/code/ferryjoy/ferryjoy-client-neo`.
3. Use `.env.local` for deployment selection.
4. Call `status` first and use the dev deployment selector.
5. Pass `order: "desc"` when using `data`.
6. Expect network access to be necessary for real Convex Cloud reads.
7. Do not enable production mutation access unless the user explicitly asks for it.
