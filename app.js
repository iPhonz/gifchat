const API_KEY = 'AIzaSyCkJ44bhL93TkK7MeyBUpfEo53FngnI1lU';
const TENOR_API_URL = 'https://tenor.googleapis.com/v2';

// App State
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
const cameraModal = document.getElementById('camera-modal');
const closeModal = document.querySelector('.close-modal');
const recordTimer = document.querySelector('.record-timer');
const userHandle = document.getElementById('user-handle');
const recordingStatus = document.querySelector('.recording-status');
const replyIndicator = document.querySelector('.reply-indicator');
const cancelReplyBtn = document.querySelector('.cancel-reply');

// Message Template
const messageTemplate = document.getElementById('message-template');

class ChatConnection {
    constructor() {
        this.messages = [];
        this.messageId = 1;
    }

    send(messageData) {
        const fullMessage = {
            id: this.messageId++,
            ...messageData,
            sent: true,
            timestamp: new Date().toISOString()
        };
        
        setTimeout(() => {
            this.onmessage({ data: JSON.stringify(fullMessage) });
        }, 100);
    }
}

const chat = new ChatConnection();

chat.onmessage = (event) => {
    const messageData = JSON.parse(event.data);
    displayMessage(messageData);
};

function displayMessage(messageData) {
    const messageEl = createMessageElement(messageData);
    
    if (messageData.replyTo) {
        const parentMessage = document.querySelector(`[data-message-id="${messageData.replyTo}"]`);
        if (parentMessage) {
            const repliesContainer = parentMessage.querySelector('.replies');
            repliesContainer.appendChild(messageEl);
        }
    } else {
        messagesContainer.appendChild(messageEl);
    }
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function createMessageElement(messageData) {
    const messageEl = messageTemplate.content.cloneNode(true).children[0];
    messageEl.dataset.messageId = messageData.id;
    
    if (messageData.sent) {
        messageEl.classList.add('sent');
    }
    
    const gifImg = messageEl.querySelector('.message-gif');
    gifImg.src = messageData.gifUrl;
    
    const caption = messageEl.querySelector('.message-caption');
    if (messageData.caption) {
        caption.textContent = messageData.caption;
    } else {
        caption.remove();
    }
    
    const handle = messageEl.querySelector('.message-handle');
    handle.textContent = messageData.handle;
    
    const time = messageEl.querySelector('.message-time');
    time.textContent = new Date(messageData.timestamp).toLocaleTimeString();
    
    const replyBtn = messageEl.querySelector('.reply-btn');
    replyBtn.onclick = () => startReply(messageData.id);
    
    return messageEl;
}

function startReply(messageId) {
    replyingTo = messageId;
    replyIndicator.style.display = 'flex';
    const parentMessage = document.querySelector(`[data-message-id="${messageId}"]`);
    const parentGif = parentMessage.querySelector('.message-gif').src;
    replyIndicator.querySelector('.reply-to').textContent = 
        parentMessage.querySelector('.message-handle').textContent;
    gifSearch.focus();
}

function cancelReply() {
    replyingTo = null;
    replyIndicator.style.display = 'none';
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
            mimeType: 'video/webm;codecs=vp8',
            videoBitsPerSecond: 2500000 // 2.5 Mbps
        });
        
        mediaRecorder.ondataavailable = handleDataAvailable;
        mediaRecorder.onstop = handleStop;
        
        recordBtn.disabled = false;
        recordingStatus.textContent = 'Ready to record';
    } catch (error) {
        console.error('Error accessing camera:', error);
        recordingStatus.textContent = 'Error accessing camera. Please check permissions.';
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
    recordBtn.classList.remove('recording');
    recordingTimeLeft = 3;
    recordTimer.textContent = `${recordingTimeLeft}s`;
    
    try {
        recordingStatus.textContent = 'Processing video...';
        const videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
        recordedChunks = [];
        
        const video = document.createElement('video');
        video.src = URL.createObjectURL(videoBlob);
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
        const frameCount = 30; // Capture 30 frames
        const frameInterval = video.duration / frameCount;
        
        recordingStatus.textContent = 'Converting to GIF...';
        
        for (let i = 0; i < frameCount; i++) {
            video.currentTime = i * frameInterval;
            await new Promise(resolve => {
                video.onseeked = () => {
                    ctx.drawImage(video, 0, 0, 320, 240);
                    gif.addFrame(ctx, { 
                        copy: true,
                        delay: frameInterval * 1000
                    });
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
            sendBtn.disabled = false;
            
            const preview = document.createElement('img');
            preview.src = gifUrl;
            const previewContainer = document.getElementById('gif-preview');
            previewContainer.innerHTML = '';
            previewContainer.appendChild(preview);
            
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
            sendBtn.disabled = false;
            
            Array.from(gifResults.children).forEach(el => {
                el.classList.remove('selected');
            });
            gifElement.classList.add('selected');
        });

        gifResults.appendChild(gifElement);
    });
}

// Event Listeners
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

gifCaption.addEventListener('input', (e) => {
    const length = e.target.value.length;
    document.querySelector('.caption-counter').textContent = `${length}/100`;
});

sendBtn.addEventListener('click', () => {
    if (selectedGif) {
        const messageData = {
            gifUrl: selectedGif,
            caption: gifCaption.value.trim(),
            handle: userHandle.value.trim() || '@user',
            replyTo: replyingTo
        };
        
        chat.send(messageData);
        
        // Reset UI
        selectedGif = null;
        sendBtn.disabled = true;
        gifResults.innerHTML = '';
        gifSearch.value = '';
        gifCaption.value = '';
        document.querySelector('.caption-counter').textContent = '0/100';
        document.getElementById('gif-preview').innerHTML = '';
        cameraModal.style.display = 'none';
        recordingStatus.textContent = '';
        cancelReply();
        
        Array.from(document.querySelectorAll('.gif-result')).forEach(el => {
            el.classList.remove('selected');
        });
    }
});

cameraBtn.addEventListener('click', () => {
    cameraModal.style.display = 'flex';
    initCamera();
});

closeModal.addEventListener('click', () => {
    cameraModal.style.display = 'none';
    if (mediaRecorder && videoPreview.srcObject) {
        videoPreview.srcObject.getTracks().forEach(track => track.stop());
    }
    videoPreview.srcObject = null;
    document.getElementById('gif-preview').innerHTML = '';
    recordBtn.textContent = 'Start Recording';
    recordBtn.disabled = true;
    recordBtn.classList.remove('recording');
    clearInterval(recordingInterval);
    recordingTimeLeft = 3;
    recordTimer.textContent = `${recordingTimeLeft}s`;
    recordingStatus.textContent = '';
});

cancelReplyBtn.addEventListener('click', cancelReply);

let isRecording = false;
recordBtn.addEventListener('click', () => {
    if (!isRecording) {
        mediaRecorder.start();
        recordBtn.textContent = 'Stop Recording';
        recordBtn.classList.add('recording');
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
    }
});

// Initialize with welcome message
chat.send({
    gifUrl: 'https://media.tenor.com/kbHfGxe-WR0AAAAC/hi-gif-minkun.gif',
    caption: 'Welcome to GIFChat! Start a conversation by sending a GIF.',
    handle: '@gifchat'
});