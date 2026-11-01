export function advanceJump(height, velocity, delta, gravity = 24) {
  const nextVelocity = velocity - gravity * delta;
  const nextHeight = height + nextVelocity * delta;
  if (nextHeight <= 0) return { height: 0, velocity: 0, grounded: true };
  return { height: nextHeight, velocity: nextVelocity, grounded: false };
}
