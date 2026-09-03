import os
from flask import Flask
from config import Config
from database.db import db, bcrypt, login_manager

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize extensions
    db.init_app(app)
    bcrypt.init_app(app)
    login_manager.init_app(app)

    # Ensure models are loaded
    import database.models

    # Ensure upload folder exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Register blueprints
    from routes.dashboard_routes import dashboard_bp
    from routes.ml_routes import ml_bp
    from routes.auth_routes import auth_bp
    from routes.visualization_routes import visualization_bp
    
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(ml_bp, url_prefix='/ml')
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(visualization_bp)

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, port=5000)
