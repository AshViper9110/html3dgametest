/* ============================================================
   NEON ARENA - ゲーム設定
   設定値、武器定義、マップ定義を管理
   ============================================================ */

const THREE = window.THREE;

/* === ゲーム設定 === */
const CONFIG = {
  playerSize: 1.0,       // プレイヤーの当たり判定サイズ
  playerHeight: 1.4,     // プレイヤーの高さ
  playerSpeed: 12,       // 移動速度
  projectileRadius: 0.2, // 弾の半径（デフォルト）
  projectileSpeed: 45,   // 弾の速度（デフォルト）
  projectileLifetime: 2.0, // 弾の生存時間（デフォルト）
  maxHealth: 100,        // 最大HP
  respawnDelay: 3,       // リスポーン遅延時間（秒）
  stateSendRate: 0.05,   // 状態同期の送信間隔（秒）
  gameTimeLimit: 180,    // ゲーム制限時間（秒）
  killCamDuration: 2,    // キルカメラの持続時間（秒）
  dashSpeed: 35,         // ダッシュ時の速度
  dashDuration: 0.12,    // ダッシュの持続時間（秒）
  dashCooldown: 0.8,     // ダッシュのクールダウン（秒）
  invincibleTime: 3,     // リスポーン後の無敵時間（秒）
  colors: { projectile: 0xffee00 },
};

/* === 武器設定 ===
   各武器のダメージ、連射速度、弾の速度、拡散、弾薬などを定義 */
const WEAPONS = {
  pistol: {
    name: 'PISTOL', damage: 20, fireRate: 0.25,
    projSpeed: 50, projLifetime: 1.5, projRadius: 0.2,
    spread: 0, color: 0xffee00, hitRadius: 0.8,
    maxAmmo: 10, reloadTime: 3,
  },
  assault: {
    name: 'ASSAULT', damage: 15, fireRate: 0.08,
    projSpeed: 55, projLifetime: 1.5, projRadius: 0.15,
    spread: 0.06, color: 0xff6600, hitRadius: 0.7,
    maxAmmo: 30, reloadTime: 3,
  },
  sniper: {
    name: 'SNIPER', damage: 40, fireRate: 1.0,
    projSpeed: 90, projLifetime: 2.0, projRadius: 0.3,
    spread: 0, color: 0x00ffff, hitRadius: 0.9,
    maxAmmo: 5, reloadTime: 3,
  },
  rpg: {
    name: 'RPG', damage: 60, fireRate: 1.2,
    projSpeed: 18, projLifetime: 3.0, projRadius: 0.4,
    spread: 0, color: 0xff2200, hitRadius: 2.5,
    explosive: true,
    maxAmmo: 1, reloadTime: 3,
  },
  shotgun: {
    name: 'SHOTGUN', damage: 4, fireRate: 0.6,
    projSpeed: 50, projLifetime: 0.8, projRadius: 0.12,
    spread: 0.18, color: 0xff6600, hitRadius: 0.3,
    maxAmmo: 8, reloadTime: 2,
    pellets: 6,
  },
};

/* === プレイヤーカラー === */
const PLAYER_COLORS = [
  0x00f0ff, 0xff0055, 0x00ff88, 0xffaa00,
  0xaa00ff, 0x00ccff, 0xff6600, 0xff44aa,
];

/* === マップ定義 ===
   各マップのサイズ、壁の配置、カラーテーマを定義 */
const MAPS = {
  grid: {
    name: 'NEON GRID', desc: 'Standard open arena',
    size: 40, wallHeight: 3, wallThick: 0.5,
    bg: 0x0a0a12, fogNear: 30, fogFar: 60,
    wallColor: 0x1a1a2e, floorColor: 0x0d0d1a,
    edgeColors: [0x00f0ff, 0xff00ff],
    gridColor: 0x00f0ff,
    ambientColor: 0x111122, ambientIntensity: 0.5,
    dirColor: 0x8844ff, dirIntensity: 1.0,
    rimColors: [0x00f0ff, 0xff00ff, 0x00f0ff, 0xff00ff],
    walls: [],
    pads: [{ p: [0,0,0], s: [4,0.1,4], speed: 2.0 }],
  },
  maze: {
    name: 'MAZE', desc: 'Navigate corridors',
    size: 50, wallHeight: 4, wallThick: 0.5,
    bg: 0x0a0018, fogNear: 20, fogFar: 40,
    wallColor: 0x1a0030, floorColor: 0x080010,
    edgeColors: [0xaa00ff, 0xff00aa],
    gridColor: 0xaa00ff,
    ambientColor: 0x110022, ambientIntensity: 0.4,
    dirColor: 0x8844ff, dirIntensity: 0.8,
    rimColors: [0xaa00ff, 0xff00aa, 0xaa00ff, 0xff00aa],
    walls: [
      { p: [-10,2,0], s: [0.5,4,18] }, { p: [10,2,0], s: [0.5,4,18] },
      { p: [0,2,-10], s: [18,4,0.5] }, { p: [0,2,10], s: [18,4,0.5] },
      { p: [-6,2,-5], s: [0.5,4,8] }, { p: [6,2,5], s: [0.5,4,8] },
      { p: [-14,2,-14], s: [8,4,0.5] }, { p: [14,2,14], s: [8,4,0.5] },
      { p: [-18,2,8], s: [0.5,4,9] }, { p: [18,2,-8], s: [0.5,4,9] },
    ],
    pads: [],
  },
  colloseum: {
    name: 'COLLOSEUM', desc: 'Compact with pillars',
    size: 35, wallHeight: 3, wallThick: 0.5,
    bg: 0x120a00, fogNear: 22, fogFar: 45,
    wallColor: 0x2e1a0a, floorColor: 0x1a0a00,
    edgeColors: [0xff8800, 0xff4400],
    gridColor: 0xff6600,
    ambientColor: 0x221100, ambientIntensity: 0.4,
    dirColor: 0xff6600, dirIntensity: 0.8,
    rimColors: [0xff8800, 0xff4400, 0xff8800, 0xff4400],
    walls: [
      { p: [-8,2,-8], s: [1.5,4,1.5] }, { p: [8,2,-8], s: [1.5,4,1.5] },
      { p: [-8,2,8], s: [1.5,4,1.5] }, { p: [8,2,8], s: [1.5,4,1.5] },
      { p: [0,2,-12], s: [1.5,4,1.5] }, { p: [0,2,12], s: [1.5,4,1.5] },
      { p: [-12,2,0], s: [1.5,4,1.5] }, { p: [12,2,0], s: [1.5,4,1.5] },
    ],
    pads: [],
  },
  abyss: {
    name: 'ABYSS', desc: 'Deadly central vortex',
    size: 45, wallHeight: 3.5, wallThick: 0.5,
    bg: 0x000a12, fogNear: 25, fogFar: 50,
    wallColor: 0x0a1a2e, floorColor: 0x050a12,
    edgeColors: [0x00ffff, 0x0088ff],
    gridColor: 0x00aaff,
    ambientColor: 0x001122, ambientIntensity: 0.4,
    dirColor: 0x4488ff, dirIntensity: 0.8,
    rimColors: [0x00ffff, 0x0088ff, 0x00ffff, 0x0088ff],
    walls: [
      { p: [-7,2,-7], s: [2,4,2] }, { p: [7,2,-7], s: [2,4,2] },
      { p: [-7,2,7], s: [2,4,2] }, { p: [7,2,7], s: [2,4,2] },
      { p: [0,2,-14], s: [1,4,2] }, { p: [0,2,14], s: [1,4,2] },
      { p: [-14,2,0], s: [2,4,1] }, { p: [14,2,0], s: [2,4,1] },
    ],
    pads: [],
  },
  fort: {
    name: 'FORT', desc: 'Fortified stronghold',
    size: 48, wallHeight: 4, wallThick: 0.5,
    bg: 0x0a1208, fogNear: 22, fogFar: 44,
    wallColor: 0x0a1a0a, floorColor: 0x080a05,
    edgeColors: [0x00ff88, 0x00cc66],
    gridColor: 0x00ff66,
    ambientColor: 0x002211, ambientIntensity: 0.4,
    dirColor: 0x44ff88, dirIntensity: 0.8,
    rimColors: [0x00ff88, 0x00cc66, 0x00ff88, 0x00cc66],
    walls: [
      { p: [-13,2,-13], s: [7,4,0.5] }, { p: [13,2,13], s: [7,4,0.5] },
      { p: [-13,2,13], s: [7,4,0.5] }, { p: [13,2,-13], s: [7,4,0.5] },
      { p: [-6,2,0], s: [0.5,4,12] }, { p: [6,2,0], s: [0.5,4,12] },
      { p: [0,2,-6], s: [12,4,0.5] }, { p: [0,2,6], s: [12,4,0.5] },
    ],
    pads: [],
  },
  chaos: {
    name: 'CHAOS', desc: 'Dense obstacle field',
    size: 40, wallHeight: 2.5, wallThick: 0.4,
    bg: 0x120008, fogNear: 18, fogFar: 38,
    wallColor: 0x2e0a1a, floorColor: 0x1a0008,
    edgeColors: [0xff0055, 0xff44aa],
    gridColor: 0xff0088,
    ambientColor: 0x220011, ambientIntensity: 0.4,
    dirColor: 0xff4488, dirIntensity: 0.8,
    rimColors: [0xff0055, 0xff44aa, 0xff0055, 0xff44aa],
    walls: [
      { p: [-14,1.5,-14], s: [1,3,1] }, { p: [-14,1.5,-7], s: [1,3,1] }, { p: [-14,1.5,0], s: [1,3,1] }, { p: [-14,1.5,7], s: [1,3,1] }, { p: [-14,1.5,14], s: [1,3,1] },
      { p: [-7,1.5,-14], s: [1,3,1] }, { p: [-7,1.5,-7], s: [1,3,1] }, { p: [-7,1.5,0], s: [1,3,1] }, { p: [-7,1.5,7], s: [1,3,1] }, { p: [-7,1.5,14], s: [1,3,1] },
      { p: [0,1.5,-14], s: [1,3,1] }, { p: [0,1.5,0], s: [1,3,1] }, { p: [0,1.5,14], s: [1,3,1] },
      { p: [7,1.5,-14], s: [1,3,1] }, { p: [7,1.5,-7], s: [1,3,1] }, { p: [7,1.5,0], s: [1,3,1] }, { p: [7,1.5,7], s: [1,3,1] }, { p: [7,1.5,14], s: [1,3,1] },
      { p: [14,1.5,-14], s: [1,3,1] }, { p: [14,1.5,-7], s: [1,3,1] }, { p: [14,1.5,0], s: [1,3,1] }, { p: [14,1.5,7], s: [1,3,1] }, { p: [14,1.5,14], s: [1,3,1] },
    ],
    pads: [{ p: [0,0,0], s: [2,0.1,2], speed: 1.8 }],
  },
  reactor: {
    name: 'REACTOR', desc: 'Glowing core chamber',
    size: 42, wallHeight: 3.5, wallThick: 0.5,
    bg: 0x001208, fogNear: 24, fogFar: 48,
    wallColor: 0x0a1a0a, floorColor: 0x000a05,
    edgeColors: [0x00ff44, 0x00ff88],
    gridColor: 0x00ff66,
    ambientColor: 0x001104, ambientIntensity: 0.4,
    dirColor: 0x00ff66, dirIntensity: 0.8,
    rimColors: [0x00ff44, 0x00ff88, 0x00ff44, 0x00ff88],
    walls: [
      { p: [-8,2,0], s: [0.5,4,8] }, { p: [8,2,0], s: [0.5,4,8] },
      { p: [0,2,-8], s: [8,4,0.5] }, { p: [0,2,8], s: [8,4,0.5] },
      { p: [-12,2,-12], s: [4,4,0.5] }, { p: [12,2,12], s: [4,4,0.5] },
      { p: [-12,2,12], s: [4,4,0.5] }, { p: [12,2,-12], s: [4,4,0.5] },
    ],
    pads: [{ p: [0,0,0], s: [3,0.1,3], speed: 1.5 }],
  },
  ice: {
    name: 'ICE', desc: 'Slippery frozen tundra',
    size: 38, wallHeight: 2.5, wallThick: 0.5,
    bg: 0x080c18, fogNear: 28, fogFar: 55,
    wallColor: 0x1a2236, floorColor: 0x0a0e18,
    edgeColors: [0x4488ff, 0x88ccff],
    gridColor: 0x4488ff,
    ambientColor: 0x081122, ambientIntensity: 0.5,
    dirColor: 0x88aaff, dirIntensity: 1.0,
    rimColors: [0x4488ff, 0x88ccff, 0x4488ff, 0x88ccff],
    walls: [
      { p: [-4,1.5,-4], s: [1.5,3,1.5] }, { p: [4,1.5,-4], s: [1.5,3,1.5] },
      { p: [-4,1.5,4], s: [1.5,3,1.5] }, { p: [4,1.5,4], s: [1.5,3,1.5] },
      { p: [-10,1.5,-10], s: [1.5,3,1.5] }, { p: [10,1.5,10], s: [1.5,3,1.5] },
      { p: [-10,1.5,10], s: [1.5,3,1.5] }, { p: [10,1.5,-10], s: [1.5,3,1.5] },
    ],
    pads: [{ p: [0,0,0], s: [5,0.1,5], speed: 0 }],
    teleport: { x: 14, z: 14 },
  },
  dojo: {
    name: 'DOJO', desc: 'Symmetrical battle arena',
    size: 36, wallHeight: 3, wallThick: 0.5,
    bg: 0x0a0806, fogNear: 20, fogFar: 40,
    wallColor: 0x1a1210, floorColor: 0x0d0a08,
    edgeColors: [0xff4444, 0xff8888],
    gridColor: 0xff4444,
    ambientColor: 0x110808, ambientIntensity: 0.4,
    dirColor: 0xff6644, dirIntensity: 0.8,
    rimColors: [0xff4444, 0xff8888, 0xff4444, 0xff8888],
    walls: [
      { p: [-5,1.5,-5], s: [2,3,2] }, { p: [5,1.5,-5], s: [2,3,2] },
      { p: [-5,1.5,5], s: [2,3,2] }, { p: [5,1.5,5], s: [2,3,2] },
      { p: [-10,2,0], s: [0.5,4,0.5] }, { p: [10,2,0], s: [0.5,4,0.5] },
      { p: [0,2,-10], s: [0.5,4,0.5] }, { p: [0,2,10], s: [0.5,4,0.5] },
      { p: [-14,1.5,-6], s: [1,3,1] }, { p: [14,1.5,6], s: [1,3,1] },
      { p: [6,1.5,-14], s: [1,3,1] }, { p: [-6,1.5,14], s: [1,3,1] },
    ],
    pads: [
      { p: [-8,0,0], s: [1.5,0.1,1.5], speed: 2.2 },
      { p: [8,0,0], s: [1.5,0.1,1.5], speed: 2.2 },
    ],
  },
  twilight: {
    name: 'TWILIGHT', desc: 'Low visibility neon haze',
    size: 44, wallHeight: 3, wallThick: 0.5,
    bg: 0x06000a, fogNear: 12, fogFar: 28,
    wallColor: 0x160020, floorColor: 0x08000a,
    edgeColors: [0xff00ff, 0x8800ff],
    gridColor: 0xcc00ff,
    ambientColor: 0x110022, ambientIntensity: 0.3,
    dirColor: 0xaa44ff, dirIntensity: 0.6,
    rimColors: [0xff00ff, 0x8800ff, 0xff00ff, 0x8800ff],
    walls: [
      { p: [-9,1.5,-9], s: [2,3,2] }, { p: [9,1.5,-9], s: [2,3,2] },
      { p: [-9,1.5,9], s: [2,3,2] }, { p: [9,1.5,9], s: [2,3,2] },
      { p: [-3,1.5,-3], s: [1.5,3,1.5] }, { p: [3,1.5,3], s: [1.5,3,1.5] },
      { p: [-3,1.5,3], s: [1.5,3,1.5] }, { p: [3,1.5,-3], s: [1.5,3,1.5] },
    ],
    pads: [],
  },
};

/* ベクトル演算用の再利用可能なオブジェクト */
const _v3 = new THREE.Vector3();
const _v3b = new THREE.Vector3();
