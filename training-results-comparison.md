# Training Results Comparison: baseline vs training-results

Comparing ML model performance between baseline and training-results

**Interpretation:**
- Positive MAE difference = training-results performs worse (higher error)
- Negative MAE difference = training-results performs better (lower error)
- Positive R² difference = training-results performs better (higher explanatory power)
- Negative R² difference = training-results performs worse (lower explanatory power)

## Detailed Comparison

| Terminal Pair | Departure MAE |  |  | Departure R² |  |  | Arrival MAE |  |  | Arrival R² |  |  | Records |
|---------------|---------------|----------|----------|--------------|---------|---------|-------------|----------|----------|------------|---------|---------|---------|
|               | baseline      | training-results | Diff     | baseline     | training-results | Diff    | baseline    | training-results | Diff     | baseline   | training-results | Diff    |         |
| ANA_LOP       |         4.877 |    4.774 |   -0.103 |        0.184 |   0.278 |  +0.094 |       5.447 |    5.215 |   -0.232 |     -0.340 |  -0.212 |  +0.128 |     117 |
| BBI_P52       |         4.283 |    3.281 |   -1.002 |        0.064 |   0.265 |  +0.201 |       2.193 |    2.186 |   -0.007 |     -0.056 |  -0.040 |  +0.016 |     543 |
| BRE_P52       |         1.925 |    1.778 |   -0.147 |       -0.012 |   0.038 |  +0.050 |       2.461 |    2.438 |   -0.022 |      0.100 |   0.115 |  +0.015 |     358 |
| CLI_MUK       |         2.855 |    2.372 |   -0.483 |        0.009 |   0.174 |  +0.165 |       1.404 |    1.389 |   -0.015 |      0.063 |   0.073 |  +0.009 |     854 |
| COU_POT       |         2.566 |    2.158 |   -0.408 |        0.024 |   0.215 |  +0.191 |       2.187 |    2.127 |   -0.060 |      0.115 |  -0.000 |  -0.115 |     223 |
| EDM_KIN       |         2.705 |    2.434 |   -0.271 |        0.059 |   0.162 |  +0.103 |       1.659 |    1.644 |   -0.015 |     -0.072 |  -0.034 |  +0.038 |     552 |
| FAU_VAI       |         3.262 |    2.889 |   -0.373 |        0.485 |   0.537 |  +0.052 |       1.469 |    1.458 |   -0.011 |      0.007 |   0.013 |  +0.007 |     624 |
| FRH_LOP       |         5.305 |    3.485 |   -1.820 |       -0.015 |   0.420 |  +0.435 |       5.760 |    5.721 |   -0.039 |     -0.471 |  -0.484 |  -0.014 |     151 |
| KIN_EDM       |         2.948 |    2.636 |   -0.312 |       -0.012 |   0.093 |  +0.105 |       1.577 |    1.570 |   -0.007 |      0.172 |   0.175 |  +0.003 |     551 |
| LOP_ANA       |         3.593 |    3.247 |   -0.347 |        0.607 |   0.667 |  +0.060 |       5.578 |    5.133 |   -0.445 |     -0.649 |  -0.303 |  +0.346 |     176 |
| LOP_FRH       |         2.520 |    2.631 |   +0.111 |        0.519 |   0.404 |  -0.114 |       4.199 |    4.056 |   -0.143 |     -0.400 |  -0.211 |  +0.189 |     147 |
| MUK_CLI       |         2.254 |    1.897 |   -0.357 |        0.095 |   0.223 |  +0.128 |       1.460 |    1.454 |   -0.006 |      0.032 |   0.027 |  -0.004 |     857 |
| ORI_SHI       |         5.268 |    4.509 |   -0.759 |        0.068 |   0.182 |  +0.114 |       2.061 |    2.125 |   +0.064 |      0.203 |   0.017 |  -0.186 |     161 |
| P52_BBI       |         4.552 |    3.089 |   -1.462 |        0.006 |   0.332 |  +0.326 |       2.499 |    2.468 |   -0.031 |     -0.117 |  -0.091 |  +0.026 |     550 |
| P52_BRE       |         2.747 |    2.548 |   -0.198 |       -0.066 |  -0.047 |  +0.019 |       3.720 |    2.753 |   -0.967 |     -7.234 |   0.355 |  +7.589 |     360 |
| POT_COU       |         2.085 |    1.679 |   -0.405 |       -0.580 |  -0.974 |  -0.394 |       1.544 |    1.495 |   -0.048 |      0.144 |   0.276 |  +0.131 |     222 |
| PTD_TAH       |         5.947 |    5.047 |   -0.901 |       -0.118 |   0.017 |  +0.135 |       2.588 |    2.551 |   -0.037 |     -0.874 |  -0.851 |  +0.023 |     437 |
| SHI_LOP       |         1.534 |    1.510 |   -0.024 |        0.881 |   0.887 |  +0.005 |       2.583 |    2.564 |   -0.019 |     -0.133 |  -0.090 |  +0.043 |     110 |
| SHI_ORI       |         2.438 |    2.390 |   -0.047 |        0.776 |   0.775 |  -0.001 |       1.330 |    1.239 |   -0.092 |     -0.129 |  -0.011 |  +0.118 |     131 |
| SOU_FAU       |         2.741 |    2.679 |   -0.062 |        0.679 |   0.684 |  +0.005 |       3.839 |    3.593 |   -0.246 |     -0.275 |  -0.284 |  -0.009 |     151 |
| SOU_VAI       |         3.182 |    2.813 |   -0.370 |        0.486 |   0.574 |  +0.088 |       1.164 |    1.156 |   -0.009 |     -0.070 |  -0.074 |  -0.005 |     344 |
| TAH_PTD       |         3.014 |    2.624 |   -0.390 |       -0.095 |   0.101 |  +0.196 |       1.202 |    1.202 |   +0.000 |     -0.330 |  -0.378 |  -0.048 |     430 |
| VAI_FAU       |         4.128 |    3.217 |   -0.911 |        0.255 |   0.444 |  +0.189 |       1.821 |    1.863 |   +0.043 |      0.031 |  -0.039 |  -0.070 |     537 |
| VAI_SOU       |         4.236 |    3.212 |   -1.024 |        0.013 |   0.319 |  +0.307 |       1.271 |    1.257 |   -0.014 |     -0.080 |  -0.088 |  -0.008 |     433 |
| **AVERAGE**       |         3.373 |    2.871 |   -0.503 |        0.180 |   0.282 |  +0.102 |       2.542 |    2.444 |   -0.098 |     -0.432 |  -0.089 |  +0.343 |    9019 |

## Summary Statistics

### Departure Model
**Average MAE difference:** -0.503
**Average R² difference:** +0.102
**Better MAE performance (training-results):** 23/24 terminal pairs
**Better R² performance (training-results):** 21/24 terminal pairs

### Arrival Model
**Average MAE difference:** -0.098
**Average R² difference:** +0.343
**Better MAE performance (training-results):** 21/24 terminal pairs
**Better R² performance (training-results):** 15/24 terminal pairs

## Comparison Summary

Out of 24 routes tested with sufficient data (≥100 records):
- 44 route-model combinations perform better with training-results
- 4 route-model combinations perform better with baseline

**RECOMMENDATION:** training-results performs better overall

---
*Generated on 2025-12-21T01:54:49.526Z*