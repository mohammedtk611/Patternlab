from flask import Blueprint, render_template, request, jsonify, redirect, url_for, flash
from flask_login import login_user, current_user, logout_user, login_required
from database.db import db, bcrypt
from database.models import User

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard.index'))
        
    if request.method == 'POST':
        email = (request.form.get('email') or '').strip()
        password = request.form.get('password') or ''
        
        if not email or not password:
            flash('Please enter both email and password.', 'danger')
            return render_template('auth/login.html')
            
        user = User.query.filter_by(email=email).first()
        
        if user and bcrypt.check_password_hash(user.password_hash, password):
            login_user(user, remember=True)
            return redirect(url_for('dashboard.index'))
        else:
            flash('Login Unsuccessful. Please check email and password.', 'danger')
            
    return render_template('auth/login.html')

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard.index'))
        
    if request.method == 'POST':
        username = (request.form.get('username') or '').strip()
        email = (request.form.get('email') or '').strip()
        password = request.form.get('password') or ''
        
        if not username or not email or not password:
            flash('All fields are required.', 'danger')
            return render_template('auth/register.html')
            
        if len(username) < 3 or len(username) > 20:
            flash('Username must be between 3 and 20 characters.', 'danger')
            return render_template('auth/register.html')
            
        if len(password) < 6:
            flash('Password must be at least 6 characters long.', 'danger')
            return render_template('auth/register.html')
            
        if User.query.filter_by(username=username).first():
            flash('Username is already taken. Please choose a different one.', 'danger')
            return render_template('auth/register.html')
            
        if User.query.filter_by(email=email).first():
            flash('Email is already registered. Please log in instead.', 'danger')
            return render_template('auth/register.html')
            
        try:
            hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
            user = User(username=username, email=email, password_hash=hashed_password)
            db.session.add(user)
            db.session.commit()
            
            flash('Your account has been created! You can now log in.', 'success')
            return redirect(url_for('auth.login'))
        except Exception as e:
            db.session.rollback()
            flash('An error occurred during registration. Please try again.', 'danger')
            return render_template('auth/register.html')
            
    return render_template('auth/register.html')

@auth_bp.route('/logout')
def logout():
    logout_user()
    return redirect(url_for('dashboard.index'))
