from flask import Flask, request, jsonify
import pykakasi
from PIL import Image
import io
import pytesseract

app = Flask(__name__)

@app.route('/convert', methods=['POST'])
def convert_to_romaji():
    image_data = request.files['image'].read()
    img = Image.open(io.BytesIO(image_data))
    
    # Perform OCR on the image using Pillow
    text = pytesseract.image_to_string(img, lang='jpn')
    
    kks = pykakasi.kakasi()
    result = kks.convert(text)
    
    romaji_text = ''.join([entry['hepburn'] for entry in result])
    return jsonify({"romaji": romaji_text})

if __name__ == '__main__':
    app.run(debug=True)