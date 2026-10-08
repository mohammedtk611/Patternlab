import os
import json
import uuid
import numpy as np
import pandas as pd
from flask import Blueprint, render_template, request, jsonify, current_app
from werkzeug.utils import secure_filename
from flask_login import current_user
from ml.data_loader import load_dataset, get_demo_datasets
from ml.data_analysis import analyze_dataset, infer_problem_type
from ml.models import get_available_models, get_available_models_with_metadata, get_model_metadata
from ml.training import train_and_evaluate
from ml.experiments import run_feature_ablation, run_feature_engineering, run_noise_injection
from database.db import db
from database.models import Dataset, MLExperiment, VisualizationRecord

ml_bp = Blueprint('ml', __name__)

DEMO_DATASET_META = {
    "iris.csv": {
        "title": "Iris Flower Classification",
        "badge": "Multiclass",
        "badge_class": "badge-orange",
        "target": "species",
        "description": "The classic benchmark dataset classifying 3 species of Iris flowers using sepal and petal physical dimensions."
    },
    "customer_churn.csv": {
        "title": "Customer Churn Risk",
        "badge": "Binary",
        "badge_class": "badge-blue",
        "target": "Churn",
        "description": "Predict whether telecom subscribers will defect based on contract type, tenure, monthly charges, and tech support."
    },
    "house_prices.csv": {
        "title": "Residential House Valuations",
        "badge": "Regression",
        "badge_class": "badge-success",
        "target": "SalePrice",
        "description": "Forecast continuous home sale prices from overall quality, living area square footage, garage capacity, and year built."
    },
    "heart_data.csv": {
        "title": "Cardiovascular Health",
        "badge": "Binary",
        "badge_class": "badge-danger",
        "target": "heart.disease",
        "description": "Identify clinical likelihood of heart disease given patient age, cholesterol levels, resting blood pressure, and max heart rate."
    }
}

def safe_json_dumps(obj):
    """Serialize any object including numpy types and sets safely to JSON string."""
    def default_serializer(o):
        if isinstance(o, (np.integer, int)):
            return int(o)
        if isinstance(o, (np.floating, float)):
            if np.isnan(o) or np.isinf(o):
                return None
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
    filenames = get_demo_datasets(demo_folder)
    
    datasets = []
    for fn in filenames:
        meta = DEMO_DATASET_META.get(fn, {
            "title": fn.replace('.csv', '').replace('_', ' ').title(),
            "badge": "Dataset",
            "badge_class": "badge-blue",
            "target": None,
            "description": "Explore and train machine learning models on this dataset."
        })
        datasets.append({
            "filename": fn,
            "title": meta["title"],
            "badge": meta["badge"],
            "badge_class": meta["badge_class"],
            "target": meta["target"],
            "description": meta["description"]
        })
    return jsonify({"datasets": datasets})

@ml_bp.route('/api/dataset/preview', methods=['POST'])
def preview_dataset():
    data = request.get_json(silent=True) or {}
    filepath = data.get('filepath')
    n_rows = min(50, max(5, int(data.get('n_rows', 12))))
    
    if not filepath or not os.path.exists(filepath):
        return jsonify({"error": "Dataset not found."}), 404
        
    df, error = load_dataset(filepath)
    if error or df is None:
        return jsonify({"error": error or "Could not read dataset."}), 400
        
    sample_df = df.head(n_rows).replace({np.nan: None})
    rows = sample_df.to_dict(orient='records')
    
    sanitized_rows = []
    for row in rows:
        clean_row = {}
        for k, v in row.items():
            if isinstance(v, float) and (np.isnan(v) or np.isinf(v)):
                clean_row[k] = None
            else:
                clean_row[k] = v
        sanitized_rows.append(clean_row)
        
    columns_meta = []
    for col in df.columns:
        is_num = pd.api.types.is_numeric_dtype(df[col])
        columns_meta.append({
            "name": str(col),
            "type": "numerical" if is_num else "categorical",
            "dtype": str(df[col].dtype)
        })
        
    return jsonify({
        "columns": columns_meta,
        "rows": sanitized_rows,
        "total_rows": len(df),
        "total_columns": len(df.columns)
    })

@ml_bp.route('/api/upload', methods=['POST'])
def upload_dataset():
    if 'file' not in request.files:
        return jsonify({"error": "No file part in request."}), 400
        
    file = request.files['file']
    if not file or file.filename == '':
        return jsonify({"error": "No selected file."}), 400
        
    if current_user.is_authenticated:
        dataset_count = Dataset.query.filter_by(user_id=current_user.id).count()
        if dataset_count >= 15:
            return jsonify({"error": "Dataset limit reached. You can store up to 15 datasets. Please delete one first."}), 403
            
    original_filename = secure_filename(file.filename)
    if original_filename.lower().endswith('.csv'):
        unique_prefix = uuid.uuid4().hex[:8]
        saved_filename = f"{unique_prefix}_{original_filename}"
        upload_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads')
        os.makedirs(upload_folder, exist_ok=True)
        filepath = os.path.join(upload_folder, saved_filename)
        
        try:
            file.seek(0, os.SEEK_END)
            file_length = file.tell()
            file.seek(0)
            
            max_len = current_app.config.get('MAX_CONTENT_LENGTH', 10 * 1024 * 1024)
            if file_length > max_len:
                return jsonify({"error": f"File size ({round(file_length / (1024 * 1024), 2)}MB) exceeds {max_len // (1024 * 1024)}MB limit."}), 413
                
            file.save(filepath)
            
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
        MLExperiment.query.filter_by(dataset_id=dataset.id).delete()
        VisualizationRecord.query.filter_by(dataset_id=dataset.id).delete()
        
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
    
    real_demo_dir = os.path.abspath(demo_folder)
    real_file_path = os.path.abspath(filepath)
    if not real_file_path.startswith(real_demo_dir) or not os.path.exists(real_file_path):
        return jsonify({"error": f"Demo dataset '{safe_name}' not found."}), 404
        
    df, error = load_dataset(filepath)
    if error:
        return jsonify({"error": error}), 400
        
    analysis = analyze_dataset(df)
    meta = DEMO_DATASET_META.get(safe_name, {})
    
    return jsonify({
        "message": "Demo dataset loaded successfully",
        "filename": safe_name,
        "filepath": filepath,
        "analysis": analysis,
        "suggested_target": meta.get("target")
    })

@ml_bp.route('/api/load-existing', methods=['POST'])
def load_existing():
    data = request.get_json(silent=True) or {}
    filepath = data.get('filepath')
    filename = data.get('filename')
    
    if not filepath or not os.path.exists(filepath):
        return jsonify({"error": "Dataset not found on server."}), 404
        
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
    
    warnings = []
    if df[target].nunique() == len(df):
        warnings.append("Target column contains all unique values. This indicates target leakage or an ID column.")
    
    for col in df.columns:
        if col != target and df[col].nunique() == len(df) and pd.api.types.is_numeric_dtype(df[col]):
            warnings.append(f"Column '{col}' has unique values for every row (likely an ID column). We recommend excluding it to prevent data leakage.")
            
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
    
    # Extract user-specified hyperparameters if sent
    if 'hyperparameters' in data and not config.get('hyperparameters'):
        config['hyperparameters'] = data['hyperparameters']
    
    if not filepath or not os.path.exists(filepath):
        return jsonify({"error": "Dataset not found on server."}), 404
        
    if not target or not model_name:
        return jsonify({"error": "Missing required training parameters."}), 400
        
    df, error = load_dataset(filepath)
    if error: return jsonify({"error": error}), 400
    
    if not raw_features:
        raw_features = [c for c in df.columns if c != target]
    features = [f for f in raw_features if f in df.columns and f != target]
    if not features:
        features = [f for f in df.columns if f != target]
    
    if not problem_type or problem_type == "Unknown":
        problem_type = infer_problem_type(df, target)
        
    metrics, train_error = train_and_evaluate(df, target, features, problem_type, model_name, config)
    if train_error: return jsonify({"error": train_error}), 400
    
    exp_id = None
    if current_user.is_authenticated:
        exp_id = _save_experiment(current_user.id, filepath, model_name, problem_type, target, features, config, metrics, "baseline", description=f"Baseline {model_name}")
        
    return jsonify({"message": "Baseline trained successfully", "metrics": metrics, "experiment_id": exp_id})

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
    features = [f for f in raw_features if f in df.columns and f != target]
    
    res, err = run_feature_ablation(df, target, dropped_feature, features, problem_type, model_name, config)
    if err: return jsonify({"error": err}), 400
    
    exp_id = None
    if current_user.is_authenticated:
        exp_id = _save_experiment(current_user.id, filepath, model_name, problem_type, target, 
                         [f for f in features if f != dropped_feature], config, res['metrics'], 
                         "ablation", parent_id, description=f"Ablated {dropped_feature}")
                         
    return jsonify({"message": f"Ablation run for {dropped_feature}", "result": res, "experiment_id": exp_id})

@ml_bp.route('/api/experiments/noise', methods=['POST'])
def run_noise_experiment():
    data = request.get_json(silent=True) or {}
    filepath = data.get('filepath')
    target = data.get('target')
    raw_feats = data.get('features', [])
    features = [f for f in raw_feats if f in df.columns and f != target]
    noise_feature = data.get('noise_feature')
    noise_level = float(data.get('noise_level', 20.0))
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
        
    experiments = MLExperiment.query.filter_by(user_id=current_user.id).order_by(MLExperiment.created_at.desc()).limit(30).all()
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
            "description": getattr(exp, 'experiment_description', '') or exp.model_name,
            "model_name": exp.model_name,
            "problem_type": exp.problem_type,
            "target": exp.target,
            "metrics": parsed_metrics,
            "created_at": exp.created_at.strftime("%Y-%m-%d %H:%M") if exp.created_at else ""
        })
    return jsonify({"experiments": results})

@ml_bp.route('/api/experiments/compare', methods=['POST'])
def compare_experiments():
    data = request.get_json(silent=True) or {}
    exp_ids = data.get('experiment_ids', [])
    
    if not exp_ids:
        return jsonify({"error": "No experiment IDs provided."}), 400
        
    experiments = MLExperiment.query.filter(MLExperiment.id.in_(exp_ids)).all()
    comparison = []
    for exp in experiments:
        metrics = {}
        if exp.metrics:
            try:
                metrics = json.loads(exp.metrics)
            except Exception:
                metrics = {}
                
        comparison.append({
            "id": exp.id,
            "description": exp.experiment_description or exp.model_name,
            "model_name": exp.model_name,
            "type": exp.experiment_type,
            "problem_type": exp.problem_type,
            "target": exp.target,
            "metrics": metrics,
            "created_at": exp.created_at.strftime("%Y-%m-%d %H:%M") if exp.created_at else ""
        })
        
    return jsonify({"comparison": comparison})

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
