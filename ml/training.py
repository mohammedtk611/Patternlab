import time
import numpy as np
from sklearn.pipeline import Pipeline
from sklearn.model_selection import RandomizedSearchCV, StratifiedKFold, KFold
from ml.preprocessing import create_preprocessing_pipeline, get_train_test_data
from ml.models import get_model
from ml.evaluation import evaluate_model
from sklearn.metrics import accuracy_score, f1_score, mean_squared_error, r2_score

def get_hyperparameter_grid(model_name):
    # Provide sensible defaults for tuning
    if "Random Forest" in model_name:
        return {
            'model__n_estimators': [50, 100, 200],
            'model__max_depth': [None, 10, 20],
            'model__min_samples_split': [2, 5]
        }
    elif "Logistic Regression" in model_name:
        return {
            'model__C': [0.1, 1.0, 10.0],
            'model__solver': ['lbfgs', 'liblinear']
        }
    elif "Decision Tree" in model_name:
        return {
            'model__max_depth': [None, 5, 10, 15],
            'model__min_samples_split': [2, 5, 10]
        }
    elif "Gradient Boosting" in model_name:
        return {
            'model__n_estimators': [50, 100, 200],
            'model__learning_rate': [0.01, 0.1, 0.2],
            'model__max_depth': [3, 5, 7]
        }
    elif "Linear Regression" in model_name:
        return {}
    return {}

def train_and_evaluate(df, target, features, problem_type, model_name, config):
    is_classification = problem_type in ["Binary Classification", "Multiclass Classification"]
    
    # Extract data (80% train, 20% test)
    X_train, X_test, y_train, y_test = get_train_test_data(
        df, target, features, test_size=0.2, random_state=42, is_classification=is_classification
    )
    
    preprocessor = create_preprocessing_pipeline(df, features, config)
    model = get_model(problem_type, model_name)
    
    if model is None:
        return None, f"Invalid model '{model_name}' selected for problem type '{problem_type}'."
        
    pipeline = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('model', model)
    ])
    
    start_time = time.time()
    
    cv_scores = []
    best_params = {}
    
    try:
        # Cross-validation and Hyperparameter tuning
        param_grid = get_hyperparameter_grid(model_name)
        if param_grid:
            cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=42) if is_classification else KFold(n_splits=3, shuffle=True, random_state=42)
            scorer = 'f1_weighted' if is_classification else 'neg_mean_squared_error'
            search = RandomizedSearchCV(pipeline, param_grid, n_iter=5, cv=cv, scoring=scorer, random_state=42, n_jobs=1)
            search.fit(X_train, y_train)
            
            pipeline = search.best_estimator_
            best_params = search.best_params_
            
            # Extract fold scores
            results = search.cv_results_
            best_index = search.best_index_
            for i in range(3):
                score = results[f'split{i}_test_score'][best_index]
                if not is_classification:
                    score = -score # Revert neg_mean_squared_error
                cv_scores.append(float(score))
        else:
            # Fallback if no params to tune, just fit
            pipeline.fit(X_train, y_train)
            cv_scores = [] # Could implement manual CV here if needed, keeping simple for linear regression
            
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
        metrics['best_params'] = {k.replace('model__', ''): v for k, v in best_params.items()}
        metrics['cv_scores'] = cv_scores
        if cv_scores:
            metrics['cv_mean'] = float(np.mean(cv_scores))
            metrics['cv_std'] = float(np.std(cv_scores))
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        return None, f"Error during model evaluation: {str(e)}"
        
    return metrics, None
