export function stepTinky(enemy, player, delta, remaining, canSee = true) {
  const dx = enemy.x - player.x;
  const dz = enemy.z - player.z;
  const distance = Math.hypot(dx, dz);
  const dot = distance > 0 ? (dx * player.forwardX + dz * player.forwardZ) / distance : 1;
  const offScreen = dot < 0.7;
  const visible = !offScreen && dot > 0.8 && distance < 10 && canSee;
  const walkingSpeed = remaining <= 2 ? 12 : remaining <= 5 ? 7 : 5;
  const shouldMove = distance > 3 && (offScreen || (!visible && distance >= 10));
  const step = shouldMove ? Math.min(Math.max(0, distance - 3), walkingSpeed * delta) : 0;
  const x = distance > 0 ? enemy.x - dx * step / distance : enemy.x;
  const z = distance > 0 ? enemy.z - dz * step / distance : enemy.z;
  const health = Math.max(0, player.health - (visible ? 50 * delta : 0));
  return { x, z, health, visible, offScreen, shouldMove, speed: walkingSpeed, distance };
}
