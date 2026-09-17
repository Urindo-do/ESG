import * as THREE from 'three';
import {
  PLACEMENTS, TREES, BUSHES, TRASH, FACTORIES, CLOUDS, TOOL_SPOTS, ISLAND_RADIUS, STREAM,
  streamX, inStream, distanceToPath, OBSTACLES,
} from './layout.js';
import { groundHeightAt } from '../scene/Ground.js';
import { patchGrime, grimeUniforms } from '../character/grime.js';

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const CLICK_BY_ID = { house: 'house', garden: 'garden', bench: 'bench', sign: 'sign', bins: 'bins', mailbox: 'mailbox' };

function prepare(obj, { cast = true, receive = true } = {}) {
  obj.traverse(o => {
    if (o.isMesh) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
  return obj;
}

function firstMesh(obj) {
  let found = null;
  obj.updateMatrixWorld(true);
  obj.traverse(o => { if (!found && o.isMesh) found = o; });
  return found;
}

function nearObstacle(x, z, margin) {
  return OBSTACLES.some(o => Math.hypot((x - o.x) / (o.sx ?? 1), (z - o.z) / (o.sz ?? 1)) < o.r + margin);
}

/** 꽃·풀 인스턴스: 상태에 따라 보이는 정도(level)와 색이 바뀐다 */
class FloraLayer {
  constructor(sourceMeshes, spots, { levels, colors = null, dryColor = null, baseScale = 1 }) {
    // 나타나는 순서(t)대로 정렬해 두면 보이는 개수만큼만 그릴 수 있다
    this.spots = [...spots].sort((a, b) => a.t - b.t);
    this.levels = levels;
    this.baseScale = baseScale;
    this.colors = colors;
    this.dryColor = dryColor ? new THREE.Color(dryColor) : null;
    // 원본 노드의 변환(양자화 복원 포함)을 인스턴스 행렬 뒤에 곱한다
    this.local = sourceMeshes.map(src => src.matrixWorld.clone());
    this.tmpM = new THREE.Matrix4();
    this.meshes = sourceMeshes.map(src => {
      const m = new THREE.InstancedMesh(src.geometry, src.material, spots.length);
      m.castShadow = false;
      m.receiveShadow = true;
      m.frustumCulled = false;
      return m;
    });
    this.group = new THREE.Group();
    this.group.add(...this.meshes);
    this.dummy = new THREE.Object3D();
    this.lastKey = '';
    this.tmp = new THREE.Color();
    this.update({ default: 1, happy: 0, sad: 0 }, true);
  }

  update(w, force = false) {
    const level = this.levels.default * w.default + this.levels.happy * w.happy + this.levels.sad * w.sad;
    const key = `${level.toFixed(3)}:${w.sad.toFixed(3)}`;
    if (!force && key === this.lastKey) return;
    this.lastKey = key;
    const d = this.dummy;
    this.spots.forEach((s, i) => {
      const vis = Math.min(1, Math.max(0, (level - s.t) / 0.12));
      const k = vis * vis * (3 - 2 * vis);
      d.position.set(s.x, s.y, s.z);
      d.rotation.set(s.tilt, s.rot, 0);
      d.scale.setScalar(Math.max(0.0001, k * s.scale * this.baseScale * (1 - 0.25 * w.sad)));
      d.updateMatrix();
      this.meshes.forEach((m, mi) => m.setMatrixAt(i, this.tmpM.multiplyMatrices(d.matrix, this.local[mi])));
      if (this.colors) {
        const c = this.tmp.set(this.colors[s.colorIndex % this.colors.length]);
        if (this.dryColor) c.lerp(this.dryColor, w.sad * 0.85);
        this.meshes[this.meshes.length - 1].setColorAt(i, c);
      }
    });
    let visible = 0;
    while (visible < this.spots.length && this.spots[visible].t < level) visible++;
    for (const m of this.meshes) {
      m.count = visible;
      m.visible = visible > 0;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
}

export class World {
  constructor(gltf) {
    this.group = new THREE.Group();
    this.group.name = 'village';
    this.lib = {};
    for (const child of gltf.scene.children) this.lib[child.name] = child;
    this.clickables = [];
    this.envUniforms = grimeUniforms();
    this.foliageMaterials = new Map();

    this.buildPlacements();
    this.buildTrees();
    this.buildBushes();
    this.buildFlora();
    this.buildTools();
    this.buildTrash();
    this.buildFactories();
    this.buildClouds();
    this.buildFish();
    this.buildSignText();
  }

  clone(name) {
    const src = this.lib[name];
    if (!src) {
      console.warn('village.glb 에 없는 에셋:', name);
      return new THREE.Group();
    }
    // 압축(양자화)된 GLB는 노드 자체에 복원용 변환이 들어 있으므로 한 겹 감싸서 배치한다
    const wrapper = new THREE.Group();
    wrapper.name = name;
    wrapper.add(prepare(src.clone(true)));
    return wrapper;
  }

  foliage(obj, amount = 1) {
    obj.traverse(o => {
      if (!o.isMesh) return;
      const src = o.material;
      let m = this.foliageMaterials.get(src);
      if (!m) {
        m = src.clone();
        patchGrime(m, this.envUniforms, { leaf: true, scale: 2.5 });
        this.foliageMaterials.set(src, m);
      }
      o.material = m;
    });
    return obj;
  }

  place(obj, x, z, { rotY = 0, scale = 1, y } = {}) {
    obj.position.set(x, y ?? groundHeightAt(x, z), z);
    obj.rotation.y = rotY;
    obj.scale.setScalar(scale);
    this.group.add(obj);
    return obj;
  }

  markClick(obj, id, label) {
    obj.traverse(o => {
      if (o.isMesh) {
        o.userData.click = id;
        o.userData.label = label;
      }
    });
    this.clickables.push(obj);
  }

  buildPlacements() {
    const labels = { house: '환경이 집', garden: '텃밭', bench: '벤치', sign: '표지판', bins: '분리수거함', mailbox: '우편함' };
    this.placed = {};
    for (const p of PLACEMENTS) {
      const obj = this.clone(p.asset);
      this.place(obj, p.pos[0], p.pos[1], p);
      this.placed[p.id] = obj;
      if (CLICK_BY_ID[p.id]) this.markClick(obj, CLICK_BY_ID[p.id], labels[p.id]);
      if (p.id.startsWith('stone')) this.markClick(obj, 'stream', '징검다리');
    }
    // 집 창문 불빛
    this.placed.house.traverse(o => {
      if (o.isMesh && o.material.name === 'env_glow') this.houseGlow = o.material;
    });
  }

  buildTrees() {
    this.trees = TREES.map(t => {
      const full = this.foliage(this.clone(t.full));
      const bare = this.clone(t.bare);
      this.place(full, t.pos[0], t.pos[1], { rotY: t.rotY, scale: t.scale });
      this.place(bare, t.pos[0], t.pos[1], { rotY: t.rotY + 0.7, scale: 0.0001 });
      return { full, bare, scale: t.scale, phase: t.pos[0] * 0.7 };
    });
  }

  buildBushes() {
    this.bushes = BUSHES.map(b => {
      const obj = this.foliage(this.clone(b.asset));
      this.place(obj, b.pos[0], b.pos[1], { scale: b.scale, rotY: b.pos[0] });
      return { obj, scale: b.scale };
    });
  }

  scatter(count, seed, accept) {
    const rnd = seeded(seed);
    const spots = [];
    let guard = 0;
    while (spots.length < count && guard++ < count * 40) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * (ISLAND_RADIUS - 1.0);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (inStream(x, z, STREAM.bank * 0.6)) continue;
      if (distanceToPath(x, z) < 0.75) continue;
      if (!accept(x, z, rnd)) continue;
      spots.push({
        x, z, y: groundHeightAt(x, z) - 0.01,
        rot: rnd() * Math.PI * 2,
        tilt: (rnd() - 0.5) * 0.2,
        scale: 0.75 + rnd() * 0.6,
        t: rnd(),
        colorIndex: Math.floor(rnd() * 8),
      });
    }
    return spots;
  }

  buildFlora() {
    const mesh = name => firstMesh(this.lib[name]);
    const nearZones = (zones) => (x, z) => zones.some(([zx, zz, zr]) => Math.hypot(x - zx, z - zz) < zr);
    const flowerZones = [[-4.3, 3.4, 2.4], [-3.4, 0.3, 1.6], [0.2, 2.2, 1.4], [5.9, 2.8, 1.8], [-6.3, -2.4, 1.6], [1.8, 6.4, 2.0], [-1.0, 6.2, 1.8], [2.5, -2.6, 1.3]];
    const lupineZones = [[-6.4, -2.2, 1.8], [-4.8, 4.8, 2.0], [6.4, 3.6, 1.8], [5.8, -1.0, 1.2], [-0.6, -4.2, 1.6], [3.0, 5.9, 1.6], [-1.8, 6.9, 1.4]];
    const inZone = nearZones(flowerZones);
    const inLupine = nearZones(lupineZones);

    const daisySpots = this.scatter(170, 101, (x, z, rnd) => !nearObstacle(x, z, 0.25) && (inZone(x, z) || rnd() < 0.18));
    const fmnSpots = this.scatter(170, 202, (x, z, rnd) => !nearObstacle(x, z, 0.2) && (inZone(x, z) || rnd() < 0.15));
    const lupineSpots = this.scatter(80, 303, (x, z) => !nearObstacle(x, z, 0.35) && inLupine(x, z));
    const grassSpots = this.scatter(320, 404, (x, z) => !nearObstacle(x, z, 0.05));

    this.flora = [
      new FloraLayer([mesh('daisy_stem'), mesh('daisy_petals')], daisySpots, {
        levels: { default: 0.5, happy: 1.12, sad: -0.15 },
        colors: ['#ffffff', '#fffaf0', '#fff4f8'], dryColor: '#a89a7c',
      }),
      new FloraLayer([mesh('forgetmenot_stem'), mesh('forgetmenot_petals')], fmnSpots, {
        levels: { default: 0.35, happy: 1.12, sad: -0.15 }, baseScale: 1.3,
        colors: ['#8fbdf0', '#7aaee6', '#a6c9f5', '#f3a6c8', '#ffd36e'], dryColor: '#8c8068',
      }),
      new FloraLayer([mesh('lupine_stem'), mesh('lupine_spike')], lupineSpots, {
        levels: { default: -0.15, happy: 1.12, sad: -0.15 }, baseScale: 1.15,
        colors: ['#7a4fd0', '#e0579f', '#4f74de', '#a06ae0', '#f2eef8', '#ec6fa8'],
      }),
      new FloraLayer([mesh('grass_tuft')], grassSpots, {
        levels: { default: 1.2, happy: 1.2, sad: 1.2 }, baseScale: 1.0,
        colors: ['#ffffff', '#e8f5d8', '#f4ffe6'], dryColor: '#c9a86e',
      }),
    ];
    for (const f of this.flora) this.group.add(f.group);
  }

  buildTools() {
    this.groundTools = {};
    this.handTools = {};
    const map = { can: 'prop_watering_can', broom: 'prop_broom', trowel: 'prop_trowel' };
    const labels = { can: '물뿌리개', broom: '빗자루', trowel: '모종삽' };
    for (const [key, asset] of Object.entries(map)) {
      const spot = TOOL_SPOTS[key];
      const g = this.clone(asset);
      const holder = new THREE.Group();
      holder.add(g);
      g.rotation.x = spot.lean ? -spot.lean : 0;
      this.place(holder, spot.pos[0], spot.pos[1], { rotY: spot.rotY, y: groundHeightAt(spot.pos[0], spot.pos[1]) + spot.y });
      this.markClick(holder, key === 'can' ? 'can' : key, labels[key]);
      this.groundTools[key] = holder;
      this.handTools[key] = this.clone(asset);
    }
  }

  setHeldTool(tool) {
    for (const [key, obj] of Object.entries(this.groundTools)) obj.visible = key !== tool;
  }

  buildTrash() {
    this.trash = TRASH.map((t, i) => {
      const obj = this.clone(t.asset);
      const y = t.y ?? groundHeightAt(t.pos[0], t.pos[1]);
      this.place(obj, t.pos[0], t.pos[1], { rotY: t.rotY, y, scale: 0.0001 });
      this.markClick(obj, 'trash', '쓰레기');
      return { obj, data: t, home: new THREE.Vector3(t.pos[0], y, t.pos[1]), delay: (i % 5) * 0.08, carry: 0 };
    });
  }

  buildFactories() {
    this.factories = FACTORIES.map(f => {
      const obj = this.clone(f.asset || 'factory');
      obj.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
      this.place(obj, f.pos[0], f.pos[1], { rotY: f.rotY, scale: f.scale, y: -12 });
      return { obj, scale: f.scale };
    });
  }

  buildClouds() {
    this.clouds = CLOUDS.map((c, i) => {
      const obj = this.clone('cloud');
      obj.traverse(o => {
        if (o.isMesh) {
          o.castShadow = false;
          o.receiveShadow = false;
          if (!this.cloudMaterial) {
            this.cloudMaterial = o.material.clone();
            this.cloudMaterial.fog = false;
            this.cloudMaterial.emissive = new THREE.Color('#ffffff');
            this.cloudMaterial.emissiveIntensity = 0.35;
          }
          o.material = this.cloudMaterial;
        }
      });
      obj.position.set(...c.pos);
      obj.scale.setScalar(c.scale);
      this.group.add(obj);
      return { obj, base: c.pos, speed: 0.15 + i * 0.05 };
    });
  }

  buildFish() {
    this.fish = [0, 1, 2, 3].map(i => {
      const obj = this.clone('fish');
      obj.traverse(o => { if (o.isMesh) o.castShadow = false; });
      obj.scale.setScalar(0.0001);
      this.group.add(obj);
      return { obj, phase: i * 1.9, lane: (i % 2 ? 1 : -1) * 0.3 };
    });
  }

  buildSignText() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 180;
    const g = canvas.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0)';
    g.fillRect(0, 0, 512, 180);
    g.fillStyle = '#5b3a20';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '64px Jua, "Gowun Dodum", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
    g.fillText('환경이 마을', 256, 74);
    g.font = '34px "Gowun Dodum", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
    g.fillText('자연과 함께!', 256, 138);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.42), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9 }));
    plane.position.set(0, 0.78, 0.042);
    this.placed.sign.add(plane);
    this.signTexture = tex;
    // 글꼴이 늦게 로드되면 다시 그린다
    document.fonts?.ready?.then(() => {
      g.clearRect(0, 0, 512, 180);
      g.font = '64px Jua, "Gowun Dodum", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
      g.fillText('환경이 마을', 256, 74);
      g.font = '34px "Gowun Dodum", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
      g.fillText('자연과 함께!', 256, 138);
      tex.needsUpdate = true;
    });
    // 분리수거함 이름표
    const labels = ['종이', '플라스틱', '캔'];
    labels.forEach((text, i) => {
      const c = document.createElement('canvas');
      c.width = 160;
      c.height = 96;
      const cg = c.getContext('2d');
      cg.fillStyle = '#4a3a2a';
      cg.textAlign = 'center';
      cg.textBaseline = 'middle';
      cg.font = `${text.length > 2 ? 34 : 46}px "Gowun Dodum", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
      cg.fillText(text, 80, 50);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.13), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
      m.position.set((i - 1) * 0.42, 0.3, 0.187);
      this.placed.bins.add(m);
    });
  }

  /**
   * @param w 상태 가중치 {default, happy, sad}
   * @param time 경과 시간(초)
   * @param carrying 캐릭터가 들고 있는 쓰레기 데이터 (없으면 null)
   * @param handPos 캐릭터 손 위치 (월드)
   */
  update(dt, time, w, { carrying = null, handPos = null } = {}) {
    const sad = w.sad;
    const happy = w.happy;
    this.envUniforms.uWither.value = sad * 0.95;
    this.envUniforms.uDirt.value = sad * 0.5;

    for (const t of this.trees) {
      const s = t.scale * (1 + 0.05 * happy);
      const fullK = Math.max(0.0001, 1 - smooth(sad, 0.25, 0.95));
      t.full.scale.set(s * (0.35 + 0.65 * fullK), s * fullK, s * (0.35 + 0.65 * fullK));
      t.full.visible = fullK > 0.002;
      const bareK = smooth(sad, 0.3, 1.0);
      t.bare.scale.setScalar(Math.max(0.0001, t.scale * bareK));
      t.bare.visible = bareK > 0.002;
      t.full.rotation.z = Math.sin(time * 0.8 + t.phase) * 0.012 * (1 + happy);
    }
    for (const b of this.bushes) {
      b.obj.scale.setScalar(b.scale * (1 - 0.3 * sad + 0.06 * happy));
    }
    for (const f of this.flora) f.update(w);

    this.trash.forEach(tr => {
      const k = smooth(sad, 0.1 + tr.delay, 0.8 + tr.delay);
      const pop = k < 1 ? k * (1 + 0.25 * Math.sin(k * Math.PI)) : 1;
      const target = carrying === tr.data && handPos ? 1 : 0;
      tr.carry += (target - tr.carry) * Math.min(1, dt * 8);
      tr.obj.scale.setScalar(Math.max(0.0001, pop));
      tr.obj.visible = k > 0.002;
      if (tr.carry > 0.01 && handPos) {
        tr.obj.position.lerpVectors(tr.home, handPos, tr.carry);
      } else {
        tr.obj.position.copy(tr.home);
      }
    });

    for (const f of this.factories) {
      const k = smooth(sad, 0.05, 0.9);
      f.obj.position.y = -12 + 12 * k - 0.6;
      f.obj.visible = k > 0.002;
    }

    for (const c of this.clouds) {
      c.obj.position.x = c.base[0] + Math.sin(time * 0.02 * c.speed * 10 + c.base[2]) * 3;
    }
    if (this.cloudMaterial) {
      this.cloudMaterial.color.setRGB(1 - 0.45 * sad, 1 - 0.5 * sad, 1 - 0.62 * sad);
      this.cloudMaterial.emissiveIntensity = 0.35 * (1 - sad);
    }

    const fishK = smooth(happy, 0.2, 0.9);
    for (const f of this.fish) {
      const t = time * 0.35 + f.phase;
      const z = Math.sin(t) * 6.5;
      const dz = Math.cos(t);
      f.obj.position.set(streamX(z) + f.lane, STREAM.waterY - 0.05 + Math.sin(time * 3 + f.phase) * 0.02, z);
      f.obj.rotation.y = dz > 0 ? 0 : Math.PI;
      f.obj.scale.setScalar(Math.max(0.0001, fishK * 1.3));
      f.obj.visible = fishK > 0.002;
    }

    if (this.houseGlow) this.houseGlow.emissiveIntensity = 0.6 + 1.2 * happy - 0.4 * sad;
  }
}

function smooth(x, a, b) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
