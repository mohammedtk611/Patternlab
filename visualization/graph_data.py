from visualization.feature_analysis import calculate_feature_correlations

def generate_graph_data(df, target=None, features=None):
    if df.empty:
        return {"nodes": [], "links": []}
        
    columns = list(df.columns)
    if not columns:
        return {"nodes": [], "links": []}
        
    # Default target to last column if invalid
    if not target or target not in columns:
        target = columns[-1]
        
    # Default features to all other columns if invalid
    if not features:
        features = [col for col in columns if col != target]
    else:
        features = [col for col in features if col in columns and col != target]
        
    correlations = calculate_feature_correlations(df, target, features)
    
    nodes = []
    edges = []
    
    # Add target node
    nodes.append({
        "id": "target",
        "name": target,
        "type": "target",
        "val": 12
    })
    
    # Add feature nodes and edges
    for i, feature in enumerate(features):
        corr = correlations.get(feature, 0.1)
        node_size = max(4, min(10, int(corr * 10) + 4))
        
        nodes.append({
            "id": f"feature_{i}",
            "name": feature,
            "type": "feature",
            "val": node_size,
            "correlation": corr
        })
        
        edges.append({
            "source": f"feature_{i}",
            "target": "target",
            "weight": max(0.05, float(corr))
        })
        
    return {
        "nodes": nodes,
        "links": edges
    }
