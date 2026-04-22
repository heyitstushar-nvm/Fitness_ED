import json
import os
from datetime import date, datetime, timedelta, timezone

STREAK_WINDOW_HOURS = 35

from dotenv import load_dotenv
load_dotenv()

from flask import Flask, jsonify, redirect, render_template, request, session, url_for
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash
from authlib.integrations.flask_client import OAuth

app = Flask(__name__)
app.secret_key = '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'

# Disable static asset caching so style/script updates appear immediately
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

@app.after_request
def add_no_cache_headers(response):
    if request.path.startswith('/static/'):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

# OAuth Configuration
oauth = OAuth(app)
google = oauth.register(
    name='google',
    client_id=os.environ.get('GOOGLE_CLIENT_ID'),
    client_secret=os.environ.get('GOOGLE_CLIENT_SECRET'),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile'
    }
)

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
    time_text = db.Column(db.String(50), nullable=False, default='Added just now')
    is_done = db.Column(db.Boolean, default=False)


class ActivityDaily(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    day = db.Column(db.Date, nullable=False, index=True)
    steps = db.Column(db.Integer, nullable=False, default=0)
    distance_km = db.Column(db.Float, nullable=False, default=0.0)
    active_minutes = db.Column(db.Integer, nullable=False, default=0)
    calories = db.Column(db.Integer, nullable=False, default=0)
    sessions = db.Column(db.Integer, nullable=False, default=0)

    __table_args__ = (db.UniqueConstraint('user_id', 'day', name='uniq_user_day'),)


class UserStreak(db.Model):
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), primary_key=True)
    streak_count = db.Column(db.Integer, nullable=False, default=0)
    last_visit_at = db.Column(db.DateTime, nullable=True)  # stored as UTC


class ActivitySession(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    started_at = db.Column(db.DateTime, nullable=False, index=True)
    ended_at = db.Column(db.DateTime, nullable=False)
    duration_seconds = db.Column(db.Integer, nullable=False, default=0)
    distance_km = db.Column(db.Float, nullable=False, default=0.0)
    steps = db.Column(db.Integer, nullable=False, default=0)
    pace_per_km_seconds = db.Column(db.Integer, nullable=False, default=0)
    calories = db.Column(db.Integer, nullable=False, default=0)
    route_points_json = db.Column(db.Text, nullable=False, default='[]')


with app.app_context():
    db.create_all()


# Helpers

def get_or_create_daily_activity(user_id, target_day):
    row = ActivityDaily.query.filter_by(user_id=user_id, day=target_day).first()
    if not row:
        row = ActivityDaily(user_id=user_id, day=target_day)
        db.session.add(row)
        db.session.flush()
    return row


def week_window(end_day):
    return [end_day - timedelta(days=offset) for offset in range(6, -1, -1)]


def calculate_streak(user_id, end_day):
    streak = 0
    cursor = end_day
    while True:
        day_row = ActivityDaily.query.filter_by(user_id=user_id, day=cursor).first()
        if not day_row or day_row.sessions <= 0:
            break
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def parse_iso_datetime(iso_text, fallback=None):
    if not iso_text:
        return fallback
    try:
        normalized = str(iso_text).replace('Z', '+00:00')
        dt = datetime.fromisoformat(normalized)
    except ValueError:
        return fallback
    # Always store as UTC naive so the DB has a consistent zone.
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def to_iso_utc(dt):
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat().replace('+00:00', 'Z')


def record_user_visit(user_id):
    """Bump the user's streak when they open the app.

    Streak rules:
      - First ever visit -> streak = 1.
      - Gap since last visit > STREAK_WINDOW_HOURS -> streak resets to 1.
      - Gap within window AND a new calendar day -> streak += 1.
      - Same day visit -> unchanged.
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    record = UserStreak.query.filter_by(user_id=user_id).first()
    if not record:
        record = UserStreak(user_id=user_id, streak_count=1, last_visit_at=now)
        db.session.add(record)
        db.session.commit()
        return record

    last = record.last_visit_at
    if not last:
        record.streak_count = 1
    else:
        elapsed_hours = (now - last).total_seconds() / 3600.0
        if elapsed_hours > STREAK_WINDOW_HOURS:
            record.streak_count = 1
        elif last.date() != now.date():
            record.streak_count = (record.streak_count or 0) + 1
        # same calendar day -> unchanged
    record.last_visit_at = now
    db.session.commit()
    return record


def pace_text_from_seconds(pace_seconds):
    if not pace_seconds or pace_seconds <= 0:
        return '0:00'
    mins = int(pace_seconds // 60)
    secs = int(pace_seconds % 60)
    return f'{mins}:{secs:02d}'


def duration_text(seconds):
    seconds = max(0, int(seconds or 0))
    mins = seconds // 60
    secs = seconds % 60
    return f'{mins:02d}:{secs:02d}'


def session_to_payload(row):
    try:
        route_points = json.loads(row.route_points_json or '[]')
    except json.JSONDecodeError:
        route_points = []

    return {
        'id': row.id,
        'date_iso': row.started_at.date().isoformat(),
        'started_at_iso': to_iso_utc(row.started_at),
        'ended_at_iso': to_iso_utc(row.ended_at),
        'date_label': row.started_at.strftime('%d %b %Y'),
        'time_label': row.started_at.strftime('%I:%M %p'),
        'distance_km': round(row.distance_km, 2),
        'steps': row.steps,
        'pace_per_km': pace_text_from_seconds(row.pace_per_km_seconds),
        'duration': duration_text(row.duration_seconds),
        'calories': row.calories,
        'route_points': route_points,
    }


# Auth Routes
@app.route('/login/google')
def login_google():
    if not os.environ.get('GOOGLE_CLIENT_ID'):
        return "Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.", 500
    redirect_uri = url_for('auth_google_callback', _external=True)
    return google.authorize_redirect(redirect_uri)

@app.route('/auth/google/callback')
def auth_google_callback():
    token = google.authorize_access_token()
    user_info = token.get('userinfo')
    
    if user_info:
        email = user_info['email']
        username = user_info.get('name', email.split('@')[0])
        
        user = User.query.filter_by(email=email).first()
        if not user:
            dummy_password = generate_password_hash(os.urandom(24).hex())
            user = User(username=username, email=email, password_hash=dummy_password)
            db.session.add(user)
            db.session.commit()
            
        session['user_id'] = user.id
        session['user_name'] = user.username
        
    return redirect(url_for('home'))

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
    record_user_visit(session['user_id'])
    return render_template('home.html', name=session.get('user_name'))


@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('auth'))
    return redirect(url_for('home', section='tracker'))


@app.route('/todo')
def todo():
    if 'user_id' not in session:
        return redirect(url_for('auth'))
    return render_template('todo.html', name=session.get('user_name'))


@app.route('/nutrition')
def nutrition():
    if 'user_id' not in session:
        return redirect(url_for('auth'))
    return render_template('nutrition.html', name=session.get('user_name'))


@app.route('/analytics')
def analytics():
    if 'user_id' not in session:
        return redirect(url_for('auth'))
    return render_template('analytics.html', name=session.get('user_name'))


@app.route('/history')
def history():
    if 'user_id' not in session:
        return redirect(url_for('auth'))
    return render_template('history.html', name=session.get('user_name'))


@app.route('/share')
def share():
    if 'user_id' not in session:
        return redirect(url_for('auth'))
    return render_template('share.html', name=session.get('user_name'))


@app.route('/auth')
def auth():
    return render_template('auth.html')


# API Routes for To-Do List
@app.route('/api/todos', methods=['GET'])
def get_todos():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    todos = TodoItem.query.filter_by(user_id=session['user_id']).all()
    return jsonify([{'id': t.id, 'text': t.text, 'time': t.time_text, 'done': t.is_done} for t in todos])


@app.route('/api/todos', methods=['POST'])
def create_todo():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json or {}
    text = (data.get('text') or '').strip()
    if not text:
        return jsonify({'error': 'Task text is required'}), 400

    new_todo = TodoItem(user_id=session['user_id'], text=text, time_text=data.get('time', 'Added just now'), is_done=False)
    db.session.add(new_todo)
    db.session.commit()
    return jsonify({'id': new_todo.id, 'text': new_todo.text, 'time': new_todo.time_text, 'done': new_todo.is_done})


@app.route('/api/todos/<int:todo_id>', methods=['DELETE'])
def delete_todo(todo_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    todo = TodoItem.query.filter_by(id=todo_id, user_id=session['user_id']).first()
    if todo:
        db.session.delete(todo)
        db.session.commit()
    return jsonify({'success': True})


@app.route('/api/todos/<int:todo_id>/toggle', methods=['POST'])
def toggle_todo(todo_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json or {}
    todo = TodoItem.query.filter_by(id=todo_id, user_id=session['user_id']).first()
    if todo:
        todo.is_done = bool(data.get('done', False))
        db.session.commit()
    return jsonify({'success': True})


# Activity APIs
@app.route('/api/activity/session', methods=['POST'])
def log_activity_session():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json or {}
    duration_seconds = max(0, int(data.get('duration_seconds', 0)))
    distance_km = max(0.0, float(data.get('distance_km', 0.0)))
    steps = max(0, int(data.get('steps', 0)))
    route_points = data.get('route_points') or []

    if duration_seconds <= 0 and distance_km <= 0:
        return jsonify({'error': 'Session is too short to log'}), 400

    active_minutes = max(1, round(duration_seconds / 60))
    calories = max(1, round((distance_km * 62) + (active_minutes * 3.5)))
    pace_per_km_seconds = int(round(duration_seconds / distance_km)) if distance_km > 0 else 0

    ended_at = parse_iso_datetime(data.get('ended_at'), fallback=datetime.now())
    started_at = parse_iso_datetime(data.get('started_at'), fallback=ended_at - timedelta(seconds=duration_seconds))

    session_row = ActivitySession(
        user_id=session['user_id'],
        started_at=started_at,
        ended_at=ended_at,
        duration_seconds=duration_seconds,
        distance_km=distance_km,
        steps=steps,
        pace_per_km_seconds=pace_per_km_seconds,
        calories=calories,
        route_points_json=json.dumps(route_points),
    )
    db.session.add(session_row)

    today = ended_at.date()
    daily = get_or_create_daily_activity(session['user_id'], today)
    daily.steps += steps
    daily.distance_km += distance_km
    daily.active_minutes += active_minutes
    daily.calories += calories
    daily.sessions += 1

    db.session.commit()

    return jsonify(
        {
            'success': True,
            'day': today.isoformat(),
            'session': session_to_payload(session_row),
            'logged': {
                'distance_km': round(distance_km, 2),
                'steps': steps,
                'active_minutes': active_minutes,
                'calories': calories,
            },
        }
    )


@app.route('/api/activity/history', methods=['GET'])
def activity_history():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    user_id = session['user_id']
    show_all = request.args.get('all') == '1'

    query = ActivitySession.query.filter_by(user_id=user_id).order_by(ActivitySession.started_at.desc())

    if show_all:
        rows = query.all()
    else:
        day_cutoff = date.today() - timedelta(days=3)
        start_dt = datetime.combine(day_cutoff, datetime.min.time())
        rows = query.filter(ActivitySession.started_at >= start_dt).all()

    return jsonify({'sessions': [session_to_payload(row) for row in rows]})


@app.route('/api/activity/session/<int:session_id>', methods=['GET'])
def activity_session_detail(session_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    row = ActivitySession.query.filter_by(id=session_id, user_id=session['user_id']).first()
    if not row:
        return jsonify({'error': 'Session not found'}), 404

    return jsonify({'session': session_to_payload(row)})


@app.route('/api/activity/summary', methods=['GET'])
def activity_summary():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    user_id = session['user_id']
    today = date.today()

    today_data = ActivityDaily.query.filter_by(user_id=user_id, day=today).first()
    weekly_days = week_window(today)
    weekly_rows = ActivityDaily.query.filter(
        ActivityDaily.user_id == user_id,
        ActivityDaily.day >= weekly_days[0],
        ActivityDaily.day <= weekly_days[-1],
    ).all()
    weekly_by_day = {row.day: row for row in weekly_rows}

    chart_labels = [d.strftime('%a') for d in weekly_days]
    chart_active_minutes = [weekly_by_day[d].active_minutes if d in weekly_by_day else 0 for d in weekly_days]

    sessions_week = sum((weekly_by_day[d].sessions if d in weekly_by_day else 0) for d in weekly_days)

    # Streak based on app usage (UserStreak), not just workout sessions.
    streak_row = UserStreak.query.filter_by(user_id=user_id).first()
    streak = streak_row.streak_count if streak_row else 0
    last_visit_iso = to_iso_utc(streak_row.last_visit_at) if streak_row and streak_row.last_visit_at else None

    return jsonify(
        {
            'today': {
                'calories': today_data.calories if today_data else 0,
                'steps': today_data.steps if today_data else 0,
                'distance_km': round(today_data.distance_km, 2) if today_data else 0,
                'active_minutes': today_data.active_minutes if today_data else 0,
                'sessions': today_data.sessions if today_data else 0,
            },
            'sessions_week': sessions_week,
            'streak_days': streak,
            'streak': {
                'count': streak,
                'last_visit_at': last_visit_iso,
                'window_hours': STREAK_WINDOW_HOURS,
            },
            'chart': {
                'labels': chart_labels,
                'active_minutes': chart_active_minutes,
            },
        }
    )


@app.route('/api/streak', methods=['GET'])
def streak_status():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    row = UserStreak.query.filter_by(user_id=session['user_id']).first()
    if not row:
        return jsonify({'count': 0, 'last_visit_at': None, 'window_hours': STREAK_WINDOW_HOURS})
    return jsonify(
        {
            'count': row.streak_count or 0,
            'last_visit_at': to_iso_utc(row.last_visit_at) if row.last_visit_at else None,
            'window_hours': STREAK_WINDOW_HOURS,
        }
    )


@app.route('/api/activity/analytics', methods=['GET'])
def activity_analytics():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    user_id = session['user_id']
    today = date.today()
    start_day = today - timedelta(days=29)
    rows = ActivityDaily.query.filter(
        ActivityDaily.user_id == user_id,
        ActivityDaily.day >= start_day,
        ActivityDaily.day <= today,
    ).order_by(ActivityDaily.day.asc()).all()

    by_day = {row.day: row for row in rows}
    days = [start_day + timedelta(days=i) for i in range(30)]

    distance_series = [round(by_day[d].distance_km, 2) if d in by_day else 0 for d in days]
    calories_series = [by_day[d].calories if d in by_day else 0 for d in days]
    steps_series = [by_day[d].steps if d in by_day else 0 for d in days]

    total_distance = round(sum(distance_series), 2)
    total_calories = sum(calories_series)
    total_steps = sum(steps_series)

    return jsonify(
        {
            'labels': [d.strftime('%d %b') for d in days],
            'distance_km': distance_series,
            'calories': calories_series,
            'steps': steps_series,
            'totals': {
                'distance_km': total_distance,
                'calories': total_calories,
                'steps': total_steps,
            },
        }
    )


if __name__ == '__main__':
    app.run(debug=True)
