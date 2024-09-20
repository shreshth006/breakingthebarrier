from flask import Flask, request, jsonify
import pykakasi
import pytesseract
from PIL import Image
import io
import base64

app = Flask(__name__)

# Set the path to the Tesseract executable if necessary
# If you have added Tesseract to your PATH, you can use:
pytesseract.pytesseract.tesseract_cmd = r'tesseract'  # No need for full path if in PATH

# If you prefer to specify the full path (uncomment and update if needed):
# pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'  # Update this path as needed

@app.route('/convert', methods=['POST'])
def convert_to_romaji():
    # Get image data from request
    image_data = request.json.get('image')
    
    if not image_data:
        return jsonify({"error": "No image data provided"}), 400  # Return an error if no image is found

    try:
        # Process the base64 image data
        header, encoded = image_data.split(',', 1)  # Split header from base64 data
        img_data = io.BytesIO(base64.b64decode(encoded))  # Decode base64 data to binary
        img = Image.open(img_data)  # Open the image using PIL

        # Perform OCR on the image to extract Japanese text
        text = pytesseract.image_to_string(img, lang='jpn')

        # Convert Japanese text to romaji using pykakasi
        kks = pykakasi.kakasi()
        result = kks.convert(text)
        romaji_text = ''.join([entry['hepburn'] for entry in result])

        return jsonify({"romaji": romaji_text})

    except Exception as e:
        return jsonify({"error": str(e)}), 500  # Return a server error if something goes wrong

if __name__ == '__main__':
    app.run(debug=True)