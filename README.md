# 🍼 Babyfon - Lokale Audio/Video Überwachung

Eine moderne, sichere Babyfon-Webapp für die Audio- und Videoüberwachung im lokalen WLAN. Basiert auf [webconnect.js](https://webconnect.js.org) für dezentralisierte Peer-to-Peer-Verbindungen.

## Features

- 🎥 **Video-Überwachung** - Optionales Live-Video vom Baby zum Parent
- 🔊 **Audio-Streaming** - Kristallklares Audio mit niedriger Latenz
- 🔐 **Lokale Kommunikation** - Alle Daten bleiben im privaten WLAN
- 📱 **Responsive Design** - Funktioniert auf Desktop, Tablet und Smartphone
- ⚡ **Echtzeit-Statistiken** - Monitore Bitrate, Verzögerung und Verbindungsstatus
- 🔄 **Einfache Verbindung** - 8-stelliger alphanumerischer Code statt komplexer Setup

## Installation

### Voraussetzungen

- Node.js 14+ (für lokalen Signaling Server)
- Moderne Browser mit WebRTC-Unterstützung
- Zwei Geräte im gleichen WLAN-Netzwerk

### Schritt 1: Repository klonen

```bash
git clone https://github.com/derDieDasJojo/babyfon.git
cd babyfon
```

### Schritt 2: Dependencies installieren

```bash
npm install
```

### Schritt 3: Signaling Server starten (optional)

Für lokale Entwicklung ohne WebConnect Server:

```bash
npm start
# oder manuell:
python3 -m http.server 8000
```

### Schritt 4: Im Browser öffnen

```
http://localhost:8000
```

## Verwendung

### Baby-Modus (Sender)

1. Öffne die Babyfon-App auf dem Device des Babys
2. Klicke auf **"Baby (Sender)"**
3. Aktiviere Audio und optional Video
4. Klicke auf **"Stream starten"**
5. Das Baby ist automatisch im lokalen WLAN sichtbar

**Einstellungen:**
- ☑️ **Audio aktivieren** - Mikrofon beim Parent hörbar
- ☑️ **Video aktivieren** - Live-Video vom Baby beim Parent

### Parent-Modus (Receiver)

1. Öffne die Babyfon-App auf dem Elterngerät
2. Klicke auf **"Parent (Empfänger)"**
3. Klick auf **"Nach Babys suchen"**
4. Wähle das Baby aus der automatisch erkannten Liste
5. Video und Audio werden sofort übertragen

**Steuerungen:**
- 🔊 / 🔇 - Audio ein/ausschalten
- ⛶ - Vollbildmodus

## Architektur

### Technologie-Stack

```
Frontend:
├─ HTML5 (semantic markup)
├─ CSS3 (responsive design)
└─ Vanilla JavaScript (ES6+)

Kommunikation:
├─ WebRTC (Peer-to-Peer Audio/Video)
├─ LocalStorage (P2P Signalisierung im Browser)
└─ STUN Server (ICE Candidate Discovery)

Browser APIs:
├─ getUserMedia (Kamera/Mikrofon)
├─ RTCPeerConnection (Datenübertragung)
├─ Fullscreen API
└─ Storage API (LocalStorage)
```

### Datenfluss (Baby → Parent)

```
Baby Device          ←→  LocalStorage P2P Signalisierung  ←→  Parent Device
├─ Kamera +          │   (SDP Offers/Answers)             │   ├─ Video-Stream
├─ Mikrofon          │   (ICE Candidates)                 │   ├─ Audio-Stream
└─ RTC Tracks        │                                    │   └─ Stats-Monitor
        ↓            │                                    │         ↑
    WebRTC P2P Connection (nach Signalisierung etabliert)
```

## API-Referenz

### P2P Signalisierung

Die Signalisierung nutzt LocalStorage für den direkten Browser-zu-Browser-Austausch im gleichen Netzwerk:

```javascript
// Baby registriert sich
localStorage.setItem(`babyfon-baby-${peerId}`, JSON.stringify({
    peerId: 'babyfon-xxx',
    name: 'Babys Zimmer',
    timestamp: Date.now(),
    streaming: true
}));

// Parent entdeckt Baby-Gerät
const babies = [];
for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('babyfon-baby-')) {
        const baby = JSON.parse(localStorage.getItem(key));
        babies.push(baby);
    }
}

// Parent sendet SDP Offer
localStorage.setItem(`babyfon-offer-${babyPeerId}`, JSON.stringify({
    type: 'offer',
    from: parentPeerId,
    to: babyPeerId,
    sdp: peerConnection.localDescription.sdp
}));

// Baby antwortet mit Answer
localStorage.setItem(`babyfon-answer-${parentPeerId}`, JSON.stringify({
    type: 'answer',
    from: babyPeerId,
    to: parentPeerId,
    sdp: peerConnection.localDescription.sdp
}));
```

### WebRTC RTCPeerConnection

```javascript
// Erstelle Peer Connection
const peerConnection = new RTCPeerConnection({
    iceServers: [
        { urls: ['stun:stun.l.google.com:19302'] }
    ]
});

// Höre auf Remote Streams
peerConnection.ontrack = (event) => {
    const remoteStream = event.streams[0];
    videoElement.srcObject = remoteStream;
};

// Handle ICE Candidates
peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
        // Sende ICE Candidate zum anderen Peer
    }
};

// Füge lokale Tracks hinzu
localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
});

// Erstelle und sende SDP Offer
const offer = await peerConnection.createOffer();
await peerConnection.setLocalDescription(offer);

// Setze Remote Description nach Answer vom anderen Peer
await peerConnection.setRemoteDescription(
    new RTCSessionDescription(answer)
);
```

## Sicherheit

⚠️ **Wichtig:** Diese Webapp ist für den Einsatz im **privaten lokalen WLAN** ausgelegt:

- ✅ Keine Daten verlassen das lokale Netzwerk
- ✅ Peer-to-Peer Verbindung (kein zentraler Server erforderlich)
- ✅ Automatische DTLS/SRTP Verschlüsselung via WebRTC
- ✅ Alle Geräte im gleichen WLAN dürfen sich verbinden

### Empfehlungen:

1. **Sicheres WLAN** - Verwende WPA2/WPA3 Verschlüsselung
2. **Geschlossenes Netzwerk** - Kein offenes öffentliches WLAN
3. **Lokale Nutzung** - Nur für private Haushalte
4. **HTTPS** - Für produktive Umgebung HTTPS verwenden

## Konfiguration

### Browser-Berechtigungen

Die App benötigt Berechtigungen für:
- 🎥 Kamera-Zugriff (optional)
- 🔊 Mikrofon-Zugriff (erforderlich)
- 💾 Storage (für Einstellungen)

## Troubleshooting

### Problem: "UserMedia nicht verfügbar"
**Lösung:**
- Browser benötigt HTTPS oder localhost
- Überprüfe Kamera/Mikrofon Berechtigungen
- Stelle sicher, dass keine andere App die Geräte nutzt

### Problem: "Verbindung fehlgeschlagen"
**Lösung:**
- Überprüfe, dass beide Geräte im gleichen WLAN sind
- Überprüfe den Code auf Tippfehler
- Starte den Signaling Server neu

### Problem: "Hohe Verzögerung / Frohe Bilder"
**Lösung:**
- Näher am Router positionieren
- Reduziere Netzwerkauslastung
- Deaktiviere Video für reines Audio (niedriger Bitrate)

### Problem: "Audio knackt oder Verbindung bricht ab"
**Lösung:**
- Überprüfe WLAN-Signal
- Probiere neue Browser-Sitzung
- Überprüfe, dass kein VPN aktiv ist

## Entwicklung

### Projekt-Struktur

```
babyfon/
├── index.html          # UI-Struktur
├── styles.css          # Styling & responsive Layout
├── script.js           # Hauptlogik & WebRTC/webconnect.js
├── README.md           # Dies
└── package.json        # (Optional) Dependencies
```

### Code-Stil

- Vanilla JavaScript (kein Framework)
- Kommentare auf Deutsch und Englisch
- ES6+ moderne Syntax
- Mobile-First responsive Design

### Lokale Entwicklung

```bash
# Mit Python HTTP Server
python3 -m http.server 8000

# Mit Node.js
npx http-server
```

Dann besuche: `http://localhost:8000`

## Features Roadmap

- [ ] **Notifications** - Desktop-Benachrichtigungen bei Verbindungsabbruch
- [ ] **Recording** - Screenshot und Video-Recording lokal speichern
- [ ] **Two-Way Audio** - Audio vom Parent zum Baby (Gegensprechanlage)
- [ ] **Motion Detection** - Bewegungserkennung mit Alarm
- [ ] **Multiple Babies** - Mehrere Babys gleichzeitig monitoren
- [ ] **Analytics** - Historische Daten & Reports
- [ ] **PWA** - Progressive Web App mit Offline-Modus
- [ ] **Mobile App** - React Native oder Flutter Version

## Browser-Kompatibilität

| Browser | Desktop | Mobile |
|---------|---------|--------|
| Chrome  | ✅ 60+  | ✅ 60+ |
| Firefox | ✅ 55+  | ✅ 55+ |
| Safari  | ✅ 11+  | ✅ 11+ |
| Edge    | ✅ 79+  | ✅ 79+ |

## Performance

### Typische Werte (im lokalen WLAN)

- **Video Bitrate** - 500 kbps - 2 Mbps
- **Audio Bitrate** - 30 kbps - 128 kbps
- **Latenz** - 50-200 ms
- **CPU-Nutzung** - 5-15%
- **Speicher** - 50-100 MB

## Lizenz

MIT License - Siehe LICENSE Datei

## Credits

- Gebaut mit ❤️ für Eltern
- Nutzt **WebRTC** für P2P Audio/Video
- **LocalStorage** für Browser-basierte P2P-Signalisierung
- Icons aus Unicode/Emoji

## Support

Hast du Fragen oder Probleme?

- 📧 Email: support@babyfon.local
- 🐛 Issues: GitHub Issues
- 💬 Diskussionen: GitHub Discussions

---

**Hinweis:** Diese Webapp ist für private Nutzung im eigenen Netzwerk optimiert. Für öffentliche Bereitstellung müssen zusätzliche Sicherheitsmaßnahmen implementiert werden.

Made with 🍼 for parents