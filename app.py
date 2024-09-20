from flask import Flask, request, jsonify
import romkan

app = Flask(__name__)

@app.route('/convert', methods=['POST'])
def convert_to_romaji():
    data = request.json
    japanese_text = data.get('text', '')
    romaji_text = romkan.to_roma(japanese_text)
    return jsonify({"romaji": romaji_text})

if __name__ == '__main__':
    app.run(debug=True)