/* ============================================================
   NEON ARENA - UIイベント・エントリーポイント
   ゲームインスタンス生成、UIイベント設定、起動処理
   ============================================================ */

const game = new Game();
game.init();

/* ホストゲームボタン */
document.getElementById('btn-host').addEventListener('click', async () => {
  document.getElementById('step-1').style.display = 'none';
  document.getElementById('step-host').style.display = 'block';
  document.getElementById('overlay-status').textContent = '⏳ Creating room...';
  try {
    const roomId = await game.network.createRoom();
    game.localId = roomId;
    const hostName = document.getElementById('host-name-input').value.trim() || 'Host';
    game.addPlayer(roomId, PLAYER_COLORS[0], hostName);
    const me = game.players.get(roomId);
    if (me) { me.weapon = game.loadoutWeapon; me.lastFireTime = 0; }
    document.getElementById('room-id-display').textContent = roomId;
    document.getElementById('overlay-status').textContent = 'Share this room ID with friends';
    document.getElementById('step-host-status').textContent = 'Waiting for players to join...';
  } catch (err) {
    document.getElementById('overlay-status').textContent = '❌ Error: ' + err.message;
  }
});

/* ホスト戻るボタン */
document.getElementById('btn-host-back').addEventListener('click', () => {
  game.network.close();
  game.connectionHandled = false;
  game.players.forEach((p, id) => { if (id !== game.localId) game.removePlayer(id); });
  document.getElementById('step-host').style.display = 'none';
  document.getElementById('step-1').style.display = 'block';
  document.getElementById('overlay-status').textContent = 'Click a button to start';
});

/* 参加画面へボタン */
document.getElementById('btn-join').addEventListener('click', () => {
  document.getElementById('step-1').style.display = 'none';
  document.getElementById('step-join').style.display = 'block';
  document.getElementById('overlay-status').textContent = 'Enter the host\'s room ID';
});

/* タイトル画面の武器ボタンの初期アクティブ状態 */
document.querySelector('#title-weapon-btns .map-btn')?.classList.add('active');

/* 参加戻るボタン */
document.getElementById('btn-join-back').addEventListener('click', () => {
  document.getElementById('step-join').style.display = 'none';
  document.getElementById('step-1').style.display = 'block';
  document.getElementById('overlay-status').textContent = 'Click a button to start';
});

/* ルーム参加ボタン */
document.getElementById('btn-join-room').addEventListener('click', async () => {
  let roomId = document.getElementById('room-id-input').value.trim().toUpperCase();
  if (!roomId.startsWith('NEON-')) roomId = 'NEON-' + roomId;
  if (roomId === 'NEON-') return;
  const playerName = document.getElementById('player-name-input').value.trim() || 'Player';
  document.getElementById('overlay-status').textContent = '⏳ Joining room...';
  try {
    await game.network.joinRoom(roomId, playerName);
    document.getElementById('overlay-status').textContent = '🔗 Connecting...';
  } catch (err) {
    document.getElementById('overlay-status').textContent = '❌ Error: ' + err.message;
  }
});

/* タイトル画面の武器選択 */
document.getElementById('title-weapon-btns').addEventListener('click', (e) => {
  const btn = e.target.closest('.map-btn');
  if (!btn) return;
  const wp = btn.dataset.weapon;
  game.loadoutWeapon = wp;
  if (game.localPlayer) game.localPlayer.weapon = wp;
  document.querySelectorAll('#title-weapon-btns .map-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
});

/* ルームIDコピーボタン */
document.getElementById('btn-copy-room').addEventListener('click', () => {
  const text = document.getElementById('room-id-display').textContent;
  navigator.clipboard.writeText(text).catch(() => {});
  document.getElementById('overlay-status').textContent = '✅ Copied! Share this ID with friends';
});

/* ゲーム開始ボタン（ホスト用） */
document.getElementById('btn-start-game').addEventListener('click', () => {
  game._createArena(game.selectedMap);
  game.network.broadcast({ type: 'game_start', map: game.selectedMap });
  game.startGame();
});

/* ホスト名入力 */
document.getElementById('host-name-input').addEventListener('input', () => {
  const p = game.players.get(game.localId);
  if (p) {
    p.name = document.getElementById('host-name-input').value.trim() || 'Host';
    game.updatePlayerListUI();
  }
});

/* ロビーに戻るボタン */
document.getElementById('btn-back-lobby').addEventListener('click', () => {
  document.getElementById('result-screen').classList.remove('show');
  game.gameStarted = false;
  game.gameOver = false;
  game.mouseDown = false;
  game.dashTimer = 0;
  game.dashCooldown = 0;
  game.invincibleTimer = 0;
  game.players.forEach(p => { p.alive = true; p.health = CONFIG.maxHealth; p.updateMesh(); });
  game.projectiles.forEach(p => p.destroy());
  game.projectiles = [];
  document.getElementById('overlay').classList.remove('hidden');
  document.getElementById('instructions').classList.add('hidden');
  document.getElementById('death-screen').classList.remove('show');
  document.getElementById('timer-display').textContent = '--:--';
  document.getElementById('ammo-display').textContent = '--/--';
  document.getElementById('match-btn').style.display = '';
  game.updatePlayerListUI();
  if (game.network.isHost) {
    const name = document.getElementById('host-name-input').value.trim() || 'Host';
    const me = game.players.get(game.localId);
    if (me) me.name = name;
    document.querySelectorAll('.step-section').forEach(el => el.style.display = 'none');
    document.getElementById('waiting-room').style.display = 'block';
    document.getElementById('overlay-status').textContent = 'Select map and press START';
    game.updatePlayerListUI();
  } else {
    document.querySelectorAll('.step-section').forEach(el => el.style.display = 'none');
    document.getElementById('waiting-room').style.display = 'block';
    document.getElementById('overlay-status').textContent = 'Waiting for host...';
  }
});

/* マッチボタン（クイック参加） */
document.getElementById('match-btn').addEventListener('click', () => {
  document.getElementById('player-name-input').value = 'Player' + Math.floor(Math.random() * 9000 + 1000);
  document.querySelector('#title-weapon-btns .map-btn.active')?.click() ||
    document.querySelector('#title-weapon-btns .map-btn')?.click();
  document.getElementById('btn-join-room')?.click();
});

/* デス画面の武器選択 */
document.getElementById('death-weapon-btns').addEventListener('click', (e) => {
  const btn = e.target.closest('.map-btn');
  if (!btn) return;
  const wp = btn.dataset.weapon;
  if (game.localPlayer) {
    game.localPlayer.weapon = wp;
    game.localPlayer.lastFireTime = 0;
  }
  document.querySelectorAll('#death-weapon-btns .map-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
});

/* 待機室退出ボタン */
document.getElementById('btn-leave-lobby').addEventListener('click', () => {
  game.network.close();
  game.connectionHandled = false;
  game.players.forEach((p, id) => game.removePlayer(id));
  game.projectiles.forEach(p => p.destroy());
  game.projectiles = [];
  game.gameStarted = false;
  game.gameOver = false;
  document.getElementById('result-screen').classList.remove('show');
  document.getElementById('death-screen').classList.remove('show');
  document.getElementById('overlay').classList.remove('hidden');
  document.querySelectorAll('.step-section').forEach(el => el.style.display = 'none');
  document.getElementById('waiting-room').style.display = 'none';
  document.getElementById('step-1').style.display = 'block';
  document.getElementById('overlay-status').textContent = 'Click a button to start';
  document.getElementById('match-btn').style.display = '';
});

/* ブラウザリロード/タブ閉じ時のクリーンアップ */
window.addEventListener('beforeunload', () => {
  game.network.close();
});

console.log('🚀 NEON ARENA loaded. Click "Host Game" or "Join Game" to begin.');
