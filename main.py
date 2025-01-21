import os
import logging
import time
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
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Set up ElevenLabs API
elevenlabs_api_key = os.environ.get("ELEVENLABS_API_KEY")
if elevenlabs_api_key:
    set_api_key(elevenlabs_api_key)
else:
    logger.warning("ELEVENLABS_API_KEY not found in environment variables")

# Set up OpenAI API
openai.api_key = os.environ.get("OPENAI_API_KEY")
if not openai.api_key:
    logger.warning("OPENAI_API_KEY not found in environment variables")


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
        db = get_db()
        user = db.execute('SELECT username FROM users WHERE id = ?',
                          (session['user_id'], )).fetchone()
        return jsonify({"authenticated": True, "username": user['username']})
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
    if not data:
        logger.error("No JSON data received")
        return jsonify({"error": "No data received"}), 400

    logger.info(f"Received data: {data}")

    user_message = data.get('message')
    object_name = data.get('object')
    age = data.get('age')
    is_initial_greeting = data.get('is_initial_greeting', False)

    logger.info(
        f"Extracted data: message={user_message}, object={object_name}, age={age}, is_initial_greeting={is_initial_greeting}"
    )

    if not object_name:
        logger.error("Missing required field: object")
        return jsonify({"error": "Missing required field: object"}), 400
    if not age:
        logger.error("Missing required field: age")
        return jsonify({"error": "Missing required field: age"}), 400

    # Generate AI response using OpenAI
    if is_initial_greeting:
        system_message = f"You are {object_name} greeting a {age}-year-old child. Introduce yourself and ask how you can help them today. Keep your response friendly, educational, and appropriate for their age, in 50 words or less."
        user_content = ""
    else:
        system_message = f"You are {object_name} talking to a {age}-year-old child. Respond in a friendly, educational manner appropriate for their age, in 50 words or less. Maintain context from previous messages."
        user_content = user_message

    try:
        logger.info(
            f"Sending request to OpenAI: system_message={system_message}, user_content={user_content}"
        )
        response = openai.chat.completions.create(model="gpt-4o-mini",
                                                  messages=[{
                                                      "role":
                                                      "system",
                                                      "content":
                                                      system_message
                                                  }, {
                                                      "role":
                                                      "user",
                                                      "content":
                                                      user_content
                                                  }])
        ai_response = response.choices[0].message.content
        logger.info(f"Received response from OpenAI: {ai_response}")

        if not ai_response:
            raise ValueError("Received empty response from OpenAI")

        logger.info(f"Generating audio with ElevenLabs: text={ai_response}")

        # Generate audio using ElevenLabs
        audio = generate(text=ai_response,
                         voice=Voice(voice_id="EXAVITQu4vr4xnSDxMaL",
                                     name="Bella"),
                         model="eleven_monolingual_v1")

        # Add more detailed logging for the audio generation process
        logger.info(f"Generated audio size: {len(audio)} bytes")
        logger.info(f"Audio content type: {type(audio)}")

        # Save audio to a temporary file
        temp_audio_path = os.path.join('static', 'temp',
                                       f"{object_name}_response.mp3")
        os.makedirs(os.path.dirname(temp_audio_path), exist_ok=True)
        with open(temp_audio_path, "wb") as f:
            if isinstance(audio, bytes):
                f.write(audio)
            else:
                f.write(b''.join(audio))
        logger.info(f"Audio saved to {temp_audio_path}")

        return jsonify({
            "text": ai_response,
            "audio_url": f"/static/temp/{object_name}_response.mp3"
        })

    except Exception as e:
        logger.error(f"Error in generate_response: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/process-audio', methods=['POST'])
def process_audio():
    logger.info("Received request to /process-audio")
    start_time = time.time()

    # Log request details
    logger.info(f"Request headers: {request.headers}")
    logger.info(f"Request form data: {request.form}")

    if 'user_id' not in session:
        logger.warning("Unauthenticated user tried to access process-audio")
        return jsonify({"error": "User not authenticated"}), 401

    try:
        # Log audio file details
        audio_file = request.files['audio']
        logger.info(
            f"Received audio file: {audio_file.filename}, size: {audio_file.content_length} bytes"
        )

        object_name = request.form.get('object')
        age = request.form.get('age')

        logger.info(f"Processing audio for Object: {object_name}, Age: {age}")

        if not audio_file or not object_name or not age:
            logger.error("Missing required fields in the request")
            return jsonify({"error": "Missing required fields"}), 400

        # Save the audio file temporarily
        save_start_time = time.time()
        temp_audio_path = os.path.join('static', 'temp', 'temp_audio.wav')
        audio_file.save(temp_audio_path)
        logger.info(
            f"Saved temporary audio file: {temp_audio_path} (took {time.time() - save_start_time:.2f} seconds)"
        )

        # Transcribe audio using Whisper
        transcribe_start_time = time.time()
        logger.info("Starting audio transcription with Whisper")
        with open(temp_audio_path, 'rb') as audio_file:
            transcript = openai.audio.transcriptions.create(model="whisper-1",
                                                            file=audio_file)
        logger.info(
            f"Transcription completed in {time.time() - transcribe_start_time:.2f} seconds. Result: {transcript['text']}"
        )

        # Generate AI response
        ai_start_time = time.time()
        logger.info("Generating AI response")
        system_message = f"You are {object_name} talking to a {age}-year-old child. Respond in a friendly, educational manner appropriate for their age, in 50 words or less. Maintain context from previous messages."
        ai_response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "system",
                "content": system_message
            }, {
                "role": "user",
                "content": transcript['text']
            }]).choices[0].message.content
        logger.info(
            f"AI response generated in {time.time() - ai_start_time:.2f} seconds: {ai_response}"
        )

        # Generate audio using ElevenLabs
        audio_start_time = time.time()
        logger.info("Generating audio with ElevenLabs")
        audio = generate(text=ai_response,
                         voice=Voice(voice_id="EXAVITQu4vr4xnSDxMaL",
                                     name="Bella"),
                         model="eleven_monolingual_v1")
        logger.info(
            f"Audio generated in {time.time() - audio_start_time:.2f} seconds")

        # Save audio to a temporary file
        temp_audio_path = os.path.join('static', 'temp',
                                       f"{object_name}_response.mp3")
        os.makedirs(os.path.dirname(temp_audio_path), exist_ok=True)
        with open(temp_audio_path, "wb") as f:
            if isinstance(audio, bytes):
                f.write(audio)
            else:
                f.write(b''.join(audio))
        logger.info(f"Audio saved to {temp_audio_path}")

        response_data = {
            "text": ai_response,
            "audio_url": f"/static/temp/{object_name}_response.mp3"
        }
        logger.info(
            f"Total processing time: {time.time() - start_time:.2f} seconds")
        logger.info(f"Sending response: {response_data}")
        return jsonify(response_data)

    except Exception as e:
        logger.error(f"Error in process_audio: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/check-audio/<path:filename>')
def check_audio(filename):
    file_path = os.path.join('static', 'temp', filename)
    if os.path.exists(file_path):
        file_size = os.path.getsize(file_path)
        return jsonify({"exists": True, "size": file_size})
    else:
        return jsonify({"exists": False})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
