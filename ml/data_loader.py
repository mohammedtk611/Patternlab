import os
import pandas as pd

def load_dataset(filepath):
    try:
        df = pd.read_csv(filepath)
        if df.empty:
            return None, "The uploaded CSV file is empty."
        # Strip surrounding whitespace from column headers to prevent matching issues
        df.columns = [str(c).strip() for c in df.columns]
        return df, None
    except pd.errors.EmptyDataError:
        return None, "The uploaded CSV file is empty or corrupted."
    except Exception as e:
        return None, f"Error reading CSV: {str(e)}"

def get_demo_datasets(demo_folder):
    if not os.path.exists(demo_folder):
        return []
    
    datasets = []
    for filename in os.listdir(demo_folder):
        if filename.endswith('.csv'):
            datasets.append(filename)
    return datasets
