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
    this._seq = 0;
    this._processedPackets = new Set();
    this._pingTimers = new Map();
    this._rtt = new Map();
    this._packetLoss = new Map();
    this._inputSeq = 0;
    this._lastAckedSeq = 0;
    this._serverStates = [];
    this._pendingInputs = [];
    this._maxPendingInputs = CONFIG.maxPendingInputs || 100;
  }

  _wrap(data) {
    if (!data || typeof data !== 'object') return null;
    this._seq++;
    return { ...data, _s: this._seq, _p: this.myId, _t: Date.now() };
  }

  _isDuplicate(packetId) {
    if (!packetId) return false;
    const key = String(packetId);
    if (this._processedPackets.has(key)) return true;
    this._processedPackets.add(key);
    if (this._processedPackets.size > 20000) {
      const iter = this._processedPackets.values();
      for (let i = 0; i < 10000; i++) { this._processedPackets.delete(iter.next().value); }
    }
    return false;
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
          conn.send(this._wrap({ type: NetMsg.JOIN, name: playerName || 'Player' }));
          resolve();
        });
      });
      this.peer.on('error', (err) => reject(err));
    });
  }

  _setupConn(conn) {
    conn.on('data', (data) => {
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

  send(data) {
    const enveloped = this._wrap(data);
    if (this.conn && this.conn.open) this.conn.send(enveloped);
  }

  sendTo(peerId, data) {
    if (this.isHost && peerId === this.myId) return;
    const conn = this.connections.find(c => c.peer === peerId);
    if (conn && conn.open) conn.send(this._wrap(data));
  }

  broadcast(data, exclude) {
    const wrapped = this._wrap(data);
    this.connections.forEach(c => {
      if (c !== exclude && c.open) c.send(wrapped);
    });
  }

  sendInput(input) {
    this._inputSeq++;
    const data = {
      type: 'input',
      seq: this._inputSeq,
      forward: input.forward,
      strafe: input.strafe,
      mouseX: input.mouseX || 0,
      mouseY: input.mouseY || 0,
      fire: input.fire || false,
      jump: input.jump || false,
      dash: input.dash || false,
      reload: input.reload || false,
      weaponChange: input.weaponChange || null,
      passiveChange: input.passiveChange || null,
      timestamp: Date.now(),
    };
    this._pendingInputs.push({ seq: this._inputSeq, input: data, time: Date.now() });
    if (this._pendingInputs.length > this._maxPendingInputs) this._pendingInputs.shift();
    this.send(data);
  }

  sendFireRequest(weapon, position, direction, inputId, color) {
    const data = {
      type: 'fire_request',
      weapon,
      position: { x: position.x, y: 0, z: position.z },
      direction: { x: direction.x, y: 0, z: direction.z },
      inputId,
      color: color || 0xffffff,
      timestamp: Date.now(),
    };
    this.send(data);
  }

  sendBeamFire(weapon, origin, direction, inputId, color) {
    const data = {
      type: 'beam_fire',
      weapon,
      origin: { x: origin.x, y: 0, z: origin.z },
      direction: { x: direction.x, y: 0, z: direction.z },
      inputId,
      color: color || 0xffffff,
      timestamp: Date.now(),
    };
    this.send(data);
  }

  sendState(dt) {
    if (!this.isHost || !this.connected) return;
    this.sendTimer += dt;
    if (this.sendTimer < CONFIG.stateSendRate) return;
    this.sendTimer = 0;

    const data = {
      type: NetMsg.STATE,
      players: [],
      projectiles: [],
      timestamp: Date.now(),
    };
    this.game.players.forEach((p, id) => {
      data.players.push({
        id, pos: { x: p.position.x, y: p.position.y, z: p.position.z },
        rot: p.rotation, health: p.health, alive: p.alive,
        weapon: p.weapon, kills: p.matchKills, deaths: p.matchDeaths,
      });
    });
    this.broadcast(data);
  }

  sendStateDiff() {
    if (!this.isHost) return;
    this.game.players.forEach((p, id) => {
      if (id === this.myId) return;
      const state = {
        type: NetMsg.STATE_DIFF,
        id,
        pos: { x: p.position.x, z: p.position.z },
        rot: p.rotation,
        health: p.health,
        alive: p.alive,
        timestamp: Date.now(),
      };
      this.sendTo(id, state);
    });
  }

  sendPing(targetId) {
    const data = { type: NetMsg.PING, time: Date.now() };
    if (targetId) this.sendTo(targetId, data);
    else this.send(data);
  }

  handlePong(data) {
    if (data && data.time) {
      const rtt = Date.now() - data.time;
      this._rtt.set(data._p || 'server', rtt);
    }
  }

  getRTT(peerId) { return this._rtt.get(peerId || 'server') || 0; }

  getServerState(time) {
    if (this._serverStates.length === 0) return null;
    for (let i = this._serverStates.length - 1; i >= 0; i--) {
      if (this._serverStates[i].time <= time) return this._serverStates[i];
    }
    return this._serverStates[0];
  }

  recordServerState(positions) {
    this._serverStates.push({ time: Date.now(), positions });
    while (this._serverStates.length > 60) this._serverStates.shift();
  }

  getPendingInput(fromSeq) {
    return this._pendingInputs.filter(inp => inp.seq > fromSeq);
  }

  setLastAckedSeq(seq) {
    this._lastAckedSeq = Math.max(this._lastAckedSeq, seq);
    this._pendingInputs = this._pendingInputs.filter(inp => inp.seq > this._lastAckedSeq);
  }

  getUnacknowledgedInputs() {
    return this._pendingInputs;
  }

  close() {
    this.connections.forEach(c => { try { c.close(); } catch(e) {} });
    if (this.conn) { try { this.conn.close(); } catch(e) {} }
    if (this.peer) { try { this.peer.destroy(); } catch(e) {} }
    this.connections = [];
    this.connected = false;
    this._processedPackets.clear();
    this._pendingInputs = [];
    this._serverStates = [];
    this._lastAckedSeq = 0;
    this._inputSeq = 0;
  }
}
