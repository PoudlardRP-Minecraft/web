import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { wallLayout, brickPose, createWall } from '../src/wall-model.js';
import { createSnitch, snitchRoute } from '../src/snitch-model.js';

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

test('flight paths remain finite and within the screen at every section boundary', () => {
  for (const aspect of [0.4, 1.6, 2.4]) for (const progress of [0, 0.25, 0.5, 0.75, 1]) for (let index = 0; index < 2; index++) {
    const p = snitchRoute(progress, 2.3, index, aspect);
    assert(p.toArray().every(Number.isFinite));
    assert(Math.abs(p.x) < 5 * aspect);
    assert(Math.abs(p.y) < 5);
  }
});
