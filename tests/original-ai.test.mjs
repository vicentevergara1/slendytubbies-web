import test from 'node:test';
import assert from 'node:assert/strict';
import { stepTinky } from '../src/original-ai.js';

test('Tinky se acerca por detrás con la velocidad original', () => {
  const player = { x: 10, z: 10, forwardX: 0, forwardZ: 1, health: 100 };
  const next = stepTinky({ x: 10, z: 0 }, player, 1, 10);
  assert.equal(next.z, 5);
  assert.equal(next.health, 100);
  assert.equal(next.offScreen, true);
});

test('Tinky incrementa la velocidad con cinco y dos natillas restantes', () => {
  const player = { x: 100, z: 100, forwardX: 0, forwardZ: 1, health: 100 };
  assert.equal(stepTinky({ x: 100, z: 0 }, player, 1, 5).speed, 7);
  assert.equal(stepTinky({ x: 100, z: 0 }, player, 1, 2).speed, 12);
});

test('Mirar a Tinky a menos de diez metros reduce la salud y lo detiene', () => {
  const player = { x: 0, z: 0, forwardX: 0, forwardZ: 1, health: 100 };
  const next = stepTinky({ x: 0, z: 5 }, player, 1, 10);
  assert.equal(next.z, 5);
  assert.equal(next.visible, true);
  assert.equal(next.health, 50);
});

test('Tinky no hace daño detrás de una colina', () => {
  const player = { x: 0, z: 0, forwardX: 0, forwardZ: 1, health: 100 };
  const next = stepTinky({ x: 0, z: 5 }, player, 1, 10, false);
  assert.equal(next.health, 100);
  assert.equal(next.visible, false);
});
