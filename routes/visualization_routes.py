import os
from flask import Blueprint, render_template, request, jsonify
from ml.data_loader import load_dataset
from visualization.graph_data import generate_graph_data
from visualization.dimensionality_reduction import reduce_dimensions

visualization_bp = Blueprint('visualization', __name__)

@visualization_bp.route('/visualization')
def visualization_page():
    return render_template('visualization/visualization.html')

@visualization_bp.route('/api/visualization/graph', methods=['POST'])
def get_graph():
    data = request.get_json()
    filepath = data.get('filepath')
    target = data.get('target')
    features = data.get('features', [])
    
    if not filepath or not os.path.exists(filepath):
        return jsonify({"error": "Dataset not found"}), 404
        
    df, error = load_dataset(filepath)
    if error:
        return jsonify({"error": error}), 400
        
    graph_data = generate_graph_data(df, target, features)
    return jsonify(graph_data)

@visualization_bp.route('/api/visualization/reduce', methods=['POST'])
def reduce_dim():
    data = request.get_json()
    filepath = data.get('filepath')
    features = data.get('features', [])
    method = data.get('method', 'pca')
    dimensions = data.get('dimensions', 3)
    
    if not filepath or not os.path.exists(filepath):
        return jsonify({"error": "Dataset not found"}), 404
        
    df, error = load_dataset(filepath)
    if error:
        return jsonify({"error": error}), 400
        
    points, error = reduce_dimensions(df, features, method=method, n_components=dimensions)
    if error:
        return jsonify({"error": error}), 400
        
    return jsonify({"points": points})
