'use strict';
const fs   = require('fs');
const path = require('path');
const { generateVideo, parseSRT } = require('../../generator');

const DIR = __dirname;

const srtContent = fs.readFileSync(path.join(DIR, '너 없이 피는 봄.srt'), 'utf8');
const { lyrics, title } = parseSRT(srtContent);

const songs = [{
  albumPath: path.join(DIR, '너 없이 피는 봄.jpeg'),
  audioPath: path.join(DIR, '너 없이 피는 봄.mp3'),
  lyrics,
  title: '너 없이 피는 봄',
}];

// 가사 흐름 및 감정선에 맞게 배치한 20개 배경화면 및 전환 시간 설정
const backgrounds = [
  // 1. Intro
  { imagePath: path.join(DIR, '01_intro_morning.jpeg'),     startSec: 0   }, // Intro 시작 (어제와 같은 아침)
  { imagePath: path.join(DIR, '02_intro_window.jpeg'),      startSec: 8   }, // 창가에 햇살이 내려와
  { imagePath: path.join(DIR, '03_verse_window.jpeg'),      startSec: 15  }, // 꽃잎은 아무 일 없다는 듯
  
  // 2. Verse 1
  { imagePath: path.join(DIR, '04_verse_walk.jpeg'),        startSec: 30  }, // 네가 좋아하던 길 위에
  { imagePath: path.join(DIR, '05_verse_hand.jpeg'),        startSec: 43  }, // 손끝에 닿던 너의 온기
  { imagePath: path.join(DIR, '06_verse_lonely.jpeg'),      startSec: 50  }, // 이제는 혼자 걷는 이 길
  { imagePath: path.join(DIR, '07_verse_cafe.jpeg'),        startSec: 56  }, // 커피는 조금 식어가고
  
  // 3. Pre-Chorus 1
  { imagePath: path.join(DIR, '08_pre_wind.jpeg'),          startSec: 72  }, // 바람이 불면
  { imagePath: path.join(DIR, '06_verse_lonely.jpeg'),      startSec: 83  }, // 괜찮아질 거라고 몇 번을 말하지만
  { imagePath: path.join(DIR, '09_pre_tear.jpeg'),          startSec: 91  }, // 햇살이 따뜻할수록 마음은 더 시려와
  
  // 4. Chorus 1
  { imagePath: path.join(DIR, '10_cho_lookback.jpeg'),      startSec: 99  }, // 너 없이 피는 봄 참 이상하게 예뻐서
  { imagePath: path.join(DIR, '15_cho_sunset.jpeg'),        startSec: 111 }, // 너 없이 오는 봄 아무렇지 않은 척 와서
  { imagePath: path.join(DIR, '18_final_sunlight.jpeg'),    startSec: 123 }, // 사랑했던 우리도 다시 피어날 수 있을까
  { imagePath: path.join(DIR, '04_verse_walk.jpeg'),        startSec: 142 }, // 나는 아직 너를 걷고 있어
  
  // 5. Verse 2
  { imagePath: path.join(DIR, '11_verse_photo.jpeg'),       startSec: 153 }, // 사진 속 우리는 여전히 (2절 시작)
  { imagePath: path.join(DIR, '12_verse_earphone.jpeg'),    startSec: 167 }, // 함께 듣던 노래 하나가
  { imagePath: path.join(DIR, '13_verse_letter.jpeg'),      startSec: 181 }, // 말하지 못한 마음들이 서랍 속 편지처럼
  
  // 6. Pre-Chorus 2
  { imagePath: path.join(DIR, '14_pre_sky.jpeg'),           startSec: 195 }, // 꽃은 다시 피고 하늘은 또 맑아졌는데
  { imagePath: path.join(DIR, '09_pre_tear.jpeg'),          startSec: 209 }, // 너를 놓는 일은 왜 이토록 오래 걸릴까
  
  // 7. Chorus 2
  { imagePath: path.join(DIR, '15_cho_sunset.jpeg'),        startSec: 223 }, // 너 없이 피는 봄 참 조용하게 아파서
  { imagePath: path.join(DIR, '10_cho_lookback.jpeg'),      startSec: 235 }, // 너 없이 오는 봄 우리의 약속도 모른 채
  { imagePath: path.join(DIR, '16_inst_piano.jpeg'),        startSec: 251 }, // 사랑했던 시간은 어디쯤 흩어졌을까
  { imagePath: path.join(DIR, '08_pre_wind.jpeg'),          startSec: 265 }, // 나는 아직 너를 부르고 있어
  
  // 8. Instrumental & Bridge
  { imagePath: path.join(DIR, '16_inst_piano.jpeg'),        startSec: 274 }, // 피아노만 남은 거리 (간주)
  { imagePath: path.join(DIR, '17_bridge_rain.jpeg'),       startSec: 287 }, // 언젠가 이 길을 지나도 (브릿지)
  { imagePath: path.join(DIR, '14_pre_sky.jpeg'),           startSec: 315 }, // 봄은 이렇게 매번 새롭게 오는데
  
  // 9. Final Chorus
  { imagePath: path.join(DIR, '18_final_sunlight.jpeg'),    startSec: 329 }, // 너 없이 피는 봄 이젠 조금은 알 것 같아
  { imagePath: path.join(DIR, '03_verse_window.jpeg'),      startSec: 355 }, // 사랑했던 우리는 꽃잎처럼 흩어졌지만
  { imagePath: path.join(DIR, '19_outro_walk.jpeg'),        startSec: 371 }, // 너 없이도 살아가
  
  // 10. Outro
  { imagePath: path.join(DIR, '02_intro_window.jpeg'),      startSec: 384 }, // 창가에 햇살이 내려와 오늘도 봄은 피어나고
  { imagePath: path.join(DIR, '03_verse_window.jpeg'),      startSec: 400 }, // 꽃잎은 아무 일 없다는 듯
  { imagePath: path.join(DIR, '20_ending_road.jpeg'),       startSec: 411 }, // 나는 아직 그날에 있어 + 엔딩
];

const outputPath = path.join(DIR, '너_없이_피는_봄_완성본.mp4');
const creator    = 'Andrew An';

function fmt(s) { return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`; }

console.log('\n🎬 너 없이 피는 봄 — 뮤직비디오 생성 시작');
console.log(`   배경 이미지: ${backgrounds.length}장`);
console.log(`   가사 자막: ${lyrics.length}줄`);
console.log(`   저장 위치: ${outputPath}\n`);

generateVideo({
  songs,
  backgrounds,
  creator,
  outputPath,
  lyricFont: 'NanumBrush', // 가사용 기본 폰트
  titleFont: 'DoHyeon',    // 타이틀용 기본 폰트
  titleCard: {
    title: '너 없이 피는 봄',
    subtitle: creator,
    fadeInEnd: 2.5,
    fadeOutStart: 5.5,
    fadeOutEnd: 8.0,
  },
  onProgress: (pct, fps, remain) => {
    process.stdout.write(
      `\r  ${pct.toFixed(1).padStart(5)}%  |  ${Math.round(fps)} fps  |  남은 시간: ~${fmt(remain)}   `
    );
  },
}).then(() => {
  console.log(`\n\n✅ 완료! 뮤직비디오 파일이 정상적으로 생성되었습니다.`);
  console.log(`📁 저장 완료: ${outputPath}\n`);
}).catch(err => {
  console.error('\n❌ 뮤직비디오 생성 실패:', err.message);
  process.exit(1);
});
