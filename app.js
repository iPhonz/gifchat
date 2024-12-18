    }
}

async function handleStop() {
    clearInterval(state.recordingInterval);
    state.isRecording = false;
    elements.recordBtn.textContent = 'Start Recording';
    elements.recordBtn.classList.remove('recording');
    elements.recordingIndicator.classList.add('hidden');
    elements.cameraOverlay.classList.remove('recording');
    
    try {
        elements.conversionStatus.textContent = 'Processing recording...';
        const videoBlob = new Blob(state.recordedChunks, { type: 'video/webm' });
        state.recordedChunks = [];
        
        const video = document.createElement('video');
        video.src = URL.createObjectURL(videoBlob);
        video.muted = true;
        
        await new Promise((resolve) => {
            video.onloadedmetadata = resolve;
        });
        await video.play();
        
        const canvas = document.createElement('canvas');
        canvas.width = 480;  // Increased dimensions for better quality
        canvas.height = 360;
        const ctx = canvas.getContext('2d');
        
        const gif = new GIF({
            workers: 4,  // Increased workers for faster processing
            quality: 8,  // Slightly increased quality
            width: 480,
            height: 360,
            workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js'
        });
        
        const frameCount = Math.min(45, video.duration * 15); // Cap at 45 frames, 15fps
        const frameInterval = video.duration / frameCount;
        
        elements.conversionStatus.textContent = 'Creating GIF...';
        
        // Process frames
        for (let i = 0; i < frameCount; i++) {
            const currentTime = i * frameInterval;
            video.currentTime = currentTime;
            
            await new Promise(resolve => {
                video.onseeked = () => {
                    ctx.drawImage(video, 0, 0, 480, 360);
                    gif.addFrame(ctx, {
                        copy: true,
                        delay: frameInterval * 1000,
                        disposalMethod: 'restore'
                    });
                    resolve();
                };
            });
            
            // Update progress
            elements.conversionStatus.textContent = 
                `Creating GIF... ${Math.round((i / frameCount) * 100)}%`;
        }
        
        // Render GIF
        gif.on('progress', p => {
            elements.conversionStatus.textContent = 
                `Finalizing... ${Math.round(p * 100)}%`;
        });
        
        gif.on('finished', blob => {
            state.selectedGif = URL.createObjectURL(blob);
            elements.sendBtn.disabled = false;
            
            const preview = document.createElement('img');
            preview.src = state.selectedGif;
            elements.previewArea.innerHTML = '';
            elements.previewArea.appendChild(preview);
            elements.previewArea.classList.remove('hidden');
            
            elements.conversionStatus.textContent = 'GIF ready! Click Send to share.';
        });
        
        gif.render();
        
    } catch (error) {
        console.error('Error creating GIF:', error);
        elements.conversionStatus.textContent = 
            'Error creating GIF. Please try again.';
    }
}

// GIF Search Functionality
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
    elements.gifResults.innerHTML = '';
    elements.gifResults.classList.remove('hidden');
    
    gifs.forEach(gif => {
        const gifElement = document.createElement('div');
        gifElement.className = 'gif-result';
        
        const img = document.createElement('img');
        img.src = gif.media_formats.tinygif.url;
        img.alt = gif.content_description;
        img.loading = 'lazy';
        
        gifElement.appendChild(img);
        
        gifElement.addEventListener('click', () => {
            state.selectedGif = gif.media_formats.gif.url;
            elements.sendBtn.disabled = false;
            
            Array.from(elements.gifResults.children).forEach(el => {
                el.classList.remove('selected');
            });
            gifElement.classList.add('selected');
        });
        
        elements.gifResults.appendChild(gifElement);
    });
}

// Event Listeners
let searchTimeout;
elements.gifSearch.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    if (query) {
        searchTimeout = setTimeout(async () => {
            const gifs = await searchGifs(query);
            displayGifResults(gifs);
        }, 300);
    } else {
        elements.gifResults.classList.add('hidden');
    }
});

elements.gifCaption.addEventListener('input', (e) => {
    const length = e.target.value.length;
    document.querySelector('.char-count').textContent = `${length}/100`;
});

elements.sendBtn.addEventListener('click', () => {
    if (state.selectedGif) {
        const messageData = {
            gifUrl: state.selectedGif,
            caption: elements.gifCaption.value.trim(),
            handle: elements.userHandle.value.trim() || '@user',
            replyTo: state.replyingTo
        };
        
        chat.send(messageData);
        
        // Reset UI
        state.selectedGif = null;
        elements.sendBtn.disabled = true;
        elements.gifResults.classList.add('hidden');
        elements.gifSearch.value = '';
        elements.gifCaption.value = '';
        document.querySelector('.char-count').textContent = '0/100';
        elements.previewArea.innerHTML = '';
        elements.previewArea.classList.add('hidden');
        elements.cameraModal.classList.add('hidden');
        elements.conversionStatus.textContent = '';
        cancelReply();
        
        Array.from(document.querySelectorAll('.gif-result')).forEach(el => {
            el.classList.remove('selected');
        });
    }
});

elements.cameraBtn.addEventListener('click', () => {
    elements.cameraModal.classList.remove('hidden');
    elements.previewArea.classList.add('hidden');
    initCamera();
});

elements.closeModalBtn.addEventListener('click', () => {
    elements.cameraModal.classList.add('hidden');
    if (state.mediaRecorder && elements.cameraPreview.srcObject) {
        elements.cameraPreview.srcObject.getTracks().forEach(track => track.stop());
    }
    elements.cameraPreview.srcObject = null;
    elements.previewArea.innerHTML = '';
    elements.previewArea.classList.add('hidden');
    elements.recordBtn.textContent = 'Start Recording';
    elements.recordBtn.disabled = true;
    elements.recordBtn.classList.remove('recording');
    clearInterval(state.recordingInterval);
    state.recordingTimeLeft = 3;
    elements.recordTimer.textContent = '3s';
    elements.conversionStatus.textContent = '';
    elements.recordingIndicator.classList.add('hidden');
    elements.cameraOverlay.classList.remove('recording');
});

elements.cancelReplyBtn.addEventListener('click', cancelReply);

elements.recordBtn.addEventListener('click', () => {
    if (!state.isRecording) {
        // Start recording
        state.isRecording = true;
        state.mediaRecorder.start();
        elements.recordBtn.textContent = 'Stop Recording';
        elements.recordBtn.classList.add('recording');
        elements.recordingIndicator.classList.remove('hidden');
        elements.cameraOverlay.classList.add('recording');
        
        state.recordingTimeLeft = 3;
        elements.recordTimer.textContent = '3s';
        
        state.recordingInterval = setInterval(() => {
            state.recordingTimeLeft--;
            elements.recordTimer.textContent = `${state.recordingTimeLeft}s`;
            
            if (state.recordingTimeLeft <= 0) {
                if (state.mediaRecorder.state === 'recording') {
                    state.mediaRecorder.stop();
                    clearInterval(state.recordingInterval);
                }
            }
        }, 1000);
        
        // Auto-stop after 3 seconds
        setTimeout(() => {
            if (state.mediaRecorder.state === 'recording') {
                state.mediaRecorder.stop();
            }
        }, 3000);
    } else {
        // Stop recording
        state.mediaRecorder.stop();
        clearInterval(state.recordingInterval);
    }
});

// Initialize with welcome message
chat.send({
    gifUrl: 'https://media.tenor.com/kbHfGxe-WR0AAAAC/hi-gif-minkun.gif',
    caption: 'Welcome to GIFChat! Start a conversation by sending a GIF.',
    handle: '@gifchat'
});
