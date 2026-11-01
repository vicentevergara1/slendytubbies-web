import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

const random = (() => { let seed = 198602; return () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; }; })();
const rand = (a, b) => a + (b - a) * random();
const mat = (color, roughness = 1, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
const darkGrass = mat(0x16231c);
const stone = mat(0x292d2b);
const bark = mat(0x171d1b);

export function heightAt(x, z) {
  const base = -0.5 + .53 * Math.sin(x * .082) * Math.cos(z * .075) + .23 * Math.sin(x * .21 + z * .13);
  const cave = THREE.MathUtils.smoothstep(x, -40, -35) * (1 - THREE.MathUtils.smoothstep(x, -25, -20)) *
    THREE.MathUtils.smoothstep(-z, 15, 22) * (1 - THREE.MathUtils.smoothstep(-z, 58, 67));
  return THREE.MathUtils.lerp(base, -.38, cave);
}

function mesh(geo, material, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = false;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

function sphere(parent, radius, color, pos, scale = [1, 1, 1], rough = .92) {
  const m = mesh(new THREE.SphereGeometry(radius, 12, 9), mat(color, rough), parent, ...pos);
  m.scale.set(...scale);
  return m;
}

function cylinder(parent, rt, rb, h, material, pos, segments = 9) {
  return mesh(new THREE.CylinderGeometry(rt, rb, h, segments), material, parent, ...pos);
}

function capsuleLimb(parent, a, b, radius, color) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const d = B.clone().sub(A);
  const m = mesh(new THREE.CylinderGeometry(radius * .84, radius, d.length(), 9), mat(color), parent);
  m.position.copy(A.add(B).multiplyScalar(.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  sphere(parent, radius, color, b, [1, 1, 1]);
  return m;
}

export function createWorld(scene, options = {}) {
  scene.background = new THREE.Color(0x071015);
  scene.fog = new THREE.FogExp2(0x071015, .026);
  const ambient = new THREE.HemisphereLight(0x61778b, 0x0b1110, .76);
  scene.add(ambient);
  const moonLight = new THREE.DirectionalLight(0x9ebbd2, 1.05);
  moonLight.position.set(-30, 55, -60);
  scene.add(moonLight);

  const skyGeo = new THREE.SphereGeometry(235, 24, 14);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color(0x02060a) }, bottom: { value: new THREE.Color(0x1d3038) } },
    vertexShader: 'varying vec3 vWorld; void main(){ vec4 p=modelMatrix*vec4(position,1.); vWorld=p.xyz; gl_Position=projectionMatrix*viewMatrix*p; }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vWorld; void main(){float t=clamp(normalize(vWorld).y*.72+.28,0.,1.);gl_FragColor=vec4(mix(bottom,top,smoothstep(0.,.85,t)),1.);}'
  });
  mesh(skyGeo, skyMat, scene);
  const starPos = [];
  for (let i = 0; i < 450; i++) {
    const theta = rand(0, Math.PI * 2), y = rand(.08, .95), r = 210 * Math.sqrt(1 - y * y);
    starPos.push(Math.cos(theta) * r, y * 210, Math.sin(theta) * r);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xb4c5ce, size: .65, sizeAttenuation: false, transparent: true, opacity: .8, depthWrite: false })));
  const moon = sphere(scene, 3.5, 0xd5e4de, [-73, 61, -136]);
  moon.material = new THREE.MeshBasicMaterial({ color: 0xc2d7df, fog: false });
  const halo = sphere(scene, 6.5, 0x829bad, [-73, 61, -136]);
  halo.material = new THREE.MeshBasicMaterial({ color: 0x829bad, transparent: true, opacity: .07, depthWrite: false, fog: false });

  const terrain = new THREE.PlaneGeometry(175, 175, 140, 140);
  terrain.rotateX(-Math.PI / 2);
  const verts = terrain.attributes.position;
  const groundColors = [];
  const c = new THREE.Color();
  for (let i = 0; i < verts.count; i++) {
    const x = verts.getX(i), z = verts.getZ(i);
    verts.setY(i, heightAt(x, z));
    c.setHSL(.285 + rand(-.025, .02), .21 + rand(-.05, .045), .105 + rand(-.018, .025));
    groundColors.push(c.r, c.g, c.b);
  }
  terrain.setAttribute('color', new THREE.Float32BufferAttribute(groundColors, 3));
  terrain.computeVertexNormals();
  const groundMesh = mesh(terrain, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }), scene);
  if (options.useOriginalModels) {
    const tl = new THREE.TextureLoader();
    tl.load(`${import.meta.env.BASE_URL}original/textures/grass__hill-0-93.png`, texture => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(29, 29);
      groundMesh.material.vertexColors = false;
      groundMesh.material.map = texture;
      groundMesh.material.color.set(0x657767);
      groundMesh.material.needsUpdate = true;
    });
  }

  const collisions = [];
  const clearing = [
    [0, 15, 8], [18, -6, 9], [-30, -38, 7], [10, -22, 4], [-22, 8, 4],
    [34, -30, 4], [4, -40, 4], [-15, -41, 4], [2, -1, 3], [-25, -13, 4]
  ];
  const positions = [];
  for (let i = 0; i < 325; i++) {
    const x = rand(-82, 82), z = rand(-82, 82);
    if (clearing.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r)) continue;
    if (x > -37 && x < -23 && z < -16 && z > -60) continue;
    if (Math.hypot(x, z - 15) < 8) continue;
    const h = rand(5, 12), r = rand(.24, .48);
    positions.push({ x, z, h, r });
  }
  const trunkGeo = new THREE.CylinderGeometry(.29, .48, 1, 6);
  const pineGeo = new THREE.ConeGeometry(1, 1, 7);
  const trunks = new THREE.InstancedMesh(trunkGeo, bark, positions.length);
  const topFoliage = new THREE.InstancedMesh(pineGeo, mat(0x15251f, 1, { flatShading: true }), positions.length);
  const lowFoliage = new THREE.InstancedMesh(pineGeo, mat(0x1a2c23, 1, { flatShading: true }), positions.length);
  const tmp = new THREE.Object3D();
  positions.forEach((p, i) => {
    const y = heightAt(p.x, p.z);
    tmp.position.set(p.x, y + p.h * .3, p.z);
    tmp.scale.set(p.r * 2.3, p.h * .6, p.r * 2.3);
    tmp.rotation.set(0, rand(0, 3), 0); tmp.updateMatrix(); trunks.setMatrixAt(i, tmp.matrix);
    tmp.position.set(p.x, y + p.h * .68, p.z);
    tmp.scale.set(p.h * .20, p.h * .65, p.h * .20);
    tmp.updateMatrix(); lowFoliage.setMatrixAt(i, tmp.matrix);
    tmp.position.set(p.x, y + p.h * .99, p.z);
    tmp.scale.set(p.h * .15, p.h * .52, p.h * .15);
    tmp.updateMatrix(); topFoliage.setMatrixAt(i, tmp.matrix);
    collisions.push({ x: p.x, z: p.z, radius: p.r * 1.3 });
  });
  for (const m of [trunks, lowFoliage, topFoliage]) { m.instanceMatrix.needsUpdate = true; scene.add(m); }

  const grassGeo = new THREE.ConeGeometry(.12, .75, 3);
  const grassTufts = new THREE.InstancedMesh(grassGeo, darkGrass, 2400);
  for (let i = 0; i < 2400; i++) {
    const x = rand(-82, 82), z = rand(-82, 82);
    tmp.position.set(x, heightAt(x, z) + .18, z);
    tmp.rotation.set(rand(-.17, .17), rand(0, 6), rand(-.1, .1));
    const sc = rand(.6, 1.8); tmp.scale.set(sc, sc, sc); tmp.updateMatrix(); grassTufts.setMatrixAt(i, tmp.matrix);
  }
  grassTufts.instanceMatrix.needsUpdate = true;
  scene.add(grassTufts);

  for (let i = 0; i < 155; i++) {
    const x = rand(-79, 79), z = rand(-79, 79);
    if (Math.hypot(x, z - 15) < 5 || (x > -37 && x < -23 && z < -60 && z > -16)) continue;
    const scale = rand(.4, 2.1);
    const rock = mesh(new THREE.DodecahedronGeometry(scale, 0), stone, scene, x, heightAt(x, z) + scale * .18, z);
    rock.scale.set(rand(.8, 1.3), rand(.4, .65), rand(.6, 1.2));
    rock.rotation.y = rand(0, 6);
  }

  makeHome(scene, collisions);
  makeCave(scene, collisions);
  makeSign(scene, -21.8, -14.5, 'CUEVA', Math.PI * -.23);
  makeSign(scene, 9.5, -2.1, 'DOMO', -.7);

  const bodies = [
    makeBody(scene, 'Laa-Laa', 0xd2ad28, 10.5, -22.5, -.8, 'Encontraste a Laa-Laa. Hay huellas recientes junto al cuerpo.'),
    makeBody(scene, 'Po', 0x9e2029, -21.5, 8, .9, 'Encontraste a Po. Algo se mueve entre los árboles.'),
    makeBody(scene, 'Dipsy', 0x37824a, -30.1, -51.5, .6, 'Encontraste a Dipsy. La cueva no está vacía.')
  ];
  if (options.useOriginalModels) applyOriginalCorpses(bodies);

  const custardPositions = [[2, -1], [21, 3], [13, -24], [-17, 9], [-26, -12], [-30.3, -30.5], [-30.2, -49], [34, -30], [4, -40], [-15, -41]];
  const custards = custardPositions.map(([x, z], i) => makeCustard(scene, x, z, i));
  const batteries = [[-16, 11], [20, -12], [-30, -42], [34, -26]].map(([x, z]) => makeBattery(scene, x, z));
  const enemy = makeEnemy(scene);
  enemy.group.position.set(43, heightAt(43, -27), -27);
  const fogWisps = [];
  const fogMaterial = new THREE.MeshBasicMaterial({ color: 0x799e99, transparent: true, opacity: .038, depthWrite: false });
  for (let i = 0; i < 32; i++) {
    const x = rand(-72, 72), z = rand(-73, 72);
    const wisp = mesh(new THREE.PlaneGeometry(rand(8, 22), rand(2, 5)), fogMaterial, scene, x, heightAt(x, z) + rand(.45, 1.5), z);
    wisp.rotation.x = -Math.PI / 2;
    fogWisps.push({ mesh: wisp, phase: rand(0, 10) });
  }
  return { collisions, bodies, custards, batteries, enemy, fogWisps, dome: { x: 18, z: -6 }, cave: { x: -30, z: -22 } };
}

function applyOriginalCorpses(bodies) {
  const loader = new OBJLoader();
  const texLoader = new THREE.TextureLoader();
  const originals = [
    { body: bodies[0], model: 'laalaa_css_ref_001-1.obj', texture: 'yellow-1-79.png', color: 0xffeab6 },
    { body: bodies[1], model: 'laalaa_css_ref_001-1.obj', texture: 'red-0-53.png', color: 0xffd3d3 },
    { body: bodies[2], model: 'dipsy_css_ref_001-1.obj', texture: 'green-1-48.png', color: 0xe5f5d9 }
  ];
  for (const item of originals) {
    const texture = texLoader.load(`${import.meta.env.BASE_URL}original/textures/${item.texture}`);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshStandardMaterial({ map: texture, color: item.color, side: THREE.DoubleSide, roughness: 1 });
    loader.load(`${import.meta.env.BASE_URL}original/models/${item.model}`, imported => {
      let triangles = 0;
      imported.traverse(child => {
        if (!child.isMesh) return;
        child.material = material;
        child.castShadow = false;
        triangles += child.geometry.index ? child.geometry.index.count / 3 : child.geometry.attributes.position.count / 3;
      });
      if (!triangles) return;
      item.body.group.children.forEach((part, index) => { if (index > 0) part.visible = false; });
      imported.scale.setScalar(2.35);
      if (item.body.name === 'Po') {
        imported.rotation.x = -Math.PI / 2;
        imported.position.set(0, 1.35, 0);
        cylinder(item.body.group, .14, .2, 4.6, mat(0x252c24), [-1.5, 2.3, 0]);
        capsuleLimb(item.body.group, [-1.5, 4.55, 0], [.6, 4.55, 0], .13, 0x252c24);
        cylinder(item.body.group, .033, .033, .82, mat(0x68533e), [0, 4.16, 0]);
        const ring = mesh(new THREE.TorusGeometry(.16, .065, 7, 12), mat(0x93232d), item.body.group, 0, 3.77, 0);
        ring.rotation.x = Math.PI / 2;
      } else imported.position.set(0, .18, -1.19);
      item.body.group.add(imported);
    }, undefined, () => {});
  }
}

function makeHome(scene, collisions) {
  const x = 18, z = -6, y = heightAt(x, z) - .1;
  const base = cylinder(scene, 7.3, 7.7, .75, mat(0x242c29), [x, y + .35, z], 18);
  base.rotation.y = .1;
  const dome = sphere(scene, 7.1, 0x3a564b, [x, y + 1.2, z], [1, .69, 1]);
  dome.material.side = THREE.DoubleSide;
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3 + .25;
    const wx = x + Math.sin(a) * 6.1, wz = z + Math.cos(a) * 6.1;
    const light = mesh(new THREE.SphereGeometry(.8, 14, 8), new THREE.MeshBasicMaterial({ color: k % 2 ? 0xc7d798 : 0xd5b66d }), scene, wx, y + 2.3, wz);
    light.scale.set(.85, .65, .28);
    light.rotation.y = a;
  }
  const entranceZ = z + 6.7;
  const door = mesh(new THREE.BoxGeometry(3.3, 3.1, .3), mat(0x10191a), scene, x, y + 1.5, entranceZ);
  mesh(new THREE.BoxGeometry(3.8, 3.5, .32), mat(0x788379), scene, x, y + 1.52, entranceZ - .17);
  door.position.z += .19;
  mesh(new THREE.BoxGeometry(1.4, .14, .4), new THREE.MeshBasicMaterial({ color: 0xf1c88c }), scene, x, y + 2.8, entranceZ + .28);
  const lamp = new THREE.PointLight(0xe4ad77, 5, 16, 2);
  lamp.position.set(x, y + 3.6, entranceZ + 1.3); scene.add(lamp);
  const path = mesh(new THREE.PlaneGeometry(4.3, 17), mat(0x29312b), scene, x, y + .42, z + 13);
  path.rotation.x = -Math.PI / 2;
  collisions.push({ x, z: z - 1.5, radius: 5.4 });
}

function makeCave(scene, collisions) {
  const x = -30, y = -.38, start = -21, end = -59;
  const rings = 40, sides = 16;
  const vs = [], colors = [], inds = [];
  const color = new THREE.Color();
  for (let j = 0; j <= rings; j++) {
    const t = j / rings, z = THREE.MathUtils.lerp(start, end, t);
    const cx = x + .42 * Math.sin(t * 6), width = 3.5 + .32 * Math.sin(t * 10);
    const roof = 4.6 + .44 * Math.sin(t * 12);
    for (let i = 0; i <= sides; i++) {
      const a = Math.PI * i / sides;
      const noise = .16 * Math.sin(i * 4.7 + j * 2.1);
      vs.push(cx + Math.cos(a) * (width + noise), y + .22 + Math.sin(a) * (roof + noise), z);
      color.setHSL(.40 + rand(-.035, .03), .08, .13 + rand(-.035, .03));
      colors.push(color.r, color.g, color.b);
      if (i < sides && j < rings) {
        const a0 = j * (sides + 1) + i;
        inds.push(a0, a0 + sides + 1, a0 + 1, a0 + 1, a0 + sides + 1, a0 + sides + 2);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(inds); geo.computeVertexNormals();
  mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 }), scene);
  const floor = mesh(new THREE.PlaneGeometry(7.1, 39), mat(0x1b2423), scene, x, y + .025, (start + end) / 2);
  floor.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 85; i++) {
    const z = rand(end + 1, start - 1), xx = x + (random() > .5 ? rand(2.5, 3.4) : -rand(2.5, 3.4));
    const rock = mesh(new THREE.DodecahedronGeometry(rand(.2, .8), 0), mat(0x252e2b), scene, xx, y + .1, z);
    rock.scale.y = rand(.4, 1.4);
  }
  for (let i = 0; i < 55; i++) {
    const z = rand(-59, -19), xx = x + rand(-10, 10);
    if (Math.abs(xx - x) < 4.1) continue;
    const rock = mesh(new THREE.DodecahedronGeometry(rand(1.2, 3.4), 0), stone, scene, xx, y + rand(.2, 1.6), z);
    rock.rotation.set(rand(0, 2), rand(0, 6), rand(0, 3));
  }
  const cap = mesh(new THREE.SphereGeometry(3.6, 12, 9), mat(0x171d1c), scene, x, y + 1.7, end - 1.3);
  cap.scale.set(1.15, 1.3, .6);
  for (let i = 0; i < 15; i++) {
    const a = Math.PI * i / 14;
    const rock = mesh(new THREE.DodecahedronGeometry(rand(.7, 1.7), 0), stone, scene,
      x + Math.cos(a) * 3.5, y + Math.sin(a) * 4.2, start + rand(-1.5, 1.6));
    rock.scale.set(1.1, rand(.7, 1.3), 1.3);
  }
  const caveLight = new THREE.PointLight(0x6c93a0, 1.5, 12);
  caveLight.position.set(x, 2.2, -39); scene.add(caveLight);
  const redLight = new THREE.PointLight(0xa31b23, 1.9, 10);
  redLight.position.set(x, 1, -54); scene.add(redLight);
  collisions.push({ x: -34.4, z: -20, radius: 1.7 }, { x: -25.3, z: -20, radius: 1.7 });
}

function makeSign(scene, x, z, txt, angle) {
  const y = heightAt(x, z);
  cylinder(scene, .09, .12, 2.3, mat(0x3a3328), [x, y + 1, z]);
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 175;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#514639'; ctx.fillRect(0, 0, 512, 175);
  ctx.strokeStyle = '#a29471'; ctx.lineWidth = 12; ctx.strokeRect(8, 8, 496, 159);
  ctx.fillStyle = '#eee8c8'; ctx.font = 'bold 76px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, 256, 90);
  const sign = mesh(new THREE.PlaneGeometry(2.9, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), side: THREE.DoubleSide }), scene, x, y + 1.8, z);
  sign.rotation.y = angle;
}

function makeBody(scene, name, color, x, z, angle, message) {
  const group = new THREE.Group(); scene.add(group);
  group.position.set(x, heightAt(x, z) + .19, z);
  group.rotation.y = angle;
  const stain = sphere(group, 1.1, 0x4d1217, [-.15, -.08, -.2], [1.45, .035, 1], .5);
  stain.material = new THREE.MeshBasicMaterial({ color: 0x441115, transparent: true, opacity: .87 });
  sphere(group, .7, color, [0, .35, 0], [.84, .55, 1.5]);
  sphere(group, .58, color, [.09, .43, 1.0], [1, .9, .9]);
  sphere(group, .4, 0xa2a59b, [.1, .38, 1.43], [1.04, .73, .2]);
  sphere(group, .12, 0x101313, [-.12, .51, 1.58], [1, .78, .3]);
  sphere(group, .12, 0x101313, [.32, .51, 1.58], [1, .78, .3]);
  capsuleLimb(group, [-.48, .27, .35], [-1.05, .09, -.25], .21, color);
  capsuleLimb(group, [.48, .27, .34], [1.03, .1, -.27], .21, color);
  capsuleLimb(group, [-.26, .24, -.82], [-.55, .12, -1.35], .25, color);
  capsuleLimb(group, [.26, .24, -.82], [.5, .12, -1.42], .25, color);
  if (name === 'Po') {
    const ring = mesh(new THREE.TorusGeometry(.19, .07, 6, 10), mat(color), group, .1, 1.08, 1.02);
    ring.rotation.x = Math.PI / 2;
  } else if (name === 'Dipsy') {
    cylinder(group, .1, .14, .55, mat(color), [.1, 1.15, .97]);
  } else {
    capsuleLimb(group, [-.13, .94, .99], [-.38, 1.25, 1.02], .085, color);
    capsuleLimb(group, [.13, .94, .99], [.38, 1.25, 1.02], .085, color);
  }
  return { name, x, z, message, inspected: false, group };
}

function makeCustard(scene, x, z, index) {
  const group = new THREE.Group(); scene.add(group);
  group.position.set(x, heightAt(x, z) + .38, z);
  const bowl = cylinder(group, .46, .31, .31, mat(0xc1cbc8, .36, { metalness: .66 }), [0, .08, 0], 18);
  const rim = mesh(new THREE.TorusGeometry(.46, .052, 6, 24), mat(0xe5e9e8, .3, { metalness: .5 }), group, 0, .24, 0);
  rim.rotation.x = Math.PI / 2;
  const filling = sphere(group, .38, 0xff6cab, [0, .25, 0], [1, .26, 1], .23);
  filling.material.emissive = new THREE.Color(0x8e164c);
  filling.material.emissiveIntensity = 1.8;
  const glow = new THREE.PointLight(0xf25495, .9, 4.5, 2); glow.position.y = .5; group.add(glow);
  return { group, x, z, index, collected: false, glow, baseY: group.position.y };
}

function makeBattery(scene, x, z) {
  const group = new THREE.Group(); scene.add(group); group.position.set(x, heightAt(x, z) + .4, z);
  const body = mesh(new THREE.BoxGeometry(.38, .7, .27), mat(0x547d79, .55), group, 0, 0, 0);
  mesh(new THREE.BoxGeometry(.2, .06, .16), mat(0xbec6ac, .4), group, 0, .37, 0);
  const stripe = mesh(new THREE.BoxGeometry(.39, .11, .28), new THREE.MeshBasicMaterial({ color: 0xd2db8a }), group, 0, .06, 0);
  const light = new THREE.PointLight(0x9ccbb6, .7, 3); group.add(light);
  return { group, x, z, used: false };
}

function makeEnemy(scene) {
  const group = new THREE.Group(); scene.add(group);
  const purple = mat(0x493557, .93);
  const darker = mat(0x30213e);
  const belly = mat(0x9a9b94);
  cylinder(group, .69, .54, 1.68, purple, [0, 1.5, 0], 13);
  sphere(group, .76, 0x4c3859, [0, 2.52, 0], [1, .98, .88]);
  sphere(group, .5, 0x151419, [0, 2.5, .55], [1, .87, .19]);
  const leftEye = sphere(group, .092, 0xf54e46, [-.21, 2.64, .658], [1, .72, .45], .1);
  const rightEye = sphere(group, .092, 0xf54e46, [.21, 2.64, .658], [1, .72, .45], .1);
  leftEye.material = new THREE.MeshBasicMaterial({ color: 0xff343e });
  rightEye.material = new THREE.MeshBasicMaterial({ color: 0xff343e });
  const mouth = mesh(new THREE.TorusGeometry(.2, .025, 6, 12, Math.PI), mat(0x050608), group, 0, 2.34, .66);
  mouth.rotation.z = Math.PI;
  cylinder(group, .08, .14, .49, purple, [0, 3.37, 0]);
  const triangle = mesh(new THREE.ConeGeometry(.31, .43, 3), purple, group, 0, 3.68, 0);
  triangle.rotation.y = Math.PI;
  sphere(group, .65, 0x75747c, [0, 1.52, .53], [.93, .8, .2]);
  const leftArm = new THREE.Group(), rightArm = new THREE.Group();
  leftArm.position.set(-.75, 2.09, 0); rightArm.position.set(.75, 2.09, 0);
  group.add(leftArm, rightArm);
  capsuleLimb(leftArm, [0, 0, 0], [-.17, -.97, .04], .2, 0x493557);
  capsuleLimb(rightArm, [0, 0, 0], [.17, -.97, .04], .2, 0x493557);
  const leftLeg = new THREE.Group(), rightLeg = new THREE.Group();
  leftLeg.position.set(-.32, .77, 0); rightLeg.position.set(.32, .77, 0);
  group.add(leftLeg, rightLeg);
  capsuleLimb(leftLeg, [0, 0, 0], [0, -.73, .12], .25, 0x493557);
  capsuleLimb(rightLeg, [0, 0, 0], [0, -.73, .12], .25, 0x493557);
  const eyeGlow = new THREE.PointLight(0xff273c, 1.3, 5);
  eyeGlow.position.set(0, 2.59, .81); group.add(eyeGlow);
  return { group, x: 43, z: -27, state: 'patrol', target: { x: 43, z: -27 }, leftArm, rightArm, leftLeg, rightLeg, eyeGlow, tick: 0 };
}
