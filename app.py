import os
import sys

import ml.compat
from flask import Flask
from config import Config
from database.db import db, bcrypt, login_manager

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    bcrypt.init_app(app)
    login_manager.init_app(app)

    import database.models

    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    with app.app_context():
        try:
            db.create_all()
        except Exception as e:
            fallback_uri = app.config.get('SQLITE_FALLBACK_URI')
            if fallback_uri and app.config['SQLALCHEMY_DATABASE_URI'] != fallback_uri:
                app.logger.warning(f"Primary database connection failed ({e}). Falling back to SQLite: {fallback_uri}")
                app.config['SQLALCHEMY_DATABASE_URI'] = fallback_uri
                db.init_app(app)
                db.create_all()
            else:
                app.logger.error(f"Failed to initialize database: {e}")

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
