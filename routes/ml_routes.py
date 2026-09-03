import os
import json
import uuid
import numpy as np
from flask import Blueprint, render_template, request, jsonify, current_app
from werkzeug.utils import secure_filename
# pyrefly: ignore [missing-import]
from flask_login import current_user
from ml.data_loader import load_dataset, get_demo_datasets
from ml.data_analysis import analyze_dataset, infer_problem_type
from ml.models import get_available_models, get_available_models_with_metadata, get_model_metadata
from ml.training import train_and_evaluate
from ml.experiments import run_feature_ablation, run_feature_engineering, run_noise_injection
from database.db import db
from database.models import Dataset, MLExperiment, VisualizationRecord

ml_bp = Blueprint('ml', __name__)

def safe_json_dumps(obj):
    """Serialize any object including numpy types and sets safely to JSON string."""
    def default_serializer(o):
        if isinstance(o, (np.integer, int)):
            return int(o)
        if isinstance(o, (np.floating, float)):
            return float(o)
        if isinstance(o, (np.ndarray, set)):
            return list(o)
        if hasattr(o, 'isoformat'):
            return o.isoformat()
        return str(o)
    return json.dumps(obj, default=default_serializer)

@ml_bp.route('/builder')
def builder():
    return render_template('ml_builder/ml_builder.html')

@ml_bp.route('/api/datasets/demo', methods=['GET'])
def list_demo_datasets():
    demo_folder = current_app.config.get('DEMO_DATASETS_FOLDER', '')
    datasets = get_demo_datasets(demo_folder)
    return jsonify({"datasets": datasets})

@ml_bp.route('/api/upload', methods=['POST'])
def upload_dataset():
    if 'file' not in request.files:
        return jsonify({"error": "No file part in request."}), 400
        
    file = request.files['file']
    if not file or file.filename == '':
        return jsonify({"error": "No selected file."}), 400
        
    if current_user.is_authenticated:
        dataset_count = Dataset.query.filter_by(user_id=current_user.id).count()
        if dataset_count >= 5:
            return jsonify({"error": "Dataset limit reached. You can store up to 5 datasets. Please delete one first."}), 403
            
    original_filename = secure_filename(file.filename)
    if original_filename.lower().endswith('.csv'):
        # Generate unique storage filename to avoid collisions across uploads
        unique_prefix = uuid.uuid4().hex[:8]
        saved_filename = f"{unique_prefix}_{original_filename}"
        upload_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads')
        os.makedirs(upload_folder, exist_ok=True)
        filepath = os.path.join(upload_folder, saved_filename)
        
        try:
            # Check content length limit
            file.seek(0, os.SEEK_END)
            file_length = file.tell()
            file.seek(0)
            
            max_len = current_app.config.get('MAX_CONTENT_LENGTH', 5 * 1024 * 1024)
            if file_length > max_len:
                return jsonify({"error": f"File size ({round(file_length / (1024 * 1024), 2)}MB) exceeds 5MB limit."}), 413
                
            file.save(filepath)
            
            # Analyze dataset
            df, error = load_dataset(filepath)
            if error:
                if os.path.exists(filepath):
                    try:
                        os.remove(filepath)
                    except OSError:
                        pass
                return jsonify({"error": error}), 400
                
            analysis = analyze_dataset(df)
            dataset_id = None
            
            if current_user.is_authenticated:
                new_ds = Dataset(
                    user_id=current_user.id,
                    filename=original_filename,
                    file_size=file_length,
                    row_count=analysis['row_count'],
                    column_count=analysis['column_count'],
                    storage_path=filepath
                )
                db.session.add(new_ds)
                db.session.commit()
                dataset_id = new_ds.id
            
            return jsonify({
                "message": "File uploaded successfully",
                "filename": original_filename,
                "filepath": filepath,
                "dataset_id": dataset_id,
                "analysis": analysis
            })
        except Exception as e:
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                except OSError:
                    pass
            return jsonify({"error": f"Upload processing failed: {str(e)}"}), 500
    
    return jsonify({"error": "Invalid file type. Only CSV files are allowed."}), 400

@ml_bp.route('/api/dataset/<int:dataset_id>', methods=['DELETE', 'POST'])
def delete_dataset(dataset_id):
    if not current_user.is_authenticated:
        return jsonify({"error": "Authentication required."}), 401
        
    dataset = Dataset.query.filter_by(id=dataset_id, user_id=current_user.id).first()
    if not dataset:
        return jsonify({"error": "Dataset not found or unauthorized."}), 404
        
    try:
        # Cascade delete associated experiment and visualization records
        MLExperiment.query.filter_by(dataset_id=dataset.id).delete()
        VisualizationRecord.query.filter_by(dataset_id=dataset.id).delete()
        
        # Delete physical file from disk if it exists
        if dataset.storage_path and os.path.exists(dataset.storage_path):
            try:
                os.remove(dataset.storage_path)
            except OSError:
                pass
                
        db.session.delete(dataset)
        db.session.commit()
        return jsonify({"message": "Dataset deleted successfully."})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to delete dataset: {str(e)}"}), 500

@ml_bp.route('/api/load-demo', methods=['POST'])
def load_demo_dataset():
    data = request.get_json(silent=True) or {}
    filename = data.get('filename')
    if not filename:
        return jsonify({"error": "Filename required."}), 400
        
    safe_name = secure_filename(filename)
    demo_folder = current_app.config.get('DEMO_DATASETS_FOLDER', '')
    filepath = os.path.join(demo_folder, safe_name)
    
    # Path traversal protection
    real_demo_dir = os.path.abspath(demo_folder)
    real_file_path = os.path.abspath(filepath)
    if not real_file_path.startswith(real_demo_dir) or not os.path.exists(real_file_path):
        return jsonify({"error": f"Demo dataset '{safe_name}' not found."}), 404
        
    df, error = load_dataset(filepath)
    if error:
        return jsonify({"error": error}), 400
        
    analysis = analyze_dataset(df)
    
    return jsonify({
        "message": "Demo dataset loaded successfully",
        "filename": safe_name,
        "filepath": filepath,
        "analysis": analysis
    })

@ml_bp.route('/api/load-existing', methods=['POST'])
def load_existing():
    data = request.get_json(silent=True) or {}
    filepath = data.get('filepath')
    filename = data.get('filename')
    
    if not filepath or not os.path.exists(filepath):
        return jsonify({"error": "Dataset not found on server."}), 404
        
    # Authorization check if user is authenticated and loading non-demo dataset
    if current_user.is_authenticated:
        demo_folder = current_app.config.get('DEMO_DATASETS_FOLDER', '')
        is_demo = os.path.abspath(filepath).startswith(os.path.abspath(demo_folder)) if demo_folder else False
        if not is_demo:
            user_datasets = Dataset.query.filter_by(user_id=current_user.id).all()
            norm_target = os.path.normcase(os.path.abspath(filepath))
            is_owner = any(os.path.normcase(os.path.abspath(ds.storage_path)) == norm_target for ds in user_datasets)
            if not is_owner:
                return jsonify({"error": "Unauthorized access to dataset."}), 403
                
    df, error = load_dataset(filepath)
    if error:
        return jsonify({"error": error}), 400
        
    analysis = analyze_dataset(df)
    
    return jsonify({
        "message": "Dataset loaded successfully",
        "filename": filename or os.path.basename(filepath),
        "filepath": filepath,
        "analysis": analysis
    })

@ml_bp.route('/api/target', methods=['POST'])
def select_target():
    data = request.get_json(silent=True) or {}
    filepath = data.get('filepath')
    target = data.get('target')
    
    if not filepath or not os.path.exists(filepath):
        return jsonify({"error": "Dataset not found on server."}), 404
        
    df, error = load_dataset(filepath)
    if error:
        return jsonify({"error": error}), 400
        
    if not target or target not in df.columns:
        return jsonify({"error": f"Target column '{target}' not found in dataset."}), 400
        
    problem_type = infer_problem_type(df, target)
    available_models = get_available_models(problem_type)
    models_metadata = get_available_models_with_metadata(problem_type)
    
    # Data Leakage checks
    warnings = []
    if df[target].nunique() == len(df):
        warnings.append("Target column seems to be a unique identifier. This is likely target leakage.")
    
    # ID column heuristic
    for col in df.columns:
        if col != target and df[col].nunique() == len(df) and pd.api.types.is_numeric_dtype(df[col]):
            warnings.append(f"Column '{col}' looks like an ID column. Consider dropping it to avoid data leakage.")
            
    return jsonify({
        "problem_type": problem_type,
        "available_models": available_models,
        "models_metadata": models_metadata,
        "warnings": warnings
    })

@ml_bp.route('/api/models/info', methods=['GET', 'POST'])
def get_model_info():
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        model_name = data.get('model_name')
    else:
        model_name = request.args.get('model_name')
        
    if not model_name:
        return jsonify({"error": "Model name parameter is required."}), 400
        
    metadata = get_model_metadata(model_name)
    return jsonify(metadata)

def _save_experiment(user_id, filepath, model_name, problem_type, target, features, config_dict, metrics, exp_type="baseline", parent_id=None, description=None):
    if not user_id:
        return None
    try:
        norm_target = os.path.normcase(os.path.abspath(filepath))
        user_datasets = Dataset.query.filter_by(user_id=user_id).all()
        ds = next((d for d in user_datasets if os.path.normcase(os.path.abspath(d.storage_path)) == norm_target), None)
        
        if not ds:
            filename = os.path.basename(filepath)
            df, _ = load_dataset(filepath)
            ds = Dataset(
                user_id=user_id,
                filename=filename,
                file_size=os.path.getsize(filepath) if os.path.exists(filepath) else 0,
                row_count=len(df) if df is not None else 0,
                column_count=len(df.columns) if df is not None else 0,
                storage_path=filepath
            )
            db.session.add(ds)
            db.session.commit()
            
        if ds:
            experiment = MLExperiment(
                user_id=user_id,
                dataset_id=ds.id,
                model_name=model_name,
                problem_type=problem_type,
                target=target,
                selected_features=safe_json_dumps(features),
                preprocessing_configuration=safe_json_dumps(config_dict),
                metrics=safe_json_dumps(metrics),
                experiment_type=exp_type,
                parent_experiment_id=parent_id,
                cv_scores=safe_json_dumps(metrics.get('cv_scores', [])),
                experiment_description=description
            )
            db.session.add(experiment)
            db.session.commit()
            return experiment.id
    except Exception:
        db.session.rollback()
    return None

@ml_bp.route('/api/experiments/baseline', methods=['POST'])
def run_baseline_experiment():
    data = request.get_json(silent=True) or {}
    filepath = data.get('filepath')
    target = data.get('target')
    raw_features = data.get('features')
    model_name = data.get('model')
    problem_type = data.get('problem_type')
    config = data.get('config', {})
    
    if not filepath or not os.path.exists(filepath):
        return jsonify({"error": "Dataset not found on server."}), 404
        
    if not target or not model_name:
        return jsonify({"error": "Missing required training parameters."}), 400
        
    features = [f for f in raw_features if f != target]
    df, error = load_dataset(filepath)
    if error: return jsonify({"error": error}), 400
    
    if not problem_type or problem_type == "Unknown":
        problem_type = infer_problem_type(df, target)
        
    metrics, train_error = train_and_evaluate(df, target, features, problem_type, model_name, config)
    if train_error: return jsonify({"error": train_error}), 400
    
    exp_id = None
    if current_user.is_authenticated:
        exp_id = _save_experiment(current_user.id, filepath, model_name, problem_type, target, features, config, metrics, "baseline", description="Baseline Model")
        
    return jsonify({"message": "Baseline trained", "metrics": metrics, "experiment_id": exp_id})

@ml_bp.route('/api/experiments/ablate', methods=['POST'])
def run_ablation_experiment():
    data = request.get_json(silent=True) or {}
    filepath = data.get('filepath')
    target = data.get('target')
    raw_features = data.get('features')
    dropped_feature = data.get('dropped_feature')
    model_name = data.get('model')
    problem_type = data.get('problem_type')
    config = data.get('config', {})
    parent_id = data.get('parent_experiment_id')
    
    if not filepath or not os.path.exists(filepath):
        return jsonify({"error": "Dataset not found."}), 404
        
    df, error = load_dataset(filepath)
    if error: return jsonify({"error": error}), 400
    features = [f for f in raw_features if f != target]
    
    res, err = run_feature_ablation(df, target, dropped_feature, features, problem_type, model_name, config)
    if err: return jsonify({"error": err}), 400
    
    exp_id = None
    if current_user.is_authenticated:
        exp_id = _save_experiment(current_user.id, filepath, model_name, problem_type, target, 
                         [f for f in features if f != dropped_feature], config, res['metrics'], 
                         "ablation", parent_id, description=f"Removed {dropped_feature}")
                         
    return jsonify({"message": f"Ablation run for {dropped_feature}", "result": res, "experiment_id": exp_id})

@ml_bp.route('/api/experiments/noise', methods=['POST'])
def run_noise_experiment():
    data = request.get_json(silent=True) or {}
    filepath = data.get('filepath')
    target = data.get('target')
    features = [f for f in data.get('features', []) if f != target]
    noise_feature = data.get('noise_feature')
    noise_level = float(data.get('noise_level', 10.0))
    model_name = data.get('model')
    problem_type = data.get('problem_type')
    config = data.get('config', {})
    parent_id = data.get('parent_experiment_id')
    
    df, error = load_dataset(filepath)
    if error: return jsonify({"error": error}), 400
    
    res, err = run_noise_injection(df, target, noise_feature, noise_level, features, problem_type, model_name, config)
    if err: return jsonify({"error": err}), 400
    
    exp_id = None
    if current_user.is_authenticated:
        exp_id = _save_experiment(current_user.id, filepath, model_name, problem_type, target, features, config, res['metrics'], 
                         "noise", parent_id, description=f"Added {noise_level}% noise to {noise_feature}")
                         
    return jsonify({"message": "Noise experiment complete", "result": res, "experiment_id": exp_id})

@ml_bp.route('/api/experiments/engineer', methods=['POST'])
def run_engineering_experiment():
    data = request.get_json(silent=True) or {}
    filepath = data.get('filepath')
    target = data.get('target')
    features = [f for f in data.get('features', []) if f != target]
    orig_feat = data.get('original_feature')
    trans_type = data.get('transformation_type')
    model_name = data.get('model')
    problem_type = data.get('problem_type')
    config = data.get('config', {})
    parent_id = data.get('parent_experiment_id')
    
    df, error = load_dataset(filepath)
    if error: return jsonify({"error": error}), 400
    
    eng_config = {'original_feature': orig_feat, 'transformation_type': trans_type}
    res, err = run_feature_engineering(df, target, eng_config, features, problem_type, model_name, config)
    if err: return jsonify({"error": err}), 400
    
    new_features = list(features) + [res['new_feature']]
    
    exp_id = None
    if current_user.is_authenticated:
        exp_id = _save_experiment(current_user.id, filepath, model_name, problem_type, target, new_features, config, res['metrics'], 
                         "engineering", parent_id, description=f"Engineered {orig_feat} ({trans_type})")
                         
    return jsonify({"message": "Engineering experiment complete", "result": res, "experiment_id": exp_id})

@ml_bp.route('/api/experiments', methods=['GET'])
def get_user_experiments():
    if not current_user.is_authenticated:
        return jsonify({"experiments": []})
        
    experiments = MLExperiment.query.filter_by(user_id=current_user.id).order_by(MLExperiment.created_at.desc()).limit(20).all()
    results = []
    for exp in experiments:
        parsed_metrics = {}
        if exp.metrics:
            try:
                parsed_metrics = json.loads(exp.metrics)
            except (json.JSONDecodeError, TypeError):
                parsed_metrics = {}
                
        results.append({
            "id": exp.id,
            "experiment_type": getattr(exp, 'experiment_type', 'baseline'),
            "parent_id": getattr(exp, 'parent_experiment_id', None),
            "description": getattr(exp, 'experiment_description', ''),
            "model_name": exp.model_name,
            "problem_type": exp.problem_type,
            "target": exp.target,
            "metrics": parsed_metrics,
            "created_at": exp.created_at.strftime("%Y-%m-%d %H:%M") if exp.created_at else ""
        })
    return jsonify({"experiments": results})

@ml_bp.route('/api/experiments/<int:experiment_id>', methods=['DELETE', 'POST'])
def delete_user_experiment(experiment_id):
    if not current_user.is_authenticated:
        return jsonify({"error": "Authentication required."}), 401
        
    exp = MLExperiment.query.filter_by(id=experiment_id, user_id=current_user.id).first()
    if not exp:
        return jsonify({"error": "Experiment not found or unauthorized."}), 404
        
    try:
        db.session.delete(exp)
        db.session.commit()
        return jsonify({"message": "Experiment deleted successfully."})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to delete experiment: {str(e)}"}), 500
