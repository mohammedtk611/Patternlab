import os
from flask import Blueprint, render_template, request, jsonify, current_app
from flask_login import current_user
from ml.data_loader import load_dataset, get_demo_datasets
from database.models import Dataset
from visualization.graph_data import generate_graph_data
from visualization.dimensionality_reduction import reduce_dimensions

visualization_bp = Blueprint('visualization', __name__)

@visualization_bp.route('/visualization')
def visualization_page():
    demo_folder = current_app.config.get('DEMO_DATASETS_FOLDER', '')
    demo_datasets = get_demo_datasets(demo_folder)
    user_datasets = []
    if current_user.is_authenticated:
        user_datasets = Dataset.query.filter_by(user_id=current_user.id).all()
        
    return render_template('visualization/visualization.html', demo_datasets=demo_datasets, user_datasets=user_datasets)

@visualization_bp.route('/api/visualization/graph', methods=['POST'])
def get_graph():
    data = request.get_json(silent=True) or {}
    filepath = data.get('filepath')
    target = data.get('target')
    features = data.get('features', [])
    
    if not filepath or not os.path.exists(filepath):
        return jsonify({"error": "Dataset not found"}), 404
        
    df, error = load_dataset(filepath)
    if error or df is None:
        return jsonify({"error": error or "Failed to load dataset."}), 400
        
    graph_data = generate_graph_data(df, target, features)
    return jsonify(graph_data)

@visualization_bp.route('/api/visualization/reduce', methods=['POST'])
def reduce_dim():
    data = request.get_json(silent=True) or {}
    filepath = data.get('filepath')
    features = data.get('features', [])
    method = data.get('method', 'pca')
    dimensions = int(data.get('dimensions', 3))
    
    if not filepath or not os.path.exists(filepath):
        return jsonify({"error": "Dataset not found"}), 404
        
    df, error = load_dataset(filepath)
    if error or df is None:
        return jsonify({"error": error or "Failed to load dataset."}), 400
        
    res, error = reduce_dimensions(df, features, method=method, n_components=dimensions)
    if error:
        return jsonify({"error": error}), 400
        
    return jsonify(res)
