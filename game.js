class Game {
  constructor() {
    this.players = new Map();
    this.localId = null;
    this.projectiles = [];
    this.remoteProjIdCounter = 0;
    this.keys = {};
    this.mouseDelta = 0;
    this.network = new NetworkManager(this);
    this.gameStarted = false;
    this.gameOver = false;
    this.connectionHandled = false;
    this.kills = 0;
    this.deaths = 0;
    this.respawnTimer = 0;
    this.gameTimer = CONFIG.gameTimeLimit;
    this.selectedMap = 'grid';
    this.pointerLocked = false;
    this.clock = new THREE.Clock();
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.arenaObjects = [];
    this.rimLights = [];
    this.scoreboard = new Map();
    this.killCamKillerId = null;
    this.invincibleTimer = 0;
    this.teleportCooldown = 0;
    this.loadoutWeapon = 'pistol';
    this.mouseDown = false;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashTriggered = false;
    this.inputIdCounter = 0;
    this.isFalling = false;
    this.wasGrounded = true;
    this.killStreak = 0;
    this.lastKillTime = 0;
    this.multiKillTimer = 0;
    this.killCountThisLife = 0;

    this.cheatValidator = null;
    this.hostAuthority = null;
    this.hitValidator = null;
    this.effectManager = null;
    this.cameraEffectManager = null;
  }

  get localPlayer() { return this.players.get(this.localId); }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a12);
    this.scene.fog = new THREE.Fog(0x0a0a12, 30, 60);
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 100);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    document.getElementById('game-container').appendChild(this.renderer.domElement);

    this.cheatValidator = new CheatValidator();
    this.hostAuthority = new HostAuthority(this);
    this.hitValidator = new HitValidator(this);
    this.effectManager = new EffectManager(this.scene, this.camera);
    this.cameraEffectManager = new CameraEffectManager(this.camera);

    this._wireReloadCallback();

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
      document.getElementById('instructions').classList.toggle('hidden', !this.pointerLocked || this.respawnTimer > 0);
    });
    document.addEventListener('mousemove', (e) => { if (this.pointerLocked) this.mouseDelta += e.movementX; });
    document.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      if (e.key.toLowerCase() === 'r') this.reload();
    });
    document.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
    this.renderer.domElement.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouseDown = true;
    });
    this.renderer.domElement.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    this.renderer.domElement.addEventListener('click', () => {
      if (this.network.connected && !this.pointerLocked && this.gameStarted && !(this.respawnTimer > 0)) {
        this.renderer.domElement.requestPointerLock();
      }
    });
    this._setupLights();
    this._createArena(this.selectedMap);
    this.animate();
  }

  _setupLights() {
    this.ambientLight = new THREE.AmbientLight(0x111122, 0.5);
    this.scene.add(this.ambientLight);
    this.dirLight = new THREE.DirectionalLight(0x8844ff, 1.0);
    this.dirLight.position.set(10, 20, 10);
    this.scene.add(this.dirLight);
    [
      [[-20, 8, -20], 0x00f0ff], [[20, 8, -20], 0xff00ff],
      [[-20, 8, 20], 0x00f0ff], [[20, 8, 20], 0xff00ff],
    ].forEach(([pos, col]) => {
      const l = new THREE.PointLight(col, 0.6, 30);
      l.position.set(pos[0], pos[1], pos[2]);
      this.scene.add(l);
      this.rimLights.push(l);
      const h = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 8, 8),
        new THREE.MeshBasicMaterial({ color: col })
      );
      h.position.copy(l.position);
      this.scene.add(h);
    });
  }

  _clearArena() {
    this.arenaObjects.forEach(o => {
      this.scene.remove(o);
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    this.arenaObjects = [];
    this.rimLights.forEach(l => this.scene.remove(l));
    this.rimLights = [];
  }

  _createArena(mapKey) {
    this._clearArena();
    const map = MAPS[mapKey] || MAPS.grid;
    this.scene.background = new THREE.Color(map.bg);
    this.scene.fog = new THREE.Fog(map.bg, map.fogNear, map.fogFar);
    if (this.ambientLight) {
      this.ambientLight.color.setHex(map.ambientColor);
      this.ambientLight.intensity = map.ambientIntensity;
    }
    if (this.dirLight) {
      this.dirLight.color.setHex(map.dirColor);
      this.dirLight.intensity = map.dirIntensity;
    }
    const half = map.size / 2;
    const wallMat = new THREE.MeshStandardMaterial({
      color: map.wallColor, metalness: 0.2, roughness: 0.6,
    });
    const addWall = (pos, size, idx) => {
      const geo = new THREE.BoxGeometry(...size);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(pos[0], pos[1], pos[2]);
      this.scene.add(mesh);
      this.arenaObjects.push(mesh);
      const eg = new THREE.EdgesGeometry(geo);
      const em = new THREE.LineBasicMaterial({
        color: map.edgeColors[idx % map.edgeColors.length],
        transparent: true, opacity: 0.25,
      });
      const el = new THREE.LineSegments(eg, em);
      el.position.copy(mesh.position);
      this.scene.add(el);
      this.arenaObjects.push(el);
    };
    const wallData = [
      { p: [0, map.wallHeight/2, -half], s: [map.size, map.wallHeight, map.wallThick] },
      { p: [0, map.wallHeight/2, half], s: [map.size, map.wallHeight, map.wallThick] },
      { p: [-half, map.wallHeight/2, 0], s: [map.wallThick, map.wallHeight, map.size] },
      { p: [half, map.wallHeight/2, 0], s: [map.wallThick, map.wallHeight, map.size] },
    ];
    wallData.forEach((d, i) => addWall(d.p, d.s, i));
    map.walls.forEach((w, i) => addWall(w.p, w.s, i + 4));
    const fgeo = new THREE.PlaneGeometry(map.size - 1, map.size - 1);
    const fmat = new THREE.MeshStandardMaterial({
      color: map.floorColor, metalness: 0.3, roughness: 0.7,
    });
    const floor = new THREE.Mesh(fgeo, fmat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    this.scene.add(floor);
    this.arenaObjects.push(floor);
    const gh1 = new THREE.GridHelper(map.size - 2, 20, map.gridColor, 0x222255);
    gh1.material.transparent = true;
    gh1.material.opacity = 0.15;
    gh1.position.y = 0.02;
    this.scene.add(gh1);
    this.arenaObjects.push(gh1);
    const gh2 = new THREE.GridHelper(map.size - 2, 40, 0x4444aa, 0x222255);
    gh2.material.transparent = true;
    gh2.material.opacity = 0.08;
    gh2.position.y = 0.01;
    this.scene.add(gh2);
    this.arenaObjects.push(gh2);
    this.arenaMap = map;
    if (map.pads) {
      map.pads.forEach((pad, i) => {
        const g = new THREE.PlaneGeometry(pad.s[0], pad.s[2]);
        const padMat = new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0x00f0ff : 0xff00ff,
          transparent: true, opacity: 0.12 + 0.06 * Math.sin(i),
          side: THREE.DoubleSide,
        });
        const m = new THREE.Mesh(g, padMat);
        m.position.set(pad.p[0], 0.05, pad.p[2]);
        m.rotation.x = -Math.PI / 2;
        this.scene.add(m);
        this.arenaObjects.push(m);
        const eg = new THREE.EdgesGeometry(g);
        const em = new THREE.LineBasicMaterial({
          color: m.material.color, transparent: true, opacity: 0.3,
        });
        const el = new THREE.LineSegments(eg, em);
        el.position.copy(m.position);
        el.rotation.x = -Math.PI / 2;
        this.scene.add(el);
        this.arenaObjects.push(el);
      });
    }
  }

  addPlayer(id, color, name) {
    if (this.players.has(id)) return this.players.get(id);
    const p = new Player(this.scene, id, color);
    p.name = name || 'Player';
    this.players.set(id, p);
    return p;
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (p) { p.destroy(); this.players.delete(id); }
  }

  onConnected() {
    if (this.connectionHandled) return;
    this.connectionHandled = true;
    document.getElementById('conn-status').textContent = '● CONNECTED';
    document.getElementById('conn-status').classList.add('connected');
  }

  onPlayerLeft(peerId) {
    this.removePlayer(peerId);
    this.updatePlayerListUI();
    this.addKillFeed('A player disconnected');
  }

  showWaitingRoom() {
    document.querySelectorAll('.step-section').forEach(el => el.style.display = 'none');
    document.getElementById('waiting-room').style.display = 'block';
    if (this.network.isHost) {
      document.getElementById('map-select-host').style.display = 'block';
      document.getElementById('map-info-guest').style.display = 'none';
      document.getElementById('map-preview-container').style.display = 'block';
      document.getElementById('guest-map-preview-container').style.display = 'none';
      document.getElementById('waiting-room-status').textContent = 'Waiting for players...';
      document.getElementById('btn-start-game').style.display = 'inline-block';
      document.getElementById('overlay-status').textContent = 'Select map and press START';
      this._setupMapSelector();
    } else {
      document.getElementById('map-select-host').style.display = 'none';
      document.getElementById('map-info-guest').style.display = 'block';
      document.getElementById('map-preview-container').style.display = 'none';
      document.getElementById('guest-map-preview-container').style.display = 'block';
      document.getElementById('btn-start-game').style.display = 'none';
      document.getElementById('waiting-room-status').textContent = 'Connected! Waiting for host...';
      document.getElementById('overlay-status').textContent = 'Waiting for host to start...';
      this._drawGuestMapPreview(this.selectedMap);
    }
    this.updatePlayerListUI();
  }

  _setupMapSelector() {
    const container = document.getElementById('map-selector');
    container.innerHTML = '';
    const mapKeys = Object.keys(MAPS);
    const prevBtn = document.createElement('button');
    prevBtn.className = 'map-nav-btn';
    prevBtn.textContent = '◀';
    prevBtn.addEventListener('click', () => {
      const idx = mapKeys.indexOf(this.selectedMap);
      this.selectedMap = mapKeys[(idx - 1 + mapKeys.length) % mapKeys.length];
      this._updateMapUI();
      this.network.broadcast({ type: 'map_select', map: this.selectedMap });
    });
    const mapNameEl = document.createElement('span');
    mapNameEl.className = 'map-nav-name';
    mapNameEl.id = 'map-nav-name';
    const nextBtn = document.createElement('button');
    nextBtn.className = 'map-nav-btn';
    nextBtn.textContent = '▶';
    nextBtn.addEventListener('click', () => {
      const idx = mapKeys.indexOf(this.selectedMap);
      this.selectedMap = mapKeys[(idx + 1) % mapKeys.length];
      this._updateMapUI();
      this.network.broadcast({ type: 'map_select', map: this.selectedMap });
    });
    container.appendChild(prevBtn);
    container.appendChild(mapNameEl);
    container.appendChild(nextBtn);
    this._updateMapUI();
  }

  _updateMapUI() {
    const map = MAPS[this.selectedMap] || MAPS.grid;
    const nameEl = document.getElementById('map-nav-name');
    if (nameEl) nameEl.textContent = `${map.name} — ${map.desc}`;
    this._drawMapPreview(this.selectedMap);
    document.getElementById('guest-map-name').textContent = `${map.name} — ${map.desc}`;
    this._drawGuestMapPreview(this.selectedMap);
  }

  _drawMapPreview(mapKey) {
    const canvas = document.getElementById('map-preview-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const map = MAPS[mapKey] || MAPS.grid;
    const W = canvas.width;
    const H = canvas.height;
    const pad = 10;
    const drawSize = W - pad * 2;
    const scale = drawSize / map.size;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a0a18';
    ctx.fillRect(0, 0, W, H);
    const arenaX = pad + (W - drawSize) / 2;
    const arenaY = pad + (H - drawSize) / 2;
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(arenaX, arenaY, drawSize, drawSize);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(arenaX, arenaY, drawSize, drawSize);
    ctx.fillStyle = 'rgba(0, 240, 255, 0.3)';
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
    ctx.lineWidth = 1;
    const halfMap = map.size / 2;
    const toCanvas = (x, z) => ({
      cx: arenaX + (x + halfMap) * scale,
      cy: arenaY + (z + halfMap) * scale,
    });
    map.walls.forEach(w => {
      const { cx, cy } = toCanvas(w.p[0], w.p[2]);
      const wScaleX = w.s[0] * scale;
      const wScaleZ = w.s[2] * scale;
      ctx.fillRect(cx - wScaleX / 2, cy - wScaleZ / 2, wScaleX, wScaleZ);
      ctx.strokeRect(cx - wScaleX / 2, cy - wScaleZ / 2, wScaleX, wScaleZ);
    });
    ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.font = '10px Orbitron, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(map.name, W / 2, H - 4);
  }

  _drawGuestMapPreview(mapKey) {
    const canvas = document.getElementById('guest-map-preview-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const map = MAPS[mapKey] || MAPS.grid;
    const W = canvas.width;
    const H = canvas.height;
    const pad = 6;
    const drawSize = W - pad * 2;
    const scale = drawSize / map.size;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a0a18';
    ctx.fillRect(0, 0, W, H);
    const arenaX = pad + (W - drawSize) / 2;
    const arenaY = pad + (H - drawSize) / 2;
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(arenaX, arenaY, drawSize, drawSize);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(arenaX, arenaY, drawSize, drawSize);
    ctx.fillStyle = 'rgba(0, 240, 255, 0.3)';
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
    ctx.lineWidth = 1;
    const halfMap = map.size / 2;
    const toCanvas = (x, z) => ({
      cx: arenaX + (x + halfMap) * scale,
      cy: arenaY + (z + halfMap) * scale,
    });
    map.walls.forEach(w => {
      const { cx, cy } = toCanvas(w.p[0], w.p[2]);
      const wScaleX = w.s[0] * scale;
      const wScaleZ = w.s[2] * scale;
      ctx.fillRect(cx - wScaleX / 2, cy - wScaleZ / 2, wScaleX, wScaleZ);
      ctx.strokeRect(cx - wScaleX / 2, cy - wScaleZ / 2, wScaleX, wScaleZ);
    });
    ctx.fillStyle = 'rgba(0, 240, 255, 0.3)';
    ctx.font = '8px Orbitron, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(map.name, W / 2, H - 3);
  }

  updatePlayerListUI() {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    this.players.forEach((p, id) => {
      const entry = document.createElement('div');
      entry.className = 'pl-entry';
      const dot = document.createElement('span');
      dot.className = 'pl-dot';
      dot.style.color = '#' + p.color.toString(16).padStart(6, '0');
      dot.style.background = '#' + p.color.toString(16).padStart(6, '0');
      const name = document.createElement('span');
      name.className = 'pl-name';
      name.textContent = p.name;
      const tag = document.createElement('span');
      tag.className = 'pl-tag';
      if (id === this.network.myId) { tag.textContent = 'YOU'; tag.classList.add('you'); }
      else if (id === this.network.roomId) { tag.textContent = 'HOST'; tag.classList.add('host'); }
      entry.appendChild(dot);
      entry.appendChild(name);
      entry.appendChild(tag);
      list.appendChild(entry);
    });
  }

  _wireReloadCallback() {
    this._onReloadComplete = (weapon) => {
      if (this.hostAuthority && this.network.isHost) {
        this.hostAuthority.refillAmmo(this.network.myId, weapon);
      }
      if (!this.network.isHost) {
        this.network.send({ type: 'reload_complete', weapon });
      }
    };
  }

  startGame() {
    this.gameStarted = true;
    this.gameOver = false;
    this.gameTimer = CONFIG.gameTimeLimit;
    this.kills = 0;
    this.deaths = 0;
    this.scoreboard.clear();
    this.killCamKillerId = null;
    this.invincibleTimer = 0;
    this.mouseDown = false;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.killStreak = 0;
    this.killCountThisLife = 0;
    this.multiKillTimer = 0;
    this.network.sendTimer = CONFIG.stateSendRate;
    document.getElementById('result-screen').classList.remove('show');
    document.getElementById('death-screen').classList.remove('show');
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('instructions').classList.remove('hidden');
    document.getElementById('match-btn').style.display = 'none';
    document.getElementById('kill-count').textContent = '0';
    document.getElementById('death-count').textContent = '0';
    const lp = this.localPlayer;
    if (lp) { lp.onReloadComplete = this._onReloadComplete; lp.refillAmmo(); this.updateAmmoUI(); }
    this.addKillFeed('GAME START!');
    this.updateTimerUI();
    if (!this.pointerLocked) setTimeout(() => this.renderer.domElement.requestPointerLock(), 300);
  }

  onDisconnected() {
    document.getElementById('conn-status').textContent = '● DISCONNECTED';
    document.getElementById('conn-status').classList.remove('connected');
    this.addKillFeed('Connection lost');
  }

  addKillFeed(msg) {
    const feed = document.getElementById('kill-feed');
    const el = document.createElement('div');
    el.className = 'kill-msg';
    el.textContent = msg;
    feed.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 3000);
  }

  showKillMessage(text) {
    const existing = document.getElementById('kill-message');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.id = 'kill-message';
    el.style.cssText = `
      position:fixed;top:40%;left:50%;transform:translate(-50%,-50%);
      font-family:Orbitron,monospace;font-size:4em;font-weight:900;
      letter-spacing:8px;color:#ff0044;text-shadow:0 0 40px rgba(255,0,68,0.6),0 0 80px rgba(255,0,68,0.3);
      z-index:70;pointer-events:none;animation:killFade 0.8s ease forwards;
    `;
    el.textContent = text;
    document.body.appendChild(el);
    const style = document.createElement('style');
    style.id = 'kill-message-style';
    style.textContent = `@keyframes killFade{0%{opacity:0;transform:translate(-50%,-50%) scale(0.5)}30%{opacity:1;transform:translate(-50%,-50%) scale(1.1)}50%{transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-60%) scale(1)}}`;
    if (!document.getElementById('kill-message-style')) document.head.appendChild(style);
  }

  shoot() {
    const lp = this.localPlayer;
    if (!lp || !lp.alive) return;
    if (lp.reloading) return;
    if (lp.ammo <= 0) { this.reload(); return; }
    const wp = WEAPONS[lp.weapon] || WEAPONS.pistol;
    const pellets = wp.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const dir = new THREE.Vector3(0, 0, -1);
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), lp.rotation);
      dir.y = 0;
      dir.normalize();
      if (wp.spread > 0) {
        dir.x += (Math.random() - 0.5) * wp.spread;
        dir.z += (Math.random() - 0.5) * wp.spread;
        dir.normalize();
      }
      const inputId = this.inputIdCounter++;
      const dirData = { x: dir.x, y: 0, z: dir.z };

      if (this.network.isHost) {
        if (this.hostAuthority) {
          this.hostAuthority.handleFireRequest({
            weapon: lp.weapon,
            position: { x: lp.position.x, y: 0, z: lp.position.z },
            direction: dirData,
            color: lp.color,
            timestamp: Date.now(),
          }, this.network.myId, 'local_' + inputId);
        }
      } else {
        this.network.sendFireRequest(lp.weapon, lp.position, dirData, inputId);
      }

      if (this.effectManager) {
        this.effectManager.spawnMuzzleFlash(lp.position, dir, lp.color);
      }
    }
    lp.ammo--;
    this.updateAmmoUI();
  }

  reload() {
    const lp = this.localPlayer;
    if (!lp || !lp.alive || lp.reloading) return;
    if (lp.ammo >= lp.maxAmmo) return;
    const wp = WEAPONS[lp.weapon] || WEAPONS.pistol;
    lp.reloading = true;
    lp.reloadTimer = wp.reloadTime;
    this.addKillFeed('Reloading...');
    this.updateAmmoUI();
  }

  updateAmmoUI() {
    const lp = this.localPlayer;
    if (!lp) { document.getElementById('ammo-display').textContent = '--/--'; return; }
    const el = document.getElementById('ammo-display');
    if (lp.reloading) {
      const remaining = Math.ceil(Math.max(0, lp.reloadTimer));
      el.textContent = `RELOAD ${remaining}s`;
    } else {
      el.textContent = `${lp.ammo} / ${lp.maxAmmo}`;
    }
  }

  handleMessage(data, conn) {
    if (!data || !data.type) return;
    switch (data.type) {
      case 'join':
        if (this.network.isHost) this._handleJoin(data, conn);
        break;
      case 'welcome':
        this._handleWelcome(data);
        break;
      case 'player_joined':
        this._handlePlayerJoined(data);
        break;
      case 'state':
        this._handleState(data, conn);
        break;
      case 'fire_request':
        if (this.network.isHost) this._handleFireRequest(data, conn);
        break;
      case 'proj_spawn':
        this._handleProjSpawn(data);
        break;
      case 'hit':
        this._handleHit(data);
        break;
      case 'hit_effect':
        this._handleHitEffect(data);
        break;
      case 'explosion':
        this._handleExplosionEffect(data);
        break;
      case 'ammo_update':
        this._handleAmmoUpdate(data);
        break;
      case 'player_correct':
        this._handlePlayerCorrect(data);
        break;
      case 'respawn':
        this._handleRemoteRespawn(data);
        break;
      case 'game_start':
        this._handleGameStart(data);
        break;
      case 'map_select':
        this._handleMapSelect(data);
        break;
      case 'start':
        this.startGame();
        break;
      case 'game_over':
        this._handleGameOver(data);
        break;
      case 'reload_complete':
        if (this.network.isHost && this.hostAuthority) {
          this.hostAuthority.refillAmmo(conn.peer, data.weapon);
        }
        break;
    }
  }

  _handleJoin(data, conn) {
    const peerId = conn.peer;
    const colorIdx = this.players.size % PLAYER_COLORS.length;
    const color = PLAYER_COLORS[colorIdx];
    const name = data.name || 'Player';
    const joiningMidGame = this.gameStarted && !this.gameOver;
    this.addPlayer(peerId, color, name);
    if (joiningMidGame) {
      const half = (this.arenaMap ? this.arenaMap.size : 40) / 2 - 3;
      const p = this.players.get(peerId);
      if (p) {
        p.position.set(
          (Math.random() - 0.5) * half * 2,
          0,
          (Math.random() - 0.5) * half * 2
        );
        p.targetPosition.copy(p.position);
        p.health = CONFIG.maxHealth;
        p.alive = true;
        p.updateMesh();
      }
    }
    this.network.connected = true;
    if (!this.connectionHandled) {
      this.connectionHandled = true;
      this.onConnected();
      this.showWaitingRoom();
    }
    conn.send({
      type: 'welcome',
      players: Array.from(this.players.entries()).map(([id, p]) => ({
        id, name: p.name, color: p.color,
      })),
      yourId: peerId,
      map: this.selectedMap,
      gameStarted: this.gameStarted,
      gameTimer: this.gameTimer,
    });
    this.network.broadcast({ type: 'player_joined', id: peerId, name, color }, conn);
    this.updatePlayerListUI();
    this.addKillFeed(`${name} joined`);
  }

  _handleWelcome(data) {
    this.connectionHandled = true;
    this.onConnected();
    data.players.forEach(p => {
      this.addPlayer(p.id, p.color, p.name);
    });
    this.localId = data.yourId;
    this.selectedMap = data.map || 'grid';
    if (this.localPlayer) {
      this.localPlayer.weapon = this.loadoutWeapon;
      this.localPlayer.lastFireTime = 0;
      this.localPlayer.onReloadComplete = this._onReloadComplete;
      this.localPlayer.refillAmmo();
    }
    if (data.gameStarted) {
      this._createArena(this.selectedMap);
      this.gameStarted = true;
      this.gameOver = false;
      this.gameTimer = data.gameTimer || CONFIG.gameTimeLimit;
      this.network.sendTimer = CONFIG.stateSendRate;
      document.getElementById('overlay').classList.add('hidden');
      document.getElementById('instructions').classList.remove('hidden');
      document.getElementById('result-screen').classList.remove('show');
      document.getElementById('death-screen').classList.remove('show');
      this.updateTimerUI();
      this.addKillFeed('Joined game in progress');
      if (!this.pointerLocked) setTimeout(() => this.renderer.domElement.requestPointerLock(), 300);
    } else {
      this.showWaitingRoom();
      if (data.map) {
        const map = MAPS[data.map] || MAPS.grid;
        document.getElementById('guest-map-name').textContent = `${map.name} — ${map.desc}`;
        this._drawGuestMapPreview(data.map);
      }
    }
  }

  _handlePlayerJoined(data) {
    this.addPlayer(data.id, data.color, data.name);
    this.updatePlayerListUI();
    this.addKillFeed(`${data.name} joined`);
  }

  _handleState(data, conn) {
    const p = this.players.get(data.id);
    if (!p) return;

    if (this.network.isHost && this.cheatValidator && data.id !== this.network.myId) {
      const lastPos = this.cheatValidator.getLastPosition(data.id);
      const dt = 0.05;
      const maxSpeed = CONFIG.dashSpeed || CONFIG.playerSpeed;

      if (!this.cheatValidator.validatePosition(data.pos, lastPos, dt, maxSpeed)) {
        const correctMsg = {
          type: 'player_correct',
          id: data.id,
          pos: { x: lastPos.x, y: 0, z: lastPos.z },
        };
        this.network.sendTo(data.id, correctMsg);
        return;
      }

      if (lastPos) {
        const warpDist = (this.arenaMap ? this.arenaMap.size : 40) * 2;
        if (!this.cheatValidator.validateNoWarp(data.pos, lastPos, warpDist)) {
          const correctMsg = {
            type: 'player_correct',
            id: data.id,
            pos: { x: lastPos.x, y: 0, z: (lastPos.z) },
          };
          this.network.sendTo(data.id, correctMsg);
          return;
        }
      }

      this.cheatValidator.recordPosition(data.id, data.pos, data.timestamp || performance.now());
    }

    p.targetPosition.set(data.pos.x, data.pos.y, data.pos.z);
    p.targetRotation = data.rot;
    if (data.alive !== undefined) p.alive = data.alive;
    if (data.health !== undefined) p.health = data.health;
    if (data.weapon !== undefined) p.weapon = data.weapon;

    if (this.network.isHost) {
      this.network.broadcast(data, this._findConn(data.id));
    }
  }

  _findConn(playerId) {
    return this.network.connections.find(c => c.peer === playerId);
  }

  _handleFireRequest(data, conn) {
    if (!this.hostAuthority || !this.cheatValidator) return;
    const peerId = conn.peer;

    if (!this.cheatValidator.validateTimestamp(data.timestamp || 0, peerId)) return;

    const inputId = data.inputId;
    if (inputId === undefined) return;

    this.hostAuthority.handleFireRequest(data, peerId, peerId + '_' + inputId);
  }

  _handleProjSpawn(data) {
    const origin = new THREE.Vector3(data.pos.x, data.pos.y, data.pos.z);
    const dir = new THREE.Vector3(data.dir.x, data.dir.y, data.dir.z);
    const proj = new Projectile(
      this.scene, origin, dir,
      data.ownerId, data.pid, data.color, data.weapon
    );
    proj.isRemote = true;
    this.projectiles.push(proj);

    const owner = this.players.get(data.ownerId);
    if (owner) {
      this.effectManager.spawnMuzzleFlash(origin, dir, data.color || owner.color);
    }
  }

  _handleHit(data) {
    if (data.targetId === this.network.myId) {
      if (this.invincibleTimer > 0) return;
      const killed = this.localPlayer.takeDamage(data.damage || 1);
      this.updateHealthUI();
      this.cameraEffectManager.hitShake(3);
      this.cameraEffectManager.damageFlash();
      if (this.effectManager) {
        const lp = this.localPlayer;
        if (lp) this.effectManager.spawnPlayerDamageFlash(lp);
      }
      if (killed) {
        this.deaths++;
        document.getElementById('death-count').textContent = this.deaths;
        this.respawnTimer = CONFIG.killCamDuration + CONFIG.respawnDelay;
        this.killCamKillerId = data.shooterId;
        document.getElementById('death-screen').classList.add('show');
        document.getElementById('respawn-timer').textContent = `RESPAWN IN ${Math.ceil(this.respawnTimer)}`;
        if (document.pointerLockElement) document.exitPointerLock();
        const wpName = data.weapon ? (WEAPONS[data.weapon] ? WEAPONS[data.weapon].name : data.weapon) : '';
        this.addKillFeed(`Eliminated by ${data.shooterName || 'opponent'}${wpName ? ' [' + wpName + ']' : ''}`);
      } else {
        this.cameraEffectManager.hitShake(2);
      }
    }
    if (data.lethal) {
      this._trackKill(data.shooterId, data.targetId);
    }
    if (data.lethal && data.targetId !== this.network.myId) {
      const wpName = data.weapon ? (WEAPONS[data.weapon] ? WEAPONS[data.weapon].name : data.weapon) : '';
      this.addKillFeed(`${data.shooterName || 'Someone'} eliminated ${data.targetName || 'opponent'}${wpName ? ' [' + wpName + ']' : ''}`);
    }
    if (this.network.isHost) {
      this.network.broadcast(data, this._findConn(data.shooterId));
    }
  }

  _handleHitEffect(data) {
    if (this.effectManager) {
      this.effectManager.spawnHitEffect(
        new THREE.Vector3(data.pos.x, data.pos.y, data.pos.z),
        data.color || 0xffffff
      );
    }
  }

  _handleExplosionEffect(data) {
    if (this.effectManager) {
      this.effectManager.spawnExplosion(
        new THREE.Vector3(data.pos.x, data.pos.y, data.pos.z),
        data.color || 0xff4400
      );
    }
    this.cameraEffectManager.explosionShake(8);

    const dist = this.localPlayer
      ? new THREE.Vector3(data.pos.x, data.pos.y, data.pos.z).distanceTo(
          new THREE.Vector3(this.localPlayer.position.x, 0, this.localPlayer.position.z)
        )
      : Infinity;
    if (dist < 15) {
      this.cameraEffectManager.explosionShake(12 - dist * 0.5);
    }
  }

  _handleAmmoUpdate(data) {
    const lp = this.localPlayer;
    if (!lp) return;
    if (lp.weapon === data.weapon) {
      lp.ammo = data.ammo;
      lp.maxAmmo = data.maxAmmo || lp.maxAmmo;
      this.updateAmmoUI();
    }
  }

  _handlePlayerCorrect(data) {
    const p = this.players.get(data.id);
    if (p && data.id === this.network.myId) {
      p.position.set(data.pos.x, data.pos.y, data.pos.z);
      p.targetPosition.copy(p.position);
    }
  }

  _handleRemoteRespawn(data) {
    const p = this.players.get(data.id);
    if (p) {
      p.health = CONFIG.maxHealth;
      p.alive = true;
      if (data.pos) {
        p.position.set(data.pos.x, data.pos.y, data.pos.z);
        p.targetPosition.copy(p.position);
      } else {
        p.spawn();
      }
      p.updateMesh();
    }
    if (this.effectManager && data.pos) {
      this.effectManager.spawnRespawnEffect(
        new THREE.Vector3(data.pos.x, 0.5, data.pos.z),
        p ? p.color : 0x00f0ff
      );
    }
    if (this.network.isHost) {
      this.network.broadcast(data, this._findConn(data.id));
    }
  }

  _handleGameStart(data) {
    this.selectedMap = data.map;
    this._createArena(data.map);
    this.startGame();
  }

  _handleMapSelect(data) {
    if (!this.network.isHost) {
      this.selectedMap = data.map;
      const map = MAPS[data.map] || MAPS.grid;
      document.getElementById('guest-map-name').textContent = `${map.name} — ${map.desc}`;
      this._drawGuestMapPreview(data.map);
    }
  }

  _handleGameOver(data) {
    if (data.scoreboard) {
      this.players.forEach((p, id) => {
        const entry = data.scoreboard.find(s => s.id === id);
        if (entry) { p.kills = entry.kills; p.deaths = entry.deaths; }
      });
    }
    this.gameStarted = false;
    this.showResultScreen();
  }

  updateHealthUI() {
    const lp = this.localPlayer;
    if (!lp) return;
    const pct = (lp.health / lp.maxHealth) * 100;
    const bar = document.getElementById('health-bar');
    bar.style.width = pct + '%';
    bar.classList.toggle('low', pct <= 30);
  }

  update(dt) {
    if (!this.gameStarted || this.gameOver) return;
    const lp = this.localPlayer;

    if (lp && lp.alive) {
      let mx = 0, mz = 0;
      if (this.keys['w']) mz -= 1;
      if (this.keys['s']) mz += 1;
      if (this.keys['a']) mx -= 1;
      if (this.keys['d']) mx += 1;

      this.dashCooldown = Math.max(0, this.dashCooldown - dt);

      let isDashing = false;
      if (mx !== 0 || mz !== 0) {
        const len = Math.sqrt(mx * mx + mz * mz);
        mx /= len; mz /= len;
        const fwd = new THREE.Vector3(0, 0, -1)
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), lp.rotation);
        const right = new THREE.Vector3(1, 0, 0)
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), lp.rotation);
        _v3.copy(fwd).multiplyScalar(-mz);
        _v3b.copy(right).multiplyScalar(mx);
        _v3.add(_v3b).normalize();

        if (this.keys['shift'] && this.dashCooldown <= 0 && this.dashTimer <= 0) {
          this.dashTimer = CONFIG.dashDuration;
          this.dashCooldown = CONFIG.dashCooldown;
          isDashing = true;
          this.dashTriggered = true;
          if (this.effectManager) {
            this.effectManager.spawnDashEffect(lp.position, _v3);
          }
          if (this.cameraEffectManager) {
            this.cameraEffectManager.dashFov();
          }
        }

        let speed = CONFIG.playerSpeed;
        if (this.dashTimer > 0) {
          speed = CONFIG.dashSpeed;
          this.dashTimer -= dt;
          if (this.dashTimer <= 0) {
            this.dashTimer = 0;
            if (this.effectManager) {
              this.effectManager.spawnLandingEffect(lp.position);
            }
          }
        }
        if (this.arenaMap && this.arenaMap.pads) {
          const pHalf = CONFIG.playerSize * 0.3;
          let onPad = false;
          for (const pad of this.arenaMap.pads) {
            const px = pad.p[0], pz = pad.p[2];
            const hx = pad.s[0] / 2 + pHalf, hz = pad.s[2] / 2 + pHalf;
            if (Math.abs(lp.position.x - px) < hx && Math.abs(lp.position.z - pz) < hz) {
              onPad = true;
              if (!this._lastOnPad) {
                if (this.effectManager) {
                  this.effectManager.spawnJumpPadEffect(
                    new THREE.Vector3(px, 0.1, pz),
                    pad.speed === 0 ? 0xff00ff : 0x00f0ff
                  );
                }
              }
              if (pad.speed > 0 && pad.speed !== 1) {
                speed *= pad.speed;
              }
              if (pad.speed === 0 && this.arenaMap.teleport && this.teleportCooldown <= 0) {
                lp.position.set(this.arenaMap.teleport.x, 0, this.arenaMap.teleport.z);
                this.teleportCooldown = 1.5;
                this.addKillFeed('Teleported!');
              }
            }
          }
          this._lastOnPad = onPad;
        }

        _v3.multiplyScalar(speed * dt);
        lp.position.x += _v3.x;
        lp.position.z += _v3.z;
        const half = (this.arenaMap ? this.arenaMap.size : 40) / 2 - 0.8;
        lp.position.x = Math.max(-half, Math.min(half, lp.position.x));
        lp.position.z = Math.max(-half, Math.min(half, lp.position.z));
        this._checkWallCollision(lp.position);
        lp.targetPosition.copy(lp.position);
      }

      if (this.mouseDelta !== 0) {
        lp.rotation -= this.mouseDelta * 0.003;
        lp.targetRotation = lp.rotation;
        this.mouseDelta = 0;
      }

      if (this.network.isHost && this.effectManager && this.dashTriggered) {
        this.dashTriggered = false;
      }

      const wp = WEAPONS[lp.weapon];
      if (this.mouseDown && this.pointerLocked) {
        const now = Date.now();
        if (now - lp.lastFireTime > wp.fireRate * 1000) {
          lp.lastFireTime = now;
          this.shoot();
        }
      }
    }

    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= dt;
      if (lp && lp.alive) {
        const blink = Math.sin(this.invincibleTimer * 20) > 0;
        lp.mesh.material.transparent = true;
        lp.mesh.material.opacity = blink ? 0.3 : 1;
        lp.edgeLine.material.opacity = blink ? 0.1 : 0.4;
      }
      if (this.invincibleTimer <= 0 && lp) {
        lp.mesh.material.transparent = false;
        lp.mesh.material.opacity = 1;
        lp.edgeLine.material.opacity = 0.4;
      }
    }

    if (lp && lp.reloading) this.updateAmmoUI();
    if (this.teleportCooldown > 0) this.teleportCooldown -= dt;

    this.players.forEach(p => {
      if (p.id !== this.network.myId) p.lerpToTarget(dt);
      p.update(dt);
    });

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p.alive) { this.projectiles.splice(i, 1); continue; }
      p.update(dt);
    }

    if (this.effectManager) {
      this.effectManager.update(dt);
    }

    if (this.hostAuthority && this.network.isHost) {
      this.hostAuthority.handleHostProjectiles(dt);
    }

    if (this.respawnTimer > 0) {
      this.respawnTimer -= dt;
      const remaining = Math.ceil(Math.max(0, this.respawnTimer));
      document.getElementById('respawn-timer').textContent = `RESPAWN IN ${remaining}`;
      if (this.respawnTimer <= CONFIG.killCamDuration) {
        this.killCamKillerId = null;
      }
      if (this.respawnTimer <= 0) {
        this.respawnTimer = 0;
        this.killCamKillerId = null;
        document.getElementById('death-screen').classList.remove('show');
        this.mouseDown = false;
        this.dashTimer = 0;
        this.dashCooldown = 0;
        this.killStreak = 0;
        this._respawnLocal();
      }
    }

    this.gameTimer -= dt;
    this.updateTimerUI();
    if (this.gameTimer <= 0) {
      this.gameTimer = 0;
      this.endGame();
    }

    this.network.sendState(dt);
    this._updateCamera(dt);
  }

  _respawnLocal() {
    const lp = this.localPlayer;
    if (!lp) return;
    const half = (this.arenaMap ? this.arenaMap.size : 40) / 2 - 3;
    const spawnPos = new THREE.Vector3(
      (Math.random() - 0.5) * half * 2,
      0,
      (Math.random() - 0.5) * half * 2
    );
    lp.position.copy(spawnPos);
    lp.targetPosition.copy(spawnPos);
    lp.health = CONFIG.maxHealth;
    lp.alive = true;
    this.mouseDown = false;
    this.invincibleTimer = CONFIG.invincibleTime;
    lp.onReloadComplete = this._onReloadComplete;
    lp.refillAmmo();
    this.updateAmmoUI();
    this.updateHealthUI();
    this.killCountThisLife = 0;
    this.addKillFeed('Respawned');
    if (this.effectManager) {
      this.effectManager.spawnRespawnEffect(spawnPos, lp.color);
    }
    const msg = {
      type: 'respawn',
      id: this.network.myId,
      pos: { x: spawnPos.x, y: 0, z: spawnPos.z },
    };
    if (this.network.isHost) this.network.broadcast(msg);
    else this.network.send(msg);
  }

  _updateCamera(dt) {
    const effectiveDt = this.cameraEffectManager
      ? this.cameraEffectManager.update(dt)
      : dt;

    if (this.respawnTimer > CONFIG.respawnDelay && this.killCamKillerId) {
      const killer = this.players.get(this.killCamKillerId);
      if (killer && killer.alive) {
        const p = killer.position;
        const target = new THREE.Vector3(p.x + 8, p.y + 10, p.z + 8);
        this.camera.position.lerp(target, 1 - Math.exp(-6 * effectiveDt));
        this.camera.lookAt(p.x, 0.5, p.z);
        return;
      }
    }
    const lp = this.localPlayer;
    if (!lp) return;
    const p = lp.position;
    const dist = 18, height = 14, angle = lp.rotation;
    const target = new THREE.Vector3(
      p.x + Math.sin(angle) * dist,
      p.y + height,
      p.z + Math.cos(angle) * dist
    );
    this.camera.position.lerp(target, 1 - Math.exp(-8 * effectiveDt));
    this.camera.lookAt(p.x, 0.5, p.z);

    if (this.cameraEffectManager && this.cameraEffectManager.getRedFlash() > 0) {
      const redOverlay = document.getElementById('damage-overlay') || (() => {
        const el = document.createElement('div');
        el.id = 'damage-overlay';
        el.style.cssText = `
          position:fixed;top:0;left:0;width:100%;height:100%;
          pointer-events:none;z-index:55;
          background:radial-gradient(ellipse at center, transparent 50%, rgba(255,0,0,0.3) 100%);
          opacity:0;
          transition:opacity 0.05s;
        `;
        document.body.appendChild(el);
        return el;
      })();
      redOverlay.style.opacity = Math.min(1, this.cameraEffectManager.getRedFlash() * 2);
    } else {
      const redOverlay = document.getElementById('damage-overlay');
      if (redOverlay) redOverlay.style.opacity = '0';
    }
  }

  _trackKill(shooterId, targetId) {
    if (!this.scoreboard.has(shooterId)) {
      const p = this.players.get(shooterId);
      this.scoreboard.set(shooterId, {
        kills: 0, deaths: 0, name: p ? p.name : '?', color: p ? p.color : 0xffffff,
      });
    }
    if (!this.scoreboard.has(targetId)) {
      const p = this.players.get(targetId);
      this.scoreboard.set(targetId, {
        kills: 0, deaths: 0, name: p ? p.name : '?', color: p ? p.color : 0xffffff,
      });
    }
    this.scoreboard.get(shooterId).kills++;
    this.scoreboard.get(targetId).deaths++;
    const shooter = this.players.get(shooterId);
    if (shooter) shooter.kills++;
    const target = this.players.get(targetId);
    if (target) target.deaths++;

    if (shooterId === this.network.myId) {
      this.kills++;
      document.getElementById('kill-count').textContent = this.kills;
      this.cameraEffectManager.killSlowMo();
      this.cameraEffectManager.hitShake(5);

      this.killStreak++;
      this.killCountThisLife++;

      const now = performance.now();
      if (now - this.lastKillTime < 2000) {
        this.multiKillTimer += 1;
      } else {
        this.multiKillTimer = 1;
      }
      this.lastKillTime = now;

      let killText = 'KILL';
      if (this.multiKillTimer >= 5) killText = 'MULTI KILL';
      else if (this.multiKillTimer >= 3) killText = 'TRIPLE KILL';
      else if (this.multiKillTimer >= 2) killText = 'DOUBLE KILL';
      if (this.killStreak >= 5) killText = 'RAMPAGE';

      this.showKillMessage(killText);

      if (this.effectManager && targetId) {
        const target = this.players.get(targetId);
        if (target) {
          this.effectManager.spawnKillEffect(target.position);
        }
      }

      if (this.hostAuthority && this.network.isHost) {
        this.hostAuthority.refillAmmo(shooterId, this.localPlayer ? this.localPlayer.weapon : 'pistol');
      }
    }
  }

  _checkWallCollision(pos) {
    const map = this.arenaMap;
    if (!map || !map.walls || map.walls.length === 0) return;
    const pHalf = CONFIG.playerSize * 0.4;
    for (const w of map.walls) {
      const wx = w.p[0], wz = w.p[2];
      const wHalfX = w.s[0] / 2 + pHalf;
      const wHalfZ = w.s[2] / 2 + pHalf;
      const dx = pos.x - wx;
      const dz = pos.z - wz;
      const overlapX = wHalfX - Math.abs(dx);
      const overlapZ = wHalfZ - Math.abs(dz);
      if (overlapX > 0 && overlapZ > 0) {
        if (overlapX < overlapZ) {
          pos.x += dx > 0 ? overlapX : -overlapX;
        } else {
          pos.z += dz > 0 ? overlapZ : -overlapZ;
        }
      }
    }
  }

  updateTimerUI() {
    const remaining = Math.max(0, Math.ceil(this.gameTimer));
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const el = document.getElementById('timer-display');
    el.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    el.classList.toggle('urgent', remaining <= 10);
  }

  showResultScreen() {
    this.gameOver = true;
    document.getElementById('timer-display').textContent = '--:--';
    document.getElementById('death-screen').classList.remove('show');
    this.respawnTimer = 0;
    const sb = [];
    this.players.forEach((p, id) => {
      sb.push({ id, name: p.name, kills: p.kills, deaths: p.deaths, color: p.color });
    });
    if (sb.length === 0) {
      this.scoreboard.forEach((entry, id) => {
        sb.push({ id, name: entry.name, kills: entry.kills, deaths: entry.deaths, color: entry.color });
      });
    }
    sb.sort((a, b) => b.kills - a.kills);
    document.getElementById('result-screen').classList.add('show');
    const winnerEl = document.getElementById('result-winner');
    if (sb.length > 0 && sb[0].kills > 0) {
      winnerEl.textContent = `WINNER: ${sb[0].name} \u2014 ${sb[0].kills} KILLS`;
    } else {
      winnerEl.textContent = 'NO WINNER';
    }
    const list = document.getElementById('result-list');
    list.innerHTML = '';
    sb.forEach((entry, i) => {
      const div = document.createElement('div');
      div.className = 'result-entry' + (i === 0 && entry.kills > 0 ? ' winner' : '');
      const rank = document.createElement('span');
      rank.className = 'r-rank';
      rank.textContent = '#' + (i + 1);
      const dot = document.createElement('span');
      dot.className = 'r-dot';
      dot.style.background = '#' + entry.color.toString(16).padStart(6, '0');
      const name = document.createElement('span');
      name.className = 'r-name';
      name.textContent = entry.name + (entry.id === this.network.myId ? ' (YOU)' : '');
      const kills = document.createElement('span');
      kills.className = 'r-kills';
      kills.textContent = entry.kills + ' K';
      const deaths = document.createElement('span');
      deaths.className = 'r-deaths';
      deaths.textContent = entry.deaths + ' D';
      div.appendChild(rank);
      div.appendChild(dot);
      div.appendChild(name);
      div.appendChild(kills);
      div.appendChild(deaths);
      list.appendChild(div);
    });
  }

  endGame() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.gameStarted = false;
    if (this.network.isHost) {
      const sb = [];
      this.players.forEach((p, id) => {
        sb.push({ id, name: p.name, kills: p.kills, deaths: p.deaths, color: p.color });
      });
      this.network.broadcast({ type: 'game_over', scoreboard: sb });
    }
    this.showResultScreen();
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    let dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.cameraEffectManager && this.cameraEffectManager.isSlowMo()) {
      dt *= 0.05;
    }

    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
