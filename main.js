/* ============================================================
   NEON ARENA - エントリーポイント
   UIイベントバインディング（ゲームロジックはgame.jsに委譲）
   ============================================================ */

const game = new Game();
game.init();

/* ---- タイトル画面 ---- */

/* Host */
document.getElementById('btn-host').addEventListener('click', async () => {
  const name = document.getElementById('player-name-input').value.trim() || 'Player';
  document.getElementById('title-status').textContent = '⏳ Creating room...';
  document.getElementById('host-section').style.display = '';
  document.getElementById('join-section').style.display = 'none';
  try {
    const roomId = await game.network.createRoom();
    game.localId = roomId;
    game.isHost = true;
    game.addPlayer(roomId, PLAYER_COLORS[0], name);
    const me = game.players.get(roomId);
    if (me) { me.weapon = game.loadoutWeapon; me.lastFireTime = 0; }
    document.getElementById('room-id-display').textContent = roomId;
    document.getElementById('host-status').textContent = 'Waiting for players to join...';
    document.getElementById('title-status').textContent = 'Room created! Share the ID above';
    game.network.connected = true;
    game.onConnected();
    game.setState(GameState.LOBBY);
  } catch (err) {
    document.getElementById('title-status').textContent = '❌ Error: ' + err.message;
    document.getElementById('host-section').style.display = 'none';
  }
});

/* Join */
document.getElementById('btn-join').addEventListener('click', () => {
  document.getElementById('join-section').style.display = '';
  document.getElementById('host-section').style.display = 'none';
  document.getElementById('title-status').textContent = 'Enter the host\'s room ID';
});

document.getElementById('btn-join-cancel').addEventListener('click', () => {
  document.getElementById('join-section').style.display = 'none';
  document.getElementById('title-status').textContent = 'Click Host or Join to start';
});

document.getElementById('btn-join-room').addEventListener('click', async () => {
  let roomId = document.getElementById('room-id-input').value.trim().toUpperCase();
  if (!roomId.startsWith('NEON-')) roomId = 'NEON-' + roomId;
  if (roomId === 'NEON-') return;
  const playerName = document.getElementById('player-name-input').value.trim() || 'Player';
  document.getElementById('title-status').textContent = '⏳ Joining room...';
  try {
    await game.network.joinRoom(roomId, playerName);
    document.getElementById('title-status').textContent = '🔗 Connected!';
  } catch (err) {
    document.getElementById('title-status').textContent = '❌ Error: ' + err.message;
  }
});

/* 名前変更（常時可能） */
document.getElementById('player-name-input').addEventListener('input', () => {
  const name = document.getElementById('player-name-input').value.trim() || 'Player';
  const me = game.players.get(game.localId);
  if (me) {
    me.name = name;
    if (game.gameState === GameState.LOBBY) game._updateLobbyUI();
    game.network.sendNameChange(name);
  }
});

/* ---- ロビー ---- */

/* ホスト: ゲーム開始 */
document.getElementById('btn-start-game').addEventListener('click', () => {
  if (document.getElementById('btn-start-game').disabled) return;
  game._createArena(game.selectedMap);
  game.network.broadcast({ type: 'game_start', map: game.selectedMap });
  game.setState(GameState.COUNTDOWN);
});

/* クライアント: Ready */
document.getElementById('btn-ready').addEventListener('click', () => {
  const btn = document.getElementById('btn-ready');
  const isReady = btn.dataset.ready !== 'true';
  btn.dataset.ready = isReady ? 'true' : 'false';
  btn.textContent = isReady ? '✔ READY' : '▶ READY';
  btn.classList.toggle('btn-secondary', !isReady);
  btn.classList.toggle('btn-primary', isReady);
  game.network.sendReady(isReady);
  game._updateLobbyUI();
});

/* クライアント: 武器変更（ロビー） */
document.getElementById('lobby-weapon-btns').addEventListener('click', (e) => {
  const btn = e.target.closest('.map-btn');
  if (!btn) return;
  const wp = btn.dataset.weapon;
  game.loadoutWeapon = wp;
  if (game.localPlayer) game.localPlayer.weapon = wp;
  document.querySelectorAll('#lobby-weapon-btns .map-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  game.network.sendWeaponChange(wp);
});

/* デス画面: 武器変更 */
document.getElementById('death-weapon-btns').addEventListener('click', (e) => {
  const btn = e.target.closest('.map-btn');
  if (!btn) return;
  const wp = btn.dataset.weapon;
  game.loadoutWeapon = wp;
  if (game.localPlayer) game.localPlayer.weapon = wp;
  document.querySelectorAll('#death-weapon-btns .map-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  game.network.sendWeaponChange(wp);
});

/* ルームIDコピー */
document.getElementById('btn-copy-room').addEventListener('click', () => {
  const text = document.getElementById('room-id-display').textContent;
  navigator.clipboard.writeText(text).catch(() => {});
  document.getElementById('title-status').textContent = '✅ Copied!';
});

/* ロビー退出 */
document.getElementById('btn-leave-lobby').addEventListener('click', () => {
  game.network.close();
  game.connectionHandled = false;
  game.players.forEach((p, id) => game.removePlayer(id));
  game.projectiles.forEach(p => p.destroy());
  game.projectiles = [];
  game.isHost = false;
  game.clientReady.clear();
  game.clientWeapons.clear();
  if (game.hostAuthority) game.hostAuthority.reset();
  if (game.effectManager) game.effectManager.clear();
  document.getElementById('kill-feed').innerHTML = '';
  document.getElementById('join-section').style.display = 'none';
  document.getElementById('host-section').style.display = 'none';
  game.setState(GameState.TITLE);
});

/* ブラウザ終了時 */
window.addEventListener('beforeunload', () => {
  game.network.close();
});
