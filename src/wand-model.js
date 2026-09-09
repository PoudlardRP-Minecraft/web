import * as THREE from 'three';

// Preserve the supplied Blockbench geometry, pivots and atlas UVs.
// BoxGeometry orders faces east, west, up, down, south, north.
export async function buildWand(model) {
  const texture = await new THREE.TextureLoader().loadAsync(model.texture);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.66, metalness: 0.24 });
  const root = new THREE.Group();
  const scale = 3.2 / 24;
  const faceOrder = ['east', 'west', 'up', 'down', 'south', 'north'];
  for (const element of model.elements) {
    const size = element.to.map((n, i) => n - element.from[i]);
    if (size.some(n => n <= 0)) continue;
    const geometry = new THREE.BoxGeometry(...size);
    const uv = geometry.attributes.uv;
    faceOrder.forEach((faceName, index) => {
      const face = element.faces[faceName];
      if (!face?.uv) return;
      const [u1, v1, u2, v2] = face.uv;
      const w = model.resolution.width;
      const h = model.resolution.height;
      const coords = [[u1 / w, 1 - v1 / h], [u2 / w, 1 - v1 / h], [u1 / w, 1 - v2 / h], [u2 / w, 1 - v2 / h]];
      // Supplied atlas faces have no UV rotation; preserve explicit rotations if added.
      const turns = ((face.rotation || 0) / 90) % 4;
      let mapped = coords;
      for (let i = 0; i < turns; i++) mapped = [mapped[2], mapped[0], mapped[3], mapped[1]];
      mapped.forEach(([u, v], vertex) => uv.setXY(index * 4 + vertex, u, v));
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = element.name;
    const pivot = new THREE.Group();
    const origin = element.origin || [8, 12, 8];
    pivot.position.set(origin[0] - 8, origin[1] - 12, origin[2] - 8);
    mesh.position.set(...element.from.map((n, i) => n + size[i] / 2 - origin[i]));
    if (element.rotation) pivot.rotation.set(...element.rotation.map(THREE.MathUtils.degToRad), 'ZYX');
    pivot.add(mesh);
    root.add(pivot);
  }
  root.scale.setScalar(scale);
  // The wrapper keeps effect positions in normalized world units.
  const wrapper = new THREE.Group();
  wrapper.add(root);
  return wrapper;
}
