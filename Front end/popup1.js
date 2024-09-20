document.getElementById('convert').addEventListener('click', async () => {
    chrome.tabs.captureVisibleTab((dataUrl) => {
        fetch('http://127.0.0.1:5000/convert', {
            method: 'POST',
            body: dataUrl
        })
        .then(response => response.json())
        .then(data => {
            // Replace Japanese lyrics with romaji
            const lyricsElement = document.querySelector('.lyrics-selector');
            if (lyricsElement) {
                lyricsElement.innerText = data.romaji;
            }
        });
    });
});