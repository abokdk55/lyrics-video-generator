'use strict';
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { generateVideo, parseLRC, parseSRT } = require('./generator');

const app = express();
app.use(express.urlencoded({ extended: true }));

const UPLOADS = path.join(__dirname, 'uploads');
const OUTPUT  = path.join(__dirname, 'output');
[UPLOADS, OUTPUT].forEach(d => fs.mkdirSync(d, { recursive: true }));

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOADS),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage });

app.use(express.static(__dirname));

// 가사 타임스탬프를 기반으로 이미지별 시작 시간 자동 배분
function assignBgTimes(count, allLyrics) {
  if (count === 0) return [];
  if (count === 1) return [0];
  const n = allLyrics.length;
  if (n === 0) return Array.from({ length: count }, (_, i) => i * 30);
  const lastT = allLyrics[n - 1][0];
  return Array.from({ length: count }, (_, i) => {
    if (i === 0) return 0;
    const target = (i / (count - 1)) * lastT;
    let best = 0, bestDist = Infinity;
    for (const [t] of allLyrics) {
      const d = Math.abs(t - target);
      if (d < bestDist) { bestDist = d; best = t; }
    }
    return Math.floor(best);
  });
}

function getFile(files, name) {
  return (files || []).find(f => f.fieldname === name);
}

app.post('/api/generate', upload.any(), async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = obj => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  const files = req.files || [];
  const body  = req.body  || {};

  const toClean = files.map(f => f.path);
  const cleanup = () => toClean.forEach(p => fs.unlink(p, () => {}));

  try {
    const songCount = Math.max(1, parseInt(body.songCount || 1));
    const creator   = (body.creator || '').trim();

    const songs = [];
    for (let i = 0; i < songCount; i++) {
      const albumFile = getFile(files, `album_${i}`);
      const lrcFile   = getFile(files, `lrc_${i}`);
      const srtFile   = getFile(files, `srt_${i}`);
      const audioFile = getFile(files, `audio_${i}`);

      if (!albumFile || !audioFile || (!lrcFile && !srtFile)) {
        send({ type: 'error', message: `곡 ${i+1}: 앨범 이미지, 가사 파일(LRC 또는 SRT), 오디오 파일이 필요합니다.` });
        cleanup(); res.end(); return;
      }

      const lyricsContent = lrcFile
        ? fs.readFileSync(lrcFile.path, 'utf8')
        : fs.readFileSync(srtFile.path, 'utf8');
      const { lyrics, title: parsedTitle } = lrcFile
        ? parseLRC(lyricsContent)
        : parseSRT(lyricsContent);

      if (lyrics.length === 0) {
        send({ type: 'error', message: `곡 ${i+1}: 가사를 파싱할 수 없습니다.` });
        cleanup(); res.end(); return;
      }

      songs.push({
        albumPath: albumFile.path,
        audioPath: audioFile.path,
        lyrics,
        title: (body[`title_${i}`] || parsedTitle || path.basename(audioFile.originalname, path.extname(audioFile.originalname))).trim(),
      });
    }

    const bgFileList = (files || []).filter(f => f.fieldname === 'bg');
    const allLyricsForTiming = songs.flatMap(s => s.lyrics);
    const bgTimes = assignBgTimes(bgFileList.length, allLyricsForTiming);
    const backgrounds = bgFileList.map((f, i) => ({
      imagePath: f.path,
      startSec: bgTimes[i] || 0,
    }));
    backgrounds.sort((a, b) => a.startSec - b.startSec);

    const outputFile = `video_${Date.now()}.mp4`;
    const outputPath = path.join(OUTPUT, outputFile);

    send({ type: 'info', message: `${songs.length}곡, 오디오 합산 및 렌더링 시작 중...` });

    await generateVideo({
      songs, backgrounds, creator, outputPath,
      onProgress: (pct, fps, remain) => {
        const m = Math.floor(remain / 60), s = Math.floor(remain % 60);
        send({ type: 'progress', pct, fps: Math.round(fps), remain: `${m}:${String(s).padStart(2,'0')}` });
      },
    });

    const dlName = encodeURIComponent((songs[0].title || '리릭스비디오') + '.mp4');
    send({ type: 'done', url: `/download/${outputFile}?as=${dlName}` });

    // 30분 후 파일 삭제
    setTimeout(() => fs.unlink(outputPath, () => {}), 30 * 60 * 1000);
  } catch (err) {
    send({ type: 'error', message: err.message });
  }

  cleanup();
  res.end();
});

app.get('/download/:filename', (req, res) => {
  const name = path.basename(req.params.filename);
  const filePath = path.join(OUTPUT, name);
  if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
  const saveName = decodeURIComponent(req.query.as || name);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(saveName)}`);
  res.sendFile(filePath);
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`\n🎬 리릭스 비디오 생성기`);
  console.log(`   http://localhost:${PORT}\n`);
});
