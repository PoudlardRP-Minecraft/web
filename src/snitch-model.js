import * as THREE from 'three';

export function createSnitch() {
  const group = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xe8b84e, metalness: 0.91, roughness: 0.24 });
  const engraving = new THREE.MeshStandardMaterial({ color: 0x78511a, metalness: 0.83, roughness: 0.36 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xd9d7c9, metalness: 0.82, roughness: 0.3, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.185, 32, 24), gold);
  group.add(body);
  // Fine raised seams and engraved arcs catch the environment reflections.
  for (let i = 0; i < 3; i++) {
    const seam = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.004, 5, 64), engraving);
    seam.rotation.set(Math.PI / 2, i * Math.PI / 3, 0.2);
    group.add(seam);
  }
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const points = [];
    for (let j = 0; j <= 24; j++) {
      const t = j / 24;
      const a = 0.5 + t * 1.3;
      const phi = side * (0.25 + i * 0.37 + Math.sin(t * Math.PI) * 0.2);
      points.push(new THREE.Vector3(Math.sin(a) * Math.sin(phi), Math.cos(a), Math.sin(a) * Math.cos(phi)).multiplyScalar(0.188));
    }
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.0025, 4, false), gold));
  }
  const featherShape = new THREE.Shape();
  featherShape.moveTo(0, 0);
  featherShape.bezierCurveTo(0.27, 0.085, 0.72, 0.055, 1, 0);
  featherShape.bezierCurveTo(0.67, -0.034, 0.24, -0.055, 0, 0);
  const featherGeometry = new THREE.ExtrudeGeometry(featherShape, { depth: 0.004, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 1, steps: 1, curveSegments: 8 });
  const wings = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(side * 0.15, 0.065, 0);
    const fan = new THREE.Group();
    fan.scale.x = side;
    const hinge = new THREE.Mesh(new THREE.SphereGeometry(0.044, 12, 8), gold);
    fan.add(hinge);
    for (let i = 0; i < 10; i++) {
      const feather = new THREE.Mesh(featherGeometry, silver);
      const length = 0.94 - i * 0.039;
      feather.scale.set(length, 0.78 + i * 0.025, 1);
      feather.rotation.z = 0.23 - i * 0.066;
      feather.position.set(i * 0.017, -i * 0.007, i * 0.003);
      fan.add(feather);
      const ribPoints = [new THREE.Vector3(0.04, 0, 0.008), new THREE.Vector3(length * 0.5, 0.014, 0.01), new THREE.Vector3(length * 0.96, 0, 0.008)];
      const rib = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ribPoints), 8, 0.0023, 3, false), gold);
      rib.position.copy(feather.position);
      rib.rotation.copy(feather.rotation);
      fan.add(rib);
    }
    wing.add(fan);
    group.add(wing);
    wings.push({ wing, side });
  }
  return {
    group,
    flap(time) {
      for (const { wing, side } of wings) {
        wing.rotation.y = side * (Math.sin(time * 48) * 0.58 + 0.08);
        wing.rotation.z = side * (0.17 + Math.sin(time * 48 + 0.35) * 0.10);
      }
      body.rotation.y = Math.sin(time * 0.8) * 0.08;
    },
    dispose() {
      const geometries = new Set();
      group.traverse(o => { if (o.geometry) geometries.add(o.geometry); });
      geometries.forEach(g => g.dispose());
      gold.dispose(); engraving.dispose(); silver.dispose();
    },
  };
}

export function snitchRoute(progress, time, index = 0, aspect = 1.7) {
  // Rest along the margins, crossing between sections as the visitor scrolls.
  const p = THREE.MathUtils.clamp(progress, 0, 1);
  const route = index === 0
    ? [[0.84, 0.39], [0.13, 0.56], [0.88, 0.35], [0.12, 0.70], [0.86, 0.55]]
    : [[0.13, 0.73], [0.87, 0.23], [0.12, 0.72], [0.88, 0.34], [0.16, 0.30]];
  const segment = Math.min(3, Math.floor(p * 4));
  let blend = p * 4 - segment;
  blend = blend * blend * (3 - 2 * blend);
  const phase = time * 0.58 + index * 2.9;
  let x = THREE.MathUtils.lerp(route[segment][0], route[segment + 1][0], blend);
  let y = THREE.MathUtils.lerp(route[segment][1], route[segment + 1][1], blend);
  x += Math.sin(phase) * 0.034 + Math.sin(phase * 2.3) * 0.009;
  y += Math.sin(phase * 1.31) * 0.047;
  x = THREE.MathUtils.clamp(x, 0.12, 0.88);
  return new THREE.Vector3((x - 0.5) * 10 * aspect, (0.5 - y) * 10, Math.sin(phase) * 0.3);
}
