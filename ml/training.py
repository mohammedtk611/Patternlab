import time
import numpy as np
from sklearn.pipeline import Pipeline
from sklearn.model_selection import RandomizedSearchCV, StratifiedKFold, KFold, cross_val_score
from ml.preprocessing import create_preprocessing_pipeline, get_train_test_data
from ml.models import get_model
from ml.evaluation import evaluate_model
from sklearn.metrics import accuracy_score, f1_score, mean_squared_error, r2_score

def get_hyperparameter_grid(model_name):
    # Sensible defaults for random search tuning
    if "Random Forest" in model_name:
        return {
            'model__n_estimators': [50, 100, 150],
            'model__max_depth': [None, 6, 12],
            'model__min_samples_split': [2, 5]
        }
    elif "Logistic Regression" in model_name:
        return {
            'model__C': [0.1, 1.0, 5.0, 10.0]
        }
    elif "Decision Tree" in model_name:
        return {
            'model__max_depth': [None, 4, 8, 12],
            'model__min_samples_split': [2, 5, 10]
        }
    elif "Gradient Boosting" in model_name:
        return {
            'model__n_estimators': [50, 100],
            'model__learning_rate': [0.05, 0.1, 0.2],
            'model__max_depth': [3, 5]
        }
    return {}

def train_and_evaluate(df, target, features, problem_type, model_name, config=None):
    cfg = config or {}
    is_classification = problem_type in ["Binary Classification", "Multiclass Classification"]
    
    # Extract data (80% train, 20% test)
    X_train, X_test, y_train, y_test = get_train_test_data(
        df, target, features, test_size=0.2, random_state=42, is_classification=is_classification
    )
    
    user_hyperparams = cfg.get('hyperparameters')
    preprocessor = create_preprocessing_pipeline(df, features, cfg)
    model = get_model(problem_type, model_name, hyperparameters=user_hyperparams)
    
    if model is None:
        return None, f"Invalid model '{model_name}' selected for problem type '{problem_type}'."
        
    pipeline = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('model', model)
    ])
    
    start_time = time.time()
    cv_scores = []
    best_params = user_hyperparams.copy() if user_hyperparams else {}
    
    # Set up cross-validation strategy
    n_splits = min(5, max(2, len(X_train) // 10))
    if is_classification:
        # Check minimum class count
        min_class_count = y_train.value_counts().min() if len(y_train) > 0 else 1
        n_splits = min(n_splits, max(2, min_class_count))
        cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
        scorer = 'accuracy'
    else:
        cv = KFold(n_splits=n_splits, shuffle=True, random_state=42)
        scorer = 'r2'
        
    try:
        if not user_hyperparams:
            param_grid = get_hyperparameter_grid(model_name)
            if param_grid and len(X_train) >= 15:
                search = RandomizedSearchCV(
                    pipeline, param_grid, n_iter=min(4, len(param_grid) * 2), 
                    cv=cv, scoring=scorer, random_state=42, n_jobs=1
                )
                search.fit(X_train, y_train)
                pipeline = search.best_estimator_
                best_params = {k.replace('model__', ''): v for k, v in search.best_params_.items()}
                
                # Extract fold scores
                results = search.cv_results_
                best_index = search.best_index_
                for i in range(n_splits):
                    key = f'split{i}_test_score'
                    if key in results:
                        score = float(results[key][best_index])
                        cv_scores.append(score)
            else:
                pipeline.fit(X_train, y_train)
                try:
                    scores = cross_val_score(pipeline, X_train, y_train, cv=cv, scoring=scorer)
                    cv_scores = [float(s) for s in scores]
                except Exception:
                    cv_scores = []
        else:
            pipeline.fit(X_train, y_train)
            try:
                scores = cross_val_score(pipeline, X_train, y_train, cv=cv, scoring=scorer)
                cv_scores = [float(s) for s in scores]
            except Exception:
                cv_scores = []
                
    except Exception as e:
        import traceback
        traceback.print_exc()
        return None, f"Error during model training/tuning: {str(e)}"
        
    training_time = round(time.time() - start_time, 4)
        
    try:
        metrics = evaluate_model(
            pipeline,
            X_test,
            y_test,
            problem_type,
            model_name=model_name,
            features=features
        )
        metrics['training_time_sec'] = training_time
        metrics['best_params'] = best_params
        metrics['cv_scores'] = cv_scores
        metrics['cv_metric'] = 'Accuracy' if is_classification else 'R² Score'
        if cv_scores:
            metrics['cv_mean'] = round(float(np.mean(cv_scores)), 4)
            metrics['cv_std'] = round(float(np.std(cv_scores)), 4)
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        return None, f"Error during model evaluation: {str(e)}"
        
    return metrics, None
