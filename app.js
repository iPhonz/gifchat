        const gifUrl = URL.createObjectURL(blob);
        selectedGif = gifUrl;
        const preview = document.createElement('img');
        preview.src = gifUrl;
        preview.style.maxWidth = '100%';
        preview.style.maxHeight = '100%';
        document.getElementById('gif-preview').innerHTML = '';
        document.getElementById('gif-preview').appendChild(preview);
    });
    
    gif.render();
}

async function searchGifs(query) {
    try {
        const response = await fetch(
            `${TENOR_API_URL}/search?q=${query}&key=${API_KEY}&client_key=gif_chat&limit=20`
        );
        const data = await response.json();
        return data.results;
    } catch (error) {
        console.error('Error fetching GIFs:', error);
        return [];
    }
}

function displayGifResults(gifs) {
    gifResults.innerHTML = '';
    gifs.forEach(gif => {
        const gifElement = document.createElement('div');
        gifElement.className = 'gif-result';
        const img = document.createElement('img');
        img.src = gif.media_formats.tinygif.url;
        img.alt = gif.content_description;
        gifElement.appendChild(img);

        gifElement.addEventListener('click', () => {
            selectedGif = gif.media_formats.gif.url;
            Array.from(gifResults.children).forEach(el => {
                el.classList.remove('selected');
            });
            gifElement.classList.add('selected');
        });

        gifResults.appendChild(gifElement);
    });
}

let searchTimeout;
gifSearch.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        const query = e.target.value.trim();
        if (query) {
            const gifs = await searchGifs(query);
            displayGifResults(gifs);
        } else {
            gifResults.innerHTML = '';
        }
    }, 300);
});

sendBtn.addEventListener('click', () => {
    if (selectedGif) {
        ws.send(selectedGif);
        selectedGif = null;
        gifResults.innerHTML = '';
        gifSearch.value = '';
        document.getElementById('gif-preview').innerHTML = '';
        cameraContainer.style.display = 'none';
        Array.from(document.querySelectorAll('.gif-result')).forEach(el => {
            el.classList.remove('selected');
        });
    }
});

cameraBtn.addEventListener('click', () => {
    cameraContainer.style.display = 'block';
    initCamera();
});

closeCamera.addEventListener('click', () => {
    cameraContainer.style.display = 'none';
    if (mediaRecorder && videoPreview.srcObject) {
        videoPreview.srcObject.getTracks().forEach(track => track.stop());
    }
    videoPreview.srcObject = null;
    document.getElementById('gif-preview').innerHTML = '';
    recordBtn.textContent = 'Start Recording';
    recordBtn.disabled = true;
    clearInterval(recordingInterval);
    recordingTimeLeft = 3;
    recordTimer.textContent = `${recordingTimeLeft}s`;
});

let isRecording = false;
recordBtn.addEventListener('click', () => {
    if (!isRecording) {
        // Start recording
        mediaRecorder.start();
        recordBtn.textContent = 'Stop Recording';
        isRecording = true;
        
        // Start countdown timer
        recordingInterval = setInterval(() => {
            recordingTimeLeft--;
            recordTimer.textContent = `${recordingTimeLeft}s`;
            
            if (recordingTimeLeft <= 0) {
                mediaRecorder.stop();
                isRecording = false;
                clearInterval(recordingInterval);
            }
        }, 1000);
        
        // Automatically stop after 3 seconds
        setTimeout(() => {
            if (mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                isRecording = false;
            }
        }, 3000);
    } else {
        // Stop recording
        mediaRecorder.stop();
        isRecording = false;
        clearInterval(recordingInterval);
    }
});

// Initialize messages container with dummy message
const welcomeMessage = document.createElement('div');
welcomeMessage.className = 'message';
welcomeMessage.textContent = 'Welcome to GIFChat! Start a conversation by sending a GIF.';
messagesContainer.appendChild(welcomeMessage);
