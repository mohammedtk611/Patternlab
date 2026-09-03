from sqlalchemy_utils import database_exists, create_database
import os

DB_URI = os.environ.get('DATABASE_URL', 'postgresql://postgres:root1234@localhost:5432/patternlab')

def setup_db():
    if not database_exists(DB_URI):
        print(f"Creating database patternlab at {DB_URI}...")
        create_database(DB_URI)
        print("Database created.")
    else:
        print("Database already exists.")

if __name__ == '__main__':
    setup_db()
