import pandas as pd
import numpy as np
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, MinMaxScaler, OneHotEncoder
from sklearn.model_selection import train_test_split

def create_preprocessing_pipeline(df, features, config=None):
    cfg = config or {}
    
    numeric_features = df[features].select_dtypes(include=[np.number]).columns.tolist()
    categorical_features = df[features].select_dtypes(exclude=[np.number]).columns.tolist()
    
    transformers = []
    
    # 1. Numerical Pipeline
    if numeric_features:
        numeric_transformer_steps = []
        
        # Missing values
        impute_strategy = cfg.get('missing_values', 'mean')
        if impute_strategy == 'median':
            numeric_transformer_steps.append(('imputer', SimpleImputer(strategy='median')))
        elif impute_strategy == 'most_frequent':
            numeric_transformer_steps.append(('imputer', SimpleImputer(strategy='most_frequent')))
        else:
            numeric_transformer_steps.append(('imputer', SimpleImputer(strategy='mean')))
            
        # Scaling
        scaling_strategy = cfg.get('scaling', 'standard')
        if scaling_strategy == 'standard':
            numeric_transformer_steps.append(('scaler', StandardScaler()))
        elif scaling_strategy == 'minmax':
            numeric_transformer_steps.append(('scaler', MinMaxScaler()))
        # 'none' skips scaler
        
        numeric_transformer = Pipeline(steps=numeric_transformer_steps)
        transformers.append(('num', numeric_transformer, numeric_features))
        
    # 2. Categorical Pipeline
    if categorical_features:
        categorical_transformer_steps = [
            ('imputer', SimpleImputer(strategy='most_frequent')),
            ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
        ]
        categorical_transformer = Pipeline(steps=categorical_transformer_steps)
        transformers.append(('cat', categorical_transformer, categorical_features))
        
    if not transformers:
        # Fallback if no features matched
        return 'passthrough'
        
    preprocessor = ColumnTransformer(transformers=transformers, remainder='drop')
    return preprocessor

def get_train_test_data(df, target, features, test_size=0.2, random_state=42, is_classification=False):
    X = df[features]
    y = df[target]
    
    # Drop rows where target is missing
    mask = y.notna()
    X = X[mask]
    y = y[mask]
    
    if len(X) <= 1:
        return X, X, y, y
        
    # Adjust test size if dataset is extremely small
    adjusted_test_size = test_size
    if len(X) < 10:
        adjusted_test_size = max(1, int(len(X) * 0.2))
        if adjusted_test_size >= len(X):
            adjusted_test_size = 1
            
    stratify = y if is_classification else None
    
    # Fallback to no stratify if categorical targets are too small for stratification
    if is_classification:
        value_counts = y.value_counts()
        if any(value_counts < 2) or len(value_counts) <= 1:
            stratify = None
            
    try:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=adjusted_test_size, random_state=random_state, stratify=stratify
        )
    except Exception:
        # Retry without stratification if error occurred
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=adjusted_test_size, random_state=random_state, stratify=None
        )
    
    return X_train, X_test, y_train, y_test
