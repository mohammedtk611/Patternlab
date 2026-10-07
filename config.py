import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'patternlab-dev-secret-key-super-secure-2026'
    
    # Database configuration with robust fallback
    _raw_db_url = os.environ.get('DATABASE_URL')
    if not _raw_db_url:
        _raw_db_url = 'postgresql://postgres:root1234@localhost:5432/patternlab'
        
    SQLALCHEMY_DATABASE_URI = _raw_db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 MB limit for rich experimentation
    DEMO_DATASETS_FOLDER = os.path.join(BASE_DIR, 'datasets', 'demo')
    SQLITE_FALLBACK_URI = f"sqlite:///{os.path.join(BASE_DIR, 'patternlab.db')}"
