class ObjectPool {
  constructor(factory, reset, maxSize = 200) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;
    this.pool = [];
    this.active = [];
  }

  get() {
    let obj;
    if (this.pool.length > 0) {
      obj = this.pool.pop();
    } else {
      obj = this.factory();
    }
    this.active.push(obj);
    return obj;
  }

  release(obj) {
    const idx = this.active.indexOf(obj);
    if (idx >= 0) this.active.splice(idx, 1);
    if (this.reset) this.reset(obj);
    if (this.pool.length < this.maxSize) {
      this.pool.push(obj);
    }
  }

  releaseAll() {
    while (this.active.length > 0) {
      const obj = this.active.pop();
      if (this.reset) this.reset(obj);
      if (this.pool.length < this.maxSize) {
        this.pool.push(obj);
      }
    }
  }

  get activeCount() { return this.active.length; }
  get poolSize() { return this.pool.length; }

  disposeAll(disposeFn) {
    this.releaseAll();
    this.pool.forEach(obj => { if (disposeFn) disposeFn(obj); });
    this.pool = [];
  }
}

const SHARED = {
  _geo: {},
  _mat: {},

  geo(key, factory) {
    if (!this._geo[key]) this._geo[key] = factory();
    return this._geo[key];
  },

  mat(key, factory) {
    if (!this._mat[key]) this._mat[key] = factory();
    return this._mat[key];
  },

  getMat(color, additive, opacity) {
    const a = additive ? '_add' : '';
    const o = '_o' + (opacity !== undefined ? Math.round(opacity * 100) : 100);
    const key = 'shared_mat_' + color.toString(16) + a + o;
    return this.mat(key, () => {
      const m = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: opacity !== undefined ? opacity : 1,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: !additive,
      });
      return m;
    });
  },

  disposeAll() {
    for (const key in this._geo) { try { this._geo[key].dispose(); } catch(e) {} }
    for (const key in this._mat) { try { this._mat[key].dispose(); } catch(e) {} }
    this._geo = {};
    this._mat = {};
  }
};

const _v3a = new THREE.Vector3();
const _v3b = new THREE.Vector3();
const _v3c = new THREE.Vector3();
const _quat = new THREE.Quaternion();
