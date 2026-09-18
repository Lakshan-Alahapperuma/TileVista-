"""
Part 4: AI Model Evaluation Script
Baseline vs Single-Stage XGBoost vs Two-Stage XGBoost

Evaluated on the frozen synthetic TileVista development dataset.
Do NOT modify the synthetic dataset or retrain on test data.
"""
import requests
import pandas as pd
import numpy as np
from sklearn.metrics import (
    mean_absolute_error,
    root_mean_squared_error,
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
)
import xgboost as xgb
import json
import os
import sys
from datetime import datetime

# ============================================================================
# Canonical ADI/CV2 Classification
# Source: demand_profiling_report.md (profiling.js over 2026-02-21 to 2026-08-20)
# Methodology:
#   ADI = totalCanonicalDays (181) / daysWithPositiveNetSales
#   CV2 = (sample_std / mean)^2 of non-zero daily demand values
#         sample_std uses (n-1) denominator
#   Thresholds: ADI > 1.32 and CV2 > 0.49 => Lumpy
#               ADI > 1.32 and CV2 <= 0.49 => Intermittent
# Result: 44 Intermittent, 5 Lumpy, 0 Smooth, 0 Erratic
#
# The 5 Lumpy products (CV2 > 0.49):
#   Vitosa Brown (CV2=0.54), Mosaic -Glossy Glass-oasis blue (CV2=0.57),
#   Rain Shower (CV2=0.74), Celeste Wall Hung Water Closet (CV2=1.40),
#   Exposed Thermostatic Shower Mixer - Chrome Finish (CV2=1.28)
#
# This mapping is derived from the canonical profiling pipeline result
# and is valid for the current frozen synthetic dataset only.
# ============================================================================
LUMPY_PRODUCT_NAMES = {
    'Vitosa Brown',
    'Mosaic -Glossy Glass-oasis blue',
    'Rain Shower',
    'Celeste Wall Hung Water Closet',
    'Exposed Thermostatic Shower Mixer - Chrome Finish',
}
REPORT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'reports')
os.makedirs(REPORT_DIR, exist_ok=True)


def get_demand_class(product_name):
    """Returns the canonical ADI/CV2 demand class for a product."""
    return 'Lumpy' if product_name in LUMPY_PRODUCT_NAMES else 'Intermittent'


def wmape(y_true, y_pred):
    """Weighted Mean Absolute Percentage Error with zero-division guard."""
    y_true_np = np.array(y_true, dtype=float)
    y_pred_np = np.array(y_pred, dtype=float)
    denom = np.sum(np.abs(y_true_np))
    if denom == 0:
        if np.sum(np.abs(y_true_np - y_pred_np)) == 0:
            return 0.0
        return float('inf')
    return float(np.sum(np.abs(y_true_np - y_pred_np)) / denom)


def fmt_wmape(val):
    if val == float('inf'):
        return 'N/A (zero actuals)'
    return f'{val:.4f}'


def evaluate_predictions(y_true, y_pred):
    """Returns dict of MAE, RMSE, WMAPE for a set of predictions."""
    return {
        'mae': mean_absolute_error(y_true, y_pred),
        'rmse': root_mean_squared_error(y_true, y_pred),
        'wmape': wmape(y_true, y_pred),
    }


def main():
    # ── 1. Fetch dataset ──────────────────────────────────────────────
    print('Fetching dataset from TileVista API...')
    try:
        resp = requests.get('http://localhost:4000/api/admin/analytics/ai/dataset')
        resp.raise_for_status()
    except Exception as e:
        print(f'FATAL: Could not fetch dataset: {e}')
        sys.exit(1)

    payload = resp.json()
    metadata = payload['metadata']
    df = pd.DataFrame(payload['data'])
    print(f'Loaded {len(df)} rows, {metadata["productCount"]} products, '
          f'{len(metadata["featureColumns"])} features.')

    # ── 2. Assign canonical demand classes ─────────────────────────────
    df['demand_class'] = df['productName'].apply(get_demand_class)
    class_counts = df.groupby('demand_class')['productId'].nunique()
    print(f'Demand classes (unique products): {dict(class_counts)}')

    # ── 3. Train/test split ────────────────────────────────────────────
    df_train = df[df['split'] == 'train'].copy()
    df_test  = df[df['split'] == 'test'].copy()

    feature_cols = metadata['featureColumns']
    target_col   = metadata['targetColumn']

    X_train = df_train[feature_cols]
    y_train = df_train[target_col]
    X_test  = df_test[feature_cols]
    y_test  = df_test[target_col]

    # ── 4. Baseline ────────────────────────────────────────────────────
    print('Computing Baseline...')
    df_test['pred_baseline'] = df_test['sales_last_30d'].apply(
        lambda x: max(0, int(round(x)))
    )

    # ── 5. Single-stage XGBoost ────────────────────────────────────────
    print('Training Single-Stage XGBoost...')
    ss_params = {
        'n_estimators': 100,
        'max_depth': 5,
        'learning_rate': 0.1,
        'random_state': 42,
        'objective': 'reg:squarederror',
    }
    ss_model = xgb.XGBRegressor(**ss_params)
    ss_model.fit(X_train, y_train)

    raw_ss = ss_model.predict(X_test)
    df_test['pred_single_stage'] = np.maximum(0, np.round(raw_ss)).astype(int)

    # ── 6. Two-stage XGBoost ───────────────────────────────────────────
    print('Training Two-Stage XGBoost...')

    # Stage 1: binary classifier (demand > 0 ?)
    y_train_bin = (y_train > 0).astype(int)
    y_test_bin  = (y_test  > 0).astype(int)

    ts_clf_params = {
        'n_estimators': 100,
        'max_depth': 4,
        'learning_rate': 0.1,
        'random_state': 42,
        'objective': 'binary:logistic',
        'eval_metric': 'logloss',
    }
    ts_clf = xgb.XGBClassifier(**ts_clf_params)
    ts_clf.fit(X_train, y_train_bin)

    stage1_pred = ts_clf.predict(X_test)

    # Stage 1 classification metrics
    s1_accuracy  = accuracy_score(y_test_bin, stage1_pred)
    s1_precision = precision_score(y_test_bin, stage1_pred, zero_division=0)
    s1_recall    = recall_score(y_test_bin, stage1_pred, zero_division=0)
    s1_f1        = f1_score(y_test_bin, stage1_pred, zero_division=0)
    s1_cm        = confusion_matrix(y_test_bin, stage1_pred)

    print(f'Stage 1 F1={s1_f1:.4f}, Accuracy={s1_accuracy:.4f}')

    # Stage 2: regressor trained only on positive-demand training rows
    pos_mask = y_train > 0
    X_train_pos = X_train[pos_mask]
    y_train_pos = y_train[pos_mask]

    ts_reg_params = {
        'n_estimators': 100,
        'max_depth': 5,
        'learning_rate': 0.1,
        'random_state': 42,
        'objective': 'reg:squarederror',
    }
    ts_reg = xgb.XGBRegressor(**ts_reg_params)
    ts_reg.fit(X_train_pos, y_train_pos)

    raw_s2 = ts_reg.predict(X_test)
    two_stage_pred = np.where(
        stage1_pred == 0, 0,
        np.maximum(0, np.round(raw_s2)).astype(int)
    )
    df_test['pred_two_stage'] = two_stage_pred

    # ── 7. Evaluation ──────────────────────────────────────────────────
    print('Evaluating all three models...')

    def eval_slice(df_s):
        """Evaluate all 3 predictions on a DataFrame slice."""
        if len(df_s) == 0:
            return None
        y = df_s[target_col]
        return {
            'n_rows': len(df_s),
            'n_products': df_s['productId'].nunique(),
            'baseline':     evaluate_predictions(y, df_s['pred_baseline']),
            'single_stage': evaluate_predictions(y, df_s['pred_single_stage']),
            'two_stage':    evaluate_predictions(y, df_s['pred_two_stage']),
        }

    overall = eval_slice(df_test)

    origins = sorted(df_test['forecastOriginDate'].unique())
    by_origin = {o: eval_slice(df_test[df_test['forecastOriginDate'] == o])
                 for o in origins}

    classes = sorted(df_test['demand_class'].unique())
    by_class = {c: eval_slice(df_test[df_test['demand_class'] == c])
                for c in classes}

    # Feature importance
    ss_imp = pd.DataFrame({
        'Feature': feature_cols,
        'Gain': ss_model.feature_importances_,
    }).sort_values('Gain', ascending=False)

    ts_imp = pd.DataFrame({
        'Feature': feature_cols,
        'Gain': ts_reg.feature_importances_,
    }).sort_values('Gain', ascending=False)

    # ── 8. Generate Report ─────────────────────────────────────────────
    print('Generating report...')

    def row3(metric, res):
        b = res['baseline'][metric]
        s = res['single_stage'][metric]
        t = res['two_stage'][metric]
        if metric == 'wmape':
            return f'| **{metric.upper()}** | {fmt_wmape(b)} | {fmt_wmape(s)} | {fmt_wmape(t)} |'
        return f'| **{metric.upper()}** | {b:.4f} | {s:.4f} | {t:.4f} |'

    md = f"""# Part 4: AI Model Evaluation Report
> Evaluated on the **frozen synthetic TileVista development dataset**.
> Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}

## 1. Dataset Dimensions

| Item | Value |
|---|---|
| Training rows | {metadata['trainRows']} |
| Test rows | {metadata['testRows']} |
| Unique products | {metadata['productCount']} |
| Test forecast origins | {', '.join(metadata['testOrigins'])} |
| Features | {len(feature_cols)} |
| Demand classes | 44 Intermittent / 5 Lumpy (canonical ADI/CV2 profiling) |

## 2. Model Configurations

### Baseline
`predicted_demand = sales_last_30d` (assume the next 30 days repeat the previous 30 days)

### Single-Stage XGBoost
`XGBRegressor` trained on all {metadata['trainRows']} training rows.
```json
{json.dumps(ss_params, indent=2)}
```

### Two-Stage XGBoost
**Stage 1:** `XGBClassifier` trained on all {metadata['trainRows']} rows, predicting whether any demand occurs in the next 30 days.
```json
{json.dumps(ts_clf_params, indent=2)}
```
**Stage 2:** `XGBRegressor` trained on {int(pos_mask.sum())} positive-demand training rows only.
```json
{json.dumps(ts_reg_params, indent=2)}
```
**Combined:** If Stage 1 predicts no demand, final = 0. Otherwise, final = max(0, round(Stage 2 output)).

All models use `random_state=42` for reproducibility.

## 3. Stage 1 Classification Metrics (Two-Stage Only)

Stage 1 predicts a binary label: will any demand occur in the next 30 days?

| Metric | Value |
|---|---|
| **Accuracy** | {s1_accuracy:.4f} |
| **Precision** | {s1_precision:.4f} |
| **Recall** | {s1_recall:.4f} |
| **F1-Score** | {s1_f1:.4f} |

**Confusion Matrix** (rows = actual, columns = predicted):

|  | Predicted: No Demand | Predicted: Demand |
|---|---|---|
| **Actual: No Demand** | {s1_cm[0][0]} | {s1_cm[0][1]} |
| **Actual: Demand** | {s1_cm[1][0]} | {s1_cm[1][1]} |

## 4. Overall Performance (30-Day Demand Prediction)

| Metric | Baseline | Single-Stage XGBoost | Two-Stage XGBoost |
|---|---|---|---|
{row3('mae', overall)}
{row3('rmse', overall)}
{row3('wmape', overall)}

## 5. Performance by Forecast Origin
"""

    for orig in origins:
        res = by_origin[orig]
        md += f"""
### Origin: {orig} (Products: {res['n_products']}, Rows: {res['n_rows']})
| Metric | Baseline | Single-Stage | Two-Stage |
|---|---|---|---|
{row3('mae', res)}
{row3('rmse', res)}
{row3('wmape', res)}
"""

    md += """
## 6. Performance by Demand Class
> Classification source: canonical ADI/CV2 profiling (profiling.js over 181-day window).
> Thresholds: ADI > 1.32 and CV2 > 0.49 = Lumpy; ADI > 1.32 and CV2 <= 0.49 = Intermittent.
"""

    for cls in classes:
        res = by_class[cls]
        if res:
            md += f"""
### {cls} Demand (Products: {res['n_products']}, Test Rows: {res['n_rows']})
| Metric | Baseline | Single-Stage | Two-Stage |
|---|---|---|---|
{row3('mae', res)}
{row3('rmse', res)}
{row3('wmape', res)}
"""

    md += """
## 7. Feature Importance

### Single-Stage XGBoost (Top 10)
| Feature | Gain |
|---|---|
"""
    for _, r in ss_imp.head(10).iterrows():
        md += f"| `{r['Feature']}` | {r['Gain']:.4f} |\n"

    md += """
### Two-Stage Regressor (Top 10)
| Feature | Gain |
|---|---|
"""
    for _, r in ts_imp.head(10).iterrows():
        md += f"| `{r['Feature']}` | {r['Gain']:.4f} |\n"

    # Determine winner
    results = {
        'Baseline': overall['baseline']['mae'],
        'Single-Stage XGBoost': overall['single_stage']['mae'],
        'Two-Stage XGBoost': overall['two_stage']['mae'],
    }
    winner = min(results, key=results.get)
    sorted_results = sorted(results.items(), key=lambda x: x[1])

    md += f"""
## 8. Conclusion

**Ranking by Overall MAE (lower is better):**

| Rank | Model | MAE |
|---|---|---|
"""
    for i, (name, mae_val) in enumerate(sorted_results, 1):
        md += f"| {i} | {'**' + name + '**' if name == winner else name} | {mae_val:.4f} |\n"

    md += f"""
The **{winner}** achieved the lowest overall MAE on this dataset.

## 9. Limitations

- **Synthetic data only.** All models were trained and evaluated on the frozen synthetic TileVista development dataset, not real showroom historical data. The relationships learned reflect patterns generated by the mock seeder.
- **Short history.** The canonical window covers approximately 6 months, which limits the ability to learn long-term or annual seasonality.
- **Small catalog.** Only 49 products are represented, with highly imbalanced demand classes (44 Intermittent / 5 Lumpy).
- **Frozen experiment.** No hyperparameter tuning, cross-validation, or ensemble methods were applied. This is a single controlled comparison under fixed conditions.
"""

    report_path = os.path.join(REPORT_DIR, 'model_evaluation_report.md')
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(md)

    print(f'Report saved to: {report_path}')
    print(f'Winner: {winner} (MAE={results[winner]:.4f})')


if __name__ == '__main__':
    main()
