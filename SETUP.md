# 🚀 Babyfon Setup Guide

⚡ **Wichtig:** Babyfon funktioniert **OHNE externen Server**! Die App nutzt reine P2P-Kommunikation im lokalen WLAN mit WebRTC und lokalem Browser-Storage für die Signalisierung.

## Quick Start (5 Minuten)

### 1. Repository klonen und öffnen

```bash
git clone https://github.com/derDieDasJojo/babyfon.git
cd babyfon
```

### 2. Server starten

```bash
python3 -m http.server 8000
# oder mit Node.js:
npx http-server -p 8000
```

### 3. Im Browser öffnen

- **Baby-Gerät:** `http://192.168.1.X:8000` (ersetze X mit IP)
- **Parent-Gerät:** `http://192.168.1.Y:8000` (ersetze Y mit IP)

### 4. Verbinden

**Baby-Seite:**
1. Klick auf "Baby (Sender)"
2. Wähle Audio und/oder Video
3. Klick "Stream starten"
4. Baby ist automatisch im Netzwerk erkannt!

**Parent-Seite:**
1. Klick auf "Parent (Empfänger)"
2. Klick auf "Nach Babys suchen"
3. Wähle das Baby aus der Liste
4. Video/Audio sollte erscheinen!

---

## Detaillierte Setup-Anleitung

## Phase 1: Vorbereitung

### System-Anforderungen

- **Betriebssystem:** Windows, macOS, Linux
- **Node.js/Python:** Eines davon muss installiert sein
  - Node.js 14+: `node --version`
  - Python 3+: `python3 --version`
- **WLAN:** Beide Geräte müssen im gleichen Netzwerk (z.B. FRITZ!Box, Vodafone, ...)
- **Browser:** Chrome, Firefox, Safari oder Edge von 2020+

### Netzwerk-Prüfung

Vor dem Start überprüfe, dass beide Geräte im gleichen Netzwerk sind:

```bash
# Auf beiden Geräten ausführen
ipconfig getifaddr en0          # macOS
ip -4 addr show wlan0           # Linux
ipconfig                         # Windows (suche IPv4-Adresse)
```

Beispiel: Wenn Server die IP `192.168.1.100` hat, sollte Parent auf `192.168.1.100:8000` zugreifen können.

---

## Phase 2: Installation

### Option A: Mit Python (Standard)

```bash
# 1. In den Projektordner gehen
cd /pfad/zum/babyfon

# 2. HTTP Server starten
python3 -m http.server 8000

# Fertig! Server läuft auf http://localhost:8000
```

### Option B: Mit Node.js

```bash
# 1. Dependencies installieren
npm install

# 2. HTTP Server starten
npx http-server -p 8000

# Server läuft auf http://localhost:8000
```

## Phase 3: Erste Verbindung

### Szenario 1: Desktop + Tablet

1. **Desktop (Baby-Mode):**
   ```
   - Localhost starten: http://localhost:8000
   - Klick "Baby (Sender)"
   - Audio + Video aktivieren
   - Stream starten
   - Code notieren oder kopieren
   ```

2. **Tablet (Parent-Mode):**
   ```
   - Desktop-IP eingeben: http://192.168.1.100:8000
   - Klick "Parent (Empfänger)"
   - Code von Desktop einfügen
   - Verbinden
   ```

### Szenario 2: Zwei Desktops

```
Desktop 1 (Browser-Tab 1)      Desktop 2 (Browser-Tab 2)
↓                               ↓
localhost:8000 (Baby)          192.168.1.100:8000 (Parent)
```

### Szenario 3: Smartphone + Smartphone

```
Gerät 1: http://192.168.x.x:8000
Gerät 2: http://192.168.x.x:8000
```

**Tipp:** Verwende einen QR-Code Generator um die URL zu teilen:
```bash
npm install -g qrcode
qrcode "http://192.168.1.100:8000"
```

---

## Fehlerbehebung

### Problem 1: "Verbindung verweigert"

**Ursache:** Server läuft nicht oder falsche IP

**Lösung:**
```bash
# 1. Server nicht aktiv?
python3 -m http.server 8000
# Ausgabe sollte zeigen: Serving HTTP on 0.0.0.0 port 8000

# 2. Richtige IP überprüfen
# Windows:
ipconfig
# Suche nach "IPv4-Adresse: 192.168.x.x"

# macOS/Linux:
ifconfig | grep "inet "
# Suche nach 192.168.x.x (nicht 127.0.0.1)
```

### Problem 2: "Kamera/Mikrofon nicht verfügbar"

**Ursache:** Browser hat keine Berechtigung oder Hardware fehlt

**Lösung (Chrome/Edge):**
1. Adressleiste: `chrome://settings/content/microphone`
2. Suche die URL `localhost` oder `192.168.x.x`
3. AllowList hinzufügen
4. Seite neu laden

**Lösung (Firefox):**
1. Seite neu laden
2. Popup erlauben
3. Erlauben-Button klicken
4. Browser-Neustart

**Lösung (Safari):**
1. Safari → Einstellungen → Datenschutz
2. Kamera/Mikrofon erlauben für Babyfon

### Problem 3: "Verbindungscode funktioniert nicht"

**Ursache:** Code ist abgelaufen oder eingegeben falsch

**Lösung:**
```
1. Baby-Stream neu starten (neuer Code)
2. Code überprüfen: GENAU 8 Zeichen
3. Keine Spaces/Leerzeichen!
4. Großbuchstaben überprüfen
```

### Problem 4: "Hohe Latenz / Ruckelige Bilder"

**Ursache:** Schwaches WLAN oder zu viele Geräte

**Lösung:**
```
1. Video deaktivieren (nur Audio)
2. Näher am Router positionieren
3. 5GHz WLAN statt 2.4GHz (falls verfügbar)
4. Andere WLAN-Nutzer bitten, WiFi freizugeben
5. Mit LAN-Kabel verbinden (falls möglich)
```

### Problem 5: "Schwarzes Bild / Kein Audio"

**Ursache:** Stream gestartet aber nicht übertragen

**Lösung:**
```
1. Browser Console öffnen (F12 → Console)
2. Fehlermeldungen überprüfen
3. Seite komplett neu laden (Strg+Shift+R)
4. Neuer Code erforderlich
5. Signaling Server neu starten
```

---

## Fortgeschrittene Konfiguration

### WebRTC Statistics in Chrome

Zum Debugging von Verbindungsproblemen:

1. Browser öffnen
2. Adressleiste: `about:webrtc-internals`
3. Dort sichtbar:
   - Alle aktiven Verbindungen
   - Bandbreite-Statistiken
   - Paketerlust
   - Codec-Informationen

### Custom Signaling Server

Falls der Standard nicht passt:

```javascript
// In script.js anpassen:
state.connection = new WebConnect({
    signalingServer: 'wss://your-server.com:8081', // HTTPS!
    peerId: generatePeerId(),
    iceServers: [
        { urls: ['stun:stun.l.google.com:19302'] }
    ]
});
```

### TURN Server für Firewalls

Für NAT/Firewall-Probleme:

```javascript
iceServers: [
    { urls: ['stun:stun.l.google.com:19302'] },
    {
        urls: ['turn:your-turn-server.com:3478'],
        username: 'user',
        credential: 'pass'
    }
]
```

---

## Sicherheit prüfen

### SSL/HTTPS einrichten

Für echte Sicherheit in Produktion:

```bash
# Self-signed Zertifikat erstellen
openssl req -x509 -newkey rsa:4096 -nodes \
    -out cert.pem -keyout key.pem -days 365

# Mit Python HTTPS Server starten
python3 << EOF
import http.server
import ssl

server = http.server.HTTPServer(('0.0.0.0', 8443), 
                                 http.server.SimpleHTTPRequestHandler)
server.socket = ssl.wrap_socket(server.socket, 
                                  certfile='cert.pem',
                                  keyfile='key.pem', 
                                  server_side=True)
server.serve_forever()
EOF
```

### Firewall-Konfiguration

```bash
# UFW (Ubuntu)
sudo ufw allow 8000/tcp
sudo ufw allow 8080/tcp

# macOS (Little Snitch)
Allow babyfon in System Preferences

# Windows Defender Firewall
- Ausnahmen hinzufügen
- Ports 8000, 8080 öffnen
```

---

## Performance-Tipps

### Optimale Einstellungen nach Bandbreite

**Schnelles WLAN (>50 Mbps):**
- Video: 720p
- Audio: 128 kbps
- Latenz: <100ms

**Normales WLAN (10-50 Mbps):**
- Video: 480p
- Audio: 64 kbps
- Latenz: 100-200ms

**Schwaches WLAN (<10 Mbps):**
- Nur Audio
- Audio: 32 kbps
- Latenz: 200-500ms

### Browser-Optimierung

```javascript
// In script.js (optional):
// Video-Constraints anpassen:
video: {
    width: { ideal: 640 },      // Statt 1280
    height: { ideal: 480 },     // Statt 720
    frameRate: { ideal: 15 }    // Weniger Frames
}
```

---

## Docker Setup (Optional)

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY . .

RUN npm install

EXPOSE 8000 8080

CMD ["npm", "start"]
```

```bash
# Build und Run:
docker build -t babyfon .
docker run -p 8000:8000 -p 8080:8080 babyfon
```

---

## Deployment in Produktion

Bevor in Produktion gehen:

- [ ] HTTPS einrichten (Zertifikat)
- [ ] TURN Server konfigurieren
- [ ] Firewall/NAT durchdacht
- [ ] Monitoring einbauen
- [ ] Backups planen
- [ ] Datenschutz überprüfen (DSGVO)

---

## Zusätzliche Ressourcen

- **WebConnect.js Docs:** https://webconnect.js.org/docs
- **WebRTC Setup:** https://webrtc.org/getting-started
- **mDNS Discovery:** https://tools.ietf.org/html/rfc6763
- **TURN Server:** https://github.com/coturn/coturn

---

## Support

Falls du noch Fragen hast:

```bash
# Logs in der Browser-Console (F12) überprüfen
# Debug-Mode aktivieren:
localStorage.setItem('debug', 'true');

# Systeminfo sammeln:
- Browser und Version
- Betriebssystem
- Netzwerk-IP-Bereich (nicht public!)
- Fehlermeldungen aus Console
```

Viel Erfolg! 🍼🎉

Made with ❤️ for parents
