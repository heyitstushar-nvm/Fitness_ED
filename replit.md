# Fitness Ed

Flask web app (Python 3.12) using SQLite (`fitness_ed.db`), Flask-SQLAlchemy, and Authlib (Google OAuth).

## Run
- Workflow `Server`: `gunicorn --bind 0.0.0.0:5000 --reuse-port app:app`
- Entry: `app.py` (Flask `app` instance)

## Deployment
- Autoscale, run: `gunicorn --bind=0.0.0.0:5000 app:app`

## Notes
- Google OAuth requires `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` env vars.
