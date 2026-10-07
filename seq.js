// Hero: sequência de quadros (vídeos do space Magnific) controlada pelo scroll.
// mountSequence(canvas, { desk, mob, frames }) -> { setProgress(p) }, p de 0 a 1.
// desk: quadros 16:9 (seq/d); mob: quadros 1:1 recortados no centro (seq/m).

export function mountSequence(canvas, { desk, mob, frames, onLoad }) {
  const ctx = canvas.getContext('2d');
  const portrait = () => innerWidth / innerHeight < .8;
  let dir = portrait() ? mob : desk;
  let imgs = [];
  let p = 0, drawn = -1, loaded = 0;

  function load() {
    imgs = new Array(frames); loaded = 0;
    const src = i => `${dir}/${String(i + 1).padStart(3, '0')}.jpg`;
    // Primeiro quadro na frente, depois um a cada 8 (para o scroll rápido já ter algo), depois o resto.
    const order = [0];
    for (let i = 8; i < frames; i += 8) order.push(i);
    for (let i = 1; i < frames; i++) if (i % 8) order.push(i);
    order.forEach(i => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => { loaded++; onLoad?.(loaded / frames); if (Math.abs(i - target()) < 10) draw(true); };
      im.src = src(i);
      imgs[i] = im;
    });
  }

  const target = () => Math.round(p * (frames - 1));

  function nearest(i) {
    for (let d = 0; d < frames; d++) {
      const a = imgs[i - d], b = imgs[i + d];
      if (a?.complete && a.naturalWidth) return a;
      if (b?.complete && b.naturalWidth) return b;
    }
    return null;
  }

  function resize() {
    const dpr = Math.min(devicePixelRatio, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    const nowDir = portrait() ? mob : desk;
    if (nowDir !== dir) { dir = nowDir; load(); }
    draw(true);
  }

  function draw(force) {
    const i = target();
    if (!force && i === drawn) return;
    const im = nearest(i);
    if (!im) return;
    drawn = i;
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#121112'; ctx.fillRect(0, 0, W, H);
    let s, x, y;
    if (dir === mob) {
      // Celular: quadro quadrado ocupando a largura, na parte de cima (texto fica embaixo).
      s = W / im.width;
      x = 0;
      y = H * .04 + 0 * s;
    } else {
      // Desktop: cobre a tela, com a caixa deslocada à direita para os textos ficarem livres à esquerda.
      s = Math.max(W / im.width, H / im.height);
      const shift = W * (.2 - .06 * smooth(p, .3, .8));
      x = (W - im.width * s) / 2 + shift;
      y = (H - im.height * s) / 2;
    }
    ctx.drawImage(im, x, y, im.width * s, im.height * s);
    if (dir === mob) {
      // funde a borda de baixo do quadro no fundo
      const g = ctx.createLinearGradient(0, y + im.height * s * .7, 0, y + im.height * s);
      g.addColorStop(0, 'rgba(18,17,18,0)'); g.addColorStop(1, 'rgba(18,17,18,1)');
      ctx.fillStyle = g; ctx.fillRect(0, y + im.height * s * .7, W, im.height * s * .3 + 2);
    }
  }

  const smooth = (v, a, b) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

  load();
  new ResizeObserver(resize).observe(canvas);
  return {
    setProgress(v) { p = v; draw(dir === desk); },
  };
}
