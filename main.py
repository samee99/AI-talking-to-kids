import os
from flask import Flask, render_template, send_from_directory, redirect, url_for
from shutil import copy

app = Flask(__name__, static_folder='static', static_url_path='/static')

# Move image files to the correct location
image_files = ['moon.jpg', 'sun.jpg', 'rock.jpg', 'tree.jpg', 'sun_call.jpg']
for image in image_files:
    src = os.path.join('images', image)
    dst = os.path.join('static', 'images', image)
    if os.path.exists(src):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        copy(src, dst)

# Move sound files to the static folder
sound_files = [f"{obj}_{age}_year_old.mp3" for obj in ['moon', 'sun', 'rock', 'tree'] for age in [5, 10]]
for sound in sound_files:
    src = os.path.join('Sounds', sound)
    dst = os.path.join('static', 'sounds', sound)
    if os.path.exists(src):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        copy(src, dst)

@app.route("/")
def index():
    return render_template("index.html")

@app.route('/static/sounds/<path:filename>')
def serve_sound(filename):
    return send_from_directory('static/sounds', filename)

@app.route('/sun_call')
def sun_call():
    return send_from_directory('static/images', 'sun_call.jpg')

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
