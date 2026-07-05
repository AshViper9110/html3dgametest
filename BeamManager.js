class BeamManager {
  constructor(scene) {
    this.scene = scene;
    this.activeBeams = [];
    this.impactEffects = [];
    this._dir = new THREE.Vector3();
    this._mid = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
  }

  fireBeam(startPos, endPos, weaponDef, color) {
    const wp = weaponDef || {};
    const isPlasma = wp.id === 'plasma_rifle' || color === 0x00ffcc;
    const beamColor = color || wp.color || 0x88ddff;
    const duration = isPlasma ? 0.12 : 0.05;

    const beam = {
      start: _v3a.copy(startPos),
      end: _v3b.copy(endPos),
      color: beamColor,
      life: duration,
      maxLife: duration,
      isPlasma,
      mesh: null, mat: null,
      glow: null, glowMat: null,
    };

    this._createBeamMesh(beam);
    this.activeBeams.push(beam);
    this._spawnImpactEffect(endPos, beamColor, isPlasma);
  }

  _createBeamMesh(beam) {
    const dir = this._dir.subVectors(beam.end, beam.start);
    const length = dir.length();
    const isPlasma = beam.isPlasma;

    const radius = isPlasma ? 0.18 : 0.10;
    const geoKey = 'beam_' + (isPlasma ? 'plasma' : 'std') + '_' + length.toFixed(1);
    const geo = SHARED.geo(geoKey, () => new THREE.CylinderGeometry(radius, radius, length, 8, 1, false));

    beam.mat = new THREE.MeshBasicMaterial({
      color: beam.color, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    beam.mesh = new THREE.Mesh(geo, beam.mat);
    this._mid.copy(beam.start).add(beam.end).multiplyScalar(0.5);
    beam.mesh.position.copy(this._mid);
    beam.mesh.quaternion.setFromUnitVectors(this._up, dir.normalize());
    this.scene.add(beam.mesh);

    const glowRadius = radius * 2.2;
    const glowGeoKey = 'beam_glow_' + (isPlasma ? 'plasma' : 'std') + '_' + length.toFixed(1);
    const glowGeo = SHARED.geo(glowGeoKey, () => new THREE.CylinderGeometry(glowRadius, glowRadius, length, 8, 1, false));
    beam.glowMat = new THREE.MeshBasicMaterial({
      color: beam.color, transparent: true, opacity: isPlasma ? 0.35 : 0.18,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    beam.glow = new THREE.Mesh(glowGeo, beam.glowMat);
    beam.glow.position.copy(beam.mesh.position);
    beam.glow.quaternion.copy(beam.mesh.quaternion);
    this.scene.add(beam.glow);

    this.lightPoolEntry = null;
  }

  _spawnImpactEffect(pos, color, isPlasma) {
    const sparkCount = isPlasma ? 12 : 6;
    const sparkPos = new Float32Array(sparkCount * 3);
    for (let i = 0; i < sparkCount; i++) {
      sparkPos[i * 3] = pos.x + (Math.random() - 0.5) * 0.8;
      sparkPos[i * 3 + 1] = pos.y + 0.3 + Math.random() * 0.5;
      sparkPos[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.8;
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    const sparkMat = new THREE.PointsMaterial({
      color, size: 0.15, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    const sparkMesh = new THREE.Points(sparkGeo, sparkMat);
    this.scene.add(sparkMesh);

    const ringMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.4,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(this._getRingGeo(isPlasma), ringMat);
    ring.position.set(pos.x, 0.15, pos.z);
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);

    this.impactEffects.push({
      mesh: sparkMesh, geo: sparkGeo, mat: sparkMat,
      life: 0.3, maxLife: 0.3, type: 'spark',
    });
    this.impactEffects.push({
      mesh: ring, mat: ringMat,
      life: 0.25, maxLife: 0.25, type: 'ring',
    });

    if (isPlasma) {
      const boomGeo = SHARED.geo('impact_boom_0.5', () => new THREE.SphereGeometry(0.5, 8, 8));
      const boomMat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.3,
        blending: THREE.AdditiveBlending,
      });
      const boom = new THREE.Mesh(boomGeo, boomMat);
      boom.position.set(pos.x, 0.3, pos.z);
      this.scene.add(boom);
      this.impactEffects.push({
        mesh: boom, mat: boomMat,
        life: 0.3, maxLife: 0.3, type: 'plasma_boom',
      });
    }

    if (this.lightPoolEntry !== null) {
      try { this.lightPoolEntry.light.parent.remove(this.lightPoolEntry.light); } catch(e) {}
    }
    const light = new THREE.PointLight(color, isPlasma ? 3 : 1.5, isPlasma ? 12 : 8);
    light.position.set(pos.x, 0.5, pos.z);
    this.scene.add(light);
    this.lightPoolEntry = { light, life: 0, maxLife: isPlasma ? 0.3 : 0.15 };
  }

  _getRingGeo(isPlasma) {
    return SHARED.geo('impact_ring_' + (isPlasma ? '0.6' : '0.3'),
      () => new THREE.RingGeometry(0.1, isPlasma ? 0.6 : 0.3, 16));
  }

  update(dt) {
    for (let i = this.activeBeams.length - 1; i >= 0; i--) {
      const beam = this.activeBeams[i];
      beam.life -= dt;
      const t = Math.max(0, beam.life / beam.maxLife);
      if (beam.glowMat) beam.glowMat.opacity = t * (beam.isPlasma ? 0.35 : 0.18);
      if (beam.mat) beam.mat.opacity = t * 0.9;
      if (beam.glow) {
        const s = 1 + (1 - t) * 0.3;
        beam.glow.scale.setScalar(s);
      }
      if (beam.life <= 0) {
        this._removeBeam(beam);
        this.activeBeams.splice(i, 1);
      }
    }

    for (let i = this.impactEffects.length - 1; i >= 0; i--) {
      const fx = this.impactEffects[i];
      fx.life -= dt;
      const t = Math.max(0, fx.life / fx.maxLife);
      if (fx.type === 'spark') fx.mat.opacity = t * 0.8;
      else if (fx.type === 'ring') {
        fx.mat.opacity = t * 0.4;
        const s = 1 + (1 - t) * 2;
        fx.mesh.scale.setScalar(s);
      } else if (fx.type === 'plasma_boom') {
        fx.mat.opacity = t * 0.3;
        const s = 1 + (1 - t) * 3;
        fx.mesh.scale.setScalar(s);
      }
      if (fx.life <= 0) {
        if (fx.mesh.parent) this.scene.remove(fx.mesh);
        this.impactEffects.splice(i, 1);
      }
    }

    if (this.lightPoolEntry) {
      this.lightPoolEntry.life += dt;
      if (this.lightPoolEntry.life >= this.lightPoolEntry.maxLife) {
        try { this.scene.remove(this.lightPoolEntry.light); } catch(e) {}
        this.lightPoolEntry = null;
      } else {
        const t = 1 - this.lightPoolEntry.life / this.lightPoolEntry.maxLife;
        this.lightPoolEntry.light.intensity = t * (this.lightPoolEntry.light.intensity > 2 ? 3 : 1.5);
      }
    }
  }

  _removeBeam(beam) {
    if (beam.mesh && beam.mesh.parent) this.scene.remove(beam.mesh);
    if (beam.glow && beam.glow.parent) this.scene.remove(beam.glow);
  }

  clear() {
    this.activeBeams.forEach(b => this._removeBeam(b));
    this.activeBeams = [];
    this.impactEffects.forEach(fx => { if (fx.mesh.parent) this.scene.remove(fx.mesh); });
    this.impactEffects = [];
    if (this.lightPoolEntry) {
      try { this.scene.remove(this.lightPoolEntry.light); } catch(e) {}
      this.lightPoolEntry = null;
    }
  }
}
