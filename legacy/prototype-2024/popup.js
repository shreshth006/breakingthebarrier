document.getElementById('convert').addEventListener('click', async () => {
    chrome.tabs.captureVisibleTab(null, {}, async function(dataUrl) {
        if (chrome.runtime.lastError) {
            console.error("Capture Error:", chrome.runtime.lastError.message);
            document.getElementById('result').innerText = "Error capturing image.";
            return;
        }

        // Send captured image data to Flask backend for processing
        const response = await fetch('http://127.0.0.1:5000/convert', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ image: dataUrl }) // Send image data as JSON
        });

        const data = await response.json();

        // Handle errors returned by the backend
        if (data.error) {
            document.getElementById('result').innerText = `Error: ${data.error}`;
            console.error("Backend Error:", data.error);
        } else {
            document.getElementById('result').innerText = data.romaji; // Display converted romaji text
        }
    });
});