from database.db import db, login_manager
from flask_login import UserMixin
from datetime import datetime

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(20), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(60), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    datasets = db.relationship('Dataset', backref='author', lazy=True)
    experiments = db.relationship('MLExperiment', backref='author', lazy=True)
    visualizations = db.relationship('VisualizationRecord', backref='author', lazy=True)

class Dataset(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    filename = db.Column(db.String(100), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    row_count = db.Column(db.Integer, nullable=False)
    column_count = db.Column(db.Integer, nullable=False)
    storage_path = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

class MLExperiment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    dataset_id = db.Column(db.Integer, db.ForeignKey('dataset.id'), nullable=False)
    model_name = db.Column(db.String(50), nullable=False)
    problem_type = db.Column(db.String(50), nullable=False)
    target = db.Column(db.String(100), nullable=False)
    selected_features = db.Column(db.Text, nullable=False) # JSON string
    preprocessing_configuration = db.Column(db.Text, nullable=False) # JSON string
    metrics = db.Column(db.Text, nullable=False) # JSON string
    
    # New fields for educational labs
    experiment_type = db.Column(db.String(50), nullable=False, default="baseline") # baseline, ablation, noise, engineering
    parent_experiment_id = db.Column(db.Integer, db.ForeignKey('ml_experiment.id'), nullable=True)
    cv_scores = db.Column(db.Text, nullable=True) # JSON string of fold results
    experiment_description = db.Column(db.Text, nullable=True) # e.g. "Removed thalassemia"
    
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    # Self-referential relationship for parent-child experiments (e.g. ablation off a baseline)
    children = db.relationship('MLExperiment', 
                             backref=db.backref('parent', remote_side=[id]),
                             cascade="all, delete-orphan")

class VisualizationRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    dataset_id = db.Column(db.Integer, db.ForeignKey('dataset.id'), nullable=False)
    visualization_type = db.Column(db.String(50), nullable=False)
    target = db.Column(db.String(100), nullable=False)
    configuration = db.Column(db.Text, nullable=False) # JSON string
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
