const API_KEY = 'AIzaSyCkJ44bhL93TkK7MeyBUpfEo53FngnI1lU';
const TENOR_API_URL = 'https://tenor.googleapis.com/v2';

let selectedGif = null;
let mediaRecorder = null;
let recordedChunks = [];

const gifSearch = document.getElementById('gif-search');
const gifResults = document.getElementById('gif-results');
const sendBtn = document.getElementById('send-btn');
const messagesContainer = document.getElementById('messages');
const cameraBtn = document.getElementById('camera-btn');
const videoPreview = document.getElementById('video-preview');
const recordBtn = document.getElementById('record-btn');
const closeCamera = document.getElementById('close-camera');
const cameraContainer = document.getElementById('camera-container');

class MockWebSocket {
    constructor() {
        this.messages = [];
    }

    send(message) {
        setTimeout(() => {
            this.onmessage({ data: message });
        }, 100);
    }
}

const ws = new MockWebSocket();

ws.onmessage = (event) => {
    const message = document.createElement('div');
    message.className = 'message';
    const img = document.createElement('img');
    img.src = event.data;
    message.appendChild(img);
    messagesContainer.appendChild(message);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
};

async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoPreview.srcObject = stream;
        videoPreview.play();
        
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = handleDataAvailable;
        mediaRecorder.onstop = handleStop;
        
        recordBtn.disabled = false;
    } catch (error) {
        console.error('Error accessing camera:', error);
        alert('Unable to access camera. Please make sure you have granted camera permissions.');
    }
}

function handleDataAvailable(event) {
    if (event.data.size > 0) {
        recordedChunks.push(event.data);
    }
}

async function handleStop() {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    recordedChunks = [];
    
    const gif = new GIF({
        workers: 2,
        quality: 10,
        width: 320,
        height: 240
    });

    const video = document.createElement('video');
    video.src = URL.createObjectURL(blob);
    video.addEventListener('loadeddata', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        
        const addFrame = () => {
            if (video.currentTime < video.duration) {
                ctx.drawImage(video, 0, 0, 320, 240);
                gif.addFrame(ctx, { copy: true, delay: 100 });
                video.currentTime += 0.1;
            } else {
                gif.render();
            }
        };

        video.currentTime = 0;
        addFrame();
    });

    gif.on('finished', (blob) => {
        const gifUrl = URL.createObjectURL(blob);
        selectedGif = gifUrl;
        const preview = document.createElement('img');
        preview.src = gifUrl;
        document.getElementById('gif-preview').innerHTML = '';
        document.getElementById('gif-preview').appendChild(preview);
    });
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
        gifElement.appendChild(img);

        gifElement.addEventListener('click', () => {
            selectedGif = gif.media_formats.gif.url;
            Array.from(gifResults.children).forEach(el => {
                el.style.border = 'none';
            });
            gifElement.style.border = '2px solid #0084ff';
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
    recordBtn.textContent = 'Record';
    recordBtn.disabled = true;
    isRecording = false;
});

let isRecording = false;
recordBtn.addEventListener('click', () => {
    if (!isRecording) {
        mediaRecorder.start();
        recordBtn.textContent = 'Stop Recording';
        setTimeout(() => {
            if (mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                recordBtn.textContent = 'Record';
            }
        }, 3000); // Maximum 3 second recording
    } else {
        mediaRecorder.stop();
        recordBtn.textContent = 'Record';
    }
    isRecording = !isRecording;
});
