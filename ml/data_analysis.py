import pandas as pd
import numpy as np

def analyze_dataset(df):
    row_count = len(df)
    col_count = len(df.columns)
    
    numerical_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()
    
    columns_info = []
    
    for col in df.columns:
        dtype = str(df[col].dtype)
        missing_count = int(df[col].isnull().sum())
        missing_pct = round((missing_count / row_count) * 100, 2) if row_count > 0 else 0
        
        col_type = "numerical" if col in numerical_cols else "categorical"
        
        info = {
            "name": col,
            "type": col_type,
            "dtype": dtype,
            "missing_count": missing_count,
            "missing_percentage": missing_pct
        }
        
        # Add basic stats for numerical columns safely
        if col_type == "numerical":
            valid_series = df[col].dropna()
            if not valid_series.empty:
                mean_val = valid_series.mean()
                min_val = valid_series.min()
                max_val = valid_series.max()
                
                info["mean"] = float(mean_val) if not np.isnan(mean_val) and not np.isinf(mean_val) else None
                info["min"] = float(min_val) if not np.isnan(min_val) and not np.isinf(min_val) else None
                info["max"] = float(max_val) if not np.isnan(max_val) and not np.isinf(max_val) else None
            else:
                info["mean"] = None
                info["min"] = None
                info["max"] = None
            
        # Add cardinality for categorical columns
        if col_type == "categorical":
            info["unique_values"] = int(df[col].nunique())
            
        columns_info.append(info)
        
    return {
        "row_count": row_count,
        "column_count": col_count,
        "numerical_columns_count": len(numerical_cols),
        "categorical_columns_count": len(categorical_cols),
        "columns": columns_info
    }

def infer_problem_type(df, target_col):
    if target_col not in df.columns:
        return "Unknown"
    
    col_data = df[target_col].dropna()
    if col_data.empty:
        return "Regression"
        
    unique_count = col_data.nunique()
    dtype = col_data.dtype
    
    # 1. Non-numeric or boolean data
    if not np.issubdtype(dtype, np.number) or pd.api.types.is_bool_dtype(dtype):
        if unique_count == 2:
            return "Binary Classification"
        return "Multiclass Classification"
        
    # 2. Numeric data
    if unique_count == 2:
        return "Binary Classification"
        
    # If it's a floating point column and contains fractional values, it's Regression
    if np.issubdtype(dtype, np.floating):
        is_all_ints = False
        try:
            is_all_ints = (col_data % 1 == 0).all()
        except Exception:
            pass
            
        if not is_all_ints:
            return "Regression"
            
    # For integer or integer-like values: small distinct values indicate classification
    if unique_count <= 10 and len(col_data) >= 20:
        return "Multiclass Classification"
        
    return "Regression"
