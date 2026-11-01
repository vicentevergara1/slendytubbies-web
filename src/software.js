import { heightAt } from './world.js';

const stars = Array.from({ length: 165 }, (_, i) => {
  const f = (n) => { const v = Math.sin(n * 127.1 + 78.3) * 43758.5453; return v - Math.floor(v); };
  return { x: f(i * 1.7), y: f(i * 9.5) * .52, r: .3 + f(i * 2.5) * 1.1 };
});

export function drawSoftware(ctx, canvas, state, world, time) {
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const focal = W * .65;
  const horizon = H * .50 + state.pitch * focal;
  const eyeY = heightAt(state.x, state.z) + state.playerHeight;
  const sy = Math.sin(state.yaw), cy = Math.cos(state.yaw);
  function project(x, y, z) {
    const dx = x - state.x, dz = z - state.z;
    const depth = -dx * sy - dz * cy;
    if (depth < .3 || depth > 110) return null;
    const side = dx * cy - dz * sy;
    return { x: W / 2 + side / depth * focal, y: horizon + (eyeY - y) / depth * focal, d: depth, scale: focal / depth };
  }

  const sky = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizon + H * .1));
  sky.addColorStop(0, '#050d19'); sky.addColorStop(.65, '#182d35'); sky.addColorStop(1, '#344a48');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = .35;
  ctx.fillStyle = '#b6cad5';
  for (const s of stars) {
    let x = (s.x * W - state.yaw * W * .17) % W;
    if (x < 0) x += W;
    const y = s.y * H + state.pitch * focal * .25;
    if (y < horizon - 12) { ctx.beginPath(); ctx.arc(x, y, s.r, 0, 7); ctx.fill(); }
  }
  ctx.restore();
  let moonX = ((.16 - state.yaw * .16) % 1) * W;
  if (moonX < 0) moonX += W;
  const moonY = Math.max(-80, horizon - H * .26);
  const glow = ctx.createRadialGradient(moonX, moonY, 3, moonX, moonY, 100);
  glow.addColorStop(0, '#c0d6d877'); glow.addColorStop(.18, '#9cbccf33'); glow.addColorStop(1, '#b4dcf000');
  ctx.fillStyle = glow; ctx.fillRect(moonX - 100, moonY - 100, 200, 200);
  ctx.fillStyle = '#c0cfd1'; ctx.beginPath(); ctx.arc(moonX, moonY, 16, 0, Math.PI * 2); ctx.fill();

  const ground = ctx.createLinearGradient(0, Math.min(H, horizon), 0, H);
  ground.addColorStop(0, '#203831'); ground.addColorStop(.55, '#1b2c26'); ground.addColorStop(1, '#101e19');
  ctx.fillStyle = ground; ctx.fillRect(0, Math.max(0, horizon), W, H);
  const sweep = ctx.createRadialGradient(W / 2, H * .93, 1, W / 2, H * .85, W * .75);
  sweep.addColorStop(0, state.flashlight && state.battery > 0 ? '#85958518' : '#141c1e00');
  sweep.addColorStop(1, '#00000000'); ctx.fillStyle = sweep;
  ctx.fillRect(0, Math.max(0, horizon), W, H);

  const objects = [];
  for (const tree of world.collisions) {
    if (tree.radius > 1.4) continue;
    const p = project(tree.x, heightAt(tree.x, tree.z), tree.z);
    if (p && p.x > -p.scale * 5 && p.x < W + p.scale * 5) objects.push({ type: 'tree', p, obj: tree });
  }
  for (const c of world.custards) if (!c.collected) {
    const p = project(c.x, heightAt(c.x, c.z) + .5, c.z);
    if (p) objects.push({ type: 'custard', p, obj: c });
  }
  for (const b of world.batteries) if (!b.used) {
    const p = project(b.x, heightAt(b.x, b.z) + .36, b.z);
    if (p) objects.push({ type: 'battery', p, obj: b });
  }
  for (const body of world.bodies) {
    const p = project(body.x, heightAt(body.x, body.z) + .3, body.z);
    if (p) objects.push({ type: 'body', p, obj: body });
  }
  const d = project(18, heightAt(18, -6) + .5, -6);
  if (d) objects.push({ type: 'dome', p: d });
  const cave = project(-30, heightAt(-30, -22) + .1, -22);
  if (cave) objects.push({ type: 'cave', p: cave });
  const e = project(world.enemy.x, heightAt(world.enemy.x, world.enemy.z), world.enemy.z);
  if (e) objects.push({ type: 'enemy', p: e });
  objects.sort((a, b) => b.p.d - a.p.d);

  const ellipse = (x, y, rx, ry, color) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, Math.PI * 2); ctx.fill();
  };
  const triangle = (x1, y1, x2, y2, x3, y3, color) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); ctx.fill();
  };
  for (const { type, p, obj } of objects) {
    const s = p.scale, x = p.x, y = p.y;
    if (x < -W * .5 || x > W * 1.5) continue;
    const fog = Math.min(.88, Math.max(0, (p.d - 17) / 83));
    ctx.save();
    ctx.globalAlpha = 1 - fog * .8;
    if (type === 'tree') {
      const h = Math.min(H * 4, (8 + obj.radius * 6) * s), width = h * .28;
      if (h < 1.7) { ctx.restore(); continue; }
      ctx.fillStyle = '#101a18'; ctx.fillRect(x - width * .09, y - h * .39, width * .18, h * .42);
      triangle(x, y - h, x - width * .47, y - h * .38, x + width * .47, y - h * .38, '#152820');
      triangle(x, y - h * .79, x - width * .58, y - h * .2, x + width * .58, y - h * .2, '#1a3027');
      triangle(x, y - h * .61, x - width * .65, y - h * .02, x + width * .65, y - h * .02, '#10231d');
    } else if (type === 'dome') {
      const w = 7.3 * s, h = 5.2 * s;
      ellipse(x, y - .35 * s, w, h, '#3a574c');
      ellipse(x, y - 2.1 * s, w * .86, h * .77, '#4c6b5e');
      ctx.fillStyle = '#111c1c'; ctx.fillRect(x - 1.6 * s, y - 3 * s, 3.2 * s, 3.2 * s);
      for (let k = 0; k < 4; k++) ellipse(x + (k - 1.5) * 3 * s, y - 3.4 * s, .55 * s, .4 * s, '#e6c887');
    } else if (type === 'cave') {
      const w = 3.9 * s, h = 5.1 * s;
      ellipse(x, y - h * .52, w * 1.3, h * .7, '#283332');
      ellipse(x, y - h * .42, w * .86, h * .56, '#050809');
      ellipse(x, y - h * .13, w * .6, h * .15, '#111d1b');
      ctx.strokeStyle = '#6d7d79'; ctx.lineWidth = Math.max(1, s * .13);
      ctx.beginPath();ctx.ellipse(x, y - h * .42, w * .86, h * .56, 0, Math.PI, Math.PI * 2); ctx.stroke();
    } else if (type === 'custard') {
      const w = Math.max(2, .47 * s);
      ellipse(x, y, w * 1.9, w * .58, '#d6558d55');
      ellipse(x, y + w * .38, w, w * .39, '#b9c6c3');
      ellipse(x, y, w * .9, w * .4, '#ff64aa');
      ellipse(x - w * .17, y - w * .13, w * .38, w * .12, '#ffb8d5');
    } else if (type === 'battery') {
      const w = Math.max(3, .36 * s), h = Math.max(5, .65 * s);
      ctx.fillStyle = '#8fbb9d'; ctx.fillRect(x - w / 2, y - h, w, h);
      ctx.fillStyle = '#e9db80'; ctx.fillRect(x - w / 2, y - h * .6, w, h * .2);
    } else if (type === 'body') {
      const colors = { 'Laa-Laa': '#ba9b27', 'Po': '#a42937', 'Dipsy': '#33874a' };
      const w = 1.1 * s;
      ellipse(x, y + .15 * s, w * 1.9, w * .41, '#581b22');
      ellipse(x, y, w * 1.4, w * .43, colors[obj.name]);
      ellipse(x + w * .9, y - .08 * s, w * .45, w * .5, colors[obj.name]);
      ellipse(x + w * 1.05, y - .1 * s, w * .34, w * .31, '#adb6ad');
      ellipse(x + w * 1.14, y - .15 * s, w * .07, w * .07, '#071014');
      ellipse(x - w, y + .16 * s, w * .48, w * .21, colors[obj.name]);
    } else if (type === 'enemy') {
      const h = 3.5 * s, w = .79 * s;
      ellipse(x, y - h * .47, w, h * .3, '#473454');
      ellipse(x, y - h * .78, w * .85, h * .19, '#503a61');
      ctx.fillStyle = '#392849'; ctx.fillRect(x - w * .24, y - h * .94, w * .48, h * .2);
      triangle(x, y - h * 1.1, x - w * .23, y - h * .94, x + w * .23, y - h * .94, '#4a3558');
      ellipse(x, y - h * .75, w * .53, h * .105, '#0b0b11');
      ellipse(x - w * .22, y - h * .77, w * .13, h * .016, '#ff3e43');
      ellipse(x + w * .22, y - h * .77, w * .13, h * .016, '#ff3e43');
      ellipse(x, y - h * .38, w * .52, h * .12, '#a0a0a1');
      ctx.strokeStyle = '#3b2b48'; ctx.lineWidth = Math.max(2, w * .28);
      ctx.beginPath();ctx.moveTo(x - w * .66, y - h * .61);ctx.lineTo(x - w * .93, y - h * .21);
      ctx.moveTo(x + w * .66, y - h * .61);ctx.lineTo(x + w * .93, y - h * .21);ctx.stroke();
      ctx.beginPath();ctx.moveTo(x - w * .3, y - h * .22);ctx.lineTo(x - w * .37, y);
      ctx.moveTo(x + w * .3, y - h * .22);ctx.lineTo(x + w * .37, y);ctx.stroke();
    }
    ctx.restore();
  }

  const inCave = state.x > -35 && state.x < -25 && state.z < -22 && state.z > -60;
  if (inCave) {
    const vg = ctx.createRadialGradient(W * .5, H * .57, W * .13, W * .5, H * .57, W * .66);
    vg.addColorStop(0, '#02040300'); vg.addColorStop(.65, '#05080777'); vg.addColorStop(1, '#020302ef');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    const caveRoof = ctx.createLinearGradient(0, 0, 0, H * .35);
    caveRoof.addColorStop(0, '#131e1c'); caveRoof.addColorStop(1, '#111a1800');
    ctx.fillStyle = caveRoof; ctx.fillRect(0, 0, W, H * .4);
  }
  if (state.flashlight && state.battery > 0) {
    const beam = ctx.createRadialGradient(W * .5, H * .6, W * .03, W * .5, H * .58, W * .55);
    beam.addColorStop(0, '#e3f9dc12'); beam.addColorStop(.5, '#d0e6ca08'); beam.addColorStop(1, '#00000000');
    ctx.fillStyle = beam; ctx.fillRect(0, 0, W, H);
  }
  const dark = ctx.createRadialGradient(W / 2, H / 2, W * .08, W / 2, H / 2, W * .76);
  dark.addColorStop(0, '#00000000'); dark.addColorStop(1, '#000000b4');
  ctx.fillStyle = dark; ctx.fillRect(0, 0, W, H);
}
