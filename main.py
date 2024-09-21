import os
import logging
from flask import Flask, render_template, send_from_directory, request, jsonify, redirect, url_for, session, flash
from shutil import copy
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
from elevenlabs import generate, set_api_key, Voice
import openai
from flask_cors import CORS

app = Flask(__name__, static_folder='static', static_url_path='/static')
CORS(app)
app.secret_key = os.urandom(24)  # Set a secret key for session management

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Set up ElevenLabs API
set_api_key(os.environ.get("ELEVENLABS_API_KEY"))

# Set up OpenAI API
openai.api_key = os.environ.get("OPENAI_API_KEY")


# Database setup
def get_db():
    db = sqlite3.connect('users.db')
    db.row_factory = sqlite3.Row
    return db


def init_db():
    with app.app_context():
        db = get_db()
        db.execute(
            'CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL)'
        )
        db.commit()


init_db()

# Move image files to the correct location
image_files = [
    'moon.jpg', 'sun.jpg', 'rock.jpg', 'tree.jpg', 'audio-icon.svg',
    'facetime-icon.svg', 'mute-icon.svg', 'talk-back-icon.svg'
]
for image in image_files:
    src = os.path.join('images', image)
    dst = os.path.join('static', 'images', image)
    if os.path.exists(src):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        copy(src, dst)

# Move sound files to the static folder
sound_files = [
    f"{obj}_{age}_year_old.mp3" for obj in ['moon', 'sun', 'rock', 'tree']
    for age in [5, 10]
]
for sound in sound_files:
    src = os.path.join('Sounds', sound)
    dst = os.path.join('static', 'sounds', sound)
    if os.path.exists(src):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        copy(src, dst)


@app.route("/")
def index():
    user = None
    if 'user_id' in session:
        db = get_db()
        user = db.execute('SELECT * FROM users WHERE id = ?',
                          (session['user_id'], )).fetchone()
    return render_template("index.html", user=user)


@app.route('/static/sounds/<path:filename>')
def serve_sound(filename):
    return send_from_directory('static/sounds', filename)


@app.route('/check-auth')
def check_auth():
    if 'user_id' in session:
        return jsonify({"authenticated": True})
    return jsonify({"authenticated": False})


@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        db = get_db()
        error = None

        if not username:
            error = 'Username is required.'
        elif not password:
            error = 'Password is required.'
        elif db.execute('SELECT id FROM users WHERE username = ?',
                        (username, )).fetchone() is not None:
            error = f"User {username} is already registered."

        if error is None:
            db.execute('INSERT INTO users (username, password) VALUES (?, ?)',
                       (username, generate_password_hash(password)))
            db.commit()
            return redirect(url_for('signin'))

        flash(error)

    return render_template('signup.html')


@app.route('/signin', methods=['GET', 'POST'])
def signin():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        db = get_db()
        error = None
        user = db.execute('SELECT * FROM users WHERE username = ?',
                          (username, )).fetchone()

        if user is None:
            error = 'Incorrect username.'
        elif not check_password_hash(user['password'], password):
            error = 'Incorrect password.'

        if error is None:
            session.clear()
            session['user_id'] = user['id']
            return redirect(url_for('index'))

        flash(error)

    return render_template('signin.html')


@app.route('/signout')
def signout():
    session.clear()
    return redirect(url_for('index'))


@app.route('/generate-response', methods=['POST'])
def generate_response():
    if 'user_id' not in session:
        logger.warning(
            "Unauthenticated user tried to access generate-response")
        return jsonify({"error": "User not authenticated"}), 401

    data = request.json
    logger.info(f"Received data: {data}")

    user_message = data.get('message')
    object_name = data.get('object')
    age = data.get('age')

    logger.info(
        f"Extracted data: message={user_message}, object={object_name}, age={age}"
    )

    if not user_message:
        logger.error("Missing required field: message")
        return jsonify({"error": "Missing required field: message"}), 400
    if not object_name:
        logger.error("Missing required field: object")
        return jsonify({"error": "Missing required field: object"}), 400
    if not age:
        logger.error("Missing required field: age")
        return jsonify({"error": "Missing required field: age"}), 400

    # Generate AI response using OpenAI
    prompt = f"You are {object_name} talking to a {age}-year-old child. The child says: '{user_message}'. Respond in a friendly, educational manner appropriate for their age, in 50 words or less."

    try:
        logger.info(f"Sending request to OpenAI: prompt={prompt}")
        response = openai.chat.completions.create(model="gpt-4o-mini",
                                                  messages=[{
                                                      "role": "system",
                                                      "content": prompt
                                                  }, {
                                                      "role":
                                                      "user",
                                                      "content":
                                                      user_message
                                                  }])
        ai_response = response.choices[0].message
        logger.info(f"Received response from OpenAI: {ai_response}")

        # Generate audio using ElevenLabs
        voice = Voice(voice_id="21m00Tcm4TlvDq8ikWAM", name="Rachel")
        logger.info(f"Generating audio with ElevenLabs: text={ai_response}")
        audio = generate(text=ai_response,
                         voice=voice,
                         model="eleven_monolingual_v1")

        # Save audio to a temporary file
        temp_audio_path = os.path.join('static', 'temp',
                                       f"{object_name}_response.mp3")
        os.makedirs(os.path.dirname(temp_audio_path), exist_ok=True)
        with open(temp_audio_path, "wb") as f:
            f.write(audio)
        logger.info(f"Audio saved to {temp_audio_path}")

        return jsonify({
            "text": ai_response,
            "audio_url": f"/static/temp/{object_name}_response.mp3"
        })

    except Exception as e:
        logger.error(f"Error in generate_response: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
