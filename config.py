import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-do-not-use-in-production'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'postgresql://postgres:root1234@localhost:5432/patternlab')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5 MB limit
    DEMO_DATASETS_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'datasets', 'demo')
