import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createWall } from './wall-model.js';
import { createSnitch, createSnitchFlight } from './snitch-model.js';

const emit = (name, detail) => window.dispatchEvent(new CustomEvent(`arcanum:${name}`, { detail }));

export function createCinematicEffects({ enabled: initiallyEnabled }) {
  const canvas = document.querySelector('#cinematic-scene');
  const layer = document.querySelector('#cinematic-layer');
  const dialog = document.querySelector('#wall-intro');
  const introSlot = document.querySelector('#entrance-scene');
  const replay = document.querySelector('#replay-entrance');
  const compact = matchMedia('(max-width: 720px)').matches;
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = new THREE.Vector2();
  let enabled = initiallyEnabled;
  let renderer, scene, wallCamera, flightCamera, environmentTarget, wall, texture;
  let ready = false, starting = false, disposed = false, textureFailed = false;
  let intro = false, introTime = -0.8, openingAnnounced = false;
  let frame = 0, previous = 0, time = 0;
  const flights = [];
  const origin = new THREE.Vector3();
  const drift = new THREE.Vector3();

  function resize() {
    if (!renderer || disposed) return;
    const width = innerWidth, height = innerHeight;
    renderer.setSize(width, height, false);
    const aspect = width / height;
    wallCamera.aspect = aspect;
    wallCamera.updateProjectionMatrix();
    flightCamera.left = -5 * aspect;
    flightCamera.right = 5 * aspect;
    flightCamera.top = 5;
    flightCamera.bottom = -5;
    flightCamera.updateProjectionMatrix();
    if (intro && texture) {
      if (wall) { scene.remove(wall.group); wall.dispose(); }
      wall = createWall(aspect, texture);
      scene.add(wall.group);
    }
    flights.forEach((f, index) => {
      // Fixed CSS-pixel wingspan, including on tall displays and small phones.
      const wingspan = compact ? 38 : (index ? 42 : 58);
      f.snitch.group.scale.setScalar(wingspan * 10 / (height * 2.2));
      f.seeded = false;
    });
  }

  function createTrail() {
    const count = compact ? 18 : 26;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const gold = new THREE.Color(0xe8b864);
    for (let i = 0; i < count; i++) {
      const fade = Math.pow(1 - i / count, 2) * 0.65;
      colors[i * 3] = gold.r * fade;
      colors[i * 3 + 1] = gold.g * fade;
      colors[i * 3 + 2] = gold.b * fade;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const trail = new THREE.Line(geometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
    trail.frustumCulled = false;
    return { trail, count, positions, seeded: false, sampleTime: 0 };
  }

  function beginEntrance() {
    if (!ready || !enabled || !dialog.open || !texture || intro || disposed) return;
    intro = true; introTime = -0.85; openingAnnounced = false;
    flights.forEach(f => { f.snitch.group.visible = false; f.trail.visible = false; });
    introSlot.append(canvas);
    layer.hidden = true;
    wall = createWall(innerWidth / innerHeight, texture);
    scene.add(wall.group);
    wallCamera.position.set(0, 0, 8);
    wallCamera.lookAt(0, 0, 0);
    renderer.render(scene, wallCamera);
    emit('entrance-ready');
    emit('entrance-state', { active: true });
    wake();
  }

  function leaveEntrance() {
    if (wall) { scene.remove(wall.group); wall.dispose(); wall = null; }
    intro = false;
    layer.append(canvas);
    layer.hidden = !enabled;
    flights.forEach(f => { f.snitch.group.visible = true; f.trail.visible = true; f.seeded = false; });
    emit('entrance-state', { active: false });
    wake();
  }

  async function initialize() {
    if (starting || ready || disposed || !enabled) return;
    starting = true;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !compact, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(devicePixelRatio, compact ? 1.15 : 1.65));
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      environmentTarget = pmrem.fromScene(room, 0.04);
      scene.environment = environmentTarget.texture;
      scene.environmentIntensity = 0.7;
      room.dispose(); pmrem.dispose();
      scene.add(new THREE.HemisphereLight(0xb6c3dc, 0x2d1610, 1.25));
      const warm = new THREE.DirectionalLight(0xffd4a2, 3.2);
      warm.position.set(-4, 5, 5);
      scene.add(warm);
      const cool = new THREE.DirectionalLight(0xa5c6ff, 1.0);
      cool.position.set(5, -1, 3);
      scene.add(cool);
      wallCamera = new THREE.PerspectiveCamera(48, 1, 0.1, 60);
      wallCamera.position.z = 8;
      flightCamera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 30);
      flightCamera.position.z = 10;
      for (let i = 0; i < (compact ? 1 : 2); i++) {
        const snitch = createSnitch();
        scene.add(snitch.group);
        const trail = createTrail();
        scene.add(trail.trail);
        flights.push({ snitch, ...trail, flight: createSnitchFlight(), previous: new THREE.Vector3() });
      }
      resize();
      ready = true;
      replay.hidden = false;
      replay.disabled = !enabled;
      if (!dialog.open) leaveEntrance();
      // Texture failures skip only the entrance; the Vifs d’or remain independent.
      new THREE.TextureLoader().loadAsync(new URL('./assets/brick-clay.webp', import.meta.url).href)
        .then(loaded => {
          if (disposed) { loaded.dispose(); return; }
          texture = loaded;
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
          texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
          if (dialog.open) beginEntrance();
        })
        .catch(() => { textureFailed = true; replay.disabled = true; emit('entrance-unavailable'); });
      wake();
    } catch (error) {
      console.warn('Arcanum: cinematic effects unavailable.', error);
      emit('entrance-unavailable');
      dispose();
    } finally { starting = false; }
  }

  function updateFlights(delta) {
    flights.forEach((f, index) => {
      f.flight.advance(delta, innerWidth / innerHeight, origin);
      if (!f.seeded) f.previous.copy(origin);
      drift.copy(origin).sub(f.previous).divideScalar(delta || 1);
      f.snitch.group.position.copy(origin);
      f.snitch.group.rotation.set(0.16 + Math.sin(time * 0.67 + index) * 0.14, Math.sin(time * 0.46 + index) * 0.48, THREE.MathUtils.clamp(-drift.x * 0.09, -0.55, 0.55) + Math.sin(time * 0.8) * 0.1);
      f.snitch.flap(time + index * 0.5);
      f.previous.copy(origin);
      if (!f.seeded) {
        for (let i = 0; i < f.count; i++) origin.toArray(f.positions, i * 3);
        f.seeded = true;
      }
      // Sample trails at a stable rate, independent of monitor refresh rate.
      f.sampleTime += delta;
      if (f.sampleTime >= 1 / 45) {
        f.positions.copyWithin(3, 0, f.positions.length - 3);
        origin.toArray(f.positions, 0);
        f.sampleTime = 0;
      }
      f.trail.geometry.attributes.position.needsUpdate = true;
    });
    renderer.render(scene, flightCamera);
  }

  function animate(now) {
    frame = 0;
    if (!enabled || !ready || disposed || document.hidden) { previous = 0; return; }
    const delta = previous ? Math.min(0.05, (now - previous) / 1000) : 0;
    previous = now; time += delta;
    if (intro && wall) {
      introTime += delta;
      if (introTime >= 0.18 && !openingAnnounced) { openingAnnounced = true; emit('entrance-opening'); }
      wall.update(Math.max(0, introTime));
      wallCamera.position.x = pointer.x * 0.022;
      wallCamera.position.y = pointer.y * 0.016;
      wallCamera.position.z = 8 - Math.max(0, Math.min(1, introTime / 4)) * 0.35;
      renderer.render(scene, wallCamera);
      if (introTime > 4.3) { emit('entrance-finish'); if (intro) leaveEntrance(); }
    } else if (!dialog.open) updateFlights(delta);
    // Closing the native dialog can synchronously call wake(). Keep one loop.
    if (!frame) frame = requestAnimationFrame(animate);
  }

  function wake() {
    if (!frame && ready && enabled && !disposed && !document.hidden && (!dialog.open || intro)) frame = requestAnimationFrame(animate);
  }

  function setEnabled(value) {
    enabled = value;
    replay.disabled = !enabled || textureFailed;
    layer.hidden = !enabled || intro;
    if (!enabled) {
      cancelAnimationFrame(frame); frame = 0; previous = 0;
      if (dialog.open) emit('entrance-unavailable');
    } else { initialize(); wake(); }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame); frame = 0;
    layer.hidden = true;
    replay.hidden = true;
    wall?.dispose(); texture?.dispose();
    flights.forEach(f => { f.snitch.dispose(); f.trail.geometry.dispose(); f.trail.material.dispose(); });
    environmentTarget?.dispose(); renderer?.dispose();
  }

  window.addEventListener('resize', resize, { passive: true });
  if (!compact) window.addEventListener('pointermove', event => pointer.set(event.clientX / innerWidth * 2 - 1, 1 - event.clientY / innerHeight * 2), { passive: true });
  window.addEventListener('arcanum:entrance-request', () => {
    if (disposed || textureFailed || !enabled || motionQuery.matches) { emit('entrance-unavailable'); return; }
    initialize(); beginEntrance();
  });
  window.addEventListener('arcanum:entrance-start', () => { if (intro) introTime = Math.max(introTime, 0); });
  window.addEventListener('arcanum:entrance-close', () => { if (ready && !disposed) leaveEntrance(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; previous = 0; }
    else { flights.forEach(f => { f.seeded = false; }); wake(); }
  });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); emit('entrance-unavailable'); dispose(); });
  initialize();
  return { setEnabled, dispose };
}
