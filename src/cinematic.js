import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createWall } from './wall-model.js';

const emit = (name, detail) => window.dispatchEvent(new CustomEvent(`arcanum:${name}`, { detail }));

export function createCinematicEffects({ enabled: initiallyEnabled }) {
  const canvas = document.querySelector('#cinematic-scene');
  const dialog = document.querySelector('#wall-intro');
  const replay = document.querySelector('#replay-entrance');
  const compact = matchMedia('(max-width: 720px)').matches;
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = new THREE.Vector2();
  let enabled = initiallyEnabled;
  let renderer, scene, wallCamera, environmentTarget, wall, texture;
  let ready = false, starting = false, disposed = false, textureFailed = false;
  let intro = false, introTime = -0.8, openingAnnounced = false;
  let frame = 0, previous = 0;

  function resize() {
    if (!renderer || disposed) return;
    const width = innerWidth, height = innerHeight;
    renderer.setSize(width, height, false);
    const aspect = width / height;
    wallCamera.aspect = aspect;
    wallCamera.updateProjectionMatrix();
    if (intro && texture) {
      if (wall) { scene.remove(wall.group); wall.dispose(); }
      wall = createWall(aspect, texture);
      scene.add(wall.group);
    }
  }

  function beginEntrance() {
    if (!ready || !enabled || !dialog.open || !texture || intro || disposed) return;
    intro = true; introTime = -0.85; openingAnnounced = false;
    previous = 0;
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
    cancelAnimationFrame(frame); frame = 0; previous = 0;
    emit('entrance-state', { active: false });
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
      resize();
      ready = true;
      replay.hidden = false;
      replay.disabled = !enabled;
      if (!dialog.open) leaveEntrance();
      // Texture failures release the entrance through its independent controller.
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

  function animate(now) {
    frame = 0;
    if (!enabled || !ready || disposed || document.hidden || !intro || !wall) { previous = 0; return; }
    const delta = previous ? Math.min(0.05, (now - previous) / 1000) : 0;
    previous = now;
    if (intro && wall) {
      introTime += delta;
      if (introTime >= 0.18 && !openingAnnounced) { openingAnnounced = true; emit('entrance-opening'); }
      wall.update(Math.max(0, introTime));
      wallCamera.position.x = pointer.x * 0.022;
      wallCamera.position.y = pointer.y * 0.016;
      wallCamera.position.z = 8 - Math.max(0, Math.min(1, introTime / 4)) * 0.35;
      renderer.render(scene, wallCamera);
      if (introTime > 4.3) { emit('entrance-finish'); if (intro) leaveEntrance(); }
    }
    if (intro && !frame) frame = requestAnimationFrame(animate);
  }

  function wake() {
    if (!frame && ready && enabled && !disposed && !document.hidden && intro) frame = requestAnimationFrame(animate);
  }

  function setEnabled(value) {
    enabled = value;
    replay.disabled = !enabled || textureFailed;
    if (!enabled) {
      cancelAnimationFrame(frame); frame = 0; previous = 0;
      if (dialog.open) emit('entrance-unavailable');
    } else { initialize(); wake(); }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame); frame = 0;
    replay.hidden = true;
    wall?.dispose(); texture?.dispose();
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
    else wake();
  });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); emit('entrance-unavailable'); dispose(); });
  initialize();
  return { setEnabled, dispose };
}
