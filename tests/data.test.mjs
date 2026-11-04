// node tests/data.test.mjs — data.js 원문이 핸드오프(2026-11-03) 5장의 교과서 원문과 글자 하나까지 같은지, 예시·힌트에 결론 문장이 없는지
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(dir, 'data.js'), 'utf8') + '\n;this.D={INTRO,TARGETS,REFERENCE,EXPO_WORD,TEXT,GLOSSARY,FRAMES,GROUPS,WORD_FORMS};', ctx);
const D = ctx.D;
const plain = s => s.replace(/\|/g, '');
let fail = 0;
const eq = (name, a, b) => { if (a !== b) { fail++; console.log('✗ ' + name + '\n  앱: ' + a + '\n  원문: ' + b); } else console.log('✓ ' + name); };

const CLAIM_ORIG = {
  rhodes: '넘쳐나는 인구를 해결하기 위해 새로운 영토를 개척해야 한다. 또한 공장에서 생산하는 상품을 팔기 위해 지구상의 영토를 조금이라도 더 식민지로 장악해야 한다. - 세실 로즈, 『유언집』',
  racism: '인종주의는 인종 간에 우열이 존재한다고 믿는 사고방식이다.',
  socialdarwin: '사회 진화론은 환경에 적응한 생물이 살아남는다는 진화론을 왜곡해 우수한 사회만이 살아남고 뒤떨어진 사회는 사라진다고 주장한 논리이다.',
  slogan: '이런 논리를 바탕으로 제국주의 국가는 "우월한 서양인들이 미개한 식민지인들을 지배해야 한다."라고 선전했다.',
  cartoon: '「케이프에서 카이로로」(1902) 영국의 아프리카 침략을 문명과 야만의 전쟁으로 묘사했다. 왼편의 백인들을 이끄는 여신은 \'문명\'이라고 쓰인 깃발을 들고 있으며, 오른편 흑인들의 깃발에는 \'야만\'이라는 글씨가 쓰여 있다.',
  soapad: '미국의 비누 광고 포스터(1910년경) 인종주의적 시각이 드러난 광고 포스터로, 하단에 "왜 너희 엄마는 요정 비누로 널 씻기지 않니?"라는 문구가 쓰여 있다.'
};
const ROSE_NOTE = '세실 로즈 영국의 제국주의자로, 아프리카 식민지 개척에 앞장섰다.';
const SRC_ORIG = {
  london: ['1851년 영국은 왕실의 주도 아래 런던 만국 박람회를 개최했다. 이 행사는 영국의 산업과 과학 기술의 발전을 뽐내기 위한 목적으로 열렸다. 당시 전시장으로 쓰인 수정궁은 공장에서 생산한 철근과 판유리로 지어졌다. 그 안에는 10만 개 이상의 전시물이 진열됐으며, 600만 명이 넘는 사람들이 입장했다.',
    ['수정궁에 전시된 대형 기계들 런던 만국 박람회에서는 증기 기관 등 거대한 기계도 소개되어 사람들을 놀라게 했다.']],
  paris: ['영국과 경쟁 관계에 있던 프랑스는 1855년에 국제 박람회를 열었고, 1889년에는 프랑스 혁명 100주년을 기념해 파리 만국 박람회를 개최했다. 프랑스는 박람회 시작에 맞춰 파리 시내에 에펠탑을 쌓아 올렸다. 300m가 넘는 철탑인 에펠탑은 당시 세계 최고 높이를 자랑했으며, 이후 파리의 상징물이 됐다.',
    ['에펠탑의 엘리베이터 관람객들은 엘리베이터를 타고 올라가 파리 시내를 한눈에 내려다볼 수 있었다.']],
  stlouis: ['1904년 미국은 루이지애나 매입 100주년을 기념해 세인트루이스 만국 박람회를 열었다. 세계 60여 개국이 참가한 이 박람회에는 전차, 비행기 등의 발명품뿐 아니라 사람도 전시됐다. 이전부터 유럽에서는 아프리카인, 아메리카 원주민, 아시아인을 구경거리로 전시하는 일이 흔했다. 세인트루이스 박람회에서도 세계로 뻗어나가는 미국의 우월성을 드러내기 위해 아메리카 원주민, 그리고 미국이 에스파냐로부터 빼앗은 필리핀의 원주민을 데려와 전시했다.',
    ['필리핀 원주민을 구경하는 관람객들(미국 의회도서관) 원주민들은 전통 의상을 입고 관람객 앞에서 춤과 노래를 펼쳐야 했다.',
     '박람회장에 전시된 아메리카 원주민 가족(미국 미주리역사박물관) 관람객들은 박람회장에 전시된 원주민 마을에서 기념사진을 찍기도 했다.']],
  japan: ['인종 전시는 주로 백인들의 그릇된 우월감과 인종주의를 보여주는 사례였다. 그러나 일본도 자신들이 식민지 주민보다 우월하다고 생각했다. 1907년 도쿄에서 열린 박람회에는 조선관, 타이완관이 있었고, 그곳에 조선인과 타이완인이 전시됐다. 이는 조선인들의 분노를 자아냈다. 이보다 앞서 1903년 개최된 오사카 내국 박람회에서도 일본은 자신들이 정복한 홋카이도의 아이누인, 오키나와의 류큐인과 함께 조선인, 타이완인을 전시했다.',
    ['도쿄 권업 박람회 기념사진(서울시립대박물관) 왼쪽에서 두 번째에 서 있는 갓을 쓴 남자와 그 옆에 흰 옷을 입은 여성이 박람회에 전시된 조선인으로 추정된다.']],
  newspaper: ['우리 동포여. 예전에 우리가 아프리카 토인종을 불쌍히 여겼더니, 오늘에 이르러서는 어찌 그들이 우리를 더욱 불쌍히 여기게 될 줄 알았으리오. - 「대한매일신보」 (1907. 6. 21.)', []]
};
const EXPO_ORIG = '박람회란 한 나라 또는 지역의 문화나 산업 상태를 소개하기 위해 각종 물품을 소개하는 전시회야.';

const claims = D.TARGETS.filter(x => x.group === 'claim'), byId = id => D.TARGETS.find(x => x.id === id);
eq('주장 카드 6장', claims.map(c => c.id).join(','), Object.keys(CLAIM_ORIG).join(','));
claims.forEach(c => eq('주장 ' + c.id, plain(c.text) + (c.cite ? ' ' + c.cite : ''), CLAIM_ORIG[c.id]));
eq('로즈 풀이', byId('rhodes').note, ROSE_NOTE);
eq('로즈만 need 틀', D.TARGETS.filter(x => x.frame === 'need').map(x => x.id).join(), 'rhodes');
// 박람회 대상 3장: 런던+파리는 한 장(본문을 띄어쓰기 하나로 이음), 신문은 참고 자료
const cap = s => JSON.stringify(s.captions.map(c => c.head + ' ' + c.text));
eq('박람회 대상 3장', D.TARGETS.filter(x => x.group === 'expo').map(x => x.id).join(), 'expoMachine,expoStlouis,expoJapan');
eq('런던·파리 본문', plain(byId('expoMachine').text), SRC_ORIG.london[0] + ' ' + SRC_ORIG.paris[0]);
eq('런던·파리 캡션', cap(byId('expoMachine')), JSON.stringify(SRC_ORIG.london[1].concat(SRC_ORIG.paris[1])));
eq('세인트루이스 본문', plain(byId('expoStlouis').text), SRC_ORIG.stlouis[0]);
eq('세인트루이스 캡션', cap(byId('expoStlouis')), JSON.stringify(SRC_ORIG.stlouis[1]));
eq('도쿄·오사카 본문', plain(byId('expoJapan').text), SRC_ORIG.japan[0]);
eq('도쿄·오사카 캡션', cap(byId('expoJapan')), JSON.stringify(SRC_ORIG.japan[1]));
eq('신문(참고)', plain(D.REFERENCE.text) + ' ' + D.REFERENCE.cite, SRC_ORIG.newspaper[0]);
eq('박람회 풀이', D.EXPO_WORD, EXPO_ORIG);
eq('사회 진화론 «왜곡해» 유지', /왜곡해/.test(byId('socialdarwin').text), true);
// 168쪽 도입 문단(결론 방향)이 안 들어갔는지
eq('도입 문단 없음', /정당화했는지/.test(fs.readFileSync(path.join(dir, 'data.js'), 'utf8')), false);
// 예시·힌트에 결론 문장 금지: «틀렸다/잘못이다/거짓» 같은 판정 낱말이 힌트·placeholder에 없어야 한다
const hints = D.TARGETS.map(c => c.hint).concat(D.TEXT.evHints, [D.TEXT.wHint, D.TEXT.framePh, D.TEXT.wPh]);
eq('힌트에 판정 낱말 없음', hints.filter(h => /틀렸|잘못|거짓|차별|정당하지/.test(h)).length, 0);
eq('토인종 풀이에 «지금은 쓰지 않음»', /지금은.*쓰지 않는다/.test(D.GLOSSARY['토인종']), true);

// 모르는 낱말 찾기: 꼴이 달라도 찾히고, 없는 낱말은 없다고 답한다
vm.runInContext(fs.readFileSync(path.join(dir, 'word_lookup.js'), 'utf8') + '\n;this.lookupWord=lookupWord;', ctx);
const look = w => ctx.lookupWord(w, D.GLOSSARY, D.WORD_FORMS);
const words = w => look(w).items.map(x => x.word).join();
const same = (w, key) => eq('찾기: ' + w + ' → ' + key, look(w).hit + ':' + words(w), 'exact:' + key);
same('그릇된', '그릇된'); same('그릇되다', '그릇된'); same('자아내다', '자아냈다');
same('우월하다', '우월'); same('개최하다', '개최'); same('왜곡된', '왜곡'); same('인종의', '인종'); same('박람회를', '박람회');
eq('찾기: 앞부분만 쓰면 near', look('진화').hit + ':' + words('진화'), 'near:진화론');
// 앞글자만 같거나 안에 들어 있다고 엉뚱한 풀이를 보여 주지 않는다
['자아정체성', '수정하다', '사회주의', '원주율', '미개척지', '기관', '선전포고', '인종차별', '박람회장'].forEach(w => eq('찾기: ' + w + ' 풀이 없음', look(w).hit, 'none'));
eq('찾기: 띄어쓰기 달라도', look('사회진화론').hit + ':' + words('사회진화론'), 'exact:사회 진화론');
eq('찾기: 없는 낱말', look('양자역학').hit, 'none');
eq('찾기: 한 글자', look('제').hit, 'short');
eq('찾기: 빈 칸', look('   ').hit, 'short');
eq('찾기: 최대 4개', look('인종').items.length <= 4, true);

console.log(fail ? '\n실패 ' + fail + '건' : '\n모두 통과');
process.exit(fail ? 1 : 0);
