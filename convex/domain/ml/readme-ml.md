# FerryJoy ML — Advanced Vessel Schedule Prediction System

## Overview

FerryJoy's ML system provides real-time predictions for ferry departure delays and arrival times across the Washington State Ferry (WSF) network. The system uses **5 specialized linear regression models** trained on a configurable historical window (see `convex/domain/ml/shared/config.ts` `ML_CONFIG.pipeline.dataLoading.daysBack`) to predict vessel behavior under various operational conditions.

### Core Architecture Principles

- **Temporal Safety**: Prevents data leakage between prediction timing contexts ("at-dock" vs "at-sea")
- **Route-Specific**: Trains separate models for each terminal pair to capture local operational patterns
- **Production-Ready**: Includes comprehensive error handling, performance monitoring, and fallback mechanisms

### Key Capabilities

- **Departure Delay Prediction**: How long before a vessel departs its current terminal
- **Arrival Time Estimation**: When a vessel will reach its next terminal
- **Multi-Leg Journey Planning**: Coordinated predictions for complex itineraries
- **Real-Time Updates**: Refined predictions as more information becomes available

### Business Value

- **Passenger Experience**: Accurate departure/arrival predictions reduce uncertainty
- **Terminal Operations**: Better resource allocation and crowd management
- **Journey Planning**: Reliable multi-leg trip planning and connection optimization
- **Operational Efficiency**: Data-driven insights for schedule optimization

---

## System Architecture

### Data Flow Pipeline

```
Raw WSF Data → Training Windows → Feature Extraction → Model Training → Database Storage → Real-Time Inference
     ↓              ↓                     ↓                ↓                ↓                  ↓
   N days      Temporal Context     ML Features       5 Models         Convex DB          App / UI
 Historical    (A→B→C sequences)    Engineering       per Route        Persistence        Predictions
```

### Core Components

- **Feature Engineering**: 20+ engineered features capturing temporal patterns, schedule adherence, and operational context
- **Model Training**: Linear regression with chronological train/test splits and numerical stability safeguards
- **Prediction Engine**: Real-time inference with route-specific model selection and uncertainty quantification
- **Data Quality**: Comprehensive validation and filtering to ensure training data reliability

### Technical Stack

- **Framework**: TypeScript with strict typing throughout
- **ML Library**: ml-regression-multivariate-linear for training
- **Database**: Convex for model storage and real-time queries
- **Data Source**: Washington State Ferry historical trip data (see `config.getDaysBack()` in `convex/domain/ml/shared/config.ts`)
- **Deployment**: Serverless functions with automatic scaling

---

## Detailed Model Specifications

### Prediction Models

Models use the full temporal context (previous leg A→B) and are bucketed by 2-terminal pairs (B→C) to capture route-specific patterns.

#### 1. `at-dock-depart-curr`
**Purpose**: Predict departure delay from current terminal before vessel departs
**Use Case**: Real-time departure predictions for passengers waiting at terminal
**Features**: Full at-dock feature set including previous leg context and schedule pressure
**Target**: Minutes from scheduled departure to actual departure
**Business Value**: Enables "should I wait or find alternative transportation?" decisions

#### 2. `at-dock-arrive-next`
**Purpose**: Estimate arrival time at next terminal from current scheduled departure
**Use Case**: Connection planning and "will I make my next ferry?" predictions
**Features**: At-dock features with route-specific historical patterns
**Target**: Minutes from current scheduled departure to next terminal arrival
**Business Value**: Critical for multi-leg journey reliability

#### 3. `at-dock-depart-next`
**Purpose**: Predict turnaround delay at next terminal in multi-leg journeys
**Use Case**: Complex itinerary planning across multiple ferry segments
**Features**: At-dock feature set for the current leg. Training requires a next leg
(Next→After) to label targets; inference additionally needs `ScheduledTrip.NextDepartingTime`
to anchor predictions.
**Target**: Minutes from next terminal scheduled departure to actual departure
**Business Value**: End-to-end journey time predictions

#### 4. `at-sea-arrive-next`
**Purpose**: Refine arrival estimates after vessel has departed
**Use Case**: Real-time ETA updates during transit
**Features**: Enhanced at-sea feature set including actual departure time
**Target**: Minutes from actual departure to next terminal arrival
**Business Value**: Provides accurate real-time arrival information

#### 5. `at-sea-depart-next`
**Purpose**: Update next terminal departure predictions using transit observations
**Use Case**: Refined multi-leg predictions with real-time transit data
**Features**: At-sea feature set for the current leg. Training requires a next leg
(Next→After) to label targets; inference additionally needs `ScheduledTrip.NextDepartingTime`
to anchor predictions.
**Target**: Minutes from next terminal scheduled departure to actual departure
**Business Value**: Improves connection reliability with live transit data


---

## Feature Engineering Deep Dive

### Overview

The system engineers 20+ features from raw trip data, capturing temporal patterns, operational context, and schedule dynamics. All features are designed with **temporal safety** to prevent data leakage between prediction contexts.

### Time Features (12 features)

#### Radial Basis Functions for Time-of-Day
- **Mathematical Basis**: Gaussian radial basis functions with 2-hour centers
- **Coverage**: 24-hour cycle with smooth transitions between time periods
- **Formula**: \( w_i = \exp\left(-\frac{(hour - center_i)^2}{2\sigma^2}\right) \)
- **Purpose**: Captures daily operational patterns (peak hours, off-peak, etc.)
- **Features**: `time_0:00`, `time_2:00`, ..., `time_22:00`

#### Weekend Indicator
- **Purpose**: Distinguishes weekday vs weekend operational patterns
- **Calculation**: Binary flag (1 for Saturday/Sunday, 0 for weekdays)
- **Business Logic**: Weekend schedules often have different passenger loads and operational priorities

### Duration Features (4 features)

#### At-Dock Duration
- **Definition**: Time between arrival at terminal and actual departure
- **Calculation**: `LeftDock - TripStart` (in minutes)
- **Purpose**: Measures actual turnaround time vs scheduled expectations

#### At-Sea Duration
- **Definition**: Transit time between terminals
- **Calculation**: `TripEnd - LeftDock` (in minutes)
- **Purpose**: Actual transit performance vs historical averages

#### Total Duration
- **Definition**: Complete trip duration from arrival to departure
- **Calculation**: `TripEnd - TripStart` (in minutes)
- **Purpose**: Overall trip efficiency metric

#### Previous Leg At-Sea Duration
- **Definition**: Transit time of the previous leg
- **Calculation**: `PrevTripEnd - PrevLeftDock` (in minutes)
- **Purpose**: Previous leg performance as context for current predictions

### Schedule Adherence Features (8 features)

#### Trip Delay
- **Definition**: Primary delay from scheduled departure
- **Calculation**: `LeftDock - ScheduledDeparture` (in minutes)
- **Purpose**: Core prediction target and operational performance indicator

#### Slack Before Departure
- **Definition**: Available time between arrival and scheduled departure
- **Calculation**: `max(0, TripStart - ScheduledDeparture)` (in minutes)
- **Purpose**: Schedule pressure indicator (higher slack = less pressure)

#### Arrival vs Scheduled Departure
- **Definition**: How late arrival was relative to scheduled departure
- **Calculation**: `max(0, ScheduledDeparture - TripStart)` (in minutes)
- **Purpose**: Arrival delay pressure on departure timing

#### Previous Trip Delay
- **Definition**: Delay on the previous trip segment
- **Calculation**: `PrevLeftDock - PrevScheduledDeparture` (in minutes)
- **Purpose**: Previous leg performance as predictive context

### Arrival Schedule Deviation Features (4 features)

#### Mean At-Sea Duration (Previous Leg)
- **Definition**: Historical average transit time for A→B route
- **Source**: Pre-computed from the configured training window (see `config.getDaysBack()` in `convex/domain/ml/shared/config.ts`)
- **Purpose**: Baseline for arrival time expectations

#### Estimated Arrival at Current Terminal
- **Definition**: Expected arrival time based on schedule + historical transit
- **Calculation**: `PrevScheduledDeparture + meanAtSea(A→B)` (converted to timestamp)
- **Purpose**: Schedule-based arrival prediction for comparison

#### Arrival vs Estimated Schedule
- **Definition**: Deviation between actual and expected arrival times
- **Calculation**: `TripStart - estimatedArrival` (in minutes)
- **Purpose**: Measures transit performance vs historical patterns

#### Arrival After/Before Estimated Schedule
- **Definition**: Split positive/negative components of schedule deviation
- **Calculation**: `max(0, arrivalVsEstimated)` and `max(0, -arrivalVsEstimated)`
- **Purpose**: Separate early/late arrival signals for ML models

### Operational Pressure Features (2 features)

#### Late Arrival Pressure
- **Definition**: Schedule pressure based on arrival timing vs turnaround requirements
- **Formula**: `max(0, meanAtDock(B→C) - slackBeforeDeparture)`
- **Intuition**: When slack is low relative to typical turnaround time, operations dominate over schedule
- **Purpose**: Quantifies operational pressure affecting departure timing

### Route Priors (2 features)

#### Mean At-Dock Duration (Current Route)
- **Definition**: Historical average turnaround time for B→C terminal pair
- **Source**: Pre-computed from the configured training window (see `config.getDaysBack()` in `convex/domain/ml/shared/config.ts`)
- **Purpose**: Route-specific baseline for operational expectations

#### Mean At-Sea Duration (Current Route)
- **Definition**: Historical average transit time for B→C terminal pair
- **Source**: Pre-computed from the configured training window (see `config.getDaysBack()` in `convex/domain/ml/shared/config.ts`)
- **Purpose**: Route-specific baseline for transit time expectations

### Feature Set Variants by Context

#### At-Dock Feature Set
Contains all features available when vessel is at terminal:
- All time features
- All duration features (where available)
- All schedule adherence features
- All arrival deviation features
- All operational pressure features
- All route priors

#### At-Sea Feature Set
Extends at-dock features with post-departure information:
- All at-dock features
- Actual at-dock duration (now known)
- Actual trip delay (now known)


---

## Training Pipeline Architecture

### Overview

The training pipeline transforms raw WSF data into production-ready ML models through a carefully orchestrated sequence of data processing, feature engineering, and model training steps.

### Pipeline Stages

#### 1. Data Loading (`loadWsfTrainingData`)
**Purpose**: Load historical training data with quality controls
**Source**: WSF vessel trip records within the configured training window (see `config.getDaysBack()` in `convex/domain/ml/shared/config.ts`)
**Filtering**: Removes only truly unusable records (e.g. missing vessel/departure/timestamps)
**Output**: Raw `VesselHistory[]` (not yet windowed) for window creation

#### 1.5. WSF History Eligibility (no inference)
WSF historical vessel records sometimes omit required fields like `Arriving` and `EstArrival`.
We **do not infer** missing values for training or reporting.

Instead, we apply strict eligibility rules during window creation:
- If any required field is missing (`Vessel`, `Departing`, `Arriving`, `ScheduledDepart`, `ActualDepart`, `EstArrival`), that record is **skipped** for training.
- Terminal names must successfully map to validated terminal abbreviations via `convex/domain/ml/shared/config.ts`.

#### 2. Window Creation (`createTrainingWindows`)
**Purpose**: Build temporal training contexts from sequential trips
**Logic**: Process each vessel's trips chronologically, creating A→B→C sequences
**Validation**: Terminal continuity, duration bounds, timestamp validity, strict required-field presence
**VesselHistory References**: Each window includes `prevHistory`, `currHistory`, and `nextHistory` fields that reference the original `VesselHistory` records used to create the window.
**Output**: TrainingWindow[] with full temporal context and VesselHistory references

#### 3. Feature Extraction (`createFeatureRecords`)
**Purpose**: Transform windows into ML-ready feature vectors
**Engineering**: Apply 20+ feature engineering functions with temporal safety
**Targets**: Calculate prediction targets for each model type
**Safety**: Prevent data leakage between at-dock/at-sea contexts
**VesselHistory Retention**: Each `FeatureRecord` includes `prevHistory`, `currHistory`, and `nextHistory` fields that reference the original `VesselHistory` records. These references are retained in memory throughout training, enabling debugging and logging of the underlying raw data. The original `VesselHistory[]` array remains in memory as long as `FeatureRecord[]` references exist.
**Output**: FeatureRecord[] ready for model training, with VesselHistory references for debugging

#### 4. Data Bucketing (`createTrainingBuckets`)
**Purpose**: Group training examples by route for specialized models
**Strategy**: Bucket by terminal pairs (B→C) for route-specific patterns
**Sampling**: Limit examples per route to prevent overfitting
**Recency**: Prioritize most recent examples for current patterns
**Output**: TrainingBucket[] organized by route

#### 5. Model Training (`trainAllModels`)
**Purpose**: Train linear regression models for all route+model combinations
**Parallelization**: Train all models concurrently for efficiency
**Stability**: Apply numerical safeguards against training failures
**Evaluation**: Chronological train/test splits for realistic assessment
**Output**: ModelParameters[] with trained coefficients and metrics

#### 6. Model Storage (`storeModels`)
**Purpose**: Persist trained models to database for inference
**Format**: Convex-compatible document structure
**Indexing**: Optimized queries by route and model type
**Versioning**: Timestamp tracking for model freshness
**Output**: Models available for real-time predictions

### Quality Controls & Safety Measures

#### Data Quality Filters
- **Duration Validation**: At-sea/at-dock times within realistic bounds
- **Terminal Mapping**: All terminals exist in validated terminal set
- **Timestamp Validity**: No negative durations or impossible sequences
- **Continuity Checks**: Vessel trips form logical journey sequences

#### Debugging & Logging Support
- **VesselHistory Retention**: Original `VesselHistory` records are retained in memory throughout the training pipeline via references in `FeatureRecord` objects
- **Access Pattern**: Each `FeatureRecord` includes `prevHistory`, `currHistory`, and `nextHistory` fields pointing to the original WSF data
- **Use Cases**: Enables debugging of feature engineering, investigation of training examples, and logging of raw data during model training
- **Memory Management**: VesselHistory records remain accessible as long as FeatureRecords exist in memory (typically for the duration of the training run)

**Important note on missing WSF fields**
- Missing `Arriving` or `EstArrival` means the record is **skipped** for training and therefore cannot contribute to window creation.

#### Training Stability Safeguards
- **Numerical Stability**: Detect and handle exploding coefficients
- **Minimum Data Requirements**: Skip training for insufficient examples
- **Fallback Models**: Mean-based predictions when training fails
- **Cross-Validation**: Chronological splits prevent temporal leakage

#### Performance Monitoring
- **Model Metrics**: MAE, RMSE, Std Dev, R² tracked for each trained model
- **Training Statistics**: Success rates, data volumes, processing times
- **Data Coverage**: Route coverage and example distributions
- **Prediction Bounds**: Reasonable limits on prediction magnitudes

---

## Prediction Engine & Inference

### Real-Time Inference Architecture

#### Model Selection Logic
**Route Matching**: Select models by terminal pair (B→C)
**Timing Context**: Choose at-dock vs at-sea models based on available information
**Fallback Handling**: Graceful degradation when preferred models unavailable

### ScheduledTrips enrichment used by inference

Real-time inference depends on **schedule-chain fields** computed during ScheduledTrips
sync and then **snapshotted onto active VesselTrips**.

#### Composite trip key format

Both ScheduledTrips and VesselTrips use a shared composite key (see
`convex/shared/keys.ts` `generateTripKey`) with format:

`[VesselAbbrev]--[PacificDate]--[PacificTime]--[DepartingTerminal]-[ArrivingTerminal]`

Important details:
- **PacificDate/PacificTime** are computed in `America/Los_Angeles`.
  - Implementation: `convex/shared/keys.ts` (`formatPacificDate`, `formatPacificTime`)
- The key uses the **Pacific calendar day** (not WSF “sailing day”).
  - Implementation: `convex/shared/keys.ts` (`generateTripKey`)

#### ScheduledTrips chain fields

During sync, we compute (per ScheduledTrip):
- `TripType`: classification as "direct" or "indirect" trip
  - Direct trips: consecutive terminal pairs (A→B, B→C)
  - Indirect trips: skip intermediate terminals (A→C when A→B→C exists)
  - Implementation: `convex/functions/scheduledTrips/sync/businessLogic.ts` (`classifyTripsByType`)
  - Schema: `convex/functions/scheduledTrips/schemas.ts` (`scheduledTripSchema`)
- `PrevKey`: the previous trip’s `Key` for this vessel (chronological chain)
  - Implementation: `convex/functions/scheduledTrips/sync/businessLogic.ts` (`calculateVesselTripEstimates`)
  - Schema: `convex/functions/scheduledTrips/schemas.ts` (`scheduledTripSchema`)
- `NextKey`: the next trip’s `Key` for this vessel (chronological chain)
  - Implementation: `convex/functions/scheduledTrips/sync/businessLogic.ts` (`calculateVesselTripEstimates`)
  - Schema: `convex/functions/scheduledTrips/schemas.ts` (`scheduledTripSchema`)
- `NextDepartingTime`: the next trip’s scheduled departure timestamp (epoch ms)
  - Implementation: `convex/functions/scheduledTrips/sync/businessLogic.ts` (`calculateVesselTripEstimates`)
  - Schema: `convex/functions/scheduledTrips/schemas.ts` (`scheduledTripSchema`)
- `EstArriveNext`: estimated arrival at the next terminal (epoch ms, proxy)
  - Implementation: `convex/functions/scheduledTrips/sync/businessLogic.ts` (`calculateEstArriveNext`)
- `EstArriveCurr`: previous trip’s `EstArriveNext` (validated to not exceed `DepartingTime`)
  - Implementation: `convex/functions/scheduledTrips/sync/businessLogic.ts` (`calculateVesselTripEstimates`)

These are computed only after vessel-level classification resolves overlapping/ambiguous
route options (see `convex/functions/scheduledTrips/sync/businessLogic.ts`). The classification
process marks trips as direct or indirect instead of filtering them out, allowing both types
to be stored while maintaining clear distinction for filtering purposes.

### How predictions are generated in VesselTrips

Predictions are generated and stored as part of the vessel orchestrator action
`updateVesselOrchestrator` (entrypoint: `convex/functions/vesselOrchestrator/actions.ts`).
The orchestrator fetches vessel locations once, deduplicates them, and delegates to
both `updateVesselLocations` and `runUpdateVesselTrips` subroutines with error isolation.
The trip update logic is implemented in `convex/functions/vesselTrips/updates/updateVesselTrips.ts`.

#### 1) ScheduledTrip snapshot enrichment (lazy + keyed)

For each active vessel trip update:
- We derive `Key` once `ScheduledDeparture`, `DepartingTerminalAbbrev`, and
  `ArrivingTerminalAbbrev` are present.
  - Implementation: `convex/functions/vesselTrips/updates/scheduledTripEnrichment.ts` (`deriveTripKey`)
- We lazily fetch the matching ScheduledTrip by `Key` and snapshot it onto the
  VesselTrip as `ScheduledTrip` (with light throttling to avoid DB churn).
  - Implementation: `convex/functions/vesselTrips/updates/scheduledTripEnrichment.ts` (`enrichTripStartUpdates`, `fetchScheduledTripFieldsByKey`)
  - Query: `convex/functions/scheduledTrips/queries.ts` (`getScheduledTripByKey`)
- **Safety**: Only direct trips match VesselTrips. Indirect trips have different
  terminal pairs (A→C vs A→B), so their composite keys are inherently different.
  An explicit check ensures `TripType === "direct"` (defensive programming).
  - Implementation: `convex/functions/vesselTrips/updates/scheduledTripEnrichment.ts` (`fetchScheduledTripFieldsByKey`)
- If `Key` changes, we clear derived data (scheduled snapshot + predictions) to
  prevent mixing identities.
  - Implementation: `convex/functions/vesselTrips/updates/scheduledTripEnrichment.ts` (`CLEAR_DERIVED_TRIP_DATA_ON_KEY_CHANGE`)

Note: `NextKey` is **not duplicated** on VesselTrips; it is read from the embedded
`ScheduledTrip` snapshot.
  - Schema: `convex/functions/vesselTrips/schemas.ts` (`ScheduledTrip: v.optional(scheduledTripSchema)`)

#### 2) Prediction generation (once per trip, per timing context)

When required features are present, we compute and persist:
- **At dock**:
  - `AtDockDepartCurr` (predict departure from Curr)
  - `AtDockArriveNext` (predict arrival at Next)
  - `AtDockDepartNext` (predict departure from Next)
    - Anchor: `ScheduledTrip.NextDepartingTime`
- **At sea** (requires `LeftDock`):
  - `AtSeaArriveNext` (refined ETA while underway)
  - `AtSeaDepartNext` (refined Next-departure while underway)
    - Anchor: `ScheduledTrip.NextDepartingTime`

Depart-next predictions are anchored on `ScheduledTrip.NextDepartingTime` so the
model’s output (minutes vs Next scheduled departure) can be stored as an absolute
epoch-ms `PredTime`.
  - Implementation: `convex/domain/ml/prediction/vesselTripPredictions.ts` (`computeVesselTripPredictionsPatch`)

#### 3) Prediction actualization (backfill)

We fill “Actual” values (and deltas) when the relevant real-world event is
observed:
- `AtSeaArriveNext.Actual`: set when the trip completes (`TripEnd` becomes known)
  - Implementation: `convex/domain/ml/prediction/vesselTripPredictions.ts` (`updatePredictionsWithActuals`)
- `AtDockDepartNext.Actual` / `AtSeaDepartNext.Actual`: set when the *next* trip
  leaves dock (the next trip's `LeftDock` is the previous trip's "depart next"
  actual), using `setDepartNextActualsForMostRecentCompletedTrip`.
  - Trigger: `convex/functions/vesselTrips/updates/updateVesselTrips.ts` (`handleTripUpdate`, `didJustLeaveDock`)
  - Implementation: `convex/functions/vesselTrips/mutations.ts` (`setDepartNextActualsForMostRecentCompletedTrip`)
  - Orchestrator: `convex/functions/vesselOrchestrator/actions.ts` (`updateVesselOrchestrator`)

#### Feature Engineering Pipeline
**Temporal Safety**: Use only features available at prediction time
**Data Normalization**: Apply same transformations as training
**Missing Data Handling**: Robust handling of incomplete trip information
**Feature Ordering**: Maintain consistent vectorization for model compatibility

#### Prediction Workflows

##### Departure Delay Prediction (`predictDelayOnArrival`)
**Input**: Vessel at terminal (arrival time known, departure time unknown)
**Model**: `at-dock-depart-curr`
**Output**: Expected delay in minutes from scheduled departure
**Use Case**: Real-time departure predictions for terminal displays

##### Arrival ETA Prediction (`predictArriveEta`)
**Input**: Vessel has departed current terminal
**Model**: `at-sea-arrive-next`
**Output**: Expected arrival time at next terminal
**Use Case**: Real-time ETA updates during transit

##### Departure ETA Prediction (`predictEtaOnDeparture`)
**Input**: Vessel at terminal with scheduled departure time
**Model**: `at-dock-depart-curr`
**Output**: Expected departure timestamp
**Use Case**: Absolute departure time predictions

### Error Handling & Robustness

#### Missing Model Scenarios
- **Route Not Trained**: Return null with descriptive error
- **Model Loading Failure**: Fallback to baseline predictions
- **Invalid Input Data**: Comprehensive input validation

#### Prediction Quality Indicators
- **Model MAE**: Included in response for uncertainty quantification
- **Confidence Bounds**: Based on training performance metrics
- **Outlier Detection**: Flag predictions outside normal ranges

#### Production Monitoring
- **Prediction Logging**: Track prediction accuracy over time
- **Model Performance**: Monitor MAE drift and recalibration needs
- **Data Quality**: Alert on unusual input patterns
- **System Health**: Track prediction latency and error rates

---

## Data Sources & Quality Assurance

### Primary Data Source: WSF Historical Records

#### Data Scope
- **Time Range**: Configurable via `config.getDaysBack()` in `convex/domain/ml/shared/config.ts`
- **Coverage**: All major Puget Sound and San Juan Island routes
- **Update Frequency**: Continuous updates for model freshness

#### Key Data Fields
- **Timestamps**: Scheduled and actual departure/arrival times
- **Terminal Information**: Departure and arrival terminal codes
- **Vessel Identity**: Unique vessel identifiers for journey tracking
- **Trip Continuity**: Sequential trip linking for multi-leg analysis

### Data Quality Challenges & Solutions

#### Arrival Time Proxy Issue
**Problem**: WSF data lacks true "arrived at dock" timestamps
**Solution**: Use `EstArrival` as proxy (typically within 1 minute of reality)
**Impact**: Introduces minor noise but maintains predictive utility
**Mitigation**: Statistical validation of proxy accuracy

#### Terminal Mapping Complexity
**Problem**: Multiple naming conventions for same terminals
**Solution**: Comprehensive mapping table with 40+ terminal variations
**Validation**: Automated checks against known terminal set
**Maintenance**: Regular updates for new terminal codes

#### Duration Outlier Management
**Problem**: Anomalous trip durations from data entry errors or extreme conditions
**Solution**: Multi-tier filtering based on route-specific statistical bounds
**Bounds**: Configurable min/max thresholds per duration type
**Rationale**: Preserve operational reality while removing clear errors

### Statistical Data Products

#### Route-Specific Priors
**At-Dock Durations**: Mean turnaround times by terminal pair
**At-Sea Durations**: Mean transit times by terminal pair
**Methodology**: Calculated from clean historical data
**Update Cycle**: Recalculated with each model training
**Use Cases**: Feature engineering baselines and schedule validation

---

## Performance Evaluation & Metrics

### Model Quality Metrics

#### Mean Absolute Error (MAE)
**Definition**: Average absolute prediction error in minutes
**Formula**: \( MAE = \frac{1}{n} \sum |y_{predicted} - y_{actual}| \)
**Interpretation**: Average minutes of prediction error
**Business Relevance**: Direct measure of prediction accuracy

#### Root Mean Squared Error (RMSE)
**Definition**: Square root of mean squared prediction error
**Formula**: \( RMSE = \sqrt{\frac{1}{n} \sum (y_{predicted} - y_{actual})^2} \)
**Interpretation**: Penalizes large errors more than MAE
**Use Case**: Sensitive to outlier predictions

#### R-squared (Coefficient of Determination)
**Definition**: Proportion of variance explained by the model
**Formula**: \( R^2 = 1 - \frac{SS_{res}}{SS_{tot}} \)
**Interpretation**: 0.0 (random) to 1.0 (perfect prediction)
**Context**: Lower for complex, noisy real-world systems

#### Standard Deviation of Errors
**Definition**: Measure of prediction error consistency/spread
**Formula**: \( \sigma = \sqrt{\frac{1}{n-1} \sum (y_{predicted} - y_{actual} - \bar{e})^2} \)
**Interpretation**: Lower values indicate more consistent predictions
**Business Value**: Shows prediction reliability (e.g., "usually within ±X minutes")

### Evaluation Methodology

#### Chronological Train/Test Split
**Strategy**: Train on earlier data (80%), test on recent data (20%)
**Rationale**: Simulates real-world prediction (past data → future predictions)
**Advantage**: Prevents temporal data leakage
**Limitation**: Training set smaller than random splits

#### Route-Specific Evaluation
**Per-Route Metrics**: Each terminal pair evaluated independently
**Statistical Validity**: Minimum example thresholds for reliable assessment
**Comparative Analysis**: Performance across different route types

### Performance Benchmarks

#### Expected Performance Ranges
- **MAE**: 5-15 minutes depending on route complexity
- **RMSE**: 8-25 minutes (higher due to outlier sensitivity)
- **Std Dev**: 6-20 minutes (measures error consistency)
- **R²**: 0.3-0.7 for real-world operational predictions

#### Route Performance Factors
- **Short Routes**: Generally better predictions (less variability)
- **High-Traffic Routes**: More stable patterns, better performance
- **Weather-Sensitive Routes**: Higher variability, lower R²

---

## Implementation Details & File Structure

### Core Architecture Files

```
convex/domain/ml/
├── readme-ml.md                      # This comprehensive documentation
├── index.ts                          # Public API exports
├── shared/                           # Shared utilities and configuration
│   ├── config.ts                     # ML configuration and data constants
│   ├── types.ts                      # TypeScript type definitions
│   ├── models.ts                     # Model definitions and configurations
│   ├── features.ts                   # Feature engineering functions
│   ├── featureRecord.ts              # Feature record creation and processing
│   └── unifiedTrip.ts                # Trip data normalization
├── prediction/                       # Real-time inference engine
│   ├── predictTrip.ts                # Main prediction functions
│   ├── applyModel.ts                 # Model application utilities
│   └── metrics.ts                    # Performance evaluation metrics
├── training/                         # Model training pipeline
│   ├── pipeline.ts                   # Main training orchestration
│   ├── actions.ts                    # Convex action handlers
│   ├── data/                         # Data processing pipeline
│   │   ├── loadTrainingData.ts       # Data loading and validation
│   │   ├── createTrainingWindows.ts  # Temporal window creation
│   │   └── createTrainingBuckets.ts  # Route-based data bucketing
│   └── models/                       # Model training implementation
│       ├── trainModels.ts            # Linear regression training
│       └── storeModels.ts            # Model persistence
└── convex/functions/predictions/     # Convex database integration
    ├── schemas.ts                    # Database schema definitions
    ├── mutations.ts                  # Data modification handlers
    └── queries.ts                    # Data retrieval handlers
```

### Key Implementation Patterns

#### Functional Architecture
- **Pure Functions**: Data processing steps are stateless and testable
- **Type Safety**: Comprehensive TypeScript typing throughout
- **Error Boundaries**: Graceful handling of edge cases and failures
- **Memory Efficiency**: Streaming processing for large datasets

#### Data Flow Patterns
- **Immutable Processing**: Each pipeline step returns new data structures
- **Validation Layers**: Progressive data quality checks at each stage
- **Error Accumulation**: Continue processing valid data while logging issues
- **Resource Cleanup**: Explicit memory management for large datasets

#### Testing & Validation
- **Unit Tests**: Individual function correctness
- **Integration Tests**: End-to-end pipeline validation
- **Data Validation**: Statistical checks on processed datasets
- **Model Validation**: Performance testing against held-out data

---

## Operational Procedures

### Model Training Workflow

#### Automated Training
```bash
npm run ml:train
```
**Process**: Loads data, trains all models, stores to database with tag `"dev-temp"`, then exports results
**Duration**: 10-30 minutes depending on data volume
**Output**: Training statistics and model performance metrics

#### Results Export
```bash
npm run ml:export-results
```
**Purpose**: Extract training results for analysis (without retraining)
**Format**: CSV files with model parameters and metrics
**Location**: `ml/training-results.csv`

### Monitoring & Maintenance

#### Model Performance Tracking
- **MAE Monitoring**: Track prediction accuracy over time
- **Model Freshness**: Retrain with new data periodically
- **Route Coverage**: Ensure all major routes have trained models
- **Error Rate Analysis**: Monitor prediction failure patterns

#### Data Quality Assurance
- **Input Validation**: Check incoming trip data quality
- **Feature Distribution**: Monitor feature value ranges
- **Prediction Bounds**: Alert on anomalous predictions
- **System Health**: Track inference latency and error rates

### Troubleshooting Guide

#### Common Issues

##### No Model Found for Route
**Symptoms**: Prediction returns null for specific terminal pair
**Cause**: Insufficient training data for that route
**Solution**: Check training logs, consider data augmentation

##### Unusually High Prediction Errors
**Symptoms**: MAE significantly above baseline
**Cause**: Changed operational patterns or data quality issues
**Solution**: Retrain models with recent data, check data validity

##### Training Pipeline Failures
**Symptoms**: Models fail to train for specific combinations
**Cause**: Insufficient data or numerical instability
**Solution**: Review data filtering, adjust minimum example thresholds

---

## Future Enhancements & Research Directions

### Model Architecture Improvements

#### Advanced ML Algorithms
- **Ensemble Methods**: Combine multiple model predictions
- **Neural Networks**: Deep learning for complex pattern recognition
- **Time Series Models**: LSTM/CNN for temporal dependencies

#### Feature Engineering Enhancements
- **Weather Integration**: Weather impact on transit times
- **Traffic Patterns**: Passenger load effects on operations
- **Seasonal Adjustments**: Holiday and event-based patterns
- **Vessel-Specific Models**: Individual vessel performance characteristics

### Data Quality & Coverage

#### Enhanced Data Sources
- **Real-Time Weather**: Live weather integration
- **Passenger Counts**: Load factor impact on operations
- **Maintenance Records**: Scheduled maintenance prediction
- **Crew Scheduling**: Staffing impact on departure times

#### Data Expansion
- **Longer History**: Extended training windows (2+ years)
- **Additional Routes**: New terminal pairs and service expansions
- **Higher Granularity**: Sub-minute timestamp precision
- **Additional Metadata**: Vessel type, passenger capacity, etc.

### Production Infrastructure

#### Scalability Improvements
- **Model Caching**: In-memory model storage for faster inference
- **Batch Predictions**: Parallel processing for multiple predictions
- **Edge Deployment**: Models deployed closer to prediction endpoints
- **Auto-Retraining**: Continuous learning from prediction feedback

#### Monitoring & Observability
- **Real-Time Metrics**: Live prediction accuracy dashboards
- **A/B Testing**: Compare model versions in production
- **User Feedback Integration**: Incorporate user-reported accuracy
- **Automated Alerts**: Performance degradation detection

### Business Applications

#### Enhanced User Experience
- **Personalized Predictions**: User-specific reliability adjustments
- **Alternative Routing**: Multi-modal transportation suggestions
- **Wait Time Optimization**: Optimal departure time recommendations
- **Connection Guarantees**: Reliability-based connection planning

#### Operational Intelligence
- **Schedule Optimization**: Data-driven schedule adjustments
- **Resource Planning**: Terminal staffing and equipment allocation
- **Maintenance Planning**: Predictive maintenance scheduling
- **Capacity Management**: Load balancing across routes

---

## Conclusion

FerryJoy's ML system represents a comprehensive, production-ready solution for ferry schedule prediction. The system's regime-aware architecture, temporal safety features, and route-specific modeling provide accurate predictions across diverse operational conditions.

Key strengths include:
- **Robust Architecture**: Handles complex real-world operational scenarios
- **Data-Driven**: Based on extensive historical validation
- **Production-Ready**: Comprehensive error handling and monitoring
- **Scalable Design**: Supports future enhancements and expansions
- **Business Impact**: Delivers measurable value for passengers and operators

The combination of careful feature engineering, rigorous validation, and thoughtful architectural decisions ensures reliable performance in the challenging domain of ferry operations.

We assume two consecutive trips:

- **prev** leg: **Prev→Curr**
- **curr** leg: **Curr→Next**

Some models require a third observed leg:

- **next** leg: **Next→After** (only to train “depart from Next” / **Depart-Next** targets)

We also distinguish “state” at prediction time:

- **at dock**: the vessel is at Curr and has not departed Curr yet
- **at sea**: the vessel has departed Curr and is en route to Next

All targets are in **signed minutes** (negative is allowed but should be rare).

---

## The 5 model types (what each predicts)

We train **five** multivariate linear regression models:

Model keys (canonical list) live in:
- `convex/domain/ml/shared/types.ts` (`MODEL_KEYS`)

### Models (bucket by Prev→Curr→Next)

Models explicitly use Prev→Curr context and bucket by the **pair key**:

1) **`at-dock-depart-curr`**
- **Use when**: at dock at Curr
- **Predicts**: expected departure from Curr, measured as minutes from **Curr scheduled departure**
- **Target**: \( \Delta(Curr\_{schedDepart},\ Curr\_{actualDepart}) \)

2) **`at-dock-arrive-next`**
- **Use when**: at dock at Curr
- **Predicts**: expected arrival at Next, measured as minutes from **Curr scheduled departure**
- **Target**: \( \Delta(Curr\_{schedDepart},\ Next\_{arrivalProxy}) \)

3) **`at-dock-depart-next`**
- **Use when**: at dock at Curr and `ScheduledTrip.NextDepartingTime` is available
  (so we can anchor the prediction to an absolute timestamp)
- **Predicts**: expected departure from Next, measured as minutes from **Next scheduled departure**
- **Target**: \( \Delta(Next\_{schedDepart},\ Next\_{actualDepart}) \)
  - Note: a next leg (Next→After) is required during training to label the target,
    but it is not required at inference time.

4) **`at-sea-arrive-next`**
- **Use when**: at sea between Curr and Next (Curr actual departure is known)
- **Predicts**: expected arrival at Next, measured as minutes from **Curr actual departure**
- **Target**: \( \Delta(Curr\_{actualDepart},\ Next\_{arrivalProxy}) \)

5) **`at-sea-depart-next`**
- **Use when**: at sea between Curr and Next and `ScheduledTrip.NextDepartingTime`
  is available (so we can anchor the prediction to an absolute timestamp)
- **Predicts**: expected departure from Next, measured as minutes from **Next scheduled departure**
- **Target**: \( \Delta(Next\_{schedDepart},\ Next\_{actualDepart}) \)
  - Note: a next leg (Next→After) is required during training to label the target,
    but it is not required at inference time.


Layover models assume a “fresh start” and bucket only by the **pair key**:



---



### Arrival time proxy
WSF historical records do not provide a true “arrived at dock” timestamp. We use:
- `EstArrival` as a **proxy** for arrival time (generally within ~1 minute of reality, with noise).

This proxy is used both in training targets/features.

### Slack at Curr
Let:
- `arrivalB = prev.EstArrival` (proxy)
- `schedDepartB = curr.ScheduledDepart`

Then:

- \( slackB = \max(0,\ \Delta(arrivalB,\ schedDepartB)) \)

### Mean turnaround reference
We use route priors from:
- `convex/domain/ml/shared/config.ts`

Specifically:
- `meanAtDock(Curr->Next)` (from the `meanAtDockDuration` table)

### Regime rule
- **In Service** if \( slackCurr \le 1.5 \times meanAtDock(Curr\to Next) \)
- **Layover** if \( slackCurr > 1.5 \times meanAtDock(Curr\to Next) \)

### Maintenance/out-of-service guardrail
To avoid training on “return from maintenance / out of service” events, we exclude windows where:
- \( slackB > 12\ hours \)

This preserves “overnight” while avoiding multi-day gaps.

Implementation:
- `convex/domain/ml/training/data/createTrainingWindows.ts`

---

## Depart-Next training eligibility (avoid “overnight at Next” contamination)

“Depart Next” targets require observing a **next** leg out of Next (Next→After), but we must avoid learning from cases where the vessel arrives at Next, sits overnight, and departs much later.

Eligibility is computed at **Next** (independent of Curr’s regime).

Let:
- `arrivalC = curr.EstArrival` (proxy)
- `schedDepartC = next.ScheduledDepart` (from C→D)

Then:

- \( slackC = \max(0,\ \Delta(arrivalC,\ schedDepartC)) \)

We require:
- \( slackC \le 1.5 \times meanAtDock(C\to D) \)
- and \( slackC \le 12\ hours \)

If a window fails this eligibility test:
- it is still usable for **depart-curr** and **arrive-next** models
- it is **not** usable for **depart-next** models

Implementation:
- `convex/domain/ml/training/data/createTrainingWindows.ts`

---

## Bucketing (critical architecture detail)

### Buckets: B→C pair keys
Models are bucketized by pair:
- `pairKey = B->C`

Rationale: Each route has distinct operational patterns, traffic volumes, and environmental conditions that affect schedule adherence.

Rationale: under layover, A is intentionally ignored to avoid leaking stale context into “fresh start” predictions.

Implementation:
- `convex/domain/ml/training/data/createTrainingBuckets.ts`

Sampling:
- each bucket is sampled to the **most recent** `config.getMaxSamplesPerRoute()` windows.

---

## Feature engineering (exactly what goes into models)

All ML models are linear regressions over numeric features.

### Time features (scheduled-departure anchored)
We reuse v1’s time encoding:
- `extractTimeFeatures` from `convex/domain/ml/shared/features.ts`
  - Gaussian radial basis functions across time-of-day
- weekend indicator (0/1) derived from scheduled departure’s Pacific day-of-week

Anchors:
- For “depart-curr” / “arrive-next” models: time features are anchored to **B scheduled departure** (`curr.ScheduledDepart`).
- For “depart-next” models: time features are still anchored to **B scheduled departure**
  (the current leg). The “depart-next” target is defined relative to **C scheduled
  departure**, which is supplied at inference time via `ScheduledTrip.NextDepartingTime`.

### Slack feature at Curr (both regimes)
- `slackBeforeCurrScheduledDepartMinutes` (computed from arrival proxy at Curr vs Curr scheduled depart)

This drives both regime-like behavior and “schedule anchoring” magnitude.

### Route priors for current leg (both regimes)
- `meanAtSeaCurrMinutes = meanAtSea(B->C)`
- `meanAtDockCurrMinutes = meanAtDock(B->C)`

Means are pulled from:
- `convex/domain/ml/shared/config.ts`

### Previous-leg context (A→B)
Models include:
- `prevTripDelayMinutes = Δ(A_sched_depart, A_actual_depart)`
- `prevAtSeaDurationMinutes = Δ(A_actual_depart, arrivalB_proxy)`
- `arrivalVsEstimatedScheduleMinutes`
  - estimated arrival at Curr = `Prev_sched_depart + meanAtSea(Prev->Curr)`
  - \( \Delta(estimatedArrivalB,\ arrivalB\_proxy) \)
- `arrivalAfterEstimatedScheduleMinutes = max(0, arrivalVsEstimatedScheduleMinutes)`
- `arrivalBeforeEstimatedScheduleMinutes = max(0, -arrivalVsEstimatedScheduleMinutes)`


### At-sea-only current-leg realized context (B→C)
At-sea models include features that are only known once the vessel has departed B:
- `currTripDelayMinutes = Δ(B_sched_depart, B_actual_depart)`
- `currAtDockDurationMinutes = Δ(arrivalB_proxy, B_actual_depart)`

These provide the “refinement” capability once B actual departure is known.

### Feature definitions per model
Model definitions live in:
- `convex/domain/ml/shared/models.ts`

Each model defines:
- `extractFeatures(window) -> Record<string, number>`
- `calculateTarget(window) -> number | null` (null = not trainable from that window)

---

## Training data construction (windowed)

ML is trained from **per-vessel chronological windows** built from WSF history records.

### Required raw fields
To create windows, the current implementation requires per trip:
- `ScheduledDepart`
- `ActualDepart`
- `EstArrival` (arrival proxy)
- plus terminal names (mapped to abbrevs)

Continuity checks:
- A→B then B→C requires `prev.arriving === curr.departing`
- C→D (optional) requires `next.departing === curr.arriving`

Implementation:
- `convex/domain/ml/training/data/createTrainingWindows.ts`

---

## Training algorithm (linear regression + time split)

### Model form
Each model is trained as:

- \( y = intercept + \sum_i coefficient_i \times x_i \)

### Train/test split
For each bucket and model type:
- 80/20 split using the bucket’s ordered windows (bucket sampling is most-recent-first)
- models are skipped if there are insufficient usable examples after filtering (especially depart-next)

### Feature ordering (critical)
Linear regression requires stable feature ordering. We store:
- `featureKeys` as a sorted list of feature names
- `coefficients` aligned to that ordering

At inference time, inputs must be vectorized with the same ordering.

### Numerical stability safeguard
If training produces unstable coefficients (e.g., very large magnitudes, NaNs), we fall back to a baseline:
- coefficients set to 0
- intercept set to the mean of `y_train`

Implementation:
- `convex/domain/ml/training/models/trainModels.ts`

---

## Model storage (Convex)

Models are stored in the `modelParameters` table with:
- `bucketType`: `"pair"`
- `pairKey`
- `modelType`: one of the five model keys
- `featureKeys`, `coefficients`, `intercept`
- `testMetrics` (MAE, RMSE, Std Dev, R²)
- `bucketStats` (totalRecords, sampledRecords)
- `createdAt`

Schemas/DB:
- `convex/functions/predictions/schemas.ts`
- `convex/schema.ts`

---

## ML Command Cheat Sheet

### Training Commands

```bash
# Train models and export results to CSV
npm run ml:train

# Export training results to CSV only (without retraining)
npm run ml:export-results
```

**Output:** `ml/training-results.csv`

### Version Management Commands

```bash
# Rename a version tag (copies models and deletes old tag)
npm run ml:rename-tag -- "dev-temp" "dev-1"
npm run ml:rename-tag -- "dev-1" "prod-1"

# List all version tags with statistics
npm run ml:list-versions

# Switch active production version
npm run ml:switch-prod -- "prod-1"

# Delete a version tag
npm run ml:delete-version -- "dev-1"
npm run ml:delete-version -- "prod-1"  # Requires confirmation
```

### Analysis Commands

```bash
# Compare training results summaries
npm run ml:compare
```

---

## How to run ML

### Train models and export CSV

```bash
npm run ml:train
```

This command:
1. Trains all ML models using historical data
2. Saves models with version tag `"dev-temp"`
3. Exports training results to CSV

### Export CSV only

```bash
npm run ml:export-results
```

**Output:**
- `ml/training-results.csv`

**Export script:**
- `scripts/ml/export-training-results-from-convex.ts`

---

## Model Versioning System

### Overview

The ML system uses a simple tag-based versioning scheme to separate development and production models, enabling safe experimentation while maintaining stable production predictions. Models progress through a lifecycle: **dev-temp** → **dev-x** → **prod-y**.

### Version Lifecycle

```
Training → dev-temp → dev-x → prod-y → Production Predictions
          (auto)     (rename)  (rename)  (switch)
```

1. **Training**: New models are automatically saved with `versionTag: "dev-temp"`
2. **Rename to dev**: Manually rename dev-temp to a named dev version (e.g., "dev-1", "dev-2")
3. **Rename to prod**: Manually rename a dev version to a production version (e.g., "prod-1", "prod-2")
4. **Activate prod**: Set the production version tag as active for predictions

### Version Tags

Version tags are arbitrary strings. Common conventions:
- **"dev-temp"**: Temporary development version created during training (default)
- **"dev-1"**, **"dev-2"**, etc.: Named development versions for testing and evaluation
- **"prod-1"**, **"prod-2"**, etc.: Production versions used for real-time predictions

You can use any tag format (e.g., "staging-1", "experimental-abc"), but the `dev-*` and `prod-*` prefixes are recommended for clarity.

### Database Schema

Models include a single versioning field:
- `versionTag`: `string` (e.g., "dev-temp", "dev-1", "prod-1")

The `modelConfig` table stores the active production version tag used for predictions.

### Version Management Workflow

#### 1. Rename version tag

```bash
npm run ml:rename-tag -- <from-tag> <to-tag>
```

Renames a version tag by copying all models to the new tag and deleting the old tag. This is the primary way to promote models through the lifecycle.

**Examples:**
```bash
# Rename dev-temp to a named dev version
npm run ml:rename-tag -- "dev-temp" "dev-1"

# Rename dev version to prod version
npm run ml:rename-tag -- "dev-1" "prod-1"
```

**Note:** Cannot rename the currently active production version. Switch to a different version first.

#### 2. List all versions

```bash
npm run ml:list-versions
```

Displays all version tags with:
- Model counts per version
- Creation timestamps
- Currently active production version (marked with ⭐)

**Example output:**
```
📦 Development Versions:
  dev-temp       12 models  created: 2024-01-15T10:30:00.000Z
  dev-1          45 models  created: 2024-01-14T08:00:00.000Z

🚀 Production Versions:
  prod-1         45 models  created: 2024-01-14T08:00:00.000Z ⭐ ACTIVE
  prod-2         48 models  created: 2024-01-13T15:20:00.000Z

✅ Active production version: prod-1
```

#### 3. Switch production version

```bash
npm run ml:switch-prod -- <version-tag>
```

Changes the active production version tag used for predictions without creating new models.

**Example:**
```bash
npm run ml:switch-prod -- "prod-2"
```

This switches predictions to use `prod-2` (must already exist).

#### 4. Delete version tag

```bash
npm run ml:delete-version -- <version-tag>
```

Deletes all models for a specific version tag. Requires confirmation for production versions and prevents deletion of the currently active production version.

**Examples:**
```bash
npm run ml:delete-version -- "dev-1"      # Delete dev-1
npm run ml:delete-version -- "dev-temp"   # Delete dev-temp
npm run ml:delete-version -- "prod-2"     # Delete prod-2 (with confirmation)
```

### Production Version Selection

The prediction system automatically uses the active production version tag stored in the `modelConfig` table. When making predictions:

1. The system queries `modelConfig` for the current `productionVersionTag`
2. Models are loaded with the specified `versionTag`
3. If no production version tag is set, the system falls back to any model matching pair+type

**Implementation:**
- Query: `convex/functions/predictions/queries.ts` (`getModelParametersForProduction`)
- Prediction: `convex/domain/ml/prediction/predictTrip.ts` (`loadModelForPair`)

### Best Practices

1. **Training Workflow**:
   - Run `npm run ml:train` to create new models with tag `"dev-temp"`
   - Evaluate dev-temp performance before renaming
   - Rename to a named dev tag (e.g., "dev-1") when satisfied with results

2. **Production Deployment**:
   - Test dev versions thoroughly before renaming to prod
   - Use descriptive tag names (e.g., "prod-1", "prod-2")
   - Keep dev versions for reference after renaming to prod
   - Remember to activate the production version after renaming

3. **Version Management**:
   - List versions regularly to track model history
   - Switch production versions during low-traffic periods
   - Delete old versions only after confirming new versions work correctly

4. **Safety**:
   - The system prevents deletion of the active production version
   - Always switch to a different prod version before deleting
   - Production version changes take effect immediately for new predictions

### Database Indexes

Version-aware indexes enable efficient queries:
- `by_pair_type_tag`: Query by route, model type, and version tag
- `by_version_tag`: Query all models for a specific version tag

**Schema:**
- `convex/functions/predictions/schemas.ts` (`modelParametersSchema`)
- `convex/schema.ts` (table definitions)

---

## Integration notes (future)

### PrevTerminalAbbrev must represent A (not B)
In-service chain bucketing depends on knowing A (the previous trip’s departing terminal).

We corrected a bug where `PrevTerminalAbbrev` was incorrectly set to the previous trip’s arrival (B) instead of its departure (A). Any future prediction integration should preserve this semantic meaning so that A→B context features remain correct.

### Arrival proxy noise
Since `EstArrival` is a proxy, models will inherit noise in:
- slack calculations
- “arrival vs estimated schedule” features
- arrival targets

This is expected, but should be monitored when evaluating error distributions.

### Negative predictions
Targets are signed minutes; early departures are rare but allowed.
In production inference, strongly negative predictions should be treated as a safety signal and clamped/fallback if needed.

---

## File structure

```
convex/domain/ml/
├── readme-ml.md                      # This documentation
├── shared/                           # Shared config + time feature utilities
├── prediction/                       # Inference helpers
└── training/
    ├── actions.ts
    ├── pipeline.ts
    ├── data/
    │   ├── loadTrainingData.ts
    │   ├── createTrainingWindows.ts
    │   └── createTrainingBuckets.ts
    └── models/
        ├── trainModels.ts
        └── storeModels.ts
```

Convex functions for storage/queries:

```
convex/functions/predictions/
├── schemas.ts
├── mutations.ts
└── queries.ts
```

Version management scripts:

```
scripts/ml/
├── ml-version-rename.ts
├── ml-version-list.ts
├── ml-version-switch-prod.ts
├── ml-version-delete.ts
├── export-training-results-from-convex.ts
├── compare-summaries.ts
└── migrate-to-version-tag.ts
```
