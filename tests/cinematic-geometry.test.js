import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { wallLayout, brickPose, createWall } from '../src/wall-model.js';
import { createSnitch, createSnitchFlight } from '../src/snitch-model.js';

test('the wall clears the entire camera frustum on mobile, tablet and wide screens', () => {
  for (const aspect of [320 / 800, 390 / 844, 768 / 1024, 1440 / 900, 2560 / 1080]) {
    const layout = wallLayout(aspect);
    assert(layout.bricks.length < 1000);
    for (const brick of layout.bricks) {
      const start = brickPose(brick, 0);
      assert.equal(start.x, brick.x); assert.equal(start.y, brick.y);
      for (const time of [0, 0.5, 1.5, 2.5, 4.3]) assert(Object.values(brickPose(brick, time)).every(Number.isFinite));
      const end = brickPose(brick, 4.3);
      const perspective = (7.65 - end.z) / 8;
      assert(Math.abs(end.x) > 0.5 + layout.halfWidth * perspective || Math.abs(end.y) > 0.5 + layout.halfHeight * perspective);
    }
  }
});

test('instanced wall matrices and articulated snitch meshes contain finite geometry', () => {
  const texture = new THREE.Texture();
  const wall = createWall(1.6, texture);
  wall.update(1.8);
  for (const mesh of wall.group.children) assert([...mesh.instanceMatrix.array].every(Number.isFinite));
  wall.dispose(); texture.dispose();
  const snitch = createSnitch();
  snitch.flap(1.4);
  snitch.group.traverse(object => {
    if (object.geometry) assert([...object.geometry.attributes.position.array].every(Number.isFinite));
  });
  snitch.dispose();
});

function seededRandom(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

test('random flights keep safe margins and remain continuous through destination changes', () => {
  for (const aspect of [0.4, 1.6, 2.4]) {
    const flight = createSnitchFlight({ random: seededRandom(42) });
    let previous = flight.advance(0, aspect);
    let travelled = 0;
    for (let frame = 0; frame < 1800; frame++) {
      const p = flight.advance(1 / 60, aspect);
      assert(p.toArray().every(Number.isFinite));
      assert(Math.abs(p.x) <= 4.3 * aspect + 1e-10);
      assert(p.y >= -3.8 - 1e-10 && p.y <= 3.8 + 1e-10);
      const distance = previous.distanceTo(p);
      assert(distance < 0.15 * Math.max(1, aspect), 'destination change must not teleport');
      travelled += distance;
      previous = p;
    }
    assert(travelled > 5, 'flight moves without any scroll or pointer input');
  }
});

test('flight timing is frame-rate independent and each random seed creates a different path', () => {
  const slow = createSnitchFlight({ random: seededRandom(7) });
  const fast = createSnitchFlight({ random: seededRandom(7) });
  const other = createSnitchFlight({ random: seededRandom(91) });
  let a, b;
  for (let i = 0; i < 600; i++) a = slow.advance(1 / 30, 1.6);
  for (let i = 0; i < 1200; i++) b = fast.advance(1 / 60, 1.6);
  assert(a.distanceTo(b) < 1e-9);
  assert(a.distanceTo(other.advance(20, 1.6)) > 0.1);
  assert.equal(a.distanceTo(slow.advance(0, 1.6)), 0, 'paused time preserves position');
});
