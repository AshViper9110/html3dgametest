/* ============================================================
   NEON ARENA - 弾丸クラス
   弾の生成、移動、軌跡エフェクト、破棄を管理
   ============================================================ */

class Projectile {
  constructor(scene, origin, dir, ownerId, id, color, weapon) {
    this.scene = scene;
    this.ownerId = ownerId;
    this.id = id;
    this.weapon = weapon || 'pistol';
    this.wp = WEAPONS[this.weapon] || WEAPONS.pistol;
    this.alive = true;
    this.age = 0;
    this.color = this.wp.color;
    const r = this.wp.projRadius;
    const geo = new THREE.SphereGeometry(r * 1.5, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: this.color });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(origin);
    this.mesh.position.y += CONFIG.playerHeight * 0.6;
    this.scene.add(this.mesh);
    this.velocity = dir.clone().multiplyScalar(this.wp.projSpeed);
    this.velocity.y = 0;
    const ggeo = new THREE.SphereGeometry(r * 3, 8, 8);
    const gmat = new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.25 });
    this.glow = new THREE.Mesh(ggeo, gmat);
    this.glow.position.copy(this.mesh.position);
    this.scene.add(this.glow);
    this.trail = [];
    this.trailTimer = 0;
    this.exploded = false;
    this.hitPlayers = new Set();
  }
  update(dt) {
    if (!this.alive) return;
    this.age += dt;
    if (this.age > this.wp.projLifetime) { this.destroy(); return; }
    this.mesh.position.x += this.velocity.x * dt;
    this.mesh.position.z += this.velocity.z * dt;
    const half = 30;
    if (Math.abs(this.mesh.position.x) > half || Math.abs(this.mesh.position.z) > half) { this.destroy(); return; }
    this.glow.position.copy(this.mesh.position);
    const pulse = 1 + 0.3 * Math.sin(this.age * 20);
    this.glow.scale.setScalar(pulse);
    this.trailTimer += dt;
    if (this.trailTimer > 0.03) { this.trailTimer = 0; this._spawnTrail(); }
    this.trail = this.trail.filter(t => {
      t.life += dt;
      if (t.life > 0.4) { this.scene.remove(t.mesh); return false; }
      const s = 1 - t.life / 0.4;
      t.mesh.scale.setScalar(s * 2);
      t.mesh.material.opacity = s * 0.4;
      return true;
    });
  }
  _spawnTrail() {
    const r = this.wp.projRadius;
    const geo = new THREE.SphereGeometry(r, 4, 4);
    const mat = new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.4 });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(this.mesh.position);
    this.scene.add(m);
    this.trail.push({ mesh: m, life: 0 });
  }
  explosionFX() {
    if (this.exploded) return;
    this.exploded = true;
    const r = this.wp.projRadius * 8;
    const geo = new THREE.SphereGeometry(r, 12, 12);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff4400, transparent: true, opacity: 0.6,
    });
    const boom = new THREE.Mesh(geo, mat);
    boom.position.copy(this.mesh.position);
    this.scene.add(boom);
    const start = performance.now();
    const anim = () => {
      const t = (performance.now() - start) / 400;
      if (t >= 1) { this.scene.remove(boom); boom.geometry.dispose(); boom.material.dispose(); return; }
      const s = 1 + t * 3;
      boom.scale.setScalar(s);
      boom.material.opacity = 0.6 * (1 - t);
      requestAnimationFrame(anim);
    };
    anim();
  }
  destroy() {
    if (!this.alive) return;
    if (this.wp.explosive) this.explosionFX();
    this.alive = false;
    this.scene.remove(this.mesh); this.scene.remove(this.glow);
    this.mesh.geometry.dispose(); this.mesh.material.dispose();
    this.glow.geometry.dispose(); this.glow.material.dispose();
    this.trail.forEach(t => { this.scene.remove(t.mesh); t.mesh.geometry.dispose(); t.mesh.material.dispose(); });
    this.trail = [];
  }
}
