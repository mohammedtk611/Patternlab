import pandas as pd
import numpy as np
from sklearn.feature_selection import f_classif, f_regression

def calculate_feature_correlations(df, target, features):
    """
    Calculate feature-target association strength between 0 and 1.
    Uses Pearson correlation for numeric-numeric, ANOVA F-scores for categorical-numeric,
    and group associations for categorical features.
    """
    if target not in df.columns or not features:
        return {}
        
    valid_features = [f for f in features if f in df.columns and f != target]
    if not valid_features:
        return {}
        
    df_clean = df.dropna(subset=[target] + valid_features)
    if df_clean.empty:
        return {f: 0.0 for f in valid_features}
        
    correlations = {}
    target_series = df_clean[target]
    is_target_numeric = pd.api.types.is_numeric_dtype(target_series) and target_series.nunique() > 10
    
    numeric_features = df_clean[valid_features].select_dtypes(include=[np.number]).columns.tolist()
    categorical_features = [f for f in valid_features if f not in numeric_features]
    
    # 1. Numerical target relationships
    if is_target_numeric:
        for feature in numeric_features:
            try:
                corr = df_clean[feature].corr(target_series)
                correlations[feature] = round(float(abs(corr)), 4) if not np.isnan(corr) else 0.0
            except Exception:
                correlations[feature] = 0.0
                
        for feature in categorical_features:
            try:
                # Group means variance ratio
                grouped = df_clean.groupby(feature)[target].mean()
                total_var = df_clean[target].var()
                if total_var > 0 and len(grouped) > 1:
                    group_var = grouped.var()
                    ratio = min(1.0, group_var / total_var)
                    correlations[feature] = round(float(ratio), 4)
                else:
                    correlations[feature] = 0.1
            except Exception:
                correlations[feature] = 0.1
    # 2. Categorical target relationships (Classification)
    else:
        # Convert target categories to codes
        y_codes = pd.Categorical(target_series).codes
        
        for feature in numeric_features:
            try:
                X_feat = df_clean[[feature]].values
                f_vals, p_vals = f_classif(X_feat, y_codes)
                if len(f_vals) > 0 and not np.isnan(f_vals[0]):
                    # Normalize F-stat to [0, 1] range using sigmoid/tanh
                    score = float(np.tanh(f_vals[0] / 50.0))
                    correlations[feature] = round(min(1.0, max(0.05, score)), 4)
                else:
                    correlations[feature] = 0.1
            except Exception:
                # Fallback: simple absolute correlation with codes
                try:
                    corr = abs(df_clean[feature].corr(pd.Series(y_codes, index=df_clean.index)))
                    correlations[feature] = round(float(corr), 4) if not np.isnan(corr) else 0.1
                except Exception:
                    correlations[feature] = 0.1
                    
        for feature in categorical_features:
            try:
                # Contingency matrix / Cramér's V approximation
                contingency = pd.crosstab(df_clean[feature], target_series)
                chi2 = 0
                if contingency.size > 1:
                    row_sums = contingency.sum(axis=1)
                    col_sums = contingency.sum(axis=0)
                    total = len(df_clean)
                    expected = np.outer(row_sums, col_sums) / total
                    chi2 = np.sum((contingency.values - expected) ** 2 / np.maximum(expected, 1e-5))
                    cramers_v = np.sqrt(chi2 / (total * max(1, min(contingency.shape) - 1)))
                    correlations[feature] = round(float(min(1.0, max(0.05, cramers_v))), 4)
                else:
                    correlations[feature] = 0.1
            except Exception:
                correlations[feature] = 0.1
                
    return correlations
