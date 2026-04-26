// Babyfon WebApp - P2P Modus ohne Signaling Server
// Lokale Audio/Video Überwachung im WLAN mit automatischer Discovery

// ===== STATE MANAGEMENT =====
const state = {
    role: null, // 'baby' oder 'parent'
    isStreaming: false,
    isConnected: false,
    localStream: null,
    remoteStream: null,
    peerConnection: null,
    peerId: null,
    discoveredBabies: new Map(),
    statsInterval: null,
};

// ===== HELPER FUNCTIONS =====
function generatePeerId() {
    return 'babyfon-' + Math.random().toString(36).substr(2, 9);
}

function generateDeviceName() {
    const names = ['Babys Zimmer', 'Schlafsaal', 'Kinderzimmer', 'Spielzimmer', 'Wickelzimmer'];
    const name = names[Math.floor(Math.random() * names.length)];
    return name;
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showError(message) {
    const modal = document.getElementById('errorModal');
    document.getElementById('errorMessage').textContent = message;
    modal.style.display = 'flex';
}

function updateStatusBadge(element, isOnline, text) {
    element.classList.toggle('online', isOnline);
    element.classList.toggle('offline', !isOnline);
    if (text) {
        const statusText = element.querySelector('[id$="StatusText"]') || element.parentElement?.querySelector('[id$="StatusText"]');
        if (statusText) {
            statusText.textContent = text;
        }
    }
    const dot = element.querySelector('.status-dot');
    if (dot) {
        dot.style.animation = isOnline ? 'pulse-green 2s infinite' : 'pulse-red 2s infinite';
    }
}

// ===== UI TRANSITIONS =====
function switchToMode(mode) {
    document.querySelectorAll('.container').forEach(el => {
        el.classList.remove('active');
    });
    
    switch(mode) {
        case 'baby':
            document.getElementById('babyMode').classList.add('active');
            state.role = 'baby';
            initBabyMode();
            break;
        case 'parent':
            document.getElementById('parentMode').classList.add('active');
            state.role = 'parent';
            initParentMode();
            break;
        default:
            document.getElementById('roleSelector').classList.add('active');
            state.role = null;
    }
}

function switchRole() {
    if (state.isStreaming) stopStream();
    if (state.isConnected) disconnectFromParent();
    switchToMode(null);
}

// ===== BABY MODE: STREAM SENDER =====
async function initBabyMode() {
    state.peerId = generatePeerId();
    
    // Registriere Device für lokale Discovery
    registerBabyDevice();
    
    // Höre auf Parent-Verbindungen
    setupBabyP2P();
    
    showToast('Baby-Modus aktiv - Im WLAN sichtbar', 'success');
}

function registerBabyDevice() {
    // Speichere Baby-Info im lokalen Storage für Parent-Discovery
    const babyInfo = {
        peerId: state.peerId,
        name: generateDeviceName(),
        timestamp: Date.now(),
        streaming: state.isStreaming
    };
    
    // Storage mit regelmäßiger Aktualisierung
    localStorage.setItem(`babyfon-baby-${state.peerId}`, JSON.stringify(babyInfo));
    
    // Refresh alle 5 Sekunden
    setInterval(() => {
        babyInfo.timestamp = Date.now();
        babyInfo.streaming = state.isStreaming;
        localStorage.setItem(`babyfon-baby-${state.peerId}`, JSON.stringify(babyInfo));
    }, 5000);
}

function setupBabyP2P() {
    // Höre auf Parent-Verbindungen via LocalStorage-Events
    window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith('babyfon-offer-')) {
            const peerId = e.key.replace('babyfon-offer-', '');
            try {
                const offer = JSON.parse(e.newValue);
                
                if (offer.from !== state.peerId) {
                    handleParentOffer(peerId, offer);
                }
            } catch (err) {
                console.error('Offer Parse Error:', err);
            }
        }
    });
}

async function handleParentOffer(parentId, offer) {
    try {
        // Erstelle RTCPeerConnection
        if (!state.peerConnection) {
            state.peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: ['stun:stun.l.google.com:19302'] }
                ]
            });
            
            // Füge lokalen Stream hinzu
            if (state.localStream) {
                state.localStream.getTracks().forEach(track => {
                    state.peerConnection.addTrack(track, state.localStream);
                });
            }
            
            // ICE Candidate Handling
            state.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    const answer = {
                        type: 'answer',
                        from: state.peerId,
                        to: parentId,
                        sdp: state.peerConnection.localDescription.sdp,
                        candidates: [event.candidate]
                    };
                    localStorage.setItem(`babyfon-answer-${parentId}`, JSON.stringify(answer));
                }
            };
            
            // Connection State
            state.peerConnection.onconnectionstatechange = () => {
                console.log('Baby Connection State:', state.peerConnection.connectionState);
                if (state.peerConnection.connectionState === 'failed') {
                    resetP2PConnection();
                }
            };
        }
        
        // Set Remote Description (Offer vom Parent)
        await state.peerConnection.setRemoteDescription(
            new RTCSessionDescription(offer)
        );
        
        // Erstelle Answer
        const answer = await state.peerConnection.createAnswer();
        await state.peerConnection.setLocalDescription(answer);
        
        // Sende Answer via LocalStorage
        localStorage.setItem(`babyfon-answer-${parentId}`, JSON.stringify({
            type: 'answer',
            from: state.peerId,
            to: parentId,
            sdp: state.peerConnection.localDescription.sdp
        }));
        
        updateBabyStatus(true);
        showToast('Parent verbunden! 🎉', 'success');
        
    } catch (error) {
        console.error('Fehler beim Parent-Angebot:', error);
        showError('Verbindungsfehler mit Parent');
    }
}

async function startStream() {
    try {
        const audioEnabled = document.getElementById('audioEnabled').checked;
        const videoEnabled = document.getElementById('videoEnabled').checked;

        if (!audioEnabled && !videoEnabled) {
            showError('Mindestens Audio oder Video muss aktiviert sein');
            return;
        }

        const constraints = {
            audio: audioEnabled,
            video: videoEnabled ? {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            } : false
        };

        // Hole Mediastream
        state.localStream = await navigator.mediaDevices.getUserMedia(constraints);

        // Zeige Video wenn aktiviert
        if (videoEnabled) {
            const video = document.getElementById('localVideo');
            video.srcObject = state.localStream;
            document.getElementById('videoContainer').style.display = 'block';
        }

        // Sende Stream an alle verbundenen Parents
        if (state.connection) {
            state.localStream.getTracks().forEach(track => {
                state.connection.addTrack(track, state.localStream);
            });
        }

        state.isStreaming = true;
        updateBabyUI();
        showToast('Stream gestartet ✅', 'success');
        
        // Starte Stats-Monitoring
        startStatsMonitoring();

    } catch (error) {
        console.error('Fehler beim Zugriff auf Mediengeräte:', error);
        
        let errorMsg = 'Fehler beim Zugriff auf Mediengeräte';
        if (error.name === 'NotAllowedError') {
            errorMsg = 'Zugriff auf Kamera/Mikrofon wurde verweigert. Bitte überprüfen Sie die Berechtigungen.';
        } else if (error.name === 'NotFoundError') {
            errorMsg = 'Keine Kamera/Mikrofon vorhanden';
        }
        
        showError(errorMsg);
    }
}

function stopStream() {
    if (state.localStream) {
        state.localStream.getTracks().forEach(track => track.stop());
        state.localStream = null;
    }

    document.getElementById('videoContainer').style.display = 'none';
    document.getElementById('localVideo').srcObject = null;
    state.isStreaming = false;
    updateBabyUI();
    
    if (state.peerConnection) {
        state.peerConnection.close();
        state.peerConnection = null;
    }

    showToast('Stream gestoppt', 'info');
}

function updateBabyUI() {
    const startBtn = document.getElementById('startStreamBtn');
    const stopBtn = document.getElementById('stopStreamBtn');
    const statsContainer = document.getElementById('statsContainer');

    startBtn.disabled = state.isStreaming;
    stopBtn.disabled = !state.isStreaming;

    if (state.isStreaming) {
        statsContainer.style.display = 'block';
    } else {
        statsContainer.style.display = 'none';
    }
}

function updateBabyStatus(isConnected) {
    const status = document.getElementById('babyStatus');
    const text = isConnected ? 'Parent verbunden' : 'Warte auf Parent...';
    updateStatusBadge(status, isConnected, text);
    document.getElementById('connectionCount').textContent = isConnected ? '1' : '0';
}

// ===== PARENT MODE: STREAM RECEIVER =====
async function initParentMode() {
    state.peerId = generatePeerId();
    setupParent();
    document.getElementById('discoverBtn').addEventListener('click', discoverBabies);
    document.getElementById('disconnectBtn').addEventListener('click', disconnectFromParent);
}

function setupParent() {
    // Setup bereits gemacht :)
}

async function discoverBabies() {
    state.discoveredBabies.clear();
    
    try {
        // Suche nach registrierten Baby-Devices in LocalStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            
            if (key && key.startsWith('babyfon-baby-')) {
                try {
                    const babyInfo = JSON.parse(localStorage.getItem(key));
                    const age = Date.now() - babyInfo.timestamp;
                    
                    // Nur aktuelle Geräte (weniger als 15 Sekunden alt)
                    if (age < 15000 && babyInfo.peerId !== state.peerId) {
                        state.discoveredBabies.set(babyInfo.peerId, babyInfo);
                    }
                } catch (e) {
                    // Ignore
                }
            }
        }
        
        displayBabiesList();
        
        if (state.discoveredBabies.size === 0) {
            showToast('Keine Babys gefunden', 'info');
        } else {
            showToast(`${state.discoveredBabies.size} Baby(s) gefunden! 🍼`, 'success');
        }
        
    } catch (error) {
        console.error('Discovery Error:', error);
        showError('Fehler beim Suchen nach Babys');
    }
    
    // Wiederhole Discovery alle 5 Sekunden
    clearInterval(state.discoveryInterval);
    state.discoveryInterval = setInterval(discoverBabies, 5000);
}

function displayBabiesList() {
    const listContainer = document.getElementById('babyList');
    const noBabiesMsg = document.getElementById('noBabiesMsg');
    
    if (state.discoveredBabies.size === 0) {
        listContainer.style.display = 'none';
        noBabiesMsg.style.display = 'block';
        return;
    }
    
    noBabiesMsg.style.display = 'none';
    listContainer.style.display = 'grid';
    listContainer.innerHTML = '';
    
    state.discoveredBabies.forEach((babyInfo, peerId) => {
        const item = document.createElement('div');
        item.className = 'baby-item';
        item.innerHTML = `
            <div class="baby-item-name">${babyInfo.name}</div>
            <div class="baby-item-ip">ID: ${peerId.substr(0, 12)}...</div>
            <div class="baby-item-status">${babyInfo.streaming ? '🟢 Stream aktiv' : '🔴 Standby'}</div>
        `;
        
        item.addEventListener('click', () => connectToBaby(peerId, babyInfo));
        listContainer.appendChild(item);
    });
}

async function connectToBaby(peerId, babyInfo) {
    try {
        const button = event.target.closest('.baby-item');
        button.classList.add('connecting');
        button.style.pointerEvents = 'none';
        
        // Erstelle RTCPeerConnection
        state.peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: ['stun:stun.l.google.com:19302'] }
            ]
        });
        
        // Handle Remote Stream
        state.peerConnection.ontrack = (event) => {
            console.log('Remote Track empfangen:', event.track.kind);
            state.remoteStream = event.streams[0];
            
            const video = document.getElementById('remoteVideo');
            video.srcObject = state.remoteStream;
            document.getElementById('remoteVideoContainer').style.display = 'block';
            
            state.isConnected = true;
            updateParentStatus(true);
            startParentStatsMonitoring();
            showToast('Video erfolgreich verbunden! 🎥', 'success');
        };
        
        // Handle ICE Candidates
        state.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                const offer = {
                    type: 'offer',
                    from: state.peerId,
                    to: peerId,
                    sdp: state.peerConnection.localDescription.sdp,
                    candidates: [event.candidate]
                };
                localStorage.setItem(`babyfon-offer-${peerId}`, JSON.stringify(offer));
            }
        };
        
        // Connection State
        state.peerConnection.onconnectionstatechange = () => {
            console.log('Parent Connection State:', state.peerConnection.connectionState);
            if (state.peerConnection.connectionState === 'failed') {
                showError('Verbindung zum Baby fehlgeschlagen');
                disconnectFromParent();
            }
        };
        
        // Erstelle Offer
        const offer = await state.peerConnection.createOffer();
        await state.peerConnection.setLocalDescription(offer);
        
        // Sende Offer via LocalStorage
        localStorage.setItem(`babyfon-offer-${peerId}`, JSON.stringify({
            type: 'offer',
            from: state.peerId,
            to: peerId,
            sdp: state.peerConnection.localDescription.sdp
        }));
        
        // Warte auf Answer vom Baby
        setupAnswerListener(peerId);
        
        showToast('Verbinde zu ' + babyInfo.name + '...', 'info');
        
    } catch (error) {
        console.error('Verbindungsfehler:', error);
        showError('Verbindung zu Baby fehlgeschlagen: ' + error.message);
        event.target.closest('.baby-item').classList.remove('connecting');
        event.target.closest('.baby-item').style.pointerEvents = 'auto';
    }
}

function setupAnswerListener(peerId) {
    const timeout = setTimeout(() => {
        console.warn('Keine Answer vom Baby erhalten');
        showError('Baby antwortet nicht - Verbindung abgebrochen');
        disconnectFromParent();
    }, 10000);
    
    const checkAnswer = () => {
        const answerKey = `babyfon-answer-${state.peerId}`;
        const answerData = localStorage.getItem(answerKey);
        
        if (answerData) {
            try {
                const answer = JSON.parse(answerData);
                
                if (answer.from === peerId) {
                    clearTimeout(timeout);
                    state.peerConnection.setRemoteDescription(
                        new RTCSessionDescription(answer)
                    );
                    localStorage.removeItem(answerKey);
                }
            } catch (e) {
                console.error('Answer Parse Error:', e);
            }
        } else {
            setTimeout(checkAnswer, 500);
        }
    };
    
    checkAnswer();
}

function updateParentStatus(isConnected) {
    state.isConnected = isConnected;
    
    const status = document.getElementById('parentStatus');
    const text = isConnected ? 'Verbunden' : 'Nicht verbunden';
    updateStatusBadge(status, isConnected, text);
    
    document.getElementById('discoverBtn').disabled = isConnected;
    document.getElementById('disconnectBtn').style.display = isConnected ? 'block' : 'none';
    
    if (isConnected) {
        document.getElementById('parentStatsContainer').style.display = 'block';
        document.getElementById('remoteStatus').textContent = 'Aktiv';
    }
}

function disconnectFromParent() {
    if (state.peerConnection) {
        state.peerConnection.close();
        state.peerConnection = null;
    }

    if (state.remoteStream) {
        state.remoteStream.getTracks().forEach(track => track.stop());
        state.remoteStream = null;
    }

    document.getElementById('remoteVideo').srcObject = null;
    document.getElementById('remoteVideoContainer').style.display = 'none';
    document.getElementById('babyList').style.display = 'none';
    
    state.isConnected = false;
    updateParentStatus(false);
    showToast('Verbindung getrennt', 'info');
}

function toggleRemoteAudio() {
    if (!state.remoteStream) return;

    const audioTracks = state.remoteStream.getAudioTracks();
    const isEnabled = audioTracks[0]?.enabled ?? true;

    audioTracks.forEach(track => track.enabled = !isEnabled);

    const btn = document.getElementById('toggleAudio');
    btn.textContent = isEnabled ? '🔇' : '🔊';
    showToast(isEnabled ? 'Ton aus' : 'Ton an', 'info');
}

function toggleFullscreen() {
    const video = document.getElementById('remoteVideo');
    
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        video.requestFullscreen().catch(err => {
            console.error('Vollbild nicht verfügbar:', err);
        });
    }
}

function startParentStatsMonitoring() {
    if (state.statsInterval) clearInterval(state.statsInterval);

    state.statsInterval = setInterval(async () => {
        if (!state.peerConnection) return;

        try {
            const stats = await state.peerConnection.getStats();
            
            stats.forEach(report => {
                if (report.type === 'inbound-rtp') {
                    if (report.mediaType === 'video') {
                        const bitrate = (report.bytesReceived * 8) / 1000;
                        document.getElementById('remoteBitrate').textContent = Math.round(bitrate) + ' kbps';
                    }
                }
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                    document.getElementById('remoteLatency').textContent = Math.round(report.currentRoundTripTime * 1000) + ' ms';
                }
            });
        } catch (error) {
            console.log('Parent Stats Error:', error);
        }
    }, 1000);
}

function startStatsMonitoring() {
    if (state.statsInterval) clearInterval(state.statsInterval);

    state.statsInterval = setInterval(async () => {
        if (!state.localStream || !state.peerConnection) return;

        try {
            const stats = await state.peerConnection.getStats();
            
            stats.forEach(report => {
                if (report.type === 'outbound-rtp') {
                    if (report.mediaType === 'video') {
                        const bitrate = (report.bytesSent * 8) / 1000;
                        document.getElementById('videoBitrate').textContent = Math.round(bitrate) + ' kbps';
                    } else if (report.mediaType === 'audio') {
                        const bitrate = (report.bytesSent * 8) / 1000;
                        document.getElementById('audioBitrate').textContent = Math.round(bitrate) + ' kbps';
                    }
                }
            });
        } catch (error) {
            console.log('Stats-Fehler:', error);
        }
    }, 1000);
}

function resetP2PConnection() {
    state.isConnected = false;
    state.peerConnection = null;
    updateParentStatus(false);
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', () => {
    state.peerId = generatePeerId();
    
    // Role Selection
    document.getElementById('babyBtn').addEventListener('click', () => switchToMode('baby'));
    document.getElementById('parentBtn').addEventListener('click', () => switchToMode('parent'));

    // Role Switch
    document.querySelectorAll('#switchRole').forEach(btn => {
        btn.addEventListener('click', switchRole);
    });

    // Baby Mode Events
    document.getElementById('startStreamBtn').addEventListener('click', startStream);
    document.getElementById('stopStreamBtn').addEventListener('click', stopStream);

    // Parent Mode Events
    document.getElementById('toggleAudio').addEventListener('click', toggleRemoteAudio);
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);

    // Modal Close
    document.querySelector('.modal-close').addEventListener('click', () => {
        document.getElementById('errorModal').style.display = 'none';
    });

    document.getElementById('errorModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('errorModal')) {
            document.getElementById('errorModal').style.display = 'none';
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.getElementById('errorModal').style.display = 'none';
        }
    });

    // Cleanup
    window.addEventListener('beforeunload', () => {
        if (state.localStream) {
            state.localStream.getTracks().forEach(track => track.stop());
        }
        if (state.remoteStream) {
            state.remoteStream.getTracks().forEach(track => track.stop());
        }
        if (state.peerConnection) {
            state.peerConnection.close();
        }
        if (state.statsInterval) {
            clearInterval(state.statsInterval);
        }
        if (state.discoveryInterval) {
            clearInterval(state.discoveryInterval);
        }
        // Cleanup Storage
        if (state.peerId) {
            localStorage.removeItem(`babyfon-baby-${state.peerId}`);
        }
    });
});

console.log('%c🍼 Babyfon P2P WebApp gestartet', 'font-size: 16px; color: #FF6B9D; font-weight: bold;');
console.log('Modus: Wähle Baby oder Parent');
console.log('Transport: P2P über WebRTC + LocalStorage');
