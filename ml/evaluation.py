from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, classification_report
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.inspection import permutation_importance
import numpy as np

def extract_feature_importances(pipeline, original_features, X_test=None, y_test=None):
    if 'model' not in pipeline.named_steps:
        return []
        
    final_model = pipeline.named_steps['model']
    preprocessor = pipeline.named_steps.get('preprocessor')
    
    # 1. Get raw importance / coefficient array from model
    raw_scores = None
    is_coefficient = False
    
    if hasattr(final_model, 'feature_importances_'):
        raw_scores = np.array(final_model.feature_importances_, dtype=float)
    elif hasattr(final_model, 'coef_'):
        is_coefficient = True
        coef = np.array(final_model.coef_, dtype=float)
        if coef.ndim == 1:
            raw_scores = np.abs(coef)
        elif coef.ndim == 2:
            if coef.shape[0] == 1:
                raw_scores = np.abs(coef[0])
            else:
                raw_scores = np.mean(np.abs(coef), axis=0)
                
    if raw_scores is None or len(raw_scores) == 0:
        # Fallback to permutation importance if test data is provided
        if X_test is not None and y_test is not None:
            try:
                result = permutation_importance(pipeline, X_test, y_test, n_repeats=5, random_state=42, n_jobs=1)
                # permutation importance gives importance for the ORIGINAL features before preprocessing
                # if we pass the whole pipeline. This is a massive advantage!
                raw_scores_orig = np.abs(result.importances_mean)
                
                # If we use pipeline permutation importance, the scores map directly to original_features
                # We don't need to aggregate sub-features. Let's return the matrix directly here.
                if len(raw_scores_orig) == len(original_features):
                    influence_matrix = []
                    total_orig = np.sum(raw_scores_orig)
                    for i, feat in enumerate(original_features):
                        score = float(raw_scores_orig[i])
                        rel_pct = (score / total_orig * 100.0) if total_orig > 0 else 0.0
                        influence_matrix.append({
                            "feature": feat,
                            "importance": round(rel_pct / 100.0, 4),
                            "percentage": round(rel_pct, 2),
                            "raw_value": round(score, 4),
                            "type": "permutation_importance",
                            "has_sub_features": False,
                            "sub_feature_count": 1,
                            "sub_features": [{"sub_feature": feat, "raw_score": round(score, 4), "percentage_of_feature": 100.0}]
                        })
                    influence_matrix.sort(key=lambda x: x['percentage'], reverse=True)
                    return influence_matrix
            except Exception:
                pass
        return []
        
    # 2. Extract transformed column names from the preprocessing pipeline
    transformed_names = []
    if preprocessor is not None and hasattr(preprocessor, 'get_feature_names_out'):
        try:
            for name in preprocessor.get_feature_names_out():
                # Clean scikit-learn pipeline prefixes like 'num__' or 'cat__'
                clean_name = name.split('__', 1)[1] if '__' in name else name
                transformed_names.append(clean_name)
        except Exception:
            transformed_names = []
            
    if len(transformed_names) != len(raw_scores):
        if len(original_features) == len(raw_scores):
            transformed_names = list(original_features)
        else:
            transformed_names = [f"Feature_{i+1}" for i in range(len(raw_scores))]
            
    # 3. Aggregate transformed sub-features (e.g., one-hot dummies) to parent original features
    features_list = list(original_features) if original_features else transformed_names
    parent_map = {}
    for feat in features_list:
        parent_map[feat] = {
            "feature": feat,
            "raw_total": 0.0,
            "sub_features": []
        }
        
    for sub_name, score in zip(transformed_names, raw_scores):
        matched_parent = None
        
        # Check direct exact match
        if sub_name in parent_map:
            matched_parent = sub_name
        else:
            # Check prefix match for one-hot encoded categories (e.g. 'Contract_Month-to-month' -> 'Contract')
            # Sort by length descending to match longer parent feature names first
            for parent in sorted(features_list, key=len, reverse=True):
                if sub_name.startswith(parent + "_") or sub_name == parent:
                    matched_parent = parent
                    break
                    
        if matched_parent is None:
            matched_parent = sub_name
            if matched_parent not in parent_map:
                parent_map[matched_parent] = {
                    "feature": matched_parent,
                    "raw_total": 0.0,
                    "sub_features": []
                }
                
        parent_map[matched_parent]["raw_total"] += float(score)
        parent_map[matched_parent]["sub_features"].append({
            "name": sub_name,
            "raw_score": round(float(score), 4)
        })
        
    total_raw = sum(p["raw_total"] for p in parent_map.values())
    
    # 4. Construct final sorted Influence Matrix
    influence_matrix = []
    for feat, data in parent_map.items():
        raw_total = data["raw_total"]
        rel_pct = (raw_total / total_raw * 100.0) if total_raw > 0 else 0.0
        
        # Compute intra-feature relative percentages for sub-components
        sub_feats = []
        for sf in data["sub_features"]:
            sf_pct = (sf["raw_score"] / raw_total * 100.0) if raw_total > 0 else 0.0
            sub_feats.append({
                "sub_feature": sf["name"],
                "raw_score": sf["raw_score"],
                "percentage_of_feature": round(sf_pct, 2)
            })
        sub_feats.sort(key=lambda x: x["raw_score"], reverse=True)
        
        influence_matrix.append({
            "feature": feat,
            "importance": round(rel_pct / 100.0, 4),
            "percentage": round(rel_pct, 2),
            "raw_value": round(raw_total, 4),
            "type": "standardized_coefficient" if is_coefficient else "feature_importance",
            "has_sub_features": len(sub_feats) > 1,
            "sub_feature_count": len(sub_feats),
            "sub_features": sub_feats
        })
        
    influence_matrix.sort(key=lambda x: x['percentage'], reverse=True)
    return influence_matrix

def generate_model_insights(model_name, problem_type, metrics, feature_importances):
    top_feature_str = ""
    if feature_importances and len(feature_importances) > 0:
        top_f = feature_importances[0]
        top_feature_str = f" The strongest predictive driver is '{top_f['feature']}' ({top_f['percentage']}% relative influence)."
        if len(feature_importances) > 1:
            second_f = feature_importances[1]
            top_feature_str += f" Followed by '{second_f['feature']}' ({second_f['percentage']}%)."

    if problem_type in ["Binary Classification", "Multiclass Classification"]:
        acc = metrics.get('Accuracy', 0) * 100
        f1 = metrics.get('F1 Score', 0)
        return (
            f"{model_name} achieved an Accuracy of {acc:.1f}% and an F1 Score of {f1:.4f} on test data."
            f"{top_feature_str} Overall, the model demonstrates "
            f"{'excellent' if acc >= 90 else 'solid' if acc >= 75 else 'moderate'} predictive power."
        )
    elif problem_type == "Regression":
        r2 = metrics.get('R2', 0)
        rmse = metrics.get('RMSE', 0)
        mae = metrics.get('MAE', 0)
        variance_explained = max(0.0, r2 * 100)
        return (
            f"{model_name} explains approximately {variance_explained:.1f}% of variance in the target variable (R² = {r2:.4f}) "
            f"with an average absolute prediction error (MAE) of {mae:.2f} and RMSE of {rmse:.2f}."
            f"{top_feature_str}"
        )
    return f"{model_name} training and evaluation completed successfully."

def evaluate_model(model, X_test, y_test, problem_type, model_name="Selected Model", features=None):
    y_pred = model.predict(X_test)
    metrics = {
        "model_name": model_name,
        "problem_type": problem_type
    }
    
    if problem_type in ["Binary Classification", "Multiclass Classification"]:
        is_binary = problem_type == "Binary Classification"
        avg_method = 'binary' if is_binary else 'weighted'
        
        metrics['Accuracy'] = round(float(accuracy_score(y_test, y_pred)), 4)
        
        try:
            metrics['Precision'] = round(float(precision_score(y_test, y_pred, average=avg_method)), 4)
            metrics['Recall'] = round(float(recall_score(y_test, y_pred, average=avg_method)), 4)
            metrics['F1 Score'] = round(float(f1_score(y_test, y_pred, average=avg_method)), 4)
        except Exception:
            metrics['Precision'] = round(float(precision_score(y_test, y_pred, average='weighted', zero_division=0)), 4)
            metrics['Recall'] = round(float(recall_score(y_test, y_pred, average='weighted', zero_division=0)), 4)
            metrics['F1 Score'] = round(float(f1_score(y_test, y_pred, average='weighted', zero_division=0)), 4)
            
        unique_classes = [str(c) for c in np.unique(np.concatenate([np.array(y_test), np.array(y_pred)]))]
        cm = confusion_matrix(y_test, y_pred)
        
        metrics['classes'] = unique_classes
        metrics['confusion_matrix'] = {
            "matrix": cm.tolist(),
            "labels": unique_classes
        }
        
        try:
            report_dict = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
            metrics['classification_report'] = report_dict
        except Exception:
            pass
        
    elif problem_type == "Regression":
        r2 = float(r2_score(y_test, y_pred))
        mae = float(mean_absolute_error(y_test, y_pred))
        mse = float(mean_squared_error(y_test, y_pred))
        rmse = float(np.sqrt(mse))
        
        metrics['R2'] = round(r2, 4)
        metrics['MAE'] = round(mae, 4)
        metrics['MSE'] = round(mse, 4)
        metrics['RMSE'] = round(rmse, 4)
        
        try:
            non_zero_mask = y_test != 0
            if np.any(non_zero_mask):
                mape = np.mean(np.abs((y_test[non_zero_mask] - y_pred[non_zero_mask]) / y_test[non_zero_mask])) * 100
                metrics['MAPE'] = round(float(mape), 2)
        except Exception:
            pass
        
        y_test_list = list(y_test)
        y_pred_list = list(y_pred)
        sample_count = min(100, len(y_test_list))
        
        metrics['actual_vs_predicted'] = [
            {
                "actual": round(float(act), 4),
                "predicted": round(float(pred), 4),
                "residual": round(float(act - pred), 4)
            } 
            for act, pred in zip(y_test_list[:sample_count], y_pred_list[:sample_count])
        ]
        
    # 5. Extract properly aggregated Feature Influence Matrix
    importances = extract_feature_importances(model, features or [], X_test, y_test)
    metrics['feature_importances'] = importances
    
    # 6. Generate Insights using accurate parent rankings
    metrics['insights'] = generate_model_insights(model_name, problem_type, metrics, importances)
    
    return metrics
