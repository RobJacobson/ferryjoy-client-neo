# Ferryjoy Client (Neo)

A React Native application for tracking Washington State Ferries with real-time vessel monitoring, ML-powered trip predictions, and live schedule synchronization.

## Technology Stack

- **Frontend**: React Native 0.83.1 with Expo 55
- **Backend**: Convex (serverless functions + database)
- **Language**: TypeScript with strict mode
- **Package Manager**: Bun
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **ML**: Linear regression models for trip duration and delay predictions
- **Map**: Mapbox GL with custom route visualization
- **Linting/Formatting**: Biome

## Quick Start

### Prerequisites

- Node.js (via Bun)
- Convex account
- iOS simulator or Android emulator

### Installation

```bash
bun install
```

### Development

```bash
# Start Convex backend (in one terminal)
bun run convex:dev

# Start Expo development server (in another terminal)
bun start
```

### iOS

```bash
bun run ios
```

### Android

```bash
bun run android
```

### Web

```bash
bun run web
```

## Project Structure

```
ferryjoy-client-neo/
├── src/                      # React Native application
│   ├── components/           # Reusable UI components
│   ├── features/             # Feature-based modules
│   │   ├── TimelineFeatures/  # Timeline UI
│   │   └── VesselMap/        # Map display with animations
│   ├── shared/               # Shared utilities and types
│   └── data/                 # Data hooks and queries
├── convex/                   # Convex backend
│   ├── functions/            # Serverless functions
│   │   ├── vesselTrips/     # Trip management logic
│   │   │   └── updates/      # Real-time trip updates
│   │   ├── vesselLocation/  # Location data processing
│   │   ├── scheduledTrips/  # Schedule synchronization
│   │   └── vesselOrchestrator/  # Main orchestrator
│   ├── domain/              # Business logic
│   │   ├── ml/             # ML prediction pipeline
│   │   └── scheduledTrips/ # Schedule domain logic
│   └── _generated/         # Auto-generated Convex types
├── scripts/                # Utility scripts
│   └── ml/                 # ML training and management
└── docs/                   # Additional documentation
    └── MAP_NAVIGATION_AND_ANIMATION.md
```

## Key Features

### Real-Time Vessel Tracking
- Live vessel position updates every 5 seconds
- Automatic trip detection and boundary management
- At-sea and at-dock status tracking

### ML-Powered Predictions
- **At-dock predictions**: When vessel will arrive at next terminal
- **Departure predictions**: When vessel will depart from current dock
- **Delay predictions**: Expected trip delay based on historical data

### Schedule Integration
- Automatic schedule synchronization
- Trip matching using vessel, route, and scheduled departure
- Real-time delay tracking against scheduled times

### Trip History
- Complete trip duration tracking
- At-sea and at-dock duration metrics
- Prediction actualization for model training

## Development Scripts

### Code Quality

```bash
bun run lint           # Check code with Biome linter
bun run format         # Format code with Biome
bun run check          # Run both lint and format checks
bun run check:fix      # Auto-fix issues
bun run type-check     # TypeScript type checking
```

### Convex Backend

```bash
bun run convex:dev                    # Start Convex dev server
bun run convex:deploy                # Deploy to development
bun run convex:deploy:prod           # Deploy to production
bun run convex:typecheck              # Check Convex types
bun run convex:logs                   # View development logs
bun run convex:logs:prod              # View production logs
```

### ML Training

```bash
bun run ml:train                    # Train prediction models
bun run ml:export-results           # Export training results
bun run ml:compare                  # Compare model versions
bun run ml:audit-outliers            # Audit outlier training data
bun run ml:list-versions             # List available model versions
bun run ml:switch-prod               # Switch production model
```

### Schedule Sync

```bash
bun run sync:scheduled-trips         # Sync all scheduled trips
bun run sync:scheduled-trips:date    # Sync specific date
```

## Architecture Overview

### Vessel Update Pipeline

The vessel orchestrator runs every 5 seconds to process location updates:

1. **Fetch** vessel locations from WSF REST API
2. **Categorize** vessels into completed trips and current trips
3. **Build** complete trip state with enrichments
4. **Compare** to existing state (build-then-compare pattern)
5. **Persist** only when different (efficient database writes)

### Trip Enrichment Pipeline

For each vessel update:

```
buildTrip (orchestrator)
  ├─> baseTripFromLocation (base trip from raw data)
  ├─> appendInitialSchedule (arriving terminal lookup)
  ├─> appendFinalSchedule (schedule lookup by Key)
  ├─> appendArriveDockPredictions (ML: arrive-dock event)
  └─> appendLeaveDockPredictions (ML: depart-dock event)
```

### Event Detection

Trip updates are event-driven:

- **First appearance**: New vessel, no existing trip
- **Trip boundary**: DepartingTerminalAbbrev changes
- **Arrive at dock**: AtDock flips false → true
- **Leave dock**: LeftDock becomes defined
- **Key changed**: Trip schedule identifier changes

Expensive operations (ML predictions, schedule lookups) only run when events occur, not every tick.

## Important Documentation

- **[VesselTrips Updates](convex/functions/vesselTrips/updates/README.md)** - Detailed trip update pipeline documentation
- **[Map Navigation & Animation](docs/MAP_NAVIGATION_AND_ANIMATION.md)** - Map camera and animation architecture
- **[ML Pipeline](convex/domain/ml/README.md)** - ML model training and prediction pipeline
- **[Convex Functions](convex/README.md)** - Convex backend overview

## Testing

```bash
bun test
```

## Deployment

### Deploy to Production

```bash
# Deploy Convex functions
bun run convex:deploy:prod

# Build for iOS (requires EAS setup)
bun run eas:build:ios

# Build for Android (requires EAS setup)
bun run eas:build --platform android --profile production
```

### Environment Variables

Configure these in your Convex dashboard or `.env.local`:

- `WSF_API_KEY` - Washington State Ferries API key
- Additional Convex environment variables as needed

## Contributing

This project uses:
- **TypeScript strict mode** - All code must pass strict type checking
- **Biome** - For consistent formatting and linting
- **TSDoc comments** - All functions must have documented parameters

Before submitting changes:
1. Run `bun run check:fix` to fix linting issues
2. Run `bun run type-check` to verify types
3. Run `bun run convex:typecheck` to verify Convex types

## License

Private - All rights reserved

---

**Need help?** Check the documentation in the `docs/` folder and module-specific READMEs in `convex/` and `src/features/`.
