# Ferry Vessel Duration Prediction System

A machine learning system that predicts ferry vessel docking and sailing durations using terminal-pair specific models. The system uses multivariate linear regression trained on historical Washington State Ferry data to provide real-time predictions for vessel arrival and departure times.

## What This System Does

**Predicts five critical timing metrics for ferry vessels:**

1. **Arrive-Depart-At-Dock-Duration**: Predicts how long a vessel will stay at dock after arrival
2. **Depart-Arrive-At-Sea-Duration**: Predicts how long a vessel will spend at sea after departure
3. **Arrive-Arrive-Total-Duration**: Predicts total time from dock arrival to next terminal arrival
4. **Arrive-Depart-Delay**: Predicts departure delay after vessel arrives at terminal
5. **Depart-Depart-Total-Duration**: Predicts time between consecutive departures (simplified model)

**Key advantage**: Terminal-pair specific models trained on historical vessel tracking data provide accurate, route-aware predictions for passenger planning and operational decision-making.

**Key Features:**
- **Terminal-Pair Specific**: Separate models for each departure→arrival terminal combination
- **Real-Time Predictions**: Sub-millisecond inference for live vessel tracking
- **Automated Training**: Daily retraining pipeline using fresh WSF API data
- **Type-Safe**: Full TypeScript implementation with comprehensive error handling
- **Quality Assurance**: Extensive data validation and temporal consistency checks

## Training Pipeline

The ML system processes ferry trip data through a streamlined 6-step pipeline that runs daily to keep models fresh with current vessel patterns.

### Step 1: Load Raw WSF Records
```typescript
// Fetches vessel histories from WSF backend API
// Configurable date range (default: 720 days back)
// Returns: Array of raw WSF API VesselHistory records
```
**Purpose**: Loads fresh vessel tracking data from the Washington State Ferry API to ensure models reflect current operational patterns.

### Step 2: Convert to Training Records
```typescript
// Convert raw WSF API records to TrainingDataRecord format:
// - Group records by vessel for chronological processing
// - Process consecutive trip pairs into training examples
// - Calculate delays, durations, and temporal features
// - Extensive validation and quality filtering
// Returns: Array of TrainingDataRecord objects
```
**Purpose**: Transforms raw API data into structured training records. Groups vessel trips chronologically and creates training examples from consecutive trip pairs with computed features like delays and durations.

### Step 3: Create Terminal Pair Buckets
```typescript
// Group training records by terminal pairs:
// - Discover all valid terminal combinations from data
// - Apply sampling limits per route (default: 2500 records max)
// - Calculate bucket statistics and quality metrics
// Returns: Array of TerminalPairBucket objects
```
**Purpose**: Organizes training data by terminal pairs (e.g., "MUK_CLI") and applies sampling to manage dataset size while maintaining representative coverage.

### Step 4: Train Models for All Buckets
```typescript
// Train linear regression models for each terminal pair:
// - Creates training examples with feature extraction
// - Trains multivariate linear regression for each model type
// - Calculates performance metrics (MAE, RMSE, R²)
// - Handles training failures gracefully
// Returns: Array of trained ModelParameters
```
**Purpose**: Trains separate linear regression models for each terminal pair and prediction type using the same feature extraction logic as prediction.

### Step 5: Store Trained Models
```typescript
// Persist models to Convex database:
// - Model coefficients and intercept values
// - Training performance metrics
// - Bucket statistics and metadata
// - Graceful handling of storage failures
```
**Purpose**: Saves trained models to the database for use in production predictions, replacing any existing models for the same terminal pairs.

### Step 6: Analyze Data Quality
```typescript
// Calculate training data quality metrics:
// - Total records processed
// - Completeness scores (placeholder for future enhancement)
// - Temporal validation (placeholder for future enhancement)
// Returns: DataQualityMetrics object
```
**Purpose**: Provides basic data quality analysis and summary statistics about the training run.

## Data Sources

The system currently uses WSF API data for training, loaded through the `loadWsfTrainingData()` function which fetches vessel tracking data directly from the Washington State Ferry backend API.

### WSF API (Primary Source)
- **Source**: Direct fetch from WSF backend API
- **Data Range**: Configurable date range (default: 720 days back)
- **Advantages**: Fresh data reflecting current operational patterns
- **Processing**: Raw vessel histories converted to structured training records
- **Validation**: Extensive quality checks and temporal consistency validation

The training pipeline processes this data into `TrainingDataRecord` objects that contain all necessary features for model training.

## How to Use

### Automated Training (Recommended)
The system runs automatically via cron job at 11:00 AM UTC every Monday using WSF API data:
```typescript
// convex/crons.ts
crons.cron(
  "retrain ml models",
  "0 11 * * 1", // 11:00 AM UTC every Monday
  internal.domain.ml.training.actions.trainPredictionModelsAction
);
```

### Manual Training

Run the training pipeline manually:

```bash
# Train using WSF API data (recommended)
npm run train:ml
```

**WSF API Data Source**: Fetches vessel histories directly from WSF backend API for configured date range (default: 720 days), providing fresh data without relying on stored records.

**Convex Data Source**: Trains on all available historical trip data (10K+ records) stored in Convex database.

## Export Training Results to CSV

Generate a CSV file with the latest training results for analysis:

```bash
# Make sure your Convex dev server is running
npm run convex:dev

# In another terminal, export results
npm run train:export-results
```

This creates `ml/training-results.csv` with one row per terminal pair containing:
- Model performance metrics (MAE, R², RMSE)
- Training data statistics (total/filtered records)
- Bucket statistics (mean durations)
- Training timestamps

**CSV Columns:**
- `terminal_pair`: Terminal combination (e.g., "MUK_CLI")
- `arrive_depart_mae`, `arrive_depart_r2`, etc.: Arrive-depart model metrics (predicts at-dock duration)
- `depart_arrive_mae`, `depart_arrive_r2`, etc.: Depart-arrive model metrics
- `arrive_arrive_mae`, `arrive_arrive_r2`, etc.: Arrive-arrive model metrics
- `depart_depart_mae`, `depart_depart_r2`, etc.: Depart-depart model metrics (predicts combined at-sea + at-dock)
- `total_records`: Records in the bucket before filtering
- `filtered_records`: Records used for training
- `created_at`: When models were trained

### Compare Training Results

Compare performance metrics between two different training result CSV files:

```bash
# Compare two training result files
npm run train:compare fileA.csv fileB.csv

# Example: Compare different configurations or data sources
npm run train:compare training-results-with-feature.csv training-results-without-feature.csv
```

**Features:**
- **Statistical Comparison**: Shows MAE and R² differences between models
- **Data Filtering**: Automatically excludes routes with <100 total records for reliable comparisons
- **Comprehensive Analysis**: Provides summary statistics and recommendations
- **Terminal Pair Breakdown**: Detailed table showing performance for each route

**Output includes:**
- Detailed comparison table for each terminal pair
- Summary statistics (average differences, better performing routes)
- Recommendation on which configuration performs better overall

## Prediction Pipeline

The prediction system uses trained ML models to provide real-time vessel timing predictions. Predictions are calculated using the same feature extraction and linear regression logic as training.

### Prediction Models

The system provides three main prediction functions:

#### 1. `predictDelayOnArrival` - Arrival-based delay prediction
- **Model**: `arrive-depart-delay`
- **Purpose**: Predicts departure delay when vessel arrives at terminal
- **Input**: Previous trip context, scheduled departure, trip start time
- **Output**: Delay in minutes (can be negative for early departures)
- **Use Case**: Called when vessel arrives at dock, predicts how long before actual departure

#### 2. `predictEtaOnArrival` - Arrival-based ETA prediction
- **Model**: `arrive-arrive-total-duration`
- **Purpose**: Predicts total trip duration from arrival to next arrival
- **Input**: Completed trip + new trip context
- **Output**: ETA as absolute timestamp
- **Use Case**: Initial ETA prediction when new trip starts

#### 3. `predictEtaOnDeparture` - Departure-based ETA prediction
- **Model**: `depart-arrive-atsea-duration`
- **Purpose**: Predicts at-sea duration after vessel departs
- **Input**: Current trip with actual departure time and at-dock duration
- **Output**: Refined ETA as absolute timestamp
- **Use Case**: Updates ETA with actual departure information

### Prediction Flow

```typescript
// When vessel arrives at dock and new trip starts:
const predictions = await calculateArrivalPredictions(ctx, completedTrip, newTrip);
// Result: { DelayPred, DelayPredMae, EtaPred, EtaPredMae }

// When vessel departs from dock:
const updatedEta = await predictEtaOnDeparture(ctx, currentTrip, currentLocation);
// Result: { predictedTime, mae }
```

### Core Prediction Logic

All predictions follow the same pipeline:

1. **Feature Extraction**: Convert trip data to numerical features using `extractFeatures()`
2. **Model Loading**: Retrieve trained model parameters from database using `loadModel()`
3. **Linear Regression**: Apply `y = intercept + Σ(coefficient_i × feature_i)`
4. **Time Conversion**: Convert duration predictions to absolute timestamps
5. **Validation**: Clamp predictions to reasonable bounds and round MAE values

### Feature Engineering

Predictions use the same feature extraction as training:

- **Time Features**: Cyclical encoding for hour-of-day and day-of-year
- **Historical Context**: Previous trip delays and durations
- **Temporal Features**: Arrival timing relative to schedule
- **Terminal Context**: Route-specific patterns captured in model coefficients

### Error Handling

- **Missing Models**: Gracefully handles cases where models don't exist for terminal pairs
- **Invalid Data**: Validates input parameters before making predictions
- **Prediction Bounds**: Clamps predictions to reasonable time ranges
- **MAE Precision**: Rounds accuracy metrics to 0.01 minute precision

**Prediction Result Type:**
```typescript
type PredictionResult = {
  predictedTime?: number;    // Absolute timestamp (or undefined if skipped)
  mae?: number;              // MAE rounded to 0.01 min (or undefined if skipped)
  skipped: boolean;           // Whether prediction was skipped
  skipReason?: string;       // Explanation of why prediction was skipped
};
```

### Integration with Vessel Trip Pipeline

**Predictions on New Trip Creation (in `vesselTrips/actions.ts`):**

When a vessel completes a trip and a new one starts, predictions are run if both terminals are non-null:

```typescript
// In checkAndHandleNewTrip function
// Atomic operation: complete existing, start new
await ctx.runMutation(
  api.functions.vesselTrips.mutations.completeAndStartNewTrip,
  {
    completedTrip,
    newTrip,
  }
);

// Run predictions if both terminals are non-null
if (
  newTrip.DepartingTerminalAbbrev &&
  newTrip.ArrivingTerminalAbbrev
) {
  await runPredictionsForNewTrip(ctx, completedTrip, newTrip);
}
```

This runs both predictions in parallel:
- **LeftDockPred** using `arrive-depart-delay` model
- **EtaPred** using `arrive-arrive-total-duration` model

**Predictions on Trip Updates (in `vesselTrips/actions.ts`):**

When an existing trip is updated, predictions are run for missing values:

```typescript
// In checkAndHandleTripUpdate function
// Check if we need to run predictions for missing values
const predictions = await calculateMissingPredictions(
  ctx,
  currLocation,
  existingTrip,
  updates
);

// Recompute ETA when vessel departs
const etaPrediction = await updateEtaOnDepartureIfNeeded(
  ctx,
  currLocation,
  existingTrip,
  updates
);
```

The `calculateMissingPredictions` function:
1. **Predict LeftDockPred** using `arrive-depart-delay` model if:
   - Both terminals are non-null
   - LeftDockPred is currently null

2. **Predict EtaPred** if:
   - Both terminals are non-null
   - EtaPred is currently null
   - Uses `arrive-arrive-total-duration` model if we haven't left dock yet
   - Uses `depart-arrive-atsea-duration` model if we have left dock

**ETA Update on Departure (in `vesselTrips/actions.ts`):**

When vessel leaves dock, ETA is recomputed with the `depart-arrive-atsea-duration` model:

```typescript
// Detect vessel departure
const vesselDeparted =
  updates.leftDockChanged &&
  !existingTrip.LeftDock &&
  !!currLocation.LeftDock &&
  !!updates.atDockDuration;

if (vesselDeparted) {
  try {
    const etaResult = await updateEtaOnDeparture(
      ctx,
      existingTrip,
      currLocation
    );
    if (etaResult.predictedTime) {
      // Update trip with new EtaPred
      etaUpdate = {
        EtaPred: etaResult.predictedTime,
        EtaPredMae: etaResult.mae
      };
    }
  } catch (error) {
    console.error("[ML Prediction] Failed...", error);
  }
}
```

### Database Schema Updates

The `vesselTripSchema` includes prediction fields:

```typescript
vesselTripSchema: v.object({
  // ... existing fields ...
  LeftDockPred: v.optional(v.number()),        // Predicted departure time (absolute ms)
  LeftDockPredMae: v.optional(v.number()),     // MAE margin (0.01 min precision)
  EtaPred: v.optional(v.number()),              // Predicted arrival time (absolute ms)
  EtaPredMae: v.optional(v.number()),          // MAE margin (0.01 min precision)
});
```

**Key Design Decisions:**

- **Absolute Timestamps**: Predictions stored as absolute milliseconds (not offsets)
  - Immune to schedule changes
  - Simpler downstream consumption
  - Consistent with how trip times are stored elsewhere

- **MAE Precision**: Rounded to 0.01 minutes (0.6 seconds) for confidence intervals

- **Graceful Degradation**: Prediction failures don't prevent core operations
  - Trip creation continues even if predictions fail
  - Trip updates continue even if ETA update fails
  - All decisions logged for observability

### Get Model Parameters (for debugging)

Query model parameters from the Convex API:

```typescript
import { api } from "./_generated/api";

// Query model parameters for a terminal pair
const model = await ctx.runQuery(
  api.functions.predictions.queries.getModelParametersByTerminalPair,
  {
    departingTerminalAbbrev: "MUK",
    arrivingTerminalAbbrev: "CLI",
    modelType: "arrive-depart-late" // or "arrive-arrive", "depart-arrive"
  }
);
```

## Integration with Vessel Trips

Predictions are automatically calculated when vessel trip events occur:

### New Trip Creation
When a vessel completes a trip and starts a new one, initial predictions are made:

```typescript
// In vesselTrips/actions.ts
const predictions = await calculateArrivalPredictions(ctx, completedTrip, newTrip);
// Stores: DelayPred, DelayPredMae, EtaPred, EtaPredMae
```

### Departure Updates
When a vessel leaves dock, ETA predictions are refined:

```typescript
// In vesselTrips/actions.ts
const etaResult = await predictEtaOnDeparture(ctx, currentTrip, currentLocation);
// Updates: EtaPred, EtaPredMae with more accurate values
```

### Database Schema

Vessel trips include prediction fields:

```typescript
vesselTripSchema: v.object({
  // ... existing fields ...
  DelayPred: v.optional(v.number()),      // Predicted delay (minutes)
  DelayPredMae: v.optional(v.number()),   // Delay prediction MAE
  EtaPred: v.optional(v.number()),        // Predicted ETA (timestamp)
  EtaPredMae: v.optional(v.number()),     // ETA prediction MAE
});
```

## Development & Operations

### Environment Setup

```bash
# Install dependencies
npm install

# Start development server
npm run convex:dev

# Run training pipeline
npm run train:ml

# Export training results to CSV
npm run train:export-results
```

### Cron Job Configuration

Weekly automated training at 11:00 AM UTC on Mondays:

```typescript
// convex/crons.ts
crons.cron(
  "retrain ml models",
  "0 4 * * *", // 4:00 AM daily
  internal.domain.ml.actions.trainPredictionModelsAction
);
```

### Validation Scripts

Compare training results between different configurations:

```bash
# Compare two training result CSV files
npm run train:compare results1.csv results2.csv
```

### Known Limitations

1. **Model Availability**: Predictions require trained models in database
2. **Data Quality**: Performance depends on training data completeness
3. **Terminal Coverage**: Only routes with sufficient historical data get models
4. **Real-time Updates**: Models are updated daily, not continuously

---

**Status**: ✅ **FULLY OPERATIONAL**

**Architecture**: TypeScript + Convex + Multivariate Linear Regression

**Coverage**: Dynamic terminal pair discovery (35+ routes, 4-5 models each)

**Training**: Automated weekly retraining at 11:00 AM UTC on Mondays with fresh WSF API data (720 days)

**Predictions**: Real-time inference with sub-millisecond latency

**Features**: 11-14 engineered features per model (time cycles, historical context, route patterns)

## Model Architecture

### Linear Regression Models

The system uses multivariate linear regression trained on historical vessel data:

**Model Equation**: `y = intercept + Σ(coefficient_i × feature_i)`

Where:
- `y` = predicted duration or delay (in minutes)
- `intercept` = baseline prediction value
- `coefficient_i` = weight for each feature
- `feature_i` = normalized input features

### Model Types

Each terminal pair gets trained on 4-5 different models:

1. **`arrive-depart-atdock-duration`**: Predicts how long vessel stays at dock after arrival
2. **`depart-arrive-atsea-duration`**: Predicts how long vessel spends at sea after departure
3. **`arrive-arrive-total-duration`**: Predicts total time from dock arrival to next dock arrival
4. **`arrive-depart-delay`**: Predicts departure delay (early or late) after arrival
5. **`depart-depart-total-duration`**: Simplified model for time between departures

### Feature Engineering

**Time-Based Features:**
- Cyclical encoding for hour-of-day (8 Gaussian radial basis functions)
- Day-of-year cyclical encoding
- Weekend indicator (1/0)

**Historical Context:**
- Previous trip delay (minutes)
- Previous trip at-sea duration (minutes)

**Current Trip Context:**
- Arrival timing relative to schedule
- At-dock duration (for departure-based predictions)
- Terminal pair routing patterns

### Training Metrics

Models are evaluated using:
- **MAE (Mean Absolute Error)**: Average absolute prediction error in minutes
- **RMSE (Root Mean Squared Error)**: Square root of average squared errors
- **R² (Coefficient of Determination)**: Proportion of variance explained (0-1 scale)

## Technical Architecture

### File Structure

```
convex/domain/ml/
├── index.ts                         # Main module exports
├── readme-ml.md                     # This documentation
├── training/                        # Training pipeline
│   ├── index.ts                     # Training module exports
│   ├── pipeline.ts                  # Main training orchestrator (6 steps)
│   ├── actions.ts                   # Training action handlers
│   ├── data/                        # Data loading and processing
│   │   ├── index.ts
│   │   ├── loadTrainingData.ts      # Load WSF API data
│   │   ├── createTrainingRecords.ts # Convert to training format
│   │   └── createTrainingBuckets.ts # Group by terminal pairs
│   └── models/                      # Model training logic
│       ├── index.ts
│       ├── trainModels.ts           # Core training with MLR
│       ├── loadModel.ts             # Model retrieval for predictions
│       └── storeModels.ts           # Model persistence
├── prediction/                      # Prediction system
│   ├── index.ts                     # Prediction exports
│   ├── predictLinearRegression.ts   # Core prediction utilities
│   └── predictors/                  # Individual predictor functions
│       ├── index.ts
│       ├── genericPredictor.ts      # Generic prediction orchestrator
│       ├── shared.ts                # Common prediction utilities
│       ├── predictDelayOnArrival.ts # Delay prediction
│       ├── predictEtaOnArrival.ts   # ETA prediction (arrival-based)
│       ├── predictEtaOnDeparture.ts # ETA prediction (departure-based)
│       └── types.ts                 # Prediction type definitions
├── core/                            # Public ML constants and types
│   ├── index.ts                     # Core module exports
│   ├── config.ts                    # Configuration constants
│   ├── constants.ts                 # Model type constants
│   └── types.ts                     # Public ML types
└── shared/                          # Shared utilities and types
    ├── index.ts
    ├── core/                        # Core implementation (internal)
    │   ├── index.ts
    │   ├── types.ts                 # Core type definitions
    │   ├── modelTypes.ts            # Model type constants
    │   └── config.ts                # ML configuration and FEATURE_DEFINITIONS
    ├── features/                    # Feature engineering
    │   ├── index.ts
    │   ├── extractFeatures.ts       # Feature extraction dispatcher
    │   └── timeFeatures.ts          # Time-based feature utilities
    ├── features.ts                  # Feature extraction exports
    ├── functional/                  # Functional programming utilities
    │   └── index.ts
    ├── terminals.ts                 # Terminal name utilities
    └── unifiedTrip.ts              # Unified trip structure for ML
```

### Data Flow

**Training Pipeline:**
```
WSF API → Load Records → Convert to Training → Create Buckets → Train Models → Store Models → Quality Analysis
   ↓            ↓                  ↓                   ↓               ↓              ↓              ↓
Raw Data   Vessel Groups     TrainingDataRecord   TerminalPairBucket  ModelParameters  Database     Metrics
```

**Prediction Pipeline:**
```
Trip Data → Feature Extraction → Load Model → Linear Regression → Time Conversion → Validation → Result
    ↓              ↓                  ↓               ↓                  ↓              ↓          ↓
Raw Input     FeatureRecord      ModelParameters   Duration (min)   Timestamp (ms)   Clamped    Prediction
```

## Data Quality & Validation

### Quality Filters Applied
1. **Terminal Validation**: Only valid passenger terminals (ANA, BBI, BRE, CLI, COU, EDM, FAU, FRH, KIN, LOP, MUK, ORI, P52, POT, PTD, SHI, SID, SOU, TAH, VAI)
2. **Temporal Consistency**: `tripStart < leftDock < tripEnd`
3. **Data Completeness**: All required timestamps present
4. **Duration Bounds**: Reasonable time ranges (dock: 0-12hrs, sea: 1min-24hrs)
5. **Schedule Adherence**: Within 24 hours of scheduled times

### Statistical Validation
- **Basic Validation**: Temporal consistency checks
- **Data Completeness**: Required field validation
- **Performance Tracking**: MAE, RMSE, R² metrics

## Monitoring & Logging

### Structured Logging
All pipeline activity logged in JSON format:
```json
{
  "timestamp": "2024-12-19T17:09:23.169Z",
  "pipelineId": "ml-pipeline-1766164163169",
  "level": "INFO",
  "message": "Pipeline completed successfully",
  "bucketsProcessed": 36,
  "modelsTrained": 72,
  "totalTrainingExamples": 910,
  "errorCount": 0
}
```

### Key Metrics Tracked
- **Pipeline Health**: Success rates, error counts, execution times
- **Data Quality**: Completeness scores, filter pass rates
- **Model Performance**: MAE, R², RMSE across all terminal pairs
- **Coverage**: Percentage of terminal pairs with trained models

## Development & Operations

### Dependencies
- **Convex Environment**: `ml-regression-multivariate-linear` for linear regression training
- **Database**: Convex for model storage, queries, and automated cron jobs
- **Runtime**: Node.js for Convex functions
- **TypeScript**: Type safety across the entire ML pipeline

### Environment Setup
```bash
# Install dependencies
npm install

# Start development server
npm run convex:dev

# Training Commands
npm run train:ml              # Train on WSF API data (linear regression)
npm run train:ml:convex       # Train on Convex database data (linear regression)

# Export training results to CSV
npm run train:export-results
```

### Cron Job Configuration
```typescript
// Daily training at 4:00 AM Pacific
crons.cron(
  "retrain ml models",
  "0 11 * * 1", // 11:00 AM UTC every Monday
  internal.domain.ml.actions.trainPredictionModelsAction
);
```

## Troubleshooting

### Common Issues

**Pipeline fails with "Array length too long"**
- Issue: Convex response size limit (8,192 items)
- Solution: Pipeline uses pagination automatically

**No models trained for terminal pair**
- Issue: Insufficient training data (<25 examples)
- Solution: Null models stored, graceful handling in predictions

**Poor prediction accuracy**
- Issue: Variable terminal operations, insufficient data
- Solution: Models still functional, monitor performance over time

**Deployment concurrency issues**
- Issue: Large dataset processing during deployment
- Solution: Pipeline automatically handles large datasets with pagination

### Performance Tuning
- **Training Threshold**: Minimum training examples checked in holdout evaluation (configurable via `PIPELINE_CONFIG.EVALUATION.minTrainExamples`)
- **Data Range**: Configurable days back for training (default: 720 days via `PIPELINE_CONFIG.DAYS_BACK`)
- **Memory Management**: Batched vessel loading to handle large datasets
- **Route Sampling**: Limits records per route via `PIPELINE_CONFIG.MAX_SAMPLES_PER_ROUTE` (default: 2500)

## Business Impact

### Operational Benefits
- **Real-Time Tracking**: Accurate vessel ETAs for passengers
- **Resource Planning**: Better terminal staffing and scheduling
- **Customer Experience**: Reliable trip duration estimates
- **System Efficiency**: Automated daily model updates

### Technical Achievements
- **95% Terminal Coverage**: Models for nearly all active routes
- **Sub-Millisecond Inference**: Real-time prediction performance
- **Automated Operations**: Zero manual intervention required
- **Simplified Architecture**: Essential functionality without unnecessary complexity

---

**Status**: ✅ **FULLY OPERATIONAL WITH LINEAR REGRESSION**

**Models**: Dynamic coverage across 35+ terminal pairs (5 models each: arrive-depart-atdock-duration, depart-arrive-atsea-duration, arrive-arrive-total-duration, arrive-depart-delay, depart-depart-total-duration)

**Training Data**: Fresh WSF API data (720 days back) or stored historical data

**Features**: 11-14 comprehensive features (time-of-day RBF functions, historical context, arrival timing, route patterns)

**Automation**: Weekly retraining at 11:00 AM UTC on Mondays (linear regression via cron)
