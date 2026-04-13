import os
from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = 'your_super_secret_key_here'

# Database Configuration
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'fitness_ed.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)

class TodoItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    text = db.Column(db.String(200), nullable=False)
    time_text = db.Column(db.String(50), nullable=False, default="Added just now")
    is_done = db.Column(db.Boolean, default=False)

with app.app_context():
    db.create_all()

# Auth Routes
@app.route('/register', methods=['POST'])
def register():
    username = request.form.get('username')
    email = request.form.get('email')
    password = request.form.get('password')
    
    if email and password and username:
        existing_user = User.query.filter_by(email=email).first()
        if not existing_user:
            hashed_password = generate_password_hash(password)
            new_user = User(username=username, email=email, password_hash=hashed_password)
            db.session.add(new_user)
            db.session.commit()
            session['user_id'] = new_user.id
            session['user_name'] = new_user.username
            return redirect(url_for('home'))
            
    # Fallback / Error
    return redirect(url_for('auth'))

@app.route('/login', methods=['POST'])
def login():
    email = request.form.get('email')
    password = request.form.get('password')
    
    user = User.query.filter_by(email=email).first()
    if user and check_password_hash(user.password_hash, password):
        session['user_id'] = user.id
        session['user_name'] = user.username
        return redirect(url_for('home'))
        
    return redirect(url_for('auth'))

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('auth'))

# UI Routes
@app.route('/')
def landing():
    return render_template('landing.html')

@app.route('/home')
def home():
    if 'user_id' not in session:
        return redirect(url_for('auth'))
    return render_template('home.html', name=session.get('user_name'))

@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('auth'))
    return render_template('fitness-ed.html')

@app.route('/todo')
def todo():
    if 'user_id' not in session:
        return redirect(url_for('auth'))
    return render_template('todo.html')

@app.route('/auth')
def auth():
    return render_template('auth.html')

# API Routes for To-Do List
@app.route('/api/todos', methods=['GET'])
def get_todos():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    # Notice we sort so the newest items come first optionally, 
    # but we will just return them in order and let JS handle prepending if it wants.
    todos = TodoItem.query.filter_by(user_id=session['user_id']).all()
    # return oldest first, so frontend prepends them
    return jsonify([{"id": t.id, "text": t.text, "time": t.time_text, "done": t.is_done} for t in todos])

@app.route('/api/todos', methods=['POST'])
def create_todo():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    new_todo = TodoItem(user_id=session['user_id'], text=data['text'], time_text=data.get('time', 'Added just now'), is_done=False)
    db.session.add(new_todo)
    db.session.commit()
    return jsonify({"id": new_todo.id, "text": new_todo.text, "time": new_todo.time_text, "done": new_todo.is_done})

@app.route('/api/todos/<int:todo_id>', methods=['DELETE'])
def delete_todo(todo_id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    todo = TodoItem.query.filter_by(id=todo_id, user_id=session['user_id']).first()
    if todo:
        db.session.delete(todo)
        db.session.commit()
    return jsonify({"success": True})

@app.route('/api/todos/<int:todo_id>/toggle', methods=['POST'])
def toggle_todo(todo_id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    todo = TodoItem.query.filter_by(id=todo_id, user_id=session['user_id']).first()
    if todo:
        todo.is_done = data['done']
        db.session.commit()
    return jsonify({"success": True})

if __name__ == '__main__':
    app.run(debug=True)
