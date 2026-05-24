'use strict';
/**
 * 오래된 사진첩 — 그때는 몰랐던 사랑
 * 리릭스 비디오 MP4 생성기
 * 실행: node generate.js
 */

const { createCanvas, loadImage } = require('canvas');
const { execSync, spawn } = require('child_process');
const path = require('path');

const DIR = __dirname;

// ffmpeg 바이너리 경로 (imageio-ffmpeg 이용)
const FFMPEG = execSync(
  'python3 -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"'
).toString().trim();

// ── 가사 데이터 ─────────────────────────────────────────────────────────
const L = [
  [1.59,   "낡은 서랍 깊은 곳에서"],
  [2.95,   "낡은 서랍 깊은 곳에서"],
  [8.37,   "먼지 쌓인 기억을 꺼냈죠"],
  [15.16,  "조심스레 펼친 사진첩엔"],
  [21.94,  "잊고 살던 시간이 잠들어"],
  [28.88,  "빛바랜 사진 한 장 속에"],
  [35.42,  "어린 내가 웃고 있었죠"],
  [39.57,  "작은 손을 꼭 잡아주던"],
  [48.51,  "그대의 젊은 얼굴도 보여요"],
  [55.69,  "그때 나는 알지 못했죠"],
  [58.88,  "그 웃음 뒤에 숨은 마음을"],
  [62.39,  "매일 나를 위해 접어두던"],
  [66.22,  "그대의 하루와 꿈들을"],
  [70.05,  "한 장 한 장 넘길 때마다"],
  [79.38,  "가슴 깊이 번지는 말"],
  [86.17,  "너무 늦게 알아버린"],
  [92.63,  "그 사랑이 눈물이 되어"],
  [99.25,  "그때는 몰랐던 사랑"],
  [102.20, "너무 가까워 보이지 않던 마음"],
  [110.02, "사진 속 그대는 아직도 젊은데"],
  [116.56, "나는 이제야 그 마음을 알아요"],
  [122.87, "그때는 몰랐던 사랑"],
  [126.62, "당연한 줄 알았던 따뜻한 손길"],
  [131.09, "세월이 지나고 나서야"],
  [140.18, "고맙다는 말이 내 안에 피어요"],
  [147.36, "낡은 마루, 저녁 밥 냄새"],
  [153.66, "문밖에서 부르던 목소리"],
  [157.89, "작은 방에 켜진 불빛 하나"],
  [167.23, "그게 나의 세상이었죠"],
  [174.25, "괜찮다며 웃어주시던"],
  [177.20, "그 말 뒤에 감춘 눈물들"],
  [181.19, "내가 잠든 밤에도 홀로"],
  [184.30, "내일을 걱정하던 마음"],
  [187.58, "한 장 한 장 넘길 때마다"],
  [191.09, "잊은 줄 알았던 계절"],
  [194.76, "돌아갈 수 없는 날들이"],
  [198.11, "따뜻하게 나를 안아요"],
  [204.01, "그때는 몰랐던 사랑"],
  [208.24, "너무 가까워 보이지 않던 마음"],
  [214.70, "사진 속 그대는 아직도 젊은데"],
  [218.85, "나는 이제야 그 마음을 알아요"],
  [227.71, "그때는 몰랐던 사랑"],
  [231.46, "당연한 줄 알았던 따뜻한 손길"],
  [238.40, "세월이 지나고 나서야"],
  [244.94, "고맙다는 말이 내 안에 피어요"],
  [249.09, "혹시 그날로 돌아간다면"],
  [255.39, "나는 꼭 말하고 싶어요"],
  [259.38, "당신의 작은 희생들이"],
  [264.89, "내 삶을 지켜준 빛이었다고"],
  [271.43, "말없이 내 곁을 지켜준 사람"],
  [278.77, "언제나 나보다 나를 믿던 사람"],
  [285.55, "늦었지만 이제야 불러봅니다"],
  [292.33, "고마워요, 사랑했어요"],
  [298.64, "그때는 몰랐던 사랑"],
  [302.47, "시간이 지나 더 선명해진 마음"],
  [309.41, "사진 속 그대는 아직도 웃는데"],
  [316.03, "나는 조용히 눈물을 닦아요"],
  [322.33, "그때는 몰랐던 사랑"],
  [325.77, "내 삶 곳곳에 남겨진 따뜻한 흔적"],
  [333.11, "한 장의 사진을 품에 안고"],
  [339.65, "이제야 그 사랑을 불러봅니다"],
  [346.83, "오래된 사진첩을 덮으면"],
  [350.26, "방 안에 조용히 남는 말"],
  [354.09, "그때는 몰랐던 사랑"],
  [360.87, "이제는 내가 기억할게요"],
];

// ── 상수 ──────────────────────────────────────────────────────────────
const W = 1920, H = 1080, FPS = 30;
const SONG_SEC   = 366.5;
const TOTAL_F    = Math.ceil(SONG_SEC * FPS);    // ≈ 10,995 프레임

const SEP_X  = W * 0.42;
const ALB_CX = SEP_X / 2;
const ALB_CY = H / 2;
const ALB_SZ = 380;
const LYR_X  = SEP_X + 72;

// 슬롯별 폰트 크기 / 불투명도 / 높이
const FS = {'-3':19,'-2':23,'-1':29,'0':47,'1':29,'2':23,'3':19};
const FO = {'-3':0.04,'-2':0.12,'-1':0.26,'0':1.0,'1':0.26,'2':0.12,'3':0.04};
const SH = {'-3':28,'-2':36,'-1':48,'0':76,'1':48,'2':36,'3':28};

// 슬롯별 Y 중심점 계산 (전체 300px, H * 0.75 기준)
const LY = {};
{ let y = H * 0.75 - 150;
  for (const p of [-3,-2,-1,0,1,2,3]) { LY[p] = y + SH[String(p)]/2; y += SH[String(p)]; }
}

const TDUR   = 550; // 가사 전환 duration (ms)
const FONT   = '"Apple SD Gothic Neo"';

// ── 유틸리티 ──────────────────────────────────────────────────────────
function getIdx(t) {
  let i = -1;
  for (let j = 0; j < L.length; j++) { if (t >= L[j][0]) i = j; else break; }
  return i;
}
function eio(t) { return t < 0.5 ? 2*t*t : -1 + (4-2*t)*t; }
function lerp(a, b, t) { return a + (b-a)*t; }
function fmt(s) { return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`; }

// ── 파티클 ──────────────────────────────────────────────────────────────
const DUST = Array.from({length: 55}, () => ({
  x: Math.random() * W, y: Math.random() * H,
  r: Math.random() * 1.3 + 0.3,
  vx: (Math.random() - 0.5) * 0.10,
  vy: -(Math.random() * 0.14 + 0.04),
  a: Math.random() * 0.28 + 0.05,
}));

// ── 정적 배경 렌더링 (한 번만 실행) ─────────────────────────────────────
function buildStaticBg(ctx, albumImg) {
  // 기본 그라디언트
  const g1 = ctx.createLinearGradient(0, 0, W, H);
  g1.addColorStop(0,    '#0c0a16');
  g1.addColorStop(0.38, '#100d1b');
  g1.addColorStop(0.62, '#18120a');
  g1.addColorStop(1,    '#0e0b16');
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);

  // 앨범 영역 따뜻한 앰버 글로우
  const ga = ctx.createRadialGradient(ALB_CX, ALB_CY, 0, ALB_CX, ALB_CY, W*0.36);
  ga.addColorStop(0, 'rgba(168,118,52,0.12)');
  ga.addColorStop(0.5,'rgba(130,85,35,0.04)');
  ga.addColorStop(1, 'transparent');
  ctx.fillStyle = ga; ctx.fillRect(0, 0, W, H);

  // 비네팅
  const gv = ctx.createRadialGradient(W/2, H/2, H*0.22, W/2, H/2, H*0.86);
  gv.addColorStop(0, 'transparent'); gv.addColorStop(1, 'rgba(0,0,0,0.56)');
  ctx.fillStyle = gv; ctx.fillRect(0, 0, W, H);

  // 상단 그림자
  const gt = ctx.createLinearGradient(0, 0, 0, H*0.20);
  gt.addColorStop(0, 'rgba(0,0,0,0.30)'); gt.addColorStop(1, 'transparent');
  ctx.fillStyle = gt; ctx.fillRect(0, 0, W, H);

  // 앨범 헤일로
  const r1 = 290;
  const gh1 = ctx.createRadialGradient(ALB_CX, ALB_CY, 0, ALB_CX, ALB_CY, r1);
  gh1.addColorStop(0, 'rgba(175,125,60,0.08)'); gh1.addColorStop(1, 'transparent');
  ctx.fillStyle = gh1; ctx.fillRect(ALB_CX-r1, ALB_CY-r1, r1*2, r1*2);

  const r2 = 225;
  const gh2 = ctx.createRadialGradient(ALB_CX, ALB_CY, 0, ALB_CX, ALB_CY, r2);
  gh2.addColorStop(0, 'rgba(178,128,58,0.18)');
  gh2.addColorStop(0.5,'rgba(150,100,45,0.06)');
  gh2.addColorStop(1, 'transparent');
  ctx.fillStyle = gh2; ctx.fillRect(ALB_CX-r2, ALB_CY-r2, r2*2, r2*2);

  // 앨범 커버 (세피아 효과 수동 적용)
  const ax = ALB_CX - ALB_SZ/2, ay = ALB_CY - ALB_SZ/2;
  const tmpC = createCanvas(ALB_SZ, ALB_SZ);
  const tmpX = tmpC.getContext('2d');
  tmpX.drawImage(albumImg, 0, 0, ALB_SZ, ALB_SZ);
  const id = tmpX.getImageData(0, 0, ALB_SZ, ALB_SZ);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i+1], b = d[i+2];
    // sepia(20%) blend + brightness(0.86) + contrast(1.07)
    const sr = r*0.393 + g*0.769 + b*0.189;
    const sg = r*0.349 + g*0.686 + b*0.168;
    const sb = r*0.272 + g*0.534 + b*0.131;
    let nr = (sr*0.20 + r*0.80) * 0.86;
    let ng = (sg*0.20 + g*0.80) * 0.86;
    let nb = (sb*0.20 + b*0.80) * 0.86;
    d[i]   = Math.min(255, Math.max(0, ((nr/255 - 0.5)*1.07 + 0.5)*255));
    d[i+1] = Math.min(255, Math.max(0, ((ng/255 - 0.5)*1.07 + 0.5)*255));
    d[i+2] = Math.min(255, Math.max(0, ((nb/255 - 0.5)*1.07 + 0.5)*255));
  }
  tmpX.putImageData(id, 0, 0);
  ctx.drawImage(tmpC, ax, ay);

  // 구분선
  const sg = ctx.createLinearGradient(0, H*.08, 0, H*.92);
  sg.addColorStop(0,'transparent'); sg.addColorStop(.2,'rgba(201,169,110,0.07)');
  sg.addColorStop(.5,'rgba(201,169,110,0.15)'); sg.addColorStop(.8,'rgba(201,169,110,0.07)');
  sg.addColorStop(1,'transparent');
  ctx.save(); ctx.strokeStyle = sg; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(SEP_X, H*.08); ctx.lineTo(SEP_X, H*.92); ctx.stroke();
  ctx.restore();

  // 메타 텍스트
  ctx.save();
  ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.font = `300 15px ${FONT}`; ctx.fillStyle = 'rgba(201,169,110,0.50)';
  ctx.fillText('오래된 사진첩 — 그때는 몰랐던 사랑', W - 68, 95);
  ctx.font = `300 13px ${FONT}`; ctx.fillStyle = 'rgba(201,169,110,0.22)';
  ctx.fillText('mintorain', W - 68, 120);
  ctx.restore();
}

// ── 가사 텍스트 캐시 생성 ─────────────────────────────────────────────
function buildLyricsCache() {
  const cache = new Map();

  for (const [, text] of L) {
    for (const [posStr, sz] of Object.entries(FS)) {
      const wgt  = posStr === '0' ? '400' : '300';
      const glow = posStr === '0';
      const key  = `${text}__${sz}__${wgt}__${glow}`;
      if (cache.has(key)) continue;

      // 텍스트 너비 측정
      const mC = createCanvas(10, 10);
      const mX = mC.getContext('2d');
      mX.font = `${wgt} ${sz}px ${FONT}`;
      const tw = Math.ceil(mX.measureText(text).width);

      const pad = glow ? 72 : 8;
      const ch  = sz * (glow ? 3.0 : 2.0) + pad * 2;
      const cw  = tw + pad * 2;
      const tc  = createCanvas(cw, ch);
      const tx  = tc.getContext('2d');
      tx.textBaseline = 'middle';
      tx.textAlign    = 'left';
      tx.font         = `${wgt} ${sz}px ${FONT}`;

      if (glow) {
        tx.shadowColor = 'rgba(201,169,110,0.45)'; tx.shadowBlur = 28;
        tx.fillStyle = '#f5e8d0';
        tx.fillText(text, pad, ch/2);
        tx.shadowColor = 'rgba(201,169,110,0.18)'; tx.shadowBlur = 60;
        tx.fillText(text, pad, ch/2);
        tx.shadowBlur = 0;
      }
      tx.fillStyle = '#f5e8d0';
      tx.fillText(text, pad, ch/2);

      cache.set(key, { canvas: tc, padX: pad, padY: ch/2 });
    }
  }
  return cache;
}

// ── 가사 렌더링 ──────────────────────────────────────────────────────────
function drawLyrics(ctx, ts, audioSec, st, cache) {
  const ni = getIdx(audioSec);
  if (ni !== st.curIdx) {
    st.prevIdx = st.curIdx; st.curIdx = ni; st.transEndTs = ts + TDUR;
  }
  if (st.curIdx < 0) return;

  const ai = st.curIdx, pi = st.prevIdx;
  const raw = st.transEndTs > ts ? 1-(st.transEndTs-ts)/TDUR : 1.0;
  const pr  = eio(Math.max(0, Math.min(1, raw)));
  const inT = pr < 1.0 && pi >= 0;

  for (let off = -3; off <= 3; off++) {
    const li = ai + off;
    if (li < 0 || li >= L.length) continue;

    const ck = String(off);
    const cOp = FO[ck], cSz = FS[ck], cY = LY[off];
    let op, y;

    if (inT) {
      const delta = ai - pi, po = off + delta;
      const pk  = String(Math.max(-3, Math.min(3, po)));
      const pOp = (po >= -3 && po <= 3) ? FO[pk] : 0;
      const pY  = (po >= -3 && po <= 3) ? LY[po] : (po < -3 ? LY[-3]-42 : LY[3]+42);
      op = lerp(pOp, cOp, pr);
      y  = lerp(pY, cY, pr);
    } else { op = cOp; y = cY; }

    if (op < 0.008) continue;

    const wgt  = off === 0 ? '400' : '300';
    const glow = off === 0;
    const key  = `${L[li][1]}__${cSz}__${wgt}__${glow}`;
    const entry = cache.get(key);
    if (!entry) continue;

    ctx.save();
    ctx.globalAlpha = op;
    ctx.drawImage(entry.canvas, LYR_X - entry.padX, Math.round(y - entry.padY));
    ctx.restore();
  }
}

// ── 메인 ──────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🎬 오래된 사진첩 — 리릭스 비디오 MP4 생성');
  console.log('   ffmpeg :', FFMPEG);
  console.log('   총 프레임:', TOTAL_F, `(${fmt(SONG_SEC)} 분량)\n`);

  // 파일 경로
  const audioPath  = path.join(DIR, '오래된 사진첩 — 그때는 몰랐던 사랑.mp3');
  const coverPath  = path.join(DIR, '오래된 사진첩 — 그때는 몰랐던 사랑.jpeg');
  const outputPath = path.join(DIR, '오래된_사진첩_리릭스비디오.mp4');

  // 준비
  process.stdout.write('📷 앨범 이미지 로딩...');
  const albumImg = await loadImage(coverPath);
  console.log(' 완료');

  process.stdout.write('🎨 정적 배경 렌더링...');
  const bgCanvas = createCanvas(W, H);
  buildStaticBg(bgCanvas.getContext('2d'), albumImg);
  console.log(' 완료');

  process.stdout.write('📝 가사 텍스트 사전 렌더링...');
  const lyrCache = buildLyricsCache();
  console.log(` 완료 (${lyrCache.size}개 캐시)`);

  // 메인 캔버스
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // FFmpeg 프로세스 시작
  console.log('\n⚙️  FFmpeg 인코딩 시작...');
  const ff = spawn(FFMPEG, [
    '-y',
    '-f', 'rawvideo', '-vcodec', 'rawvideo',
    '-s', `${W}x${H}`, '-pix_fmt', 'bgra',
    '-r', String(FPS), '-i', 'pipe:0',
    '-i', audioPath,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k',
    '-shortest', outputPath,
  ], { stdio: ['pipe', 'inherit', 'pipe'] });

  ff.stderr.on('data', () => {}); // suppress ffmpeg progress output

  const lyrState = { curIdx: -1, prevIdx: -1, transEndTs: 0 };
  const t0 = Date.now();

  // 프레임 쓰기 (백프레셔 처리)
  async function writeFrame(buf) {
    const ok = ff.stdin.write(buf);
    if (!ok) await new Promise(r => ff.stdin.once('drain', r));
  }

  // 프레임 렌더링 루프
  for (let fi = 0; fi < TOTAL_F; fi++) {
    const ts_ms  = fi / FPS * 1000;
    const audSec = fi / FPS;

    // 정적 배경 복사
    ctx.drawImage(bgCanvas, 0, 0);

    // 파티클 업데이트 + 렌더링
    ctx.save();
    DUST.forEach(p => {
      ctx.globalAlpha = p.a;
      ctx.fillStyle   = 'rgb(215,188,132)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
      p.x += p.vx * 2; p.y += p.vy * 2;
      if (p.y < -4) { p.y = H + 4; p.x = Math.random() * W; }
      if (p.x < -4) p.x = W + 4;
      if (p.x > W + 4) p.x = -4;
    });
    ctx.restore();

    // 가사 렌더링
    drawLyrics(ctx, ts_ms, audSec, lyrState, lyrCache);

    // 프레임 전송
    await writeFrame(canvas.toBuffer('raw'));

    // 진행 상황 (매 90프레임 = 3초마다)
    if (fi % 90 === 89 || fi === TOTAL_F - 1) {
      const elapsed = (Date.now() - t0) / 1000;
      const pct     = ((fi + 1) / TOTAL_F * 100).toFixed(1);
      const spd     = (fi + 1) / elapsed;
      const remain  = Math.max(0, (TOTAL_F - fi - 1) / spd);
      process.stdout.write(
        `\r  ${pct.padStart(5)}%  |  경과: ${fmt(elapsed)}  |  남은 시간: ~${fmt(remain)}  |  ${spd.toFixed(0)} fps   `
      );
    }
  }

  ff.stdin.end();
  await new Promise(r => ff.on('close', r));

  const totalSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n\n✅ 완료! (총 ${totalSec}초 소요)`);
  console.log(`📁 저장 위치: ${outputPath}\n`);
}

main().catch(err => {
  console.error('\n❌ 오류:', err.message);
  process.exit(1);
});
