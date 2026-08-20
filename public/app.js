const socket = io();

// Cambio de Tema Dinámico
const colorPicker = document.getElementById('color-picker');
colorPicker.addEventListener('input', (e) => {
    document.documentElement.style.setProperty('--primary-color', e.target.value);
    localStorage.setItem('omni_theme', e.target.value);
});

window.onload = () => {
    const saved = localStorage.getItem('omni_theme');
    if (saved) {
        colorPicker.value = saved;
        document.documentElement.style.setProperty('--primary-color', saved);
    }
};

// --- WEBRTC Y CÁMARAS ---
const localVideo = document.getElementById('personal-cam');
const remoteVideo = document.getElementById('remote-cam');
const remotePlaceholder = document.getElementById('remote-placeholder');
let localStream = null;
let peerConnection = null;

const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

async function initCams() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
    } catch (err) {
        console.error("Error de cámara:", err);
    }
}

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(rtcConfig);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
        remotePlaceholder.style.display = 'none';
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) socket.emit('ice-candidate', event.candidate);
    };
}

socket.on('user-joined', async () => {
    createPeerConnection();
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', offer);
});

socket.on('offer', async (offer) => {
    if (!peerConnection) createPeerConnection();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', answer);
});

socket.on('answer', async (answer) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', async (candidate) => {
    if (peerConnection) await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});

initCams().then(() => {
    setTimeout(() => {
        if (localStream) {
            createPeerConnection();
            peerConnection.createOffer().then(offer => {
                peerConnection.setLocalDescription(offer);
                socket.emit('offer', offer);
            }).catch(() => {});
        }
    }, 1500);
});

// --- CHAT Y MENSAJES ---
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');

function appendMessage(sender, content, type = 'text') {
    const def = chatMessages.querySelector('.text-center');
    if (def) def.remove();

    const isMe = sender === 'Tú';
    const div = document.createElement('div');
    div.className = `flex flex-col max-w-[80%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`;
    
    let inner = '';
    if (type === 'text') inner = `<div class="${isMe ? 'bg-primary text-white' : 'bg-slate-800 text-slate-200'} px-3.5 py-2 rounded-2xl text-xs">${content}</div>`;
    else if (type === 'sticker') inner = `<div class="text-4xl">${content}</div>`;
    else if (type === 'audio') inner = `<div class="bg-slate-800 p-2 rounded-2xl"><audio controls src="${content}" class="h-8 w-40"></audio></div>`;
    else if (type === 'file') inner = `<div class="bg-slate-800 p-2.5 rounded-2xl"><a href="${content.url}" target="_blank" class="text-primary underline text-xs font-medium">📎 ${content.name}</a></div>`;

    div.innerHTML = `<span class="text-[9px] text-slate-500 mb-0.5 px-1">${sender}</span>${inner}`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

document.getElementById('btn-send-msg').onclick = () => {
    const txt = chatInput.value.trim();
    if (!txt) return;
    socket.emit('chat-message', { type: 'text', content: txt });
    appendMessage('Tú', txt, 'text');
    chatInput.value = '';
};

socket.on('chat-message', (data) => appendMessage(data.sender, data.content, data.type));

// Stickers
const stickerPicker = document.getElementById('sticker-picker');
document.getElementById('btn-toggle-stickers').onclick = () => stickerPicker.classList.toggle('hidden');

document.querySelectorAll('.sticker-btn').forEach(btn => {
    btn.onclick = () => {
        socket.emit('chat-message', { type: 'sticker', content: btn.textContent });
        appendMessage('Tú', btn.textContent, 'sticker');
        stickerPicker.classList.add('hidden');
    };
});

// Notas de Voz
let recorder, chunks = [];
const btnRec = document.getElementById('btn-record-audio');
btnRec.onmousedown = async () => {
    try {
        const str = await navigator.mediaDevices.getUserMedia({ audio: true });
        recorder = new MediaRecorder(str);
        chunks = [];
        recorder.ondataavailable = e => chunks.push(e.data);
        recorder.onstop = () => {
            const reader = new FileReader();
            reader.readAsDataURL(new Blob(chunks, { type: 'audio/webm' }));
            reader.onloadend = () => {
                socket.emit('chat-message', { type: 'audio', content: reader.result });
                appendMessage('Tú', reader.result, 'audio');
            };
        };
        recorder.start();
        btnRec.classList.add('text-rose-500', 'animate-pulse');
    } catch(e) {}
};
btnRec.onmouseup = () => { if (recorder) recorder.stop(); btnRec.classList.remove('text-rose-500', 'animate-pulse'); };

// Archivos
document.getElementById('file-input').onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
        const fd = { name: f.name, url: r.result };
        socket.emit('chat-message', { type: 'file', content: fd });
        appendMessage('Tú', fd, 'file');
    };
    r.readAsDataURL(f);
};