/* ============================================================
   NEON ARENA - メインゲームクラス
   GameStateによる状態管理、ゲームループ、全ゲームロジック
   ============================================================ */

class Game {
  constructor() {
    this.players = new Map();
    this.localId = null;
    this.projectiles = [];
    this.remoteProjIdCounter = 0;
    this.keys = {};
    this.mouseDelta = 0;
    this.network = new NetworkManager(this);
    this.gameState = GameState.TITLE;
    this.gameStarted = false;
    this.gameOver = false;
    this.connectionHandled = false;
    this.kills = 0;
    this.deaths = 0;
    this.respawnTimer = 0;
    this.respawnCountdownValue = 0;
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
    this.killCamKillerName = '';
    this.killCamWeapon = '';
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
    this.countdownValue = 0;
    this.countdownTimer = 0;
    this.resultTimer = 0;
    this.isHost = false;
    this.clientReady = new Map();
    this.clientWeapons = new Map();

    this.cheatValidator = null;
    this.hostAuthority = null;
    this.hitValidator = null;
    this.effectManager = null;
    this.cameraEffectManager = null;
  }

  get localPlayer() { return this.players.get(this.localId); }

  /* ----------------------------------------------------------
     GameState管理
     ---------------------------------------------------------- */
  setState(newState) {
    if (this.gameState === newState) return;
    const prev = this.gameState;
    this.gameState = newState;
    this._onStateChange(prev, newState);
  }

  _onStateChange(prev, next) {
    this._hideAllScreens();
    switch (next) {
      case GameState.TITLE:
        document.getElementById('title-screen').style.display = '';
        this._clearGameWorld();
        break;
      case GameState.LOBBY:
        document.getElementById('lobby-screen').style.display = '';
        this._updateLobbyRoomID();
        this._updateLobbyUI();
        break;
      case GameState.COUNTDOWN:
        this._startCountdown();
        break;
      case GameState.PLAYING:
        document.getElementById('hud').style.display = '';
        document.getElementById('instructions').classList.remove('hidden');
        break;
      case GameState.RESULT:
        document.getElementById('result-screen').classList.add('show');
        document.getElementById('hud').style.display = 'none';
        document.getElementById('instructions').classList.add('hidden');
        document.getElementById('death-screen').classList.remove('show');
        break;
    }
  }

  _hideAllScreens() {
    document.getElementById('title-screen').style.display = 'none';
    document.getElementById('lobby-screen').style.display = 'none';
    document.getElementById('countdown-overlay').style.display = 'none';
    document.getElementById('hud').style.display = 'none';
    document.getElementById('instructions').classList.add('hidden');
    document.getElementById('death-screen').classList.remove('show');
    document.getElementById('result-screen').classList.remove('show');
  }

  /* ----------------------------------------------------------
     初期化
     ---------------------------------------------------------- */
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
    this._setupInputEvents();
    this._setupLights();
    this._createArena(this.selectedMap);
    this.setState(GameState.TITLE);
    this.animate();
  }

  _setupInputEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
      document.getElementById('instructions').classList.toggle('hidden',
        !this.pointerLocked || this.respawnTimer > 0);
    });
    document.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) this.mouseDelta += e.movementX;
    });
    document.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      if (e.key.toLowerCase() === 'r' && this.gameState === GameState.PLAYING) this.reload();
    });
    document.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
    this.renderer.domElement.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouseDown = true;
    });
    this.renderer.domElement.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    this.renderer.domElement.addEventListener('click', () => {
      if (this.network.connected && !this.pointerLocked &&
          this.gameState === GameState.PLAYING && !(this.respawnTimer > 0)) {
        this.renderer.domElement.requestPointerLock();
      }
    });
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

  _clearGameWorld() {
    this.players.forEach(p => p.destroy());
    this.players.clear();
    this.projectiles.forEach(p => p.destroy());
    this.projectiles = [];
    if (this.hostAuthority) this.hostAuthority.reset();
    if (this.effectManager) this.effectManager.clear();
    document.getElementById('kill-feed').innerHTML = '';
    document.getElementById('kill-count').textContent = '0';
    document.getElementById('death-count').textContent = '0';
    this.kills = 0;
    this.deaths = 0;
    this.killStreak = 0;
    this.multiKillTimer = 0;
    this.lastKillTime = 0;
    this.killCountThisLife = 0;
    this.gameTimer = CONFIG.gameTimeLimit;
    this.respawnTimer = 0;
    this.invincibleTimer = 0;
  }

  /* ----------------------------------------------------------
     プレイヤー管理
     ---------------------------------------------------------- */
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
  }

  onPlayerLeft(peerId) {
    this.removePlayer(peerId);
    this.clientReady.delete(peerId);
    this.clientWeapons.delete(peerId);
    if (this.gameState === GameState.LOBBY) {
      this._updateLobbyUI();
      if (this.network.isHost) this._syncLobbyState();
    }
  }

  onDisconnected() {
    this.addKillFeed('Connection lost');
  }

  /* ----------------------------------------------------------
     ネットワークメッセージ処理
     ---------------------------------------------------------- */
  handleMessage(data, conn) {
    if (!data || !data.type) return;
    switch (data.type) {
      case 'join': if (this.network.isHost) this._handleJoin(data, conn); break;
      case 'welcome': this._handleWelcome(data); break;
      case 'player_joined': this._handlePlayerJoined(data); break;
      case 'state': this._handleState(data, conn); break;
      case 'fire_request': if (this.network.isHost) this._handleFireRequest(data, conn); break;
      case 'proj_spawn': this._handleProjSpawn(data); break;
      case 'hit': this._handleHit(data); break;
      case 'hit_effect': this._handleHitEffect(data); break;
      case 'explosion': this._handleExplosionEffect(data); break;
      case 'ammo_update': this._handleAmmoUpdate(data); break;
      case 'player_correct': this._handlePlayerCorrect(data); break;
      case 'respawn': this._handleRemoteRespawn(data); break;
      case 'game_start': this._handleGameStart(data); break;
      case 'map_select': this._handleMapSelect(data); break;
      case 'game_over': this._handleGameOver(data); break;
      case 'reload_complete':
        if (this.network.isHost && this.hostAuthority) {
          this.hostAuthority.refillAmmo(conn.peer, data.weapon);
        }
        break;
      /* 新規メッセージ */
      case 'ready': if (this.network.isHost) this._handleReady(data, conn); break;
      case 'weapon_change': this._handleWeaponChange(data, conn); break;
      case 'name_change': this._handleNameChange(data, conn); break;
      case 'lobby_state': this._handleLobbyState(data); break;
      case 'countdown_sync': this._handleCountdownSync(data); break;
      case 'game_timer': this._handleGameTimerSync(data); break;
      case 'result_sync': this._handleResultSync(data); break;
      case 'return_lobby': this._handleReturnLobby(data); break;
    }
  }

  /* ---- 既存メッセージ ---- */
  _handleJoin(data, conn) {
    const peerId = conn.peer;
    const colorIdx = this.players.size % PLAYER_COLORS.length;
    const color = PLAYER_COLORS[colorIdx];
    const name = data.name || 'Player';
    this.addPlayer(peerId, color, name);
    this.clientReady.set(peerId, false);
    this.clientWeapons.set(peerId, 'pistol');
    this.network.connected = true;
    if (!this.connectionHandled) {
      this.connectionHandled = true;
      this.onConnected();
    }
    conn.send({
      type: 'welcome',
      players: Array.from(this.players.entries()).map(([id, p]) => ({
        id, name: p.name, color: p.color, weapon: this.clientWeapons.get(id) || 'pistol',
        ready: id === this.network.myId ? true : (this.clientReady.get(id) || false),
      })),
      yourId: peerId,
      map: this.selectedMap,
    });
    this.network.broadcast({ type: 'player_joined', id: peerId, name, color,
      weapon: 'pistol', ready: false }, conn);
    this._updateLobbyUI();
    this._syncLobbyState();
  }

  _handleWelcome(data) {
    this.connectionHandled = true;
    this.onConnected();
    data.players.forEach(p => {
      this.addPlayer(p.id, p.color, p.name);
      this.clientWeapons.set(p.id, p.weapon || 'pistol');
      this.clientReady.set(p.id, p.ready || false);
    });
    this.localId = data.yourId;
    this.selectedMap = data.map || 'grid';
    if (this.localPlayer) {
      this.localPlayer.weapon = this.loadoutWeapon;
      this.localPlayer.lastFireTime = 0;
      this.localPlayer.onReloadComplete = this._onReloadComplete;
      this.localPlayer.refillAmmo();
    }
    this._createArena(this.selectedMap);
    this.setState(GameState.LOBBY);
  }

  _handlePlayerJoined(data) {
    this.addPlayer(data.id, data.color, data.name);
    this.clientReady.set(data.id, data.ready !== undefined ? data.ready : false);
    this.clientWeapons.set(data.id, data.weapon || 'pistol');
    this._updateLobbyUI();
    this.addKillFeed(`${data.name} joined`);
  }

  _handleState(data, conn) {
    const p = this.players.get(data.id);
    if (!p) return;
    if (this.network.isHost && this.cheatValidator && data.id !== this.network.myId) {
      if (!this._validatePlayerState(data, conn)) return;
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

  _validatePlayerState(data, conn) {
    const peerId = conn.peer;
    const lastPos = this.cheatValidator.getLastPosition(peerId);
    const dt = 0.05;
    const maxSpeed = CONFIG.dashSpeed || CONFIG.playerSpeed;
    if (!this.cheatValidator.validatePosition(data.pos, lastPos, dt, maxSpeed)) {
      if (lastPos) {
        this.network.sendTo(peerId, {
          type: 'player_correct', id: peerId,
          pos: { x: lastPos.x, y: 0, z: lastPos.z },
        });
      }
      return false;
    }
    if (lastPos) {
      const warpDist = (this.arenaMap ? this.arenaMap.size : 40) * 2;
      if (!this.cheatValidator.validateNoWarp(data.pos, lastPos, warpDist)) {
        this.network.sendTo(peerId, {
          type: 'player_correct', id: peerId,
          pos: { x: lastPos.x, y: 0, z: lastPos.z },
        });
        return false;
      }
    }
    this.cheatValidator.recordPosition(peerId, data.pos, data.timestamp || performance.now());
    return true;
  }

  _findConn(playerId) {
    return this.network.connections.find(c => c.peer === playerId);
  }

  _handleFireRequest(data, conn) {
    if (!this.hostAuthority || !this.cheatValidator) return;
    const peerId = conn.peer;
    if (!this.cheatValidator.validateTimestamp(data.timestamp || 0, peerId)) return;
    if (data.inputId === undefined) return;
    this.hostAuthority.handleFireRequest(data, peerId, peerId + '_' + data.inputId);
  }

  _handleProjSpawn(data) {
    const origin = new THREE.Vector3(data.pos.x, data.pos.y, data.pos.z);
    const dir = new THREE.Vector3(data.dir.x, data.dir.y, data.dir.z);
    const proj = new Projectile(this.scene, origin, dir,
      data.ownerId, data.pid, data.color, data.weapon);
    proj.isRemote = true;
    this.projectiles.push(proj);
    const owner = this.players.get(data.ownerId);
    if (owner) {
      this.effectManager.spawnMuzzleFlash(origin, dir, data.color || owner.color);
    }
  }

  _applyLocalHitEffects(data) {
    if (this.invincibleTimer > 0 || !this.localPlayer) return;
    this.cameraEffectManager.hitShake(3);
    this.cameraEffectManager.damageFlash();
    this.updateHealthUI();
    if (this.effectManager) {
      this.effectManager.spawnPlayerDamageFlash(this.localPlayer);
    }
    if (data.lethal) {
      this.deaths++;
      document.getElementById('death-count').textContent = this.deaths;
      this._showDeathScreen(data);
    }
  }

  _showDeathScreen(data) {
    this.respawnTimer = 3;
    this.respawnCountdownValue = 3;
    this.killCamKillerId = data.shooterId;
    this.killCamKillerName = data.shooterName || 'Unknown';
    this.killCamWeapon = data.weapon ? (WEAPONS[data.weapon] ? WEAPONS[data.weapon].name : data.weapon) : '';
    document.getElementById('death-screen').classList.add('show');
    document.getElementById('death-killer-name').textContent = `Killed By ${this.killCamKillerName}`;
    document.getElementById('death-weapon-name').textContent = this.killCamWeapon;
    document.getElementById('respawn-countdown').textContent = '3';
    this._highlightDeathWeapon(this.loadoutWeapon);
    if (document.pointerLockElement) document.exitPointerLock();
  }

  _highlightDeathWeapon(weapon) {
    document.querySelectorAll('#death-weapon-btns .map-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.weapon === weapon);
    });
  }

  _handleHit(data) {
    if (data.targetId === this.network.myId) {
      if (this.invincibleTimer > 0) return;
      const killed = this.localPlayer.takeDamage(data.damage || 1);
      data.lethal = killed;
      this._applyLocalHitEffects(data);
    }
    if (data.lethal) {
      this._trackKill(data.shooterId, data.targetId);
    }
    this._addKillFeedMessage(data);
    if (this.network.isHost) {
      this.network.broadcast(data, this._findConn(data.shooterId));
    }
  }

  _addKillFeedMessage(data) {
    if (data.targetId === this.network.myId) return;
    if (!data.lethal) return;
    const weaponName = data.weapon ? (WEAPONS[data.weapon] ? WEAPONS[data.weapon].name : data.weapon) : '';
    const el = document.createElement('div');
    el.className = 'kill-msg';
    el.innerHTML = `<span class="killer">${this._escapeHtml(data.shooterName || '?')}</span>` +
      `<span class="weapon-icon">${weaponName}</span>` +
      `<span class="victim">${this._escapeHtml(data.targetName || '?')}</span>`;
    document.getElementById('kill-feed').appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 3000);
  }

  _escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
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
    this.setState(GameState.COUNTDOWN);
  }

  _handleMapSelect(data) {
    this.selectedMap = data.map;
    if (this.gameState === GameState.LOBBY) {
      this._updateLobbyUI();
    }
  }

  _handleGameOver(data) {
    this.gameStarted = false;
    this.gameOver = true;
    if (data.scoreboard) {
      this.players.forEach((p, id) => {
        const entry = data.scoreboard.find(s => s.id === id);
        if (entry) { p.kills = entry.kills; p.deaths = entry.deaths; }
      });
    }
    this._showResultScreen(data.scoreboard);
  }

  /* ---- 新規メッセージ ---- */
  _handleReady(data, conn) {
    const peerId = conn.peer;
    this.clientReady.set(peerId, !!data.ready);
    if (this.gameState === GameState.LOBBY) {
      this._updateLobbyUI();
      this._syncLobbyState();
    }
  }

  _handleWeaponChange(data, conn) {
    const peerId = this.network.isHost ? conn.peer : data.id;
    this.clientWeapons.set(peerId, data.weapon);
    if (peerId === this.localId) {
      this.loadoutWeapon = data.weapon;
      if (this.localPlayer) this.localPlayer.weapon = data.weapon;
    }
    if (this.gameState === GameState.LOBBY) this._updateLobbyUI();
    if (this.network.isHost) {
      this._syncLobbyState();
    }
  }

  _handleNameChange(data, conn) {
    const peerId = this.network.isHost ? conn.peer : data.id;
    const p = this.players.get(peerId);
    if (p) p.name = data.name;
    if (this.network.isHost) {
      this.network.broadcast({ type: 'name_change', id: peerId, name: data.name }, conn);
      this._syncLobbyState();
    }
    if (this.gameState === GameState.LOBBY) this._updateLobbyUI();
  }

  _handleLobbyState(data) {
    this.selectedMap = data.map;
    if (data.players) {
      data.players.forEach(p => {
        this.clientReady.set(p.id, p.ready);
        this.clientWeapons.set(p.id, p.weapon);
        const player = this.players.get(p.id);
        if (player && p.name) player.name = p.name;
      });
    }
    this._updateLobbyUI();
  }

  _handleCountdownSync(data) {
    if (this.gameState !== GameState.COUNTDOWN) return;
    this.countdownValue = data.value;
    this.countdownTimer = 0;
    if (this.countdownValue > 0) {
      this._showCountdownNumber(this.countdownValue);
    } else if (this.countdownValue === 0) {
      this._showCountdownNumber(0);
    } else {
      document.getElementById('countdown-overlay').style.display = 'none';
      this._startMatch();
    }
  }

  _handleGameTimerSync(data) {
    this.gameTimer = data.time;
  }

  _handleResultSync(data) {
    this._showResultScreen(data.scoreboard);
  }

  _handleReturnLobby(data) {
    this._returnToLobby();
  }

  /* ----------------------------------------------------------
     ロビー機能
     ---------------------------------------------------------- */
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
      this._updateLobbyUI();
      this._syncLobbyState();
      this.network.broadcast({ type: 'map_select', map: this.selectedMap });
    });
    const mapNameEl = document.createElement('span');
    mapNameEl.className = 'map-nav-name';
    mapNameEl.id = 'map-nav-name';
    const mapObj = MAPS[this.selectedMap];
    mapNameEl.textContent = mapObj ? `${mapObj.name} — ${mapObj.desc}` : this.selectedMap;
    const nextBtn = document.createElement('button');
    nextBtn.className = 'map-nav-btn';
    nextBtn.textContent = '▶';
    nextBtn.addEventListener('click', () => {
      const idx = mapKeys.indexOf(this.selectedMap);
      this.selectedMap = mapKeys[(idx + 1) % mapKeys.length];
      this._updateLobbyUI();
      this._syncLobbyState();
      this.network.broadcast({ type: 'map_select', map: this.selectedMap });
    });
    container.appendChild(prevBtn);
    container.appendChild(mapNameEl);
    container.appendChild(nextBtn);
  }

  _updateLobbyRoomID() {
    const roomId = this.network.roomId;
    const el = document.getElementById('lobby-room-id');
    const roleEl = document.getElementById('lobby-room-role');
    if (!el) return;
    if (roomId) {
      el.textContent = roomId;
    } else {
      el.textContent = this.network.isHost ? 'Creating...' : 'Connecting...';
    }
    if (roleEl) {
      roleEl.textContent = this.network.isHost ? 'Host' : 'Joined Room';
    }
  }

  _updateLobbyUI() {
    const isHost = this.network.isHost;
    document.getElementById('lobby-controls-host').style.display = isHost ? '' : 'none';
    document.getElementById('lobby-controls-client').style.display = isHost ? 'none' : '';
    if (isHost) {
      this._setupMapSelector();
    }
    this._renderPlayerList();
    this._updateStartButton();
    this._updateLobbyWeaponHighlight();
    this._drawMapPreviews();
  }

  _drawMapPreviews() {
    this._drawMapPreview(this.selectedMap);
    this._drawGuestMapPreview(this.selectedMap);
  }

  _drawMapPreview(mapKey) {
    const canvas = document.getElementById('map-preview-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const map = MAPS[mapKey] || MAPS.grid;
    const W = canvas.width, H = canvas.height;
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
    const W = canvas.width, H = canvas.height;
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
    const nameEl = document.getElementById('guest-map-name');
    if (nameEl) nameEl.textContent = `${map.name} — ${map.desc}`;
  }

  _updateLobbyWeaponHighlight() {
    const wp = this.loadoutWeapon;
    document.querySelectorAll('#lobby-weapon-btns .map-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.weapon === wp);
    });
  }

  _renderPlayerList() {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    const isHost = this.network.isHost;
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
      const weapon = document.createElement('span');
      weapon.className = 'pl-weapon';
      weapon.textContent = WEAPONS[this.clientWeapons.get(id) || 'pistol'].name;
      const readyEl = document.createElement('span');
      let isReady = false;
      if (id === this.network.roomId) {
        isReady = true;
        readyEl.className = 'pl-ready';
        readyEl.textContent = 'HOST';
      } else if (id === this.network.myId) {
        isReady = document.getElementById('btn-ready') && document.getElementById('btn-ready').dataset.ready === 'true';
        readyEl.className = isReady ? 'pl-ready' : 'pl-notready';
        readyEl.textContent = isReady ? 'READY' : 'WAIT';
      } else {
        isReady = this.clientReady.get(id) || false;
        readyEl.className = isReady ? 'pl-ready' : 'pl-notready';
        readyEl.textContent = isReady ? 'READY' : 'WAIT';
      }
      const tag = document.createElement('span');
      tag.className = 'pl-tag';
      if (id === this.network.roomId || (isHost && id === this.network.myId)) {
        tag.textContent = 'HOST'; tag.classList.add('host');
      } else if (id === this.network.myId) {
        tag.textContent = 'YOU'; tag.classList.add('you');
      }
      entry.appendChild(dot);
      entry.appendChild(name);
      entry.appendChild(weapon);
      entry.appendChild(readyEl);
      entry.appendChild(tag);
      list.appendChild(entry);
    });
  }

  _updateStartButton() {
    const btn = document.getElementById('btn-start-game');
    const playerCount = this.players.size;
    let allReady = true;
    this.players.forEach((p, id) => {
      if (id === this.network.myId) return;
      if (!this.clientReady.get(id)) allReady = false;
    });
    const canStart = playerCount >= 2 && allReady;
    btn.disabled = !canStart;
    btn.style.opacity = canStart ? '1' : '0.4';
    btn.style.cursor = canStart ? 'pointer' : 'not-allowed';
  }

  _syncLobbyState() {
    if (!this.network.isHost) return;
    const players = [];
    this.players.forEach((p, id) => {
      players.push({
        id, name: p.name, ready: id === this.network.myId ? true : (this.clientReady.get(id) || false),
        weapon: this.clientWeapons.get(id) || 'pistol',
      });
    });
    this.network.broadcast({
      type: 'lobby_state', map: this.selectedMap, players,
      hostId: this.network.myId,
    });
  }

  /* ----------------------------------------------------------
     カウントダウン → 試合開始
     ---------------------------------------------------------- */
  _startCountdown() {
    this.countdownValue = 3;
    this.countdownTimer = 0;
    document.getElementById('countdown-overlay').style.display = '';
    this._showCountdownNumber(3);
  }

  _showCountdownNumber(value) {
    const el = document.getElementById('countdown-text');
    if (value > 0) {
      el.textContent = String(value);
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = 'countPulse 1s ease forwards';
    } else if (value === 0) {
      el.textContent = 'FIGHT!!';
      el.style.color = '#ff0044';
      el.style.textShadow = '0 0 60px rgba(255,0,68,0.5)';
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = 'countPulse 1s ease forwards';
    }
  }

  _startMatch() {
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
    this.clientReady.clear();
    this.network.sendTimer = CONFIG.stateSendRate;
    document.getElementById('kill-count').textContent = '0';
    document.getElementById('death-count').textContent = '0';
    document.getElementById('kill-feed').innerHTML = '';
    document.getElementById('timer-display').textContent = '03:00';
    document.getElementById('timer-display').classList.remove('urgent');
    this.addKillFeed('GAME START!');
    this.players.forEach((p) => {
      p.health = CONFIG.maxHealth;
      p.alive = true;
      const weapon = this.clientWeapons.get(p.id) || 'pistol';
      p.weapon = weapon;
      p.refillAmmo();
      p.spawn();
      p.updateMesh();
      if (p.id === this.localId) {
        p.onReloadComplete = this._onReloadComplete;
      }
    });
    const lp = this.localPlayer;
    if (lp) {
      lp.weapon = this.loadoutWeapon;
      lp.refillAmmo();
      this.updateAmmoUI();
      this.updateHealthUI();
    }
    this.setState(GameState.PLAYING);
    if (!this.pointerLocked) {
      setTimeout(() => this.renderer.domElement.requestPointerLock(), 500);
    }
  }

  /* ----------------------------------------------------------
     試合中処理
     ---------------------------------------------------------- */
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
    document.getElementById('weapon-name').textContent = WEAPONS[lp.weapon] ? WEAPONS[lp.weapon].name : '';
  }

  updateHealthUI() {
    const lp = this.localPlayer;
    if (!lp) return;
    const pct = (lp.health / lp.maxHealth) * 100;
    const bar = document.getElementById('health-bar');
    bar.style.width = pct + '%';
    bar.classList.toggle('low', pct <= 30);
  }

  updateTimerUI() {
    const remaining = Math.max(0, Math.ceil(this.gameTimer));
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const el = document.getElementById('timer-display');
    el.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    el.classList.toggle('urgent', remaining <= 10);
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
    const existing = document.querySelector('.kill-center-msg');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'kill-center-msg';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 800);
  }

  /* ----------------------------------------------------------
     メインアップデート
     ---------------------------------------------------------- */
  update(dt) {
    if (this.gameState === GameState.COUNTDOWN) {
      this._updateCountdown(dt);
    }
    if (this.gameState === GameState.PLAYING) {
      this._updatePlaying(dt);
    }
    if (this.gameState === GameState.RESULT) {
      this._updateResult(dt);
    }
    if (this.gameState === GameState.PLAYING) {
      this.network.sendState(dt);
    }
    this._updateCamera(dt);
  }

  _updateCountdown(dt) {
    this.countdownTimer += dt;
    if (this.countdownTimer >= 1.0) {
      this.countdownTimer = 0;
      this.countdownValue--;
      if (this.network.isHost) {
        this.network.broadcast({ type: 'countdown_sync', value: this.countdownValue });
      }
      if (this.countdownValue > 0) {
        this._showCountdownNumber(this.countdownValue);
      } else if (this.countdownValue === 0) {
        this._showCountdownNumber(0);
      } else {
        document.getElementById('countdown-overlay').style.display = 'none';
        this._startMatch();
      }
    }
  }

  _updatePlaying(dt) {
    if (!this.gameStarted || this.gameOver) return;
    const lp = this.localPlayer;

    if (lp && lp.alive) {
      this._handlePlayerInput(lp, dt);
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

    if (lp && lp.reloading) {
      lp.reloadTimer -= dt;
      if (lp.reloadTimer <= 0) {
        lp.ammo = lp.maxAmmo;
        lp.reloading = false;
        lp.reloadTimer = 0;
        lp.lastFireTime = 0;
        if (lp.onReloadComplete) lp.onReloadComplete(lp.weapon);
      }
      this.updateAmmoUI();
    }
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

    if (this.effectManager) this.effectManager.update(dt);
    if (this.hostAuthority && this.network.isHost) {
      this.hostAuthority.handleHostProjectiles(dt);
    }

    this._updateRespawn(dt);
    this._updateGameTimer(dt);
  }

  _handlePlayerInput(lp, dt) {
    let mx = 0, mz = 0;
    if (this.keys['w']) mz -= 1;
    if (this.keys['s']) mz += 1;
    if (this.keys['a']) mx -= 1;
    if (this.keys['d']) mx += 1;

    this.dashCooldown = Math.max(0, this.dashCooldown - dt);

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
        this.dashTriggered = true;
        if (this.effectManager) this.effectManager.spawnDashEffect(lp.position, _v3);
        if (this.cameraEffectManager) this.cameraEffectManager.dashFov();
      }

      let speed = CONFIG.playerSpeed;
      if (this.dashTimer > 0) {
        speed = CONFIG.dashSpeed;
        this.dashTimer -= dt;
        if (this.dashTimer <= 0) {
          this.dashTimer = 0;
          if (this.effectManager) this.effectManager.spawnLandingEffect(lp.position);
        }
      }
      if (this.arenaMap && this.arenaMap.pads) {
        this._handlePadInteraction(lp, speed, dt);
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

    if (this.mouseDown && this.pointerLocked) {
      const wp = WEAPONS[lp.weapon];
      if (wp) {
        const now = Date.now();
        if (now - lp.lastFireTime > wp.fireRate * 1000) {
          lp.lastFireTime = now;
          this.shoot();
        }
      }
    }
  }

  _handlePadInteraction(lp, speed, dt) {
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
        if (pad.speed > 0 && pad.speed !== 1) speed *= pad.speed;
        if (pad.speed === 0 && this.arenaMap.teleport && this.teleportCooldown <= 0) {
          lp.position.set(this.arenaMap.teleport.x, 0, this.arenaMap.teleport.z);
          this.teleportCooldown = 1.5;
          this.addKillFeed('Teleported!');
        }
      }
    }
    this._lastOnPad = onPad;
  }

  _updateRespawn(dt) {
    if (this.respawnTimer > 0) {
      const prev = Math.ceil(this.respawnTimer);
      this.respawnTimer -= dt;
      const now = Math.ceil(this.respawnTimer);
      if (now !== prev && now > 0) {
        document.getElementById('respawn-countdown').textContent = String(now);
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
  }

  _updateGameTimer(dt) {
    this.gameTimer -= dt;
    this.updateTimerUI();
    if (this.network.isHost) {
      this.network.broadcast({ type: 'game_timer', time: this.gameTimer });
    }
    if (this.gameTimer <= 0) {
      this.gameTimer = 0;
      this.endGame();
    }
  }

  _updateResult(dt) {
    this.resultTimer -= dt;
    if (this.resultTimer <= 0 && this.network.isHost) {
      this.network.broadcast({ type: NetMsg.RETURN_LOBBY });
      this._returnToLobby();
    }
  }

  /* ----------------------------------------------------------
     リスポーン
     ---------------------------------------------------------- */
  _respawnLocal() {
    const lp = this.localPlayer;
    if (!lp) return;
    const half = (this.arenaMap ? this.arenaMap.size : 40) / 2 - 3;
    const spawnPos = new THREE.Vector3(
      (Math.random() - 0.5) * half * 2, 0, (Math.random() - 0.5) * half * 2
    );
    lp.position.copy(spawnPos);
    lp.targetPosition.copy(spawnPos);
    lp.health = CONFIG.maxHealth;
    lp.alive = true;
    this.mouseDown = false;
    this.invincibleTimer = CONFIG.invincibleTime;
    lp.onReloadComplete = this._onReloadComplete;
    lp.weapon = this.loadoutWeapon;
    lp.refillAmmo();
    this.updateAmmoUI();
    this.updateHealthUI();
    this.killCountThisLife = 0;
    if (this.effectManager) {
      this.effectManager.spawnRespawnEffect(spawnPos, lp.color);
    }
    const msg = {
      type: 'respawn', id: this.network.myId,
      pos: { x: spawnPos.x, y: 0, z: spawnPos.z },
    };
    if (this.network.isHost) this.network.broadcast(msg);
    else this.network.send(msg);
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

  /* ----------------------------------------------------------
     カメラ
     ---------------------------------------------------------- */
  _updateCamera(dt) {
    const effectiveDt = this.cameraEffectManager
      ? this.cameraEffectManager.update(dt) : dt;

    if (this.respawnTimer > 0 && this.killCamKillerId && this.gameState === GameState.PLAYING) {
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
      p.x + Math.sin(angle) * dist, p.y + height, p.z + Math.cos(angle) * dist
    );
    this.camera.position.lerp(target, 1 - Math.exp(-8 * effectiveDt));
    this.camera.lookAt(p.x, 0.5, p.z);

    if (this.cameraEffectManager && this.cameraEffectManager.getRedFlash() > 0) {
      const redOverlay = document.getElementById('damage-overlay') || (() => {
        const el = document.createElement('div');
        el.id = 'damage-overlay';
        el.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;
          pointer-events:none;z-index:55;
          background:radial-gradient(ellipse at center, transparent 50%, rgba(255,0,0,0.3) 100%);
          opacity:0;transition:opacity 0.05s;`;
        document.body.appendChild(el);
        return el;
      })();
      redOverlay.style.opacity = Math.min(1, this.cameraEffectManager.getRedFlash() * 2);
    } else {
      const redOverlay = document.getElementById('damage-overlay');
      if (redOverlay) redOverlay.style.opacity = '0';
    }
  }

  /* ----------------------------------------------------------
     キル追跡
     ---------------------------------------------------------- */
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
      this.showKillMessage('+1 KILL');
      let killText = '';
      if (this.multiKillTimer >= 5) killText = 'PENTA KILL';
      else if (this.multiKillTimer >= 4) killText = 'QUADRA KILL';
      else if (this.multiKillTimer >= 3) killText = 'TRIPLE KILL';
      else if (this.multiKillTimer >= 2) killText = 'DOUBLE KILL';
      if (killText) this.showKillMessage(killText);
      if (this.effectManager && targetId) {
        const target = this.players.get(targetId);
        if (target) this.effectManager.spawnKillEffect(target.position);
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

  /* ----------------------------------------------------------
     試合終了 → リザルト
     ---------------------------------------------------------- */
  endGame() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.gameStarted = false;
    this.mouseDown = false;
    if (document.pointerLockElement) document.exitPointerLock();
    const sb = [];
    this.players.forEach((p, id) => {
      sb.push({ id, name: p.name, kills: p.kills, deaths: p.deaths, color: p.color });
    });
    if (this.network.isHost) {
      this.network.broadcast({ type: 'game_over', scoreboard: sb });
    }
    this._showResultScreen(sb);
  }

  _showResultScreen(scoreboard) {
    this.setState(GameState.RESULT);
    const sb = scoreboard || [];
    sb.sort((a, b) => b.kills - a.kills);
    const topKills = sb.length > 0 ? sb[0].kills : 0;
    const winners = sb.filter(e => e.kills === topKills);

    const winnerNameEl = document.getElementById('result-winner-name');
    const winnerLabelEl = document.getElementById('result-winner-label');
    if (winners.length >= 2 && topKills > 0) {
      winnerLabelEl.textContent = 'DRAW';
      winnerNameEl.textContent = winners.map(w => w.name).join(' vs ');
    } else if (topKills > 0) {
      winnerLabelEl.textContent = 'WINNER';
      winnerNameEl.textContent = `${winners[0].name} — ${topKills} KILLS`;
    } else {
      winnerLabelEl.textContent = 'DRAW';
      winnerNameEl.textContent = 'No kills';
    }

    const list = document.getElementById('result-list');
    list.innerHTML = '';
    sb.forEach((entry, i) => {
      const div = document.createElement('div');
      div.className = 'result-entry' + (i === 0 && topKills > 0 ? ' winner' : '');
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
      const kd = document.createElement('span');
      kd.className = 'r-kd';
      const kdVal = entry.kills / Math.max(entry.deaths, 1);
      kd.textContent = kdVal.toFixed(2);
      div.appendChild(rank);
      div.appendChild(dot);
      div.appendChild(name);
      div.appendChild(kills);
      div.appendChild(deaths);
      div.appendChild(kd);
      list.appendChild(div);
    });
    this.resultTimer = 5;
  }

  /* ----------------------------------------------------------
     ロビーへ戻る
     ---------------------------------------------------------- */
  _returnToLobby() {
    this.gameStarted = false;
    this.gameOver = false;
    this.mouseDown = false;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.invincibleTimer = 0;
    this.respawnTimer = 0;
    this.killCamKillerId = null;
    this.clientReady.clear();
    this.players.forEach(p => {
      p.alive = true;
      p.health = CONFIG.maxHealth;
      p.updateMesh();
    });
    this.projectiles.forEach(p => p.destroy());
    this.projectiles = [];
    if (this.hostAuthority) this.hostAuthority.reset();
    if (this.effectManager) this.effectManager.clear();
    document.getElementById('kill-feed').innerHTML = '';
    document.getElementById('timer-display').textContent = '--:--';
    document.getElementById('ammo-display').textContent = '--/--';
    document.getElementById('kill-count').textContent = '0';
    document.getElementById('death-count').textContent = '0';
    this.kills = 0;
    this.deaths = 0;
    this.killStreak = 0;
    this.multiKillTimer = 0;
    this.lastKillTime = 0;
    this.scoreboard.clear();
    this.gameTimer = CONFIG.gameTimeLimit;
    this.connectionHandled = false;
    this.setState(GameState.LOBBY);
  }

  /* ----------------------------------------------------------
     ゲームループ
     ---------------------------------------------------------- */
  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
