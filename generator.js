'use strict';
const { createCanvas, loadImage, registerFont } = require('canvas');
const { execSync, spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Register custom fonts from font/ directory next to generator.js
const FONT_DIR = path.join(__dirname, 'font');
if (fs.existsSync(FONT_DIR)) {
  const reg = (file, family, weight = 'normal') => {
    const p = path.join(FONT_DIR, file);
    if (fs.existsSync(p)) registerFont(p, { family, weight });
  };
  reg('DoHyeon-Regular.ttf',        'DoHyeon');
  reg('NanumBrushScript-Regular.ttf','NanumBrush');
  reg('NanumPenScript-Regular.ttf',  'NanumPen');
  reg('CuteFont-Regular.ttf',        'CuteFont');
  reg('Paperlogy-1Thin.ttf',         'Paperlogy', '100');
  reg('Paperlogy-2ExtraLight.ttf',   'Paperlogy', '200');
  reg('Paperlogy-3Light.ttf',        'Paperlogy', '300');
  reg('Paperlogy-4Regular.ttf',      'Paperlogy', '400');
  reg('Paperlogy-5Medium.ttf',       'Paperlogy', '500');
  reg('Paperlogy-6SemiBold.ttf',     'Paperlogy', '600');
  reg('Paperlogy-7Bold.ttf',         'Paperlogy', '700');
  reg('Freesentation-1Thin.ttf',     'Freesentation', '100');
  reg('Freesentation-2ExtraLight.ttf','Freesentation', '200');
  reg('Freesentation-3Light.ttf',    'Freesentation', '300');
  reg('Freesentation-4Regular.ttf',  'Freesentation', '400');
  reg('Freesentation-5Medium.ttf',   'Freesentation', '500');
  reg('Freesentation-6SemiBold.ttf', 'Freesentation', '600');
  reg('Freesentation-7Bold.ttf',     'Freesentation', '700');
}

function findFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    const p = execSync('which ffmpeg 2>/dev/null').toString().trim();
    if (p) return p;
  } catch {}
  try {
    return execSync(
      'python3 -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"'
    ).toString().trim();
  } catch {}
  throw new Error('FFmpeg을 찾을 수 없습니다. ffmpeg를 설치하거나 FFMPEG_PATH 환경변수를 설정하세요.');
}
const FFMPEG = findFfmpeg();

// UI/metadata small text
const FONT = process.platform === 'darwin'
  ? '"Apple SD Gothic Neo"'
  : '"Noto Sans CJK KR", "Noto Sans KR", sans-serif';

// 기본 가사 폰트 — 나눔손글씨 붓
const LYRIC_FONT = fs.existsSync(path.join(__dirname, 'font', 'NanumBrushScript-Regular.ttf'))
  ? '"NanumBrush"' : FONT;

// 기본 타이틀카드 폰트 — 도현체
const TITLE_FONT = fs.existsSync(path.join(__dirname, 'font', 'DoHyeon-Regular.ttf'))
  ? '"DoHyeon"' : FONT;

// 손글씨 폰트는 2pt 크게 렌더링
const HANDWRITING_FONTS = ['NanumBrush', 'NanumPen'];
function isHandwriting(fontFamily) {
  return HANDWRITING_FONTS.some(f => fontFamily.includes(f));
}

// 선택 가능한 폰트 목록 (웹앱·외부에서 참조용)
const FONT_OPTIONS = {
  lyric: [
    { id: 'NanumBrush',   label: '나눔손글씨 붓',       file: 'NanumBrushScript-Regular.ttf' },
    { id: 'NanumPen',     label: '나눔손글씨 펜',       file: 'NanumPenScript-Regular.ttf' },
    { id: 'DoHyeon',      label: '도현체',              file: 'DoHyeon-Regular.ttf' },
    { id: 'Paperlogy',    label: 'Paperlogy Light',    file: 'Paperlogy-3Light.ttf' },
    { id: 'Freesentation',label: 'Freesentation Light',file: 'Freesentation-3Light.ttf' },
    { id: 'AppleSD',      label: '기본 고딕',           file: null },
  ],
  title: [
    { id: 'DoHyeon',      label: '도현체',              file: 'DoHyeon-Regular.ttf' },
    { id: 'NanumBrush',   label: '나눔손글씨 붓',       file: 'NanumBrushScript-Regular.ttf' },
    { id: 'NanumPen',     label: '나눔손글씨 펜',       file: 'NanumPenScript-Regular.ttf' },
    { id: 'Paperlogy',    label: 'Paperlogy',          file: 'Paperlogy-4Regular.ttf' },
    { id: 'Freesentation',label: 'Freesentation',      file: 'Freesentation-4Regular.ttf' },
    { id: 'AppleSD',      label: '기본 고딕',           file: null },
  ],
};

function resolveFontFamily(id) {
  if (!id || id === 'AppleSD') return FONT;
  return `"${id}"`;
}

const W = parseInt(process.env.VIDEO_WIDTH || (process.env.RAILWAY_ENVIRONMENT ? '1280' : '1920'), 10);
const H = parseInt(process.env.VIDEO_HEIGHT || (process.env.RAILWAY_ENVIRONMENT ? '720' : '1080'), 10);
const FPS = parseInt(process.env.VIDEO_FPS || (process.env.RAILWAY_ENVIRONMENT ? '24' : '30'), 10);

const FS = {'-3':19,'-2':23,'-1':29,'0':47,'1':29,'2':23,'3':19};
const FO = {'-3':0.04,'-2':0.12,'-1':0.26,'0':1.0,'1':0.26,'2':0.12,'3':0.04};
const SH = {'-3':28,'-2':36,'-1':48,'0':76,'1':48,'2':36,'3':28};

const LY = (() => {
  const ly = {};
  let y = H / 2 - 150;
  for (const p of [-3,-2,-1,0,1,2,3]) { ly[p] = y + SH[String(p)] / 2; y += SH[String(p)]; }
  return ly;
})();

const TDUR = 550;

// ── 파서 ──────────────────────────────────────────────────────────────────
const SECTION_RE = /^\s*\[[^\]]*\]\s*$/;

function parseLRC(content) {
  const lyrics = [];
  let title = '';
  for (const line of content.split('\n')) {
    const m = line.match(/^\[(\d{1,2}):(\d{2})\.(\d{2,3})\](.*)/);
    if (!m) continue;
    const t = parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(m[3]) / (m[3].length === 2 ? 100 : 1000);
    const text = m[4].trim();
    const titleM = text.match(/^\[Title:\s*(.+)\]$/i);
    if (titleM) { title = titleM[1]; continue; }
    if (SECTION_RE.test(text) || !text) continue;
    lyrics.push([t, text]);
  }
  return { title, lyrics };
}

function parseSRT(content) {
  const lyrics = [];
  let title = '';
  for (const block of content.trim().split(/\n\n+/)) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;
    const tm = lines[1].match(/^(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    if (!tm) continue;
    const t = parseInt(tm[1]) * 3600 + parseInt(tm[2]) * 60 + parseInt(tm[3]) + parseInt(tm[4]) / 1000;
    const text = lines.slice(2).join(' ').trim();
    const titleM = text.match(/^\[Title:\s*(.+)\]$/i);
    if (titleM) { title = titleM[1]; continue; }
    if (SECTION_RE.test(text) || !text) continue;
    lyrics.push([t, text]);
  }
  return { title, lyrics };
}

function getAudioDuration(audioPath) {
  const r = spawnSync(FFMPEG, ['-i', audioPath, '-f', 'null', '-'], { encoding: 'buffer' });
  const text = (r.stderr || Buffer.alloc(0)).toString();
  const m = text.match(/Duration:\s*(\d+):(\d{2}):(\d{2}\.?\d*)/);
  if (m) return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);
  return null;
}

async function mergeAudioFiles(audioPaths, outputPath) {
  if (audioPaths.length === 1) {
    fs.copyFileSync(audioPaths[0], outputPath);
    return;
  }
  const args = ['-y'];
  audioPaths.forEach(p => args.push('-i', p));
  const filter = audioPaths.map((_, i) => `[${i}:a]`).join('') +
    `concat=n=${audioPaths.length}:v=0:a=1[outa]`;
  args.push('-filter_complex', filter, '-map', '[outa]', '-c:a', 'aac', '-b:a', '192k', outputPath);
  await new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG, args, { stdio: 'pipe' });
    proc.stderr.on('data', () => {});
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`Audio merge failed (code ${code})`)));
  });
}

// ── 렌더링 헬퍼 ───────────────────────────────────────────────────────────
function eio(t) { return t < 0.5 ? 2*t*t : -1 + (4-2*t)*t; }
function lerp(a, b, t) { return a + (b-a)*t; }

function getIdx(L, t) {
  let i = -1;
  for (let j = 0; j < L.length; j++) { if (t >= L[j][0]) i = j; else break; }
  return i;
}

function buildGradientCanvas() {
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  const g1 = ctx.createLinearGradient(0, 0, W, H);
  g1.addColorStop(0,    '#0c0a16');
  g1.addColorStop(0.38, '#100d1b');
  g1.addColorStop(0.62, '#18120a');
  g1.addColorStop(1,    '#0e0b16');
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
  // Vignette
  const gv = ctx.createRadialGradient(W/2, H/2, H*0.22, W/2, H/2, H*0.86);
  gv.addColorStop(0, 'transparent'); gv.addColorStop(1, 'rgba(0,0,0,0.56)');
  ctx.fillStyle = gv; ctx.fillRect(0, 0, W, H);
  // Top shadow
  const gt = ctx.createLinearGradient(0, 0, 0, H*0.20);
  gt.addColorStop(0, 'rgba(0,0,0,0.30)'); gt.addColorStop(1, 'transparent');
  ctx.fillStyle = gt; ctx.fillRect(0, 0, W, H);
  return c;
}

function buildSongLayer(title, creator) {
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  // Metadata only (top-right)
  ctx.save();
  ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.font = `300 15px ${FONT}`; ctx.fillStyle = 'rgba(201,169,110,0.50)';
  ctx.fillText(title || '', W - 68, 95);
  if (creator) {
    ctx.font = `300 13px ${FONT}`; ctx.fillStyle = 'rgba(201,169,110,0.22)';
    ctx.fillText(creator, W - 68, 120);
  }
  ctx.restore();
  return c;
}

function buildBgImageLayer(img) {
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  const scale = Math.max(W / img.width, H / img.height);
  const sw = img.width * scale, sh = img.height * scale;
  const sx = (W - sw) / 2, sy = (H - sh) / 2;
  // Draw at low opacity with dark overlay
  ctx.globalAlpha = 0.65;
  ctx.drawImage(img, sx, sy, sw, sh);
  ctx.globalAlpha = 1;
  // Extra vignette to keep lyrics readable
  const gv = ctx.createRadialGradient(W/2, H/2, H*0.1, W/2, H/2, H*0.9);
  gv.addColorStop(0, 'transparent'); gv.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = gv; ctx.fillRect(0, 0, W, H);
  return c;
}

function buildLyricsCache(allLyrics, fontFamily) {
  const bump = isHandwriting(fontFamily) ? 2 : 0;
  const cache = new Map();
  for (const [, text] of allLyrics) {
    for (const [posStr, sz] of Object.entries(FS)) {
      const rsz  = sz + bump;
      const wgt  = posStr === '0' ? '400' : '300';
      const glow = posStr === '0';
      const key  = `${text}__${rsz}__${wgt}__${glow}`;
      if (cache.has(key)) continue;
      const mC = createCanvas(10, 10);
      const mX = mC.getContext('2d');
      mX.font = `${wgt} ${rsz}px ${fontFamily}`;
      const tw = Math.ceil(mX.measureText(text).width);
      const pad = glow ? 72 : 8;
      const ch  = rsz * (glow ? 3.0 : 2.0) + pad * 2;
      const cw  = Math.max(tw + pad * 2, 1);
      const tc  = createCanvas(cw, ch);
      const tx  = tc.getContext('2d');
      tx.textBaseline = 'middle'; tx.textAlign = 'left';
      tx.font = `${wgt} ${rsz}px ${fontFamily}`;
      if (glow) {
        tx.shadowColor = 'rgba(201,169,110,0.45)'; tx.shadowBlur = 28;
        tx.fillStyle = '#f5e8d0'; tx.fillText(text, pad, ch/2);
        tx.shadowColor = 'rgba(201,169,110,0.18)'; tx.shadowBlur = 60;
        tx.fillText(text, pad, ch/2); tx.shadowBlur = 0;
      }
      tx.fillStyle = '#f5e8d0'; tx.fillText(text, pad, ch/2);
      cache.set(key, { canvas: tc, padX: pad, padY: ch/2 });
    }
  }
  return cache;
}

function drawTitleCard(ctx, audSec, tc, titleFont) {
  if (!tc) return;
  const title = String(tc.title || '').trim();
  if (!title) return;
  const subtitle = String(tc.subtitle || '').trim();
  const fadeInEnd = tc.fadeInEnd !== undefined ? Number(tc.fadeInEnd) : 2.5;
  const fadeOutStart = tc.fadeOutStart !== undefined ? Number(tc.fadeOutStart) : 9;
  const fadeOutEnd = tc.fadeOutEnd !== undefined ? Number(tc.fadeOutEnd) : 12;
  const tFont = titleFont || TITLE_FONT;
  const bump  = isHandwriting(tFont) ? 2 : 0;
  let alpha;
  if (audSec >= fadeOutEnd) return;
  if (audSec <= fadeInEnd) {
    alpha = eio(Math.min(1, audSec / fadeInEnd));
  } else if (audSec >= fadeOutStart) {
    alpha = eio(1 - (audSec - fadeOutStart) / (fadeOutEnd - fadeOutStart));
  } else {
    alpha = 1;
  }
  if (alpha <= 0.01) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Title — font 크기 손글씨 +2pt
  ctx.font = `normal ${104 + bump}px ${tFont}`;
  ctx.shadowColor = 'rgba(255, 210, 140, 0.55)';
  ctx.shadowBlur = 48;
  ctx.fillStyle = '#fdf0da';
  ctx.fillText(title, W / 2, H / 2 - 28);
  ctx.shadowColor = 'rgba(220, 170, 80, 0.28)';
  ctx.shadowBlur = 90;
  ctx.fillText(title, W / 2, H / 2 - 28);
  ctx.shadowBlur = 0;

  // Decorative divider
  const lw = 180;
  const ly = H / 2 + 30;
  const grad = ctx.createLinearGradient(W / 2 - lw, ly, W / 2 + lw, ly);
  grad.addColorStop(0,   'rgba(201,169,110,0)');
  grad.addColorStop(0.5, 'rgba(201,169,110,0.7)');
  grad.addColorStop(1,   'rgba(201,169,110,0)');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(W / 2 - lw, ly);
  ctx.lineTo(W / 2 + lw, ly);
  ctx.stroke();
  // Center diamond
  ctx.fillStyle = 'rgba(201,169,110,0.7)';
  ctx.save();
  ctx.translate(W / 2, ly);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-3, -3, 6, 6);
  ctx.restore();

  // Subtitle / creator
  if (subtitle) {
    ctx.font = `200 17px ${FONT}`;
    ctx.fillStyle = 'rgba(201,169,110,0.65)';
    ctx.fillText(subtitle, W / 2, H / 2 + 62);
  }

  ctx.restore();
}

function drawLyrics(ctx, ts, audioSec, st, cache, allLyrics, fontFamily) {
  const bump = isHandwriting(fontFamily) ? 2 : 0;
  const ni = getIdx(allLyrics, audioSec);
  if (ni !== st.curIdx) { st.prevIdx = st.curIdx; st.curIdx = ni; st.transEndTs = ts + TDUR; }
  if (st.curIdx < 0) return;
  const ai = st.curIdx, pi = st.prevIdx;
  const raw = st.transEndTs > ts ? 1-(st.transEndTs-ts)/TDUR : 1.0;
  const pr  = eio(Math.max(0, Math.min(1, raw)));
  const inT = pr < 1.0 && pi >= 0;
  for (let off = -3; off <= 3; off++) {
    const li = ai + off;
    if (li < 0 || li >= allLyrics.length) continue;
    const ck = String(off);
    const cOp = FO[ck], cSz = FS[ck] + bump, cY = LY[off];
    let op, y;
    if (inT) {
      const delta = ai - pi, po = off + delta;
      const pk  = String(Math.max(-3, Math.min(3, po)));
      const pOp = (po >= -3 && po <= 3) ? FO[pk] : 0;
      const pY  = (po >= -3 && po <= 3) ? LY[po] : (po < -3 ? LY[-3]-42 : LY[3]+42);
      op = lerp(pOp, cOp, pr); y = lerp(pY, cY, pr);
    } else { op = cOp; y = cY; }
    if (op < 0.008) continue;
    const wgt = off === 0 ? '400' : '300';
    const glow = off === 0;
    const key = `${allLyrics[li][1]}__${cSz}__${wgt}__${glow}`;
    const entry = cache.get(key);
    if (!entry) continue;
    ctx.save(); ctx.globalAlpha = op;
    ctx.drawImage(entry.canvas, Math.round(W/2 - entry.canvas.width/2), Math.round(y - entry.padY));
    ctx.restore();
  }
}

// ── 메인 익스포트 ─────────────────────────────────────────────────────────
/**
 * songs: [{ albumPath, audioPath, title, lyrics, duration, startSec }]
 * backgrounds: [{ imagePath, startSec }]  (optional)
 * creator: string
 * outputPath: string
 * onProgress: (pct, fps, remainSec) => void
 */
async function generateVideo(options) {
  const { songs, backgrounds = [], creator, outputPath, onProgress,
          lyricFont: lyricFontId, titleFont: titleFontId } = options;

  const activeLyricFont = resolveFontFamily(lyricFontId) || LYRIC_FONT;
  const activeTitleFont = resolveFontFamily(titleFontId) || TITLE_FONT;
  // Probe durations and calculate cumulative offsets
  let cumTime = 0;
  for (const s of songs) {
    s.duration = getAudioDuration(s.audioPath) || (s.lyrics[s.lyrics.length - 1]?.[0] + 8) || 60;
    s.startSec = cumTime;
    cumTime += s.duration;
  }
  const totalDuration = cumTime;
  const TOTAL_F = Math.ceil(totalDuration * FPS);

  // Merge audio
  const mergedAudio = path.join(os.tmpdir(), `lv_audio_${Date.now()}.m4a`);
  await mergeAudioFiles(songs.map(s => s.audioPath), mergedAudio);

  // Offset lyrics to global timeline
  const allLyrics = songs.flatMap(s =>
    s.lyrics.map(([t, text]) => [t + s.startSec, text])
  );

  // Pre-render canvases
  const gradCanvas = buildGradientCanvas();

  const songCanvases = songs.map(s => buildSongLayer(s.title || '', creator || ''));

  const bgCanvasCache = new Map();
  async function getBgCanvas(idx) {
    if (idx < 0 || idx >= backgrounds.length) return null;
    if (bgCanvasCache.has(idx)) return bgCanvasCache.get(idx);
    const img = await loadImage(backgrounds[idx].imagePath);
    const canvas = buildBgImageLayer(img);
    bgCanvasCache.clear(); // keep only current background to cap memory
    bgCanvasCache.set(idx, canvas);
    return canvas;
  }

  const lyrCache = buildLyricsCache(allLyrics, activeLyricFont);

  const DUST = Array.from({length: 55}, () => ({
    x: Math.random() * W, y: Math.random() * H,
    r: Math.random() * 1.3 + 0.3,
    vx: (Math.random() - 0.5) * 0.10,
    vy: -(Math.random() * 0.14 + 0.04),
    a: Math.random() * 0.28 + 0.05,
  }));

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  const ff = spawn(FFMPEG, [
    '-y',
    '-f', 'rawvideo', '-vcodec', 'rawvideo',
    '-s', `${W}x${H}`, '-pix_fmt', 'bgra',
    '-r', String(FPS), '-i', 'pipe:0',
    '-i', mergedAudio,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k',
    '-shortest', outputPath,
  ], { stdio: ['pipe', 'pipe', 'pipe'] });
  ff.stderr.on('data', () => {});
  ff.stdout.on('data', () => {});

  let ffErr = null;
  ff.on('error', e => { ffErr = e; });

  const lyrState = { curIdx: -1, prevIdx: -1, transEndTs: 0 };
  const t0 = Date.now();

  async function writeFrame(buf) {
    if (ffErr) throw ffErr;
    const ok = ff.stdin.write(buf);
    if (!ok) await new Promise(r => ff.stdin.once('drain', r));
  }

  function getCurrentSongIdx(audSec) {
    let idx = 0;
    for (let i = 0; i < songs.length; i++) {
      if (audSec >= songs[i].startSec) idx = i;
    }
    return idx;
  }

  function getCurrentBgIdx(audSec) {
    let idx = -1;
    for (let i = 0; i < backgrounds.length; i++) {
      if (audSec >= backgrounds[i].startSec) idx = i;
    }
    return idx;
  }

  for (let fi = 0; fi < TOTAL_F; fi++) {
    const ts_ms  = fi / FPS * 1000;
    const audSec = fi / FPS;

    const songIdx = getCurrentSongIdx(audSec);
    const bgIdx   = getCurrentBgIdx(audSec);

    ctx.drawImage(gradCanvas, 0, 0);
    if (bgIdx >= 0) {
      const bgCanvas = await getBgCanvas(bgIdx);
      if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0);
    }
    ctx.drawImage(songCanvases[songIdx], 0, 0);

    ctx.save();
    DUST.forEach(p => {
      ctx.globalAlpha = p.a; ctx.fillStyle = 'rgb(215,188,132)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
      p.x += p.vx * 2; p.y += p.vy * 2;
      if (p.y < -4) { p.y = H + 4; p.x = Math.random() * W; }
      if (p.x < -4) p.x = W + 4; if (p.x > W + 4) p.x = -4;
    });
    ctx.restore();

    drawLyrics(ctx, ts_ms, audSec, lyrState, lyrCache, allLyrics, activeLyricFont);
    if (options.titleCard) drawTitleCard(ctx, audSec, options.titleCard, activeTitleFont);
    await writeFrame(canvas.toBuffer('raw'));

    if (fi % 90 === 89 || fi === TOTAL_F - 1) {
      const elapsed = (Date.now() - t0) / 1000;
      const pct = (fi + 1) / TOTAL_F * 100;
      const spd = (fi + 1) / elapsed;
      const remain = Math.max(0, (TOTAL_F - fi - 1) / spd);
      if (onProgress) onProgress(pct, spd, remain);
      await new Promise(r => setImmediate(r));
    }
  }

  ff.stdin.end();
  const code = await new Promise(r => ff.on('close', r));
  fs.unlink(mergedAudio, () => {});
  if (code !== 0) throw new Error(`FFmpeg exited with code ${code}`);
}

module.exports = { generateVideo, parseLRC, parseSRT };
