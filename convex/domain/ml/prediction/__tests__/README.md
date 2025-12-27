# ML Prediction Pipeline Tests

This directory contains comprehensive tests for the ML prediction pipeline.

## Test Structure

### Unit Tests

**`step_1_extractFeatures.test.ts`**
- Tests feature extraction functions
- Validates time-based feature extraction
- Tests weekend/weekday detection
- Tests arrive-before calculations
- Tests depart-arrive feature extraction

**`step_3_makePrediction.test.ts`**
- Tests prediction calculation utilities
- Validates linear regression application
- Tests time conversion functions (delay to timestamp, duration to ETA)
- Tests MAE rounding to 0.01 minutes
- Tests prediction time validation and clamping

**`step_4_calculateInitialPredictions.test.ts`**
- Tests initial predictions orchestrator
- Validates parallel prediction execution
- Tests handling of skipped predictions
- Tests error handling

### Integration Tests

**`integration.test.ts`**
- Tests full prediction flows end-to-end
- Validates integration between all prediction steps
- Tests model loading, feature extraction, prediction, and validation
- Tests graceful degradation when models are missing
- Tests prediction time validation and clamping

## Running Tests

### Run All Tests
```bash
npm run test:ml
```

### Run Specific Test File
```bash
npm run test:ml -- step_1_extractFeatures.test.ts
```

### Run with Coverage
```bash
npm run test:ml -- --coverage
```

### Watch Mode
```bash
npm run test:ml -- --watch
```

## Test Coverage

The test suite aims to cover:

- ✅ Feature extraction (all feature types)
- ✅ Model loading and validation
- ✅ Prediction calculation (linear regression)
- ✅ Time conversion (relative to absolute timestamps)
- ✅ MAE rounding (to 0.01 minutes)
- ✅ Prediction validation (minimum time clamping)
- ✅ Parallel prediction execution
- ✅ Error handling and graceful degradation
- ✅ Integration between all pipeline steps

## Mocking Strategy

Tests use Vitest's `vi.mock()` to isolate dependencies:

- **Predictors**: Mocked in unit tests to test orchestrator logic
- **Model loading**: Mocked to test error handling
- **Feature extraction**: Mocked in integration tests to control test data
- **Prediction utilities**: Mocked to validate calculation flow

## Test Data

Tests use realistic mock data:
- Timestamps in milliseconds since epoch
- Terminal pairs (e.g., "P52-BBI", "MUK-CLI")
- Vessel abbreviations (e.g., "P52", "MUK")
- Delay values in minutes (e.g., 5.5, 3.2)
- At-sea durations in minutes (e.g., 35.2, 30.0)
- At-dock durations in minutes (e.g., 15.5, 20.0)

