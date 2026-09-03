from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.tree import DecisionTreeRegressor, DecisionTreeClassifier
from sklearn.ensemble import (
    RandomForestRegressor,
    RandomForestClassifier,
    GradientBoostingClassifier,
    GradientBoostingRegressor
)

MODEL_METADATA = {
    "Linear Regression": {
        "name": "Linear Regression",
        "category": "Linear Model",
        "badge": "Linear",
        "description": "Models the relationship between continuous features and target by fitting a linear equation to observed data.",
        "strengths": "Fast, highly interpretable, works well when relationships are linear.",
        "weaknesses": "Cannot capture non-linear patterns, sensitive to outliers and multicollinearity.",
        "hyperparameters": [
            {
                "name": "fit_intercept",
                "label": "Fit Intercept",
                "type": "boolean",
                "default": True,
                "description": "Whether to calculate the intercept for this model."
            }
        ]
    },
    "Logistic Regression": {
        "name": "Logistic Regression",
        "category": "Linear Model",
        "badge": "Linear",
        "description": "Estimates class probabilities using a sigmoid/logistic function on a linear combination of input features.",
        "strengths": "Fast, provides calibrated probabilities, resistant to overfitting with regularization.",
        "weaknesses": "Assumes linear decision boundaries, requires scaling for optimal regularization.",
        "hyperparameters": [
            {
                "name": "C",
                "label": "Inverse Regularization Strength (C)",
                "type": "number",
                "default": 1.0,
                "min": 0.01,
                "max": 10.0,
                "step": 0.1,
                "description": "Smaller values specify stronger regularization."
            },
            {
                "name": "max_iter",
                "label": "Max Iterations",
                "type": "number",
                "default": 1000,
                "min": 100,
                "max": 5000,
                "step": 100,
                "description": "Maximum number of iterations taken for the solvers to converge."
            }
        ]
    },
    "Decision Tree Regressor": {
        "name": "Decision Tree Regressor",
        "category": "Tree-based",
        "badge": "Tree",
        "description": "Builds a tree structure of decisions by recursively splitting data based on feature thresholds to predict continuous values.",
        "strengths": "Intuitive, captures non-linear relationships, requires minimal data preprocessing.",
        "weaknesses": "Prone to overfitting if tree depth is unconstrained, sensitive to small data variations.",
        "hyperparameters": [
            {
                "name": "max_depth",
                "label": "Max Depth",
                "type": "number",
                "default": 6,
                "min": 1,
                "max": 30,
                "step": 1,
                "description": "The maximum depth of the tree. Limits overfitting."
            },
            {
                "name": "min_samples_split",
                "label": "Min Samples Split",
                "type": "number",
                "default": 2,
                "min": 2,
                "max": 20,
                "step": 1,
                "description": "The minimum number of samples required to split an internal node."
            }
        ]
    },
    "Decision Tree Classifier": {
        "name": "Decision Tree Classifier",
        "category": "Tree-based",
        "badge": "Tree",
        "description": "Splits data hierarchically using decision nodes to classify samples into target categories.",
        "strengths": "Clear decision rules, visualizable, handles mixed feature types naturally.",
        "weaknesses": "High variance, can easily overfit without proper depth limits.",
        "hyperparameters": [
            {
                "name": "max_depth",
                "label": "Max Depth",
                "type": "number",
                "default": 6,
                "min": 1,
                "max": 30,
                "step": 1,
                "description": "The maximum depth of the tree."
            },
            {
                "name": "min_samples_split",
                "label": "Min Samples Split",
                "type": "number",
                "default": 2,
                "min": 2,
                "max": 20,
                "step": 1,
                "description": "The minimum number of samples required to split an internal node."
            }
        ]
    },
    "Random Forest Regressor": {
        "name": "Random Forest Regressor",
        "category": "Ensemble (Bagging)",
        "badge": "Bagging",
        "description": "Combines predictions from multiple randomized decision trees in parallel (bootstrap aggregation) to reduce variance.",
        "strengths": "High accuracy, resilient to overfitting, calculates reliable feature importances.",
        "weaknesses": "Slower training than single trees, larger memory footprint.",
        "hyperparameters": [
            {
                "name": "n_estimators",
                "label": "Number of Trees (Estimators)",
                "type": "number",
                "default": 100,
                "min": 10,
                "max": 500,
                "step": 10,
                "description": "The number of trees in the forest."
            },
            {
                "name": "max_depth",
                "label": "Max Depth",
                "type": "number",
                "default": 10,
                "min": 1,
                "max": 50,
                "step": 1,
                "description": "The maximum depth of each tree."
            }
        ]
    },
    "Random Forest Classifier": {
        "name": "Random Forest Classifier",
        "category": "Ensemble (Bagging)",
        "badge": "Bagging",
        "description": "Ensemble classifier that aggregates votes from an array of randomized decision trees for robust classification.",
        "strengths": "Outstanding general performance, handles high-dimensional data, resists overfitting.",
        "weaknesses": "Computationally heavier than linear models, harder to interpret than a single tree.",
        "hyperparameters": [
            {
                "name": "n_estimators",
                "label": "Number of Trees (Estimators)",
                "type": "number",
                "default": 100,
                "min": 10,
                "max": 500,
                "step": 10,
                "description": "The number of trees in the forest."
            },
            {
                "name": "max_depth",
                "label": "Max Depth",
                "type": "number",
                "default": 10,
                "min": 1,
                "max": 50,
                "step": 1,
                "description": "The maximum depth of each tree."
            }
        ]
    },
    "Gradient Boosting Regressor": {
        "name": "Gradient Boosting Regressor",
        "category": "Ensemble (Boosting)",
        "badge": "Boosting",
        "description": "Builds trees sequentially where each successive tree explicitly corrects the residual errors of prior trees.",
        "strengths": "State-of-the-art predictive accuracy, effective on complex structured tabular datasets.",
        "weaknesses": "Can overfit if learning rate is too high or too many trees are added; sequential training is slower.",
        "hyperparameters": [
            {
                "name": "n_estimators",
                "label": "Number of Boosting Stages",
                "type": "number",
                "default": 100,
                "min": 10,
                "max": 300,
                "step": 10,
                "description": "The number of boosting stages to perform."
            },
            {
                "name": "learning_rate",
                "label": "Learning Rate",
                "type": "number",
                "default": 0.1,
                "min": 0.01,
                "max": 1.0,
                "step": 0.01,
                "description": "Shrinks the contribution of each tree. Balances accuracy and overfitting."
            },
            {
                "name": "max_depth",
                "label": "Max Depth",
                "type": "number",
                "default": 3,
                "min": 1,
                "max": 10,
                "step": 1,
                "description": "Maximum depth of individual regression estimators."
            }
        ]
    },
    "Gradient Boosting Classifier": {
        "name": "Gradient Boosting Classifier",
        "category": "Ensemble (Boosting)",
        "badge": "Boosting",
        "description": "Sequentially optimizes pseudo-residuals of cross-entropy loss, creating strong discriminative boundaries.",
        "strengths": "Top-tier accuracy on tabular data, automatically captures complex feature interactions.",
        "weaknesses": "Sensitive to noisy labels and outliers, requires careful tuning of learning rate and stages.",
        "hyperparameters": [
            {
                "name": "n_estimators",
                "label": "Number of Boosting Stages",
                "type": "number",
                "default": 100,
                "min": 10,
                "max": 300,
                "step": 10,
                "description": "The number of boosting stages to perform."
            },
            {
                "name": "learning_rate",
                "label": "Learning Rate",
                "type": "number",
                "default": 0.1,
                "min": 0.01,
                "max": 1.0,
                "step": 0.01,
                "description": "Shrinks the contribution of each tree. Balances accuracy and overfitting."
            },
            {
                "name": "max_depth",
                "label": "Max Depth",
                "type": "number",
                "default": 3,
                "min": 1,
                "max": 10,
                "step": 1,
                "description": "Maximum depth of individual tree estimators."
            }
        ]
    }
}

def get_model(problem_type, model_name, hyperparameters=None):
    params = hyperparameters or {}

    def get_int(key, default):
        val = params.get(key)
        if val is None or val == "":
            return default
        try:
            return int(val)
        except (ValueError, TypeError):
            return default

    def get_float(key, default):
        val = params.get(key)
        if val is None or val == "":
            return default
        try:
            return float(val)
        except (ValueError, TypeError):
            return default

    def get_bool(key, default):
        val = params.get(key)
        if val is None:
            return default
        if isinstance(val, bool):
            return val
        return str(val).lower() in ("true", "1", "yes")

    if problem_type == "Regression":
        if model_name == "Linear Regression":
            fit_intercept = get_bool("fit_intercept", True)
            return LinearRegression(fit_intercept=fit_intercept)

        elif model_name == "Decision Tree Regressor":
            max_depth = get_int("max_depth", 6)
            min_samples_split = get_int("min_samples_split", 2)
            return DecisionTreeRegressor(
                random_state=42,
                max_depth=max_depth if max_depth > 0 else None,
                min_samples_split=max(2, min_samples_split)
            )

        elif model_name == "Random Forest Regressor":
            n_estimators = get_int("n_estimators", 100)
            max_depth = get_int("max_depth", 10)
            return RandomForestRegressor(
                random_state=42,
                n_estimators=max(1, n_estimators),
                max_depth=max_depth if max_depth > 0 else None
            )

        elif model_name == "Gradient Boosting Regressor":
            n_estimators = get_int("n_estimators", 100)
            learning_rate = get_float("learning_rate", 0.1)
            max_depth = get_int("max_depth", 3)
            return GradientBoostingRegressor(
                random_state=42,
                n_estimators=max(1, n_estimators),
                learning_rate=learning_rate,
                max_depth=max(1, max_depth)
            )

    elif problem_type in ["Binary Classification", "Multiclass Classification"]:
        if model_name == "Logistic Regression":
            c_val = get_float("C", 1.0)
            max_iter = get_int("max_iter", 1000)
            return LogisticRegression(
                max_iter=max(100, max_iter),
                C=max(0.001, c_val),
                random_state=42
            )

        elif model_name == "Decision Tree Classifier":
            max_depth = get_int("max_depth", 6)
            min_samples_split = get_int("min_samples_split", 2)
            return DecisionTreeClassifier(
                random_state=42,
                max_depth=max_depth if max_depth > 0 else None,
                min_samples_split=max(2, min_samples_split)
            )

        elif model_name == "Random Forest Classifier":
            n_estimators = get_int("n_estimators", 100)
            max_depth = get_int("max_depth", 10)
            return RandomForestClassifier(
                random_state=42,
                n_estimators=max(1, n_estimators),
                max_depth=max_depth if max_depth > 0 else None
            )

        elif model_name == "Gradient Boosting Classifier":
            n_estimators = get_int("n_estimators", 100)
            learning_rate = get_float("learning_rate", 0.1)
            max_depth = get_int("max_depth", 3)
            return GradientBoostingClassifier(
                random_state=42,
                n_estimators=max(1, n_estimators),
                learning_rate=learning_rate,
                max_depth=max(1, max_depth)
            )

    return None

def get_model_metadata(model_name):
    return MODEL_METADATA.get(model_name, {
        "name": model_name,
        "category": "Standard Model",
        "badge": "Model",
        "description": "Standard scikit-learn model.",
        "strengths": "N/A",
        "weaknesses": "N/A",
        "hyperparameters": []
    })

def get_available_models(problem_type):
    if problem_type == "Regression":
        return [
            "Linear Regression",
            "Decision Tree Regressor",
            "Random Forest Regressor",
            "Gradient Boosting Regressor"
        ]
    elif problem_type in ["Binary Classification", "Multiclass Classification"]:
        return [
            "Logistic Regression",
            "Decision Tree Classifier",
            "Random Forest Classifier",
            "Gradient Boosting Classifier"
        ]
    return []

def get_available_models_with_metadata(problem_type):
    model_names = get_available_models(problem_type)
    return [get_model_metadata(name) for name in model_names]
