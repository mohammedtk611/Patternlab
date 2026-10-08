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
        db.create_all()

    from routes.dashboard_routes import dashboard_bp
    from routes.ml_routes import ml_bp
    from routes.auth_routes import auth_bp
    from routes.visualization_routes import visualization_bp
    
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(ml_bp, url_prefix='/ml')
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(visualization_bp)

    return app

app = create_app()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
