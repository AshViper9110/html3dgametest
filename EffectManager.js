class EffectManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.particleManager = new ParticleManager(scene);
    this.lightPool = new LightPool(scene);
    this.activeEffects = [];

    this._initGeos();
    this._meshPool = [];
    this._matPool = [];
    this._poolMax = 100;
    this._lodDist = 30;
  }

  _allocMat(color, additive, opacity) {
    let mat = this._matPool.pop();
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: opacity !== undefined ? opacity : 1,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: !additive,
      });
    } else {
      mat.color.setHex(color);
      mat.opacity = opacity !== undefined ? opacity : 1;
    }
    return mat;
  }

  _freeMat(mat) {
    mat.color.setHex(0xffffff);
    mat.opacity = 1;
    if (this._matPool.length < this._poolMax * 2) this._matPool.push(mat);
  }

  _initGeos() {
    const g = (k, fn) => SHARED.geo('fx_' + k, fn);
    this._g = {
      ring4: g('ring4', () => new THREE.RingGeometry(0.1, 0.3, 4)),
      ring8: g('ring8', () => new THREE.RingGeometry(0.1, 0.4, 8)),
      ring12: g('ring12', () => new THREE.RingGeometry(0.3, 0.8, 12)),
      ring_exp: g('ring_exp', () => new THREE.RingGeometry(0.2, 0.5, 12)),
      sphere4: g('sphere4', () => new THREE.SphereGeometry(0.3, 4, 4)),
      sphere5: g('sphere5', () => new THREE.SphereGeometry(0.3, 5, 5)),
      sphere6: g('sphere6', () => new THREE.SphereGeometry(0.4, 6, 6)),
      sphere8: g('sphere8', () => new THREE.SphereGeometry(0.8, 6, 6)),
      sphere10: g('sphere10', () => new THREE.SphereGeometry(0.5, 6, 6)),
      sphere_glow: g('sphere_glow', () => new THREE.SphereGeometry(0.8, 6, 6)),
      sphere_exp: g('sphere_exp', () => new THREE.SphereGeometry(0.8, 8, 8)),
      sphere_glow2: g('sphere_glow2', () => new THREE.SphereGeometry(2, 8, 8)),
      cyl: g('cyl', () => new THREE.CylinderGeometry(0.02, 0.08, 1.5, 4)),
      cyl_sm: g('cyl_sm', () => new THREE.CylinderGeometry(0.015, 0.05, 0.8, 4)),
      plane: g('plane', () => new THREE.PlaneGeometry(1, 1)),
      box_sm: g('box_sm', () => new THREE.BoxGeometry(0.05, 0.05, 0.12)),
      casing: g('casing', () => new THREE.BoxGeometry(0.04, 0.02, 0.08)),
      debris: g('debris', () => new THREE.BoxGeometry(0.06, 0.04, 0.06)),
      shock_ring: g('shock_ring', () => new THREE.RingGeometry(0.05, 0.15, 16)),
      kill_ring: g('kill_ring', () => new THREE.RingGeometry(0.5, 1.5, 12)),
      respawn_ring: g('respawn_ring', () => new THREE.RingGeometry(0.3, 0.8, 12)),
      respawn_pillar: g('respawn_pillar', () => new THREE.CylinderGeometry(0.05, 1.0, 3, 6)),
      landing_ring: g('landing_ring', () => new THREE.RingGeometry(0.3, 0.8, 8)),
      dash_ring: g('dash_ring', () => new THREE.RingGeometry(0.2, 0.5, 8)),
      jumppad_ring: g('jumppad_ring', () => new THREE.RingGeometry(0.2, 0.6, 8)),
      tracer: g('tracer', () => new THREE.CylinderGeometry(0.02, 0.02, 1, 4)),
    };
  }

  _allocMesh(geoKey, color, additive, opacity) {
    const mat = this._allocMat(color, additive, opacity);
    let mesh = this._meshPool.pop();
    if (!mesh) {
      const geo = this._g[geoKey] || this._g.sphere4;
      mesh = new THREE.Mesh(geo, mat);
    } else {
      const g = this._g[geoKey] || this._g.sphere4;
      if (mesh.geometry !== g) mesh.geometry = g;
      mesh.material = mat;
    }
    mesh.visible = true;
    mesh.scale.setScalar(1);
    mesh.rotation.set(0, 0, 0);
    mesh.renderOrder = 0;
    return mesh;
  }

  _freeMesh(mesh) {
    if (mesh.parent) this.scene.remove(mesh);
    mesh.visible = false;
    if (mesh.material) this._freeMat(mesh.material);
    if (this._meshPool.length < this._poolMax) this._meshPool.push(mesh);
  }

  _addEffect(mesh, maxLife, scaleSpeed, cleanup) {
    this.scene.add(mesh);
    this.activeEffects.push({
      mesh, life: 0, maxLife: maxLife || 0.2,
      scaleSpeed: scaleSpeed || 0, cleanup,
    });
  }

  _getDist(pos) {
    if (!this.camera) return 0;
    _v3c.copy(pos).sub(this.camera.position);
    return _v3c.length();
  }

  _shouldLod(pos, near, far) {
    const d = this._getDist(pos);
    if (d > (far || this._lodDist)) return true;
    if (d > (near || 15)) return 'partial';
    return false;
  }

  spawnMuzzleFlash(pos, dir, color, weapon) {
    const c = color || 0xffee00;
    const p = _v3a.copy(pos).addScaledVector(dir, 0.8);
    p.y += CONFIG.playerHeight * 0.6;
    const d = this._getDist(p);

    const wp = weapon ? (WEAPONS[weapon] || null) : null;
    const wType = wp ? (wp.weaponType || wp.fireMode || '') : '';
    const isShotgun = wType === 'shotgun' || weapon && (weapon.includes('shotgun') || weapon.includes('shotgun'));
    const isSniper = wType === 'sniper' || weapon && (weapon.includes('sniper') || weapon.includes('sniper'));
    const isBeam = wType === 'beam' || weapon && (weapon.includes('beam') || weapon.includes('laser') || weapon.includes('plasma'));
    const isRocket = wType === 'explosive' || weapon && (weapon.includes('rpg') || weapon.includes('rocket') || weapon.includes('launcher'));
    const isSMG = weapon && (weapon.includes('smg') || weapon.includes('vector') || weapon.includes('p90'));

    if (d < 25) {
      let flashSize = 1;
      let glowSize = 1;
      let lifeMul = 1;
      if (isShotgun) { flashSize = 2.5; glowSize = 2; lifeMul = 1.5; }
      else if (isSniper) { flashSize = 2; glowSize = 2.5; lifeMul = 2; }
      else if (isRocket) { flashSize = 2.5; glowSize = 2; lifeMul = 1.8; }
      else if (isSMG) { flashSize = 0.6; glowSize = 0.5; lifeMul = 0.7; }
      else if (isBeam) { flashSize = 0.8; glowSize = 1; lifeMul = 1.2; }

      const flash = this._allocMesh('sphere4', 0xffffff, true, 0.9);
      flash.position.copy(p);
      flash.scale.setScalar(flashSize);
      this._addEffect(flash, 0.06 * lifeMul, 6);

      const glow = this._allocMesh('sphere8', c, true, 0.4);
      glow.position.copy(p);
      glow.scale.setScalar(glowSize);
      this._addEffect(glow, 0.1 * lifeMul, 4);

      const beam = this._allocMesh('cyl', c, true, 0.3);
      beam.position.copy(p);
      _quat.setFromUnitVectors(_v3b.set(0, 1, 0), dir);
      beam.quaternion.copy(_quat);
      this._addEffect(beam, 0.08 * lifeMul);

      const ring = this._allocMesh('ring4', c, true, 0.5);
      ring.position.copy(p);
      ring.lookAt(_v3a.copy(p).add(dir));
      this._addEffect(ring, 0.1 * lifeMul, 3);
    }

    this.lightPool.get(c, p, isShotgun ? 6 : (isSniper ? 8 : 3), isShotgun ? 15 : (isSniper ? 20 : 8), isShotgun ? 0.25 : (isSniper ? 0.3 : 0.12));

    if (d < 35) {
      const sparkCount = isShotgun ? 8 : (isRocket ? 6 : (isSniper ? 6 : (isSMG ? 2 : 4)));
      for (let i = 0; i < sparkCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = (isShotgun ? 3 + Math.random() * 6 : (isSniper ? 4 + Math.random() * 8 : 2 + Math.random() * 4));
        _v3c.set(
          dir.x * spd + Math.cos(a) * (isShotgun ? 4 : 2),
          (Math.random() - 0.5) * (isShotgun ? 5 : 3),
          dir.z * spd + Math.sin(a) * (isShotgun ? 4 : 2)
        );
        this.particleManager._addSpark(c, p, _v3c, 0.08 + Math.random() * 0.1 * (isShotgun ? 1.5 : 1));
      }
    }

    if (isShotgun && d < 30) {
      this.particleManager.spawnSmoke(p, 0x666666, 3);
    }
  }

  spawnHitEffect(pos, color, surfaceType) {
    const c = color || 0xffffff;
    const d = this._getDist(pos);
    const t = surfaceType || 'wall';
    const isMetal = t === 'metal';
    const isPlayer = t === 'player';
    const isFloor = t === 'floor';

    if (d < 30) {
      const sparkCount = isMetal ? 8 : (isPlayer ? 3 : 5);
      const sparkColor = isMetal ? 0xffaa00 : (isPlayer ? 0x00ffff : c);
      for (let i = 0; i < sparkCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 3 + Math.random() * (isMetal ? 12 : 8);
        _v3c.set(
          Math.cos(a) * spd,
          (Math.random() - 0.5) * (isFloor ? 3 : 6),
          Math.sin(a) * spd
        );
        this.particleManager._addSpark(sparkColor, pos, _v3c, 0.12 + Math.random() * 0.1 * (isMetal ? 1.5 : 1));
      }

      if (isMetal && d < 20) {
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * Math.PI * 2;
          _v3c.set(Math.cos(a) * 5, 2 + Math.random() * 4, Math.sin(a) * 5);
          this.particleManager._addDebris(pos, _v3c, 0.2 + Math.random() * 0.2);
        }
      }

      if (isFloor) {
        this.particleManager.spawnSmoke(pos, 0x555555, 2);
      }

      if (isPlayer && d < 15) {
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * Math.PI * 2;
          _v3c.set(Math.cos(a) * 4, Math.random() * 4, Math.sin(a) * 4);
          this.particleManager._addParticle(0x00ffff, pos, _v3c, 0.2 + Math.random() * 0.15, 0.08);
        }
      }

      const ring = this._allocMesh('ring8', sparkColor, true, 0.6);
      ring.position.copy(pos);
      if (!isFloor) ring.rotation.x = -Math.PI / 2;
      this._addEffect(ring, 0.18, 4);
    }

    if (d < 18) {
      const flash = this._allocMesh('sphere5', 0xffffff, true, 0.8);
      flash.position.copy(pos);
      this._addEffect(flash, 0.05, 3);
    }

    this.lightPool.get(isMetal ? 0xff8800 : (isPlayer ? 0x00ffff : c), pos, isMetal ? 4 : 2, isMetal ? 8 : 6, 0.12);
  }

  spawnExplosion(pos, color) {
    const c = color || 0xff4400;
    const d = this._getDist(pos);

    if (d < 25) {
      const flash = this._allocMesh('sphere10', 0xffffff, true, 1);
      flash.position.copy(pos);
      flash.scale.setScalar(2);
      this._addEffect(flash, 0.06, 8);

      const boom = this._allocMesh('sphere_exp', c, true, 0.7);
      boom.position.copy(pos);
      boom.scale.setScalar(1.5);
      this._addEffect(boom, 0.3, 5);

      const ring = this._allocMesh('ring12', c, true, 0.8);
      ring.position.copy(pos);
      ring.rotation.x = -Math.PI / 2;
      this._addEffect(ring, 0.25, 6);

      const ring2 = this._allocMesh('ring_exp', c, true, 0.4);
      ring2.position.copy(pos);
      this._addEffect(ring2, 0.4, 4);

      const shock = this._allocMesh('shock_ring', 0xffffff, true, 0.6);
      shock.position.copy(pos);
      shock.position.y = 0.05;
      shock.rotation.x = -Math.PI / 2;
      this._addEffect(shock, 0.3, 8);

      const afterglow = this._allocMesh('sphere_glow2', c, true, 0.15);
      afterglow.position.copy(pos);
      this._addEffect(afterglow, 0.6, 2);
    }

    if (d < 35) {
      this.particleManager.spawnExplosionParticles(pos, c, d < 20 ? 20 : 12);
      this.particleManager.spawnSparks(pos, 0xffffaa, d < 20 ? 8 : 4);
      this.particleManager.spawnSmoke(pos, 0x444444, d < 20 ? 5 : 3);
      this.particleManager.spawnDebris(pos, d < 20 ? 5 : 2);
    }

    this.lightPool.get(0xff8800, pos, 8, 20, 0.4);
    this.lightPool.get(c, pos, 4, 12, 0.25);
  }

  spawnHitMarker(pos) {
    const d = this._getDist(pos);
    if (d > 20) return;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      _v3c.set(Math.cos(a) * 3, Math.sin(a) * 3, 0);
      this.particleManager._addSpark(0xffffff, pos, _v3c, 0.12);
    }
    this.lightPool.get(0xffffff, pos, 1, 4, 0.08);
  }

  spawnKillEffect(pos) {
    const d = this._getDist(pos);
    _v3c.set(pos.x, 0.5, pos.z);

    if (d < 25) {
      const ring = this._allocMesh('kill_ring', 0xff0044, true, 0.6);
      ring.position.copy(_v3c);
      ring.rotation.x = -Math.PI / 2;
      this._addEffect(ring, 0.4, 6);

      const glow = this._allocMesh('sphere_glow', 0xff0044, true, 0.3);
      glow.position.copy(_v3c);
      glow.scale.setScalar(2);
      this._addEffect(glow, 0.25, 4);
    }

    if (d < 30) {
      this.particleManager.spawnNeonBurst(_v3c, 0xff0044, d < 15 ? 12 : 6);
      for (let i = 0; i < (d < 15 ? 8 : 3); i++) {
        const a = Math.random() * Math.PI * 2;
        _v3a.set(Math.cos(a) * (8 + Math.random() * 6), (Math.random() - 0.5) * 4, Math.sin(a) * (8 + Math.random() * 6));
        this.particleManager._addSpark(0xff4488, _v3c, _v3a, 0.3 + Math.random() * 0.2);
      }
    }

    this.lightPool.get(0xff0044, _v3c, 6, 15, 0.35);
  }

  spawnTracer(startPos, endPos, color, length) {
    const d = this._getDist(startPos);
    if (d > 40) return;
    _v3a.copy(endPos).sub(startPos);
    const len = _v3a.length();
    if (len < 0.1) return;
    const tracerLen = Math.min(length || len, len);
    const key = 'tracer_' + tracerLen.toFixed(1);
    const geo = SHARED.geo(key, () => new THREE.CylinderGeometry(0.015, 0.015, tracerLen, 4));
    const mat = this._allocMat(color || 0xffee00, true, 0.6);
    const mesh = new THREE.Mesh(geo, mat);
    _v3b.copy(startPos).add(endPos).multiplyScalar(0.5);
    _v3c.subVectors(endPos, startPos).normalize();
    mesh.position.copy(_v3b);
    mesh.quaternion.setFromUnitVectors(_v3b.set(0, 1, 0), _v3c);
    this._addEffect(mesh, 0.06);
  }

  spawnCasing(pos, dir, color) {
    const d = this._getDist(pos);
    if (d > 20) return;
    const mat = this._allocMat(color || 0xffaa00, false, 1);
    const mesh = new THREE.Mesh(this._g.casing, mat);
    mesh.position.set(pos.x + (Math.random() - 0.5) * 0.2, pos.y + 0.3, pos.z + (Math.random() - 0.5) * 0.2);
    const vx = dir.x * (1 + Math.random() * 2) + (Math.random() - 0.5) * 2;
    const vy = 2 + Math.random() * 3;
    const vz = dir.z * (1 + Math.random() * 2) + (Math.random() - 0.5) * 2;
    this._addEffect(mesh, 0.5 + Math.random() * 0.3, 0);
    const fx = this.activeEffects[this.activeEffects.length - 1];
    fx._vx = vx; fx._vy = vy; fx._vz = vz;
  }

  spawnDashEffect(pos, dir) {
    _v3c.copy(pos);
    _v3c.y += CONFIG.playerHeight * 0.3;
    const d = this._getDist(_v3c);

    if (d < 25) {
      const ring = this._allocMesh('dash_ring', 0x00f0ff, true, 0.4);
      ring.position.copy(_v3c);
      ring.rotation.x = -Math.PI / 2;
      this._addEffect(ring, 0.2, 4);

      for (let i = 0; i < (d < 15 ? 5 : 3); i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 0.5 + Math.random() * 1.5;
        _v3a.set(Math.cos(a) * r * 3, (Math.random() - 0.5) * 2, Math.sin(a) * r * 3);
        this.particleManager._addParticle(0x00f0ff, _v3c, _v3a, 0.12 + Math.random() * 0.1, 0.08);
      }
    }

    if (d < 20) {
      this.particleManager.spawnSpeedLines(_v3c, dir, d < 10 ? 8 : 4);
    }

    this.lightPool.get(0x00f0ff, _v3c, 3, 8, 0.15);
  }

  spawnLandingEffect(pos) {
    _v3c.copy(pos);
    _v3c.y = 0.05;
    const d = this._getDist(_v3c);

    if (d < 20) {
      const ring = this._allocMesh('landing_ring', 0x00f0ff, true, 0.3);
      ring.position.copy(_v3c);
      ring.rotation.x = -Math.PI / 2;
      this._addEffect(ring, 0.15, 5);

      if (d < 10) {
        this.particleManager.spawnSmoke(pos, 0x555555, 2);
      }
    }
  }

  spawnSpeedLines(pos, dir, count) {
    const d = this._getDist(pos);
    if (d > 20) return;
    this.particleManager.spawnSpeedLines(pos, dir, d < 10 ? (count || 6) : 3);
  }

  spawnJumpPadEffect(pos, color) {
    const c = color || 0x00f0ff;
    _v3c.copy(pos);
    _v3c.y = 0.1;
    const d = this._getDist(_v3c);

    if (d < 25) {
      this.particleManager.spawnJumpPadParticles(_v3c, c);

      const ring = this._allocMesh('jumppad_ring', c, true, 0.3);
      ring.position.copy(_v3c);
      ring.rotation.x = -Math.PI / 2;
      this._addEffect(ring, 0.25, 3);
    }

    this.lightPool.get(c, _v3c, 2, 6, 0.25);
  }

  spawnRespawnEffect(pos, color) {
    const c = color || 0x00f0ff;
    _v3c.copy(pos);
    _v3c.y = 0.5;
    const d = this._getDist(_v3c);

    if (d < 30) {
      this.particleManager.spawnRespawnParticles(_v3c, c, d < 15 ? 15 : 8);

      const ring = this._allocMesh('respawn_ring', c, true, 0.5);
      ring.position.copy(_v3c);
      ring.rotation.x = -Math.PI / 2;
      this._addEffect(ring, 0.35, 4);

      const pillar = this._allocMesh('respawn_pillar', c, true, 0.2);
      pillar.position.copy(_v3c);
      pillar.position.y += 1.5;
      this._addEffect(pillar, 0.5);
    }

    this.lightPool.get(c, _v3c, 4, 10, 0.4);
  }

  spawnTrailSegment(pos, color, speed) {
    const d = this._getDist(pos);
    if (d > 30) return;
    const trailLen = Math.min(1 + speed / 30, 3);
    const seg = this._allocMesh('sphere4', color, true, 0.3);
    seg.position.copy(pos);
    seg.scale.setScalar(0.5 + trailLen * 0.15);
    this._addEffect(seg, 0.2 + speed * 0.004);
  }

  spawnPlayerDamageFlash(player) {
    const d = this._getDist(player.mesh.position);
    if (d > 15) return;
    const flash = this._allocMesh('plane', 0xffffff, false, 0.5);
    flash.scale.set(CONFIG.playerSize * 1.5, CONFIG.playerHeight * 1.5, 1);
    flash.position.copy(player.mesh.position);
    flash.position.y = CONFIG.playerHeight / 2;
    flash.lookAt(this.camera.position);
    flash.renderOrder = 2;
    this._addEffect(flash, 0.08);
  }

  update(dt) {
    this.particleManager.update(dt);
    this.lightPool.update(dt);

    const effects = this.activeEffects;
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      e.life += dt;
      if (e.life >= e.maxLife) {
        this._freeMesh(e.mesh);
        if (e.cleanup) e.cleanup();
        effects.splice(i, 1);
        continue;
      }
      const t = e.life / e.maxLife;
      const mesh = e.mesh;
      if (e._vx !== undefined) {
        const g = 9.8 * dt;
        mesh.position.x += e._vx * dt;
        mesh.position.z += e._vz * dt;
        e._vy -= g;
        mesh.position.y += e._vy * dt;
        mesh.rotation.x += dt * 10;
        mesh.rotation.z += dt * 8;
        if (e._vy < -g && mesh.position.y < 0.1) {
          mesh.position.y = 0.1;
          e._vy *= -0.3;
          e._vx *= 0.5;
          e._vz *= 0.5;
        }
      }
      if (mesh.material && mesh.material.opacity !== undefined) {
        mesh.material.opacity = Math.max(0, 1 - t);
      }
      if (e.scaleSpeed) {
        const s = 1 + t * e.scaleSpeed;
        mesh.scale.setScalar(s);
      }
    }
  }

  getParticleCount() {
    return this.particleManager.count + this.activeEffects.length;
  }

  clear() {
    this.activeEffects.forEach(e => {
      if (e.mesh.parent) this.scene.remove(e.mesh);
      if (e.cleanup) e.cleanup();
    });
    this._meshPool.forEach(m => { if (m.parent) this.scene.remove(m); if (m.material) m.material.dispose(); });
    this._matPool.forEach(m => m.dispose());
    this.activeEffects = [];
    this._meshPool = [];
    this._matPool = [];
    this.particleManager.clear();
    this.lightPool.releaseAll();
  }
}
