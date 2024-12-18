const API_KEY = 'AIzaSyCkJ44bhL93TkK7MeyBUpfEo53FngnI1lU';
const TENOR_API_URL = 'https://tenor.googleapis.com/v2';

let selectedGif = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordingInterval = null;
let recordingTimeLeft = 3;
let replyingTo = null;

// DOM Elements
const gifSearch = document.getElementById('gif-search');
const gifResults = document.getElementById('gif-results');
const gifCaption = document.getElementById('gif-caption');
const sendBtn = document.getElementById('send-btn');
const messagesContainer = document.getElementById('messages');
const cameraBtn = document.getElementById('camera-btn');
const videoPreview = document.getElementById('video-preview');
const recordBtn = document.getElementById('record-btn');
const closeCamera = document.getElementById('close-camera');
const cameraContainer = document.getElementById('camera-container');
const recordTimer = document.getElementById('record-timer');
const userHandle = document.getElementById('user-handle');
const recordingStatus = document.querySelector('.recording-status');

class MockWebSocket {
    constructor() {
        this.messages = [];
    }

    send(messageData) {
        setTimeout(() => {
            this.onmessage({ 
                data: JSON.stringify({
                    ...JSON.parse(messageData),
                    sent: true,
                    timestamp: new Date().toISOString()
                })
            });
        }, 100);
    }
}

const ws = new MockWebSocket();

ws.onmessage = (event) => {
    const messageData = JSON.parse(event.data);
    const message = createMessageElement(messageData);
    
    if (messageData.replyTo) {
        const parentMessage = document.querySelector(`[data-message-id="${messageData.replyTo}"]`);
        if (parentMessage) {
            const replyContainer = parentMessage.querySelector('.reply-container') || 
                createReplyContainer(parentMessage);
            replyContainer.appendChild(message);
        }
    } else {
        messagesContainer.appendChild(message);
    }
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
};

function createMessageElement(messageData) {
    const message = document.createElement('div');
    message.className = `message ${messageData.sent ? 'sent' : ''}`;
    message.dataset.messageId = Date.now().toString();
    
    const img = document.createElement('img');
    img.src = messageData.gifUrl;
    message.appendChild(img);
    
    if (messageData.caption) {
        const caption = document.createElement('div');
        caption.className = 'message-caption';
        caption.textContent = messageData.caption;
        message.appendChild(caption);
    }
    
    const messageInfo = document.createElement('div');
    messageInfo.className = 'message-info';
    
    const handle = document.createElement('span');
    handle.className = 'message-handle';
    handle.textContent = messageData.handle;
    messageInfo.appendChild(handle);
    
    const timestamp = document.createElement('span');
    timestamp.className = 'message-timestamp';
    timestamp.textContent = new Date(messageData.timestamp).toLocaleTimeString();
    messageInfo.appendChild(timestamp);
    
    const replyBtn = document.createElement('button');
    replyBtn.className = 'reply-button';
    replyBtn.textContent = 'Reply';
    replyBtn.onclick = () => startReply(message.dataset.messageId);
    messageInfo.appendChild(replyBtn);
    
    message.appendChild(messageInfo);
    return message;
}

function createReplyContainer(parentMessage) {
    const container = document.createElement('div');
    container.className = 'reply-container';
    parentMessage.appendChild(container);
    return container;
}

function startReply(messageId) {
    replyingTo = messageId;
    gifSearch.placeholder = 'Search for a GIF to reply...';
    gifSearch.focus();
}

function cancelReply() {
    replyingTo = null;
    gifSearch.placeholder = 'Search for GIFs...';
}

async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 15 }
            } 
        });
        videoPreview.srcObject = stream;
        await videoPreview.play();
        
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp8'
        });
        mediaRecorder.ondataavailable = handleDataAvailable;
        mediaRecorder.onstop = handleStop;
        
        recordBtn.disabled = false;
        recordBtn.textContent = 'Start Recording';
        recordingTimeLeft = 3;
        recordTimer.textContent = `${recordingTimeLeft}s`;
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
    clearInterval(recordingInterval);
    recordBtn.textContent = 'Start Recording';
    recordingTimeLeft = 3;
    recordTimer.textContent = `${recordingTimeLeft}s`;
    recordingStatus.textContent = 'Converting to GIF...';
    
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    recordedChunks = [];
    
    try {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(blob);
        video.muted = true;
        
        await new Promise((resolve) => {
            video.onloadedmetadata = resolve;
        });
        
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        
        const gif = new GIF({
            workers: 2,
            quality: 10,
            width: 320,
            height: 240,
            workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js'
        });
        
        video.currentTime = 0;
        const frameCount = Math.min(30, video.duration * 10); // Cap at 30 frames
        const frameDelay = (video.duration * 1000) / frameCount;
        
        for (let i = 0; i < frameCount; i++) {
            const currentTime = (i / frameCount) * video.duration;
            video.currentTime = currentTime;
            
            await new Promise(resolve => {
                video.onseeked = () => {
                    ctx.drawImage(video, 0, 0, 320, 240);
                    gif.addFrame(ctx, { delay: frameDelay, copy: true });
                    resolve();
                };
            });
        }
        
        gif.on('progress', (p) => {
            recordingStatus.textContent = `Converting: ${Math.round(p * 100)}%`;
        });
        
        gif.on('finished', (blob) => {
            const gifUrl = URL.createObjectURL(blob);
            selectedGif = gifUrl;
            const preview = document.createElement('img');
            preview.src = gifUrl;
            document.getElementById('gif-preview').innerHTML = '';
            document.getElementById('gif-preview').appendChild(preview);
            recordingStatus.textContent = 'GIF ready! Click Send to share.';
        });
        
        gif.render();
    } catch (error) {
        console.error('Error creating GIF:', error);
        recordingStatus.textContent = 'Error creating GIF. Please try again.';
    }
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
        const messageData = {
            gifUrl: selectedGif,
            caption: gifCaption.value.trim(),
            handle: userHandle.value.trim() || '@user',
            replyTo: replyingTo
        };
        
        ws.send(JSON.stringify(messageData));
        
        selectedGif = null;
        gifResults.innerHTML = '';
        gifSearch.value = '';
        gifCaption.value = '';
        document.getElementById('gif-preview').innerHTML = '';
        cameraContainer.style.display = 'none';
        recordingStatus.textContent = '';
        cancelReply();
        
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
    recordingStatus.textContent = '';
});

let isRecording = false;
recordBtn.addEventListener('click', () => {
    if (!isRecording) {
        mediaRecorder.start();
        recordBtn.textContent = 'Stop Recording';
        isRecording = true;
        recordingStatus.textContent = 'Recording...';
        
        recordingInterval = setInterval(() => {
            recordingTimeLeft--;
            recordTimer.textContent = `${recordingTimeLeft}s`;
            
            if (recordingTimeLeft <= 0) {
                if (mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                    isRecording = false;
                    clearInterval(recordingInterval);
                }
            }
        }, 1000);
        
        setTimeout(() => {
            if (mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                isRecording = false;
            }
        }, 3000);
    } else {
        mediaRecorder.stop();
        isRecording = false;
        clearInterval(recordingInterval);
        recordingStatus.textContent = 'Processing...';
    }
});

// Initialize with welcome message
const welcomeMessage = createMessageElement({
    gifUrl: 'https://media.tenor.com/kbHfGxe-WR0AAAAC/hi-gif-minkun.gif',
    caption: 'Welcome to GIFChat! Start a conversation by sending a GIF.',
    handle: '@gifchat',
    timestamp: new Date().toISOString()
});
messagesContainer.appendChild(welcomeMessage);
