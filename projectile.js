class Projectile {
  constructor(scene, origin, dir, ownerId, id, color, weapon) {
    this.scene = scene;
    this.ownerId = ownerId;
    this.id = id;
    this.weapon = weapon || 'pistol';
    this.wp = WEAPONS[this.weapon] || WEAPONS.pistol;
    this.alive = true;
    this.age = 0;
    this.color = color || this.wp.color;
    this.isHostProjectile = false;
    this.isRemote = false;

    const r = this.wp.projRadius || 0.2;
    const geo = new THREE.SphereGeometry(r * 1.5, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: this.color });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(origin);
    this.mesh.position.y += CONFIG.playerHeight * 0.6;
    this.scene.add(this.mesh);

    this.velocity = dir.clone().multiplyScalar(this.wp.projSpeed || 50);
    this.velocity.y = 0;

    const ggeo = new THREE.SphereGeometry(r * 3, 6, 6);
    const gmat = new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.25 });
    this.glow = new THREE.Mesh(ggeo, gmat);
    this.glow.position.copy(this.mesh.position);
    this.scene.add(this.glow);

    this.trail = [];
    this.trailTimer = 0;
    this.exploded = false;
    this.hitPlayers = new Set();
    this.speed = this.wp.projSpeed || 50;
  }

  update(dt) {
    if (!this.alive) return;
    this.age += dt;
    if (this.age > this.wp.projLifetime) { this.destroy(); return; }

    this.mesh.position.x += this.velocity.x * dt;
    this.mesh.position.z += this.velocity.z * dt;

    const half = 40;
    if (Math.abs(this.mesh.position.x) > half || Math.abs(this.mesh.position.z) > half) {
      this.destroy();
      return;
    }

    this.glow.position.copy(this.mesh.position);
    const pulse = 1 + 0.3 * Math.sin(this.age * 20);
    this.glow.scale.setScalar(pulse);

    this.trailTimer += dt;
    const trailRate = Math.max(0.01, 0.04 - this.speed * 0.0003);
    if (this.trailTimer > trailRate) {
      this.trailTimer = 0;
      this._spawnTrail();
    }

    const trailLife = 0.2 + this.speed * 0.006;
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const t = this.trail[i];
      t.life += dt;
      if (t.life > trailLife) {
        this.scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        t.mesh.material.dispose();
        this.trail.splice(i, 1);
        continue;
      }
      const s = t.life / trailLife;
      const scale = (1 - s) * (0.5 + this.speed * 0.02);
      t.mesh.scale.setScalar(Math.max(scale, 0.01));
      t.mesh.material.opacity = (1 - s) * 0.4;
    }
  }

  _spawnTrail() {
    const r = this.wp.projRadius || 0.2;
    const trailSize = r * (0.5 + this.speed * 0.01);
    const geo = new THREE.SphereGeometry(Math.min(trailSize, 0.5), 4, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: 0.4,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(this.mesh.position);
    this.scene.add(m);
    this.trail.push({ mesh: m, life: 0 });
  }

  explosionFX() {
    if (this.exploded) return;
    this.exploded = true;
    const r = (this.wp.projRadius || 0.2) * 8;
    const geo = new THREE.SphereGeometry(r, 10, 10);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.6,
    });
    const boom = new THREE.Mesh(geo, mat);
    boom.position.copy(this.mesh.position);
    this.scene.add(boom);
    const start = performance.now();
    const anim = () => {
      const t = (performance.now() - start) / 400;
      if (t >= 1) {
        this.scene.remove(boom);
        boom.geometry.dispose();
        boom.material.dispose();
        return;
      }
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
    if (this.mesh.parent) this.scene.remove(this.mesh);
    if (this.glow.parent) this.scene.remove(this.glow);
    try { this.mesh.geometry.dispose(); } catch(e) {}
    try { this.mesh.material.dispose(); } catch(e) {}
    try { this.glow.geometry.dispose(); } catch(e) {}
    try { this.glow.material.dispose(); } catch(e) {}
    this.trail.forEach(t => {
      if (t.mesh.parent) this.scene.remove(t.mesh);
      try { t.mesh.geometry.dispose(); } catch(e) {}
      try { t.mesh.material.dispose(); } catch(e) {}
    });
    this.trail = [];
  }
}
