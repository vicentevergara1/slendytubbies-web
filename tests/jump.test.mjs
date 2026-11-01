import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceJump } from '../src/jump-physics.js';

test('un salto alcanza altura positiva y regresa al suelo', () => {
  let height = 0;
  let velocity = 9.4;
  let grounded = false;
  let maximum = 0;
  for (let step = 0; step < 100 && !grounded; step++) {
    const result = advanceJump(height, velocity, 1 / 60);
    height = result.height;
    velocity = result.velocity;
    grounded = result.grounded;
    maximum = Math.max(maximum, height);
  }
  assert.ok(maximum > 1.5);
  assert.ok(maximum < 2.5);
  assert.equal(height, 0);
  assert.equal(velocity, 0);
  assert.equal(grounded, true);
});

test('un salto no atraviesa el piso', () => {
  assert.deepEqual(advanceJump(.1, -4, .1), { height: 0, velocity: 0, grounded: true });
});
