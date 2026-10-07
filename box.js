// Caixa ZÍVIA em 3D: a tampa abre e a câmera mergulha conforme o scroll.
// Exporta mountBox(canvas) -> { setProgress(p), dispose() }, p de 0 a 1.
import * as THREE from 'three';

const W = 1.5, H = 0.56, D = 1.06;   // proporção da caixa real (tampa imantada)
const T = 0.035;                     // espessura do papelão

function foilTexture(logo, size = 1024) {
  // Tampa: preto fosco + logo oficial em hot stamping dourado (assets/logo-zivia-crop.png).
  const c = document.createElement('canvas');
  c.width = size; c.height = Math.round(size * D / W);
  const g = c.getContext('2d');
  g.fillStyle = '#0a0a0a'; g.fillRect(0, 0, c.width, c.height);
  const lw = c.width * .42, lh = lw * logo.height / logo.width;
  g.drawImage(logo, (c.width - lw) / 2, c.height * .5 - lh / 2, lw, lh);
  // tira a sombra cinza do PNG: o que não é dourado volta a ser papel preto
  const px = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < px.data.length; i += 4) {
    if (px.data[i] <= 90) px.data[i] = px.data[i + 1] = px.data[i + 2] = 10;
  }
  g.putImageData(px, 0, 0);
  // máscara de metal: dourado = metálico/brilhante
  const m = document.createElement('canvas');
  m.width = c.width; m.height = c.height;
  const mg = m.getContext('2d');
  mg.drawImage(c, 0, 0);
  const img = mg.getImageData(0, 0, m.width, m.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = img.data[i] > 90 ? 255 : 0;  // só o dourado, sem a sombra do PNG
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
  }
  mg.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const metal = new THREE.CanvasTexture(m);
  // rugosidade: invertida (dourado liso, papel fosco)
  const r = document.createElement('canvas'); r.width = m.width; r.height = m.height;
  const rg = r.getContext('2d'); rg.filter = 'invert(1)'; rg.drawImage(m, 0, 0);
  const rough = new THREE.CanvasTexture(r);
  [map, metal, rough].forEach(t => { t.anisotropy = 8; });
  return { map, metal, rough };
}

function linerTexture() {
  // Forro interno em veludo vinho.
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1c060a'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(255,190,170,${Math.random() * .035})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 1, Math.random() * 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function mountBox(canvas, { logo }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, .05, 50);

  const black = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: .62, metalness: .05 });
  const liner = new THREE.MeshStandardMaterial({ map: linerTexture(), roughness: .9, side: THREE.DoubleSide });
  const foil = foilTexture(logo);
  const lidTop = new THREE.MeshStandardMaterial({
    map: foil.map, metalnessMap: foil.metal, metalness: .7, roughnessMap: foil.rough, roughness: .55,
    // sem mapa de ambiente o metal fica preto: o brilho do hot stamping vem da emissão
    emissive: 0x8a6220, emissiveMap: foil.metal, emissiveIntensity: .9,
  });

  const box = new THREE.Group();
  scene.add(box);

  // Corpo aberto: fundo + 4 paredes, preto por fora e linho por dentro.
  const wall = (w, h, d, x, y, z) => {
    const outer = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), black);
    outer.position.set(x, y, z); outer.castShadow = outer.receiveShadow = true;
    box.add(outer);
  };
  wall(W, T, D, 0, T / 2, 0);
  wall(W, H, T, 0, H / 2, D / 2 - T / 2);
  wall(W, H, T, 0, H / 2, -D / 2 + T / 2);
  wall(T, H, D, W / 2 - T / 2, H / 2, 0);
  wall(T, H, D, -W / 2 + T / 2, H / 2, 0);
  // forro interno
  const inner = new THREE.Mesh(new THREE.BoxGeometry(W - T * 2.6, H - T * 1.2, D - T * 2.6), liner);
  inner.geometry.scale(1, 1, 1);
  inner.material = [liner, liner, null, liner, liner, liner].map(m => m || new THREE.MeshBasicMaterial({ visible: false }));
  inner.material.forEach(m => { m.side = THREE.BackSide; });
  inner.position.y = T + (H - T) / 2;
  box.add(inner);

  // Dez envelopes pretos lacrados em dourado: as dez cartas.
  const env = new THREE.MeshStandardMaterial({ color: 0x121212, roughness: .55 });
  const seal = new THREE.MeshStandardMaterial({ color: 0xbf923f, metalness: .4, roughness: .35, emissive: 0x6b4a14, emissiveIntensity: .8 });
  const envs = [];
  for (let i = 0; i < 10; i++) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(W * .62, .006, H * .78), env);
    e.rotation.x = -Math.PI / 2 + .32;
    e.position.set(0, T + H * .36, -D / 2 + .2 + i * (D * .062));
    const s = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .004, 24), seal);
    s.position.set(0, .006, -H * .22);
    e.add(s);
    box.add(e); envs.push(e);
  }

  // Tampa: pivô na borda traseira.
  const hinge = new THREE.Group();
  hinge.position.set(0, H, -D / 2 - .01);
  box.add(hinge);
  const lid = new THREE.Group();
  lid.position.z = (D + .02) / 2;
  hinge.add(lid);
  const top = new THREE.Mesh(new THREE.BoxGeometry(W + .02, T, D + .02),
    [black, black, lidTop, black, black, black]);
  top.position.y = T / 2; top.castShadow = true;
  lid.add(top);
  const skirt = (w, d, x, z) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w, .2, d), black);
    s.position.set(x, -.1 + T, z); lid.add(s);
  };
  skirt(W + .02, T, 0, (D + .02) / 2 - T / 2);
  skirt(T, D + .02, (W + .02) / 2 - T / 2, 0);
  skirt(T, D + .02, -(W + .02) / 2 + T / 2, 0);
  // fita de puxar
  const tab = new THREE.Mesh(new THREE.BoxGeometry(.05, .09, .006), black);
  tab.position.set(0, -.03, (D + .02) / 2 + .004); lid.add(tab);

  // Chão
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30),
    new THREE.ShadowMaterial({ opacity: .55 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  scene.add(floor);

  // Luz de vela: quente, baixa, com tremulação.
  scene.add(new THREE.HemisphereLight(0x4a3423, 0x0a0705, .5));
  const key = new THREE.SpotLight(0xffc98a, 38, 12, .55, .6, 1.6);
  key.position.set(2.2, 3.4, 2.4); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);
  const rim = new THREE.PointLight(0xff9f5a, 6, 6);
  rim.position.set(-2.4, 1.2, -1.6); scene.add(rim);
  const glow = new THREE.PointLight(0xffd59a, 0, 2.2, 1.4); // luz que escapa de dentro
  glow.position.set(0, H * .6, 0); box.add(glow);

  // Caminho da câmera: três quadros-chave.
  const path = [
    { p: new THREE.Vector3(2.6, 1.9, 3.4), t: new THREE.Vector3(0, .28, 0) },   // caixa fechada
    { p: new THREE.Vector3(.9, 2.4, 1.7), t: new THREE.Vector3(0, .25, -.05) }, // tampa abrindo
    { p: new THREE.Vector3(0, 1.75, 1.05), t: new THREE.Vector3(0, .3, -.05) },  // dentro, olhando os envelopes
  ];
  const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const tmpP = new THREE.Vector3(), tmpT = new THREE.Vector3();

  let progress = 0, raf = 0, t0 = performance.now(), visible = true;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible) return;
    const p = progress;
    const lidP = THREE.MathUtils.smoothstep(p, .12, .55);
    hinge.rotation.x = -lidP * 1.95;
    glow.intensity = lidP * 4 + THREE.MathUtils.smoothstep(p, .6, 1) * 10;
    // o primeiro envelope sobe da caixa em direção a quem está olhando
    const rise = THREE.MathUtils.smoothstep(p, .6, .95);
    const first = envs[9];
    first.position.y = T + H * .36 + rise * .8;
    first.position.z = -D / 2 + .2 + 9 * (D * .062) + rise * .28;
    first.rotation.x = (-Math.PI / 2 + .32) * (1 - rise);
    // câmera
    const seg = p < .5 ? 0 : 1;
    const local = ease(seg === 0 ? p / .5 : (p - .5) / .5);
    tmpP.lerpVectors(path[seg].p, path[seg + 1].p, local);
    tmpT.lerpVectors(path[seg].t, path[seg + 1].t, local);
    // respiração ambiente da caixa fechada
    const breathe = (1 - lidP) * Math.sin(now / 1800) * .03;
    camera.position.copy(tmpP).add(new THREE.Vector3(breathe, breathe * .5, 0));
    // telas largas: a caixa fica à direita enquanto o título ocupa a esquerda
    if (camera.aspect > 1.2) tmpT.x -= .8 * (1 - THREE.MathUtils.smoothstep(p, .05, .4));
    // telas em pé: afasta a câmera e sobe a caixa para a metade de cima, acima do título
    if (camera.aspect < .8) {
      const k = 1 - THREE.MathUtils.smoothstep(p, .05, .45);
      camera.position.sub(tmpT).multiplyScalar(1 + .55 * k).add(tmpT);
      tmpT.y -= 1.05 * k;
    }
    camera.lookAt(tmpT);
    // vela tremula
    const f = (now - t0) / 1000;
    key.intensity = 38 + Math.sin(f * 7.3) * 1.6 + Math.sin(f * 13.1) * 1.1;
    rim.intensity = 6 + Math.sin(f * 5.1 + 1) * .8;
    renderer.render(scene, camera);
  }

  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // em telas estreitas, recua a câmera para a caixa caber inteira
    camera.fov = w < h ? 46 : 32;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
  io.observe(canvas);
  raf = requestAnimationFrame(frame);

  return {
    setProgress(p) { progress = Math.min(1, Math.max(0, p)); },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); renderer.dispose(); },
  };
}
