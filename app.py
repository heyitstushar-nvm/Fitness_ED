from flask import Flask, render_template, request, redirect, url_for, session

app = Flask(__name__)
app.secret_key = 'your_super_secret_key_here'


@app.route('/register', methods=['POST'])
def register():
    username = request.form.get('username')
    email = request.form.get('email')
    password = request.form.get('password')
    
    session['user_name'] = username
    
    return redirect(url_for('dashboard'))

@app.route('/')
@app.route('/home')
def home():  
    user_name = session.get('user_name', 'Guest')
    return render_template('home.html', name=user_name)

@app.route('/dashboard')
def dashboard():        
    return render_template('fitness-ed.html')

@app.route('/auth')
def auth():
    return render_template('auth.html')



@app.route('/login', methods=['POST'])
def login():
    email = request.form.get('email')
    password = request.form.get('password')
    
    session['user_name'] = request.form.get('username', request.form.get('email', 'User'))
    
    return redirect(url_for('dashboard'))

if __name__ == '__main__':
    app.run(debug=True)

