chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'convertLyrics') {
        const lyricsElement = document.querySelector('.lyrics-selector');
        if (lyricsElement) {
            const originalText = lyricsElement.innerText;
            // Replace Japanese lyrics with romaji
            lyricsElement.innerText = request.romaji;
        }
    }
});