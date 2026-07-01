/* ============================================================
   NEON ARENA - プレイヤークラス
   プレイヤーの生成、移動、ダメージ管理、メッシュ更新を管理
   ============================================================ */

class Player {
  constructor(scene, id, color) {
    this.scene = scene;
    this.id = id;
    this.color = color;
    this.health = CONFIG.maxHealth;
    this.maxHealth = CONFIG.maxHealth;
    this.alive = true;
    this.name = '';
    this.kills = 0;
    this.deaths = 0;
    this.weapon = 'pistol';
    this.lastFireTime = 0;
    this.ammo = 0;
    this.maxAmmo = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    const geo = new THREE.BoxGeometry(CONFIG.playerSize, CONFIG.playerHeight, CONFIG.playerSize);
    const mat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.3, metalness: 0.1, roughness: 0.4,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.scene.add(this.mesh);
    const ggeo = new THREE.BoxGeometry(CONFIG.playerSize * 1.6, CONFIG.playerHeight * 0.2, CONFIG.playerSize * 1.6);
    const gmat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1 });
    this.glowRing = new THREE.Mesh(ggeo, gmat);
    this.glowRing.position.y = 0.05;
    this.scene.add(this.glowRing);
    this.edgeGeo = new THREE.EdgesGeometry(geo);
    this.edgeMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.4 });
    this.edgeLine = new THREE.LineSegments(this.edgeGeo, this.edgeMat);
    this.scene.add(this.edgeLine);
    this.position = new THREE.Vector3();
    this.rotation = 0;
    this.targetPosition = new THREE.Vector3();
    this.targetRotation = 0;
    this.spawn();
  }
  spawn() {
    const half = 20;
    this.position.set((Math.random() - 0.5) * half * 2, 0, (Math.random() - 0.5) * half * 2);
    this.targetPosition.copy(this.position);
    this.health = CONFIG.maxHealth;
    this.alive = true;
    this.refillAmmo();
    this.updateMesh();
  }
  refillAmmo() {
    const wp = WEAPONS[this.weapon] || WEAPONS.pistol;
    this.maxAmmo = wp.maxAmmo;
    this.ammo = wp.maxAmmo;
    this.reloading = false;
    this.reloadTimer = 0;
  }
  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0 && this.alive) { this.alive = false; this.deaths++; }
    return !this.alive;
  }
  updateMesh() {
    this.mesh.position.set(this.position.x, CONFIG.playerHeight / 2, this.position.z);
    this.mesh.rotation.y = this.rotation;
    this.glowRing.position.set(this.position.x, 0.05, this.position.z);
    this.edgeLine.position.copy(this.mesh.position);
    this.edgeLine.rotation.y = this.rotation;
  }
  setPosition(pos) { this.position.copy(pos); this.targetPosition.copy(pos); }
  setRotation(rot) { this.rotation = rot; this.targetRotation = rot; }
  lerpToTarget(dt) {
    this.position.lerp(this.targetPosition, 1 - Math.exp(-10 * dt));
    const diff = this.targetRotation - this.rotation;
    this.rotation += diff * Math.min(1, 10 * dt);
  }
  update(dt) {
    if (!this.alive) {
      this.mesh.visible = false; this.edgeLine.visible = false; this.glowRing.visible = false;
      return;
    }
    this.mesh.visible = true; this.edgeLine.visible = true; this.glowRing.visible = true;
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.ammo = this.maxAmmo;
        this.reloading = false;
        this.reloadTimer = 0;
      }
    }
    this.updateMesh();
  }
  destroy() {
    [this.mesh, this.glowRing, this.edgeLine].forEach(o => { this.scene.remove(o); });
    this.mesh.geometry.dispose(); this.mesh.material.dispose();
    this.glowRing.geometry.dispose(); this.glowRing.material.dispose();
    this.edgeGeo.dispose(); this.edgeMat.dispose();
  }
}
