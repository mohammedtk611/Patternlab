import pandas as pd
import numpy as np
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer

def reduce_dimensions(df, features, method='pca', n_components=3):
    # Prepare data (numerical features only)
    valid_features = [f for f in features if f in df.columns]
    if not valid_features:
        return None, "No valid features specified for dimensionality reduction."
        
    X = df[valid_features].select_dtypes(include=[np.number])
    if X.empty:
        return None, "No numerical features available for dimensionality reduction."
        
    # Cap sample size for responsive t-SNE / 3D rendering
    max_samples = 1500
    if len(X) > max_samples:
        X = X.sample(n=max_samples, random_state=42)
        
    # Impute missing cells
    imputer = SimpleImputer(strategy='mean')
    X_imputed = imputer.fit_transform(X)
    
    # Standardize data
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_imputed)
    
    n_samples, n_features = X_scaled.shape
    if n_samples == 0:
        return None, "Dataset is empty."
        
    actual_components = min(n_components, n_features, n_samples)
    extra_info = {}
    
    try:
        if method == 'pca':
            reducer = PCA(n_components=actual_components, random_state=42)
            projections = reducer.fit_transform(X_scaled)
            extra_info['explained_variance'] = [round(float(v) * 100, 2) for v in reducer.explained_variance_ratio_]
            extra_info['total_variance_explained'] = round(float(np.sum(reducer.explained_variance_ratio_)) * 100, 2)
        elif method == 'tsne':
            # Adaptive perplexity for small datasets
            perplexity = min(30, max(2, (n_samples - 1) // 3))
            tsne_comp = min(actual_components, 3)
            reducer = TSNE(n_components=tsne_comp, perplexity=perplexity, random_state=42, n_iter=600)
            projections = reducer.fit_transform(X_scaled)
        elif method == 'umap':
            try:
                import umap
                reducer = umap.UMAP(n_components=actual_components, random_state=42)
                projections = reducer.fit_transform(X_scaled)
            except ImportError:
                reducer = PCA(n_components=actual_components, random_state=42)
                projections = reducer.fit_transform(X_scaled)
                extra_info['explained_variance'] = [round(float(v) * 100, 2) for v in reducer.explained_variance_ratio_]
        else:
            return None, f"Invalid dimensionality reduction method '{method}'."
            
        # Format point coordinates for 3D/2D visualization
        result = []
        n_out_comp = projections.shape[1]
        
        for i in range(len(projections)):
            point = {
                "id": i,
                "x": round(float(projections[i][0]), 4) if n_out_comp > 0 else 0.0,
                "y": round(float(projections[i][1]), 4) if n_out_comp > 1 else 0.0,
                "z": round(float(projections[i][2]), 4) if (n_components > 2 and n_out_comp > 2) else 0.0
            }
            result.append(point)
            
        return {"points": result, "meta": extra_info}, None
    except Exception as e:
        return None, f"Dimensionality reduction failed: {str(e)}"
