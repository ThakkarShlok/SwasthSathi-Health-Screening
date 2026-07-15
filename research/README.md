# SwasthSathi — ML Validation Study (Phase 3)

Validation and recalibration of the rule-based risk calculator (v1.4) 
against NFHS-5 (2019-21) individual recode microdata with measured 
blood glucose and blood pressure.

## Contents
- `notebooks/` — Colab notebooks for the validation study
- `figures/` — ROC curves, calibration plots, confusion matrices, 
  coefficient comparisons (committed; these go in the grant report)
- `data/` — NFHS-5 microdata (GITIGNORED, never committed per DHS terms)

## Data source
NFHS-5 India, obtained via DHS Program (dhsprogram.com) under an 
approved student research project. Data is NOT redistributed.

## Purpose
1. Validate rule-based v1.4 risk stratification against measured biomarkers
2. Train logistic regression + gradient boosted tree baselines on the same data
3. Compare all three on AUC, sensitivity/specificity, calibration
4. Derive recalibrated risk weights (v1.5) from fitted model coefficients
5. Decide: ship recalibrated weights, or keep v1.4 and report the comparison as a validation finding