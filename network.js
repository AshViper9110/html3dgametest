/* ============================================================
   NEON ARENA - ネットワーク管理
   PeerJSを用いたスター型ネットワーク
   ============================================================ */

class NetworkManager {
  constructor(game) {
    this.game = game;
    this.peer = null;
    this.connections = [];
    this.conn = null;
    this.isHost = false;
    this.roomId = null;
    this.myId = null;
    this.connected = false;
    this.sendTimer = 0;
    this.peerPacketCount = new Map();
  }

  async createRoom() {
    this.isHost = true;
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.roomId = 'NEON-' + suffix;
    return new Promise((resolve, reject) => {
      this.peer = new Peer(this.roomId, { debug: 0 });
      this.peer.on('open', () => { this.myId = this.roomId; resolve(this.roomId); });
      this.peer.on('connection', (conn) => {
        this.connections.push(conn);
        this._setupConn(conn);
      });
      this.peer.on('error', (err) => reject(err));
    });
  }

  async joinRoom(roomId, playerName) {
    this.isHost = false;
    this.roomId = roomId;
    return new Promise((resolve, reject) => {
      this.peer = new Peer(undefined, { debug: 0 });
      this.peer.on('open', (id) => {
        this.myId = id;
        const conn = this.peer.connect(roomId, { reliable: true });
        this.conn = conn;
        this._setupConn(conn);
        conn.on('open', () => {
          conn.send({ type: NetMsg.JOIN, name: playerName || 'Player' });
          resolve();
        });
      });
      this.peer.on('error', (err) => reject(err));
    });
  }

  _setupConn(conn) {
    conn.on('data', (data) => {
      if (this.isHost && this.game.cheatValidator) {
        const peerId = conn.peer;
        if (!this.game.cheatValidator.validatePacket(data, peerId)) {
          if (this.game.cheatValidator.isSpamming(peerId)) {
            this._disconnectPeer(conn);
          }
          return;
        }
      }
      this.game.handleMessage(data, conn);
    });
    conn.on('close', () => {
      if (this.isHost) {
        const idx = this.connections.indexOf(conn);
        if (idx >= 0) this.connections.splice(idx, 1);
        this.game.onPlayerLeft(conn.peer);
      } else {
        this.connected = false;
        this.game.onDisconnected();
      }
    });
    if (!this.isHost) {
      conn.on('open', () => { this.connected = true; });
    }
  }

  _disconnectPeer(conn) {
    try { conn.close(); } catch(e) {}
    const idx = this.connections.indexOf(conn);
    if (idx >= 0) this.connections.splice(idx, 1);
    this.game.onPlayerLeft(conn.peer);
  }

  send(data) {
    console.log('[Network] send type=%s conn=%o open=%s', data.type, this.conn, this.conn ? this.conn.open : 'N/A');
    if (this.conn && this.conn.open) this.conn.send(data);
  }

  sendTo(peerId, data) {
    if (this.isHost && peerId === this.myId) return;
    const conn = this.connections.find(c => c.peer === peerId);
    if (conn && conn.open) conn.send(data);
  }

  broadcast(data, exclude) {
    if (data.type === 'proj_spawn' || data.type === 'fire_request') {
      console.log('[Network] broadcast type=%s ownerId=%s to %d connections',
        data.type, data.ownerId || '?', this.connections.filter(c => c !== exclude && c.open).length);
    }
    this.connections.forEach(c => {
      if (c !== exclude && c.open) c.send(data);
    });
  }

  sendState(dt) {
    if (!this.connected && !this.isHost) return;
    const p = this.game.localPlayer;
    if (!p || !p.scene) return;
    this.sendTimer += dt;
    if (this.sendTimer < CONFIG.stateSendRate) return;
    this.sendTimer = 0;
    const data = {
      type: 'state',
      id: this.myId,
      pos: { x: p.position.x, y: p.position.y, z: p.position.z },
      rot: p.rotation,
      health: p.health,
      alive: p.alive,
      weapon: p.weapon,
      timestamp: Date.now(),
    };
    if (this.isHost) {
      this.broadcast(data);
    } else {
      this.send(data);
    }
  }

  sendFireRequest(weapon, position, direction, inputId, color) {
    console.log('[Network] send fire_request weapon=%s inputId=%s', weapon, inputId);
    this.send({
      type: 'fire_request',
      weapon,
      position: { x: position.x, y: position.y, z: position.z },
      direction: { x: direction.x, y: direction.y, z: direction.z },
      timestamp: Date.now(),
      inputId,
      color,
    });
  }

  /* ロビー同期メッセージ */
  sendReady(ready) {
    this.send({ type: NetMsg.READY, ready });
  }

  sendWeaponChange(weapon) {
    this.send({ type: NetMsg.WEAPON_CHANGE, weapon });
  }

  sendNameChange(name) {
    this.send({ type: NetMsg.NAME_CHANGE, name });
  }

  close() {
    this.connections.forEach(c => c.close());
    if (this.conn) this.conn.close();
    if (this.peer) this.peer.destroy();
    this.connections = [];
    this.connected = false;
  }
}
