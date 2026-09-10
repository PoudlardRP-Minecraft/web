import * as THREE from 'three';
import { buildWand } from './wand-model.js';
import { createCinematicEffects } from './cinematic.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const compact = matchMedia('(max-width: 720px)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
const toggle = document.querySelector('#motion-toggle');
const hero = document.querySelector('.hero');
const stage = document.querySelector('#wand-viewport');
const experience = document.querySelector('#magic-experience');
const castButton = document.querySelector('#cast-spell');
const cards = [...document.querySelectorAll('.spell-card')];
const spells = [
  { name: 'Lumos', color: 0xffd693, caption: 'Faites naître la lumière.' },
  { name: 'Protego', color: 0x72caff, caption: 'Dressez votre sphère de protection.' },
  { name: 'Wingardium Leviosa', color: 0x9be9d3, caption: 'Laissez la gravité derrière vous.' },
  { name: 'Bombarda', color: 0xff9755, caption: 'Libérez une déflagration magique.' },
];
let enabled = !reducedMotion.matches;
let initialized = false;
let initializing = false;
let failed = false;
let selected = 0;
let frame = 0;
let previousTime = 0;
let elapsed = 0;
let burst = 0;
let heroVisible = false;
let stageVisible = false;
let heroView, wandView, wand, glow, shield, rings, sparks, dust, halo;
const pointer = new THREE.Vector2();
const smoothedPointer = new THREE.Vector2();
const tipPosition = new THREE.Vector3();
const resources = [];
const cinematic = createCinematicEffects({ enabled });
let entranceActive = !!document.querySelector('#wall-intro')?.open;
window.addEventListener('arcanum:entrance-state', event => {
  entranceActive = event.detail.active;
  if (!entranceActive) wake();
});

function makeView(canvas, container, z) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !compact, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, compact ? 1 : 1.5));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
  camera.position.z = z;
  const resize = () => {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    disableUnavailable();
  });
  const view = { renderer, scene, camera, observer };
  resources.push(view);
  return view;
}

function pointCloud(count, color, size, spread = 1) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) seeds[i] = Math.random();
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (seeds[i * 3] - 0.5) * spread * 2;
    positions[i * 3 + 1] = (seeds[i * 3 + 1] - 0.5) * spread;
    positions[i * 3 + 2] = (seeds[i * 3 + 2] - 0.5) * spread;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uSize: { value: size }, uOpacity: { value: 0.7 } },
    vertexShader: `uniform float uSize; void main(){vec4 viewPosition=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*viewPosition;gl_PointSize=clamp(uSize/-viewPosition.z,1.0,28.0);}`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; void main(){float d=length(gl_PointCoord-0.5);float glow=exp(-d*d*20.0)*(1.0-smoothstep(0.35,0.5,d));gl_FragColor=vec4(uColor,glow*uOpacity);}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  // Animated particles can leave their initial bounding sphere.
  points.frustumCulled = false;
  points.userData.seeds = seeds;
  return points;
}

function glowTexture() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    const radius = Math.hypot(x / size - 0.5, y / size - 0.5);
    data[i] = data[i + 1] = data[i + 2] = 255;
    data[i + 3] = Math.round(255 * Math.exp(-radius * radius * 28) * (1 - Math.min(1, radius * 2)));
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.needsUpdate = true;
  return texture;
}

async function initialize() {
  if (initialized || initializing || failed) return;
  initializing = true;
  try {
    // Load source assets before allocating GPU contexts, keeping failure atomic.
    const response = await fetch(new URL('./assets/wand.json', import.meta.url));
    if (!response.ok) throw new Error('Wand asset unavailable');
    wand = await buildWand(await response.json());
    heroView = makeView(document.querySelector('#hero-magic'), hero, 10);
    dust = pointCloud(compact ? 110 : 340, 0xf8d49b, compact ? 31 : 42, 13);
    heroView.scene.add(dust);
    halo = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const circle = new THREE.Mesh(new THREE.TorusGeometry(2.5 + i * 0.22, 0.006, 3, 100), new THREE.MeshBasicMaterial({ color: 0xd4b783, transparent: true, opacity: 0.11 - i * 0.02, depthWrite: false }));
      circle.rotation.set(0.6 + i * 0.6, 0.2 + i * 0.5, i);
      halo.add(circle);
    }
    halo.position.set(compact ? 1.9 : 4.2, 0.45, -3);
    heroView.scene.add(halo);
    wandView = makeView(document.querySelector('#wand-scene'), stage, compact ? 7.3 : 6.6);
    wandView.scene.add(new THREE.HemisphereLight(0xd9edff, 0x493125, 3.1));
    const key = new THREE.DirectionalLight(0xffe2ae, 4);
    key.position.set(2, 3, 4);
    wandView.scene.add(key);
    const rim = new THREE.DirectionalLight(0x7ac8ed, 3);
    rim.position.set(-3, 1, -1);
    wandView.scene.add(rim);
    wand.rotation.set(0.1, -0.35, -0.7);
    wandView.scene.add(wand);
    glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: spells[0].color, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(1.1);
    wandView.scene.add(glow);
    shield = new THREE.Mesh(new THREE.SphereGeometry(1.75, compact ? 24 : 40, 24), new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(spells[1].color) }, uTime: { value: 0 } },
      vertexShader: `varying vec3 vNormal; varying vec3 vEye; void main(){vec4 p=modelViewMatrix*vec4(position,1.0);vNormal=normalize(normalMatrix*normal);vEye=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,
      fragmentShader: `uniform vec3 uColor;uniform float uTime;varying vec3 vNormal;varying vec3 vEye;void main(){float edge=pow(1.0-abs(dot(normalize(vNormal),normalize(vEye))),2.4);float ripple=0.88+0.12*sin(vNormal.y*24.0-uTime*1.8);gl_FragColor=vec4(uColor,edge*0.52*ripple+0.015);}`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    wandView.scene.add(shield);
    rings = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.45 + i * 0.15, 0.012, 6, 100), new THREE.MeshBasicMaterial({ color: spells[0].color, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
      rings.add(ring);
    }
    wandView.scene.add(rings);
    sparks = pointCloud(compact ? 200 : 600, spells[0].color, 34);
    wandView.scene.add(sparks);
    initialized = true;
    selectSpell(selected);
    updateMotion();
  } catch (error) {
    console.warn('Arcanum: visual effects unavailable.', error);
    disableUnavailable();
  } finally {
    initializing = false;
  }
}

function selectSpell(index) {
  selected = index;
  const spell = spells[index];
  document.querySelector('#active-spell').textContent = spell.name;
  document.querySelector('#spell-caption').textContent = spell.caption;
  cards.forEach((card, i) => card.classList.toggle('is-selected', i === index));
  experience.style.setProperty('--spell-color', '#' + spell.color.toString(16));
  if (!initialized) return;
  sparks.material.uniforms.uColor.value.set(spell.color);
  glow.material.color.set(spell.color);
  rings.children.forEach(ring => ring.material.color.set(spell.color));
  shield.visible = index === 1;
  burst = 0.6;
  wake();
}

function updateHero(delta) {
  const p = dust.geometry.attributes.position;
  const seeds = dust.userData.seeds;
  for (let i = 0; i < p.count; i++) {
    p.array[i * 3 + 1] += delta * (0.15 + seeds[i * 3] * 0.24);
    if (p.array[i * 3 + 1] > 6.5) p.array[i * 3 + 1] = -6.5;
    p.array[i * 3] += Math.sin(elapsed * 0.25 + seeds[i * 3 + 1] * 10) * delta * 0.07;
  }
  p.needsUpdate = true;
  dust.rotation.y = smoothedPointer.x * 0.045;
  halo.rotation.z = elapsed * 0.04;
  halo.rotation.y = Math.sin(elapsed * 0.15) * 0.2;
  heroView.camera.position.x = smoothedPointer.x * 0.18;
  heroView.camera.position.y = smoothedPointer.y * 0.12;
  const progress = Math.min(1, scrollY / hero.offsetHeight);
  hero.querySelector('.hero-image').style.transform = `translate3d(${smoothedPointer.x * -9}px,${progress * 45 + smoothedPointer.y * 5}px,0) scale(1.08)`;
  heroView.renderer.render(heroView.scene, heroView.camera);
}

function updateWand(delta) {
  burst = Math.max(0, burst - delta * 0.48);
  wand.rotation.y = elapsed * 0.19 + smoothedPointer.x * 0.25;
  wand.rotation.z = -0.68 + Math.sin(elapsed * 0.65) * 0.065 + burst * 0.12;
  wand.position.y = Math.sin(elapsed * 1.1) * (selected === 2 ? 0.25 : 0.075);
  wand.updateMatrixWorld(true);
  tipPosition.set(0, 1.6, 0).applyMatrix4(wand.matrixWorld);
  glow.position.copy(tipPosition);
  glow.scale.setScalar((selected === 0 ? 1.1 : 0.65) + burst * 0.7 + Math.sin(elapsed * 1.5) * 0.06);
  shield.material.uniforms.uTime.value = elapsed;
  shield.scale.setScalar(1 + burst * 0.06);
  rings.children.forEach((ring, i) => {
    ring.rotation.set(selected === 2 ? Math.PI / 2 : 0.4 + i * 0.75, selected === 2 ? 0.15 : elapsed * 0.13 + i, elapsed * 0.2 + i);
    ring.position.y = selected === 2 ? Math.sin(elapsed + i * 2.1) * 0.9 : 0;
    ring.material.opacity = selected === 0 ? 0.13 : 0.3;
    ring.scale.setScalar(selected === 3 ? 1 + burst * 0.7 : 1);
  });
  const p = sparks.geometry.attributes.position;
  const seeds = sparks.userData.seeds;
  for (let i = 0; i < p.count; i++) {
    const a = seeds[i * 3] * Math.PI * 2;
    const b = seeds[i * 3 + 1];
    const c = seeds[i * 3 + 2];
    let x, y, z;
    if (selected === 2) {
      const phase = a + elapsed * 0.75;
      const radius = 1.1 + c * 0.45;
      x = Math.cos(phase) * radius;
      y = ((b * 4 + elapsed * 0.38) % 4) - 2;
      z = Math.sin(phase) * radius;
    } else if (selected === 1) {
      const phi = Math.acos(2 * b - 1);
      const radius = 1.76 + burst * 0.1;
      x = radius * Math.sin(phi) * Math.cos(a + elapsed * 0.12);
      y = radius * Math.cos(phi);
      z = radius * Math.sin(phi) * Math.sin(a + elapsed * 0.12);
    } else if (selected === 3) {
      const phase = (c + elapsed * 0.24) % 1;
      const radius = phase * (1.1 + burst * 2.4);
      x = tipPosition.x + Math.cos(a) * radius;
      y = tipPosition.y + Math.sin(a) * radius - phase * phase * 1.2;
      z = tipPosition.z + (b - 0.5) * radius * 2;
    } else {
      const radius = 0.15 + b * (0.8 + burst);
      x = tipPosition.x + Math.cos(a + elapsed * 0.2) * radius;
      y = tipPosition.y + (c - 0.5) * radius * 2;
      z = tipPosition.z + Math.sin(a + elapsed * 0.2) * radius;
    }
    p.array[i * 3] = x; p.array[i * 3 + 1] = y; p.array[i * 3 + 2] = z;
  }
  p.needsUpdate = true;
  wandView.renderer.render(wandView.scene, wandView.camera);
}

function animate(now) {
  frame = 0;
  if (!enabled || !initialized || document.hidden || entranceActive || (!heroVisible && !stageVisible)) { previousTime = 0; return; }
  const delta = previousTime ? Math.min((now - previousTime) / 1000, 0.05) : 0;
  previousTime = now;
  elapsed += delta;
  smoothedPointer.lerp(pointer, 1 - Math.exp(-delta * 3));
  if (heroVisible) updateHero(delta);
  if (stageVisible) updateWand(delta);
  frame = requestAnimationFrame(animate);
}

function wake() {
  if (!frame && enabled && initialized && !document.hidden && !entranceActive && (heroVisible || stageVisible)) frame = requestAnimationFrame(animate);
}

function updateMotion() {
  cinematic.setEnabled(enabled && !failed);
  const active = enabled && initialized && !failed;
  document.body.classList.toggle('effects-active', active);
  toggle.textContent = `Effets animés : ${enabled ? 'activés' : 'désactivés'}`;
  toggle.setAttribute('aria-pressed', String(enabled));
  castButton.hidden = !active;
  document.querySelector('#experience-hint').textContent = active
    ? 'Choisissez une carte, puis lancez le sort. Déplacez le pointeur pour observer la baguette.'
    : 'Sélectionnez une carte ci-dessous pour découvrir un sort.';
  if (!active) {
    cancelAnimationFrame(frame); frame = 0; previousTime = 0;
    hero.querySelector('.hero-image').style.transform = '';
    document.getAnimations().filter(a => a.id === 'arcanum-reveal').forEach(a => a.cancel());
    cards.forEach(card => { card.style.transform = ''; });
  } else wake();
}

function disableUnavailable() {
  failed = true; enabled = false;
  updateMotion();
  toggle.textContent = 'Affichage sans effets 3D';
  toggle.disabled = true;
  for (const view of resources) {
    view.observer.disconnect();
    view.scene.traverse(object => {
      object.geometry?.dispose();
      const materials = object.material ? [object.material].flat() : [];
      materials.forEach(material => { material.map?.dispose(); material.dispose(); });
    });
    view.renderer.dispose();
  }
}

toggle.hidden = false;
toggle.addEventListener('click', () => {
  enabled = !enabled;
  updateMotion();
  if (enabled) initialize();
});
reducedMotion.addEventListener('change', (event) => {
  enabled = !event.matches;
  updateMotion();
  if (enabled) initialize();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(frame); frame = 0; previousTime = 0; }
  else wake();
});
const visibilityObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (entry.target === hero) heroVisible = entry.isIntersecting;
    if (entry.target === stage) stageVisible = entry.isIntersecting;
  }
  wake();
});
visibilityObserver.observe(hero);
visibilityObserver.observe(stage);
if (finePointer) window.addEventListener('pointermove', event => {
  pointer.set(event.clientX / innerWidth * 2 - 1, 1 - event.clientY / innerHeight * 2);
}, { passive: true });

cards.forEach((card, index) => {
  card.addEventListener('toggle', () => { if (card.open) selectSpell(index); });
  card.querySelector('summary').addEventListener('click', () => selectSpell(index));
  if (!finePointer) return;
  card.addEventListener('pointermove', event => {
    if (!enabled) return;
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `perspective(900px) rotateX(${-y * 5}deg) rotateY(${x * 6}deg) translateY(-3px)`;
  });
  card.addEventListener('pointerleave', () => { card.style.transform = ''; });
});
castButton.addEventListener('click', () => {
  burst = 1;
  document.querySelector('#spell-announcement').textContent = `${spells[selected].name} : aperçu du sort lancé.`;
  wake();
});

const revealObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    revealObserver.unobserve(entry.target);
    if (!enabled || reducedMotion.matches) continue;
    entry.target.animate([{ opacity: 0.3, transform: 'translateY(24px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 850, easing: 'cubic-bezier(.2,.7,.2,1)', id: 'arcanum-reveal' });
  }
}, { threshold: 0.12 });
document.querySelectorAll('.intro>div,.section-heading,.adventure-copy,.character-panel,.roadmap article').forEach(el => revealObserver.observe(el));
selectSpell(0);
updateMotion();
if (enabled) initialize();
