// Configuration
const API_KEY = 'AIzaSyCkJ44bhL93TkK7MeyBUpfEo53FngnI1lU';
const TENOR_API_URL = 'https://tenor.googleapis.com/v2';

// State Management
const state = {
    selectedGif: null,
    mediaRecorder: null,
    recordedChunks: [],
    recordingInterval: null,
    recordingTimeLeft: 3,
    isRecording: false,
    isConverting: false,
    messageCount: 0
};

// DOM Elements
const elements = {
    username: document.getElementById('username'),
    chat: document.getElementById('chat'),
    search: document.getElementById('search'),
    results: document.getElementById('results'),
    caption: document.getElementById('caption'),
    send: document.getElementById('send'),
    create: document.getElementById('create'),
    camera: {
        modal: document.getElementById('camera-modal'),
        video: document.getElementById('video'),
        preview: document.getElementById('gif-preview'),
        record: document.getElementById('record'),
        close: document.querySelector('.close-btn'),
        timer: document.querySelector('.timer'),
        status: document.querySelector('.status')
    }
};

// Camera and GIF Recording
async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 480 },
                height: { ideal: 360 },
                frameRate: { ideal: 10 }
            }
        });
        
        elements.camera.video.srcObject = stream;
        await elements.camera.video.play();
        
        state.mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp8',
            videoBitsPerSecond: 1000000
        });
        
        state.mediaRecorder.ondataavailable = handleRecordedData;
        state.mediaRecorder.onstop = handleRecordingStopped;
        
        elements.camera.record.disabled = false;
        elements.camera.status.textContent = 'Ready to record';
    } catch (error) {
        console.error('Camera access error:', error);
        elements.camera.status.textContent = 'Camera access denied';
    }
}

async function handleRecordedData(event) {
    if (event.data && event.data.size > 0) {
        state.recordedChunks.push(event.data);
    }
}

async function handleRecordingStopped() {
    clearInterval(state.recordingInterval);
    elements.camera.record.textContent = 'Start Recording';
    state.isRecording = false;
    
    try {
        elements.camera.status.textContent = 'Processing video...';
        
        if (state.recordedChunks.length === 0) {
            throw new Error('No video data recorded');
        }
        
        const videoBlob = new Blob(state.recordedChunks, { type: 'video/webm' });
        state.recordedChunks = [];
        
        const video = document.createElement('video');
        video.src = URL.createObjectURL(videoBlob);
        video.muted = true;
        
        // Wait for video metadata
        await new Promise((resolve, reject) => {
            video.onloadedmetadata = resolve;
            video.onerror = reject;
            video.load();
        });
        
        await video.play();
        
        const canvas = document.createElement('canvas');
        canvas.width = 480;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');
        
        const gif = new GIF({
            workers: 2,
            quality: 10,
            width: 480,
            height: 360,
            workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js',
            background: '#ffffff'
        });
        
        // Capture frames with timeout protection
        const frameCount = Math.min(30, Math.floor(video.duration * 10));
        const frameInterval = video.duration / frameCount;
        
        for (let i = 0; i < frameCount; i++) {
            try {
                video.currentTime = i * frameInterval;
                await new Promise((resolve, reject) => {
                    const timeoutId = setTimeout(() => {
                        reject(new Error('Frame capture timeout'));
                    }, 1000);
                    
                    video.onseeked = () => {
                        try {
                            ctx.drawImage(video, 0, 0, 480, 360);
                            gif.addFrame(ctx, {
                                copy: true,
                                delay: Math.round(frameInterval * 1000),
                                dispose: 1
                            });
                            clearTimeout(timeoutId);
                            resolve();
                        } catch (err) {
                            clearTimeout(timeoutId);
                            reject(err);
                        }
                    };
                });
                
                elements.camera.status.textContent = 
                    `Creating GIF: ${Math.round((i / frameCount) * 100)}%`;
            } catch (frameError) {
                console.error('Frame capture error:', frameError);
                continue;
            }
        }
        
        // Add proper GIF rendering with progress
        gif.on('progress', progress => {
            elements.camera.status.textContent = 
                `Rendering GIF: ${Math.round(progress * 100)}%`;
        });
        
        await new Promise((resolve, reject) => {
            gif.on('finished', resolve);
            gif.on('error', reject);
            
            try {
                gif.render();
            } catch (renderError) {
                reject(renderError);
            }
        }).then(blob => {
            const gifUrl = URL.createObjectURL(blob);
            selectGif(gifUrl);
            
            const preview = document.createElement('img');
            preview.src = gifUrl;
            elements.camera.preview.innerHTML = '';
            elements.camera.preview.appendChild(preview);
            elements.camera.preview.classList.remove('hidden');
            
            elements.camera.status.textContent = 'GIF ready!';
        });
        
    } catch (error) {
        console.error('GIF creation error:', error);
        elements.camera.status.textContent = 'Failed to create GIF: ' + error.message;
        state.recordedChunks = [];
        elements.camera.preview.classList.add('hidden');
    }
}

// Event Listeners
elements.camera.record.addEventListener('click', () => {
    if (!state.isRecording) {
        state.recordedChunks = [];
        state.mediaRecorder.start();
        state.isRecording = true;
        elements.camera.record.textContent = 'Stop Recording';
        state.recordingTimeLeft = 3;
        elements.camera.timer.textContent = '3s';
        
        state.recordingInterval = setInterval(() => {
            state.recordingTimeLeft--;
            elements.camera.timer.textContent = `${state.recordingTimeLeft}s`;
            
            if (state.recordingTimeLeft <= 0) {
                state.mediaRecorder.stop();
                clearInterval(state.recordingInterval);
            }
        }, 1000);
    } else {
        state.mediaRecorder.stop();
        clearInterval(state.recordingInterval);
    }
});