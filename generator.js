'use strict';
const { createCanvas, loadImage } = require('canvas');
const { execSync, spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

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

// macOS: Apple SD Gothic Neo, Linux: Noto Sans CJK KR
const FONT = process.platform === 'darwin'
  ? '"Apple SD Gothic Neo"'
  : '"Noto Sans CJK KR", "Noto Sans KR", sans-serif';

const W = 1920, H = 1080, FPS = 30;

const FS = {'-3':18,'-2':22,'-1':28,'0':46,'1':28,'2':22,'3':18};
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

function buildLyricsCache(allLyrics) {
  const cache = new Map();
  for (const [, text] of allLyrics) {
    for (const [posStr, sz] of Object.entries(FS)) {
      const wgt  = posStr === '0' ? '400' : '300';
      const glow = posStr === '0';
      const key  = `${text}__${sz}__${wgt}__${glow}`;
      if (cache.has(key)) continue;
      const mC = createCanvas(10, 10);
      const mX = mC.getContext('2d');
      mX.font = `${wgt} ${sz}px ${FONT}`;
      const tw = Math.ceil(mX.measureText(text).width);
      const pad = glow ? 72 : 8;
      const ch  = sz * (glow ? 3.0 : 2.0) + pad * 2;
      const cw  = Math.max(tw + pad * 2, 1);
      const tc  = createCanvas(cw, ch);
      const tx  = tc.getContext('2d');
      tx.textBaseline = 'middle'; tx.textAlign = 'left';
      tx.font = `${wgt} ${sz}px ${FONT}`;
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

function drawLyrics(ctx, ts, audioSec, st, cache, allLyrics) {
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
    const cOp = FO[ck], cSz = FS[ck], cY = LY[off];
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
async function generateVideo({ songs, backgrounds = [], creator, outputPath, onProgress }) {
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

  const bgCanvases = await Promise.all(backgrounds.map(async bg => {
    const img = await loadImage(bg.imagePath);
    return buildBgImageLayer(img);
  }));

  const lyrCache = buildLyricsCache(allLyrics);

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
    if (bgIdx >= 0) ctx.drawImage(bgCanvases[bgIdx], 0, 0);
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

    drawLyrics(ctx, ts_ms, audSec, lyrState, lyrCache, allLyrics);
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
