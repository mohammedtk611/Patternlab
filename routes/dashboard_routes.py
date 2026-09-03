from flask import Blueprint, render_template
from flask_login import current_user
from database.models import Dataset

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/')
def index():
    user_datasets = []
    if current_user.is_authenticated:
        user_datasets = Dataset.query.filter_by(user_id=current_user.id).all()
        
    return render_template('dashboard/dashboard.html', user_datasets=user_datasets)
