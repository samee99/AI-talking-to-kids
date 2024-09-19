
import os
from flask import Flask, render_template
from shutil import copy

app = Flask(__name__, static_folder='static', static_url_path='/static')

# Move image files to the correct location
image_files = ['moon.jpg', 'sun.jpg', 'rock.jpg', 'tree.jpg']
for image in image_files:
    src = os.path.join('images', image)
    dst = os.path.join('static', 'images', image)
    if os.path.exists(src):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        copy(src, dst)

@app.route("/")
def index():
    return render_template("index.html")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
