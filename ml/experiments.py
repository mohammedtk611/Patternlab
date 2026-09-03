import pandas as pd
import numpy as np
from ml.training import train_and_evaluate

def run_feature_ablation(df, target, dropped_feature, features, problem_type, model_name, config):
    """
    Runs the pipeline with one feature removed to test its usefulness.
    """
    if dropped_feature in features:
        new_features = [f for f in features if f != dropped_feature]
    else:
        return None, "Feature to drop not found in selected features."
        
    metrics, err = train_and_evaluate(df, target, new_features, problem_type, model_name, config)
    if err:
        return None, err
        
    # Return the new metrics along with the ablation details
    return {
        "metrics": metrics,
        "dropped_feature": dropped_feature,
        "new_feature_count": len(new_features)
    }, None

def run_noise_injection(df, target, noise_feature, noise_level_pct, features, problem_type, model_name, config):
    """
    Injects noise into a specific feature and retrains.
    """
    if noise_feature not in df.columns:
        return None, f"Feature {noise_feature} not found in dataframe."
        
    df_noisy = df.copy()
    
    # Check if numerical
    if pd.api.types.is_numeric_dtype(df_noisy[noise_feature]):
        std = df_noisy[noise_feature].std()
        noise = np.random.normal(0, std * (noise_level_pct / 100.0), size=len(df_noisy))
        df_noisy[noise_feature] += noise
    else:
        # Categorical noise: shuffle a percentage of values
        num_to_shuffle = int(len(df_noisy) * (noise_level_pct / 100.0))
        if num_to_shuffle > 0:
            indices = np.random.choice(df_noisy.index, num_to_shuffle, replace=False)
            shuffled_vals = df_noisy.loc[indices, noise_feature].sample(frac=1).values
            df_noisy.loc[indices, noise_feature] = shuffled_vals
            
    metrics, err = train_and_evaluate(df_noisy, target, features, problem_type, model_name, config)
    if err:
        return None, err
        
    return {
        "metrics": metrics,
        "noise_feature": noise_feature,
        "noise_level_pct": noise_level_pct
    }, None

def run_feature_engineering(df, target, engineered_feature_config, features, problem_type, model_name, config):
    """
    Applies a simple transformation and retrains.
    engineered_feature_config: dict with 'original_feature' and 'transformation_type' (e.g. 'squared', 'log', 'sqrt')
    """
    df_eng = df.copy()
    orig_feat = engineered_feature_config['original_feature']
    trans_type = engineered_feature_config['transformation_type']
    
    if orig_feat not in df_eng.columns:
        return None, "Original feature not found."
        
    new_feat_name = f"{orig_feat}_{trans_type}"
    
    if trans_type == 'squared':
        df_eng[new_feat_name] = df_eng[orig_feat] ** 2
    elif trans_type == 'log':
        # Safely log transform
        min_val = df_eng[orig_feat].min()
        offset = abs(min_val) + 1 if min_val <= 0 else 0
        df_eng[new_feat_name] = np.log(df_eng[orig_feat] + offset)
    elif trans_type == 'sqrt':
        # Safely sqrt transform
        min_val = df_eng[orig_feat].min()
        if min_val < 0:
            df_eng[orig_feat] += abs(min_val)
        df_eng[new_feat_name] = np.sqrt(df_eng[orig_feat])
    else:
        return None, f"Unknown transformation {trans_type}"
        
    new_features = list(features)
    if new_feat_name not in new_features:
        new_features.append(new_feat_name)
        
    metrics, err = train_and_evaluate(df_eng, target, new_features, problem_type, model_name, config)
    if err:
        return None, err
        
    return {
        "metrics": metrics,
        "new_feature": new_feat_name,
        "transformation": trans_type
    }, None
