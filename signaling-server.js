#!/usr/bin/env node

/**
 * Babyfon Signaling Server
 * 
 * Lokaler WebSocket-Server für Verbindungsverwaltung zwischen Baby und Parent
 * Benötigt: Node.js 14+
 * 
 * Verwendung:
 *   node signaling-server.js
 * 
 * Dann ist der Server unter ws://localhost:8080 erreichbar
 */

const http = require('http');
const WebSocket = require('ws');
const url = require('url');

const PORT = process.env.PORT || 8080;

// Einfacher In-Memory Store für Code-Mappings
const codeToDevice = new Map();
const deviceToPeer = new Map();

// HTTP Server für WebSocket
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            timestamp: new Date().toISOString(),
            devices: codeToDevice.size
        }));
    } else if (req.url === '/stats') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            activeDevices: codeToDevice.size,
            connections: Array.from(codeToDevice.entries()).map(([code, device]) => ({
                code,
                peerId: device.peerId,
                role: device.role,
                connectedAt: device.connectedAt
            }))
        }));
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

// WebSocket Server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`[${new Date().toISOString()}] Neue Verbindung von ${clientIp}`);

    let clientId = null;
    let clientRole = null;
    let clientCode = null;

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);

            switch (message.type) {
                case 'register':
                    clientId = message.peerId;
                    clientRole = message.role; // 'baby' oder 'parent'
                    clientCode = message.code;

                    if (clientRole === 'baby') {
                        // Baby registriert sich mit Code
                        codeToDevice.set(clientCode, {
                            peerId: clientId,
                            role: 'baby',
                            ws: ws,
                            connectedAt: new Date(),
                            ip: clientIp
                        });

                        console.log(`[BABY] ${clientId} registriert mit Code: ${clientCode}`);

                        ws.send(JSON.stringify({
                            type: 'registered',
                            peerId: clientId,
                            code: clientCode
                        }));

                        // Benachrichtige alle Parent-Verbindungen
                        broadcastStatus();

                    } else if (clientRole === 'parent') {
                        // Parent versucht sich mit Code zu verbinden
                        const babyDevice = codeToDevice.get(clientCode);

                        if (babyDevice && babyDevice.role === 'baby') {
                            // Verbindung erlaubt
                            deviceToPeer.set(clientId, {
                                peerId: clientId,
                                role: 'parent',
                                babyCode: clientCode,
                                connectedAt: new Date(),
                                ip: clientIp
                            });

                            console.log(`[PARENT] ${clientId} verbunden mit Baby Code: ${clientCode}`);

                            // Sende ICE Kandidaten/Offer/Answer an Baby
                            ws.send(JSON.stringify({
                                type: 'peer-found',
                                babyPeerId: babyDevice.peerId
                            }));

                            // Benachrichtige Baby über neue Parent-Verbindung
                            babyDevice.ws.send(JSON.stringify({
                                type: 'peer-connected',
                                parentPeerId: clientId
                            }));

                            broadcastStatus();
                        } else {
                            ws.send(JSON.stringify({
                                type: 'error',
                                message: 'Ungültiger Code oder Baby nicht verfügbar',
                                code: clientCode
                            }));
                        }
                    }
                    break;

                case 'signal':
                    // Weitergabe von WebRTC Signaling Messages
                    const targetId = message.targetId;
                    const targetDevice = Array.from(codeToDevice.values()).find(d => d.peerId === targetId) ||
                                       Array.from(deviceToPeer.values()).find(d => d.peerId === targetId);

                    if (targetDevice && targetDevice.ws) {
                        targetDevice.ws.send(JSON.stringify({
                            type: 'signal',
                            from: clientId,
                            data: message.data
                        }));
                    }
                    break;

                case 'stats':
                    // Statistiken-Request
                    ws.send(JSON.stringify({
                        type: 'stats',
                        activeDevices: codeToDevice.size + deviceToPeer.size,
                        codes: codeToDevice.size,
                        parents: deviceToPeer.size
                    }));
                    break;

                default:
                    console.log(`Unbekannter Message-Typ: ${message.type}`);
            }

        } catch (error) {
            console.error('Message-Verarbeitungs-Fehler:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Fehler beim Verarbeiten der Nachricht'
            }));
        }
    });

    ws.on('close', () => {
        console.log(`[${new Date().toISOString()}] Verbindung geschlossen: ${clientId}`);

        // Cleanup
        if (clientCode) {
            codeToDevice.delete(clientCode);
        }
        if (clientId) {
            deviceToPeer.delete(clientId);
        }

        broadcastStatus();
    });

    ws.on('error', (error) => {
        console.error('WebSocket-Fehler:', error);
    });
});

function broadcastStatus() {
    const status = {
        type: 'status-update',
        activeDevices: codeToDevice.size + deviceToPeer.size,
        timestamp: new Date().toISOString()
    };

    const message = JSON.stringify(status);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Server starten
server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════╗
║        🍼 Babyfon Signaling Server                 ║
╚════════════════════════════════════════════════════╝

✅ Server läuft unter: ws://localhost:${PORT}
📊 Stats verfügbar unter: http://localhost:${PORT}/stats
❤️  Health Check unter: http://localhost:${PORT}/health

Drücke Strg+C zum Beenden
    `);
});

// Graceful Shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Server wird heruntergefahren...');
    
    // Schließe alle Verbindungen
    wss.clients.forEach(ws => {
        ws.close(1000, 'Server heruntergefahren');
    });

    server.close(() => {
        console.log('✅ Server beendet');
        process.exit(0);
    });

    // Erzwinge Beendigung nach 5 Sekunden
    setTimeout(() => {
        console.error('❌ Erzwinge Beendigung');
        process.exit(1);
    }, 5000);
});

// Fehlerbehandlung für nicht erfasste Fehler
process.on('uncaughtException', (error) => {
    console.error('❌ Unerwarteter Fehler:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unbehandelte Promise Ablehnung:', reason);
    process.exit(1);
});
