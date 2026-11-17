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
        try:
            with db.engine.connect() as conn:
                if db.engine.dialect.name == 'postgresql':
                    conn.execute(db.text("ALTER TABLE dataset ADD COLUMN IF NOT EXISTS file_data BYTEA"))
                    conn.execute(db.text("ALTER TABLE dataset ADD COLUMN IF NOT EXISTS storage_path VARCHAR(255)"))
                    conn.execute(db.text("ALTER TABLE dataset ALTER COLUMN user_id DROP NOT NULL"))
                    conn.commit()
                elif db.engine.dialect.name == 'sqlite':
                    columns = [row[1] for row in conn.execute(db.text("PRAGMA table_info(dataset)")).fetchall()]
                    if 'file_data' not in columns:
                        conn.execute(db.text("ALTER TABLE dataset ADD COLUMN file_data BLOB"))
                    if 'storage_path' not in columns:
                        conn.execute(db.text("ALTER TABLE dataset ADD COLUMN storage_path VARCHAR(255)"))
                    conn.commit()
        except Exception as e:
            app.logger.warning(f"Database schema setup notice: {e}")

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
