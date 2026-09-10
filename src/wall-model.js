import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const BRICK = { width: 0.82, height: 0.32, depth: 0.38, xStep: 0.85, yStep: 0.345 };
const smooth = t => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const noise = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

export function wallLayout(aspect) {
  // A perspective camera at z=8 with a 48-degree field of view.
  const halfHeight = 8 * Math.tan(THREE.MathUtils.degToRad(24));
  const halfWidth = halfHeight * aspect;
  const columns = Math.ceil(halfWidth * 2 / BRICK.xStep) + 4;
  const rows = Math.ceil(halfHeight * 2 / BRICK.yStep) + 4;
  const bricks = [];
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const x = (column - (columns - 1) / 2) * BRICK.xStep + (row % 2 ? BRICK.xStep / 2 : 0);
    const y = (row - (rows - 1) / 2) * BRICK.yStep;
    const seed = row * columns + column;
    const side = x >= 0 ? 1 : -1;
    const crown = y > halfHeight * 0.52 && Math.abs(x) < halfWidth * 0.54;
    bricks.push({
      x, y, z: (noise(seed + 10) - 0.5) * 0.018, side, crown,
      variation: noise(seed + 2),
      // A ripple propagates from the central brick, then the arch folds away.
      delay: Math.abs(x - 0.4) / Math.max(halfWidth, 1) * 0.6 + Math.abs(y - 0.4) / halfHeight * 0.4,
      targetX: crown ? x * 1.15 : side * (halfWidth * 1.5 + 2.8 + Math.abs(x) * 0.28),
      targetY: crown ? halfHeight * 1.6 + 2.2 + y * 0.15 : y * 1.1,
    });
  }
  return { bricks, halfWidth, halfHeight };
}

export function brickPose(brick, time) {
  const p = THREE.MathUtils.clamp((time - brick.delay) / 2.7, 0, 1);
  const move = smooth((p - 0.12) / 0.88);
  const turn = smooth(p / 0.7);
  return {
    x: THREE.MathUtils.lerp(brick.x, brick.targetX, move),
    y: THREE.MathUtils.lerp(brick.y, brick.targetY, move),
    z: brick.z - Math.sin(p * Math.PI) * 0.55 - move * 0.8,
    rx: brick.crown ? turn * 1.42 : (brick.variation - 0.5) * 0.1 * turn,
    ry: brick.crown ? 0 : brick.side * turn * 1.54,
    rz: brick.crown ? 0 : brick.side * 0.035 * turn,
  };
}

export function createWall(aspect, texture) {
  const { bricks, halfWidth, halfHeight } = wallLayout(aspect);
  const geometry = new RoundedBoxGeometry(BRICK.width, BRICK.height, BRICK.depth, 1, 0.018);
  // Slightly irregular faces retain rounded edges rather than perfect toy blocks.
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const ripple = Math.sin(x * 57 + y * 33) * Math.sin(y * 73 + z * 21);
    positions.setZ(i, z + ripple * 0.003);
  }
  geometry.computeVertexNormals();
  const offsets = new Float32Array(bricks.length * 2);
  bricks.forEach((_, i) => { offsets[i * 2] = noise(i + 60); offsets[i * 2 + 1] = noise(i + 100); });
  geometry.setAttribute('brickOffset', new THREE.InstancedBufferAttribute(offsets, 2));
  const bump = texture.clone();
  bump.colorSpace = THREE.NoColorSpace;
  bump.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({ map: texture, bumpMap: bump, bumpScale: 0.026, roughness: 0.96, metalness: 0, color: 0xcbb8ab });
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute vec2 brickOffset;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      #ifdef USE_MAP
        vMapUv = vMapUv * vec2(0.72, 0.30) + brickOffset;
      #endif
      #ifdef USE_BUMPMAP
        vBumpMapUv = vBumpMapUv * vec2(0.72, 0.30) + brickOffset;
      #endif`);
  };
  material.customProgramCacheKey = () => 'arcanum-clay-v1';
  const masonry = new THREE.InstancedMesh(geometry, material, bricks.length);
  const mortar = new THREE.InstancedMesh(new THREE.BoxGeometry(BRICK.xStep + 0.002, BRICK.yStep + 0.002, 0.065), new THREE.MeshStandardMaterial({ color: 0x4c4540, roughness: 1 }), bricks.length);
  masonry.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mortar.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  masonry.frustumCulled = mortar.frustumCulled = false;
  const color = new THREE.Color();
  bricks.forEach((brick, i) => {
    color.setHSL(0.05 + brick.variation * 0.015, 0.12 + brick.variation * 0.10, 0.63 + brick.variation * 0.26);
    masonry.setColorAt(i, color);
  });
  const group = new THREE.Group();
  group.add(mortar, masonry);
  const dummy = new THREE.Object3D();
  const back = new THREE.Vector3();
  const update = time => {
    bricks.forEach((brick, i) => {
      const p = brickPose(brick, time);
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rx, p.ry, p.rz);
      dummy.updateMatrix();
      masonry.setMatrixAt(i, dummy.matrix);
      // Each brick carries its recessed mortar: no opaque backing hides the opening.
      back.set(0, 0, -BRICK.depth / 2 - 0.025).applyQuaternion(dummy.quaternion);
      dummy.position.add(back);
      dummy.updateMatrix();
      mortar.setMatrixAt(i, dummy.matrix);
    });
    masonry.instanceMatrix.needsUpdate = true;
    mortar.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return {
    group, update, halfWidth, halfHeight, count: bricks.length,
    dispose() { geometry.dispose(); material.dispose(); bump.dispose(); mortar.geometry.dispose(); mortar.material.dispose(); },
  };
}
