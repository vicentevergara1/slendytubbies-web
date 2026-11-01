import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

const base = `${import.meta.env.BASE_URL}recovered/`;
const source = `${import.meta.env.BASE_URL}original/`;
const loader = new OBJLoader();

export async function createRecoveredWorld(scene, onProgress = () => {}) {
  onProgress('Recuperando el terreno original…');
  const [sceneResponse, heightResponse] = await Promise.all([
    fetch(`${base}scene.json`),
    fetch(`${base}heights.bin`)
  ]);
  if (!sceneResponse.ok || !heightResponse.ok) throw new Error('Faltan los archivos del mapa original.');
  const data = await sceneResponse.json();
  const heights = new Uint16Array(await heightResponse.arrayBuffer());
  if (heights.length !== 513 * 513) throw new Error('El terreno recuperado está incompleto.');

  const root = new THREE.Group();
  root.scale.z = -1;
  scene.add(root);
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, 0.035);
  const ambient = new THREE.HemisphereLight(0xffffff, 0x333333, 0.26);
  scene.add(ambient);
  const sunlight = new THREE.DirectionalLight(0xffffff, 0);
  sunlight.position.set(120, 110, -160);
  scene.add(sunlight);
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x020407) },
      horizonColor: { value: new THREE.Color(0x101a1b) }
    },
    vertexShader: 'varying float skyHeight; void main(){skyHeight=position.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 topColor; uniform vec3 horizonColor; varying float skyHeight; void main(){float t=smoothstep(-.17,.7,skyHeight/225.);gl_FragColor=vec4(mix(horizonColor,topColor,t),1.);}'
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(225, 32, 18), skyMaterial);
  sky.renderOrder = -100;
  sky.frustumCulled = false;
  scene.add(sky);
  const starPositions = [];
  for (let i = 0; i < 280; i++) {
    const angle = i * 2.39996323;
    const y = .13 + ((i * 73) % 211) / 260;
    const radius = 210 * Math.sqrt(1 - y * y);
    starPositions.push(Math.cos(angle) * radius, y * 210, Math.sin(angle) * radius);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xd5e4e7, size: 1.4, sizeAttenuation: false, fog: false, depthWrite: false }));
  stars.renderOrder = -98;
  stars.frustumCulled = false;
  sky.add(stars);
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(10, 20, 16), new THREE.MeshBasicMaterial({ color: 0xffe1af, fog: false, depthWrite: false }));
  sunDisc.renderOrder = -99;
  scene.add(sunDisc);
  const moonDisc = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 12), new THREE.MeshBasicMaterial({ color: 0xb4c6d3, fog: false, depthWrite: false }));
  moonDisc.renderOrder = -99;
  scene.add(moonDisc);
  let currentDaylight = 1;
  const dayOnlyTrees = [];
  const settings = [
    { top: 0x6eabc9, horizon: 0xd8dbd2, fog: 0xfbfbfb, density: .04, ambient: .26, direct: .5, sun: 0xffffff },
    { top: 0x26293b, horizon: 0x77543a, fog: 0x0d0a03, density: .05, ambient: .26, direct: .3, sun: 0xffc600 },
    { top: 0x000000, horizon: 0x000000, fog: 0x000000, density: .035, ambient: .26, direct: 0, sun: 0xffffff }
  ];
  const cubeLoader = new THREE.CubeTextureLoader();
  const skyboxUrls = label => ['right', 'left', 'up', 'down', 'front', 'back'].map(face => `${import.meta.env.BASE_URL}original-sky/${label}_${face}.jpg`);
  const skyboxes = {};
  const skyRequests = Promise.all([
    cubeLoader.loadAsync(skyboxUrls('Sunny1')).then(texture => { texture.colorSpace = THREE.SRGBColorSpace; skyboxes.day = texture; }),
    cubeLoader.loadAsync(skyboxUrls('DawnDusk')).then(texture => { texture.colorSpace = THREE.SRGBColorSpace; skyboxes.dusk = texture; })
  ]).catch(error => console.warn('No fue posible cargar todos los cielos originales', error));
  const blendColor = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);
  function setLighting(value) {
    currentDaylight = THREE.MathUtils.clamp(value, 0, 1);
    const scaled = currentDaylight * 2;
    const index = Math.min(1, Math.floor(scaled));
    const a = settings[index], b = settings[index + 1], t = scaled - index;
    skyMaterial.uniforms.topColor.value.copy(blendColor(a.top, b.top, t));
    skyMaterial.uniforms.horizonColor.value.copy(blendColor(a.horizon, b.horizon, t));
    const time = currentDaylight < .25 ? 'day' : currentDaylight < .75 ? 'dusk' : 'night';
    scene.background = skyboxes[time] || new THREE.Color(time === 'day' ? 0xbfcbd0 : time === 'dusk' ? 0x292016 : 0x000000);
    sky.visible = !skyboxes[time] && time !== 'night';
    for (const tree of dayOnlyTrees) tree.visible = time !== 'night';
    scene.fog.color.copy(blendColor(a.fog, b.fog, t));
    scene.fog.density = THREE.MathUtils.lerp(a.density, b.density, t);
    ambient.intensity = THREE.MathUtils.lerp(a.ambient, b.ambient, t);
    sunlight.intensity = THREE.MathUtils.lerp(a.direct, b.direct, t);
    sunlight.color.copy(blendColor(a.sun, b.sun, t));
    sunlight.position.set(150, THREE.MathUtils.lerp(200, 75, currentDaylight), -90);
    sunDisc.material.color.copy(blendColor(a.sun, b.sun, t));
    sunDisc.visible = false;
    moonDisc.visible = false;
    stars.visible = false;
  }
  function updateSky(camera) {
    sky.position.copy(camera.position);
    sunDisc.position.set(camera.position.x + 150, camera.position.y + THREE.MathUtils.lerp(160, 12, currentDaylight), camera.position.z - 135);
    moonDisc.position.set(camera.position.x - 96, camera.position.y + 72, camera.position.z - 115);
  }
  await skyRequests;
  setLighting(1);

  const sample = (ix, iz) => heights[Math.max(0, Math.min(512, ix)) * 513 + Math.max(0, Math.min(512, iz))] * 600 / 65535;
  function originalHeight(x, z) {
    const gx = THREE.MathUtils.clamp(x * .512, 0, 512), gz = THREE.MathUtils.clamp(z * .512, 0, 512);
    const x0 = Math.floor(gx), z0 = Math.floor(gz);
    const x1 = Math.min(512, x0 + 1), z1 = Math.min(512, z0 + 1);
    const ax = gx - x0, az = gz - z0;
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(sample(x0, z0), sample(x1, z0), ax), THREE.MathUtils.lerp(sample(x0, z1), sample(x1, z1), ax), az);
  }
  function heightAt(x, z) {
    const height = originalHeight(x, z);
    const caveDistance = Math.hypot((x - 282) / 24, (z - 230) / 28);
    if (caveDistance < 1) return THREE.MathUtils.lerp(Math.min(height, 1.2), height, THREE.MathUtils.smoothstep(caveDistance, .35, 1));
    return height;
  }

  const groundGeometry = new THREE.PlaneGeometry(1000, 1000, 512, 512);
  groundGeometry.rotateX(-Math.PI / 2);
  const vertex = groundGeometry.attributes.position;
  for (let i = 0; i < vertex.count; i++) {
    const x = vertex.getX(i) + 500, z = vertex.getZ(i) + 500;
    vertex.setY(i, heightAt(x, z));
  }
  groundGeometry.computeVertexNormals();
  const grass = new THREE.TextureLoader().load(`${source}textures/grass__hill-0-93.png`);
  grass.colorSpace = THREE.SRGBColorSpace;
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
  grass.repeat.set(145, 145);
  const ground = new THREE.Mesh(groundGeometry, new THREE.MeshLambertMaterial({ map: grass, color: 0xb3baa9, side: THREE.DoubleSide }));
  ground.position.set(500, 0, 500);
  root.add(ground);

  const water = new THREE.Mesh(new THREE.PlaneGeometry(270, 650), new THREE.MeshLambertMaterial({ color: 0x15232b, transparent: true, opacity: .75, side: THREE.DoubleSide }));
  water.rotateX(-Math.PI / 2);
  water.position.set(1000, .24, 400);
  root.add(water);

  onProgress('Colocando los modelos y edificios del juego…');
  const names = [...new Set(data.nodes.map(node => node.mesh).filter(Boolean))];
  const cache = new Map();
  const failed = new Set();
  await Promise.all(names.map(async name => {
    try { cache.set(name, await loader.loadAsync(`${base}mesh/${name}`)); }
    catch { failed.add(name); }
  }));
  if (cache.size < names.length / 2) throw new Error('No se pudieron recuperar los modelos originales.');

  const textureLoader = new THREE.TextureLoader();
  const textureCache = new Map();
  const materialCache = new Map();
  function materialFor(info, name) {
    const key = JSON.stringify(info) + name;
    if (materialCache.has(key)) return materialCache.get(key);
    const colors = info?.color;
    const color = colors ? new THREE.Color(colors[0], colors[1], colors[2]) : new THREE.Color(0xaaa9a4);
    if (name === 'Tinkywinky') color.set(0xb1a2be);
    if (name === 'Paper') color.set(info?.name?.includes('mat1') ? 0xe7a1ce : 0x827d76);
    let map;
    if (info?.texture) {
      if (!textureCache.has(info.texture)) {
        const tex = textureLoader.load(`${base}textures/${info.texture}`, undefined, undefined, () => {});
        tex.colorSpace = THREE.SRGBColorSpace;
        textureCache.set(info.texture, tex);
      }
      map = textureCache.get(info.texture);
    }
    if (!map && info?.name?.toLowerCase().includes('grass')) map = grass;
    const result = new THREE.MeshLambertMaterial({ color, map, side: THREE.DoubleSide, alphaTest: .07, transparent: !!(colors && colors[3] < .9) });
    materialCache.set(key, result);
    return result;
  }

  const ids = new Map();
  for (const node of data.nodes) {
    const group = new THREE.Group();
    group.name = node.name;
    group.position.set(...node.position);
    group.quaternion.set(...node.rotation);
    group.scale.set(...node.scale);
    ids.set(node.id, { node, group });
  }

  const collectibles = [];
  const bodies = [];
  let enemy = null;
  let house = null;
  let cave = null;
  for (const { node, group } of ids.values()) {
    const parent = ids.get(node.parent)?.group || root;
    parent.add(group);
    if (node.name === 'treemain1') dayOnlyTrees.push(group);
    if (node.name === 'Point light') group.add(new THREE.PointLight(0xff0000, 1, 17.2516, 2));
    if (node.name === 'Lightsource') group.add(new THREE.PointLight(0xff9c30, 1.108, 6.114, 2));
    if (node.mesh && cache.has(node.mesh) && node.active) {
      const clone = cache.get(node.mesh).clone(true);
      let index = 0;
      clone.traverse(object => {
        if (!object.isMesh) return;
        object.material = materialFor(node.materials?.[Math.min(index, (node.materials?.length || 1) - 1)], node.name);
        object.castShadow = false;
        object.receiveShadow = false;
        index++;
      });
      group.add(clone);
    }
    if (node.name === 'Paper' && node.parent === 0) collectibles.push({ group, x: node.position[0], z: node.position[2], collected: false });
    if (node.name === 'lala' || node.name === 'dipsy' || node.name === 'Po-hung') bodies.push({ name: node.name === 'lala' ? 'Laa-Laa' : node.name === 'dipsy' ? 'Dipsy' : 'Po', group, x: node.position[0], z: node.position[2] });
    if (node.name === 'Tinky 1') enemy = { group, x: node.position[0], z: node.position[2], spawnX: node.position[0], spawnZ: node.position[2] };
    if (node.name === 'Teletubby house' && node.parent === 0) house = { group, x: node.position[0], z: node.position[2] };
    if (node.name === 'cave') cave = { group, x: node.position[0], z: node.position[2] };
  }

  const hide = new Set(['Barrier', 'popup cube', 'LookAt', 'Tree_Maple3ds', 'Nighttime Simple Water']);
  for (const { node, group } of ids.values()) {
    if (hide.has(node.name)) group.visible = false;
    if (node.name.startsWith('RockMesh_collider') && (group.parent !== root || node.position[0] < 0)) group.visible = false;
  }

  onProgress('Recuperando los 2.048 árboles del escenario…');
  const treeFiles = ['tree001-1.obj', 'scotspine-1.obj', 'tree002-0.obj'];
  const treeFactors = [.064, .9, .068];
  const treeGeometry = [];
  const treeForest = [];
  const barkTexture = textureLoader.load(`${source}textures/scotspinetrunk-1-84.png`);
  barkTexture.colorSpace = THREE.SRGBColorSpace;
  const branchTexture = textureLoader.load(`${source}textures/tree_tex-1-45.png`);
  branchTexture.colorSpace = THREE.SRGBColorSpace;
  for (let type = 0; type < 3; type++) {
    const prototype = await loader.loadAsync(`${source}models/${treeFiles[type]}`);
    const meshes = [];
    prototype.traverse(object => { if (object.isMesh) meshes.push(object); });
    const pool = [];
    const count = data.trees.filter(tree => tree[2] === type).length;
    for (let index = 0; index < meshes.length; index++) {
      const child = meshes[index];
      const color = type === 2 ? 0x283129 : (index === 0 ? 0x172217 : 0x293727);
      const isTrunk = type !== 1 || index === 1;
      const material = new THREE.MeshLambertMaterial({ color: isTrunk ? 0x6b7569 : color, map: isTrunk ? (type === 1 ? barkTexture : branchTexture) : null, side: THREE.DoubleSide, alphaTest: .08 });
      const instances = new THREE.InstancedMesh(child.geometry, material, count);
      instances.count = 0;
      instances.frustumCulled = false;
      instances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      root.add(instances);
      pool.push(instances);
    }
    treeGeometry.push(pool);
  }

  const temp = new THREE.Object3D();
  let treeCenterX = NaN, treeCenterZ = NaN;
  function updateTrees(playerX, playerZ, force = false) {
    if (!force && Math.hypot(playerX - treeCenterX, playerZ - treeCenterZ) < 15) return;
    treeCenterX = playerX; treeCenterZ = playerZ;
    const counts = [0, 0, 0];
    for (let i = 0; i < data.trees.length; i++) {
      const [x, z, type, width, height] = data.trees[i];
      const dist2 = (x - playerX) ** 2 + (z - playerZ) ** 2;
      if (dist2 > 185 ** 2) continue;
      const size = treeFactors[type];
      temp.position.set(x, heightAt(x, z) - (type === 0 ? .7 : .1), z);
      temp.rotation.set(0, ((i * 199) % 360) * Math.PI / 180, 0);
      temp.scale.set(width * size, height * size, width * size);
      temp.updateMatrix();
      for (const instance of treeGeometry[type]) instance.setMatrixAt(counts[type], temp.matrix);
      counts[type]++;
    }
    for (let type = 0; type < 3; type++) {
      for (const instance of treeGeometry[type]) {
        instance.count = counts[type];
        instance.instanceMatrix.needsUpdate = true;
      }
    }
  }

  const originalEnemy = enemy?.group;
  if (originalEnemy) originalEnemy.visible = true;
  const movement = new THREE.Group();
  if (enemy) {
    const tinky = ids.get(data.nodes.find(node => node.name === 'Tinkywinky')?.id);
    if (tinky) {
      enemy.group = movement;
      movement.position.set(enemy.x, heightAt(enemy.x, enemy.z), enemy.z);
      root.add(movement);
      tinky.group.position.set(.01, -.55, .05);
      movement.add(tinky.group);
      if (originalEnemy) originalEnemy.visible = false;
    }
  }

  updateTrees(501.79, 131.09, true);
  setLighting(currentDaylight);
  return { data, root, heightAt, originalHeight, updateTrees, setLighting, updateSky, trees: data.trees, collectibles, bodies, enemy, house, cave, failedModels: [...failed] };
}
