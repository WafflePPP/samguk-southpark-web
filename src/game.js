'use strict';
// 렌더 · 입력 · HUD — 퍼스트퀸4 전투 화면/조작: 군단마다 "조작 캐릭터" 한 명을 방향키(숫자패드)로 직접 움직이고 Space 로 특수기·마법,
// 나머지는 AI + 하단 부대별 군단 명령(돌격·정지·후퇴). ←→ 조작 캐릭터 변경, ↑↓ 군단 변경, Ctrl 가속, 적을 클릭하면 집중 공격.
// 모바일(터치): 같은 조작을 큰 버튼으로 — 왼쪽 이동패드(누르고 있기·멀티터치), 오른쪽 행동/보조/마법 버튼, 상단 두 군단 초상 줄·군단 명령, 왼쪽 중간 미니맵, 왼쪽 아래 시스템.
// 전투 규칙은 sim.js, 도형은 art.js.
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const { TILE, WW, WH, SPELL, SPECIAL, CATEGORY_NAME, FORMATION_NAME, CLS_NAME } = Sim;
const VW = 1280, VH = 720;
let TB_H = 58, LEFT_W = 150, VPW = VW - LEFT_W, FS = 1, mobile = false;   // 레이아웃은 PC/모바일 모드에 따라 바뀐다 (setMobile)
const ORDER_NAME = { idle: '자유', attack: '공격', charge: '돌격', stop: '정지', retreat: '후퇴', flee: '도주' };
const SPEEDS = [1, 2, 3];
const BATTLE_SPEED = 0.8;   // 현재 전투 전체 진행 속도의 80%를 새 기준 속도(×1)로 사용
const MAX_SIM_STEPS = 12;   // 느린 프레임에서 배속 연산이 한꺼번에 몰려 브라우저가 멈추는 것을 방지
// 방향 입력: 숫자패드(NumLock 꺼져 있어도 code 는 Numpad*) + 노트북용 WASD/QEZC
const DIRS = { Numpad7: [-1, -1], Numpad8: [0, -1], Numpad9: [1, -1], Numpad4: [-1, 0], Numpad6: [1, 0], Numpad1: [-1, 1], Numpad2: [0, 1], Numpad3: [1, 1], KeyQ: [-1, -1], KeyW: [0, -1], KeyE: [1, -1], KeyA: [-1, 0], KeyD: [1, 0], KeyZ: [-1, 1], KeyS: [0, 1], KeyC: [1, 1] };
const PAD = [[7, -1, -1, '↖'], [8, 0, -1, '↑'], [9, 1, -1, '↗'], [4, -1, 0, '←'], [5, 0, 0, '행동'], [6, 1, 0, '→'], [1, -1, 1, '↙'], [2, 0, 1, '↓'], [3, 1, 1, '↘']];   // 보조키 윈도우: 숫자패드 배열

let S = null, terrain = null, state = 'title', T = 0, overAt = 0, paused = false, menuOpen = false, supportOpen = false, titleNotice = '';
// 원정 지도는 퍼스트퀸4 방식의 거점 이동용 최소 흐름이다. 전투 규칙·편성은 기존 Sim 전투를 그대로 쓴다.
// 화북·연주·사예·서주 도시 (참조 지도 기반): [번호, id, 이름, 지역, 세력, 열, 행, 지형(p평 r강 w강·광 m산 f성), Lv, 난이도(초중상최), 길(양방향, 한쪽만 적어도 됨)]. 좌표는 격자 col,row 에서 계산한다.
const STAGE_ROWS = [
  [1, 'chenliu', '진류', '연주', '조조', 6, 8, 'p', 2, '초', 'guandu xuchang puyang'],
  [2, 'dingtao', '정도', '연주', '유비', 8, 7, 'w', 5, '초', 'xiaopei puyang'],
  [3, 'ye', '업', '화북', '원소', 6, 5, 'f', 7, '중', 'puyang handan shangdang'],
  [4, 'puyang', '복양', '연주', '조조', 7, 6, 'p', 8, '초', ''],
  [5, 'xiaopei', '소패', '서주', '유비', 10, 7, 'p', 8, '초', 'donghai'],
  [6, 'guandu', '관도', '연주', '조조', 5, 8, 'f', 20, '상', 'luoyang xuchang'],
  [7, 'guangling', '광릉', '서주', '여포', 13, 11, 'w', 20, '상', 'siyang'],
  [8, 'langya', '낭야', '서주', '여포', 12, 6, 'm', 26, '상', 'kaiyang gaomi'],
  [9, 'xiapi', '하비', '서주', '여포', 11, 8, 'f', 32, '최', 'donghai siyang'],
  [10, 'handan', '한단', '화북', '원소', 6, 4, 'p', 8, '초', 'yingtao fangzi'],
  [11, 'shangdang', '상당', '화북', '원소', 4, 5, 'm', 9, '초', 'jinyang henei'],
  [12, 'xindu', '신도', '화북', '원소', 8, 3, 'p', 10, '중', 'yingtao gaotang'],
  [13, 'zhongshan', '중산', '화북', '원소', 7, 2, 'p', 11, '중', 'hejian yingtao'],
  [14, 'jinyang', '진양', '화북', '원소', 4, 3, 'm', 11, '중', 'fangzi'],
  [15, 'hejian', '하간', '화북', '원소', 9, 2, 'p', 12, '중', 'ji gaotang'],
  [16, 'nanpi', '남피', '화북', '원소', 10, 3, 'r', 12, '중', 'gaotang linzi'],
  [17, 'ji', '계', '화북', '원소', 9, 0, 'f', 14, '중', 'beiping'],
  [18, 'beiping', '북평', '화북', '원소', 11, 0, 'm', 15, '중', 'changli'],
  [19, 'henei', '하내', '사예', '조조', 4, 6, 'f', 15, '중', 'luoyang'],
  [20, 'luoyang', '낙양', '사예', '조조', 3, 7, 'f', 17, '중', ''],
  [21, 'donghai', '동해', '서주', '여포', 11, 7, 'p', 10, '중', 'kaiyang'],
  [22, 'kaiyang', '개양', '서주', '여포', 11, 6, 'p', 15, '중', 'linzi'],
  [23, 'siyang', '사양', '서주', '여포', 12, 9, 'p', 16, '중', ''],
  [24, 'linzi', '임치', '화북', '원소', 11, 4, 'f', 24, '상', 'gaomi'],
  [25, 'gaomi', '고밀', '화북', '원소', 12, 5, 'p', 28, '상', 'donglai'],
  [26, 'donglai', '동래', '화북', '원소', 14, 4, 'm', 29, '상', ''],
  [27, 'xuchang', '허창', '예주', '조조', 5, 9, 'f', 32, '최', ''],
  [28, 'fangzi', '방자', '화북', '원소', 5, 3, 'p', 9, '중', ''],
  [29, 'yingtao', '영도', '화북', '원소', 7, 3, 'p', 9, '중', ''],
  [30, 'gaotang', '고당', '화북', '원소', 9, 3, 'p', 11, '중', ''],
  [31, 'changli', '창려', '화북', '원소', 12, 0, 'p', 14, '중', ''],
];
const WORLD_W = 1700, WORLD_H = 1200;   // 지도 월드 크기 (카메라로 1000×720 만 보인다)
// 참조 지도의 상대 위치를 현재 도시 격자에 맞춘 개략 지형이다.
const YELLOW_RIVER = [[0, 550], [150, 600], [270, 690], [410, 690], [525, 710], [625, 705], [690, 680], [755, 615], [820, 590], [860, 585], [930, 490], [1100, 475], [1180, 390], [1320, 335]];
const MAP_MOUNTAINS = [
  { name: '태행산맥', x: 575, y: 200, n: 8, dx: 0, dy: 44, h: 54, lx: 605, ly: 200 },
  { name: '연산산맥', x: 820, y: 35, n: 8, dx: 95, dy: 0, h: 32, lx: 1190, ly: 135 },
  { name: '진령산맥', x: 40, y: 875, n: 7, dx: 46, dy: 2, h: 44, lx: 170, ly: 930 },
  { name: '화산', x: 155, y: 790, n: 2, dx: 27, dy: 4, h: 58, lx: 170, ly: 830 },
  { name: '숭산', x: 410, y: 865, n: 3, dx: 28, dy: -4, h: 43, lx: 438, ly: 900 },
  { name: '태산', x: 1100, y: 560, n: 3, dx: 26, dy: -6, h: 48, lx: 1130, ly: 600 },
];
const OLD_STAGE = { chenliu: ['연주 중심 도시', 5], dingtao: ['서주 방면 관문', 11], ye: ['원소군 수도', 13], puyang: ['조조군 전초', 17], xiaopei: ['유비군 수도', 23], guandu: ['수도 외곽 관문', 29], guangling: ['강가 관문', 37], langya: ['수도 외곽 산성', 41], xiapi: ['여포군 수도', 47], xuchang: ['조조군 수도·예주 영천군', 43] };
const STAGES = STAGE_ROWS.map(([stage, id, name, region, faction, col, row, t, level, d, links]) => ({
  id, name, region, faction, stage, level, difficulty: { 초: '초급', 중: '중급', 상: '상급', 최: '최상' }[d], note: OLD_STAGE[id] ? OLD_STAGE[id][0] : `${region} 거점`,
  theme: { p: 'plains', r: 'riverside', w: 'riverside', m: 'mountain', f: 'fortress' }[t], ...(t === 'w' ? { wideRiver: true } : {}),
  x: 60 + 105 * col + (row % 2 ? 52 : 0), y: 60 + 95 * row, owner: faction === '여포' ? 'player' : 'enemy', links: links ? links.split(' ') : [], mapSeed: OLD_STAGE[id] ? OLD_STAGE[id][1] : 100 + stage,
  ...(['xiapi', 'ye', 'xuchang', 'xiaopei'].includes(id) ? { capital: true } : {}),
}));
for (const s of STAGES) for (const id of s.links) { const t = STAGES.find(x => x.id === id); if (!t) throw new Error(`${s.id}: 없는 도시 ${id}`); if (!t.links.includes(s.id)) t.links.push(s.id); }   // 길은 양방향
const INITIAL_FACTIONS = STAGES.map(s => s.faction);
const START_STAGE = 'xiapi', CAPITALS = { '여포': 'xiapi', '원소': 'ye', '조조': 'xuchang', '유비': 'xiaopei' }, PLAYABLE_FACTIONS = ['여포', '조조', '유비'];
const FACTIONS = ['여포', '원소', '조조', '유비'], INITIAL_RULERS = { '여포': 'lubu', '원소': 'yuan', '조조': 'cao', '유비': 'liubei' }, SUCCESSORS = { lubu: ['lulingqi'], yuan: ['yuantan'], cao: ['caopi'], liubei: ['liushan'] };
const FACTION_HEROES = {
  '여포': ['lubu', 'jang', 'diao', 'gao', 'chengong', 'lulingqi', 'haomeng', 'caoxing', 'weixu', 'houcheng'],
  '원소': ['yuan', 'yan', 'wen', 'gaolan', 'quyi', 'jushou', 'tianfeng', 'shenpei', 'yuantan', 'yuanxi', 'chunyuqiong', 'hanmeng', 'jiangyiqu', 'guotu', 'fengji', 'yuanshang', 'xinping', 'lvkuang', 'xuyou', 'hanjuzi'],
  '조조': ['cao', 'xia', 'xiahouyuan', 'dian', 'xuchu', 'guo', 'zhanghe', 'yujin', 'caohong', 'caoxiu', 'caopi', 'xun', 'chengyu', 'liuye', 'sima'],
  '유비': ['liubei', 'guan', 'kong', 'zhao', 'liushan'],   // 명세 67: 세력별 절반 선정. 제거 장수는 Sim.U·GRADE·art 데이터를 지우지 않고 FACTION_HEROES 에서만 뺀다(ARMIES·시험이 직접 사용)
};
{ const assigned = Object.values(FACTION_HEROES).flat(); if (new Set(assigned).size !== assigned.length || assigned.some(key => !Sim.U[key])) throw new Error('장수 세력 배치표가 중복되었거나 장수 정보가 없습니다.'); }
const stageById = id => STAGES.find(s => s.id === id);
// 군단 편성 (명세 55): 기동 군단 수 = 장수 수 × 30%(최소 1). 군주가 첫 군단장, 군단장은 나머지 중 등급 높은 순. 남는 장수는 등급순 snake 분배로 슬롯 6·12(2·3분대장)·1·2·3·4·5… 에 배치. 3번째마다 원정군.
const CORPS_RATIO = 0.3, MEMBER_SLOTS = [6, 12, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17];
const gradeMul = k => Sim.GRADE_MUL[Sim.GRADE[k]];
const FACTION_MEMBERS = Object.fromEntries(Object.entries(FACTION_HEROES).map(([f, list]) => {
  const n = Math.max(1, Math.round(list.length * CORPS_RATIO)), rest = list.slice(1).sort((a, b) => gradeMul(b) - gradeMul(a)), corps = [list[0], ...rest.slice(0, n - 1)].map(lead => ({ lead, slots: {} }));
  rest.slice(n - 1).forEach((key, i) => { const r = Math.floor(i / n), pos = i % n; corps[r % 2 ? n - 1 - pos : pos].slots[MEMBER_SLOTS[r]] = key; });   // snake: 1→N, N→1 순환
  return [f, corps];
}));
const FACTION_CORPS = Object.fromEntries(Object.entries(FACTION_MEMBERS).map(([f, c]) => [f, c.map(x => x.lead)]));
const placeMembers = (faction, n, units) => { for (const [slot, key] of Object.entries(FACTION_MEMBERS[faction][n].slots)) units[slot] = key; };
const factionCities = f => STAGES.filter(s => INITIAL_FACTIONS[s.stage - 1] === f).sort((a, b) => (b.id === CAPITALS[f]) - (a.id === CAPITALS[f]));   // 수도가 맨 앞
const startCity = (f, n) => { const c = factionCities(f); return c[n % c.length].id; };   // n번째 군단의 시작 도시: 자기 세력 도시에 라운드로빈 (수도 우선)
if (Object.entries(FACTION_HEROES).some(([f, h]) => { const all = FACTION_MEMBERS[f].flatMap(c => [c.lead, ...Object.values(c.slots)]); return all.length !== h.length || new Set(all).size !== h.length || FACTION_MEMBERS[f].some(c => Object.keys(c.slots).some(k => k >= Sim.ARMY_MAX)); })) throw new Error('군단 편성이 세력 장수와 맞지 않습니다.');
const playerFaction = () => campaign.playerFaction || '여포';
const playerCapital = () => CAPITALS[playerFaction()] || START_STAGE;
const unclaimedCities = () => STAGES.filter(s => s.owner !== 'player');   // 승리 조건(명세 44): 모든 도시를 점령. 동맹 도시도 포함 — 동맹을 깨고(전쟁) 점령해야 한다
const campaignWon = () => !unclaimedCities().length;
const capitalFor = force => campaignCapital(forceFaction(force)) || START_STAGE;
const DEFAULT_AI_RELATIONS = { '원소|조조': { status: 'neutral', truceUntil: 0 }, '원소|유비': { status: 'neutral', truceUntil: 0 }, '유비|조조': { status: 'neutral', truceUntil: 0 } };   // AI 세력끼리의 관계 (이름순 키)
const DEFAULT_RELATIONS = { '원소': { status: 'neutral', truceUntil: 0 }, '조조': { status: 'neutral', truceUntil: 0 }, '유비': { status: 'neutral', truceUntil: 0 } };
function pairRel(a, b) { const key = [a, b].sort().join('|'), o = a === '여포' ? b : b === '여포' ? a : null; return JSON.parse(JSON.stringify(o ? DEFAULT_RELATIONS[o] : DEFAULT_AI_RELATIONS[key] || { status: 'neutral', truceUntil: 0 })); }   // 기본 관계: 모든 쌍 중립 (조조|유비 포함 예외 없음)
function initialAiRelations(player = '여포') { const out = {}; for (const a of FACTIONS) for (const b of FACTIONS) if (a < b && a !== player && b !== player) out[a + '|' + b] = pairRel(a, b); return out; }   // 플레이어를 뺀 세력 쌍 전부
// ---- 역사 기반 외교 (명세 62): 세력 쌍의 호감도가 제안 성공 확률·AI 선전포고·휴전 만료 결과를 바꾼다. 수치는 모두 설계값 ----
const AFFINITY_INIT = { '여포|원소': -25, '여포|유비': -15, '여포|조조': -55, '원소|유비': 25, '원소|조조': -40, '유비|조조': 15 };
const AFFINITY_WHY = { '여포|조조': '연주를 두고 다퉜고 하비에서 끝내 맞붙은 숙적', '여포|유비': '서주에서 받아 주었다가 하비를 빼앗고 소패까지 공격한 사이', '여포|원소': '한때 공조했으나 끝내 불화한 사이 (설계값)', '원소|조조': '초기 협력 뒤 관도에서 맞서는 숙적', '원소|유비': '서주에서 쫓긴 유비가 원소에게 의탁한 사이', '유비|조조': '함께 여포를 쳤으나 서주를 두고 결별하는 사이' };
const AFFINITY_STAGES = [[0, '적대', '#ff7d6a'], [0, '냉담', '#ffb06a'], [0, '보통', '#d0d0d0'], [0, '우호', '#b5ec6a'], [0, '신뢰', '#7dff9a']];   // ≤-35 적대 · ≤-10 냉담 · ≤14 보통 · ≤39 우호 · 그 위 신뢰
const affinityStage = A => { const s = AFFINITY_STAGES[A <= -35 ? 0 : A <= -10 ? 1 : A <= 14 ? 2 : A <= 39 ? 3 : 4]; return { name: s[1], col: s[2] }; };
const dipInit = () => ({ affinity: { ...AFFINITY_INIT }, affLast: {}, truceStreak: {}, dipCool: {}, aiCool: {}, warSince: {}, dipLog: [] });
const affinityOf = (a, b) => (campaign.affinity && campaign.affinity[[a, b].sort().join('|')]) ?? 0;
const DIP_CHANCE = { truceWar: 30, truceOther: 40, ally: 20, min: 5, maxTruce: 90, maxAlly: 85, fatigue: 12 };
const TRUCE_RULE = { calmA: 35, maxRenew: 3, renewCost: 3, driftEvery: 2, driftCap: 60 };   // 휴전만 이어 가는 전략(TURTLE) 억제 (QA v0.1.265 중요 2, 설계값): 만료 때 호감도 ≥ calmA 라야 중립 복귀(아니면 전쟁), 연속 갱신은 maxRenew 회까지, 갱신마다 renewCost×연속 횟수만큼 호감도 소모, 휴전 중 호감도 회복은 driftEvery 턴마다 +1(≤driftCap) (명세 62 A3 값 그대로)
const WAR_DECAY_EVERY = 2;   // 전쟁 중 호감도 -1 은 N턴마다 (명세 62 는 매 턴이었으나 60턴 포화 29% 라 완화)
const WAR_DRIFT_FLOOR = -80;   // 전쟁이 길어져도 시간만으로는 -80 까지만 내려간다 (-100 은 점령·파기 같은 사건으로만) — 장기전 포화 완화(설계값)
const WAR_COST = { neutral: 5, truce: 25, ally: 40 };   // 선전포고·휴전 파기·동맹 파기가 호감도를 깎는 양 (영토 침범은 중립 10)
const FACTION_ALLIES = {};   // 고정 동맹은 없다 — 동맹은 외교(플레이어·AI)로만 맺는다
const THEME_NAME = { plains: '평야', mountain: '산악', riverside: '강가', fortress: '성채' };
const FACTION_STYLE = {
  '여포': { main: '#202126', light: '#e5e7eb', dark: '#8a90a6' },
  '원소': { main: '#d2a82e', light: '#fff0a3', dark: '#705616' },
  '조조': { main: '#2e77c7', light: '#cce8ff', dark: '#163b70' },
  '유비': { main: '#329653', light: '#c9f2ce', dark: '#1d5730' },
};
// 세력 고유 병종(명세 53 §3.6): 정규화한 병종 키가 표에 있으면 고유 키로 바꾼다. FACTION_UNIT_RATE 로 치환 비율(슬롯 번호 기준 10칸 중 몇 칸)을 조절한다.
function swatch(f, x, y, w, h = w) { ctx.fillStyle = FACTION_STYLE[f].main; ctx.fillRect(x, y, w, h); ctx.strokeStyle = FACTION_STYLE[f].light; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }   // 색 견본: 어두운 여포 검정도 밝은 윤곽으로 보인다 (QA v0.1.272 경미 1)
const FACTION_UNITS = { '여포': { shield: 'f_xian', cav: 'f_bing' }, '원소': { sword: 'f_ji', archer: 'f_nu' }, '조조': { sword: 'f_qing', cav: 'f_hubao' }, '유비': { sword: 'f_dan', shield: 'f_bai', spear: 'f_bai' } };
const BASE_UNIT_KEY = { esword: 'sword', eshield: 'shield', earcher: 'archer', ecav: 'cav' };
const FACTION_UNIT_RATE = 1;
function factionKey(faction, key, slot = 0) { const to = FACTION_UNITS[faction]?.[BASE_UNIT_KEY[key] || key]; return to && (slot % 10) < FACTION_UNIT_RATE * 10 ? to : key; }
const isDefenseCapital = s => s.owner === 'player' ? s.id === playerCapital() : !!s.faction && campaignCapital(s.faction) === s.id;   // 현재 수도만 수비 강화 대상 (명세 62 B1) — ★ 표시용 isCapital 과 달리 아군이 점령한 옛 수도는 아니다
const gradeCapital = isDefenseCapital;   // 수도 병사는 정예 패턴(Sim.GRADE_PATTERN.cap)
const gradeTag = sg => Sim.SOLDIER_GRADE[sg] ? Sim.SOLDIER_GRADE[sg].name + sg : '';   // 병사 등급 표기: 정예B · 정규C · 신병D · 징집병F
const stageFaction = stage => stage.owner === 'player' ? playerFaction() : stage.faction;
const THEME_UNITS = { plains: ['ecav', 'esword', 'earcher'], mountain: ['esword', 'eshield', 'earcher'], riverside: ['earcher', 'esword', 'eshield'], fortress: ['eshield', 'earcher', 'esword'] };
const ROUT_CHANCE = { 초급: 0.09, 중급: 0.075, 상급: 0.055, 최상: 0.035 };
const CITY_SIZES = { small: { name: '소형', units: 12, level: 1 }, medium: { name: '중형', units: 24, level: 3 }, large: { name: '대형', units: 36, level: 5 } };
const LARGE_CITIES = ['luoyang', 'xuchang', 'chenliu', 'puyang', 'ye', 'jinyang', 'nanpi', 'ji', 'beiping', 'xiaopei', 'xiapi', 'guangling'];
const MEDIUM_CITIES = ['dingtao', 'guandu', 'handan', 'shangdang', 'xindu', 'zhongshan', 'hejian', 'henei', 'donghai', 'kaiyang', 'langya', 'linzi', 'gaomi', 'donglai'];
const citySize = s => LARGE_CITIES.includes(s.id) ? 'large' : MEDIUM_CITIES.includes(s.id) ? 'medium' : 'small';
// 도시 특성(명세 56): 크기·지형·수도와 독립인 가치 축. 데이터는 정적이라 저장하지 않는다. 지정은 기획 판단(사료 검증 안 함).
const KINDS = {
  granary: { name: '곡창', letter: '곡', mul: 1.8, corps: 2, guard: 3, lv: 0, cost: 2, lump: { small: 20, medium: 30, large: 50 } },
  barracks: { name: '병영', letter: '병', mul: 0.8, corps: 4, guard: 5, lv: 0, cost: 2, ratio: 0.75 },
  fort: { name: '요새', letter: '요', mul: 0.7, corps: 1, guard: 3, lv: 2, cost: 2 },
  trade: { name: '교역', letter: '교', mul: 1.2, corps: 2, guard: 3, lv: 0, cost: 1, lump: { small: 10, medium: 15, large: 25 } },
  county: { name: '군현', letter: '', mul: 1.0, corps: 2, guard: 3, lv: 0, cost: 2 },
};
const CITY_KIND = {};
for (const [kind, ids] of Object.entries({
  granary: 'xuchang ye nanpi henei guangling', barracks: 'puyang xiaopei zhongshan ji beiping',
  fort: 'guandu langya xiapi shangdang jinyang changli', trade: 'chenliu dingtao handan luoyang siyang linzi',
  county: 'xindu hejian donghai kaiyang gaomi donglai fangzi yingtao gaotang',
})) for (const id of ids.split(' ')) CITY_KIND[id] = kind;
const cityKind = s => KINDS[CITY_KIND[s.id]] || KINDS.county;
const kindLine = s => { const k = cityKind(s); return `${k.name} · 산출 +${Math.round(cityYield(s))} · 보충 +${k.corps}/턴 · 비용 ${s.owner === 'player' ? refillCost(k) : k.cost}${k.lv ? ' · 수비 Lv+' + k.lv : ''}`; };
// 군량(명세 56·61): 세력 단위 1종. 수치는 설계값 — tools/econ61.js·econ61-play.js·campaign-sim.js 로 측정해 조정한다. 명세 61: 상한 300→200·기본 보급 12→16·유지비 0.5→0.55·도시 산출 ×0.8·플레이어 보충 비용 ×1.5(올림).
const ECON = { start: 100, cap: 200, base: 16, limit: 6, over: 0.5, capitalMul: 1.2, unit: 0.55, refill: 1.5, move: 2, unrest: 3, warn: 20, hungry: 40, desertFrom: 2 };
const refillCost = k => Math.ceil(k.cost * ECON.refill);   // 플레이어 보충 비용만 ×1.5 (올림) — AI 보충까지 올리면 AI 템포(도시 변화 없는 판)가 나빠진다
const CITY_BASE = { small: 2.4, medium: 4.8, large: 8.8 };
const cityYield = s => CITY_BASE[citySize(s)] * cityKind(s).mul * (isCapital(s) ? ECON.capitalMul : 1);
const econInit = () => ({ grain: Object.fromEntries(FACTIONS.map(f => [f, ECON.start])), famine: Object.fromEntries(FACTIONS.map(f => [f, 0])), econOwner: {}, unrest: {}, econLog: {}, warnTier: 0 });
function withHealers(units) {
  const count = Math.ceil(units.length * 0.1);
  for (let i = 0; i < count; i++) units[Math.floor((i + 1) * units.length / count) - 1] = 'healer';
  return units;
}
const CITY_TROOPS = { plains: ['spear', 'sword', 'archer'], mountain: ['shield', 'spear', 'archer'], riverside: ['archer', 'spear', 'shield'], fortress: ['shield', 'archer', 'spear'] };
const cityGuards = [];
const guardsAt = s => cityGuards.filter(f => f.home === s.id && f.active && f.army.units.length);
const allForces = () => enemyForces.concat(cityGuards);
const forceById = id => enemyForces.find(f => f.id === id) || cityGuards.find(f => f.id === id);
// 수도 수비병 (명세 62 B): 정원 54(3군단)·정예 B 90%·방패3 궁4 검2 창1 순환, 2턴마다 max(guard,4)+3 명 보충. 4개 수도 동일 규칙(세력 보정 CAPITAL_EXTRA 는 측정 후 필요하면).
const CAPITAL_GUARD = 54, CAPITAL_REFILL = { every: 2, min: 4, plus: 3 }, CAPITAL_POOL = ['shield', 'archer', 'sword', 'archer', 'spear', 'shield', 'archer', 'sword', 'archer', 'shield'];
const CAPITAL_EXTRA = { '여포': { guard: -36, refill: 0 }, '원소': { guard: -36, refill: 0 }, '조조': { guard: -36, refill: 0 }, '유비': { guard: 0, refill: 0 } };   // 세력별 수도 보정 노브(명세 62 B2): guard=정원 추가(18 의 배수 권장), refill=2턴 보충 추가. 소유 세력 기준이라 수도를 점령하면 점령자의 값을 따른다. 명세 67: 군단 수가 절반이라 여포·원소·조조 수도 정원을 54→18 로 낮췄다(54 에서는 외교 ON 승 1/12·수도가 너무 단단해 전 도시 점령 불가, 36 도 1/12, 18 에서 8/12 = 기준선 8/12). 유비는 54 (18 에서는 수도 분포 FAIL). 대형 일반 도시(36)보다 수도(18)가 작은 것은 의도된 설계값(측정 기반, 명세 67 후속 확정) — 표시는 자기 정원 기준이라 '수비 n/18' 로 어색하지 않다
const capExtra = s => CAPITAL_EXTRA[stageFaction(s)] || {};
const capitalSizes = () => [...new Set([CAPITAL_GUARD, ...Object.values(CAPITAL_EXTRA).map(e => CAPITAL_GUARD + (e.guard || 0))])];   // 저장 검증용: 허용되는 수도 정원 전부
const capitalRefill = s => Math.max(cityKind(s).guard, CAPITAL_REFILL.min) + CAPITAL_REFILL.plus + (capExtra(s).refill || 0);
const guardCap = s => isDefenseCapital(s) ? CAPITAL_GUARD + (capExtra(s).guard || 0) : CITY_SIZES[citySize(s)].units;
const guardTroop = (s, idx) => { const pool = CITY_TROOPS[s.theme]; return isDefenseCapital(s) ? CAPITAL_POOL[idx % CAPITAL_POOL.length] : pool[idx % pool.length]; };   // idx: 수비군 안의 칸 번호
function guardForce(stage, i, units, maxUnits, lv) {
  return { id: 'guard:' + stage.id + ':' + i, role: 'garrison', home: stage.id, at: stage.id, fac: stageFaction(stage), active: units.length > 0, maxUnits, level: lv, army: { team: 'enemy', name: stage.name + ' 도시수비군 ' + (i + 1) + '대', leader: null, detachment: true, commander: true, units, growth: units.map((k, j) => enemyGrowth(k, lv, Sim.soldierGradeAt(lv, j, isDefenseCapital(stage)))), formation: 'guard' } };
}
function resetCityGuards(stage, ratio = 1) {
  for (let i = cityGuards.length - 1; i >= 0; i--) if (cityGuards[i].home === stage.id) cityGuards.splice(i, 1);
  const total = guardCap(stage), lv = CITY_SIZES[citySize(stage)].level + cityKind(stage).lv; let left = Math.ceil(total * ratio);
  for (let i = 0; i < Math.ceil(total / Sim.ARMY_MAX); i++) {
    const maxUnits = Math.min(Sim.ARMY_MAX, total - i * Sim.ARMY_MAX), n = Math.min(maxUnits, left), units = withHealers(Array.from({ length: n }, (_, j) => guardTroop(stage, j + (isDefenseCapital(stage) ? 0 : i)))).map((k, j) => factionKey(stageFaction(stage), k, j)); left -= n;
    cityGuards.push(guardForce(stage, i, units, maxUnits, lv));
  }
}
function ensureCapitalGuards() {   // 수도가 된 도시(천도·구 저장)에 정원 54 만큼 수비군 슬롯을 만든다 — 빈 슬롯은 보충으로 채운다. 이미 있는 병력은 그대로
  for (const s of STAGES) {
    if (!isDefenseCapital(s)) continue;
    const total = guardCap(s), lv = CITY_SIZES[citySize(s)].level + cityKind(s).lv;
    for (let i = 0; i < Math.ceil(total / Sim.ARMY_MAX); i++) {
      const maxUnits = Math.min(Sim.ARMY_MAX, total - i * Sim.ARMY_MAX), f = cityGuards.find(g => g.id === 'guard:' + s.id + ':' + i);
      if (f) f.maxUnits = Math.max(f.maxUnits, maxUnits); else cityGuards.push(guardForce(s, i, [], maxUnits, lv));
    }
  }
}
function reinforceCityGuards() {   // 일반 도시는 5턴마다 도시 유형만큼, 수도는 2턴마다 max(유형,4)+3 만큼 수비군 보충 — 소유 세력 군량을 쓴다 (유지비 1턴치 보존선)
  for (const s of STAGES) {
    const k = cityKind(s), fac = stageFaction(s), cap = isDefenseCapital(s); if (campaign.turn % (cap ? CAPITAL_REFILL.every : 5)) continue;
    let left = Math.min(cap ? capitalRefill(s) : k.guard, grainRoom(fac, k.cost));
    for (const f of cityGuards.filter(g => g.home === s.id)) { const n = Math.min(left, f.maxUnits - f.army.units.length); for (let i = 0; i < n; i++) { const idx = f.army.units.length, k2 = f.army.units.filter(k => k === 'healer').length < Math.ceil(f.maxUnits * 0.1) ? 'healer' : factionKey(fac, guardTroop(s, idx), idx); f.army.units.push(k2); f.army.growth.push(enemyGrowth(k2, f.level, Sim.soldierGradeAt(f.level, idx, cap))); } f.active = f.army.units.length > 0; left -= n; if (n) spendGrain(fac, n * k.cost); } }
}
const captureNote = s => { const k = cityKind(s), lump = k.lump?.[citySize(s)]; return ` [${k.name}]${lump ? ' 군량 +' + lump + '(다음 턴)' : ''}${k.ratio ? ' 수비군 정원 ' + k.ratio * 100 + '%' : ''} · ${ECON.unrest}턴 혼란(산출 0).`; };
const captureRatio = s => cityKind(s).ratio || 0.5;   // 병영은 점령 직후 수비군 정원 75%
const grainOf = f => campaign.grain[f] || 0;
const grainRoom = (f, cost) => Math.max(0, Math.floor((grainOf(f) - (campaign.econLog[f]?.upkeep || 0)) / cost));   // 유지비 1턴치는 남기고 쓴다
function spendGrain(f, n) { campaign.grain[f] = grainOf(f) - n; const l = campaign.econLog[f]; if (l) l.spent += n; }
function factionIncome(f) {
  const ys = STAGES.filter(s => stageFaction(s) === f).map(s => (campaign.unrest[s.id] || 0) > campaign.turn ? 0 : cityYield(s)).sort((a, b) => b - a);
  return { n: ys.length, over: Math.max(0, ys.length - ECON.limit), total: ys.length ? ys.reduce((n, y, i) => n + (i >= ECON.limit ? y * ECON.over : y), ECON.base) : 0 };
}
function factionUnits(f) { return f === playerFaction() ? roster.reduce((n, c) => n + c.units.filter(Boolean).length, 0) : enemyForces.filter(x => x.active && forceFaction(x) === f && x.role !== 'garrison').reduce((n, x) => n + x.army.units.length, 0); }
const isDeserter = k => !namedRosterUnit(k) && k !== 'healer';
function desertFaction(f) {   // 기근: 기동 군단마다 일반 병사 1명 (장수·회복병·군단장 제외, 슬롯 번호 큰 쪽부터)
  let n = 0;
  if (f === playerFaction()) { for (const c of roster) { for (let i = c.units.length - 1; i > 0; i--) if (c.units[i] && isDeserter(c.units[i])) { c.units[i] = null; c.growth[i] = null; n++; break; } } return n; }
  for (const x of enemyForces) if (x.active && forceFaction(x) === f && x.role !== 'garrison') { const i = x.army.units.findLastIndex(isDeserter); if (i > 0) { x.army.units.splice(i, 1); x.army.growth.splice(i, 1); n++; } }
  return n;
}
function economyStep() {   // 턴 종료: 점령 감지(혼란·일시금) → 수입 − 유지비 → 상한·기근·탈영
  const moved = {}, lumps = {}, log = campaign.econLog = {};
  for (const m of campaign.movement) { const f = m.team === 'player' ? playerFaction() : m.faction; moved[f] = (moved[f] || 0) + 1; }
  for (const s of STAGES) {
    const f = stageFaction(s), prev = campaign.econOwner[s.id];
    if (prev && prev !== f) { campaign.unrest[s.id] = campaign.turn + ECON.unrest; lumps[f] = (lumps[f] || 0) + (cityKind(s).lump?.[citySize(s)] || 0); }
    campaign.econOwner[s.id] = f;
  }
  for (const f of FACTIONS) {
    const inc = factionIncome(f), famineBefore = campaign.famine[f] || 0; if (!inc.n || factionDead(f)) { log[f] = { income: 0, upkeep: 0, lump: 0, spent: 0, refill: 0, desert: 0, n: 0, over: 0, capped: false, grain: grainOf(f) }; continue; }
    const income = Math.round(inc.total), upkeep = Math.round(factionUnits(f) * ECON.unit + (moved[f] || 0) * ECON.move), lump = lumps[f] || 0, raw = grainOf(f) + income + lump - upkeep;
    campaign.grain[f] = Math.max(0, Math.min(ECON.cap, raw)); campaign.famine[f] = campaign.grain[f] === 0 ? famineBefore + 1 : 0;
    log[f] = { income, upkeep, lump, spent: 0, refill: 0, desert: campaign.famine[f] >= ECON.desertFrom ? desertFaction(f) : 0, n: inc.n, over: inc.over, capped: raw > ECON.cap, grain: campaign.grain[f] };
  }
}
const REFILL_TROOPS = ['sword', 'shield', 'archer', 'cav', 'sword', 'shield', 'mage'];
function replenishPlayer() {   // 이동하지 않고 아군 도시에 머문 군단이 도시 유형만큼 빈 병사 칸을 군량으로 채운다 (등급 C 고정, 장수 칸·군단장 제외)
  const f = playerFaction(), moved = new Set(campaign.movement.filter(m => m.team === 'player').map(m => m.corpsIndex)); let total = 0;
  roster.forEach((corps, idx) => {
    const st = stageById(corps.at), tpl = FACTION_MEMBERS[f][corps.id - 1];
    if (moved.has(idx) || !tpl || st.owner !== 'player') return;
    const k = cityKind(st), slots = []; for (let i = 1; i < corps.units.length; i++) if (!corps.units[i] && !(i in tpl.slots)) slots.push(i);
    let healers = corps.units.filter(x => x === 'healer').length; const n = Math.min(k.corps, slots.length, grainRoom(f, refillCost(k)));
    for (const i of slots.slice(0, n)) {
      const key = healers < Math.ceil(corps.units.length * 0.1) ? (healers++, 'healer') : factionKey(f, REFILL_TROOPS[(i + corps.id - 1) % REFILL_TROOPS.length], i);
      corps.units[i] = key; corps.growth[i] = Sim.levelStats(key, 'player', 1, 'C');
    }
    if (n) { spendGrain(f, n * refillCost(k)); total += n; if (campaign.econLog[f]) campaign.econLog[f].refill += n; }
  });
  return total;
}
function econWarning() {   // 플레이어 세력 경고: 단계가 올라갈 때 한 번만 팝업
  const f = playerFaction(), l = campaign.econLog[f]; if (!l || !l.n) return;
  const tier = grainOf(f) === 0 ? 2 : grainOf(f) + l.income - l.upkeep < ECON.warn ? 1 : 0;
  if (tier > (campaign.warnTier || 0)) showDiplomacyResult(tier === 2 ? '기근 발생' : '군량 주의', [tier === 2 ? '군량이 바닥났습니다 — 병력 보충이 중단되고 다음 턴부터 군단마다 병사가 탈영합니다.' : `군량이 부족해집니다 (${grainOf(f)}, 순수입 ${l.income - l.upkeep >= 0 ? '+' : ''}${l.income - l.upkeep}/턴) — 다음 턴 병력 보충 중단/탈영 위험.`], false, '군량');
  campaign.warnTier = tier;
}
function enemyGrowth(key, level, sg = 'C') { const st = Sim.levelStats(key, 'enemy', level, sg); return { ...st, xp: 0 }; }   // 레벨업 규칙(명세 21)과 같은 가산 성장
function setEnemyRole(force, stage, role, level = stage.level) {
  const fac = force.fac || stage.faction, unit = Sim.U[force.army.leader];   // 도시 소속이 바뀌어도 군단 이름은 군단의 소속을 따른다
  if (role === 'garrison') force.at = force.home || stage.id;
  force.role = role; force.home = force.home || stage.id; force.level = level; force.army.role = role;
  force.army.name = unit ? `${fac}군 · ${unit.name} 부대` : `${fac}군 · ${role === 'garrison' ? '수비' : '원정'}군`;
  const oldGrowth = force.army.growth || [];
  force.army.growth = force.army.units.map((key, i) => namedRosterUnit(key) && oldGrowth[i]?.lv >= level ? oldGrowth[i] : enemyGrowth(key, level, oldGrowth[i]?.sg ?? Sim.soldierGradeAt(level, i, role === 'garrison' && isDefenseCapital(stage)))); return force;
}
const enemyForces = [];
function addEnemyFaction(faction) {   // AI 세력의 군단 전부: 군단장(슬롯 0)만 이름 있는 장수, 나머지는 도시 지형의 병사. 자기 도시에 분산 배치
  const perCity = {};
  FACTION_CORPS[faction].forEach((lead, n) => {
    const at = startCity(faction, n), stage = stageById(at), pool = THEME_UNITS[stage.theme], k = perCity[at] = (perCity[at] ?? -1) + 1, units = withHealers(Array.from({ length: Sim.ARMY_MAX }, (_, i) => pool[(n + i) % pool.length])); units[0] = lead; for (let i = 1; i < units.length; i++) units[i] = factionKey(faction, units[i], i); placeMembers(faction, n, units);
    enemyForces.push(setEnemyRole({ id: enemyForces.length, fac: faction, corpsNo: n + 1, at, home: at, active: true, army: { team: 'enemy', name: '', at: [45, 18 + 7 * k], leader: lead, units, reserve: k > 0, reserveAt: 12, leaderRear: n === 0, formation: n === 0 ? 'guard' : 'block', trig: { near: 12, t: 60 } } }, stage, 'expedition'));
  });
}
const stageEnemyCount = stage => allForces().filter(f => f.active && f.at === stage.id && forceFaction(f) !== playerFaction()).reduce((n, f) => n + f.army.units.length, 0);
const campaign = { playerFaction: '여포', at: START_STAGE, corps: 0, from: null, battle: null, explore: false, invasion: false, destination: null, movement: [], movementPage: 0, pendingEncounter: null, responsePage: 0, intel: [], turn: 1, completed: false, relations: JSON.parse(JSON.stringify(DEFAULT_RELATIONS)), aiRelations: initialAiRelations(), aiBattles: [], capitals: { ...CAPITALS }, rulers: { ...INITIAL_RULERS }, heirsV1: true, heroRosterV1: true, heroRosterV2: true, heroGradeV1: true, heroGradeV2: true, heroGradeV3: true, dead: {}, digest: [], newsLog: [], newsMode: 'important', difficulty: 'normal', aiLast: {}, frontlineHp50: true, hp30v1: true, hp50v2: true, hpReduced30: true, enemyRolesLv1: true, enemyWavesLv2: true, enemyRatioLv3: true, enemyRatioLv4: true, enemyCurveV1: true, uniqueItemsV1: true, expeditionWaves: {}, rewarded: {}, items: { ironsword: 2, armor: 2, bowguard: 1, charm: 1, seal_ar: 1, seal_dr: 1, green_dragon: 1, twin_halberd: 1, sky_halberd: 0 }, notice: '하비에서 허창과 소패를 공략한다.', ...econInit(), ...dipInit() };
const relationOf = faction => campaign.relations?.[faction] || DEFAULT_RELATIONS[faction] || { status: 'neutral', truceUntil: 0 };
// 원정 지도 편성: 기존 본대·기마대·궁병대는 한 군단의 1·2·3분대다.
const ROSTER_MAX = 100;
const roster = [];   // 원정 지도 편성: 한 군단 = 18칸, 슬롯 0 이 군단장(이름 있는 장수)
const SAVE_KEY = 'sgsp-campaign-v1', SAVE_VERSION = 25, SAVE_SLOTS = 3;   // v25: 도시 31·장수 50·군단 16 (명세 67) — v24: 역사 외교 호감도(affinity·affLast·truceStreak·dipCool·aiCool·warSince·dipLog) — v23: 도시 특성·군량(grain·famine·econOwner·unrest·econLog) — v22: 기동 군단 70% 감소(30군단·군단당 장수 여럿) — v21: 조조 능력치 배율 3.8·전투력식 군사/치유 보정(성장치 재산정) — v20: 병종 역할 능력치(성장치 재산정) — v19: 장수 전사·포로·처우 — 이전 저장은 보존하되 불러오지 않는다
let startDifficulty = 'normal', activeSaveSlot = 1, saveSlotMode = null, startFactionSelect = false;
const saveKey = slot => `${SAVE_KEY}-${slot}`;
function initialPlayerRelations(faction) {
  const out = {};
  for (const other of FACTIONS) if (other !== faction) out[other] = pairRel(faction, other);
  return out;
}
function buildPlayerRoster(faction) {   // 플레이어 세력의 군단 전부: 군단장(슬롯 0)만 이름 있는 장수, 시작 도시는 자기 도시에 분산
  const troops = ['sword', 'shield', 'archer', 'cav', 'sword', 'shield', 'mage'];
  roster.length = 0;
  FACTION_CORPS[faction].forEach((lead, n) => {
    const units = withHealers(Array.from({ length: 18 }, (_, i) => troops[(i + n) % troops.length])); units[0] = lead; for (let i = 1; i < units.length; i++) units[i] = factionKey(faction, units[i], i); placeMembers(faction, n, units);
    const growth = units.map(key => Sim.levelStats(key, 'player', 1));
    for (let i = 0; i < units.length; i++) { const item = Object.entries(Sim.ITEMS).find(([, v]) => v.unique && v.owner === units[i]); if (item) { growth[i].item = item[0]; campaign.items[item[0]] = 0; } }
    roster.push({ id: n + 1, name: `신규 군단 ${n + 1}`, at: startCity(faction, n), target: null, units, growth });
  });
}
function distributePlayerInfantry() {
  let n = 0;
  for (const corps of roster) for (let i = 0; i < corps.units.length; i++) if (corps.units[i] === 'sword' || corps.units[i] === 'shield') { if (n++ % 2) corps.units[i] = 'spear'; }
}
function resetCampaignData(faction = '여포') {
  STAGES.forEach((s, i) => { s.faction = INITIAL_FACTIONS[i]; s.owner = s.faction === faction ? 'player' : 'enemy'; }); enemyForces.length = 0;
  campaign.prisoners = []; campaign.fallen = []; campaign.custodyNews = [];
  const at = CAPITALS[faction];
  Object.assign(campaign, { playerFaction: faction, at, corps: 0, from: null, battle: null, explore: false, invasion: false, destination: null, movement: [], movementPage: 0, pendingEncounter: null, responsePage: 0, intel: [], turn: 1, completed: false, relations: initialPlayerRelations(faction), aiRelations: initialAiRelations(faction), aiBattles: [], capitals: { ...CAPITALS }, rulers: { ...INITIAL_RULERS }, heirsV1: true, heroRosterV1: true, heroRosterV2: true, heroGradeV1: true, heroGradeV2: true, heroGradeV3: true, dead: {}, digest: [], newsLog: [], newsMode: 'important', difficulty: 'normal', aiLast: {}, frontlineHp50: true, hp30v1: true, hp50v2: true, hpReduced30: true, enemyRolesLv1: true, enemyWavesLv2: true, enemyRatioLv3: true, enemyRatioLv4: true, enemyCurveV1: true, uniqueItemsV1: true, expeditionWaves: {}, rewarded: {}, items: { ironsword: 2, armor: 2, bowguard: 1, charm: 1, seal_ar: 1, seal_dr: 1, green_dragon: 1, twin_halberd: 1, sky_halberd: 0 }, notice: `${faction}군의 수도 ${stageById(at).name}에서 원정을 시작한다.` });
  buildPlayerRoster(faction); for (const f of FACTIONS) if (f !== faction) addEnemyFaction(f);
  distributePlayerInfantry(); cityGuards.length = 0; STAGES.forEach(s => resetCityGuards(s));
  Object.assign(campaign, econInit(), dipInit()); for (const s of STAGES) campaign.econOwner[s.id] = stageFaction(s);
}
function canManualSave() { return stratTutStep < 0 && !custodyOpen() && state === 'map' && !campaign.pendingEncounter && !campaign.movement.length && !allyChoice && !warnMove && !diplomacyResult && !diplomacyView && !scoutView && !econView && !heroView && !campaign.battle; }   // 전략 화면에서 이동·교전 처리가 끝난 시점에만 저장할 수 있다
function saveCampaign(slot = activeSaveSlot, manual = false) {   // manual=true(저장 버튼)일 때만 실제로 저장한다. 그 밖의 호출(자동 저장)은 하지 않는다
  if (!manual) return false;
  activeSaveSlot = slot;
  try { localStorage.setItem(saveKey(slot), JSON.stringify({ ver: SAVE_VERSION, owners: STAGES.map(s => s.owner), factions: STAGES.map(s => s.faction), enemyForces, cityGuards, roster, campaign: { ...campaign, battle: null, pendingEncounter: null, movement: [], movementPage: 0, invasion: false, explore: false, from: null } })); return true; } catch (e) { /* 저장소를 못 쓰면 현재 플레이는 계속한다 */ }
}
const rawSave = slot => localStorage.getItem(saveKey(slot)) || (slot === 1 ? localStorage.getItem(SAVE_KEY) : '') || '';
function readCampaign(slot = activeSaveSlot) { try { const d = JSON.parse(rawSave(slot) || 'null'); return d && d.ver === SAVE_VERSION ? d : null; } catch (e) { return null; } }
function staleSave(slot) { try { const raw = rawSave(slot); return !!raw && !readCampaign(slot); } catch (e) { return false; } }   // 이전 규칙으로 저장된 데이터
function hasCampaign(slot = null) { try { return slot ? !!readCampaign(slot) : Array.from({ length: SAVE_SLOTS }, (_, i) => i + 1).some(hasCampaign); } catch (e) { return false; } }
function restoreCampaign(data) {
  if (!data || !Array.isArray(data.owners) || data.owners.length !== STAGES.length || !Array.isArray(data.enemyForces) || !Array.isArray(data.roster) || !data.roster.length || !data.campaign || data.roster.some(c => !stageById(c.at) || !Array.isArray(c.units)) || data.enemyForces.some(f => !stageById(f.at) || !f.army)) return false;
  const cp = data.campaign, validRef = ref => ref === null || typeof ref === 'string' && /^(p:\d+|e:(\d+|guard:[a-z]+:\d+))$/.test(ref);
  if (!Array.isArray(cp.prisoners) || !Array.isArray(cp.fallen) || !Array.isArray(cp.custodyNews) || cp.custodyNews.some(line => typeof line !== 'string') || cp.fallen.some(key => !namedRosterUnit(key)) || new Set(cp.fallen).size !== cp.fallen.length) return false;
  if (!cp.grain || !cp.famine || !cp.econOwner || !cp.unrest || !cp.econLog || FACTIONS.some(f => !Number.isInteger(cp.grain[f]) || cp.grain[f] < 0 || cp.grain[f] > 300 || !Number.isInteger(cp.famine[f]) || cp.famine[f] < 0)) return false;
  for (const f of FACTIONS) cp.grain[f] = Math.min(cp.grain[f], ECON.cap);   // 명세 61: 상한 300→200 — 이전 v24 저장의 초과분은 상한으로 줄여 불러온다 (구조 변경 없음, 버전 유지)
  const held = new Set();
  for (const p of cp.prisoners) {
    if (!p || !namedRosterUnit(p.key) || held.has(p.key) || cp.fallen.includes(p.key) || !FACTIONS.includes(p.owner) || !FACTIONS.includes(p.origin) || p.owner === p.origin || !stageById(p.at) || !stageById(p.home) || !validRef(p.heldBy) || !validRef(p.originRef) || !['pending', 'held'].includes(p.status) || !Number.isInteger(p.turn) || p.turn < 1 || p.turn > cp.turn || !Number.isInteger(p.lastAttempt) || p.lastAttempt > cp.turn || !p.growth || !Number.isInteger(p.growth.lv) || p.growth.lv < 1 || p.growth.lv > Sim.MAX_LEVEL || !Number.isFinite(p.growth.maxHp) || p.growth.maxHp <= 0) return false;
    for (const key of ['atk','df','ad','md','aa','hr','sp','ar','dr','xp']) if (!Number.isFinite(p.growth[key]) || p.growth[key] < 0) return false;
    held.add(p.key);
  }
  const unavailable = new Set([...held, ...cp.fallen]);
  if (data.roster.some(c => c.units.some(k => unavailable.has(k))) || data.enemyForces.some(f => !Array.isArray(f.army.units) || f.army.units.some(k => unavailable.has(k)))) return false;
  const guardMax = (s, i, total) => Math.min(Sim.ARMY_MAX, total - i * Sim.ARMY_MAX), slotsFor = total => Math.ceil(total / Sim.ARMY_MAX);   // 수도 정원(54)과 도시 크기 정원 어느 쪽이든 허용 — 수도 여부는 복원 뒤에야 알 수 있다
  const guardOk = f => { const s = stageById(f.home), i = +String(f.id).split(':')[2], size = CITY_SIZES[citySize(s)].units; return !!s && i < slotsFor(Math.max(...capitalSizes())) && (i < slotsFor(size) && f.maxUnits === guardMax(s, i, size) || capitalSizes().some(c => i < slotsFor(c) && f.maxUnits === guardMax(s, i, c))); };
  const perStage = {}; for (const f of data.cityGuards || []) perStage[f.home] = (perStage[f.home] || 0) + 1;
  if (!Array.isArray(data.cityGuards) || new Set(data.cityGuards.map(f => f.id)).size !== data.cityGuards.length || STAGES.some(s => ![slotsFor(CITY_SIZES[citySize(s)].units), ...capitalSizes().map(slotsFor)].includes(perStage[s.id])) || data.cityGuards.some(f => !stageById(f.home) || !String(f.id).startsWith('guard:' + f.home + ':') || !guardOk(f) || f.at !== f.home || f.role !== 'garrison' || f.level !== CITY_SIZES[citySize(stageById(f.home))].level + cityKind(stageById(f.home)).lv || !f.army || !Array.isArray(f.army.units) || !Array.isArray(f.army.growth) || f.army.units.length !== f.army.growth.length || f.army.units.length > f.maxUnits || f.army.units.some(k => !Sim.U[k]?.generic) || f.army.growth.some(v => !v || !Number.isFinite(v.lv) || !Number.isFinite(v.maxHp)))) return false;
  const battle = data.campaign.battle && stageById(data.campaign.battle), pendingStage = data.campaign.pendingEncounter && stageById(data.campaign.pendingEncounter.stage); if (data.campaign.battle && !battle || data.campaign.pendingEncounter && !pendingStage) return false;
  if (!cp.hpReduced30) {
    const growth = [...data.roster.flatMap(c => c.growth || []), ...data.enemyForces.flatMap(f => f.army.growth || []), ...data.cityGuards.flatMap(f => f.army.growth), ...cp.prisoners.map(p => p.growth)];
    for (const g of new Set(growth)) if (g && Number.isFinite(g.maxHp)) g.maxHp = Math.max(1, Math.round(g.maxHp * Sim.HP_SCALE));
    cp.hpReduced30 = true;
  }
  STAGES.forEach((s, i) => { s.owner = data.owners[i]; s.faction = data.factions && data.factions[i] || INITIAL_FACTIONS[i]; }); enemyForces.splice(0, enemyForces.length, ...data.enemyForces); roster.splice(0, roster.length, ...data.roster);
  for (const force of enemyForces) setEnemyRole(force, stageById(force.home) || stageById(force.at), force.role || 'garrison', force.level);
  data.campaign.items ||= {};
  for (const key of Object.keys(Sim.ITEMS)) if (!Number.isFinite(data.campaign.items[key])) data.campaign.items[key] = 0;
  Object.assign(campaign, data.campaign); campaign.playerFaction ||= '여포'; campaign.corps = Math.max(0, Math.min(roster.length - 1, campaign.corps || 0)); campaign.battle = battle; if (campaign.pendingEncounter) { campaign.pendingEncounter.stage = pendingStage; campaign.pendingEncounter.responders = (campaign.pendingEncounter.responders || []).filter(i => combatReadyCorps(roster[i])); campaign.pendingEncounter.unopposed = !campaign.pendingEncounter.responders.length; }
  cityGuards.splice(0, cityGuards.length, ...data.cityGuards); for (const f of cityGuards) { f.fac = stageFaction(stageById(f.home)); f.active = f.army.units.length > 0; f.army.detachment = true; f.army.commander = true; f.army.leader = null; }
  ensureCapitalGuards();   // 수도 슬롯이 모자라면(구 저장·천도) 빈 슬롯을 만든다
  campaign.rulers ||= { ...INITIAL_RULERS };
  for (const [k, v] of Object.entries(dipInit())) campaign[k] ||= v; for (const [k, v] of Object.entries(AFFINITY_INIT)) if (!Number.isFinite(campaign.affinity[k])) campaign.affinity[k] = v;
  campaign.relations ||= JSON.parse(JSON.stringify(DEFAULT_RELATIONS)); campaign.aiRelations ||= initialAiRelations(campaign.playerFaction); campaign.aiBattles ||= []; campaign.capitals ||= { ...CAPITALS }; campaign.dead ||= {}; campaign.digest ||= []; campaign.newsLog ||= []; campaign.newsMode ||= 'important'; campaign.difficulty ||= 'normal'; campaign.aiLast ||= {};
  return true;
}
function defeatCampaign(message) { S = null; state = 'title'; campaign.battle = null; moveSelectOpen = false; exploreSelectOpen = false; diplomacyView = null; saveSlotMode = null; titleNotice = message; }
function completeCampaignIfWon() {
  if (!campaignWon()) return false;
  const targets = `전 도시 ${STAGES.length}곳`, active = roster[campaign.corps]; campaign.completed = true; campaign.at = active ? active.at : campaign.at; campaign.from = null; campaign.battle = null; campaign.explore = false; campaign.invasion = false; campaign.pendingEncounter = null; campaign.movement = []; campaign.destination = null; campaign.notice = `${targets}을 모두 점령했다.`;
  S = null; state = 'title'; moveSelectOpen = false; exploreSelectOpen = false; diplomacyView = null; saveSlotMode = null; titleNotice = `${targets}을 모두 점령하여 원정에서 승리했습니다!`; saveCampaign(); return true;
}
let lastHelpIds = [];   // 이번 전투에 데려온 동맹 군단 id — 전투 다시 시작 때 같은 선택을 다시 쓴다 (전투 중에는 선택 팝업이 보이지 않음)
let allyChoice = null, allyHelpIds = null;   // 동맹군과 같은 도시에서 전투 직전의 선택 {stage, explore, ids} / 도우기로 정한 동맹 군단 id
let warnMove = null, diplomacyQueue = [];   // warnMove: 중립 도시 진입 경고 팝업 {id, stage} / diplomacyQueue: 한 번에 여러 외교 결과가 생길 때 순서대로 보여 줄 팝업
let econView = false, mapTool = null, scoutView = null, heroView = null, diplomacyView = null, diplomacyResult = null;   // heroView: 전략 화면 세력별 전체 장수 정보
let rosterDetailCorps = 0, rosterDetailPage = 0, rosterSource = 0, rosterTarget = null, rosterPage = 0, rosterMode = 'select', rosterPick = null, rosterNew = null, rosterDetailSlot = 0, moveSelectOpen = false, moveMode = 'corps', movePage = 0, exploreSelectOpen = false, explorePage = 0;
const SPECIAL_EFFECT = { spin: '주변 적에게 강한 물리 피해', dash: '최대 6칸 돌진·밀치기·거리 비례 추가 피해', volley: '화살 5발 연속 사격', bless: '주변 아군 HP 30% 회복·FT 20 감소' };
const STAT_DESC = { HP: '생명력', MP: '주문 자원', FT: '피로도', AT: '물리 공격', DF: '물리 방어', AD: '화살 방어', MD: '마법 방어', AA: '화살 회피', HR: '체력 회복', SP: '이동 속도', AR: '공격 효율', DR: '방어 효율' };   // 능력치 설명 — 장수 상세에서 실수치 칸 안에 한 줄로 보여 준다
const STAT_NOTE = 'FT 높을수록 전투 효율 감소 · HR 정지 중 회복 · AR·DR 은 효율 배율(%)';
const namedRosterUnit = key => { const u = Sim.U[key]; return u && !u.generic && !u.name.startsWith('적 '); };
const combatReadyCorps = corps => !!corps && namedRosterUnit(corps.units[0]);
const corpsName = corps => corps.units[0] ? Sim.U[corps.units[0]].name + ' 군단' : corps.name;
function rosterError() {
  const unique = new Set();
  for (const force of enemyForces.filter(f => f.active)) for (const key of force.army.units) if (namedRosterUnit(key)) {
    const name = Sim.U[key].name; if (unique.has(name)) return `${name}은 고유 장수라 한 명만 존재할 수 있습니다.`; unique.add(name);
  }
  for (let army = 0; army < roster.length; army++) {
    for (const key of roster[army].units) if (namedRosterUnit(key)) { const name = Sim.U[key].name; if (unique.has(name)) return `${name}은 고유 장수라 한 명만 편성할 수 있습니다.`; unique.add(name); }
    if (!namedRosterUnit(roster[army].units[0])) return `${corpsName(roster[army])}의 첫 칸에는 이름 있는 군단장이 필요합니다.`;
  }
  return '';
}
resetCampaignData('여포');   // 모듈 시작 때 한 번 편성해 두고(시험·타이틀 화면용), 새 게임은 다시 편성한다
{ const error = rosterError(); if (error) throw new Error(error); }
function rosterArmies() {
  const active = roster[campaign.corps] || roster[0];
  const squadData = (corps, start) => {
    const units = [], growth = [], rosterSlots = [];
    for (let slot = start; slot < start + 6; slot++) if (corps.units[slot]) { units.push(corps.units[slot]); growth.push(corps.growth[slot]); rosterSlots.push(slot); }
    return { units, growth, rosterSlots };
  };
  let i = 0;
  const armies = Sim.ARMIES.filter(a => a.team === 'player').map(a => {
    const start = i++ * 6, data = squadData(active, start);
    return { ...a, ...data, name: i + '분대', leader: start === 0 ? active.units[0] : null, detachment: start > 0, corps: active.id, squadIndex: i - 1 };
  });
  roster.forEach((corps, corpsIndex) => {
    const battle = campaign.battle;
    if (corps === active || !combatReadyCorps(corps) || battle && corps.at !== battle.id && !battle.links.includes(corps.at)) return;
    for (let start = 0; start < 18; start += 6) {
      const data = squadData(corps, start);
      armies.push({ team: 'player', name: `${corpsName(corps)} ${start / 6 + 1}분대`, leader: start === 0 ? corps.units[0] : null, detachment: start > 0, ...data, at: [5, 18 + corpsIndex * 2], corps: corps.id, squadIndex: start / 6, support: true });
    }
  });
  return armies;
}
// 동맹 세력과 같은 도시의 전투 (명세 33): 도시에 주둔한 동맹 군단(손님)은 전투 전에 동맹을 도울지 이전 도시로 퇴각할지 정한다.
// 플레이어의 동맹 군단은 플레이어가 고르고(A·B), 플레이어와 동맹이 아니면서 적 세력의 동맹인 군단은 AI 가 전투력 비교로 고른다(C).
const forceFaction = f => f.fac || (stageById(f.home) || stageById(f.at)).faction;   // fac: 도시 소속이 바뀌기 전에 고정해 둔 군단 소속
const rulerKey = faction => campaign.rulers && Object.hasOwn(campaign.rulers, faction) ? campaign.rulers[faction] : INITIAL_RULERS[faction], rulerName = faction => Sim.U[rulerKey(faction)]?.name || '공석';
const heirPresent = (faction, key) => faction === playerFaction() ? roster.some(c => c.units.includes(key)) : enemyForces.some(f => forceFaction(f) === faction && f.army.units.includes(key));
function resolveSuccession(deadKeys, reason = '전사') {   // 군주 전사 시 연의 혈연 후계자가 세력 군주를 계승한다
  campaign.rulers ||= { ...INITIAL_RULERS };
  for (const faction of FACTIONS) {
    const old = rulerKey(faction); if (!deadKeys.has(old)) continue;
    const next = (SUCCESSORS[old] || []).find(key => !deadKeys.has(key) && heirPresent(faction, key));
    if (!next) { campaign.rulers[faction] = null; showDiplomacyResult(`${faction}군 후계자 부재`, [`군주 ${Sim.U[old]?.name || old}이(가) ${reason}했습니다.`, '생존한 혈연 후계자를 찾지 못했습니다.'], false, '군주 승계'); continue; }
    campaign.rulers[faction] = next;
    if (faction !== playerFaction()) {
      const force = enemyForces.find(f => forceFaction(f) === faction && f.army.units.includes(next));
      if (force) { force.army.leader = next; force.active = true; setEnemyRole(force, stageById(force.home) || stageById(force.at), force.role || 'garrison', force.level); }
    }
    showDiplomacyResult(`${faction}군 군주 승계`, [`${Sim.U[old].name}이(가) ${reason}했습니다.`, `연의 혈연 관계에 따라 ${Sim.U[next].name}이(가) 새 군주가 되었습니다.`], true, '군주 승계');
  }
}
const pairKey = (a, b) => [a, b].sort().join('|');
const aiRel = (a, b) => (campaign.aiRelations && campaign.aiRelations[pairKey(a, b)]) || { status: 'neutral', truceUntil: 0 };
const alliedFactions = (a, b) => a !== b && (FACTION_ALLIES[a] === b || FACTION_ALLIES[b] === a || aiRel(a, b).status === 'ally');
function guestInfo(stage) {
  const forces = allForces().filter(f => f.active && f.at === stage.id), hostile = new Set(forces.filter(f => relationOf(forceFaction(f)).status === 'war').map(forceFaction));
  if (stage.owner === 'enemy' && stage.faction && relationOf(stage.faction).status === 'war') hostile.add(stage.faction);
  const allies = hostile.size || campaign.invasion ? forces.filter(f => relationOf(forceFaction(f)).status === 'ally') : [];
  const aiGuests = hostile.size ? forces.filter(f => { const gf = forceFaction(f), st = relationOf(gf).status; return st !== 'war' && st !== 'ally' && [...hostile].some(h => alliedFactions(gf, h)); }) : [];
  return { allies, aiGuests, hostile };
}
function retreatForce(f, stage) {
  if (f.role === 'garrison') return null;   // 손님 군단이 이전 도시로 물러난다
  const back = f.prevAt && stageById(f.prevAt) && f.prevAt !== stage.id ? f.prevAt : (stage.links.find(id => stageById(id).owner !== 'player') || stage.links[0]);
  if (back) f.at = back; return back;
}
function resolveAiGuests(stage) {   // C: AI 동맹 군단이 전투력 비교로 돕거나 퇴각한다 — 동맹을 돕는 군단 id 와 안내 문구
  const g2 = guestInfo(stage), join = [], notes = []; if (!g2.aiGuests.length) return { join, notes };
  const playerPow = Math.max(1, corpsPow(roster[campaign.corps])), by = {};
  for (const f of g2.aiGuests) (by[forceFaction(f)] ||= []).push(f);
  for (const [fac, fs] of Object.entries(by)) {
    const pow = fs.reduce((n, f) => n + forcePow(f), 0);
    if (pow >= playerPow * aiP().defend) { join.push(...fs.map(f => f.id)); notes.push(`${fac}군 동맹군이 ${stage.name} 방어에 참전했습니다. (⚔${pow} ≥ 내 군단 ⚔${playerPow}×${aiP().defend})`); }
    else { const back = fs.map(f => retreatForce(f, stage))[0]; notes.push(`${fac}군 동맹군이 전력 부족(⚔${pow} < ⚔${playerPow}×${aiP().defend})으로 ${back ? stageById(back).name + '(으)로 ' : ''}퇴각했습니다.`); }
  }
  return { join, notes };
}
const ENEMY_SCALE_BY = { '여포': 0.48, '원소': 0.5, '조조': 0.7, '유비': 0.55 }, ENEMY_SCALE_DEFAULT = 0.7, enemyScale = () => ENEMY_SCALE_BY[playerFaction()] ?? ENEMY_SCALE_DEFAULT;   // 플레이어 세력별 적 편성 배율 (설계 추정, tools/campaign-balance.js 로 측정)
//   // 적군 편성 수량 배율 (명세 60 2단계, 허용 ±30%): 전투 생성 때만 일반 병사를 뒤에서부터 덜어낸다. 이름 있는 장수·AI 전투력 판단·저장은 그대로
const benched = new Map();   // 전투에서 덜어낸 도시수비 병사 (forceId → {units, growth}) — 전투 뒤 수비군 명부에 되돌린다
function scaleEnemy(a) {
  const scale = enemyScale(); if (a.team !== 'enemy' || scale >= 1) return a;
  let left = Math.ceil(a.units.length * scale); const keep = a.units.map(k => namedRosterUnit(k) || left-- > 0);
  if (a.cityGuard) benched.set(a.forceId, { units: a.units.filter((_, i) => !keep[i]), growth: a.growth ? a.growth.filter((_, i) => !keep[i]) : [] });
  return { ...a, units: a.units.filter((_, i) => keep[i]), growth: a.growth && a.growth.filter((_, i) => keep[i]), rosterSlots: a.rosterSlots && a.rosterSlots.filter((_, i) => keep[i]) };
}
function stageArmies(stage, helpIds = [], joinIds = []) {
  const enemies = enemyForces.filter(f => f.active && f.at === stage.id && (relationOf(forceFaction(f)).status === 'war' || joinIds.includes(f.id))).map((f, k) => ({ ...f.army, at: [45, 18 + 7 * (k % 3)], reserve: k > 0, reserveAt: 12, units: [...f.army.units], forceId: f.id }));   // 적 능력치는 동일 기준, 난이도는 수량·레벨·AI로 조정
  const helpers = enemyForces.filter(f => f.active && f.at === stage.id && helpIds.includes(f.id)).map((f, k) => ({ ...f.army, units: [...f.army.units], team: 'player', ally: true, corps: 'ally:' + f.id, forceId: undefined, name: `${forceFaction(f)}군 동맹군`, at: [9, 10 + k * 6], reserve: false, trig: null, support: false, commander: false, squadIndex: undefined }));
  const owner = stageFaction(stage), team = owner === playerFaction() || relationOf(owner).status === 'ally' ? 'player' : 'enemy';
  const guards = (team === 'player' || relationOf(owner).status === 'war' ? guardsAt(stage) : []).map((f, i) => ({ ...f.army, team, units: [...f.army.units], rosterSlots: f.army.units.map((_, j) => j), forceId: f.id, corps: f.id, cityGuard: true, ownedGuard: owner === playerFaction(), ally: team === 'player', at: team === 'player' ? [9, 10 + i * 6] : [45, 18 + i * 6], reserve: team === 'enemy' && i > 0, reserveAt: 12, trig: { near: 12, t: 0 } }));
  return rosterArmies().concat(guards, enemies, helpers).map(scaleEnemy);
}
let selTarget = null;   // 선택 단계에서 정보를 보고 있는 적 (확정하면 군단이 그 적을 집중 공격)
let selectMode = false;   // 캐릭터 선택 단계: 전투가 멈추고 능력치 창이 뜬다 (확정하면 재개)
let tutorialStep = -1, tutorialSeen = false;
try { tutorialSeen = localStorage.getItem('sgsp-tutorial') === '1'; } catch (e) { /* 저장소를 못 쓰면 매번 안내 */ }
let stratTutStep = -1, stratTutSeen = false;   // 전략 화면 튜토리얼 (drawStratTutorial)
try { stratTutSeen = localStorage.getItem('sgsp-strat-tutorial') === '1'; } catch (e) { /* 저장소를 못 쓰면 새 게임마다 안내 */ }
let armyIdx = 0, tblAbility = false, tblCompact = false, speedIdx = 0, padVisible = false;
let cam = { x: 0, y: 0 }, mouse = { x: 0, y: 0, in: false }, btns = [], marks = [], lastPortrait = { id: 0, t: 0 }, keys = {}, dirStack = [], padPtrs = new Map(), padDir = null, stick = null;   // stick: 모바일 가상 조이스틱 {id, ox, oy, kx, ky}
// 표시 옵션: 버프·효과는 상시 숨김, 나머지는 시스템 메뉴에서 바꾸고 브라우저에 기억한다.
const SHOW = { dmg: true, buff: false, pauseSel: true, status: true };   // status: 모바일 조작 장수 정보 표시
try { Object.assign(SHOW, JSON.parse(localStorage.getItem('sgsp-show') || '{}')); } catch (e) { /* 저장소를 못 쓰면 기본값 */ } SHOW.buff = false;
const saveShow = () => { try { localStorage.setItem('sgsp-show', JSON.stringify(SHOW)); } catch (e) { /* 무시 */ } };
// 카메라 거리(줌): PC·모바일 기본 ×1.3. 상단 버튼·[ ] 키로 조절하고 모드별로 기억한다
const ZOOMS = [[1, '멀리'], [1.3, '기본'], [1.67, '가까이'], [2, '더 가까이'], [2.5, '아주 가까이'], [3, '원작']];
let zoomIdx = 1;
const Z = () => ZOOMS[zoomIdx][0];
function loadZoom(on) { zoomIdx = 1; try { const z = localStorage.getItem('sgsp-zoom3-' + (on ? 'mobile' : 'pc')); if (z !== null && +z >= 0 && +z < ZOOMS.length) zoomIdx = +z; } catch (e) { /* 무시 */ } }
function setZoom(i) { zoomIdx = Math.max(0, Math.min(ZOOMS.length - 1, i)); try { localStorage.setItem('sgsp-zoom3-' + (mobile ? 'mobile' : 'pc'), zoomIdx); } catch (e) { /* 무시 */ } if (S) clampCam(); }
loadZoom(false);
let worldDraw = false, wz = 1;   // 월드를 그리는 동안의 줌 — 글자 크기를 화면 기준으로 유지하려고 label 이 나눈다
let vh = 0, tblH = 0;   // 레이아웃: 맵 높이 / 하단 표 높이

function layout() { tblH = mobile ? 0 : tblCompact ? 54 : 236; vh = VH - TB_H - tblH; }
function setMobile(on) {   // 모바일: 상단 큰 버튼 줄, 좌측 상세 상태창, 글자 확대
  mobile = on; loadZoom(on); TB_H = on ? 0 : 58; LEFT_W = on ? 0 : 150; VPW = VW - LEFT_W; FS = on ? 1.3 : 1; padPtrs.clear(); stick = null; padDir = null; layout(); if (S) snapCam();
}
function startBattle(stage, explore = false) {
  repSide = 'player'; repPage = 0;
  if (!combatReadyCorps(roster[campaign.corps])) { state = 'map'; campaign.battle = null; campaign.notice = '군단 편성에서 1번 칸에 이름 있는 군단장을 배치해야 출전할 수 있습니다.'; saveCampaign(); return false; }
  const st0 = stage || campaign.battle, gi = st0 && guestInfo(st0), hostIds = campaign.invasion && st0 && st0.owner === 'enemy' && relationOf(st0.faction).status === 'ally' ? gi.allies.filter(f => forceFaction(f) === st0.faction).map(f => f.id) : [];
  if (!explore && !allyHelpIds) { const guests = gi ? gi.allies.filter(f => !hostIds.includes(f.id)) : []; if (guests.length) { allyChoice = { stage: st0, explore, ids: guests.map(f => f.id) }; return false; } }   // 동맹 도시의 주둔군은 자동 방어하고, 다른 동맹 원군만 돕기·퇴각을 고른다
  campaign.battle = st0;
  campaign.explore = explore;
  const helpIds = [...new Set(hostIds.concat(allyHelpIds || []))]; allyHelpIds = null; lastHelpIds = helpIds;
  const aiGuest = explore ? { join: [], notes: [] } : resolveAiGuests(campaign.battle);
  const armies = stageArmies(campaign.battle, helpIds, aiGuest.join).filter(a => !explore || a.team === 'player');
  const emptySlots = roster.reduce((n, c) => n + c.units.filter((x, i) => !x && i > 0).length, 0);
  Sim.AIDEF.tactics = aiP().tactics; Sim.AIDEF.retreat = aiP().retreat;   // 난이도 프로필의 전투 AI 단계·후퇴 확률 배율
  S = Sim.createBattle((Date.now() % 100000) + 1, { armies, mapSeed: campaign.battle ? campaign.battle.mapSeed : 7, theme: campaign.battle ? campaign.battle.theme : 'plains', wideRiver: !!(campaign.battle && campaign.battle.wideRiver), routChance: campaign.battle ? ROUT_CHANCE[campaign.battle.difficulty] : 0.065, explore, attackingTeam: campaign.invasion ? 'enemy' : 'player', surrenderSlots: emptySlots + (roster.length < ROSTER_MAX ? 17 : 0) }); terrain = buildTerrain(S.map, Sim.MW, Sim.MH, TILE);
  for (const A of S.armies.filter(A => A.ally)) { A.order = 'charge'; for (const u of A.units) { u.order = { type: 'charge' }; u.autoCharge = false; } }   // 동맹 AI 군단은 돌격 상태로 싸운다 (조작 불가)
  for (const n of aiGuest.notes) S.events.push({ type: 'notice', team: 'enemy', text: n });
  if (helpIds.length) S.events.push({ type: 'notice', team: 'player', text: `동맹군 ${helpIds.length}군단이 함께 싸웁니다.` });
  if (campaign.battle) S.events.push({ type: 'notice', team: 'enemy', text: campaign.invasion ? `적 군단이 ${campaign.battle.name}을 침공했습니다!` : `${campaign.battle.stage}지역 ${campaign.battle.name} · ${campaign.battle.difficulty} · ${campaign.battle.note}` + ` · 전투력 아군 ⚔${S.armies.filter(A => A.team === "player" && !A.support).reduce((n, A) => n + Sim.battlePower(A), 0)} / 적 ⚔${S.armies.filter(A => A.team === "enemy").reduce((n, A) => n + Sim.battlePower(A), 0)}` });
  state = 'play'; overAt = 0; paused = false; menuOpen = false; supportOpen = false; selectMode = false; selTarget = null; tutorialStep = tutorialSeen ? -1 : 0; armyIdx = 0; marks = []; speedIdx = 0; dirStack = []; padPtrs.clear(); stick = null; padDir = null;
  layout(); snapCam(); saveCampaign();
  return true;
}
function startCampaign() {
  state = 'map'; S = null; campaign.battle = null; moveSelectOpen = false; exploreSelectOpen = false; diplomacyView = null; heroView = null; moveMode = 'corps'; centerMap(); campaign.notice = campaign.completed ? '전 도시 점령 승리 기록입니다.' : '이동 버튼에서 군단과 이동할 도시를 선택하세요.';
}
function resetTransientUi() {
  stratTutStep = -1; custodyView = false; custodyPage = 0; turnSummary = null; pendingSummary = null; inTurnFlow = false;   // 남아 있던 팝업·선택 상태가 새 게임·불러오기 뒤 입력을 막지 않게 한다
  allyChoice = null; allyHelpIds = null; lastHelpIds = []; warnMove = null; diplomacyResult = null; diplomacyQueue = []; diplomacyView = null; scoutView = null; econView = false; heroView = null; mapTool = null; moveSelectOpen = false; exploreSelectOpen = false; moveMode = 'corps'; saveSlotMode = null; startFactionSelect = false; popupSink = null; aiEntries = null; rosterPick = null; selectMode = false; selTarget = null; menuOpen = false;
}
function startNewGame(faction) { resetCampaignData(faction); campaign.difficulty = startDifficulty; resetTransientUi(); titleNotice = ''; startCampaign(); saveCampaign(); }
function startNewFromTitle() { activeSaveSlot = Array.from({ length: SAVE_SLOTS }, (_, i) => i + 1).find(slot => !hasCampaign(slot)) || activeSaveSlot; startFactionSelect = true; titleNotice = ''; }
function loadGame(slot = activeSaveSlot) {
  const data = readCampaign(slot); if (!restoreCampaign(data)) { const msg = staleSave(slot) ? `${slot}번 슬롯은 이전 시나리오 저장이라 불러올 수 없습니다. 새 게임으로 시작하세요.` : `${slot}번 슬롯에 불러올 데이터가 없습니다.`; if (state === 'title') titleNotice = msg; else campaign.notice = msg; return false; }
  activeSaveSlot = slot; titleNotice = '';
  Object.assign(campaign, { battle: null, pendingEncounter: null, movement: [], movementPage: 0, invasion: false, explore: false, from: null, responsePage: 0 });   // 옛 자동 저장이 교전 중 상태를 담고 있어도 전략 화면으로 불러온다
  resetTransientUi();
  startCampaign(); campaign.notice = `${campaign.turn}턴 원정을 불러왔습니다.`; campaign.at = roster[campaign.corps] ? roster[campaign.corps].at : campaign.at;
  return true;
}
// 전투력: 장수·병사 능력치를 환산해(Sim.unitPower) 군단별로 합산한다.
const corpsPow = corps => Sim.corpsPower(corps.units, 'player', corps.growth);
const forcePow = force => Sim.corpsPower(force.army.units, 'enemy', force.army.growth);
const enemyPowerAt = stage => allForces().filter(f => f.active && f.at === stage.id && forceFaction(f) !== playerFaction()).reduce((n, f) => n + forcePow(f), 0);
const enemyRolesAt = stage => { const n = guardsAt(stage).reduce((sum, f) => sum + f.army.units.length, 0), spec = { ...CITY_SIZES[citySize(stage)], units: guardCap(stage) }, mobile = enemyForces.filter(f => f.active && f.at === stage.id).length + roster.filter(c => c.at === stage.id && c.units.some(Boolean)).length; return `${spec.name} · 수비 ${n}/${spec.units}명 Lv${spec.level} · 기동 ${mobile}`; };
// 어떤 도시에 개입할 수 있는 아군 군단(같은 도시 또는 연결된 도시)의 전투력 합 — 침공 대응 규칙과 같은 범위
const playerPowerNear = stage => roster.filter(c => combatReadyCorps(c) && (c.at === stage.id || stage.links.includes(c.at))).reduce((n, c) => n + corpsPow(c), 0) + (stage.owner === "player" || isAllyCity(stage) ? guardsAt(stage).reduce((n, f) => n + forcePow(f), 0) : 0);
const AI_PROFILES = {   // AI 난이도 프로필 (명세 36 AI-S-07). 보통 = 기존 코드값. 쉬움·어려움은 설계 추정(측정 전)
  easy: { name: '쉬움', attack: 1.5, defend: 1.0, retreat: 0.1, expedition: 7, tactics: 0 },
  normal: { name: '보통', attack: 1.2, defend: 0.8, retreat: 0.1, expedition: 5, tactics: 1 },
  hard: { name: '어려움', attack: 1.0, defend: 0.6, retreat: 0.05, expedition: 4, tactics: 2 },
};
const aiP = () => AI_PROFILES[campaign.difficulty] || AI_PROFILES.normal;
const AI_ATTACK_RATIO = 1.2;   // 침공: 집결한 적 전투력이 상대 대응 전투력의 1.2배 이상일 때만
const AI_DEFEND_RATIO = 0.8;   // 방어: 아군이 닿을 수 있는 위협 전투력이 자기 도시 전투력의 0.8배 이상이면 자리를 지킨다
// 적 군단 한 부대의 행동 결정: 진군(advance) 또는 대기(hold). 판단 근거를 함께 돌려준다.
const breaksPeace = s => !!s && s.owner === 'enemy' && !!s.faction && ['neutral', 'truce'].includes(relationOf(s.faction).status);   // 군단이 들어서면 전쟁이 되는 도시 (중립·휴전 세력)
const peaceName = faction => relationOf(faction).status === 'truce' ? '휴전' : '중립';
// 동맹 세력의 도시: 그 안에서 이겨도(방어든, 침공한 적을 몰아내려고 들어가서 싸웠든) 점령하지 않고 동맹 세력의 도시로 남는다 (v0.1.185: 이전엔 적이 쳐들어온 경우(invasion)에만 적용돼 내가 먼저 들어가 싸운 경우 아군 도시로 바뀜)
const eulReul = name => { const ch = String(name).charCodeAt(String(name).length - 1) - 0xAC00; return name + (ch >= 0 && ch < 11172 && ch % 28 ? '을' : '를'); };   // 받침에 따라 을/를
function enemyTakesCity(stage) {   // 아군 도시가 적에게 넘어가면 그 도시에 있는 전쟁 상대 군단의 세력 소유가 된다 (예전엔 원래 세력 소유로 남았음)
  if (!stage || stage.owner !== 'player') return;
  const f = enemyForces.find(x => x.active && x.at === stage.id && relationOf(forceFaction(x)).status === 'war');
  if (f) { for (const x of enemyForces) if (!x.fac) x.fac = forceFaction(x); stage.faction = forceFaction(f); captureAffinity(stage.faction, playerFaction(), stage, stage.id === playerCapital()); }
  stage.owner = 'enemy'; resetCityGuards(stage, captureRatio(stage)); relocateCapitals();
}
const isAllyCity = s => !!s && s.owner === 'enemy' && !!s.faction && relationOf(s.faction).status === 'ally';
const hostsPlayer = s => !!s && s.owner === 'enemy' && s.faction && relationOf(s.faction).status === 'ally' && roster.some(c => c.units.some(Boolean) && c.at === s.id);   // 아군 군단이 주둔한 동맹 도시
function aiPassable(faction, s) {   // 이동 중 지나갈 수 있는 도시: 자국·동맹·전쟁 상대의 도시 (중립·휴전 세력의 도시는 지나가지 않는다)
  if (s.owner === 'player') return relationOf(faction).status === 'war';
  if (!s.faction || s.faction === faction || alliedFactions(faction, s.faction)) return true;
  return aiRel(faction, s.faction).status === 'war' && !factionDead(s.faction);
}
function routeVia(from, to, ok) {   // 중간 도시가 ok 를 만족하는 경로만 (도착 도시는 검사하지 않음)
  const q = [[from]], seen = new Set([from]);
  while (q.length) { const path = q.shift(), id = path[path.length - 1]; if (id === to) return path; for (const n of stageById(id).links) if (!seen.has(n) && (n === to || ok(stageById(n)))) { seen.add(n); q.push(path.concat(n)); } }
  return [];
}
// 명세 63c 목표 도시 점수화: 플레이어와 전쟁 중인 세력은 수도 직행 대신 세력당 턴 1회 점수가 높은 플레이어 도시를 목표로 삼는다 (AI 끼리 목표는 그대로).
// score = value ÷ (1 + def ÷ max(집결지 전력, 1)) − 거리×distPenalty. 수도는 최고 점수와의 차가 |최고|×capBias 이하면 우선, 이전 목표는 새 후보가 |이전|×(keep−1) 이상 앞설 때만 교체. 끄는 값 on:false (= 수도 직행)
const AI_GOAL = { on: false, distPenalty: 0.25, capBias: 0.15, keep: 1.25 };   // 꺼 둠: 유비 첫 접촉 개선 없음·도시 변화 없는 판 증가 (켜는 값 on:true, 명세 63 구현 결과)
const aiGoal = {};   // 세력 → { turn, sig, id, score } 메모리 캐시 (저장하지 않음 — 불러온 뒤 첫 턴에 다시 계산)
const aiCityValue = st => ({ small: 1, medium: 1.5, large: 2 }[citySize(st)]) * (['barracks', 'granary'].includes(CITY_KIND[st.id]) ? 1.3 : 1) * (st.id === playerCapital() ? 2 : 1);
function aiChooseGoal(scored, cap, prevId) {   // scored: [{id, score}] → 최고 점수 · 수도 우선(capBias) · 이전 목표 유지(keep). 순수 함수 (시험용)
  let pick = scored.reduce((a, b) => b.score > a.score ? b : a);
  const capRow = scored.find(x => x.id === cap); if (capRow && (AI_GOAL.capBias >= 1 || capRow.score >= pick.score - Math.abs(pick.score) * AI_GOAL.capBias)) pick = capRow;
  const prev = prevId && scored.find(x => x.id === prevId);
  return prev && pick.score <= prev.score + Math.abs(prev.score) * (AI_GOAL.keep - 1) ? prev : pick;
}
function aiPlayerGoal(faction) {
  const sig = playerCapital() + '|' + playerFaction() + '|' + aiSeed, cache = aiGoal[faction];
  if (cache && cache.turn === campaign.turn && cache.sig === sig && stageById(cache.id).owner === 'player') return cache.id;
  const cap = playerCapital(), pows = {};
  for (const f of enemyForces) if (f.active && f.role !== 'garrison' && forceFaction(f) === faction) pows[f.at] = (pows[f.at] || 0) + forcePow(f);
  const ids = Object.keys(pows).sort((a, b) => pows[b] - pows[a] || routeVia(a, cap, () => true).length - routeVia(b, cap, () => true).length);
  if (!ids.length) return cap;
  const staging = ids[0], own = Math.max(pows[staging], 1), scored = [];
  for (const st of STAGES) {
    if (st.owner !== 'player') continue;
    const path = routeVia(staging, st.id, x => aiPassable(faction, x)); if (path.length < 2) continue;
    scored.push({ id: st.id, score: aiCityValue(st) / (1 + playerPowerNear(st) / own) - (path.length - 1) * AI_GOAL.distPenalty });
  }
  if (!scored.length) return cap;
  const pick = aiChooseGoal(scored, cap, cache && cache.turn === campaign.turn - 1 && cache.sig === sig ? cache.id : null);
  aiGoal[faction] = { turn: campaign.turn, sig, id: pick.id, score: pick.score };
  return pick.id;
}
// 명세 67 후속: 목표 선정에서 플레이어 도시까지 경로 길이를 hops 만큼 짧게 쳐 준다 (AI 끼리 먼저 싸우다 플레이어와 접촉이 늦어지는 것 방지). 끄는 값 on:false (= 가장 가까운 상대, 같으면 플레이어)
const AI_PLAYER_BIAS = { on: false, hops: 1 };
function aiPickTarget(faction, here) {   // 이 세력이 전쟁 중인 상대의 도시 중 지나갈 수 있는 가장 가까운 곳 (같으면 플레이어 우선)
  const goals = [];
  if (relationOf(faction).status === 'war') goals.push({ id: AI_GOAL.on ? aiPlayerGoal(faction) : playerCapital(), kind: 'player' });
  for (const other of aiFactions()) if (other !== faction && !factionDead(other) && !alliedFactions(faction, other) && aiRel(faction, other).status === 'war') for (const s of factionStages(other)) goals.push({ id: s.id, kind: 'ai' });
  let best = null;
  for (const goal of goals) { const path = routeVia(here.id, goal.id, s => aiPassable(faction, s)), eff = path.length - (AI_PLAYER_BIAS.on && goal.kind === 'player' ? AI_PLAYER_BIAS.hops : 0); if (path.length > 1 && (!best || eff < best.eff || eff === best.eff && goal.kind === 'player')) best = { path, kind: goal.kind, eff }; }
  return best;
}
function aiPressure(key, ratio) {   // 같은 목표 앞에서 집결만 하며 교착한 턴 수가 늘면 요구 전력비를 낮춘다 (턴당 -0.08, 최저 ×0.7) — 호각인 두 수도가 영원히 마주 보는 교착 방지
  const st = campaign.aiStall || (campaign.aiStall = {}), e = st[key];
  if (!e || e.last < campaign.turn - 1) st[key] = { since: campaign.turn, last: campaign.turn }; else e.last = campaign.turn;
  return ratio * Math.max(0.7, 1 - 0.08 * (campaign.turn - st[key].since));
}
const AI_EASE_STEP = 0.12, AI_MIN_RATIO = 0.5;   // 방어·집결로 기다린 턴마다 요구 전력비 -12%, 단 공격 전력비는 0.5 미만으로 내려가지 않는다 (자살 공세 방지, 명세 44)
const aiEase = force => Math.min(1, Math.max(AI_MIN_RATIO / aiP().attack, 1 - AI_EASE_STEP * (force.wait || 0)));   // 기다린 턴 수에 따라 1 → 하한
// 명세 63b 호감도 연동 침공비: 플레이어 대상 침공 ratio 에 clamp(1 + k×호감도, lo, hi) 를 곱한다 (숙적 ×0.75 까지 더 공격적, 우호 ×1.15 까지 신중). AI_MIN_RATIO 하한에도 같은 계수가 곱해진다. 끄는 값 k:0
// 명세 63d 세력 성향(원작 근거 없는 설계값): 플레이어 대상 침공 ratio 에 attack 을 곱하고(하한도 함께 낮아짐/높아짐), 전선 군단 증원 주기에 reinforce 를 곱한다. 끄는 값 전부 1
const AI_STYLE = { '여포': { attack: 0.8, reinforce: 1 }, '조조': { attack: 1, reinforce: 1 }, '원소': { attack: 1, reinforce: 1 }, '유비': { attack: 1, reinforce: 1 } };   // 켬: 여포만 0.80 (유비 시작 첫 접촉 8/12→12/12). 원소 1.1/0.8·유비 1.05 는 조조 시작 첫 접촉을 늦춰 1.0 으로, 설계값 여포 0.90 은 부족해 0.80, 0.85 는 수도 분포 묶음 38% 로 탈락 (명세 63 구현 결과)
const aiStyle = faction => AI_STYLE[faction] || { attack: 1, reinforce: 1 };
const AI_AFF = { k: 0, lo: 0.75, hi: 1.15 };   // 측정 결과 효과 없음 → 꺼 둠 (켜는 값 k:0.004, 명세 63 구현 결과)
const aiAffF = faction => Math.min(AI_AFF.hi, Math.max(AI_AFF.lo, 1 + AI_AFF.k * affinityOf(playerFaction(), faction)));
// 명세 63e 인접 합산 집결: 플레이어 대상 침공 판단의 own 에 인접 도시의 같은 세력 기동 군단 전력 × adjW (가장 강한 maxAdj 개 도시)를 더한다.
// 합산만으로 통과하면 진군하지 않고(자살 공세 방지) 그 군단들을 이 도시로 불러 모은다(advanceEnemyForces 가 같은 턴에 이동시킴) → 다음 턴 own 이 실제 합이 되어 정상 판정. 끄는 값 on:false
const AI_MASS = { on: false, adjW: 0.6, maxAdj: 3 };   // 꺼 둠: TURTLE 변화 없음·수도 분포 소폭 악화 (켜는 값 on:true, 명세 63 구현 결과 63e)
function aiAdjMass(force, here, faction, next) {
  if (here.owner !== 'enemy' || here.faction !== faction) return null;
  const cities = here.links.filter(id => id !== next.id).map(id => { const fs = enemyForces.filter(f => f.active && f !== force && f.at === id && forceFaction(f) === faction && f.role !== 'garrison' && !(f.rest > 0) && !aiEngaged(f)); return { fs, pow: fs.reduce((n, f) => n + forcePow(f), 0) }; }).filter(c => c.pow > 0).sort((a, b) => b.pow - a.pow).slice(0, AI_MASS.maxAdj);
  return cities.length ? { pow: Math.round(AI_MASS.adjW * cities.reduce((n, c) => n + c.pow, 0)), forces: cities.flatMap(c => c.fs) } : null;
}
function enemyDecision(force) {
  if (force.role === 'garrison') force.at = force.home;
  const here = stageById(force.at), own = enemyForces.filter(f => f.active && f.at === here.id && forceFaction(f) === forceFaction(force) && f.role !== 'garrison').reduce((n, f) => n + forcePow(f), 0), threat = playerPowerNear(here), mine = forcePow(force), faction = forceFaction(force), relation = relationOf(faction), base = { own, threat, mine, from: here.id, to: null };
  if (factionDead(faction)) return { ...base, act: 'hold', mode: '멸망', reason: '세력 소멸' };
  if (force.role === 'garrison') return { ...base, act: 'hold', mode: '수비', reason: '도시 방어 전담' };
  if ((force.rest || 0) > 0) return { ...base, act: 'hold', mode: '휴식', reason: `패전 후 ${force.rest}턴 재정비` };
  const tgt = aiPickTarget(faction, here);
  if (!tgt) { const w = relation.status === 'neutral' ? '중립' : relation.status === 'ally' ? '동맹' : relation.status === 'truce' ? '휴전' : '대기'; return { ...base, act: 'hold', mode: w, reason: relation.status === 'war' ? '갈 수 있는 전쟁 상대 도시 없음' : '전쟁 상대 없음 · 도시 수비만 수행' }; }
  const next = stageById(tgt.path[1]); base.to = next.id;
  if (tgt.kind === 'player' && threat > 0 && threat >= (own + guardsAt(here).filter(f => forceFaction(f) === faction).reduce((n, f) => n + forcePow(f), 0)) * aiP().defend / aiEase(force)) return { ...base, act: 'hold', mode: '방어', reason: `아군 위협 ${threat} ≥ 주둔 ${own}×${(aiP().defend / aiEase(force)).toFixed(2)}` };
  if (next.owner === 'player' || hostsPlayer(next)) {
    const def = playerPowerNear(next), affF = aiAffF(faction), ratio = aiP().attack * aiEase(force) * (grainOf(faction) < ECON.hungry ? 1.2 : 1) * affF * aiStyle(faction).attack, aff = affF === 1 ? '' : ' 호감도 ×' + affF.toFixed(2);
    if (def === 0) return { ...base, act: 'advance', mode: '침공', def, reason: '무방비 지역' };
    if (own >= def * ratio) return { ...base, act: 'advance', mode: '침공', def, reason: `집결 ${own} ≥ 대응 ${def}×${ratio.toFixed(2)}${aff}` };
    const adj = AI_MASS.on && aiAdjMass(force, here, faction, next);
    if (adj && own + adj.pow >= def * ratio) return { ...base, act: 'hold', mode: '집결', def, pull: adj.forces, reason: `집결 ${own}+인접 ${adj.pow} ≥ 대응 ${def}×${ratio.toFixed(2)}${aff} · 합류 요청` };
    return { ...base, act: 'hold', mode: '집결', def, reason: `집결 ${own} < 대응 ${def}×${ratio.toFixed(2)}${aff}` };
  }
  if (next.owner === 'enemy' && next.faction && next.faction !== faction && !alliedFactions(faction, next.faction)) {   // 전쟁 상대(AI)의 도시
    const key = next.id + '|' + pairKey(faction, next.faction), last = campaign.aiLast && campaign.aiLast[key];
    if (last != null && campaign.turn - last <= 3) return { ...base, act: 'hold', mode: '재정비', reason: `최근 ${campaign.turn - last}턴 전 같은 도시 교전` };
    const def = allForces().filter(f => f.active && f.at === next.id && forceFaction(f) === next.faction).reduce((n, f) => n + forcePow(f), 0), ratio = Math.min(aiPressure(key, aiP().attack), aiP().attack * aiEase(force));
    if (def === 0 || own >= def * ratio) return { ...base, act: 'advance', mode: '침공', def, reason: def ? `집결 ${own} ≥ 수비 ${def}×${ratio.toFixed(2)}` : '무방비 도시' };
    return { ...base, act: 'hold', mode: '집결', def, reason: `집결 ${own} < 수비 ${def}×${ratio.toFixed(2)}` };
  }
  return { ...base, act: 'advance', mode: '진군', reason: '자국·동맹 영토 이동' };
}function route(from, to) {
  const q = [[from]], seen = new Set([from]);
  while (q.length) { const path = q.shift(), id = path[path.length - 1]; if (id === to) return path; for (const next of stageById(id).links) if (!seen.has(next)) { seen.add(next); q.push(path.concat(next)); } }
  return [];
}
const moveTurns = corps => corps.target ? Math.max(0, route(corps.at, corps.target).length - 1) : 0;
function moveCampaign(id, confirmed = false) {
  const corps = roster[campaign.corps], next = stageById(id); if (!corps || !next) return;
  if (!confirmed && corps.target !== next.id && corps.at !== next.id) {   // 경로에 중립 세력 도시가 있으면 전쟁 경고를 먼저 띄운다 (이동 도시를 고르는 단계)
    const hit = route(corps.at, next.id).slice(1).map(stageById).find(breaksPeace);
    if (hit) { warnMove = { id, stage: hit }; return; }
  }
  corps.target = corps.target === next.id || corps.at === next.id ? null : next.id; campaign.destination = corps.target;
  campaign.notice = corps.target ? `${corpsName(corps)}: ${stageById(corps.at).name} → ${next.name} · ${moveTurns(corps)}턴.${breaksPeace(next) ? ` ※ ${peaceName(next.faction)} 도시에 진입하면 전쟁이 시작됩니다.` : ''}` : `${corpsName(corps)}의 이동 계획을 취소했다.`;
  saveCampaign();
}
function advanceEnemyForces() {
  campaign.intel = [];   // 이번 턴 적 판단 기록 (전투력·방어/침공 근거)
  const decisions = enemyForces.filter(force => force.active).map(force => ({ force, d: enemyDecision(force) }));   // 같은 턴의 판단은 이동 전 상태로 동시에 내린다
  aiEntries = {};
  const pulled = new Set();   // 63e: 합류 요청을 받은 군단은 요청한 군단의 도시로 이동 (이미 진군·방어·다른 요청 중이면 합류하지 않고 요청만 다음 턴에 다시 한다)
  for (const x of decisions) if (x.d.pull) for (const f of x.d.pull) { const y = decisions.find(z => z.force === f); if (y && !pulled.has(f) && y.d.act === 'hold' && y.d.mode === '집결' && !y.d.pull) { pulled.add(f); y.d = { ...y.d, act: 'advance', to: x.force.at, mode: '합류', reason: `${stageById(x.force.at).name} 집결 합류`, joinWait: x.force.wait || 0 }; } }
  for (const { force, d } of decisions) attachPopups(() => {
    const from = force.at; force.wait = d.joinWait != null ? d.joinWait : d.act === 'hold' && ['방어', '집결'].includes(d.mode) ? (force.wait || 0) + 1 : 0; if (d.act === 'advance' && d.to) { if (!aiEngaged(force)) { force.prevAt = from; force.at = d.to; aiEnterCity(force); } }
    const note = `적 ${force.army.name} [${force.role === 'garrison' ? '도시수비' : '기동'}] Lv${force.level} ⚔${d.mine} · ${stageById(from).name}${from !== force.at ? ' → ' + stageById(force.at).name + ' · 1턴 이동' : ''} · ${d.mode}(${d.reason})`;
    campaign.intel.push({ text: note, mode: d.mode, force: force.army.name, power: d.mine, from, to: force.at });
    if (from !== force.at) campaign.movement.push({ text: note, name: `적 ${force.army.name}`, commander: Sim.U[force.army.leader] ? Sim.U[force.army.leader].name : force.army.name, from, to: force.at, team: 'enemy', faction: forceFaction(force), forceId: force.id });
  });
  const entries = aiEntries; aiEntries = null; aiResolveEntries(entries);
}
// 명세 63a 전선 증원: 플레이어와 전쟁 중인 세력의 기동 군단이 플레이어 도시와 맞닿은 자기 도시에 있으면 증원 주기를 줄이고 1회 수를 늘린다. 끄는 값 cut:0·add:3·lateDrop:0 (= v0.1.274 동작)
const AI_FRONT = { cut: 0, add: 3, lateFrom: 40, lateDrop: 0 };   // 측정 결과 효과 없음·도시 변화 없는 판 증가 → 꺼 둠 (켜는 값 cut:2 add:4 lateDrop:1, 명세 63 구현 결과)
const isFrontForce = force => force.role !== 'garrison' && relationOf(forceFaction(force)).status === 'war' && stageById(force.at).links.some(id => stageById(id).owner === 'player');
const reinforceEvery = force => { const ex = aiP().expedition; return isFrontForce(force) ? Math.max(2, Math.round((ex - AI_FRONT.cut - (campaign.turn >= AI_FRONT.lateFrom ? AI_FRONT.lateDrop : 0)) * aiStyle(forceFaction(force)).reinforce)) : ex; };
function reinforceEnemies() {   // 원정 주기마다 자기 세력 도시에 있는 적 군단이 일반 병사를 3명씩 보충한다 (전선 군단은 AI_FRONT) (최대 18명, 장수·가상 지휘관은 만들지 않는다)
  let n = 0;
  for (const force of enemyForces) {
    const stage = stageById(force.at), fac = forceFaction(force); if (!force.active || !stage || stage.owner !== 'enemy' || stage.faction !== fac) continue; const front = isFrontForce(force); if (campaign.turn % reinforceEvery(force)) continue; const kind = cityKind(stage), add = Math.min(front ? AI_FRONT.add : 3, Sim.ARMY_MAX - force.army.units.length, grainRoom(fac, kind.cost)); if (add <= 0) continue; spendGrain(fac, add * kind.cost);
    const pool = THEME_UNITS[stage.theme]; for (let i = 0; i < add; i++) force.army.units.push(force.army.units.filter(k => k === 'healer').length < Math.ceil(Sim.ARMY_MAX * 0.1) ? 'healer' : factionKey(forceFaction(force), pool[(force.army.units.length + force.id) % pool.length], force.army.units.length));
    setEnemyRole(force, stageById(force.home) || stage, force.role, force.level); n++;
  }
  if (n) campaign.intel.push({ text: `적 ${n}개 군단이 병사를 보충했다.`, mode: '보충', force: '', power: 0, from: '', to: '' });
}
const intelSummary = () => { const n = {}; for (const i of campaign.intel || []) n[i.mode] = (n[i.mode] || 0) + 1; const t = Object.entries(n).map(([k, v]) => `${k} ${v}`).join('·'); return t ? ` 적 동향: ${t}` : ''; };
function movementEncounter(move) {
  const stage = stageById(move.to); if (!stage) return null;
  if (move.team === 'player') {
    if (stage.owner !== 'enemy') return null;
    const forces = allForces().filter(f => f.active && f.at === stage.id), hostile = forces.some(f => relationOf(forceFaction(f)).status === 'war');
    if (forces.length && !hostile || !forces.length && relationOf(stage.faction).status !== 'war') return null;
    if (!forces.length) return { stage, invasion: false, capture: true };
    const corps = roster[move.corpsIndex]; return combatReadyCorps(corps) ? { stage, responders: [move.corpsIndex], invasion: false, from: move.from, moverIndex: move.corpsIndex } : null;
  }
  const invader = move.forceId == null ? enemyForces.find(f => f.active && f.at === stage.id && relationOf(forceFaction(f)).status === 'war') : enemyForces.find(f => f.id === move.forceId && f.active && f.at === stage.id && relationOf(forceFaction(f)).status === 'war');
  if (stage.owner !== 'player' && !hostsPlayer(stage) || !invader) return null;
  const responders = roster.map((c, index) => ({ c, index })).filter(({ c }) => combatReadyCorps(c) && (c.at === stage.id || stage.links.includes(c.at))).map(({ index }) => index);
  if (!responders.length) return { stage, responders, invasion: true, from: move.from, unopposed: !guardsAt(stage).length, guardDefense: guardsAt(stage).length > 0 };
  return { stage, responders, invasion: true, from: move.from };
}
function resolveGuardDefense(encounter) {
  const stage = encounter.stage, attackers = enemyForces.filter(f => f.active && f.at === stage.id && relationOf(forceFaction(f)).status === 'war'), guards = guardsAt(stage);
  if (!attackers.length) { finishMovementStep(); return; }
  const att = forceFaction(attackers[0]), attack = attackers.reduce((n, f) => n + forcePow(f), 0), defense = guards.reduce((n, f) => n + forcePow(f), 0), win = aiWinnerOverride ? aiWinnerOverride === playerFaction() : defense * (0.85 + 0.3 * aiRoll('guardD|' + stage.id)) >= attack * (0.85 + 0.3 * aiRoll('guardA|' + stage.id));
  aiAttrition(guards.map(f => f.id), win ? 0.1 : 0.35); aiAttrition(attackers.map(f => f.id), win ? 0.35 : 0.1);
  aiHeroFates({ stage: stage.id, att, def: playerFaction(), winner: win ? playerFaction() : att, aIds: attackers.map(f => f.id), dIds: guards.map(f => f.id), lossW: 0.1, lossL: 0.35 });
  if (win) for (const f of attackers) { const back = f.prevAt && f.prevAt !== stage.id ? f.prevAt : route(stage.id, capitalFor(f))[1]; if (back) { f.at = back; f.prevAt = stage.id; f.rest = 3; } else f.active = false; }
  else enemyTakesCity(stage);
  const message = stage.name + (win ? ' 도시수비군 방어 성공' : ' 도시수비군 패배·함락');
  if (!win && stage.id === playerCapital()) { defeatCampaign(message); return; }
  showDiplomacyResult(message, ['기동 군단의 개입 없이 도시 수비군이 방어했습니다.', '수비 ⚔' + defense + ' · ' + att + '군 공격 ⚔' + attack, win ? '침공 군단은 후퇴합니다.' : '도시는 ' + att + '군 소유로 바뀝니다.'], win, '도시수비군 전투'); finishMovementStep();
}
function retreatAll(stage) {   // 방어 포기: 그 도시에 있던 모든 군단이 직전 도시로 이동한다 (직전 도시가 없으면 연결된 아군 도시, 그것도 없으면 연결 도시)
  const moved = [];
  roster.forEach(c => {
    if (!c.units.some(Boolean) || c.at !== stage.id) return;
    const back = c.prevAt && c.prevAt !== stage.id && stageById(c.prevAt) ? c.prevAt : stage.links.find(l => stageById(l).owner === 'player') || stage.links[0]; if (!back) return;
    c.at = back; c.target = null; moved.push({ c, back: stageById(back) });
  });
  const active = roster[campaign.corps]; if (active) campaign.at = active.at;
  return moved;
}
function finishMovementStep() {
  campaign.pendingEncounter = null; campaign.responsePage = 0;
  if (campaign.movementPage < campaign.movement.length - 1) { campaign.movementPage++; flushMovePopups(); }
  else { campaign.movement = []; campaign.movementPage = 0; continueCampaignTurn(); }
  saveCampaign();
}
function buildTurnSummary(turn, moves) {   // 새 턴 시작 요약: 모든 세력의 군단 이동, 장수 전사·포박 소식, 포로 장수 현황
  const lines = [], by = {};
  for (const m of moves) { const f = m.team === 'player' ? playerFaction() : m.faction || '적'; (by[f] ||= []).push(m); }
  const order = [playerFaction(), ...FACTIONS.filter(f => f !== playerFaction())].filter(f => by[f]);
  lines.push(`■ 군단 이동 — 모든 세력 ${moves.length}건`);
  if (!moves.length) lines.push('  이번 턴에는 이동한 군단이 없습니다.');
  for (const f of order) for (const m of by[f]) lines.push(`  [${f}] ${String(m.name).replace(/^적 /, '')}: ${stageById(m.from) ? stageById(m.from).name : m.from} → ${stageById(m.to) ? stageById(m.to).name : m.to}`);
  const news = campaign.custodyNews || [], dead = news.filter(t => /전사|처형/.test(t)), surrendered = news.filter(t => /투항에 성공/.test(t)), other = news.filter(t => !dead.includes(t) && !surrendered.includes(t));
  campaign.custodyNews = [];
  { const l = campaign.econLog[playerFaction()]; if (l && l.n) lines.push(`■ 군량 ${grainOf(playerFaction())} — 수입 +${l.income}${l.lump ? ' 점령 +' + l.lump : ''} 유지 −${l.upkeep} 보충 −${l.spent}(${l.refill}명) 탈영 ${l.desert}`); }
  { const ci = capitalInfo(stageById(playerCapital())); if (ci && ci.low) lines.push(`■ 수도 수비 부족 (${ci.n}/${ci.cap}) — 보충은 ${CAPITAL_REFILL.every}턴마다 군량을 씁니다`); }
  { const d = (campaign.dipLog || []).concat(FACTIONS.filter(f => f !== playerFaction() && relationOf(f).status === 'truce' && relationOf(f).truceUntil - campaign.turn <= 3 && relationOf(f).truceUntil > campaign.turn).map(f => `${f}군 휴전 ${relationOf(f).truceUntil - campaign.turn}턴 남음 — 갱신은 수도 외교에서`)).slice(0, 3); campaign.dipLog = []; if (d.length) { lines.push('■ 외교'); d.forEach(t => lines.push('  ' + t)); } }
  lines.push(`■ 사망 장수 — ${dead.length}명`);
  if (!dead.length) lines.push('  이번 턴에 사망한 장수가 없습니다.');
  dead.forEach(t => lines.push('  ' + t));
  const held = campaign.prisoners || [];
  lines.push(`■ 포로 장수 — ${held.length}명`);
  other.forEach(t => lines.push('  이번 턴: ' + t));
  if (!held.length) lines.push('  포로로 잡힌 장수가 없습니다.');
  for (const p of [...held].sort((a, b) => (b.owner === playerFaction()) - (a.owner === playerFaction()))) lines.push(`  ${Sim.U[p.key] ? Sim.U[p.key].name : p.key} (${p.origin}군) → ${p.owner}군 억류 ${Math.max(0, campaign.turn - p.turn)}턴 · 투항 ${Math.round(recruitmentChance(p) * 100)}% · 탈출 5%/턴${p.owner === playerFaction() ? ' · 군단 편성 화면에서 투항 권유 가능' : ''}`);
  lines.push(`■ 투항 장수 — ${surrendered.length}명`);
  if (!surrendered.length) lines.push('  이번 턴에 투항한 장수가 없습니다.');
  surrendered.forEach(t => lines.push('  ' + t));
  return { turn, lines };
}
function continueCampaignTurn() {
  const encounter = campaign.pendingEncounter; campaign.pendingEncounter = null;
  if (!encounter && pendingSummary) { turnSummary = buildTurnSummary(pendingSummary.turn, pendingSummary.moves); pendingSummary = null; custodyPage = 0; } else if (!encounter) inTurnFlow = false;
  if (!encounter) { centerMap(); campaign.at = roster[campaign.corps].at; campaign.destination = roster[campaign.corps].target; campaign.notice = `${campaign.turn}턴 이동을 완료했다.${intelSummary()}`; saveCampaign(); return; }
  if (encounter.invasion) { campaign.pendingEncounter = encounter; campaign.notice = `${encounter.stage.name} 방어에 나설 군단을 선택하세요.`; saveCampaign(); return; }
  campaign.corps = encounter.index; campaign.at = encounter.stage.id; campaign.from = encounter.from; campaign.destination = roster[encounter.index].target; campaign.invasion = false; campaign.notice = `${encounter.stage.name}에 적이 주둔 중이다. 전투를 시작한다.`; startBattle(encounter.stage);
}
// 중립 세력(외교로 동맹·전쟁을 정하지 않은 세력)은 중립을 유지하다가, 아군 군단이 그 도시에 진입하면 즉시 전쟁이 된다 (명세 23).
function enterNeutralCity(corps, stage) {
  if (!breaksPeace(stage)) return; const was = peaceName(stage.faction), wasTruce = relationOf(stage.faction).status === 'truce';
  addAffinity(playerFaction(), stage.faction, wasTruce ? -WAR_COST.truce : -10, wasTruce ? '휴전 파기(군단 진입)' : '영토 침범'); setDiplomacy(stage.faction, 'war', true);
  showDiplomacyResult(`${stage.faction}군과 전쟁 돌입`, [`${corpsName(corps)}이(가) ${was} 도시 ${stage.name}에 진입했습니다.`, `관계: ${was} → 전쟁`, '외교 없이 영토에 들어가 전쟁이 시작되었고, 이 도시의 군단과 교전합니다.'], false);
}
const AI_BATTLE_CHANCE = 0.6;   // 전쟁 중인 AI 쌍이 턴마다 전투를 시작할 확률
let aiDiplomacyOn = true;   // 타 세력끼리의 외교·전투 사건 (시험에서 끌 수 있다)
let aiSeed = 0;   // 시험·측정 도구가 바꾸는 난수 시드 (게임 중에는 0)
const aiRoll = tag => { let h = 2166136261; for (const ch of tag + '|' + campaign.turn + '|' + aiSeed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };   // 턴·태그로 정해지는 결정적 난수 (저장·시험에서 같은 결과)
const AI_REL_TEXT = { war: '서로 공격할 수 있는 전쟁 상태가 되었습니다.', truce: '10턴 동안 서로 침공하지 않습니다.', ally: '서로 돕는 동맹이 되었습니다.', neutral: '서로 간섭하지 않는 중립 상태가 되었습니다.' };
const aiTotalPow = f => allForces().filter(x => x.active && forceFaction(x) === f).reduce((n, x) => n + forcePow(x), 0);
const aiBorder = (a, b) => STAGES.some(s => s.owner === 'enemy' && s.faction === a && s.links.some(l => { const t = stageById(l); return t.owner === 'enemy' && t.faction === b; }));   // 도시끼리 맞닿음
const aiWarPressure = (key, border) => 0.12 * (campaign.turn - 1) + (border ? 0.3 : 0) + 0.2 * aiRoll('w' + key) - 0.004 * (key.startsWith('P|') ? affinityOf(playerFaction(), key.slice(2)) : campaign.affinity[key] || 0);   // 중립→전쟁 압력(명세 44): 턴마다 +0.12, 국경이 맞닿으면 +0.3, 결정적 난수 ≤0.2. 0.6 이상이면 30%/턴, 1 이상이면 확정 → 국경 있으면 약 8턴, 없으면 약 10턴 안에 전쟁
function aiDeclareWarOnPlayer() {   // AI 세력이 플레이어에게도 같은 압력으로 선전포고한다 (플레이어와 중립이면)
  for (const f of aiFactions()) {
    const r = campaign.relations[f]; if (!r || r.status !== 'neutral' || factionDead(f) || campaign.turn < (r.lock || 0) || affinityOf(playerFaction(), f) >= 30) continue;
    const border = STAGES.some(s => s.owner === 'enemy' && s.faction === f && s.links.some(l => stageById(l).owner === 'player')), p = aiWarPressure('P|' + f, border);
    if (p >= 1 || p >= 0.6 && aiRoll('dp' + f) < 0.3) { const A0 = affinityOf(playerFaction(), f); addAffinity(playerFaction(), f, -WAR_COST.neutral, '선전포고'); setDiplomacy(f, 'war', true); aiNews('A', `${f}군이 선전포고`, [`${f}군이 ${playerFaction()}군에 선전포고했습니다.`, `관계: 중립 → 전쟁 · 사유: ${border ? '국경이 맞닿음' : '시간이 지나 긴장이 고조됨'}`, `호감도 ${A0} (${affinityStage(A0).name})`, '외교 없이 전쟁이 시작되었습니다.'], false, '외교'); }
  }
}
function aiDiplomacyStep() {   // AI 세력 쌍의 관계를 전력비·국경·공통의 적·호감도(명세 62)로 정한다. 변하면 사유·호감도와 함께 알린다 (명세 36 AI-S-04)
  if (!aiDiplomacyOn) return;
  affinityStep(); aiDeclareWarOnPlayer();
  for (const key of Object.keys(campaign.aiRelations)) {
    const [a, b] = key.split('|'); if (FACTION_ALLIES[a] === b || factionDead(a) || factionDead(b)) continue;
    const r = campaign.aiRelations[key], was = r.status, A0 = affinityOf(a, b); if (campaign.turn < (r.lock || 0) || campaign.aiBattles.some(x => pairKey(x.att, x.def) === key)) continue;   // 영토 침범으로 시작된 전쟁은 한동안 바뀌지 않는다
    const cool = (campaign.aiCool || {})[key] || 0; let next = null, why = '', expired = false, trial = null;
    if (was === 'truce' && campaign.turn >= r.truceUntil) { expired = true; next = A0 >= TRUCE_RULE.calmA ? 'neutral' : 'war'; why = `휴전 기간이 끝남 · 호감도 ${A0}${A0 >= TRUCE_RULE.calmA ? ` ≥ ${TRUCE_RULE.calmA}이라 중립으로 복귀` : ` < ${TRUCE_RULE.calmA}이라 전쟁`}`; }
    else {
      const pa = aiTotalPow(a), pb = aiTotalPow(b), R = pa / Math.max(1, pb), S = Math.max(R, 1 / R), strong = R >= 1 ? a : b, weak = strong === a ? b : a, border = aiBorder(a, b);
      const common = commonEnemy(a, b), recent = Object.entries(campaign.aiLast || {}).some(([k, t]) => k.endsWith('|' + key) && campaign.turn - t <= 3), cand = [];
      const power = `전력 ${strong}군이 ${weak}군의 ${S.toFixed(2)}배`;
      if (['neutral', 'truce'].includes(was) && common && allyAllowed(a, b) && campaign.turn % 3 === 0 && cool <= campaign.turn) trial = ['ally', '둘 다 같은 세력과 전쟁 중(공통의 적)'];
      else if (was === 'neutral') cand.push(['war', A0 >= 30 ? 0 : aiWarPressure(key, border), `${power}, ${border ? '국경이 맞닿음' : '시간이 지나 긴장이 고조됨'}`], ['truce', recent ? 0.7 : 0, '최근 교전으로 소모']);
      else if (was === 'war') cand.push(['truce', (S >= 1.5 ? 0.8 : 0) + (recent ? 0.4 : 0), `${weak}군이 열세(${power})${recent ? ', 최근 교전으로 소모' : ''}`]);
      else if (was === 'ally') cand.push(['war', common || A0 >= 40 ? 0 : 0.7, '공통의 적이 사라짐']);   // 신뢰 단계(≥40) 동맹은 유지. 동맹 파기는 전쟁
      cand.sort((x, y) => y[1] - x[1]); const top = cand[0];
      if (!trial && top && (top[1] >= 1 || top[1] >= 0.6 && aiRoll('d' + key) < 0.3)) { if (top[0] === 'truce') trial = ['truce', top[2]]; else { next = top[0]; why = top[2]; } }   // 점수 1 이상이면 확정, 0.6 이상이면 소량의 난수(결정적)로 결정
      if (trial) {   // 제안(휴전·동맹)은 호감도 확률식으로 판정한다 — 약한 쪽이 제안자, 거절되면 호감도 하락·3턴 쿨다운
        if (cool > campaign.turn) continue;
        const p = diplomacyChance(weak, strong, trial[0]);
        if (aiRoll('ai|' + trial[0] + '|' + key) * 100 < p) { next = trial[0]; why = `${trial[1]} · 성공률 ${Math.round(p)}%`; }
        else { addAffinity(a, b, trial[0] === 'ally' ? -4 : -2, '제안 거절'); (campaign.aiCool ||= {})[key] = campaign.turn + 3; continue; }
      }
    }
    if (!next) continue;
    const delta = expired ? 0 : next === 'ally' ? 10 : next === 'truce' ? 5 : next === 'war' ? -(WAR_COST[was] || 5) : 0;
    if (next === 'truce' && r.status !== 'truce') r.truceSince = campaign.turn; else if (next !== 'truce') delete r.truceSince;
    r.status = next; r.truceUntil = next === 'truce' ? campaign.turn + 10 : 0; r.since = campaign.turn;
    addAffinity(a, b, delta, next === 'war' ? (was === 'ally' ? '동맹 파기' : '선전포고') : next === 'ally' ? '동맹 성립' : next === 'truce' ? '휴전 성립' : '');
    const A1 = affinityOf(a, b), aff = `호감도 ${A0}${A1 !== A0 ? ' → ' + A1 : ''} (${affinityStage(A1).name})`;
    aiNews([a, b].some(f => relationOf(f).status === 'ally') ? 'A' : 'B', `${a}군 ↔ ${b}군: ${RELATION_NAME[next]}`, [`관계: ${RELATION_NAME[was]} → ${RELATION_NAME[next]} · 사유: ${why}`, aff, AI_REL_TEXT[next]], next !== 'war', '타 세력 외교');
  }
}
const aiForcesOf = ids => ids.map(forceById).filter(f => f && f.active);
const aiPow = ids => aiForcesOf(ids).reduce((n, f) => n + forcePow(f), 0);
function aiAttrition(ids, rate) { for (const f of aiForcesOf(ids)) { const n = Math.floor((f.army.units.length - (f.role === 'garrison' ? 0 : 1)) * rate); if (n > 0) { f.army.units.splice(f.army.units.length - n, n); f.army.growth.splice(f.army.units.length, n); } if (!f.army.units.length) f.active = false; } }
function planAiBattle(att, def) {   // 공격 세력의 군단이 맞닿은 상대 도시를 노린다. 쉬는 군단·최근 교전한 도시·전력 열세(침공 비율 미만)는 제외
  let best = null; const busy = new Set(campaign.aiBattles.flatMap(b => [...b.aIds, ...b.dIds]));
  for (const s of STAGES.filter(x => x.owner === 'enemy' && x.faction === def && !roster.some(c => c.at === x.id && c.units.some(Boolean)))) {
    const last = campaign.aiLast && campaign.aiLast[s.id + '|' + pairKey(att, def)]; if (last != null && campaign.turn - last <= 3) continue;
    const a = enemyForces.filter(f => f.active && f.role !== 'garrison' && !busy.has(f.id) && !(f.rest > 0) && forceFaction(f) === att && f.army.units.length && (f.at === s.id || stageById(f.at).links.includes(s.id) && stageById(f.at).faction === att && !aiEngaged(f))), d = allForces().filter(f => f.active && !busy.has(f.id) && f.at === s.id && forceFaction(f) === def);
    if (!a.length || !d.length || aiPow(a.map(f => f.id)) < aiPow(d.map(f => f.id)) * aiP().attack) continue;
    if (!best || a.length > best.a.length) best = { s, a, d };
  }
  return best ? makeAiBattle(att, def, best.s.id, best.a, best.d) : null;
}function aiEngaged(force) {   // 전투 중이거나, 적대 세력 군단이 지키는 도시에 들어와 있으면 그 도시를 점령하기 전에는 나아가지 않는다
  if (campaign.aiBattles.some(b => b.aIds.includes(force.id) || b.dIds.includes(force.id))) return true;
  const s = stageById(force.at), fa = forceFaction(force); if (!s || s.owner !== 'enemy' || !s.faction || s.faction === fa || FACTION_ALLIES[fa] === s.faction || aiRel(fa, s.faction).status !== 'war') return false;
  if (roster.some(c => c.at === s.id && c.units.some(Boolean))) return false;   // 아군 군단이 있는 도시는 아군과의 전투가 우선
  return allForces().some(f => f.active && f.at === s.id && forceFaction(f) === s.faction);
}
const leaderName = f => Sim.U[f.army.leader] ? Sim.U[f.army.leader].name : f.army.name;
let aiWinnerOverride = null;   // 시험에서 승패를 정한다
const aiSideText = (b, ids, side) => {   // 시작 때 인원 → 지금 인원 (3개 군단부터는 합계로 줄여 보여 준다). 지원 군단은 소속을 붙인다
  const list = aiForcesOf(ids); if (!list.length) return '없음';
  if (list.length <= 3) return list.map(f => `${leaderName(f)} 군단${side && forceFaction(f) !== side ? '(' + forceFaction(f) + '군 지원)' : ''} ${b.u0[f.id]}→${f.army.units.length}명`).join(' · ');
  return `${leaderName(list[0])} 군단 외 ${list.length - 1}개 · 합계 ${list.reduce((n, f) => n + b.u0[f.id], 0)}→${list.reduce((n, f) => n + f.army.units.length, 0)}명`;
};
let aiSupportUsed = new Set();   // 이번 턴에 이미 지원을 나간 군단 (한 턴에 한 전투만 지원)
function aiSupporters(side, other, stageId, taken) {   // side 의 동맹이 연결된 도시에서 보내는 지원 군단 (최대 2개, 전력 순)
  const s = stageById(stageId), out = [];
  for (const f of enemyForces) {
    if (!f.active || f.role === 'garrison' || taken.has(f.id) || aiSupportUsed.has(f.id) || !f.army.units.length) continue;
    const fac = forceFaction(f); if (fac === side || fac === other || !alliedFactions(side, fac) || alliedFactions(other, fac)) continue;
    const here = stageById(f.at); if (!(f.at === stageId || s.links.includes(f.at) && here.faction === fac) || aiEngaged(f)) continue;
    out.push(f);
  }
  return out.sort((a, b) => forcePow(b) - forcePow(a)).slice(0, 2);
}
function makeAiBattle(att, def, stageId, aForces, dForces) {
  aForces = aForces.filter(f => f.role !== 'garrison'); dForces = [...new Map(dForces.concat(guardsAt(stageById(stageId)).filter(f => forceFaction(f) === def)).map(f => [f.id, f])).values()];
  const taken = new Set([...aForces, ...dForces].map(f => f.id)), aSup = aiSupporters(att, def, stageId, taken); aSup.forEach(f => taken.add(f.id)); const dSup = aiSupporters(def, att, stageId, taken);
  [...aSup, ...dSup].forEach(f => aiSupportUsed.add(f.id)); aForces = [...aForces, ...aSup]; dForces = [...dForces, ...dSup];
  const sup = [...aSup, ...dSup].map(f => `${forceFaction(f)}군 ${leaderName(f)} 군단(${stageById(f.at).name})`);
  const aIds = aForces.map(f => f.id), dIds = dForces.map(f => f.id), aPow = aiPow(aIds), dPow = aiPow(dIds), win = aiWinnerOverride || (aPow * (0.85 + 0.3 * aiRoll('wa' + att)) > dPow * (0.85 + 0.3 * aiRoll('wd' + def)) ? att : def);
  const u0 = {}; for (const f of [...aForces, ...dForces]) u0[f.id] = f.army.units.length;
  const q = Math.min(aPow, dPow) / Math.max(1, Math.max(aPow, dPow)), lossL = Math.min(0.45, 0.25 + 0.2 * (1 - q)), lossW = 0.1 + 0.05 * q;   // 손실률: 패자 25~45%(전력 차가 클수록 큼), 승자 10~15% (설계값)
  return { id: campaign.turn * 10 + campaign.aiBattles.length, att, def, stage: stageId, round: 0, aIds, dIds, sup, u0, lossL, lossW, startA: aPow, startD: dPow, winner: win, faction0: stageById(stageId).faction };
}
function settleAiBattle(b) { while (!b.done && b.round < 2) stepAiBattle(b); campaign.aiBattles = campaign.aiBattles.filter(x => !x.done); }
function announceAiBattle(b) {
  campaign.aiBattles.push(b);
  settleAiBattle(b);   // 시작·진행·결과·도시 상태 변경을 같은 턴에 처리하고, 알림은 결과 한 건으로 묶는다
}// 아군에게 적용되는 외교 규칙을 모든 세력에 똑같이 적용한다: 중립·휴전 세력의 도시에 군단이 들어가면 즉시 전쟁이 되고, 동맹 도시는 그냥 지나간다. 전쟁이 되면 그 도시에서 바로 전투가 시작된다.
const aiFactions = () => FACTIONS.filter(f => f !== playerFaction());
const factionStages = f => STAGES.filter(s => s.owner === 'enemy' && s.faction === f);
function campaignCapital(f) { return (campaign.capitals && campaign.capitals[f]) || CAPITALS[f]; }
const isCapital = s => s.owner === 'player' ? !!s.capital : campaignCapital(s.faction) === s.id;   // ★ 표시·수도 판정 (아군이 점령한 옛 수도는 원래 표시 유지)
const factionDead = f => !!(campaign.dead && campaign.dead[f]);
const NEWS_MODES = ['all', 'important', 'off'], NEWS_NAME = { all: '모두', important: '중요만', off: '끄기' };
function aiNews(level, title, lines, ok, kind) {   // A: 즉시 팝업 / B: 턴 끝 '이번 턴 소식' 한 장 / C: 기록만. 설정(소식: 모두·중요만·끄기)에 따라 달라진다
  const mode = campaign.newsMode || 'important'; campaign.newsLog ||= []; campaign.newsLog.push({ turn: campaign.turn, title }); if (campaign.newsLog.length > 30) campaign.newsLog.shift();
  if (level === 'A' || (mode === 'all' && level === 'B')) { showDiplomacyResult(title, lines, ok, kind); return; }
  if (level === 'B' && mode !== 'off') { campaign.digest ||= []; campaign.digest.push({ title, line: lines[0] || '' }); }
}
function flushDigest() {   // 이번 턴의 B 등급 소식을 한 장으로 묶어 띄운다
  const list = campaign.digest || []; if (!list.length) return; campaign.digest = [];
  const lines = list.slice(0, 7).map(e => `${e.title} — ${e.line}`); if (list.length > 7) lines.push(`외 ${list.length - 7}건`);
  showDiplomacyResult('이번 턴 소식', lines, true, '이번 턴 소식');
}
const nearPlayer = s => !!s && (s.owner === 'player' || hostsPlayer(s) || roster.some(c => c.units.some(Boolean) && (c.at === s.id || s.links.includes(c.at))));   // 내 도시·내 군단이 있거나 연결된 도시
const aiNewsLevel = (stage, factions) => nearPlayer(stage) || isCapital(stage) || factions.some(f => relationOf(f).status === 'ally') ? 'A' : 'B';
function relocateCapitals() {   // 수도를 잃은 세력은 천도하고, 도시가 하나도 없으면 멸망한다 (여러 번 불러도 같은 결과)
  campaign.dead ||= {}; campaign.capitals ||= { ...CAPITALS };
  for (const f of aiFactions()) {
    if (campaign.dead[f]) continue;
    const cap = stageById(campaignCapital(f)), mine = factionStages(f); if (cap && cap.owner === 'enemy' && cap.faction === f) continue;
    if (!mine.length) {
      campaign.dead[f] = campaign.turn; enemyForces.forEach(x => { if (x.active && forceFaction(x) === f) x.active = false; });
      aiNews('A', `${f}군 멸망`, [`${f}군이 마지막 도시를 잃고 멸망했습니다.`, '관계 표에 멸망으로 표시되며 더는 외교할 수 없습니다.'], false, '세력 소식'); continue;
    }
    const score = s => enemyForces.filter(x => x.active && x.at === s.id && forceFaction(x) === f).reduce((n, x) => n + forcePow(x), 0) * 100 + s.links.length;
    const next = mine.slice().sort((a, b) => score(b) - score(a))[0], old = cap ? cap.name : '수도';
    campaign.capitals[f] = next.id; aiNews('A', `${f}군 천도: ${next.name}`, [`${f}군이 ${old}을(를) 잃고 ${next.name}(으)로 천도했습니다.`, `외교는 새 수도 ${next.name}에서 진행합니다.`], true, '세력 소식');
  }
  ensureCapitalGuards();
}
function aiCaptureCity(st, att, def, defenders) {   // 아군이 점령할 때와 같은 규칙: 도시 소속이 바뀌고, 수비 군단은 수도 쪽으로 한 칸 물러나며 수도에서 밀리면 궤멸한다
  for (const f of enemyForces) if (!f.fac) f.fac = forceFaction(f);   // 소속이 바뀌기 전에 모든 군단의 소속을 고정
  const capital = campaignCapital(def); captureAffinity(att, def, st, capital === st.id);
  for (const f of defenders) { if (f.role === 'garrison') { f.active = false; f.army.units = []; f.army.growth = []; continue; } const path = route(f.at, capital); if (path.length > 1 && f.at !== capital) { f.prevAt = f.at; f.at = path[1]; } else f.active = false; }
  st.faction = att; st.owner = att === playerFaction() ? 'player' : 'enemy'; resetCityGuards(st, captureRatio(st)); relocateCapitals();
}
function aiEnterCity(force) {
  if (!aiDiplomacyOn) return;
  const s = stageById(force.at), fa = forceFaction(force); if (!s || s.owner !== 'enemy' || !s.faction || s.faction === fa) return;
  const key = pairKey(fa, s.faction), r = campaign.aiRelations[key]; if (!r || FACTION_ALLIES[fa] === s.faction) return;
  const was = r.status; if (was === 'ally') return;
  if (was !== 'war') {
    addAffinity(fa, s.faction, was === 'truce' ? -WAR_COST.truce : -10, was === 'truce' ? '휴전 파기(군단 진입)' : '영토 침범'); r.status = 'war'; r.truceUntil = 0; r.lock = campaign.turn + 8; const lead = Sim.U[force.army.leader] ? Sim.U[force.army.leader].name : force.army.name;
    aiNews(aiNewsLevel(s, [fa, s.faction]), `${fa}군 ↔ ${s.faction}군: 전쟁`, [`${fa}군 ${lead} 군단이 ${RELATION_NAME[was]} 중인 ${s.faction}군의 ${s.name}에 진입했습니다.`, `관계: ${RELATION_NAME[was]} → 전쟁`, '외교 없이 영토에 들어가 전쟁이 시작되었습니다.'], false, '타 세력 외교');
  }
  if (aiEntries) { (aiEntries[s.id] ||= []).push(force); return; }   // 한 턴의 이동이 끝난 뒤 도시별로 한 번에 처리한다 (같은 도시에 여럿이 들어오면 하나의 전투)
  resolveAiEntry(s, fa, [force]);
}
let aiEntries = null;   // 이번 턴 이동으로 적대 도시에 들어간 군단 {도시 id: [군단]}
function resolveAiEntry(s, fa, group) {   // 도시 하나에 들어온 한 세력의 군단들 — 같은 턴에 전투 시작·진행·결과·도시 상태 변경까지 처리
  if (s.faction === fa || roster.some(c => c.at === s.id && c.units.some(Boolean))) return;
  const def = s.faction, key = pairKey(fa, def), all = allForces().filter(f => f.active && f.at === s.id && forceFaction(f) === def);
  if (!all.length) {   // 지키는 군단이 없으면 아군과 똑같이 바로 점령한다 (수도도 마찬가지)
    const wasCap = isCapital(s); aiCaptureCity(s, fa, def, []);
    aiNews(wasCap ? 'A' : nearPlayer(s) ? 'B' : 'C', `${s.name} 무방비 점령`, [`${fa}군이 ${def}군의 ${s.name}을(를) 전투 없이 점령했습니다.`, `${s.name}: ${def}군 소유 → ${fa}군 소유로 바뀜 (${wasCap ? '수도 함락' : '점령'})`], true, '타 세력 전투 · 결과'); return;
  }
  if (aiRel(fa, def).status !== 'war') return;
  const last = campaign.aiLast && campaign.aiLast[s.id + '|' + key]; if (last != null && campaign.turn - last <= 3) return;   // 같은 도시·같은 쌍은 3턴 안에 다시 싸우지 않는다 (공성 상태로 대기)
  announceAiBattle(makeAiBattle(fa, def, s.id, group.filter(f => f.active && f.at === s.id), all));
}
function aiResolveEntries(entries) {   // 팝업은 마지막으로 도착한 군단의 이동 안내에 붙여, 그 이동이 보이는 시점에 함께 뜬다
  for (const sid of Object.keys(entries)) {
    const s = stageById(sid), byFaction = {}; for (const f of entries[sid]) (byFaction[forceFaction(f)] ||= []).push(f);
    for (const a of Object.keys(byFaction)) for (const b2 of Object.keys(byFaction)) if (a !== b2 && byFaction[a] && byFaction[b2] && alliedFactions(a, b2)) { byFaction[a].push(...byFaction[b2]); delete byFaction[b2]; }   // 동맹 세력이 같은 도시를 함께 공격하면 한 전투 (앞선 세력이 공격 주체)
    for (const fa of Object.keys(byFaction)) {
      const group = byFaction[fa], last = group[group.length - 1]; popupSink = [];
      try { resolveAiEntry(s, fa, group); } finally {
        const got = popupSink; popupSink = null; if (!got.length) continue;
        const entry = campaign.movement.slice().reverse().find(m => m.forceId === last.id);
        if (entry) entry.popups = (entry.popups || []).concat(got); else got.forEach(p => showDiplomacyResult(p.title, p.lines, p.ok, p.kind));
      }
    }
  }
}
function stepAiBattle(b) {   // 한 라운드: 1 → 진행 팝업, 2 → 결과 팝업·도시 상태 변경
  const st = stageById(b.stage), loser = b.winner === b.att ? b.def : b.att, loserIds = loser === b.att ? b.aIds : b.dIds, winnerIds = loser === b.att ? b.dIds : b.aIds;
  b.round++;
  if (b.round === 1) {   // 진행: 피해의 절반을 입는다
    aiAttrition(loserIds, b.lossL / 2); aiAttrition(winnerIds, b.lossW / 2);
  } else {   // 결과
    aiAttrition(loserIds, b.lossL / 2); aiAttrition(winnerIds, b.lossW / 2); b.done = true; aiHeroFates(b);
    const capture = b.winner === b.att, aText = aiSideText(b, b.aIds, b.att), dText = aiSideText(b, b.dIds, b.def);
    let city, attLine, defLine;
    if (capture) {   // 공격 성공: 수도를 포함해 도시 소속이 바뀌고, 공격 군단이 입성한다
      const wasCap = isCapital(st), defs = aiForcesOf(b.dIds); aiCaptureCity(st, b.att, b.def, defs); for (const f of aiForcesOf(b.aIds).filter(x => forceFaction(x) === b.att)) { f.prevAt = f.at; f.at = st.id; }
      city = `${st.name}: ${b.def}군 소유 → ${b.att}군 소유로 바뀜 (${wasCap ? '수도 함락' : '점령'})`; attLine = `${b.att}군: ${st.name} 입성 · ${aText}`;
      const mobileDefs = defs.filter(f => f.role !== 'garrison'), back = mobileDefs.find(f => f.active);
      defLine = `${b.def}군: 도시수비군 해체${back ? ' · 기동군단 ' + stageById(back.at).name + '(으)로 후퇴' : mobileDefs.length ? ' · 기동군단 궤멸' : ''} · ${dText}`;
    } else {   // 방어 성공: 공격 군단은 직전 도시로 물러난다
      const back = f => { const to = f.prevAt && f.prevAt !== f.at ? f.prevAt : f.at; f.prevAt = f.at; f.at = to; return stageById(to).name; }, names = aiForcesOf(b.aIds).filter(f => f.at === st.id).map(back)[0] || '';
      city = `${st.name}: ${b.def}군 소유 유지 (점령 실패)`; attLine = `${b.att}군: ${names}(으)로 후퇴 · ${aText}`; defLine = `${b.def}군: ${st.name} 방어 성공 · ${dText}`;
    }
    const level = aiNewsLevel(st, [b.att, b.def]), sup = b.sup && b.sup.length ? [`지원 요청: ${b.sup.join(' · ')}이(가) 연결된 도시에서 합류했습니다.`] : [];
    const help = [b.att, b.def].some(f => relationOf(f).status === 'ally') && !roster.some(c => c.at === st.id && c.units.some(Boolean)) ? ['개입 가능: 다음 턴 이 도시나 연결된 도시로 군단을 이동하면 합류할 수 있습니다.'] : [];   // 명세 36 AI-S-08 1단계
    campaign.aiLast ||= {}; campaign.aiLast[st.id + '|' + pairKey(b.att, b.def)] = campaign.turn;
    if (b.winner !== b.att) for (const f of aiForcesOf(b.aIds)) f.rest = 3;   // 공격에 실패한 군단은 3턴 재정비 (재공격 루프 차단)
    aiNews(level, `${st.name} 전투: ${b.winner}군 승리`, [`${b.att}군(공격) ⚔${b.startA} → ${b.def}군(수비) ⚔${b.startD}: ${b.winner === b.att ? b.att + '군이 ' + b.def + '군을 공격해 이겼습니다.' : b.def + '군이 공격을 막아냈습니다.'}`, ...sup, `공격 ${b.att}군: ${aText}`, `수비 ${b.def}군: ${dText}`, city, attLine, defLine, ...help], true, '타 세력 전투');
  }
}
function aiBattleStep() {   // 타 세력 전투: 시작 → 진행(다음 턴) → 결과(그다음 턴) 팝업
  if (!aiDiplomacyOn) return;
  for (const b of campaign.aiBattles) stepAiBattle(b);
  campaign.aiBattles = campaign.aiBattles.filter(b => !b.done);
  for (const key of Object.keys(campaign.aiRelations)) {
    const [x, y] = key.split('|'); if (campaign.aiRelations[key].status !== 'war') continue;
    if (factionDead(x) || factionDead(y) || campaign.aiBattles.some(b => pairKey(b.att, b.def) === key)) continue;
    const [att, def] = aiRoll('o' + key) < 0.5 ? [x, y] : [y, x], b = planAiBattle(att, def); if (!b) continue;
    const R = b.startA / Math.max(1, b.startD); if (aiRoll('b' + key) >= (R >= 1.2 ? AI_BATTLE_CHANCE : 0.3)) continue;   // 전력비 1.2 이상이면 60%, 그 미만(어려움에서만 가능)은 30%
    announceAiBattle(b);
  }
}
function turnOptionButtons(x, y, gap = 8) {   // 턴 진행 중 팝업에서도 바꿀 수 있는 이동 안내·소식 표시 토글
  const bw = mb(112, 280); button('campaign:opt:news', x, y, bw, tb(28), '소식: ' + NEWS_NAME[campaign.newsMode || 'important'], false, 12); button('campaign:opt:diff', x + bw + gap, y, bw, tb(28), '난이도: ' + aiP().name + (campaign.turn > 1 ? ' 🔒' : ''), false, 12);
}
const isTurnOpt = id => !!id && id.startsWith('campaign:opt:');
const MOVE_MODES = ['detail', 'skip'], MOVE_NAME = { detail: '상세', skip: '건너뛰기' };   // 턴 진행 중 적 군단 이동 안내: 상세(군단마다 한 장씩) / 건너뛰기(아군과 상호작용하는 것만)
function skipEnemyMoves() {   // 건너뛰기: 적 군단 이동 안내는 생략하되, 아군(도시·군단·동맹 주둔)과 맞닿는 이동·팝업이 딸린 이동은 남겨 반드시 팝업으로 알린다
  if ((campaign.moveMode || 'detail') !== 'skip') return;
  campaign.movement = campaign.movement.filter(m => m.team === 'player' || (m.popups && m.popups.length) || !!movementEncounter(m) || (stageById(m.to) && (stageById(m.to).owner === 'player' || hostsPlayer(stageById(m.to)))));
  campaign.movementPage = 0;
}
function endCampaignTurn() {
  if (pendingPrisoners().length) return;
  autoDisbandEmpty();   // 전투 손실 등으로 완전히 비어 버린 군단은 진행 시작 때 해제한다
  inTurnFlow = true;
  campaign.turn++; processCustodyTurn(); campaign.movement = []; campaign.movementPage = 0; campaign.pendingEncounter = null; aiSupportUsed = new Set();
  for (const [faction, relation] of Object.entries(campaign.relations)) if (relation.status === 'truce' && campaign.turn >= relation.truceUntil) { const A = affinityOf(playerFaction(), faction), calm = A >= TRUCE_RULE.calmA; relation.status = calm ? 'neutral' : 'war'; relation.truceUntil = 0; delete relation.truceSince; relation.since = campaign.turn; campaign.notice = `${faction}군과의 휴전이 끝나 ${calm ? '중립' : '전쟁'} 상태로 돌아갔다.`; showDiplomacyResult(`${faction}군과 ${calm ? '중립 복귀' : '전쟁 재개'}`, ['휴전 기간이 끝났습니다.', `호감도 ${A} (${affinityStage(A).name}) ${calm ? `≥ ${TRUCE_RULE.calmA}이라 중립으로 복귀` : `< ${TRUCE_RULE.calmA}이라 전쟁`}`, `관계: 휴전 → ${calm ? '중립' : '전쟁'}`], calm); }
  roster.forEach((corps, index) => attachPopups(() => {
    const from = corps.at;
    if (corps.target) { const path = route(corps.at, corps.target); if (path.length < 2) corps.target = null; else { corps.prevAt = from; corps.at = path[1]; if (corps.at === corps.target) corps.target = null; } }
    if (from !== corps.at) enterNeutralCity(corps, stageById(corps.at));
    if (from !== corps.at) campaign.movement.push({ text: `${corpsName(corps)} · ${stageById(from).name} → ${stageById(corps.at).name} · 1턴 이동`, name: corpsName(corps), commander: corps.units[0] && Sim.U[corps.units[0]] ? Sim.U[corps.units[0]].name : corpsName(corps), from, to: corps.at, team: 'player', corpsIndex: index });
  }));
  flushMovePopups();   // 아군 군단의 이동 때문에 생긴 팝업(첫 이동)은 AI 쪽 사건보다 먼저 띄운다
  for (const f of enemyForces) if (f.rest > 0) f.rest--;
  relocateCapitals(); aiDiplomacyStep(); aiBattleStep(); advanceEnemyForces(); economyStep(); replenishPlayer(); reinforceEnemies(); reinforceCityGuards(); econWarning(); relocateCapitals(); flushDigest(); pendingSummary = { turn: campaign.turn - 1, moves: campaign.movement.map(m => ({ name: m.name, team: m.team, faction: m.faction, from: m.from, to: m.to })) }; skipEnemyMoves(); saveCampaign();
  if (!campaign.movement.length) continueCampaignTurn(); else flushMovePopups();
}
// 포로는 전투 편성과 분리하고 원 소속·성장치를 보존한다.
let custodyView = false, custodyPage = 0, turnSummary = null, pendingSummary = null, inTurnFlow = false;   // turnSummary: 새 턴 시작 때 띄우는 N턴 요약 {turn, lines}
let custodyRoll = tag => aiRoll('custody|' + tag);
const pendingPrisoners = () => (campaign.prisoners || []).filter(p => p.owner === playerFaction() && p.status === 'pending');
const recruitmentChance = p => Math.min(0.8, 0.2 + Math.max(0, campaign.turn - p.turn) * 0.05);
const custodyOpen = () => turnSummary || custodyView || pendingPrisoners().length;   // 사망·포로·투항 장수 소식은 전략 화면에서 따로 띄우지 않고 N턴 요약에만 싣는다
function custodyCorps(ref) {
  if (!ref) return null;
  const id = ref.slice(2);
  return ref.startsWith('p:') ? roster.find(c => c.id === +id) : forceById(id.startsWith('guard:') ? id : +id);
}
const custodyFaction = ref => ref && ref.startsWith('p:') ? playerFaction() : custodyCorps(ref) ? forceFaction(custodyCorps(ref)) : null;
function battleCorpsRef(u) {
  if (!u) return null;
  if (u.forceId != null) return 'e:' + u.forceId;
  if (String(u.army.corps).startsWith('ally:')) return 'e:' + String(u.army.corps).slice(5);
  return 'p:' + u.army.corps;
}
function heroCorpsRef(key) {
  const c = roster.find(c => c.units.includes(key)); if (c) return 'p:' + c.id;
  const f = enemyForces.find(f => f.army.units.includes(key)); return f ? 'e:' + f.id : null;
}
function custodyHolder(faction, stage) {
  if (faction === playerFaction()) { const c = roster.find(c => c.at === stage && combatReadyCorps(c)) || roster.find(combatReadyCorps); return c ? 'p:' + c.id : null; }
  const f = enemyForces.find(f => f.active && forceFaction(f) === faction && f.at === stage) || enemyForces.find(f => f.active && forceFaction(f) === faction);
  return f ? 'e:' + f.id : null;
}
function detachHero(key) {
  for (const c of roster) for (let i = 0; i < c.units.length; i++) if (c.units[i] === key) { c.units[i] = null; c.growth[i] = null; c.target = null; }
  for (const f of enemyForces) {
    for (let i = f.army.units.length - 1; i >= 0; i--) if (f.army.units[i] === key) { f.army.units.splice(i, 1); f.army.growth.splice(i, 1); }
    if (!f.army.units.includes(f.army.leader)) { const next = f.army.units.find(namedRosterUnit); if (next) f.army.leader = next; else f.active = false; }
  }
}
function placeCustodyHero(p, faction, ref, city) {
  if (heroCorpsRef(p.key) || campaign.fallen.includes(p.key) || !STAGES.some(s => stageFaction(s) === faction)) return false;
  const preferred = custodyFaction(ref) === faction && (faction !== playerFaction() || ref.startsWith('p:')) ? custodyCorps(ref) : null;
  if (faction === playerFaction()) {
    let c = [preferred, ...roster].find(c => c && c.units.some(k => !k));
    if (!c && roster.length < ROSTER_MAX) { c = { id: Math.max(0, ...roster.map(c => c.id)) + 1, name: Sim.U[p.key].name + ' 군단', at: city, target: null, units: Array(18).fill(null), growth: Array(18).fill(null) }; roster.push(c); }
    if (!c) return false;
    const slot = c.units.findIndex(k => !k); c.units[slot] = p.key; c.growth[slot] = { ...p.growth }; if (c === preferred) c.at = city;
    return true;
  }
  let f = [preferred, ...enemyForces.filter(f => forceFaction(f) === faction)].find(f => f && f.role !== 'garrison' && f.army.units.length < Sim.ARMY_MAX);
  if (!f) {
    f = { id: Math.max(-1, ...enemyForces.map(f => f.id)) + 1, fac: faction, at: city, home: city, active: true, level: p.growth.lv, role: 'expedition', army: { team: 'enemy', name: '', at: [45, 18], leader: p.key, units: [], growth: [], formation: 'block', trig: { t: 60, near: 12 } } }; enemyForces.push(f);
  }
  const leaderMissing = !f.army.units.some(namedRosterUnit);
  if (leaderMissing) { f.army.units.unshift(p.key); f.army.growth.unshift({ ...p.growth }); f.army.leader = p.key; } else { f.army.units.push(p.key); f.army.growth.push({ ...p.growth }); }
  f.active = true; if (f === preferred) f.at = city; f.army.name = faction + '군 · ' + Sim.U[f.army.leader].name + ' 부대'; return true;
}
function custodyAction(key, action) {
  const p = campaign.prisoners.find(p => p.key === key); if (!p) return false;
  const name = Sim.U[key].name, owner = p.owner;
  if (action === 'hold') { p.status = 'held'; campaign.custodyNews.push(owner + '군이 ' + name + '을(를) 포로로 수용했습니다.'); return true; }
  if (action === 'execute') {
    campaign.prisoners.splice(campaign.prisoners.indexOf(p), 1); campaign.fallen.push(key);
    campaign.custodyNews.push(owner + '군이 ' + name + '을(를) 처형했습니다.'); resolveSuccession(new Set([key])); return true;
  }
  if (action !== 'recruit' || p.lastAttempt === campaign.turn) return false;
  p.lastAttempt = campaign.turn;
  const at = custodyCorps(p.heldBy)?.at || p.at;
  if (custodyRoll('recruit|' + key) < recruitmentChance(p) && placeCustodyHero(p, owner, p.heldBy, at)) {
    campaign.prisoners.splice(campaign.prisoners.indexOf(p), 1); campaign.custodyNews.push(owner + '군이 ' + name + ' 투항에 성공했습니다.');
    resolveSuccession(new Set([key]), '이탈'); return true;
  }
  p.failed = true; campaign.custodyNews.push(owner + '군의 ' + name + ' 투항이 실패했습니다. 이번 턴 재시도 불가.'); return false;
}
function autoCustody(p, fresh = false) {
  if (fresh && custodyRoll('execute|' + p.key) < 0.15) custodyAction(p.key, 'execute');
  else if (!custodyAction(p.key, 'recruit') && campaign.prisoners.includes(p)) p.status = 'held';
}
function recordHeroFate(info) {
  if (campaign.fallen.includes(info.key) || campaign.prisoners.some(p => p.key === info.key)) return false;
  detachHero(info.key);
  const name = Sim.U[info.key].name;
  if (!info.captured || !FACTIONS.includes(info.owner) || info.owner === info.origin) {
    campaign.fallen.push(info.key); campaign.custodyNews.push(info.origin + '군 ' + name + '이(가) 전사했습니다.'); resolveSuccession(new Set([info.key])); return true;
  }
  const p = { key: info.key, origin: info.origin, owner: info.owner, originRef: info.originRef, home: info.home, heldBy: info.heldBy, at: info.at, growth: { ...info.growth }, turn: campaign.turn, lastAttempt: -1, failed: false, status: 'pending' };
  campaign.prisoners.push(p); campaign.custodyNews.push(info.origin + '군 ' + name + '이(가) ' + info.owner + '군에 포박되었습니다.');
  if (p.owner !== playerFaction()) autoCustody(p, true); return true;
}
function processCustodyTurn() {
  for (const p of [...campaign.prisoners]) {
    if (p.turn >= campaign.turn) continue;
    const own = s => s && stageFaction(s) === p.origin;
    const home = own(stageById(p.home)) ? p.home : STAGES.find(s => own(s) && s.id === campaignCapital(p.origin))?.id || STAGES.find(own)?.id;
    if (home && custodyRoll('escape|' + p.key) < 0.05 && placeCustodyHero(p, p.origin, p.originRef, home)) {
      campaign.prisoners.splice(campaign.prisoners.indexOf(p), 1); campaign.custodyNews.push(Sim.U[p.key].name + '이(가) 탈출하여 ' + p.origin + '군 ' + stageById(home).name + '(으)로 복귀했습니다.'); continue;
    }
    if (p.owner !== playerFaction()) autoCustody(p);
  }
}
function aiHeroFates(b) {
  if (b.custodyDone) return; b.custodyDone = true;
  const cases = [];
  for (const [ids, faction] of [[b.aIds, b.att], [b.dIds, b.def]]) for (const f of aiForcesOf(ids)) for (let i = 0; i < f.army.units.length; i++) {
    const key = f.army.units[i], rate = faction === b.winner ? b.lossW : b.lossL;
    if (!namedRosterUnit(key) || custodyRoll('casualty|' + b.stage + '|' + key) >= rate) continue;
    const owner = faction === b.att ? b.def : b.att;
    cases.push({ key, origin: forceFaction(f), originRef: 'e:' + f.id, home: f.home || f.at, at: b.stage, owner, heldBy: custodyHolder(owner, b.stage), captured: custodyRoll('capture|' + b.stage + '|' + key) < 0.5, growth: { ...(f.army.growth[i] || Sim.levelStats(key, 'enemy', f.level)) } });
  }
  cases.forEach(recordHeroFate);
}
function drawCustody() {
  ctx.fillStyle = '#082027'; ctx.fillRect(0, 0, VW, VH); panel(20, 20, 1240, 680, COLORS.gold, 3);
  const pending = pendingPrisoners(), manage = custodyView || pending.length, fy = mb(626, 608), CN = mb(5, 4), rp = mb(92, 104);
  label(turnSummary && !manage ? `${turnSummary.turn}턴 요약` : manage ? (pending.length ? '전투 후 포로 처우 결정' : '군단 편성 · 포로 관리') : '장수 전사·포로 일괄 보고', 50, 58, 27, COLORS.gold);
  if (!manage) {
    const lines = turnSummary && !manage ? turnSummary.lines : campaign.custodyNews; custodyPage = Math.max(0, Math.min(custodyPage, Math.ceil(lines.length / 9) - 1));
    lines.slice(custodyPage * 9, custodyPage * 9 + 9).forEach((line, i) => label(line, 52, 132 + i * 48, line.startsWith('■') ? 22 : 19, line.startsWith('■') ? COLORS.gold : COLORS.silver));
    button('custody:prev', 52, fy, 150, tb(46), '◀ 이전', false); button('custody:next', 220, fy, 150, tb(46), '다음 ▶', false);
    label((custodyPage + 1) + '/' + Math.max(1, Math.ceil(lines.length / 9)), 420, fy + mb(24, 43), 18, COLORS.silver);
    button('custody:report-close', 1030, fy, 190, tb(46), '확인', true, 20); return;
  }
  const list = pending.length ? pending : campaign.prisoners.filter(p => p.owner === playerFaction());
  custodyPage = Math.max(0, Math.min(custodyPage, Math.ceil(list.length / CN) - 1));
  label('투항 확률은 억류 기간에 따라 상승 · 실패한 턴에는 처형·포로만 선택 가능', 50, 98, 18, COLORS.silver2);
  list.slice(custodyPage * CN, custodyPage * CN + CN).forEach((p, i) => {
    const y = 130 + i * rp, holder = custodyCorps(p.heldBy), holderName = holder ? (holder.army ? holder.army.name : corpsName(holder)) : p.owner + '군 수용소';
    panel(40, y, 1200, mb(82, 96), COLORS.silver2, 1);
    label(Sim.U[p.key].name + ' · ' + p.origin + '군 · 억류 ' + (campaign.turn - p.turn) + '턴', 58, y + mb(24, 28), 21, COLORS.gold, 'left', 590);
    label(holderName + ' 포로 · Lv' + p.growth.lv, 58, y + mb(56, 68), 16, COLORS.silver, 'left', 590);
    const by = y + mb(17, 5), bh = tb(48);
    button('custody:execute:' + p.key, 656, by, 170, bh, '처형', false, 20);
    button('custody:hold:' + p.key, 846, by, 170, bh, p.status === 'pending' ? '포로' : '포로 유지', false, 20);
    if (p.lastAttempt === campaign.turn) { panel(1036, by, 170, bh, COLORS.dim, 1); label('투항 실패', 1121, by + bh / 2, 18, COLORS.dim, 'center'); }
    else button('custody:recruit:' + p.key, 1036, by, 170, bh, '투항 ' + Math.round(recruitmentChance(p) * 100) + '%', true, 20);
  });
  if (!list.length) label('보유한 포로가 없습니다.', 80, 180, 23, COLORS.silver);
  button('custody:prev', 52, fy, 150, tb(46), '◀ 이전', false); button('custody:next', 220, fy, 150, tb(46), '다음 ▶', false);
  label((custodyPage + 1) + '/' + Math.max(1, Math.ceil(list.length / CN)), 420, fy + mb(24, 43), 18, COLORS.silver);
  if (!pending.length) button('custody:close', 1030, fy, 190, tb(46), '관리 종료', true, 20);
  else label('남은 처우 ' + pending.length + '명', 1080, fy + mb(24, 43), 20, COLORS.gold);
}
function exploreCampaign(index) {
  const corps = roster[index]; if (!corps) return; const stage = stageById(corps.at); if (stage.owner !== 'player') { campaign.notice = '점령한 지역만 탐색할 수 있습니다.'; return; }
  campaign.corps = index; campaign.destination = corps.target;
  campaign.at = stage.id; campaign.from = null; campaign.notice = `${stage.name}을 탐색한다.`; startBattle(stage, true);
}
function applyBattleResults() {
  if (!S || !campaign.battle || S.custodyApplied) return; S.custodyApplied = true;

  const growthOf = u => ({ lv: u.lv, xp: u.xp, maxHp: u.maxHp, maxMp: u.maxMp, atk: Sim.itemBase(u, 'atk'), df: Sim.itemBase(u, 'df'), ad: Sim.itemBase(u, 'ad'), md: Sim.itemBase(u, 'md'), aa: u.aa, hr: u.hr, sp: u.sp, ar: Sim.itemBase(u, 'ar'), dr: Sim.itemBase(u, 'dr'), item: u.item, sg: u.sg || undefined });   // 아이템 보정은 빼고 저장 (떼면 사라지도록)
  const fates = S.units.filter(u => u.dead && namedRosterUnit(u.key)).map(u => {
    const originRef = heroCorpsRef(u.key) || battleCorpsRef(u), origin = custodyFaction(originRef) || (u.originTeam === 'player' ? playerFaction() : campaign.battle.faction);
    const captor = u.captor && { army: { corps: u.captor.corps }, forceId: u.captor.forceId };
    const captorRef = captor ? battleCorpsRef(captor) : null, owner = custodyFaction(captorRef) || (u.captor?.team === 'player' ? playerFaction() : campaign.battle.faction);
    const heldBy = custodyCorps(captorRef) ? captorRef : custodyHolder(owner, campaign.battle.id);
    return { key: u.key, origin, originRef, home: custodyCorps(originRef)?.home || custodyCorps(originRef)?.at || campaign.battle.id, owner, heldBy, at: campaign.battle.id, captured: !!u.captured, growth: growthOf(u) };
  });
  for (const u of S.units.filter(x => !x.dead && x.originTeam === 'player')) {
    const corps = roster.find(c => c.id === u.army.corps); if (corps && Number.isInteger(u.rosterSlot)) corps.growth[u.rosterSlot] = growthOf(u);
  }
  for (const u of S.units.filter(x => x.dead && x.originTeam === 'player')) {
    const corps = roster.find(c => c.id === u.army.corps); if (!corps || !Number.isInteger(u.rosterSlot)) continue; corps.units[u.rosterSlot] = null; corps.growth[u.rosterSlot] = null; if (u.item && !u.captured) campaign.items[u.item] = (campaign.items[u.item] || 0) + 1;
  }
  for (const u of S.units.filter(x => x.army && x.army.ally && x.dead)) { const force = enemyForces.find(f => 'ally:' + f.id === String(u.army.corps)), slot = force ? force.army.units.indexOf(u.key) : -1; if (slot >= 0) { force.army.units.splice(slot, 1); force.army.growth.splice(slot, 1); } }   // 동맹군(아군 편 AI 군단)의 손실도 전략맵 병력에 반영 (군단장 칸은 남긴다)
  for (const u of S.units.filter(x => x.originTeam === 'enemy' && (x.dead || x.team === 'player'))) { const force = enemyForces.find(f => f.id === u.forceId); if (!force) continue; const slot = force.army.units.indexOf(u.key); if (slot >= 0) { force.army.units.splice(slot, 1); force.army.growth.splice(slot, 1); } }
  for (const force of enemyForces) if (force.active && !force.army.units.includes(force.army.leader)) { const next = force.army.units.find(key => namedRosterUnit(key)); if (next) { force.army.leader = next; setEnemyRole(force, stageById(force.home) || stageById(force.at), force.role || 'garrison', force.level); } else force.active = false; }   // 군단장이 쓰러져도 군단에 이름 있는 장수가 남아 있으면 이어받고, 없으면 군단이 사라진다
  for (const u of S.units.filter(x => !x.dead && x.originTeam === 'enemy' && x.team === 'player' && !String(x.forceId).startsWith('guard:'))) {
    let corps = roster.find(c => c.units.some((x, i) => !x && i > 0)), slot = corps ? corps.units.findIndex((x, i) => !x && i > 0) : -1;
    if (!corps && roster.length < ROSTER_MAX) {
      const units = Array(18).fill(null), growth = Array(18).fill(null), newId = Math.max(...roster.map(c => c.id)) + 1;
      if (namedRosterUnit(u.key)) { units[0] = u.key; growth[0] = growthOf(u); slot = -1; }
      else {
        const donor = roster.map(c => ({ c, slot: c.units.findIndex((key, i) => i > 0 && namedRosterUnit(key)) })).find(x => x.slot >= 0);
        if (!donor) continue;
        units[0] = donor.c.units[donor.slot]; growth[0] = donor.c.growth[donor.slot]; donor.c.units[donor.slot] = null; donor.c.growth[donor.slot] = null; units[1] = u.key; growth[1] = growthOf(u); slot = -1;
      }
      corps = { id: newId, name: `신규 군단 ${newId}`, at: campaign.battle.id, target: null, units, growth }; roster.push(corps);
    }
    if (corps && slot >= 0) { corps.units[slot] = u.key; corps.growth[slot] = growthOf(u); }
  }
  for (const f of cityGuards) {
    const units = S.units.filter(u => u.forceId === f.id); if (!units.length) continue;
    const survivors = units.filter(u => !u.dead && !u.fled && u.team === u.originTeam);
    const bench = survivors.length ? benched.get(f.id) : null; benched.delete(f.id);   // 덜어 두었던 병사는 싸우지 않았으니 수비군이 살아남았을 때만 그대로 남는다 (전멸하면 함께 무너진 것으로 본다)
    f.army.units = survivors.map(u => u.key).concat(bench ? bench.units : []); f.army.growth = survivors.map(growthOf).concat(bench ? bench.growth : []); f.active = f.army.units.length > 0;
  }
  fates.forEach(recordHeroFate);
}
// 아이템 획득 (명세 12 보강): 전투 승리 시 쓰러뜨린 적에게서 드롭 + 지역 첫 점령 보상. 확률·보상표는 설계 추정.
const DROP_POOL = Object.keys(Sim.ITEMS).filter(k => !Sim.ITEMS[k].unique), DROP_RATE = { soldier: 0.02, captain: 0.15, hero: 0.35 };
const CAPTURE_REWARD = ['ironsword', 'armor', 'bowguard', 'charm', 'seal_ar', 'seal_dr', 'ironsword', 'armor', 'bowguard'];
const addItem = k => { campaign.items[k] = (campaign.items[k] || 0) + 1; return Sim.ITEMS[k].name; };
function battleDrops() {   // S: 방금 승리한 전투
  const got = []; for (const u of S.units) if (u.originTeam === 'enemy' && u.dead && !u.captured) { const T = Sim.U[u.key], rate = T.generic ? DROP_RATE.soldier : T.name.startsWith('적 ') || T.synthetic ? DROP_RATE.captain : DROP_RATE.hero; if (S.rnd() < rate) got.push(addItem(DROP_POOL[Math.floor(S.rnd() * DROP_POOL.length)])); }
  return got;
}
function captureReward(stage) { if (stage.stage < 2 || campaign.rewarded[stage.id]) return ''; campaign.rewarded[stage.id] = true; return addItem(CAPTURE_REWARD[(stage.stage - 2) % CAPTURE_REWARD.length]); }
// 정찰은 인접 지역, 외교는 각 세력 수도에서만 진행한다.
const corpsNear = stage => roster.map((c, i) => ({ c, i })).filter(({ c }) => c.units.some(Boolean) && (c.at === stage.id || stage.links.includes(c.at)));
const RELATION_NAME = { neutral: '중립', ally: '동맹', truce: '휴전', war: '전쟁' };
const relationText = faction => { const r = relationOf(faction); return r.status === 'truce' ? `휴전 ${Math.max(0, r.truceUntil - campaign.turn)}턴` : RELATION_NAME[r.status]; };
// ---- 호감도·성공 확률·제안 (명세 62 A1~A6) ----
const relBetween = (a, b) => a === playerFaction() ? relationOf(b) : b === playerFaction() ? relationOf(a) : aiRel(a, b);
const cityCount = f => f === playerFaction() ? STAGES.filter(s => s.owner === 'player').length : STAGES.filter(s => s.owner === 'enemy' && s.faction === f).length;
const commonEnemy = (a, b) => FACTIONS.some(t => t !== a && t !== b && !factionDead(t) && relBetween(a, t).status === 'war' && relBetween(b, t).status === 'war');
function addAffinity(a, b, delta, why) {   // 호감도 변경은 모두 여기를 지난다: -100..100 으로 자르고, 사유가 있으면 최근 변화로 기록하며, 단계가 바뀌면 소식을 낸다
  const key = pairKey(a, b), A = campaign.affinity; if (!A || !(key in A) || !delta) return 0;
  const before = A[key]; if (Math.abs(before + delta) > Math.abs(before)) { const x = delta / (Math.abs(before) > 90 ? 8 : Math.abs(before) > 80 ? 4 : Math.abs(before) > 60 ? 2 : 1), base = Math.trunc(x); delta = base + (aiRoll('aff|' + key + '|' + before + '|' + delta) < Math.abs(x - base) ? Math.sign(x) : 0); }   // 극단으로 더 치우치는 변화는 |A|>60 에서 절반, >80 에서 1/4, >90 에서 1/8 (소수는 결정적 확률 반올림이라 ±1 시간 변화도 평균 1/2·1/4 로 이어진다) — 장기전 포화(±100) 완화(설계값)
  A[key] = Math.max(-100, Math.min(100, before + delta)); const d = A[key] - before; if (!d) return 0;
  if (why) campaign.affLast[key] = { turn: campaign.turn, delta: d, why };
  const s0 = affinityStage(before).name, s1 = affinityStage(A[key]).name;
  if (s0 !== s1) { const mine = [a, b].includes(playerFaction()); aiNews(mine ? 'B' : 'C', `${a}군 ↔ ${b}군 관계: ${s0} → ${s1}`, [`호감도 ${before} → ${A[key]}${why ? ' (' + why + ')' : ''}`], d > 0, '외교'); if (mine) (campaign.dipLog ||= []).push(`${a === playerFaction() ? b : a}군 호감도 ${s0} → ${s1}${why ? '(' + why + ')' : ''}`); }
  return d;
}
function diplomacyChance(a, b, action) {   // a 가 b 에게 휴전·동맹을 제안할 때 성공률(%) — 하한 5, 상한 휴전 90·동맹 85
  const key = pairKey(a, b), A = affinityOf(a, b), C = commonEnemy(a, b) ? (action === 'ally' ? 25 : 15) : 0, rho = cityCount(b) / Math.max(1, cityCount(a)), F = DIP_CHANCE.fatigue * ((campaign.truceStreak || {})[key] || 0);
  const W = rho >= 2 ? -12 : rho >= 1.25 ? -5 : rho >= 0.8 ? 0 : rho >= 0.5 ? 5 : 10;
  if (action === 'ally') return Math.max(DIP_CHANCE.min, Math.min(DIP_CHANCE.maxAlly, DIP_CHANCE.ally + 0.8 * (A - 10) + C + W));
  return Math.max(DIP_CHANCE.min, Math.min(DIP_CHANCE.maxTruce, (relBetween(a, b).status === 'war' ? DIP_CHANCE.truceWar : DIP_CHANCE.truceOther) + 0.6 * A + C + W - F));
}
function allyAllowed(a, b) {   // 동맹 조건: 중립·휴전이고 호감도 +30 이상, 또는 휴전 10턴 이상 지속 + 호감도 +10 이상
  const r = relBetween(a, b), A = affinityOf(a, b); if (!['neutral', 'truce'].includes(r.status)) return false;
  return A >= 30 || r.status === 'truce' && A >= 10 && campaign.turn - (r.truceSince ?? r.since ?? r.truceUntil - 20) >= 10;
}
function diplomacyOption(a, b, action) {   // {ok, p(%), why}: 버튼 활성 여부·성공률·불가 이유
  const st = relBetween(a, b).status, cool = a === playerFaction() ? (campaign.dipCool || {})[b] || 0 : (campaign.aiCool || {})[pairKey(a, b)] || 0;
  if (factionDead(b)) return { ok: false, p: 0, why: '멸망한 세력' };
  if (action === 'war') return st === 'war' ? { ok: false, p: 0, why: '이미 전쟁 중' } : { ok: true, p: 100, cost: WAR_COST[st] || 5 };
  if (cool > campaign.turn) return { ok: false, p: 0, why: `다음 외교 가능: ${cool - campaign.turn}턴 후` };
  let why = '';
  if (action === 'truce') { if (st === 'ally') why = '동맹 중에는 휴전이 필요 없습니다'; else if (st === 'truce' && relBetween(a, b).truceUntil - campaign.turn > 5) why = `휴전 ${relBetween(a, b).truceUntil - campaign.turn}턴 남음 — 5턴 이하에서 갱신`; else if (st !== 'war' && ((campaign.truceStreak || {})[pairKey(a, b)] || 0) >= TRUCE_RULE.maxRenew) why = `연속 휴전 한도(${TRUCE_RULE.maxRenew}회) — 전투 뒤 다시`; }
  else if (st === 'ally') why = '이미 동맹'; else if (st === 'war') why = '전쟁 중에는 동맹 불가'; else if (!allyAllowed(a, b)) why = '호감도 +30 이상 또는 휴전 10턴 후(+10 이상)';
  return why ? { ok: false, p: 0, why } : { ok: true, p: diplomacyChance(a, b, action) };
}
function proposeDiplomacy(target, action) {   // 플레이어 제안: 성공 확률 판정 → 성립(setDiplomacy)·거절(호감도 하락·3턴 쿨다운). 같은 턴 같은 제안은 결과가 같다(aiRoll)
  const P = playerFaction(), opt = diplomacyOption(P, target, action); if (!opt.ok) return { ok: false, blocked: opt.why };
  const was = relationOf(target).status, before = affinityOf(P, target);
  if (action === 'war') { addAffinity(P, target, -opt.cost, was === 'ally' ? '동맹 파기' : was === 'truce' ? '휴전 파기' : '선전포고'); setDiplomacy(target, 'war', false, [`호감도 ${before} → ${affinityOf(P, target)} (${affinityStage(affinityOf(P, target)).name})`]); (campaign.truceStreak ||= {})[pairKey(P, target)] = 0; return { ok: true, war: true, before, after: affinityOf(P, target) }; }
  if (aiRoll('dip|' + target + '|' + action) * 100 < opt.p) {
    if (action === 'truce' && was === 'truce') { const k = pairKey(P, target); (campaign.truceStreak ||= {})[k] = (campaign.truceStreak[k] || 0) + 1; }
    addAffinity(P, target, action === 'truce' ? 5 : 10, action === 'truce' ? '휴전 성립' : '동맹 성립'); if (action === 'truce' && was === 'truce') addAffinity(P, target, -TRUCE_RULE.renewCost * campaign.truceStreak[pairKey(P, target)], '연속 휴전 갱신'); setDiplomacy(target, action, false, [`성공률 ${Math.round(opt.p)}% · 호감도 ${before} → ${affinityOf(P, target)} (${affinityStage(affinityOf(P, target)).name})`]); return { ok: true, chance: opt.p, before, after: affinityOf(P, target) };
  }
  addAffinity(P, target, action === 'truce' ? -2 : -4, '제안 거절'); (campaign.dipCool ||= {})[target] = campaign.turn + 3; diplomacyView = null;
  showDiplomacyResult('외교 거절', [`${target}군이 ${action === 'truce' ? '휴전' : '동맹'} 제안을 거절했습니다. (성공률 ${Math.round(opt.p)}%)`, `호감도 ${before} → ${affinityOf(P, target)} (${affinityStage(affinityOf(P, target)).name})`, '다음 외교는 3턴 뒤부터 가능합니다.'], false, '외교');
  return { ok: false, refused: true, chance: opt.p };
}
function affinityStep() {   // 매 턴: 전쟁 −1, 휴전 2턴마다 +1(≤60), 동맹 +1(≤100), 공통의 적 +1(≤40), 선두(도시 40%↑) 견제 4턴마다 −1. 시간 변화는 '최근 변화' 에 남기지 않는다
  const live = FACTIONS.filter(f => !factionDead(f)), total = STAGES.length; campaign.warSince ||= {}; campaign.truceStreak ||= {};
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j], key = pairKey(a, b), st = relBetween(a, b).status, A = affinityOf(a, b);
    if (st === 'war') { if (!(key in campaign.warSince)) campaign.warSince[key] = campaign.turn; else if (campaign.turn - campaign.warSince[key] >= 5) campaign.truceStreak[key] = 0; if (campaign.turn % WAR_DECAY_EVERY === 0 && A > WAR_DRIFT_FLOOR) addAffinity(a, b, -1); } else delete campaign.warSince[key];
    if (st === 'truce' && campaign.turn % TRUCE_RULE.driftEvery === 0 && A < TRUCE_RULE.driftCap) addAffinity(a, b, 1);
    if (st === 'ally' && A < 100) addAffinity(a, b, 1);
    if (['neutral', 'truce'].includes(st) && commonEnemy(a, b) && A < 40) addAffinity(a, b, 1);
  }
  if (campaign.turn % 4 === 0) for (const f of live) if (cityCount(f) / total >= 0.4) for (const o of live) if (o !== f) addAffinity(o, f, -1);
}
function captureAffinity(att, def, stage, wasCap) {   // 도시 점령: 일반 도시 -12, 상대 수도 -25, 그 쌍의 휴전 피로 초기화
  const key = pairKey(att, def), cl = campaign.capLast ||= {}; if (!wasCap && cl[key] === campaign.turn) return; cl[key] = campaign.turn;   // 같은 턴 같은 쌍의 연속 점령은 한 번만 반영 (수도는 항상) — 한 세력이 도시를 쓸어 담을 때 호감도가 -100 에 붙는 것을 막는다
  addAffinity(att, def, wasCap ? -25 : -12, `${campaign.turn}턴 ${stage.name} 점령`); if (campaign.truceStreak) campaign.truceStreak[pairKey(att, def)] = 0;
}
function useMapTool(stage) {
  const tool = mapTool; mapTool = null;
  if (stage.owner === 'player') { if (tool === 'diplomacy') showDiplomacyResult('외교 실패', ['아군 지역과는 외교할 수 없습니다.', '다른 세력의 수도를 선택하세요.'], false); else campaign.notice = '적이 있는 지역을 선택하세요.'; return; }
  if (tool === 'diplomacy') {
    if (!isCapital(stage) || factionDead(stage.faction)) { showDiplomacyResult('외교 실패', [`${stage.name}에서는 외교를 할 수 없습니다.`, '외교는 각 세력의 수도에서만 진행할 수 있습니다.'], false); return; }
    diplomacyView = stage.faction; campaign.notice = `${stage.faction}군과의 외교 선택`; return;
  }
  const near = corpsNear(stage); if (!near.length) { campaign.notice = `${stage.name}은 군단이 같은 지역이나 연결된 지역에 있어야 합니다.`; return; }
  if (tool === 'scout') { scoutView = stage.id; campaign.notice = `${stage.name} 정찰 보고`; return; }
}
let popupSink = null;   // 이동 한 건을 처리하는 동안 생긴 팝업을 모아 두는 곳 — 그 이동이 표시되는 쪽에서 띄운다
function attachPopups(run) {
  const before = campaign.movement.length; popupSink = [];
  try { run(); } finally {
    const got = popupSink; popupSink = null;
    if (got.length) { if (campaign.movement.length > before) campaign.movement[campaign.movement.length - 1].popups = got; else got.forEach(p => showDiplomacyResult(p.title, p.lines, p.ok, p.kind)); }
  }
}
function flushMovePopups() {   // 지금 보이는 이동 안내의 팝업을 띄운다
  const m = campaign.movement[campaign.movementPage]; if (!m || !m.popups) return;
  const list = m.popups; m.popups = null; list.forEach(p => showDiplomacyResult(p.title, p.lines, p.ok, p.kind));
}
function showDiplomacyResult(title, lines, ok = true, kind = '') { if (popupSink) { popupSink.push({ title, lines, ok, kind }); return; } const r = { title, lines, ok, kind }; if (diplomacyResult) diplomacyQueue.push(r); else diplomacyResult = r; campaign.notice = title; }   // 외교 행위의 결과는 항상 팝업으로 알린다
function setDiplomacy(faction, status, silent = false, extra = []) {   // silent: 호출한 쪽이 따로 결과 팝업을 띄울 때
  const before = campaign.relations[faction] ? relationText(faction) : '중립';
  const relation = campaign.relations[faction] || (campaign.relations[faction] = { status: 'neutral', truceUntil: 0 });
  const wasAlly = relation.status === 'ally';
  if (status === 'truce' && relation.status !== 'truce') relation.truceSince = campaign.turn; else if (status !== 'truce') delete relation.truceSince;   // 최초 휴전 시작 턴: 갱신해도 유지 (동맹 조건 '휴전 10턴')
  relation.status = status; relation.truceUntil = status === 'truce' ? campaign.turn + 20 : 0; relation.since = campaign.turn;
  const evicted = []; if (wasAlly && status !== 'ally') for (const corps of roster) { const st = stageById(corps.at); if (corps.units.some(Boolean) && st && st.owner === 'enemy' && st.faction === faction) { const back = alliedBack(corps, st); if (back) { corps.at = back.id; corps.target = null; evicted.push(`${corpsName(corps)} → ${back.name}`); } } }   // 동맹이 깨졌으니 그 도시에 머무를 수 없다
  const roster0 = roster[campaign.corps]; if (evicted.length && roster0) campaign.at = roster0.at;
  campaign.notice = `${faction}군과 ${status === 'truce' ? '20턴 휴전' : RELATION_NAME[status]} 상태가 되었다.`; diplomacyView = null; saveCampaign();
  if (!silent) showDiplomacyResult(`${faction}군과의 외교: ${status === 'war' ? '전쟁 선포' : status === 'truce' ? '휴전 성립' : '동맹 성립'}`, [`관계: ${before} → ${relationText(faction)}`, status === 'war' ? '즉시 서로 공격할 수 있습니다.' : status === 'truce' ? `20턴 동안(${campaign.turn + 20}턴까지) 서로 침공하지 않습니다.` : '동맹이 되었습니다.' + (FACTION_ALLIES[faction] ? ` ${FACTION_ALLIES[faction]}군과는 상호 동맹 관계입니다.` : ''), ...extra, ...evicted.map(e => `주둔 군단 철수: ${e}`)], status !== 'war');
}
let capturedOnWin = false;   // 승리 화면이 뜨는 순간 도시가 먼저 내 것이 되므로, 원래 내 도시였는지(방어) 점령이었는지를 따로 기억한다
function finishBattle() {
  const turnEncounter = campaign.pendingEncounter; applyBattleResults(); const active = roster[campaign.corps], lostHome = S && S.over !== 'win' && campaign.invasion && campaign.battle && campaign.battle.id === playerCapital();
  const routed = new Set(S ? S.armies.filter(A => A.team === 'enemy' && A.routed).map(A => A.forceId) : []);
  for (const force of enemyForces.filter(f => f.active && routed.has(f.id) && campaign.battle && f.at === campaign.battle.id)) {
    const fallback = route(force.at, capitalFor(force)), back = force.prevAt && stageById(force.prevAt) ? force.prevAt : fallback[1]; if (back) force.at = back; else force.active = false; force.prevAt = null;
  }
  if (S && S.over === 'win' && campaign.battle) {
    const foeIds = new Set(S.armies.filter(A => A.team === 'enemy' && A.forceId != null).map(A => A.forceId));   // 적 편으로 싸운 군단만 물러난다 — 아군 편 동맹 수비군·원군은 그 도시에 남는다
    for (const force of enemyForces.filter(f => f.active && f.at === campaign.battle.id && foeIds.has(f.id))) { const path = route(force.at, capitalFor(force)); if (path.length > 1) force.at = path[1]; else force.active = false; }
    const keep = isAllyCity(campaign.battle), drops = battleDrops();   // keep: 동맹 중립 세력의 도시를 요격해 지킨 경우 — 점령하지 않고 그 세력의 도시로 유지
    if (keep) campaign.notice = `${campaign.battle.name} 방어에 성공했다. 동맹 ${campaign.battle.faction}군의 도시로 유지된다.${drops.length ? ' 전리품: ' + drops.join(', ') + '.' : ''}`;
    else if (campaign.battle.owner === 'player' && !capturedOnWin) campaign.notice = `${campaign.battle.name} 방어에 성공했다.${drops.length ? ' 전리품: ' + drops.join(', ') + '.' : ''}`;
    else { if (campaign.battle.faction && campaign.battle.faction !== playerFaction()) captureAffinity(playerFaction(), campaign.battle.faction, campaign.battle, campaignCapital(campaign.battle.faction) === campaign.battle.id); campaign.battle.owner = 'player'; resetCityGuards(campaign.battle, captureRatio(campaign.battle)); relocateCapitals(); const prize = captureReward(campaign.battle); campaign.notice = `${eulReul(campaign.battle.name)} 점령했다.${captureNote(campaign.battle)}${prize ? ' 점령 보상: ' + prize + '.' : ''}${drops.length ? ' 전리품: ' + drops.join(', ') + '.' : ''}`; }
  }
  else if (campaign.explore) campaign.notice = `${campaign.battle.name} 탐색을 마쳤다.`;
  else { campaign.notice = `${campaign.battle ? campaign.battle.name : '전장'}에서 후퇴했다.`; if (campaign.invasion && campaign.battle) enemyTakesCity(campaign.battle); if (campaign.from) active.at = campaign.from; }
  if (lostHome) { defeatCampaign(`${stageById(playerCapital()).name} 방어에 실패하여 원정에 패배했습니다.`); return; }
  campaign.at = active.at; campaign.destination = active.target; campaign.from = null; campaign.battle = null; campaign.explore = false; campaign.invasion = false; capturedOnWin = false; S = null; state = 'map'; overAt = 0; menuOpen = false; supportOpen = false; selectMode = false; centerMap();
  if (completeCampaignIfWon()) return;
  if (turnEncounter) finishMovementStep(); else saveCampaign();
}
const army = () => S.armies[armyIdx];
const ctrlOf = () => army().ctrl;
const activePlayerArmies = () => S.armies.filter(A => A.team === 'player' && !A.ally && A.units.length && (!A.support || A.state !== 'support'));
const corpsKey = A => String(A.corps);
const pArmies = () => { const key = corpsKey(army()); return activePlayerArmies().filter(A => corpsKey(A) === key).slice(0, 3); };
const armySlots = () => { const list = pArmies(); return Array.from({ length: 3 }, (_, i) => list.find(A => A.squadIndex === i) || { empty: true, name: `${i + 1}분대`, units: [] }); };
const supportArmies = () => { const all = S.armies.filter(A => A.team === 'player' && A.support && A.state === 'support' && A.units.some(u => !u.dead && u.out)); return all.filter((A, i) => all.findIndex(B => B.corps === A.corps) === i); };
const nextArmy = dir => { const l = pArmies(), i = l.indexOf(army()); return l[(i + dir + l.length) % l.length].id; };   // 조작 부대 순환
const nextCorps = () => { const all = activePlayerArmies(), l = all.filter((A, i) => all.findIndex(B => corpsKey(B) === corpsKey(A)) === i), n = l.findIndex(A => corpsKey(A) === corpsKey(army())); return l[(n + 1) % l.length].id; };
const alive = u => Sim.live(u);
let look = null, mini = null, miniPtr = -1;   // look: 미니맵으로 잠시 둘러보기, mini: 이번 프레임 미니맵 영역, miniPtr: 미니맵을 누르고 있는 포인터
function lookAt(p) { look = { x: (p.x - mini.x) / mini.k, y: (p.y - mini.y) / mini.k, until: T + 4 }; }
const inMini = p => mini && p.x >= mini.x && p.x < mini.x + mini.w && p.y >= mini.y && p.y < mini.y + mini.h;
function camTarget() { const u = ctrlOf(), z = Z(); if (look && T < look.until) return [look.x - VPW / z / 2, look.y - vh / z / 2]; return u ? [u.x - VPW / z / 2, u.y - vh / z / 2] : [cam.x, cam.y]; }
function clampCam() { const z = Z(); cam.x = Math.max(0, Math.min(WW - VPW / z, cam.x)); cam.y = Math.max(0, Math.min(WH - vh / z, cam.y)); }
function snapCam() { const [x, y] = camTarget(); cam.x = x; cam.y = y; clampCam(); }
const toWorld = (sx, sy) => [(sx - LEFT_W) / Z() + cam.x, (sy - TB_H) / Z() + cam.y];
const inView = (x, y) => x >= LEFT_W && x < VW && y >= TB_H && y < TB_H + vh;
const tcx = t => (t + 0.5) * TILE, tcy = t => (t + 0.5) * TILE + 8;

// ---------- 그리기 도구 ----------
const TOUCH = 86, MIN_FONT = 22;   // 모바일: 812×375 에서 캔버스가 0.5208 배로 줄어 보이므로 44 CSS px = 가상 85 이상, 글자는 11 CSS px = 가상 21 이상
const tb = h => mobile ? Math.max(h, TOUCH) : h;   // 모바일 터치 최소 높이
const mb = (pc, mob) => mobile ? mob : pc;   // 화면별 PC/모바일 치수 선택
const listN = () => mobile ? 5 : 8;   // 군단 선택 목록(이동·탐색)의 한 쪽 줄 수 — 모바일은 줄 높이를 86px 로 키운 만큼 줄인다
function label(s, x, y, size, col, align = 'left', maxW) {   // maxW: 넘치면 글자를 가로로 눌러 영역 밖으로 나가지 않게 한다 (모바일 겹침 방지)
  size = Math.round(size * FS / wz); if (mobile && wz === 1 && !worldDraw) size = Math.max(size, MIN_FONT);
  ctx.font = `bold ${size}px sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineWidth = size / 5; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineJoin = 'round'; if (maxW && mobile) { ctx.strokeText(s, x, y, maxW); ctx.fillStyle = col; ctx.fillText(s, x, y, maxW); } else { ctx.strokeText(s, x, y); ctx.fillStyle = col; ctx.fillText(s, x, y); }
}
function panel(x, y, w, h, border, bw = 2, fill = 'rgba(10,12,20,.92)') { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); ctx.strokeStyle = border; ctx.lineWidth = bw; ctx.strokeRect(x, y, w, h); }
function bar(x, y, w, h, p, col) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x, y, w, h); ctx.fillStyle = col; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, p)), h); }
function button(id, x, y, w, h, text, on, size = 16) {
  panel(x, y, w, h, on ? COLORS.gold : COLORS.silver2, on ? 3 : 2);
  label(text, x + w / 2, y + h / 2, size, on ? COLORS.goldSel : COLORS.silver, 'center', mobile ? w - 12 : undefined);
  btns.push({ id, x, y, w, h });
}
const styleOf = u => { let style = STYLES[u.style]; if (style.teamBase && u.team === 'enemy') { const b = STYLES[ENEMY_BASE_STYLE[style.teamBase]]; style = { ...style, body: b.body, trim: b.trim, skin: b.skin, ...(b.horse ? { horse: b.horse } : {}), ...(style.enemyHelm ? { helmColor: style.enemyHelm } : {}) }; }   // 고유 병종은 팀색(아군 청색·적 암색)을 유지하고 장식으로 구별
  return u.key !== 'guan' && !style.fixedWeapon && (u.category === 'sword' || u.category === 'spear') ? { ...style, weapon: u.category === 'spear' ? 'spear' : 'sword' } : style; };
const stText = u => u.captured ? '포박' : u.dead ? '전사' : u.fled ? '도주' : u.out ? '철수' : u === u.army.ctrl && u.team === 'player' && (!S.auto || u.manual) ? '조작' : (ORDER_NAME[u.order.type] || '자유');
const hpCol = (p, current = COLORS.ally) => p > 0.3 ? current : p > 0.1 ? '#999999' : COLORS.danger;
function actionInfo(u, alt = false) {
  const spell = !alt && u.spells.length ? SPELL[u.spells[u.spellSel]] : null;
  const special = u.special && (!alt || u.spells.length) ? SPECIAL[u.special] : null;
  const name = spell ? spell.name : special ? special.name : u.range > 0 ? '화살' : '공격';
  const cd = spell ? Math.max(u.cdT, S.lock.player) : special ? u.spT : u.range > 0 ? u.cdT : 0;
  return { name, cd: Math.max(0, cd), ready: cd <= 0 && (!spell || u.mp >= spell.mp) };
}
const cooldownText = a => a.cd > 0 ? a.cd.toFixed(1) + '초' : a.ready ? '준비' : '불가';

// ---------- 월드 그리기 ----------
function drawUnit(u) {
  const x = u.x, y = u.y, ally = u.team === 'player', mine = u === ctrlOf(), other = ally && pArmies().some(A => A !== army() && A.ctrl === u);
  ctx.save(); ctx.lineWidth = mine ? 4 : 3; ctx.strokeStyle = mine ? COLORS.gold : ally ? COLORS.ally : COLORS.danger;   // 팀 표시(아트방향 5-5): 아군 청 실선 / 적 주홍 점선 / 조작 중 금
  drawBattleRing(ctx,x,y+u.r*0.35,u.r*1.3,u.r*0.7,ctx.strokeStyle,!ally&&!mine); ctx.restore();
  { const marks = [...(u.buffs || []).map(b => [true, b.col]), [u.ftDebuffT > 0, '#ff9a4a'], ...Object.entries(u.auraOn || {}).filter(([, on]) => on).map(([k]) => [true, Sim.TITLE_EFFECT[k].col])].filter(m => m[0]), pulse = 0.45 + 0.3 * Math.sin(T * 6);   // 효과가 켜져 있는 동안 발밑에 색 고리 (공격 금·방어 청·피로 디버프 주황)
    if (marks.length) { ctx.save(); marks.forEach((m, i) => { ctx.globalAlpha = pulse; drawBattleRing(ctx,x,y+u.r*0.35,u.r*(1.6+i*0.28),u.r*(1.6+i*0.28)*0.55,m[1]); }); ctx.restore(); }
    const TA = (Sim.TITLE_EFFECT[u.subclass] || {}).aura && Sim.TITLE_EFFECT[u.subclass]; if (TA) { ctx.save(); ctx.globalAlpha = 0.16 + 0.06 * Math.sin(T * 3); drawBattleRing(ctx,x,y+u.r*0.35,Sim.AURA_RANGE,Sim.AURA_RANGE*0.55,TA.col,true); ctx.restore(); } }   // 무신(관우 등) 공격·화살·마법 방어 +20%, 간웅(조조) 전 능력 +10% 오라 범위
  const swing = u.anim > 0 ? -1.3 + 2.6 * (1 - u.anim / 0.28) : 0.9;
  const k = Math.max(0, Math.min(1, u.hitT / (u.hitDuration || 0.35))), mag = (u.hitMag || 1) * (u.hitState < 0 ? 1.25 : u.hitState > 0 ? 0.55 : 1), ds = Math.cos(u.hitAng) >= 0 ? 1 : -1, ap = !u.named && u.anim > 0 && u.range === 0 ? Math.sin((1 - u.anim / 0.28) * Math.PI) : 0;   // 상성 우세는 짧은 방어 반응, 불리는 강한 경직
  const ox = Math.cos(u.hitAng) * 7 * mag * k + Math.sin(T * 100) * 2.5 * k + Math.cos(u.face) * 7 * ap, oy = Math.sin(u.hitAng) * 5 * mag * k + Math.sin(u.face) * 4 * ap;
  ctx.save(); ctx.translate(Math.round(ox), Math.round(oy));
  drawBattleBody(ctx, x, y, u.r * 1.15, u.face, styleOf(u), { team:u.team, pose: heroPose(u, styleOf(u), S.t), flash: u.flash > 0, t: T + u.id, moving: u.moving, weaponAng: u.face + swing - ds * 0.9 * mag * k, weaponLen: u.r * (u.isLeader ? 4.4 : 3.4) });
  ctx.restore();
  const style = styleOf(u), top = y - battleSpriteHeight(u.r*1.15,style) - 6, w = u.r * 2.4;
  if (ally || u.hp < u.maxHp || u.isLeader) { bar(x - w / 2, top, w, 4, u.hp / u.maxHp, hpCol(u.hp / u.maxHp, ally ? COLORS.ally : COLORS.danger)); if (u.maxMp && ally) bar(x - w / 2, top + 5, w, 2, u.mp / u.maxMp, '#8a6aff'); const sk = u.special && Sim.SPECIAL[u.special]; if (sk) { const ready = u.spT <= 0, cy = top + (u.maxMp && ally ? 8 : 5); bar(x - w / 2, cy, w, 2.5, ready ? 1 : 1 - Math.max(0, u.spT) / sk.cd, ready ? COLORS.gold : '#c7822f'); } }   // 특수기(스킬) 쿨타임 바: 차오르는 중 주황, 준비되면 금색 가득
  if (mine || other) { ctx.fillStyle = mine ? COLORS.gold : COLORS.ally; ctx.beginPath(); ctx.moveTo(x - 7, top - 14); ctx.lineTo(x + 7, top - 14); ctx.lineTo(x, top - 4); ctx.closePath(); ctx.fill(); }
  if ((u.named && !Sim.U[u.key].synthetic) || u.isLeader) { const current = u.named ? (ally ? COLORS.goldSel : '#ff9a8a') : ally ? COLORS.silver : '#ffb0a0'; label(u.name, x, top - (mine ? 26 : 12), u.named ? 17 : 16, hpCol(u.hp / u.maxHp, current), 'center'); }   // 이름도 HP 30%·10% 구간을 같이 표시
}
function drawWorld() {
  if(terrain.battleAtlasReady===false&&BATTLE_ART.ready)terrain=buildTerrain(S.map,Sim.MW,Sim.MH,TILE);
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.beginPath(); ctx.rect(LEFT_W, TB_H, VPW, vh); ctx.clip();
  const z = Z(), vw = VPW / z, vhh = vh / z; wz = z; worldDraw = true;
  ctx.drawImage(terrain, cam.x, cam.y, vw, vhh, LEFT_W, TB_H, VPW, vh);
  ctx.translate(LEFT_W, TB_H); ctx.scale(z, z); ctx.translate(-cam.x, -cam.y);
  const tileBox = (tx, ty, col, fill) => { if (fill) { ctx.fillStyle = fill; ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE); } ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(tx * TILE + 1, ty * TILE + 1, TILE - 2, TILE - 2); };
  const c = ctrlOf();
  if (c && alive(c)) { tileBox(c.tx, c.ty, COLORS.gold, 'rgba(255,211,77,.16)'); if (c.mv) tileBox(c.mv.nx, c.mv.ny, 'rgba(255,211,77,.5)'); }   // 조작 캐릭터가 서 있는 칸
  for (const t of new Set(army().units.filter(u => alive(u) && u.order.type === 'attack' && u.order.target && alive(u.order.target)).map(u => u.order.target))) tileBox(t.tx, t.ty, COLORS.danger, 'rgba(255,90,74,.18)');   // 집중 공격 표적
  for (const m of marks) { const tx = Math.floor(m.x / TILE), ty = Math.floor(m.y / TILE), g = 1.4 - m.t; ctx.strokeStyle = m.col; ctx.globalAlpha = m.t / 0.7; ctx.lineWidth = 3; ctx.strokeRect(tx * TILE - g * 6, ty * TILE - g * 6, TILE + g * 12, TILE + g * 12); ctx.globalAlpha = 1; }
  for (const f of S.fx) drawBattleEffect(ctx, f, T);
  for (const u of S.units.filter(alive).sort((a, b) => a.y - b.y)) { if (u.x < cam.x - 60 || u.x > cam.x + vw + 60 || u.y < cam.y - 90 || u.y > cam.y + vhh + 60) continue; drawUnit(u); }
  for (const p of S.proj) drawBattleProjectile(ctx, p);
  for (const t of S.texts) { if (t.k && t.k !== 'sys' && !SHOW[t.k]) continue; ctx.globalAlpha = Math.min(1, t.t * 2); label(String(t.s), t.x, t.y, 18, t.col, 'center'); ctx.globalAlpha = 1; }
  ctx.restore(); wz = 1; worldDraw = false;
}

// ---------- HUD (PC) ----------
function drawPortraits(x0, y0, w, h, step, A = army(), vert = false, cols = 2) {   // 군단 초상: 클릭 = 조작 캐릭터로 선택(그 군단으로 전환), 더블클릭 = 화면 이동
  A.units.forEach((u, i) => {
    const x = vert ? x0 + (i % cols) * (w + 2) : x0 + i * step, y = vert ? y0 + Math.floor(i / cols) * step : y0, on = A === army() && u === ctrlOf(), cx = x + w / 2, k = h / 36;
    panel(x, y, w, h, on ? COLORS.gold : 'rgba(255,255,255,.25)', on ? 3 : 1);
    ctx.save(); ctx.beginPath(); ctx.rect(x + 1, y + 1, w - 2, h - 2); ctx.clip(); ctx.globalAlpha = u.dead ? 0.25 : u.out ? 0.45 : 1;
    drawBattleBody(ctx, cx, y + h, 9 * k, Math.PI / 2, { ...styleOf(u), weapon: null, horse: null }, { t: T, team:u.team }); ctx.restore();
    if (!u.dead && !u.out) { bar(x + 2, y + h - 4, w - 4, 3 * k, u.hp / u.maxHp, hpCol(u.hp / u.maxHp)); if (vert && u.maxMp) bar(x + 2, y + h - 9, w - 4, 3, u.mp / u.maxMp, '#8a6aff'); }
    if (u.dead) label('✕', cx, y + h / 2, 22, COLORS.danger, 'center'); else if (u.out) label('철', cx, y + h / 2, 16, COLORS.silver2, 'center');
    btns.push({ id: 'slot' + u.id, x, y, w, h });
  });
}
function drawToolbar() {
  ctx.fillStyle = COLORS.ink; ctx.fillRect(0, 0, VW, TB_H); ctx.fillStyle = 'rgba(255,211,77,.35)'; ctx.fillRect(0, TB_H - 2, VW, 2);
  const u = ctrlOf();
  label('조작: ' + (pArmies().indexOf(army()) + 1) + ' ' + army().name + (u ? ' · ' + u.name : ''), 12, 20, 17, COLORS.gold);
  label('Space 행동 · ← → 장수 · ↑ ↓ 군단', 12, 44, 14, COLORS.silver2);
  [['화면', 606], ['전투', 833], ['군단', 1014], ['메뉴', 1179]].forEach(([s, x]) => label(s, x, 8, 12, COLORS.silver2, 'center'));
  button('m:zoom', 500, 18, 104, 34, '거리 ×' + Z(), false);
  button('m:speed', 608, 18, 104, 34, '속도 ×' + SPEEDS[speedIdx], false);
  button('cmd:auto', 722, 18, 104, 34, S.auto ? '자동 ON' : '자동 OFF', S.auto);
  button('cmd:support', 830, 18, 114, 34, `지원 ${supportArmies().length}`, supportOpen);
  button('armyT', 954, 18, 120, 34, '군단 전환', false);
  button('cmd:menu', 1084, 18, 190, 34, '시스템', false);
}
// 능력치 실시간 표기: 버프·오라·피로가 반영된 현재값 하나만 쓰고, 기본값보다 오르면 초록·내리면 주황으로 칠한다.
class StatText extends String { constructor(t, col) { super(t); this.col = col; } }
const FATIGUE_KEYS = ['atk', 'df', 'ad', 'md', 'sp'];
function statShow(u, key) {
  const base = Math.round(u[key]), live = Math.round(combatStat(u, key) * (FATIGUE_KEYS.includes(key) ? Sim.fatigueMultiplier(u) : 1)), sfx = key === 'aa' ? '%' : '';
  return new StatText(live + sfx, live === base ? null : live > base ? '#7dff9a' : '#ff9a7d');
}
const combatStat = (u, key) => Sim.combatStat(S, u, key);
function drawLeftPanel() {
  panel(0, TB_H, LEFT_W, vh, 'rgba(255,255,255,.2)', 1);
  const u = ctrlOf(); if (!u) return;
  const rows = [['HP', `${Math.ceil(u.hp)}/${u.maxHp}`], ['MP', u.maxMp ? `${Math.floor(u.mp)}/${u.maxMp}` : '—'], ['FT', Math.round(Sim.effectiveFt(u))], ...(u.generic ? [] : [['XP', u.lv >= Sim.MAX_LEVEL ? 'MAX' : `${u.xp}/${Sim.XP_NEED(u.lv)}`]]), ['AT', statShow(u, 'atk')], ['DF', statShow(u, 'df')], ['AR', statShow(u, 'ar')], ['DR', statShow(u, 'dr')], ['AD', statShow(u, 'ad')], ['MD', statShow(u, 'md')], ['AA', statShow(u, 'aa')], ['HR', statShow(u, 'hr')], ['SP', statShow(u, 'sp')], ['상태', stText(u)]];
  label(u.name, 10, TB_H + 18, 20, hpCol(u.hp / u.maxHp, COLORS.gold)); if (u.sg) label(gradeTag(u.sg), LEFT_W - 6, TB_H + 18, 13, Sim.SOLDIER_GRADE_COLOR[u.sg], 'right'); label(`${CATEGORY_NAME[u.category]}·${u.subclass}${u.generic ? '' : ' Lv' + u.lv}`, 10, TB_H + 42, 16, COLORS.silver);
  bar(8, TB_H + 58, LEFT_W - 16, 5, u.hp / u.maxHp, hpCol(u.hp / u.maxHp));
  rows.forEach((r, i) => { const y = TB_H + 76 + i * 21.5; label(r[0], 10, y, 16, COLORS.silver2); label(String(r[1]), LEFT_W - 8, y, 16, r[1] && r[1].col ? r[1].col : r[0] === 'HP' ? hpCol(u.hp / u.maxHp, COLORS.silver) : r[0] === 'FT' && r[1] > 50 ? '#ffb04d' : COLORS.silver, 'right'); });
}
function drawSpellPanel() {
  const u = ctrlOf(); if (!u || !u.spells.length) return;
  const x = LEFT_W + 8, y = TB_H + 8, locked = S.lock.player > 0;
  panel(x, y, 210, 30 + u.spells.length * 28, locked ? COLORS.danger : COLORS.gold, 2);
  label(locked ? `마법 잠금 ${Math.ceil(S.lock.player)}초` : `${u.name} 마법 (Space)`, x + 8, y + 15, 16, locked ? COLORS.danger : COLORS.gold);
  u.spells.forEach((k, i) => { const sp = SPELL[k], ok = u.mp >= sp.mp && !locked; label(`${i + 1} ${sp.name}  ${sp.mp}MP`, x + 8, y + 44 + i * 28, 16, u.spellSel === i ? COLORS.gold : ok ? COLORS.silver : COLORS.dim); if (u.spellSel === i) label('◀', x + 196, y + 44 + i * 28, 16, COLORS.gold, 'right'); btns.push({ id: 'spell:' + i, x, y: y + 30 + i * 28, w: 210, h: 28 }); });
}
function drawStick() {   // 맹장전 조이스틱: 누른 자리에 반투명 링, 노브가 손가락을 따라간다 (방향이 잡히면 금색)
  if (!stick) {   // 손가락이 없을 때는 어디를 눌러 끌면 되는지 희미하게 안내
    if (!selectMode && !menuOpen && !S.over) { ctx.save(); ctx.globalAlpha = 0.16; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(190, TB_H + vh - 120, STICK_R, 0, TAU); ctx.stroke(); ctx.globalAlpha = 0.3; label('누른 채 끌기', 190, TB_H + vh - 120, 16, '#fff', 'center'); ctx.restore(); }
    return;
  }
  ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(stick.ox, stick.oy, STICK_R, 0, TAU); ctx.stroke();
  ctx.fillStyle = stick.dir ? COLORS.gold : '#fff'; ctx.beginPath(); ctx.arc(stick.ox + stick.kx, stick.oy + stick.ky, 30, 0, TAU); ctx.fill(); ctx.restore();
}
function drawPad() {   // 보조키 윈도우: 마우스로 누르고 있으면 계속 이동, 가운데 = 행동
  if (!padVisible) return;
  const bs = mobile ? 84 : 52, g = mobile ? 4 : 3, head = mobile ? 0 : 24, w = bs * 3 + g * 4 + (mobile ? 0 : 6), h = bs * 3 + g * 4 + head;
  const x0 = mobile ? 14 : VW - w - 10, y0 = mobile ? VH - h - 14 : TB_H + vh - h - 10;
  if (!mobile) { panel(x0, y0, w, h, COLORS.silver2, 2, 'rgba(10,12,20,.78)'); label('보조키', x0 + w / 2, y0 + 12, 16, COLORS.silver2, 'center'); }
  PAD.forEach(([n, dx, dy, ch], i) => {
    const x = x0 + (mobile ? 0 : 5) + g + (i % 3) * (bs + g), y = y0 + head + g + Math.floor(i / 3) * (bs + g), on = padDir && padDir[0] === dx && padDir[1] === dy && (dx || dy);
    panel(x, y, bs, bs, on ? COLORS.gold : COLORS.silver, on ? 3 : 1, on ? 'rgba(80,60,16,.9)' : mobile ? 'rgba(30,34,50,.55)' : 'rgba(30,34,50,.85)');
    label(mobile && !dx && !dy ? '●' : ch, x + bs / 2, y + bs / 2, dx || dy ? 26 : 16, on ? COLORS.gold : COLORS.silver, 'center');
    btns.push({ id: 'pad:' + dx + ',' + dy, x, y, w: bs, h: bs });
  });
}
function drawTable() {
  const y0 = TB_H + vh; ctx.fillStyle = COLORS.ink; ctx.fillRect(0, y0, VW, tblH); ctx.fillStyle = 'rgba(255,211,77,.35)'; ctx.fillRect(0, y0, VW, 2);
  const groups = armySlots(), compact = tblCompact, names = tblAbility ? ['NAME', 'AT', 'DF', 'AD', 'MD', 'AA', 'HR', 'ST'] : ['NAME', '병종', 'HP', 'MP', 'LV', 'FT', 'XP', 'ST'], rh = 22, headH = 54, gw = VPW / groups.length, cw = gw / 6, dataY = y0 + headH, hpRow = tblAbility ? -1 : 2;
  if (!compact) names.forEach((r, i) => label(r, 10, dataY + 12 + i * rh, 15, COLORS.silver2));
  groups.forEach((A, j) => {
    const gx = LEFT_W + j * gw, bw = (gw - 144) / 4, selected = !A.empty && armyIdx === A.id;
    panel(gx + 1, y0 + 2, gw - 2, tblH - 4, selected ? COLORS.gold : 'rgba(255,255,255,.35)', selected ? 3 : 2, selected ? 'rgba(50,42,20,.4)' : 'rgba(10,12,20,.7)');
    if (A.empty) { label(`${j + 1}분대`, gx + 12, y0 + 21, 15, COLORS.silver2); label('비어있음', gx + gw / 2, y0 + (compact ? 30 : 126), 18, COLORS.dim, 'center'); return; }
    button('army' + A.id, gx + 4, y0 + 6, 70, 30, `${j + 1}분대`, selected, 13); label('⚔ ' + Sim.battlePower(A), gx + 8, y0 + 46, 13, COLORS.goldSel);
    button('form:' + A.id, gx + 78, y0 + 6, 62, 30, FORMATION_NAME[A.formation], false, 13);
    [['idle', '자유'], ['stop', '정지'], ['charge', '돌격'], ['retreat', '후퇴']].forEach(([id, title], k) => button('order:' + A.id + ':' + id, gx + 144 + k * bw, y0 + 6, bw - 2, 30, title, A.order === id, 14));
    if (compact) return;
    A.units.forEach((u, c) => {
      const x = gx + c * cw, isSel = u === ctrlOf(), gone = u.dead || u.out;
      if (isSel) { ctx.fillStyle = 'rgba(255,211,77,.18)'; ctx.fillRect(x, dataY, cw, tblH - headH); ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 2; ctx.strokeRect(x + 1, dataY + 1, cw - 2, tblH - headH - 3); }
      if (!gone && hpRow >= 0) { ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = hpCol(u.hp / u.maxHp); ctx.fillRect(x + 3, dataY + 2 + hpRow * rh, (cw - 6) * u.hp / u.maxHp, rh - 4); ctx.restore(); }
    const col = u.dead ? COLORS.danger : u.out ? COLORS.dim : isSel ? COLORS.goldSel : COLORS.silver;
      const cells = tblAbility ? [u.name, statShow(u, 'atk'), statShow(u, 'df'), statShow(u, 'ad'), statShow(u, 'md'), statShow(u, 'aa'), statShow(u, 'hr'), stText(u)] : [u.name, CATEGORY_NAME[u.category], Math.ceil(u.hp), u.maxMp ? Math.floor(u.mp) : '—', u.generic ? '—' : u.lv, Math.round(Sim.effectiveFt(u)), u.generic ? '—' : u.lv >= Sim.MAX_LEVEL ? 'MAX' : u.xp, stText(u)];
      cells.forEach((v, i) => label(String(v), x + cw / 2, dataY + 12 + i * rh, 15, v && v.col ? v.col : !tblAbility && i === 2 ? hpCol(u.hp / u.maxHp, col) : !tblAbility && i === 5 && u.ft > 50 ? '#ffb04d' : col, 'center'));
      btns.push({ id: 'col' + u.id, x, y: dataY, w: cw, h: tblH - headH });
    });
  });
}

// ---------- HUD (모바일) ----------
function drawToolbarMobile() {   // 하단 한 줄 (버튼 14개 × 86px): 분대 탭 3 · 진형 1 · 행동지침 4 · 선택한 분대의 초상 6. 행동·마법 버튼은 오른쪽 빈 곳
  const ORDERS = [['idle', '자유'], ['stop', '정지'], ['charge', '돌격'], ['retreat', '후퇴']], y0 = VH - TOUCH - 4, step = TOUCH + 3, slots = armySlots(), cur = slots.find(A => !A.empty && armyIdx === A.id) || slots.find(A => !A.empty);
  panel(0, y0 - 4, VW, TOUCH + 8, 'rgba(255,255,255,.25)', 1, 'rgba(8,10,18,.72)');
  slots.forEach((A, j) => {
    const x = 4 + j * step;
    if (A.empty) { panel(x, y0, TOUCH, TOUCH, COLORS.dim, 1, 'rgba(8,10,18,.5)'); label(`${j + 1}분대`, x + TOUCH / 2, y0 + 30, 14, COLORS.dim, 'center', TOUCH - 8); label('비어있음', x + TOUCH / 2, y0 + 58, 12, COLORS.dim, 'center', TOUCH - 8); return; }
    const on = A === cur; panel(x, y0, TOUCH, TOUCH, on ? COLORS.gold : COLORS.silver2, on ? 4 : 2, on ? 'rgba(80,60,16,.85)' : 'rgba(10,12,20,.8)');
    label(`${j + 1}분대`, x + TOUCH / 2, y0 + 28, 15, on ? COLORS.goldSel : COLORS.silver, 'center', TOUCH - 8); label(`⚔${Sim.battlePower(A)}`, x + TOUCH / 2, y0 + 58, 13, COLORS.goldSel, 'center', TOUCH - 8);
    btns.push({ id: 'army' + A.id, x, y: y0, w: TOUCH, h: TOUCH });
  });
  if (!cur) return;
  const i = cur.id, fx = 4 + 3 * step + 12;
  button('form:' + i, fx, y0, TOUCH, TOUCH, FORMATION_NAME[cur.formation], false, 15); label('진형', fx + TOUCH / 2, y0 + 16, 11, COLORS.silver2, 'center');
  ORDERS.forEach(([id, title], k) => button('order:' + i + ':' + id, fx + (k + 1) * step, y0, TOUCH, TOUCH, title, cur.order === id, 16));
  drawPortraits(fx + 5 * step + 12, y0, TOUCH, TOUCH, step, cur);
}
function drawMobileSide() {   // 상단: 화면 → 전투 → 군단 → 메뉴 순으로 86px 터치 버튼을 한 줄에 둔다 (오른쪽 위는 미니맵)
  const y = 4, bw = [150, 150, 150, 150, 170, 150];
  const xs = bw.reduce((a, w, i) => (a.push(i ? a[i - 1] + bw[i - 1] + 6 : 6), a), []);
  button('m:zoom', xs[0], y, bw[0], TOUCH, '거리 ×' + Z(), false, 17);
  button('m:speed', xs[1], y, bw[1], TOUCH, '속도 ×' + SPEEDS[speedIdx], false, 17);
  button('cmd:auto', xs[2], y, bw[2], TOUCH, S.auto ? '자동 ON' : '자동 OFF', S.auto, 17);
  button('cmd:support', xs[3], y, bw[3], TOUCH, `지원 ${supportArmies().length}`, supportOpen, 17);
  button('armyT', xs[4], y, bw[4], TOUCH, '군단 전환', false, 17);
  button('cmd:menu', xs[5], y, bw[5], TOUCH, '시스템', false, 17);
}
function roundBtn(id, cx, cy, r, title, sub, col, on) {
  ctx.fillStyle = on ? 'rgba(80,60,16,.75)' : 'rgba(10,12,20,.6)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.stroke();
  label(title, cx, cy - (sub ? 12 : 0), r > 60 ? 22 : 17, COLORS.silver, 'center'); if (sub) label(sub, cx, cy + 16, r > 60 ? 22 : 15, col, 'center');
  btns.push({ id, x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, cx, cy, r });
}
function drawActionsMobile() {   // 오른쪽 행동 영역: 행동·보조·마법
  const u = ctrlOf(); if (!u) return;
  const primary = actionInfo(u), alt = actionInfo(u, true), sp = u.spells.length ? SPELL[u.spells[u.spellSel]] : null;
  roundBtn('m:act', 1196, 526, 68, primary.name, cooldownText(primary), primary.ready ? COLORS.gold : COLORS.silver2, primary.ready);
  if (u.spells.length ? u.special : u.special && u.range > 0) roundBtn('m:alt', 1080, 550, 44, '보조', cooldownText(alt), alt.ready ? COLORS.gold : COLORS.silver2, alt.ready);
  if (u.spells.length > 1) roundBtn('m:spell', 984, 550, 44, S.lock.player > 0 ? '잠금' : sp.name, S.lock.player > 0 ? Math.ceil(S.lock.player) + '초' : sp.mp + 'MP', S.lock.player > 0 ? COLORS.danger : COLORS.silver2, false);
}
function drawMobileStatus() {   // 왼쪽 상단 전투 설정 아래에 조작 중인 장수 정보를 표시한다 (글자 22px 이상이라 줄 간격 27)
  if (!SHOW.status) return;
  const u = ctrlOf(); if (!u) return;
  const w = 290, x = 6, y = 96, rp = 27, fs = 16, orange = '#ff9a3c', pr = actionInfo(u), sp = u.spells && u.spells.length ? u.spells : [];
  const h = rp * (6 + 3 + 3 + 1) + 22 + (sp.length ? rp * (1 + sp.length) : 0) + 12;
  panel(x, y, w, h, 'rgba(255,255,255,.25)', 1, 'rgba(10,12,20,.62)');
  let yy = y + 18; label(u.name, x + 10, yy, 20, hpCol(u.hp / u.maxHp, COLORS.gold), 'left', 150); if (!u.generic) label('LV ' + u.lv, x + w - 10, yy, 17, orange, 'right'); else if (u.sg) label(gradeTag(u.sg), x + w - 10, yy, 14, Sim.SOLDIER_GRADE_COLOR[u.sg], 'right');
  yy += rp; label(`${CATEGORY_NAME[u.category]}·${u.subclass}`, x + 10, yy, 15, COLORS.silver, 'left', 190); if (u.sg) label(gradeTag(u.sg), x + w - 10, yy, 15, Sim.SOLDIER_GRADE_COLOR[u.sg], 'right');
  yy += 22; bar(x + 10, yy - 5, w - 20, 9, u.hp / u.maxHp, hpCol(u.hp / u.maxHp)); yy += 17; label('HP', x + 10, yy, fs, orange); label(`${Math.ceil(u.hp)}/${u.maxHp}`, x + w - 10, yy, fs, hpCol(u.hp / u.maxHp, COLORS.silver), 'right');
  yy += rp; if (u.maxMp) bar(x + 10, yy - 14, w - 20, 6, u.mp / u.maxMp, '#8a6aff'); label('MP', x + 10, yy, fs, orange); label(u.maxMp ? `${Math.floor(u.mp)}/${u.maxMp}` : '—', x + w - 10, yy, fs, COLORS.silver, 'right');
  yy += rp; label('FT', x + 10, yy, fs, orange); label(String(Math.round(Sim.effectiveFt(u))), x + 44, yy, fs, Sim.effectiveFt(u) > 50 ? '#ffb04d' : COLORS.silver); if (!u.generic) { label('XP', x + 110, yy, fs, orange); label(u.lv >= Sim.MAX_LEVEL ? 'MAX' : `${u.xp}/${Sim.XP_NEED(u.lv)}`, x + 146, yy, fs, COLORS.silver, 'left', 140); }
  const c = (w - 20) / 3, cell = (k, v, i, r) => { label(k, x + 10 + i * c, yy + r * rp, fs, orange); label(String(v), x + 10 + i * c + 36, yy + r * rp, fs, v && v.col ? v.col : COLORS.silver, 'left', c - 38); };
  yy += rp; cell('AT', statShow(u, 'atk'), 0, 0); cell('DF', statShow(u, 'df'), 1, 0); cell('AA', statShow(u, 'aa'), 2, 0);
  cell('AR', statShow(u, 'ar'), 0, 1); cell('DR', statShow(u, 'dr'), 1, 1); cell('AD', statShow(u, 'ad'), 2, 1);
  cell('MD', statShow(u, 'md'), 0, 2); cell('HR', statShow(u, 'hr'), 1, 2); cell('SP', statShow(u, 'sp'), 2, 2);
  yy += 3 * rp; label('ST', x + 10, yy, fs, orange); label(stText(u), x + 46, yy, fs, COLORS.silver); label('지형', x + 140, yy, fs, orange); label(TERRAIN_NAME[S.map[Sim.ti(u.tx, u.ty)]] || '—', x + 190, yy, fs, COLORS.silver);
  yy += rp; label('ITEM', x + 10, yy, fs, orange); label(itemName(u), x + 70, yy, fs, COLORS.silver, 'left', w - 80);
  if (sp.length) { yy += rp; label('마법 (오른쪽 버튼으로 변경)', x + 10, yy, fs, orange, 'left', w - 20); sp.forEach((k, i) => { yy += rp; label(`${u.spellSel === i ? '▶' : ' '} ${i + 1} ${SPELL[k].name}  ${SPELL[k].mp}MP`, x + 10, yy, 14, u.spellSel === i ? COLORS.gold : COLORS.silver, 'left', w - 20); }); }
  yy += rp - 2; label('행동 ' + pr.name, x + 10, yy, 15, COLORS.silver2, 'left', 170); label(pr.cd > 0 ? cooldownText(pr) : '가능', x + w - 10, yy, 15, pr.ready ? COLORS.gold : COLORS.silver2, 'right');
}

const itemName = u => u.item ? `${Sim.ITEMS[u.item].unique ? '★ ' : ''}${Sim.ITEMS[u.item].name}` : WEAPON_NAME[(styleOf(u) || {}).weapon] || '—';
const TERRAIN_NAME = ['평지', '숲', '바위', '물', '여울'], WEAPON_NAME = { glaive: '청룡언월도', halberd: '방천화극', lance: '창', twin: '쌍철극', sword: '검', spear: '창', bow: '활', crossbow: '쇠뇌', fan: '부채' };
function drawStatGrid(u, x, y, w, fs, col = COLORS.gold) {   // 원작 능력치 창과 같은 줄 구성
  const rh = fs + 9, top = rh * 1.5 + 6, c = w / 3, orange = '#ff9a3c', cell = (k, v, i, r, span = 1) => { label(k, x + 8 + i * c, y + top + r * rh, fs, orange); label(String(v), x + 8 + i * c + fs * 2.2, y + top + r * rh, fs, v && v.col ? v.col : COLORS.silver); };
  label(u.name, x + 8, y + 2 + rh * 0.5, fs + 2, hpCol(u.hp / u.maxHp, col)); if (!u.generic) label('LV ' + u.lv, x + w - 8, y + 2 + rh * 0.5, fs, orange, 'right');
  const tile = Sim.ti(u.tx, u.ty), terrain = TERRAIN_NAME[S.map[tile]] || '—', wp = itemName(u);
  const hr = statShow(u, 'hr'); label('HP', x + 8, y + top, fs, orange); label(Math.ceil(u.hp) + '/' + u.maxHp, x + 8 + fs * 2.2, y + top, fs, hpCol(u.hp / u.maxHp, COLORS.silver)); label('HR', x + 8 + 2 * c, y + top, fs, orange); label(String(hr), x + 8 + 2 * c + fs * 2.2, y + top, fs, hr.col || COLORS.silver);
  cell('AT', statShow(u, 'atk'), 0, 1); cell('DF', statShow(u, 'df'), 1, 1); cell('AA', statShow(u, 'aa'), 2, 1);
  cell('AR', statShow(u, 'ar'), 0, 2); cell('DR', statShow(u, 'dr'), 1, 2); cell('AD', statShow(u, 'ad'), 2, 2);
  cell('MD', statShow(u, 'md'), 0, 3); cell('FT', Math.round(Sim.effectiveFt(u)), 1, 3); cell('SP', statShow(u, 'sp'), 2, 3);
  label('ST', x + 8, y + top + 4 * rh, fs, orange); label(stText(u), x + 8 + fs * 2.2, y + top + 4 * rh, fs, COLORS.silver); label('지형', x + 8 + 1.6 * c, y + top + 4 * rh, fs, orange); label(terrain, x + 8 + 1.6 * c + fs * 2.6, y + top + 4 * rh, fs, COLORS.silver);
  label('ITEM', x + 8, y + top + 5 * rh, fs, orange); label(wp, x + 8 + fs * 3, y + top + 5 * rh, fs, COLORS.silver);
  return top + 5 * rh + 14;
}
function drawSelectUI() {   // 선택 단계: 원작 상태창처럼 능력치 창 + 확정 버튼, 전투는 멈춰 있다 (적을 눌렀으면 그 적의 정보)
  const u = selTarget && alive(selTarget) ? selTarget : ctrlOf(); if (!u) return; const foe = u.team === 'enemy';
  const col = foe ? COLORS.danger : COLORS.gold, title = foe ? '적 정보 · 전투 일시정지' : '캐릭터 선택 · 전투 일시정지';
  if (mobile) { panel(VW / 2 - 230, 8, 460, 40, col, 2, 'rgba(10,12,20,.92)'); label(title, VW / 2, 28, 20, col, 'center'); }
  else label(title, LEFT_W + VPW / 2, TB_H + 22, 20, col, 'center');
  const z = Z(), sx = LEFT_W + (u.x - cam.x) * z, sy = TB_H + (u.y - cam.y) * z, w = mobile ? 380 : 300, h = mobile ? 260 : 232;
  if (foe) { ctx.strokeStyle = COLORS.danger; ctx.lineWidth = 3; ctx.strokeRect(sx - 20 * z, sy - 36 * z, 40 * z, 44 * z); }   // 가리킨 적 표시
  const actionY = mobile ? VH - TOUCH - 10 : TB_H + vh - 70, x = Math.max(LEFT_W + 6, Math.min(LEFT_W + VPW - w - 6, sx + 36)), y = Math.max(mobile ? 58 : TB_H + 40, Math.min(mobile ? actionY - h - 12 : TB_H + vh - h - 90, sy - h / 2));
  panel(x, y, w, h, col, 3, 'rgba(10,12,20,.95)');
  const gh = drawStatGrid(u, x, y, w, mobile ? 20 : 16, col);
  if (u.range > 0) label('사거리 ' + Math.round(u.range / TILE) + '칸', x + 8, y + gh + mb(12, 20), 15, COLORS.silver2);
  if (u.spells && u.spells.length) label(u.spells.map(k => SPELL[k].name).join('·'), x + w - 8, y + gh + mb(12, 20), 14, COLORS.silver2, 'right', w - 16);
  button('sel:ok', mobile ? VW / 2 - (foe ? 150 : 220) : LEFT_W + VPW / 2 - 110, actionY, mobile ? (foe ? 300 : 210) : 220, mobile ? TOUCH : 44, foe ? (mobile ? '확정 · 집중 공격' : '확정: 집중 공격 (Enter)') : (mobile ? '확정' : '확정 (Enter)'), true, 18);
  if (!foe) { const solo = !!(u.order && u.order.solo); button('sel:solo', mobile ? VW / 2 + 10 : LEFT_W + VPW / 2 + 120, actionY, mobile ? 210 : 150, mobile ? TOUCH : 44, solo ? '후퇴 취소' : '개인 후퇴', solo, 18); }   // 선택한 이 장수 한 명만 후퇴 (앞에 대상이 있어도 이동)
}
function drawMenu() {   // 시스템: PC·모바일 공통 기능을 용도별 두 영역으로 구분한다
  const display = [['m:pausesel', `캐릭터 선택 일시정지: ${SHOW.pauseSel ? 'ON' : 'OFF'}`, SHOW.pauseSel], ['m:dmg', `피해량 표시: ${SHOW.dmg ? 'ON' : 'OFF'}`, SHOW.dmg]];
  if (mobile) display.push(['m:status', `조작 장수 정보: ${SHOW.status ? 'ON' : 'OFF'}`, SHOW.status]);
  else display.push(['m:compact', tblCompact ? '하단 장수 정보: 축소' : '하단 장수 정보: 확대', !tblCompact], ['m:abil', tblAbility ? '하단 표 내용: 능력치' : '하단 표 내용: 상태']);
  const game = [['m:tutorial', '조작법 다시 보기'], ['m:mode', mobile ? 'PC 화면으로 전환' : '모바일 화면으로 전환'], [campaign.explore ? 'm:return' : 'm:restart', campaign.explore ? '탐색 종료 · 전략으로' : '전투 다시 시작'], ['m:close', mobile ? '전투로 돌아가기' : '전투로 돌아가기 (Esc)']];
  const ih = mobile ? TOUCH : 42, st = ih + 10, w = mobile ? 860 : 760, h = 112 + Math.max(display.length, game.length) * st, x = (VW - w) / 2, y = (VH - h) / 2, gap = 18, cw = (w - 72 - gap) / 2;
  panel(x, y, w, h, COLORS.gold, 3, 'rgba(10,12,20,.96)');
  label(mobile ? '모바일 시스템' : 'PC 시스템', x + 24, y + 30, 24, COLORS.gold); label('설정 중에는 전투가 일시정지됩니다', x + w - 24, y + 30, 15, COLORS.silver2, 'right');
  label('전투 표시', x + 28, y + 68, 18, COLORS.gold); label('화면 · 게임', x + 44 + cw + gap, y + 68, 18, COLORS.gold);
  display.forEach((it, i) => button(it[0], x + 26, y + 82 + i * st, cw, ih, it[1], !!it[2], mobile ? 18 : 16));
  game.forEach((it, i) => button(it[0], x + 44 + cw + gap, y + 82 + i * st, cw, ih, it[1], false, mobile ? 18 : 16));
}
// 전략 화면 튜토리얼 (명세 외 요청): 새 게임 첫 진입 때 1회 자동, 이후 지도의 '도움말' 버튼. 페이지 = [제목, 줄들(문자열 또는 [PC, 모바일]), PC 강조 사각형, 모바일 강조 사각형]
const STRAT_TUT = [
  ['목표', ['모든 도시를 점령하면 승리합니다.', '세력은 여포·원소·조조·유비 네 곳입니다.', '다른 세력과는 외교로 휴전·동맹을 맺을 수 있습니다.', '아래 상자에서 세력별 도시 수와 관계를 봅니다.'], [[10, 636, 980, 70]], [[10, 614, 988, 100]]],
  ['지도 읽기', ['도시 색은 세력, 깃발 숫자는 주둔한 내 군단 수입니다.', ['★은 수도, 곡·병·요·교는 곡창·병영·요새·교역입니다.', '★은 수도입니다. 선택한 도시 위에만 유형 글자가 보입니다.'], ['글자가 없는 도시는 군현입니다.', '곡·병·요·교는 곡창·병영·요새·교역, 없으면 군현입니다.'], ['빈 곳 끌기·방향키·미니맵 클릭으로 지도를 움직입니다.', '빈 곳 끌기·왼쪽 위 미니맵 터치로 지도를 움직입니다.']], [[10, 10, 170, 120]], [[10, 10, 170, 120]]],
  ['이동', ['이동 버튼 → 군단 선택 → 지도에서 도시를 고릅니다.', '도시를 고르면 군단 선택으로 돌아옵니다. 끝나면 닫기를 누릅니다.', '정한 이동은 진행하기를 눌러야 한 턴으로 실행됩니다.', '탐색 버튼: 점령한 도시에서 적 없이 전장을 살펴봅니다.'], [[1025, 388, 210, 36], [1025, 472, 210, 36], [1025, 556, 210, 36]], [[1012, 356, 124, 86], [1138, 356, 124, 86], [1012, 626, 250, 86]]],
  ['외교', ['외교 버튼을 누르고 지도에서 세력 수도를 선택합니다.', '휴전·동맹·전쟁 중에서 고르고 성공 확률이 표시됩니다.', '거절당하면 그 세력과 3턴간 쿨다운이 있습니다.', '중립 세력의 도시에 들어가면 전쟁이 시작됩니다.'], [[1135, 340, 100, 34]], [[1138, 266, 124, 86]]],
  ['군량', ['군량 칩에 보유량과 턴당 증감(+N/턴)이 나옵니다.', '기동 군단은 병사 수만큼 유지비가 들고 이동하면 더 듭니다.', '이동하지 않고 아군 도시에 머문 군단은 병력이 보충됩니다.', '군량 0 이면 기근: 보충 중단, 2턴째부터 병사가 탈영합니다.'], [[1025, 220, 210, 44]], [[1012, 176, 250, 86]]],
  ['전투와 포로', ['적 도시로 이동하면 도착한 턴에 교전이 시작됩니다.', '이름 있는 장수는 HP 0 이 되면 전사하거나 포박됩니다.', '포박한 적 장수는 전투 뒤 처형·포로·투항을 고릅니다.', '일반 병사의 전사·투항은 결과 화면에서 정리됩니다.'], [], []],
  ['저장과 편성', ['저장·로드는 전략 화면에서만 할 수 있습니다.', '군단 편성에서 배치하고 세력 장수에서 상세를 봅니다.', '턴이 끝나면 N턴 요약이 나오고 정찰로 도시를 살핍니다.', ['이 안내는 오른쪽 위 제목줄의 도움말 버튼으로 다시 봅니다.', '이 안내는 왼쪽 아래의 도움말 버튼으로 다시 봅니다.']], [[1025, 514, 210, 34], [1180, 26, 66, 30]], [[1012, 536, 250, 86], [378, 621, 86, 86]]],
];
function finishStratTut() {
  stratTutStep = -1; stratTutSeen = true;
  try { localStorage.setItem('sgsp-strat-tutorial', '1'); } catch (e) { /* 무시 */ }
}
function stratTutNav(a) {
  if (a === 'prev') stratTutStep = Math.max(0, stratTutStep - 1); else if (a === 'next' && stratTutStep < STRAT_TUT.length - 1) stratTutStep++; else finishStratTut();   // 마지막 쪽의 다음·건너뛰기는 종료(본 것으로 기록)
}
function drawStratTutorial() {
  const pg = STRAT_TUT[stratTutStep], rects = mobile ? pg[3] : pg[2], w = mobile ? 960 : 800, h = mobile ? 374 : 330, x = mobile ? 20 : 100, y = mobile ? 232 : 200;
  ctx.fillStyle = 'rgba(4,6,12,.72)'; ctx.beginPath(); ctx.rect(0, 0, VW, VH); for (const r of rects) ctx.rect(r[0] - 4, r[1] - 4, r[2] + 8, r[3] + 8); ctx.fill('evenodd');   // 강조 영역은 구멍
  ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 3; for (const r of rects) ctx.strokeRect(r[0] - 4, r[1] - 4, r[2] + 8, r[3] + 8);
  panel(x, y, w, h, COLORS.gold, 4, 'rgba(18,21,31,.98)');
  label(`전략 도움말  ${stratTutStep + 1}/${STRAT_TUT.length}`, x + 30, y + 30, 18, COLORS.silver2, 'left', w - 60);
  label(pg[0], x + w / 2, y + mb(82, 78), mb(32, 34), COLORS.gold, 'center', w - 60);
  pg[1].forEach((l, i) => label(Array.isArray(l) ? l[mobile ? 1 : 0] : l, x + w / 2, y + mb(138, 130) + i * mb(36, 34), mb(20, 22), COLORS.silver, 'center', w - 50));
  const ty = y + h - mb(62, TOUCH + 12), last = stratTutStep === STRAT_TUT.length - 1;
  if (stratTutStep > 0) button('stut:prev', x + 30, ty, 160, tb(46), '이전', false, 18);
  button('stut:skip', x + w / 2 - 80, ty, 160, tb(46), '건너뛰기', false, 18);
  button('stut:next', x + w - 190, ty, 160, tb(46), last ? '닫기' : '다음', true, 18);
}
function finishTutorial() {
  tutorialStep = -1; tutorialSeen = true;
  try { localStorage.setItem('sgsp-tutorial', '1'); } catch (e) { /* 무시 */ }
}
function drawTutorial() {
  const pages = mobile ? [
    ['이동과 카메라', '전장 왼쪽을 누른 채 끌면 가상패드가 생기고, 손을 떼면 멈춥니다.', '끌지 않고 짧게 터치만 하면 그 자리의 장수 정보가 나옵니다.'],
    ['공격과 기술', '오른쪽 행동 버튼으로 특수기·마법을 사용합니다.', '버튼 아래 숫자는 다시 사용할 수 있을 때까지 남은 시간입니다.'],
    ['부대 지휘', '오른쪽 아래에 부대들이 있습니다. 초상으로 조작 장수를, 아래 버튼으로 부대 명령을 내립니다.', '오른쪽 진형 버튼으로 기본·횡대·쐐기를 선택합니다.'],
    ['전투 정보', '왼쪽 위 전투 설정 아래에 조작 중인 장수의 능력치가 항상 표시됩니다.', '왼쪽 위의 화면·전투·군단·메뉴 그룹에서 필요한 기능을 선택합니다.']
  ] : [
    ['이동과 카메라', '숫자패드 또는 WASD·QEZC로 8방향 이동합니다.', '[ · ] 키나 상단의 카메라 거리로 화면을 조정합니다.'],
    ['공격과 기술', 'Space는 주 행동, X는 보조 행동입니다.', '보조키의 가운데 버튼으로도 주 행동을 사용할 수 있습니다.'],
    ['부대 지휘', '하단 부대 그룹에서 자유·정지·돌격·후퇴를 지시합니다.', '후퇴한 병력은 해당 전투에 다시 돌아올 수 없습니다.'],
    ['전투 정보', '하단 상태창과 왼쪽 능력치 창에서 병력을 확인합니다.', '상단에서 자동·거리·속도를 조정하고 Esc로 시스템을 엽니다.']
  ];
  const p = pages[tutorialStep], w = mobile ? 1040 : 780, h = mobile ? 400 : 340, x = (VW - w) / 2, y = mobile ? 150 : 190;
  ctx.fillStyle = 'rgba(4,6,12,.78)'; ctx.fillRect(0, 0, VW, VH); panel(x, y, w, h, COLORS.gold, 4, 'rgba(18,21,31,.98)');
  label(`전투 튜토리얼  ${tutorialStep + 1}/${pages.length}`, x + 36, y + 42, 20, COLORS.silver2);
  label(p[0], x + w / 2, y + 100, 36, COLORS.gold, 'center');
  label(p[1], x + w / 2, y + 160, 20, COLORS.silver, 'center', w - 40); label(p[2], x + w / 2, y + 202, 20, COLORS.silver, 'center', w - 40);
  const ty = y + h - mb(74, TOUCH + 18);
  if (tutorialStep > 0) button('tut:prev', x + 36, ty, 160, tb(46), '이전', false, 18);
  button('tut:skip', x + w / 2 - 80, ty, 160, tb(46), '건너뛰기', false, 18);
  button('tut:next', x + w - 196, ty, 160, tb(46), tutorialStep === pages.length - 1 ? '전투 시작' : '다음', true, 18);
}
function soldierTallyLine() {   // 일반 병사의 전사·투항은 전투 중 팝업 없이 결과 화면에서 한 줄로 정리한다
  if (!S) return null; const st = S.stats || {}, lost = st.soldierLost || 0, killed = st.soldierKilled || 0, sur = st.surrendered || 0;
  return `일반 병사 — 아군 전사 ${lost} · 적 전사 ${killed} · 적 투항(아군 합류) ${sur}`;
}
function heroFateLines() {   // 전투 직후 인게임 결과 화면에 표시하는 아군 장수의 전사·포박
  if (!S) return [];
  const mine = S.units.filter(u => u.dead && u.originTeam === 'player' && namedRosterUnit(u.key)), list = (a) => a.length > 6 ? a.slice(0, 6).join(', ') + ` 외 ${a.length - 6}명` : a.join(', ');
  const fell = mine.filter(u => !u.captured).map(u => Sim.U[u.key].name), held = mine.filter(u => u.captured).map(u => Sim.U[u.key].name), out = [];
  if (fell.length) out.push('아군 전사: ' + list(fell)); if (held.length) out.push('아군 포박: ' + list(held));
  return out;
}
// 전투 기여 표(결과 화면): 이름 있는 장수는 한 명씩, 일반 병사는 병종별로 합산. 집계 정의는 sim.js `rp`.
let repSide = 'player', repPage = 0;
const repZero = () => ({ d: 0, t: 0, h: 0, s: 0 });
function battleReport(side) {
  const rows = [], gen = {}, sum = repZero(); let foe = 0;
  for (const u of S.units) {
    if (u.team !== side) continue;
    const r = u.rep || repZero(), live = !u.dead && !u.fled && !u.out;
    if (u.named) rows.push({ name: u.name, role: CATEGORY_NAME[u.category] || '', alive: live, mark: u.dead ? (u.captured ? ' 포박' : ' ✝') : u.fled ? ' 도주' : ' 후퇴', n: 1, ...r });
    else { const g = gen[u.key] || (gen[u.key] = { name: Sim.U[u.key].name, role: '병사', alive: 0, n: 0, ...repZero() }); g.n++; if (live) g.alive++; for (const k in r) g[k] += r[k]; }
  }
  if (side === 'enemy' && S.stats.foeRep) foe = S.stats.foeRep;   // 투항 전 분량
  const all = [...rows, ...Object.values(gen)].sort((a, b) => b.d - a.d);
  for (const r of all) for (const k in sum) sum[k] += r[k];
  if (foe) { const g = all.find(r => r.role === '병사'); if (g) for (const k in foe) { g[k] += foe[k]; sum[k] += foe[k]; } else { all.push({ name: '투항 병사', role: '병사', alive: 0, n: 0, ...foe }); for (const k in foe) sum[k] += foe[k]; } }
  if (side === 'enemy') { const named = all.filter(r => r.role !== '병사'), sol = all.filter(r => r.role === '병사'); if (sol.length) { const m = { name: '일반 병사', role: '병사', alive: 0, n: 0, ...repZero() }; for (const r of sol) { m.alive += r.alive; m.n += r.n; for (const k in sum) m[k] += r[k]; } return { rows: [...named, m].sort((a, b) => b.d - a.d), sum }; } }
  return { rows: all, sum };
}
const repPerPage = () => mb(8, 5);
function repTurn(d) { if (!S || !S.over) return; const n = Math.max(1, Math.ceil(battleReport(repSide).rows.length / repPerPage())); repPage = (repPage + d + n) % n; }
function repToggle() { repSide = repSide === 'player' ? 'enemy' : 'player'; repPage = 0; }
function drawBattleReport(y0) {
  const { rows, sum } = battleReport(repSide), per = repPerPage(), pages = Math.max(1, Math.ceil(rows.length / per)), rh = mb(28, 32), n = v => String(Math.round(v)), fs = 18;
  if (repPage >= pages) repPage = 0;
  const X = mb({ name: 150, d: 640, t: 780, h: 920, s: 1060 }, { name: 120, d: 700, t: 870, h: 1040, s: 0 });
  const head = repSide === 'player' ? '아군' : '적군';
  label(`${head} 전투 기여 (${repPage + 1}/${pages}쪽)`, X.name, y0, fs, COLORS.gold);
  label('피해', X.d, y0, fs, COLORS.gold, 'right'); label('받은 피해', X.t, y0, fs, COLORS.gold, 'right'); label('회복', X.h, y0, fs, COLORS.gold, 'right'); if (X.s) label('자가회복', X.s, y0, fs, COLORS.gold, 'right');
  const maxD = Math.max(1, ...rows.map(r => r.d));
  rows.slice(repPage * per, repPage * per + per).forEach((r, i) => {
    const y = y0 + rh * (i + 1);
    ctx.fillStyle = repSide === 'player' ? 'rgba(80,140,255,.28)' : 'rgba(255,100,70,.28)'; ctx.fillRect(X.name - 10, y - rh / 2 + 2, (X.d - X.name + 20) * r.d / maxD, rh - 4);   // 피해량 비율 막대
    label(r.role === '병사' ? `${r.name} ${r.alive}/${r.n}` : `${r.name} ${r.role}${r.alive ? '' : r.mark}`, X.name, y, fs, r.alive || r.role === '병사' ? COLORS.silver : COLORS.silver2, 'left', 300);
    label(n(r.d), X.d, y, fs, '#fff', 'right'); label(n(r.t), X.t, y, fs, '#ff9a8a', 'right'); label(n(r.h), X.h, y, fs, '#7dff9a', 'right'); if (X.s) label(n(r.s), X.s, y, fs, '#7dff9a', 'right');
  });
  const yt = y0 + rh * (Math.min(per, rows.length - repPage * per) + 1);   // 마지막 쪽은 행이 적으면 합계를 끌어올린다
  label('합계', X.name, yt, fs, COLORS.gold); label(n(sum.d), X.d, yt, fs, COLORS.gold, 'right'); label(n(sum.t), X.t, yt, fs, COLORS.gold, 'right'); label(n(sum.h), X.h, yt, fs, COLORS.gold, 'right'); if (X.s) label(n(sum.s), X.s, yt, fs, COLORS.gold, 'right');
  const by = VH - tb(50) - 8, bw = 220, bx = VW / 2 - 460;
  button('rep:prev', bx, by, bw, tb(50), '이전 쪽', false, 20); button('rep:side', bx + 240, by, bw, tb(50), repSide === 'player' ? '적군 보기' : '아군 보기', false, 20); button('rep:next', bx + 480, by, bw, tb(50), '다음 쪽', false, 20); button('rep:done', bx + 720, by, bw, tb(50), '전략 화면으로', true, 20);   // 끝내기는 명시 버튼 (빈 곳을 눌러도 끝나지 않는다 — QA v0.1.272 중요 3)
}
function drawOverlay(title, lines, col) {
  const result = S && S.over && (title === '승 리' || title === '패 배');
  if (result) lines = [...lines, soldierTallyLine(), ...heroFateLines()].filter(Boolean);
  ctx.fillStyle = result ? 'rgba(10,12,20,.99)' : 'rgba(10,12,20,.8)'; ctx.fillRect(0, 0, VW, VH);
  if (!result) { label(title, VW / 2, 230, 96, col, 'center'); lines.forEach((s, i) => label(s, VW / 2, 330 + i * 38, 22, COLORS.silver, 'center')); return; }
  label(title, VW / 2, 44, 60, col, 'center'); const ly = mb(28, 30);
  lines.forEach((s, i) => label(s, VW / 2, 96 + i * ly, mb(18, 20), COLORS.silver, 'center', VW - 40));
  drawBattleReport(Math.max(96 + lines.length * ly + 22, 200));
}
function advanceBattleEvent() {
  const e = S.events[0];
  if (e && e.type === 'casualties' && (e.page || 0) + 1 < e.lines.length) e.page = (e.page || 0) + 1;
  else S.events.shift();
}
function drawEvent(e) {
  if (e.type === 'casualties') {
    const text = e.lines[e.page || 0], u = S.units.find(u => u.dead && text.startsWith((u.team === 'player' ? '아군 ' : '적군 ') + u.name + '이(가) '));
    // 판정과 일괄 이벤트는 유지하고, 표시만 기존 초상 대화창으로 한 명씩 넘긴다.
    e = { type: 'dialogue', team: u ? u.team : e.team, key: u && u.style, speaker: u ? u.name : '전투 소식', text };
  }
  ctx.fillStyle = 'rgba(10,12,20,.55)'; ctx.fillRect(0, 0, VW, VH);
  const col = e.team === 'enemy' ? '#ff8a32' : COLORS.gold, w = e.type === 'dialogue' ? 760 : 700, h = e.type === 'dialogue' ? 150 : 104, x = (VW - w) / 2, y = (VH - h) / 2;
  panel(x, y, w, h, col, 4, '#e7e1cf');
  if (e.type === 'dialogue') {
    panel(x + 14, y + 14, 112, h - 28, COLORS.ink, 2, '#b9c5c7');
    const portrait = STYLES[e.key] || STYLES.captain;
    ctx.save(); ctx.beginPath(); ctx.rect(x + 15, y + 15, 110, h - 30); ctx.clip();
    drawBattleBody(ctx, x + 70, y + 112, portrait.horse?20:22, e.team === 'enemy' ? Math.PI : 0, portrait, { t: T, team:e.team }); ctx.restore();
    label(e.speaker, x + 148, y + 42, 21, e.team === 'enemy' ? '#c55a2d' : '#315a86'); label(e.text, x + 148, y + 84, 22, '#292520', 'left', w - 164);
  } else label(e.text, VW / 2, y + 50, 24, col, 'center');
  label(mobile ? '화면을 탭하여 계속' : '클릭 / Enter', x + w - 16, y + h - 14, 14, '#68645d', 'right');
}
function drawTitle() {
  const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, COLORS.dusk1); g.addColorStop(0.55, COLORS.dusk2); g.addColorStop(1, COLORS.dusk3); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = COLORS.moon; ctx.beginPath(); ctx.arc(1010, 150, 52, 0, TAU); ctx.fill();
  ctx.fillStyle = COLORS.ink2; ctx.beginPath(); ctx.moveTo(0, VH); ctx.lineTo(0, 620); for (let x = 0; x <= VW; x += 40) ctx.lineTo(x, 620 + 26 * Math.sin(x * 0.006) + 16 * Math.sin(x * 0.02)); ctx.lineTo(VW, VH); ctx.closePath(); ctx.fill();
  [['guan', 250], ['zhao', 360], ['huang', 470], ['kong', 570], ['diao', 670], ['lubu', 880], ['captain', 1000], ['dian', 1100]].forEach(([k, x]) => drawBody(ctx, x, 670, 30, x < 780 ? 0 : Math.PI, STYLES[k], { t: T, weaponLen: k === 'guan' ? 110 : 130, weaponAng: k === 'guan' ? -0.85 : undefined }));
  label('삼국 사우스파크', VW / 2, 150, 100, COLORS.gold, 'center'); label('v0.1.284', 24, 30, 16, COLORS.silver2);
  (mobile ? ['왼쪽 화면을 누르고 끌기(조이스틱): 캐릭터 이동 · 아군을 탭: 조작 장수 변경', '오른쪽 행동 버튼·빈 곳 탭: 특수기·마법 · 적을 탭: 집중 공격', '왼쪽 위: 화면·전투·군단·메뉴 · 오른쪽 아래: 부대별 진형·행동 지침'] : ['조작 캐릭터 이동: 숫자패드 (또는 WASD+QEZC, 화면의 보조키) — 적이 있는 칸으로 밀면 공격', 'Space: 특수기·마법 · X: 보조 행동 · 1 2 3: 마법 선택 · ←→ 조작 캐릭터 변경 · ↑↓ 군단 변경', '돌격 F · 정지 V · 후퇴 R · 자유 B · 자동전투 T · 적을 클릭: 집중 공격 · Ctrl: 가속 · Esc: 시스템']).forEach((s, i) => label(s, VW / 2, 295 + i * 34, 20, COLORS.silver, 'center'));
  button('title:new', 430, mb(410, 396), 200, tb(58), '뉴게임', true, 24); button('title:load', 650, mb(410, 396), 200, tb(58), hasCampaign() ? '로드' : '로드 · 저장 없음', false, 22);
  label(mobile ? '버튼을 터치해 시작' : 'Enter: 뉴게임 · L: 로드', VW / 2, mb(495, 512), 18, COLORS.silver2, 'center'); if (titleNotice) label(titleNotice, VW / 2, mb(535, 552), 20, COLORS.danger, 'center', 1100);
  if (saveSlotMode) drawSaveSlots();
  if (startFactionSelect) {
    const py = mb(175, 100), ph = mb(370, 500), by = py + mb(130, 125);
    panel(330, py, 620, ph, COLORS.gold, 3, 'rgba(8,20,25,.98)'); label('시작 세력 선택', 640, py + mb(45, 40), 30, COLORS.gold, 'center');
    label('선택한 세력의 수도와 장수로 전략을 시작합니다.', 640, py + mb(85, 80), 17, COLORS.silver2, 'center', 600);
    PLAYABLE_FACTIONS.forEach((faction, i) => { const x = 375 + i * 180, capital = stageById(CAPITALS[faction]); button(`start-faction:${faction}`, x, by, 170, tb(90), faction, false, 25); label(`${capital.name} · ${Sim.U[INITIAL_RULERS[faction]].name}`, x + 85, by + tb(90) + mb(30, 28), 15, FACTION_STYLE[faction].light, 'center', 170); });
    label(mobile ? '세력을 터치하세요' : '1 여포 · 2 조조 · 3 유비 · Esc 취소', 640, py + mb(290, 296), 16, COLORS.silver, 'center', 600);
    button('start-diff', mb(540, 510), py + mb(310, 330), mb(200, 260), tb(40), '난이도: ' + (AI_PROFILES[startDifficulty] || AI_PROFILES.normal).name, false, 17);
  }
}
function drawSaveSlots() {
  const title = saveSlotMode === 'new' ? '새 게임 슬롯 선택' : saveSlotMode === 'save' ? '저장 슬롯 선택' : '불러오기 슬롯 선택', py = mb(145, 60), pitch = mb(70, 94), sh = tb(54);
  panel(mb(390, 340), py, mb(500, 600), mb(370, 560), COLORS.gold, 3, 'rgba(8,20,25,.97)'); label(title, 640, py + mb(37, 37), 25, COLORS.gold, 'center');
  for (let slot = 1; slot <= SAVE_SLOTS; slot++) {
    const data = readCampaign(slot), saved = data && data.campaign, stage = saved && stageById(data.campaign.at);
    button(`save-slot:${slot}`, mb(430, 380), py + mb(70, 68) + (slot - 1) * pitch, mb(420, 520), sh, saved ? `${slot}번 · ${data.campaign.turn || 1}턴 · ${stage ? stage.name : '원정'}` : `${slot}번 · 비어 있음`, slot === activeSaveSlot, 18);
  }
  label(saveSlotMode === 'save' ? '저장은 직접 눌러야 하며, 전략 화면에서만 할 수 있습니다. (자동 저장 없음)' : saveSlotMode === 'load' ? '저장했던 전략 화면 상태로 돌아갑니다.' : '새 원정은 저장 버튼으로 직접 저장해야 남습니다.', 640, py + mb(280, 368), 13, COLORS.silver2, 'center', mb(480, 570));
  button('save-slot:close', 540, py + mb(295, 390), 200, tb(44), '닫기', false, 17);
}
function drawMapFlag(x, y, faction, mark, highlight = false) {
  const style = FACTION_STYLE[faction] || FACTION_STYLE['여포'], w = highlight ? 38 : 31, h = highlight ? 27 : 22;
  ctx.save(); ctx.strokeStyle = style.dark; ctx.lineWidth = highlight ? 4 : 3;
  ctx.beginPath(); ctx.moveTo(x, y + 18); ctx.lineTo(x, y - h); ctx.stroke();
  ctx.fillStyle = style.main; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + w, y - h + 3); ctx.lineTo(x + w - 7, y - 8); ctx.lineTo(x, y - 11); ctx.closePath(); ctx.fill(); ctx.stroke();
  label(mark, x + w * .48, y - 12, highlight ? 14 : 12, style.light, 'center'); ctx.restore();
}
function capitalInfo(s) {   // 수도 수비 현황 (명세 62 B4): 정원·정예 비율·보충량, 70% 미만이면 경고 (적이 인접하면 주황)
  if (!isDefenseCapital(s)) return null;
  const n = guardsAt(s).reduce((x, g) => x + g.army.units.length, 0), cap = guardCap(s), low = n < cap * 0.7, k = cityKind(s), near = enemyForces.some(f => f.active && relationOf(forceFaction(f)).status === 'war' && (f.at === s.id || s.links.includes(f.at)));
  return { n, cap, low, line1: low ? `★ 수도 수비 부족 (${n}/${cap})` : `★ 수도 · 수비 ${n}/${cap}명 · 정예 B 9할`, line2: `보충 +${capitalRefill(s)}명/${CAPITAL_REFILL.every}턴(군량 소모)`, col: low ? (near ? '#ffb06a' : COLORS.goldSel) : COLORS.silver2 };
}
const diplomable = s => s.owner !== 'player' && isCapital(s) && !factionDead(s.faction);   // 외교 도구로 고를 수 있는 곳: 다른 세력의 수도
const REL_COL = { war: '#ff7d6a', truce: '#79bfff', neutral: '#d0d0d0', ally: '#7dff9a' };
function drawRelationPanel() {
  const pairs = [['여포', '원소'], ['여포', '조조'], ['여포', '유비'], ['원소', '조조'], ['원소', '유비'], ['조조', '유비']], x = 470, y = mobile ? 614 : 636, w = mobile ? 528 : 520, h = mobile ? 100 : 70, colW = mobile ? 258 : 168, rowH = mobile ? 28 : 26, perRow = mobile ? 2 : 3;   // 모바일: 2열 3행 (글자가 커서)
  ctx.save(); ctx.fillStyle = 'rgba(8,20,25,.78)'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h); ctx.restore();
  if (!mobile) label('세력 관계', x + 10, y + 14, 12, COLORS.gold);
    pairs.forEach(([a, b], i) => {
    const player = a === playerFaction() ? b : b === playerFaction() ? a : null, st = player ? relationOf(player) : FACTION_ALLIES[a] === b ? { status: 'ally' } : aiRel(a, b), col = REL_COL[st.status] || '#fff', cx = x + 10 + (i % perRow) * colW, cy = (mobile ? y + 18 : y + 30) + Math.floor(i / perRow) * rowH;
    swatch(a, cx, cy - 8, 8); swatch(b, cx + 9, cy - 8, 8);
    const nameW = mobile ? 66 : 60; label(mobile ? a[0] + '↔' + b[0] : a + '↔' + b, cx + 20, cy, 12, COLORS.silver, 'left', nameW); if (factionDead(a) || factionDead(b)) { label('멸망', cx + colW - 8, cy, 12, '#8a8a8a', 'right'); return; }   // 모바일은 글자가 커서 첫 글자만(여↔조) — 상태 글자와 겹치지 않게 양쪽 폭을 정한다
    label((player ? relationText(player) : st.status === 'truce' ? '휴전 ' + Math.max(0, st.truceUntil - campaign.turn) + '턴' : RELATION_NAME[st.status]) + '·' + affinityStage(affinityOf(a, b)).name, cx + colW - 8, cy, 12, col, 'right', colW - 20 - nameW - 12);
  });
}
// ---- 지도 카메라 (명세 43 1-4): 월드 1700×1200 중 왼쪽 1000×720 만 보인다. 빈 곳 드래그·방향키·휠·Home·미니맵으로 옮긴다 ----
const MAP_VW = 1000, MAP_MINI = { x: 10, y: 10, w: 170, h: 120 };
let mcam = { x: 0, y: 0 }, mapSel = null, mapDrag = null;   // mapSel: 오른쪽 패널에 보여 줄 선택 도시 id (없으면 현재 군단 도시)
const mapKeys = new Set();
const clampMcam = () => { mcam.x = Math.max(0, Math.min(WORLD_W - MAP_VW, mcam.x)); mcam.y = Math.max(0, Math.min(WORLD_H - VH, mcam.y)); };
function centerMap(id) { const s = stageById(id || (roster[campaign.corps] && roster[campaign.corps].at)); mapSel = null; if (s) { mcam.x = s.x - MAP_VW / 2; mcam.y = s.y - VH / 2; } clampMcam(); }
const mapFree = () => state === 'map' && !custodyOpen() && !(stratTutStep >= 0 || saveSlotMode || campaign.pendingEncounter || warnMove || allyChoice || diplomacyResult || diplomacyView || heroView || scoutView || econView || exploreSelectOpen || moveSelectOpen || campaign.movement.length);   // 팝업이 없을 때만 카메라 입력을 받는다
const inMapMini = p => p.x >= MAP_MINI.x && p.x < MAP_MINI.x + MAP_MINI.w && p.y >= MAP_MINI.y && p.y < MAP_MINI.y + MAP_MINI.h;
function miniJump(p) { mcam.x = (p.x - MAP_MINI.x) * (WORLD_W / MAP_MINI.w) - MAP_VW / 2; mcam.y = (p.y - MAP_MINI.y) * (WORLD_H / MAP_MINI.h) - VH / 2; clampMcam(); }
function drawMapSea() {
  ctx.fillStyle = '#1f6677'; ctx.beginPath(); ctx.moveTo(WORLD_W, 0); ctx.lineTo(1665, 0);
  ctx.bezierCurveTo(1655, 60, 1660, 110, 1620, 140);
  ctx.bezierCurveTo(1500, 155, 1320, 140, 1250, 205);
  ctx.bezierCurveTo(1190, 255, 1230, 320, 1360, 350);
  ctx.bezierCurveTo(1450, 380, 1560, 350, 1635, 390);
  ctx.bezierCurveTo(1640, 500, 1680, 1050, 1650, WORLD_H);
  ctx.lineTo(WORLD_W, WORLD_H); ctx.closePath(); ctx.fill();
}
function drawMapMini() {
  const m = MAP_MINI, k = m.w / WORLD_W;
  panel(m.x, m.y, m.w, m.h, 'rgba(255,255,255,.55)', 1, 'rgba(8,20,25,.72)');
  ctx.save(); ctx.translate(m.x, m.y); ctx.scale(k, k); drawMapSea(); ctx.restore();
  ctx.strokeStyle = '#78b8c6'; ctx.lineWidth = 1.5; ctx.beginPath();
  YELLOW_RIVER.forEach(([x, y], i) => { if (i) ctx.lineTo(m.x + x * k, m.y + y * k); else ctx.moveTo(m.x + x * k, m.y + y * k); }); ctx.stroke();
  for (const s of STAGES) { const style = FACTION_STYLE[stageFaction(s)]; ctx.fillStyle = style.dark; ctx.fillRect(m.x + s.x * k - 2.5, m.y + s.y * k - 2.5, 5, 5); ctx.fillStyle = style.main; ctx.fillRect(m.x + s.x * k - 1.5, m.y + s.y * k - 1.5, 3, 3); }
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(m.x + mcam.x * k, m.y + mcam.y * k, MAP_VW * k, VH * k);
}
function drawStageMap() {
  const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#345d55'); g.addColorStop(0.55, '#66834c'); g.addColorStop(1, '#9a8150'); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  const corps = roster[campaign.corps], here = stageById(corps.at), sel = stageById(mapSel) || here, ox = mcam.x, oy = mcam.y;
  const vis = (x, y, m = 70) => x >= ox - m && x <= ox + MAP_VW + m && y >= oy - m && y <= oy + VH + m;
  const stationedAt = s => roster.map((c, i) => ({ c, i })).filter(({ c }) => c.units.some(Boolean) && c.at === s.id);   // 이 도시에 주둔 중인 아군 군단
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, MAP_VW, VH); ctx.clip(); ctx.translate(-ox, -oy);
  ctx.fillStyle = 'rgba(25,55,30,.25)'; for (let x = 60; x < WORLD_W; x += 90) for (let y = 75; y < WORLD_H; y += 75) if (vis(x, y, 40)) { ctx.beginPath(); ctx.arc(x + (y % 35), y, 30, 0, TAU); ctx.fill(); }
  drawMapSea();
  if (vis(1460, 245)) label('발해', 1460, 245, 27, '#b6d5da', 'center');
  for (const m of MAP_MOUNTAINS) {
    for (let i = 0; i < m.n; i++) {
      const x = m.x + i * m.dx, y = m.y + i * m.dy, h = m.h + (i % 3) * 7;
      if (!vis(x, y, 100)) continue;
      ctx.beginPath(); ctx.moveTo(x - 35, y + 18); ctx.lineTo(x - 6, y - h); ctx.lineTo(x + 36, y + 18); ctx.closePath();
      ctx.fillStyle = '#77745c'; ctx.fill(); ctx.strokeStyle = '#414b3a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 6, y - h); ctx.lineTo(x + 36, y + 18); ctx.lineTo(x + 3, y + 7); ctx.closePath(); ctx.fillStyle = '#4a5743'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 6, y - h); ctx.lineTo(x - 14, y - h + 22); ctx.lineTo(x - 4, y - h + 15); ctx.lineTo(x + 8, y - h + 25); ctx.closePath(); ctx.fillStyle = '#c4b995'; ctx.fill();
    }
    if (vis(m.lx, m.ly)) label(m.name, m.lx, m.ly, 19, '#e0d4ad', 'center');
  }
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath();
  YELLOW_RIVER.forEach(([x, y], i) => { if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
  for (const [width, color] of [[29, '#626b45'], [23, '#397c91'], [12, '#6ea5ac'], [3, '#a6c7bb']]) { ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke(); }
  ctx.restore();
  if (vis(1035, 525)) label('황하', 1035, 525, 23, '#bce6e8', 'center');
  for (const s of STAGES) for (const id of s.links) { const t = stageById(id); if (s.id < t.id && Math.max(s.x, t.x) >= ox - 20 && Math.min(s.x, t.x) <= ox + MAP_VW + 20 && Math.max(s.y, t.y) >= oy - 20 && Math.min(s.y, t.y) <= oy + VH + 20) { ctx.strokeStyle = 'rgba(29,25,20,.82)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y); ctx.stroke(); ctx.strokeStyle = '#d9c98a'; ctx.lineWidth = 2; ctx.stroke(); } }
  for (const [name, x, y] of [['화북', 850, 140], ['사예', 440, 590], ['연주', 820, 850], ['예주', 625, 1010], ['서주', 1480, 880]]) if (vis(x, y)) label(name, x, y, 32, 'rgba(255,239,190,.65)', 'center');
  const targetRows = {};
  for (const [corpsIndex, c] of roster.entries()) if (c.target) {
    const path = route(c.at, c.target).map(stageById), goal = path[path.length - 1], row = targetRows[c.target] || 0; targetRows[c.target] = row + 1; if (path.length < 2) continue;
    ctx.save(); ctx.strokeStyle = '#75dcff'; ctx.lineWidth = 4; ctx.setLineDash([10, 7]); ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y); for (const s of path.slice(1)) ctx.lineTo(s.x, s.y); ctx.stroke(); ctx.restore();
    const a = path[0], b = path[1], fx = (a.x + b.x) / 2, fy = (a.y + b.y) / 2 - row * 24, commander = Sim.U[c.units[0]]?.name || corpsName(c);
    drawMapFlag(fx, fy, playerFaction(), String(corpsIndex + 1)); label(commander, fx + 18, fy + 32, 12, FACTION_STYLE[playerFaction()].light, 'center');
    label('이동 예정', goal.x, goal.y - 42 - row * 16, 13, '#bcecff', 'center');
  }
  campaign.movement.forEach((m, i) => { const a = stageById(m.from), b = stageById(m.to); if (!a || !b) return; const faction = m.team === 'player' ? playerFaction() : m.faction || a.faction, style = FACTION_STYLE[faction], highlight = i === campaign.movementPage; ctx.strokeStyle = style.light; ctx.lineWidth = highlight ? 11 : 7; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); const fx = (a.x + b.x) / 2, fy = (a.y + b.y) / 2; drawMapFlag(fx, fy, faction, String(m.team === 'player' ? (m.corpsIndex || 0) + 1 : (m.forceId ?? i) + 1), highlight); label(m.commander, fx + 20, fy + 32, 12, style.light, 'center'); });
  const cityBtns = [];
  for (const s of STAGES) {
    if (!vis(s.x, s.y)) continue;   // 화면 밖 도시는 그리지 않고 버튼도 만들지 않는다
    const on = s === here, faction = stageFaction(s), style = FACTION_STYLE[faction], targeted = s.id === (campaign.destination || corps.target), stationed = stationedAt(s);
    ctx.fillStyle = style.main; ctx.beginPath(); ctx.arc(s.x, s.y, on ? 20 : 14, 0, TAU); ctx.fill(); ctx.strokeStyle = on ? COLORS.gold : style.dark; ctx.lineWidth = on ? 5 : 3; ctx.stroke();
    if (s === sel && !on) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.x, s.y, 19, 0, TAU); ctx.stroke(); }
    label(`${isCapital(s) ? '★ ' : ''}${s.name}`, s.x, s.y + (on ? 32 : 26), 15, on ? COLORS.goldSel : '#f3eed8', 'center');
    { const kd = cityKind(s); if (kd.letter && (!mobile || s === sel)) label(kd.letter, s.x - 24, s.y - 16, 13, COLORS.goldSel, 'center'); }   // 도시 유형 글자 (모바일은 선택한 도시만)
    if (stationed.length) drawMapFlag(s.x + 12, s.y - 6, playerFaction(), String(stationed.length), stationed.some(({ i }) => i === campaign.corps));   // 주둔 아군: 깃발 + 군단 수
    if (targeted) { ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(s.x, s.y, 27, 0, TAU); ctx.stroke(); }
    if (mapTool === 'diplomacy') {   // 외교 도구: 외교 가능한 수도만 강조하고 나머지는 어둡게 눌러 선택할 수 없게 한다
      if (diplomable(s)) { const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 220); ctx.save(); ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 4 + pulse * 3; ctx.beginPath(); ctx.arc(s.x, s.y, 32 + pulse * 4, 0, TAU); ctx.stroke(); ctx.restore(); label('외교 가능', s.x, s.y - 40, 14, COLORS.goldSel, 'center'); }
      else { ctx.save(); ctx.fillStyle = 'rgba(8,12,18,.62)'; ctx.beginPath(); ctx.arc(s.x, s.y, 24, 0, TAU); ctx.fill(); ctx.restore(); continue; }
    }
    if (mobile) { cityBtns.push({ id: 'stage:' + s.id, x: s.x - ox - TOUCH / 2, y: s.y - oy - TOUCH / 2, w: TOUCH, h: TOUCH }); continue; }   // 모바일: 86×86 터치 영역 (이웃 도시와 겹치면 hitBtn 이 가까운 쪽을 고른다)
    const x0 = Math.max(0, s.x - 36 - ox), x1 = Math.min(MAP_VW, s.x + 36 - ox), y0 = Math.max(0, s.y - 28 - oy), y1 = Math.min(VH, s.y + 42 - oy);
    if (x1 > x0 && y1 > y0) cityBtns.push({ id: 'stage:' + s.id, x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  }
  ctx.restore();
  btns.push(...cityBtns);
  drawMapMini();
  button('campaign:help', mobile ? 378 : 1180, mobile ? 621 : 26, mobile ? TOUCH : 66, mobile ? TOUCH : 30, '도움말', false, mobile ? 17 : 14);   // 지도 위가 아닌 곳(PC 패널 제목줄·모바일 하단 띠)에 둬 도시 판정과 겹치지 않는다 (QA v0.1.272 경미 3)
  drawRelationPanel();
  if (mobile) drawMapPanelMobile(sel, stationedAt); else {
  panel(1005, 20, 250, 696, COLORS.gold, 3, 'rgba(8,20,25,.88)');
  label('전략', 1130, 46, 27, COLORS.gold, 'center');
  label(`점령 ${STAGES.filter(s => s.owner === 'player').length}/${STAGES.length} · ${campaign.turn}턴`, 1025, 78, 15, COLORS.silver);
  label(moveMode === 'city' && !moveSelectOpen ? '지도에서 이동할 지역을 선택' : `이동 예정 ${roster.filter(c => c.target).length}개 군단`, 1130, 100, 14, moveMode === 'city' && !moveSelectOpen ? COLORS.gold : COLORS.silver2, 'center');
  label(`목표: 모든 도시 점령 ${STAGES.length - unclaimedCities().length}/${STAGES.length}`, 1025, 120, 13, COLORS.gold);
  { const f = stageFaction(sel), st = stationedAt(sel), foes = enemyForces.filter(x => x.active && x.at === sel.id), lead = c => c.units[0] ? Sim.U[c.units[0]].name : corpsName(c);   // 선택한 도시 정보
    label(`${isCapital(sel) ? '★' : ''}${sel.name} · ${f} · ${CITY_SIZES[citySize(sel)].name}`, 1025, 146, 13, COLORS.goldSel);
    { const ci = capitalInfo(sel); if (ci) label(ci.line1, 1025, 162, 11, ci.col); else label(`도시수비 ${guardsAt(sel).reduce((n, g) => n + g.army.units.length, 0)}/${guardCap(sel)}명 · Lv${CITY_SIZES[citySize(sel)].level + cityKind(sel).lv}`, 1025, 162, 11, sel.theme === 'fortress' ? '#ffb06a' : COLORS.silver2); }
    { const ci = capitalInfo(sel); wrapText(kindLine(sel), 22).slice(0, ci ? 1 : 2).forEach((t, i) => label(t, 1025, 192 + i * 13, 10, COLORS.silver2)); if (ci) label(ci.line2, 1025, 205, 10, COLORS.silver2); }
    label(st.length ? (st.length === 1 ? `${lead(st[0].c)} 군단` : `${lead(st[0].c)} 군단 외 ${st.length - 1}`) : foes.length ? `${Sim.U[foes[0].army.leader]?.name || foes[0].army.name} 부대${foes.length > 1 ? ' 외 ' + (foes.length - 1) : ''}` : '기동 군단 없음', 1025, 177, 11, COLORS.silver);
  }
  drawGrainChip(1025, 220, 210, mobile ? 88 : 44);
  { const top = mobile ? 318 : 272, rows = mobile ? 0 : 3; label('내 군단', 1025, top, 11, COLORS.gold);
    roster.slice(0, rows).forEach((c, i) => label(`${i + 1}. ${c.units[0] ? Sim.U[c.units[0]].name : '—'} · ${stageById(c.at).name}${c.target ? ' → ' + stageById(c.target).name : ''}`, 1025, top + 14 + i * 13, 10, i === campaign.corps ? COLORS.goldSel : COLORS.silver));
    if (roster.length > rows) label(mobile ? `${roster.length}개 군단 (군단 편성)` : `외 ${roster.length - rows}개 군단`, 1025, top + 14 + rows * 13, 10, COLORS.silver2); }
  button('campaign:scout', 1025, 340, 100, 34, '정찰', mapTool === 'scout', 15); button('campaign:diplomacy', 1135, 340, 100, 34, '외교', mapTool === 'diplomacy', 15);
  ctx.save(); ctx.strokeStyle = COLORS.gold; ctx.fillStyle = COLORS.gold; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(1043, 355, 6, 0, TAU); ctx.moveTo(1047.5, 359.5); ctx.lineTo(1054, 366); ctx.stroke();   // 정찰: 돋보기
  ctx.beginPath(); ctx.moveTo(1153, 366); ctx.lineTo(1153, 349); ctx.stroke(); ctx.beginPath(); ctx.moveTo(1153, 349); ctx.lineTo(1166, 353); ctx.lineTo(1153, 358); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();   // 외교: 백기
  button('campaign:move', 1025, 388, 210, 36, moveMode === 'city' && !moveSelectOpen ? '지역 선택 중' : '이동', moveSelectOpen || moveMode === 'city', 16);
  button('campaign:roster', 1025, 430, 100, 36, '군단 편성', false, 15); button('campaign:heroes', 1135, 430, 100, 36, '세력 장수', false, 15);
  button('campaign:explore', 1025, 472, 210, 36, '탐색', false, 16);
  button('campaign:save', 1025, 514, 100, 34, '저장', false, 15); button('campaign:load', 1135, 514, 100, 34, '로드', false, 15);
  button('campaign:end', 1025, 556, 210, 36, '진행하기', true, 16);   // 이동 버튼과 같은 크기(210×36), 저장·로드 아래
  panel(1025, 600, 210, 104, 'rgba(255,255,255,.35)', 1, 'rgba(0,0,0,.3)');   // 진행 안내 문구는 진행하기 버튼 아래
  wrapText(campaign.notice || '', 20).slice(0, 5).forEach((t, i) => label(t, 1130, 616 + i * 15, 12, COLORS.silver, 'center'));
  label('이동 지정 → 저장 → 진행하기', 1130, 692, 11, COLORS.goldSel, 'center');
  { const x0 = 10, y0 = 636;   // 세력·군단 정보는 세력 관계 박스(470~990) 왼쪽
    panel(x0, y0, 450, 70, 'rgba(255,255,255,.35)', 1, 'rgba(8,20,25,.78)');
    FACTIONS.forEach((f, i) => {
      const mine = f === playerFaction(), cities = mine ? STAGES.filter(s => s.owner === 'player').length : factionStages(f).length, n = mine ? roster.length : enemyForces.filter(x => x.active && forceFaction(x) === f).length, y = y0 + 15 + i * 16;
      swatch(f, x0 + 10, y - 5, 9); label(`${f}${mine ? '(나)' : ''} 도시 ${cities} · 기동군단 ${n}${factionDead(f) ? ' · 멸망' : ''}`, x0 + 25, y, 11, FACTION_STYLE[f].light);
    });
    const others = FACTIONS.filter(f => f !== playerFaction()).map(f => `${f} ${relationText(f)}`);
    label(`군주 ${FACTIONS.map(f => rulerName(f)).join('·')}`, x0 + 245, y0 + 15, 10, '#ffd0b8'); label(others.slice(0, 2).join(' · '), x0 + 245, y0 + 31, 10, COLORS.silver2); label(others.slice(2).join(' · '), x0 + 245, y0 + 47, 10, COLORS.silver2);
  }
  }
  if (moveSelectOpen) drawMoveSelect();
  if (exploreSelectOpen) drawExploreSelect();
  if (scoutView) drawScoutView();
  if (econView) drawEconView();
  if (diplomacyView) drawDiplomacyView();
  if (heroView) drawFactionHeroes();
  if (campaign.pendingEncounter) campaign.pendingEncounter.invasion && !campaign.pendingEncounter.intelSeen ? drawInvasionIntel() : drawResponseSelect();
  else if (campaign.movement.length) drawMovementNotice();
  if (diplomacyResult) drawDiplomacyResult();   // 팝업은 대응 군단·이동 안내 창 위에 그려야 버튼이 가려지지 않는다
  if (allyChoice) drawAllyChoice();
  if (warnMove) drawWarMoveWarn();
  if (saveSlotMode) drawSaveSlots();
  if (stratTutStep >= 0) drawStratTutorial();
}
function drawMapPanelMobile(sel, stationedAt) {   // 모바일: 오른쪽 패널을 터치 크기(86px 이상) 버튼 2열 격자로 다시 짠다
  const f = stageFaction(sel), st = stationedAt(sel), foes = enemyForces.filter(x => x.active && x.at === sel.id), lead = c => c.units[0] ? Sim.U[c.units[0]].name : corpsName(c), cx = 1138, W = 258;
  panel(1006, 4, 268, 712, COLORS.gold, 3, 'rgba(8,20,25,.9)');
  label('전략', cx, 26, 20, COLORS.gold, 'center');
  label(`점령 ${STAGES.filter(s => s.owner === 'player').length}/${STAGES.length} · ${campaign.turn}턴`, 1016, 56, 15, COLORS.silver, 'left', W);
  label(`${isCapital(sel) ? '★' : ''}${sel.name} · ${f} · ${CITY_SIZES[citySize(sel)].name}`, 1016, 82, 15, COLORS.goldSel, 'left', W);
  { const ci = capitalInfo(sel); if (ci) label(ci.line1, 1016, 108, 15, ci.col, 'left', W); else label(`도시수비 ${guardsAt(sel).reduce((n, g) => n + g.army.units.length, 0)}/${guardCap(sel)}명 · Lv${CITY_SIZES[citySize(sel)].level + cityKind(sel).lv}`, 1016, 108, 15, sel.theme === 'fortress' ? '#ffb06a' : COLORS.silver2, 'left', W); }
  label(st.length ? (st.length === 1 ? `${lead(st[0].c)} 군단` : `${lead(st[0].c)} 군단 외 ${st.length - 1}`) : foes.length ? `${Sim.U[foes[0].army.leader]?.name || foes[0].army.name} 부대${foes.length > 1 ? ' 외 ' + (foes.length - 1) : ''}` : '기동 군단 없음', 1016, 134, 15, COLORS.silver, 'left', W);
  { const ci = capitalInfo(sel); label(ci ? ci.line2 : kindLine(sel).split(' · ').slice(0, 2).join(' · '), 1016, 160, 15, COLORS.silver2, 'left', W); }
  const rows = [176, 266, 356, 446, 536, 626], bw = 124, xs = [1012, 1138];
  drawGrainChip(1012, rows[0], 250, TOUCH);
  button('campaign:scout', xs[0], rows[1], bw, TOUCH, '정찰', mapTool === 'scout', 17); button('campaign:diplomacy', xs[1], rows[1], bw, TOUCH, '외교', mapTool === 'diplomacy', 17);
  button('campaign:move', xs[0], rows[2], bw, TOUCH, moveMode === 'city' && !moveSelectOpen ? '선택 중' : '이동', moveSelectOpen || moveMode === 'city', 17); button('campaign:explore', xs[1], rows[2], bw, TOUCH, '탐색', false, 17);
  button('campaign:roster', xs[0], rows[3], bw, TOUCH, '군단 편성', false, 17); button('campaign:heroes', xs[1], rows[3], bw, TOUCH, '세력 장수', false, 17);
  button('campaign:save', xs[0], rows[4], bw, TOUCH, '저장', false, 17); button('campaign:load', xs[1], rows[4], bw, TOUCH, '로드', false, 17);
  button('campaign:end', 1012, rows[5], 250, TOUCH, '진행하기', true, 19);
  if (campaign.notice) { const lines = wrapText(campaign.notice, 36).slice(0, 2); panel(190, 6, 800, 12 + lines.length * 28, 'rgba(255,255,255,.35)', 1, 'rgba(8,20,25,.82)'); lines.forEach((t, i) => label(t, 200, 24 + i * 28, 15, COLORS.silver, 'left', 780)); }
  const x0 = 10, y0 = 614;   // 아래: 세력 요약 + 세력 관계
  panel(x0, y0, 360, 100, 'rgba(255,255,255,.35)', 1, 'rgba(8,20,25,.82)');   // 오른쪽 틈(378~464)은 도움말 버튼
  FACTIONS.forEach((fc, i) => { const mine = fc === playerFaction(), cities = mine ? STAGES.filter(s => s.owner === 'player').length : factionStages(fc).length, n = mine ? roster.length : enemyForces.filter(x => x.active && forceFaction(x) === fc).length, y = y0 + 14 + i * 24; swatch(fc, x0 + 8, y - 6, 10); label(`${fc}${mine ? '(나)' : ''} 도시 ${cities} · 군단 ${n}${factionDead(fc) ? ' · 멸망' : ''}`, x0 + 26, y, 12, FACTION_STYLE[fc].light, 'left', 322); });
}
function drawInvasionIntel() {
  const encounter = campaign.pendingEncounter, forces = enemyForces.filter(f => f.active && f.at === encounter.stage.id), shown = forces.slice(0, mb(13, 7)), x = mb(300, 160), y = mb(80, 6), w = mb(680, 960), h = mb(560, 708);
  ctx.fillStyle = 'rgba(10,12,20,.72)'; ctx.fillRect(0, 0, VW, VH); panel(x, y, w, h, COLORS.danger, 3, 'rgba(8,20,25,.98)');
  label(`${encounter.stage.name} 적 침공 정보`, x + w / 2, y + mb(42, 36), 27, '#ff9a7d', 'center');
  label(`적 ${forces.length}개 군단·${forces.reduce((n, f) => n + f.army.units.length, 0)}명 · 총 전투력 ⚔${forces.reduce((n, f) => n + forcePow(f), 0)}`, x + w / 2, y + mb(78, 74), 17, COLORS.goldSel, 'center', w - 40);
  shown.forEach((force, row) => { const commander = Sim.U[force.army.leader]?.name || force.army.name, role = force.role === 'garrison' ? '도시수비' : '기동'; label(`${commander} · ${role} Lv${force.level} · ${force.army.units.length}명 · ⚔${forcePow(force)}`, x + 55, y + mb(118, 146) + row * mb(27, 36), 15, COLORS.silver, 'left', w - 110); });
  if (forces.length > shown.length) label(`외 ${forces.length - shown.length}개 군단`, x + 55, y + mb(118, 146) + shown.length * mb(27, 36), 14, COLORS.silver2);
  label(enemyRolesAt(encounter.stage), x + w / 2, y + mb(99, 108), 13, COLORS.silver, mb('left', 'center'), w - 40);
  button('campaign:intel:continue', x + w / 2 - 110, y + h - mb(50, TOUCH + 10), 220, tb(36), encounter.guardDefense ? '수비군 자동 방어' : '대응 군단 선택', true, 16);
}
function drawMovementNotice() {
  const x = 10, y = 10, w = mb(420, 600), h = mb(150, 330), pages = campaign.movement.length, move = campaign.movement[campaign.movementPage];
  const encounter = movementEncounter(move), event = encounter ? encounter.capture ? '점령 발생' : move.team === 'enemy' ? '요격 발생' : '공격 발생' : '군단 이동 완료'; panel(x, y, w, h, move.team === 'enemy' ? COLORS.danger : COLORS.gold, 3, 'rgba(8,20,25,.96)'); label(`${event} · ${campaign.movementPage + 1}/${pages}`, x + w / 2, y + 28, 21, move.team === 'enemy' ? '#ff9a7d' : COLORS.gold, 'center');
  label(move.text, x + w / 2, y + 60, 14, COLORS.silver, 'center', w - 20);
  const nb = mb(132, 250), nh = tb(30), more = campaign.movementPage < pages - 1; turnOptionButtons(x + (w - (mb(112, 280) * 2 + 8)) / 2, y + h - mb(72, 2 * TOUCH + 18), mb(8, 12)); if (more) button('campaign:movement:skip', x + w / 2 + 8, y + h - nh - mb(8, 8), nb, nh, '건너뛰기', false, 14); button('campaign:movement:close', x + (more ? w / 2 - nb - 8 : w / 2 - nb / 2), y + h - nh - mb(8, 8), nb, nh, campaign.movementPage < pages - 1 ? '다음 군단' : campaign.pendingEncounter ? '계속' : '확인', true, 14);
}
const respN = () => mobile ? 3 : 6;   // 대응 군단 선택 창 한 쪽에 보이는 군단 수 (모바일은 줄 높이 86px)
function forceLine(f) { const faction = forceFaction(f), lead = Sim.U[f.army.leader] ? Sim.U[f.army.leader].name : f.army.name; return faction + '군 ' + lead + ' · ' + (f.role === 'garrison' ? '도시수비' : '기동') + ' Lv' + f.level + ' · ' + f.army.units.length + '명 · ⚔' + forcePow(f); }
function responseForces(encounter) {   // 요격 때 보여 줄 정보: 도시를 공격하는 적 군단 / 동맹 도시라면 지원 가능한 동맹 군단
  if (!encounter.invasion) return { attackers: [], allies: [] };
  const at = enemyForces.filter(f => f.active && f.at === encounter.stage.id), allies = guestInfo(encounter.stage).allies;
  return { attackers: at.filter(f => relationOf(forceFaction(f)).status === 'war'), allies };
}
function drawResponseSelect() {
  const encounter = campaign.pendingEncounter, pageSize = respN(), pages = Math.max(1, Math.ceil(encounter.responders.length / pageSize)), info = responseForces(encounter);
  campaign.responsePage = Math.max(0, Math.min(campaign.responsePage, pages - 1)); const shown = encounter.responders.slice(campaign.responsePage * pageSize, campaign.responsePage * pageSize + pageSize);
  ctx.fillStyle = 'rgba(10,12,20,.7)'; ctx.fillRect(0, 0, VW, VH);
  const x = mb(240, 100), y = mb(12, 6), w = mb(800, 1080), h = mb(696, 708), lh = mb(22, 28), mw = w - 60; panel(x, y, w, h, COLORS.danger, 3, 'rgba(8,20,25,.98)');
  label(encounter.stage.name + ' ' + (encounter.invasion ? '요격' : '공격') + ' · 대응 군단 선택', x + w / 2, y + mb(38, 32), 26, '#ffb06a', 'center', w - 160);
  if (!mobile) label(encounter.invasion ? '같은 도시 또는 연결된 도시의 군단이 요격할 수 있습니다.' : '도착한 군단으로 공격을 시작합니다.', x + w / 2, y + 70, 16, COLORS.silver, 'center');
  label('침공 ⚔' + info.attackers.reduce((n, f) => n + forcePow(f), 0) + ' · 기동 대응 ⚔' + encounter.responders.reduce((n, i) => n + corpsPow(roster[i]), 0) + ' · 도시수비 ⚔' + guardsAt(encounter.stage).reduce((n, f) => n + forcePow(f), 0), x + w / 2, y + mb(96, 66), 15, COLORS.goldSel, 'center', mw);
  let cy = y + mb(124, 92);
  const block = (title, list, col, maxRows) => {
    if (!list.length) return; label(title, x + 40, cy + 8, 15, col, 'left', mw); cy += lh + 2;
    list.slice(0, maxRows).forEach(f => { label(forceLine(f), x + 56, cy + 8, 14, COLORS.silver, 'left', mw - 16); cy += lh; });
    if (list.length > maxRows) { label('외 ' + (list.length - maxRows) + '개 군단', x + 56, cy + 8, 14, COLORS.silver2); cy += lh; }
    cy += 6;
  };
  block('▼ 공격 세력 (' + [...new Set(info.attackers.map(forceFaction))].join('·') + '군 ' + info.attackers.length + '개 군단 · ⚔' + info.attackers.reduce((n, f) => n + forcePow(f), 0) + ')', info.attackers, '#ff9a7d', mb(4, 1));
  block('▼ 지원 가능한 동맹 군단 (' + [...new Set(info.allies.map(forceFaction))].join('·') + '군 ' + info.allies.length + '개 군단 · ⚔' + info.allies.reduce((n, f) => n + forcePow(f), 0) + ')', info.allies, '#8fd6ff', mb(2, 1));
  if (info.allies.length) { label('※ 대응 군단을 고르면 동맹군과 함께 싸울지 선택합니다.', x + 40, cy + 8, 14, COLORS.goldSel, 'left', mw); cy += mb(26, 30); }
  shown.forEach((index, row) => { const corps = roster[index]; button('campaign:response:' + index, x + 40, cy + row * mb(42, 90), w - 80, tb(36), corpsName(corps) + ' · ' + stageById(corps.at).name + ' · ' + corps.units.filter(Boolean).length + '/18명 · ⚔' + corpsPow(corps), false, 16); });
  const fy = y + h - mb(50, TOUCH + 8), bw = mb(90, 150);
  button('campaign:response:prev', x + 40, fy, bw, tb(36), '◀', false, 18);
  button('campaign:response:abandon', x + w / 2 - mb(90, 130), fy, mb(180, 260), tb(36), encounter.invasion ? '기동군 철수' : '공격 포기', false, 16);
  button('campaign:response:next', x + w - 40 - bw, fy, bw, tb(36), '▶', false, 18);
  label((campaign.responsePage + 1) + '/' + pages, x + w - 40, y + mb(38, 32), 15, COLORS.silver, 'right');
}
function drawMoveSelect() {
  ctx.fillStyle = 'rgba(10,12,20,.62)'; ctx.fillRect(0, 0, VW, VH);
  const N = listN(), x = mb(300, 100), y = mb(70, 6), w = mb(680, 1080), h = mb(580, 708), pitch = mb(46, 90), foot = mb(50, TOUCH + 10), bw = mb(100, 170);
  panel(x, y, w, h, COLORS.gold, 3, 'rgba(8,20,25,.97)');
  movePage = Math.max(0, Math.min(movePage, Math.ceil(roster.length / N) - 1));
  const page = roster.slice(movePage * N, movePage * N + N);
  label('1. 이동할 군단 선택', x + w / 2, y + mb(40, 34), 25, COLORS.gold, 'center');
  label('군단을 선택한 뒤 전략 지도에서 목적지를 선택합니다.', x + w / 2, y + mb(75, 70), 16, COLORS.silver, 'center', w - 40);
  page.forEach((corps, row) => { const target = corps.target ? `${stageById(corps.target).name}(${moveTurns(corps)}턴)` : '대기'; button(`campaign:move:${movePage * N + row}`, x + 40, y + mb(105, 100) + row * pitch, w - 80, tb(38), `${corpsName(corps)}  ${stageById(corps.at).name} → ${target}  · ${corps.units.filter(Boolean).length}/18명 · ⚔${corpsPow(corps)}`, campaign.corps === movePage * N + row, 16); });
  button('campaign:move:prev', x + 40, y + h - foot, bw, tb(36), '◀', false, 18); button('campaign:move:close', x + w - 40 - bw, y + h - foot, bw, tb(36), '닫기', false, 16); button('campaign:move:next', x + w - 50 - bw * 2, y + h - foot, bw, tb(36), '▶', false, 18);
  if (mobile) label(`${movePage + 1}/${Math.max(1, Math.ceil(roster.length / N))}`, x + w / 2 - 40, y + h - foot + TOUCH / 2, 14, COLORS.silver2, 'center');
}
const econNow = f => { const income = Math.round(factionIncome(f).total), upkeep = Math.round(factionUnits(f) * ECON.unit); return { income, upkeep, net: income - upkeep }; };
function drawGrainChip(x, y, w, h) {   // 군량 칩: 순수입 음수면 주황, 기근이면 적색. 누르면 상세 창
  const f = playerFaction(), e = econNow(f), famine = campaign.famine[f] || 0, col = famine ? COLORS.danger : e.net < 0 ? '#ffb06a' : COLORS.gold;
  panel(x, y, w, h, col, 2, 'rgba(8,20,25,.6)'); label(`군량 ${grainOf(f)} (${e.net >= 0 ? '+' : ''}${e.net}/턴)${famine ? ' 기근' : ''}`, x + w / 2, y + h / 2, mobile ? 18 : 15, col, 'center'); btns.push({ id: 'campaign:econ', x, y, w, h });
}
function drawEconView() {
  const f = playerFaction(), inc = factionIncome(f), e = econNow(f), l = campaign.econLog[f] || {}, famine = campaign.famine[f] || 0, rest = STAGES.filter(s => stageFaction(s) === f && (campaign.unrest[s.id] || 0) > campaign.turn).length, touch = mobile ? 88 : 44, x = 290, y = 150, w = 700, h = 230 + touch;
  ctx.fillStyle = 'rgba(10,12,20,.68)'; ctx.fillRect(0, 0, VW, VH); panel(x, y, w, h, COLORS.gold, 3, 'rgba(8,20,25,.98)');
  label(`군량 ${grainOf(f)} / ${ECON.cap}`, x + w / 2, y + 40, 26, COLORS.gold, 'center');
  const rows = [
    `수입 +${e.income} — 도시 ${inc.n}개${inc.over ? ` (${ECON.limit}개 초과 ${inc.over}개는 ×${ECON.over})` : ''}${rest ? ` · 혼란 ${rest}개는 산출 0` : ''} · 기본 보급 +${ECON.base}`,
    `유지비 −${e.upkeep} — 기동 군단 병력 ${factionUnits(f)}명 × ${ECON.unit}${l.upkeep > e.upkeep ? ` · 지난 턴 이동 +${l.upkeep - e.upkeep}` : ''}`,
    `순수입 ${e.net >= 0 ? '+' : ''}${e.net}/턴${l.spent ? ` · 지난 턴 보충 −${l.spent}(병사 ${l.refill || 0}명)` : ''}`,
    famine ? `기근 ${famine}턴째 — 보충 중단${famine >= ECON.desertFrom ? ', 매 턴 군단마다 병사 1명 탈영' : ''}` : `기근 없음 — 정지한 군단은 아군 도시에서 병사를 채웁니다`,
  ];
  rows.forEach((t, i) => wrapText(t, 46).slice(0, 2).forEach((u, j) => label(u, x + 40, y + 86 + i * 34 + j * 15, 15, i === 3 && famine ? COLORS.danger : COLORS.silver)));
  button('campaign:econ:close', x + w / 2 - 80, y + h - touch - 16, 160, touch, '닫기', true, mobile ? 20 : 17);
}
function drawScoutView() {
  const stage = stageById(scoutView), forces = enemyForces.filter(f => f.active && f.at === stage.id).sort((a, b) => forcePow(b) - forcePow(a)), x = mb(260, 100), y = mb(60, 6), w = mb(760, 1080), h = mb(600, 708);
  ctx.fillStyle = 'rgba(10,12,20,.62)'; ctx.fillRect(0, 0, VW, VH); panel(x, y, w, h, COLORS.gold, 3, 'rgba(8,20,25,.97)');
  label(`${stage.name} 정찰 보고 · 기동 ${forces.length}군단 ⚔${enemyPowerAt(stage)}`, x + w / 2, y + mb(40, 32), 24, COLORS.gold, 'center', w - 40);
  label(`내 군단 ⚔${corpsNear(stage).reduce((n, { c }) => n + corpsPow(c), 0)} (지역·연결 지역)`, x + w / 2, y + mb(72, 66), 16, COLORS.silver, 'center', w - 40);
  if (!mobile) label(enemyRolesAt(stage), x + w / 2, y + 77, 17, COLORS.silver);
  forces.slice(0, mb(12, 12)).forEach((f, i) => label(`${f.army.name} [${f.role === 'garrison' ? '도시수비' : '기동'}] Lv${f.level} · ${f.army.units.length}명 · ⚔${forcePow(f)} · ${Sim.U[f.army.leader].name}`, x + 30, y + mb(112, 100) + i * mb(36, 40), 17, i === 0 ? COLORS.goldSel : COLORS.silver, 'left', w - 60));
  if (!forces.length) label('주둔한 적이 없습니다.', x + w / 2, y + 300, 20, COLORS.dim, 'center');
  button('campaign:scout:close', x + w / 2 - 70, y + h - mb(50, TOUCH + 10), 140, tb(36), '닫기', true, 16);
}
function heroInfo(faction, key) {
  const captive = campaign.prisoners.find(p => p.key === key);
  if (captive) return { lv: captive.growth.lv, status: captive.owner + '군 포로 · 출전 불가' };
  if (campaign.fallen.includes(key)) return { lv: 1, status: '전사·처형' };
  const own = roster.find(c => c.units.includes(key));
  if (own) { const slot = own.units.indexOf(key), lv = own.growth[slot]?.lv || 1; return { lv, status: faction === playerFaction() ? `${stageById(own.at).name} · ${roster.indexOf(own) + 1}군단 ${corpsName(own)}` : `${playerFaction()}군 투항 · ${corpsName(own)}` }; }
  const force = enemyForces.find(f => f.army.units.includes(key));
  if (!force) return { lv: 1, status: '전사·이탈' };
  return { lv: force.army.growth[force.army.units.indexOf(key)]?.lv || force.level || 1, status: force.active ? `${stageById(force.at).name} · ${force.corpsNo ? force.corpsNo + '군단 ' : ''}${force.role === 'garrison' ? '도시수비' : '기동'}` : '후퇴·비활성' };
}
const heroN = () => mobile ? 10 : 12;
function drawFactionHeroes() {
  const faction = heroView.faction, list = FACTION_HEROES[faction], per = heroN(), pages = Math.max(1, Math.ceil(list.length / per)), page = Math.min(heroView.page, pages - 1), x = mb(170, 20), y = mb(45, 6), w = mb(940, 1240), h = mb(630, 708);
  heroView.page = page; ctx.fillStyle = 'rgba(10,12,20,.72)'; ctx.fillRect(0, 0, VW, VH); panel(x, y, w, h, FACTION_STYLE[faction].main, 4, 'rgba(8,20,25,.99)');
  if (!mobile) label('세력 장수 정보', x + w / 2, y + 36, 26, COLORS.gold, 'center');
  const tw = mb(210, 296), tg = mb(225, 300), ty = mb(55, 8), hy = mb(122, 132), ry0 = mb(151, 160), rp = mb(34, 36), cx = mobile ? [30, 255, 560, 880] : [35, 220, 465, 690];   // 모바일: 탭 86px 높이, 열 간격 확대
  FACTIONS.forEach((name, i) => button(`campaign:heroes:faction:${name}`, x + mb(25, 24) + i * tg, y + ty, tw, tb(38), `${name}군 · ${FACTION_HEROES[name].length}명`, name === faction, 16));
  label('이름 / 등급', x + cx[0], y + hy, 14, COLORS.silver2); label('병종 · 칭호', x + cx[1], y + hy, 14, COLORS.silver2); label('기본 능력치', x + cx[2], y + hy, 14, COLORS.silver2); label('현재 상태', x + cx[3], y + hy, 14, COLORS.silver2);
  list.slice(page * per, page * per + per).forEach((key, i) => {
    const u = Sim.U[key], info = heroInfo(faction, key), st = Sim.levelStats(key, faction === playerFaction() ? 'player' : 'enemy', info.lv), ry = y + ry0 + i * rp, ruler = rulerKey(faction) === key ? ' ★군주' : '';
    if (i % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,.035)'; ctx.fillRect(x + 24, ry - rp / 2 + 2, w - 48, rp - 4); }
    label(`${u.name}${ruler} / ${Sim.GRADE[key]}급`, x + cx[0], ry, 15, ruler ? COLORS.goldSel : FACTION_STYLE[faction].light, 'left', cx[1] - cx[0] - 8);
    label(`${CATEGORY_NAME[Sim.unitCategory(key)]} · ${Sim.unitSubclass(key)}`, x + cx[1], ry, 14, COLORS.silver, 'left', cx[2] - cx[1] - 8);
    label(`Lv${info.lv} HP${st.maxHp} AT${st.atk} DF${st.df}`, x + cx[2], ry, 13, COLORS.silver2, 'left', cx[3] - cx[2] - 8);
    label(info.status, x + cx[3], ry, 13, /전사/.test(info.status) ? COLORS.danger : COLORS.silver, 'left', w - cx[3] - 24);
  });
  const fy = y + h - mb(55, TOUCH + 10);
  label(`${page + 1}/${pages}`, x + w / 2, mobile ? fy - 16 : y + h - 34, 15, COLORS.silver2, 'center');
  button('campaign:heroes:prev', x + 30, fy, mb(100, 190), tb(36), '◀', false, 18); button('campaign:heroes:close', x + w / 2 - mb(70, 100), fy, mb(140, 200), tb(36), '닫기', true, 16); button('campaign:heroes:next', x + w - mb(130, 220), fy, mb(100, 190), tb(36), '▶', false, 18);
}
function drawAllyChoice() {
  const c = allyChoice, fs2 = enemyForces.filter(f => c.ids.includes(f.id)), pow = fs2.reduce((n, f) => n + forcePow(f), 0), fac = [...new Set(fs2.map(forceFaction))].join('·'), corps = roster[campaign.corps], back = alliedBack(corps, c.stage);
  const w = 680, h = mb(340, 400), x = (VW - w) / 2, y = (VH - h) / 2; ctx.fillStyle = 'rgba(10,12,20,.74)'; ctx.fillRect(0, 0, VW, VH); panel(x, y, w, h, COLORS.gold, 4, 'rgba(8,20,25,.99)');
  label('동맹 세력과 같은 도시', x + w / 2, y + 40, 18, COLORS.silver2, 'center'); label(`${c.stage.name} · ${fac}군 동맹 군단 ${fs2.length}개 (⚔${pow})`, x + w / 2, y + 86, 25, COLORS.gold, 'center', w - 30);
  label(`동맹을 도와 함께 싸울지, 이전 도시(${back ? back.name : '없음'})로 퇴각할지 선택하세요.`, x + w / 2, y + 140, 17, COLORS.silver, 'center', w - 30);
  label(`내 군단 ${corps ? corpsName(corps) : ''} ⚔${corps ? corpsPow(corps) : 0}`, x + w / 2, y + 176, 16, COLORS.goldSel, 'center');
  button('campaign:ally:help', x + mb(60, 40), y + h - mb(100, TOUCH + 22), mb(270, 290), tb(54), '동맹군과 함께 싸운다', true, 19); button('campaign:ally:retreat', x + w - mb(330, 330), y + h - mb(100, TOUCH + 22), mb(270, 290), tb(54), '이전 도시로 퇴각', false, 19);
}
function alliedBack(corps, stage) { const id = corps && corps.prevAt && corps.prevAt !== stage.id ? corps.prevAt : (campaign.from && campaign.from !== stage.id ? campaign.from : stage.links.find(l => stageById(l).owner === 'player') || stage.links[0]); return id ? stageById(id) : null; }
function drawWarMoveWarn() {   // 이동 경로에 중립 도시가 있을 때의 전쟁 경고 팝업
  const w = mb(620, 760), h = mb(270, 380), x = (VW - w) / 2, y = (VH - h) / 2, s = warnMove.stage, f = s.faction;
  ctx.fillStyle = 'rgba(10,12,20,.72)'; ctx.fillRect(0, 0, VW, VH); panel(x, y, w, h, COLORS.danger, 4, 'rgba(8,20,25,.99)');
  label('전쟁 경고', x + w / 2, y + 40, 18, COLORS.silver2, 'center'); label(f + '군 ' + peaceName(f) + ' 도시 진입', x + w / 2, y + 84, 27, COLORS.danger, 'center');
  label('이동 경로에 ' + (peaceName(f) === '휴전' ? '휴전 중인 ' : '중립 세력 ') + f + '군의 ' + s.name + '이(가) 있습니다.', x + w / 2, y + 128, 17, COLORS.silver, 'center', w - 30);
  label('군단이 그 도시에 들어서면 즉시 전쟁이 시작됩니다.', x + w / 2, y + 162, 17, COLORS.silver, 'center');
  button('campaign:warn:ok', x + w / 2 - mb(170, 250), y + h - mb(60, TOUCH + 20), mb(160, 240), tb(38), '전쟁을 감수하고 이동', true, 16); button('campaign:warn:cancel', x + w / 2 + 10, y + h - mb(60, TOUCH + 20), mb(160, 240), tb(38), '이동 취소', false, 16);
}
function wrapText(text, n) {   // 공백에서 줄바꿈 (공백이 없으면 글자 수로)
  const out = []; let cur = '';
  for (const word of String(text).split(' ')) {
    if (!cur) cur = word; else if ((cur + ' ' + word).length <= n) cur += ' ' + word; else { out.push(cur); cur = word; }
    while (cur.length > n) { out.push(cur.slice(0, n)); cur = cur.slice(n); }
  }
  return out.concat(cur ? [cur] : out.length ? [] : ['']);
}
function drawDiplomacyResult() {
  const r = diplomacyResult, lines = (r.lines || []).flatMap(t => wrapText(t, 42)), w = lines.some(t => t.length > 28) ? 780 : 600, bh = mobile ? 88 : 38, h = 152 + bh + lines.length * 34, x = (VW - w) / 2, y = (VH - h) / 2, col = r.ok ? COLORS.gold : COLORS.danger;
  ctx.fillStyle = 'rgba(10,12,20,.72)'; ctx.fillRect(0, 0, VW, VH); panel(x, y, w, h, col, 4, 'rgba(8,20,25,.99)');
  label(r.kind || (r.ok ? '외교 결과' : '외교 실패'), x + w / 2, y + 40, 18, COLORS.silver2, 'center'); label(r.title, x + w / 2, y + 84, 27, col, 'center');
  lines.forEach((t, i) => label(t, x + w / 2, y + 128 + i * 34, 17, COLORS.silver, 'center'));
  button('campaign:diplomacy:ok', x + w / 2 - 80, y + h - bh - 18, 160, bh, '확인', true, 18);
}
const signed = n => (n < 0 ? '−' : '+') + Math.abs(Math.round(n));
function dipButtonText(P, faction, action) {   // 버튼 글자: 성공률 / 불가("—") / 전쟁은 파기 대가
  const o = diplomacyOption(P, faction, action), st = relationOf(faction).status;
  if (action === 'war') return { o, text: o.ok ? `전쟁  호감도 ${signed(-o.cost)}` : '전쟁' };
  const name = action === 'truce' ? (st === 'truce' ? '휴전 갱신' : '20턴 휴전') : '동맹';
  return { o, text: `${name}  ${o.ok ? Math.round(o.p) + '%' : '—'}` };
}
function drawDiplomacyView() {   // 외교 창 (명세 62 A7): 호감도 단계·역사 사유·최근 변화·버튼별 성공률·쿨다운. 모바일은 버튼을 세로 3줄(각 86px)로 쌓는다
  const P = playerFaction(), faction = diplomacyView, relation = relationOf(faction), capital = stageById(campaignCapital(faction)), A = affinityOf(P, faction), stage = affinityStage(A), key = pairKey(P, faction), last = (campaign.affLast || {})[key];
  const w = mb(640, 760), h = mb(440, 712), x = (VW - w) / 2, y = mb(130, 4), cx = x + w / 2;
  ctx.fillStyle = 'rgba(10,12,20,.68)'; ctx.fillRect(0, 0, VW, VH); panel(x, y, w, h, FACTION_STYLE[faction].main, 4, 'rgba(8,20,25,.98)');
  const gd = guardsAt(capital).reduce((n, g) => n + g.army.units.length, 0);
  label(`${faction}군 외교 · ${capital.name}`, cx, y + mb(36, 28), mb(26, 24), FACTION_STYLE[faction].light, 'center', w - 20);
  label(`현재 관계: ${relationText(faction)} · 군주 ${rulerName(faction)}`, cx, y + mb(72, 62), 17, COLORS.goldSel, 'center', w - 20);
  label(`호감도: ${stage.name} (${signed(A)})`, cx, y + mb(100, 92), 20, stage.col, 'center', w - 20);
  const why = wrapText(AFFINITY_WHY[key] || '', mobile ? 26 : 38).slice(0, 2); why.forEach((t, i) => label(t, cx, y + mb(126, 120) + i * mb(18, 26), 14, COLORS.silver, 'center', w - 20));
  let ly = y + mb(126, 120) + why.length * mb(18, 26) + mb(6, 4);
  if (last) { label(`${last.turn}턴 ${last.why} ${signed(last.delta)}`, cx, ly + 6, 13, COLORS.silver2, 'center', w - 20); ly += mb(20, 26); }
  label(`${capital.name} 수비 ${gd}/${guardCap(capital)}명`, cx, ly + 6, 13, gd < guardCap(capital) * 0.7 ? '#ffb06a' : COLORS.silver2, 'center', w - 20); ly += mb(22, 26);
  const acts = ['truce', 'ally', 'war'], info = acts.map(a => dipButtonText(P, faction, a)), bh = tb(54), dw = mb(180, 0), gap = (w - 3 * dw) / 4, by = ly + 8;
  acts.forEach((a, i) => {
    const bx = mobile ? x + 30 : x + gap + i * (dw + gap), bw = mobile ? w - 60 : dw, byy = mobile ? by + i * (bh + 6) : by;
    button('campaign:diplomacy:' + a, bx, byy, bw, bh, info[i].text, relation.status === (a === 'war' ? 'war' : a), mobile ? 19 : 17);
    if (!info[i].o.ok) { btns.pop(); ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(bx, byy, bw, bh); }   // 비활성: 어둡게 하고 눌러도 반응 없음
  });
  const notes = info.slice(0, 2).map((d, i) => d.o.ok || /^다음 외교/.test(d.o.why) ? '' : `${i ? '동맹' : '휴전'}: ${d.o.why}`).filter(Boolean), cool = (campaign.dipCool || {})[faction] || 0;
  if (cool > campaign.turn) notes.unshift(`다음 외교 가능: ${cool - campaign.turn}턴 후`);
  const ny = mobile ? by + 3 * (bh + 6) + 10 : by + bh + 22;
  [...new Set(notes)].slice(0, 3).forEach((t, i) => label(t, cx, ny + i * mb(20, 26), 13, '#ffb06a', 'center', w - 20));
  if (!mobile) label(relation.status === 'neutral' ? '고르지 않으면 중립 유지 · 곧 긴장이 고조돼 전쟁이 시작될 수 있고, 군단이 도시에 진입하면 즉시 전쟁' : relation.status === 'war' ? '휴전하면 20턴 동안 서로 침공하지 않습니다.' : '전쟁을 선택하면 즉시 상호 공격이 가능해지고 호감도가 크게 떨어집니다.', cx, y + h - 92, 13, COLORS.silver2, 'center', w - 30);
  button('campaign:diplomacy:close', cx - 80, y + h - mb(55, TOUCH + 4), 160, tb(36), '닫기', false, 16);
}
function drawExploreSelect() {
  ctx.fillStyle = 'rgba(10,12,20,.62)'; ctx.fillRect(0, 0, VW, VH);
  const N = listN(), x = mb(300, 100), y = mb(70, 6), w = mb(680, 1080), h = mb(580, 708), pitch = mb(46, 90), foot = mb(50, TOUCH + 10), bw = mb(100, 170), available = roster.map((corps, index) => ({ corps, index })).filter(({ corps }) => combatReadyCorps(corps) && stageById(corps.at).owner === 'player'), pages = Math.max(1, Math.ceil(available.length / N));
  explorePage = Math.max(0, Math.min(explorePage, pages - 1)); const page = available.slice(explorePage * N, explorePage * N + N);
  panel(x, y, w, h, COLORS.gold, 3, 'rgba(8,20,25,.97)');
  label('탐색할 군단 선택', x + w / 2, y + mb(40, 34), 25, COLORS.gold, 'center');
  label('선택한 군단이 현재 주둔 중인 점령 지역을 탐색합니다.', x + w / 2, y + mb(75, 70), 16, COLORS.silver, 'center', w - 40);
  page.forEach(({ corps, index }, row) => button(`campaign:explore:${index}`, x + 40, y + mb(105, 100) + row * pitch, w - 80, tb(38), `${corpsName(corps)} · ${stageById(corps.at).name} · ${corps.units.filter(Boolean).length}/18명 · ⚔${corpsPow(corps)}`, false, 16));
  button('campaign:explore:prev', x + 40, y + h - foot, bw, tb(36), '◀', false, 18); button('campaign:explore:close', x + w - 40 - bw, y + h - foot, bw, tb(36), '닫기', false, 16); button('campaign:explore:next', x + w - 50 - bw * 2, y + h - foot, bw, tb(36), '▶', false, 18); label(`${explorePage + 1}/${pages}`, x + w / 2 - mb(0, 40), y + h - foot + tb(36) / 2, 14, COLORS.silver2, 'center');
}
const rosterHeroes = () => roster.flatMap((c, ci) => c.units.map((key, slot) => ({ key, slot, ci }))).filter(x => x.key && !Sim.U[x.key].generic);   // 세력 내 모든 군단의 이름 있는 장수
function autoDisbandEmpty() {   // 장수·병사가 하나도 없는 군단은 자동으로 해제한다 (마지막 한 군단은 남긴다)
  let removedCount = 0;
  for (let i = roster.length - 1; i >= 0 && roster.length > 1; i--) {
    if (roster[i].units.some(Boolean)) continue;
    roster.splice(i, 1); removedCount++;
    if (campaign.corps === i) campaign.corps = 0; else if (campaign.corps > i) campaign.corps--;
    if (rosterSource === i) rosterSource = 0; else if (rosterSource > i) rosterSource--;
    if (rosterTarget !== null) { if (rosterTarget === i) rosterTarget = null; else if (rosterTarget > i) rosterTarget--; }
    if (rosterNew !== null) { if (rosterNew === i) rosterNew = null; else if (rosterNew > i) rosterNew--; }
    if (rosterDetailCorps > i) rosterDetailCorps--; else if (rosterDetailCorps === i) rosterDetailCorps = 0;
  }
  if (removedCount) { rosterPage = 0; const active = roster[campaign.corps]; if (active) { campaign.at = active.at; campaign.destination = active.target; } campaign.notice = `비어 있는 군단 ${removedCount}개가 자동으로 해제되었습니다.`; }
  return removedCount;
}
function drawHeroInfo(key, unit, growth, stats, item) {   // 장수 상세 오른쪽 정보 (모바일은 패널 위치에 맞춰 평행이동)
  ctx.save(); if (mobile) ctx.translate(-22, 16);
  drawBody(ctx, 500, 236, 28, 0, STYLES[unit.style] || STYLES.captain, { t: T, weaponLen: 95 });
  const main = CATEGORY_NAME[Sim.unitCategory(key)], sub = Sim.unitSubclass(key), grade = Sim.GRADE[key] || '일반', lv = growth.lv || 1, xp = growth.xp || 0;
  label(unit.name, 590, 130, 30, COLORS.goldSel); label(`LV ${lv} · XP ${lv >= Sim.MAX_LEVEL ? 'MAX' : xp + '/' + Sim.XP_NEED(lv)} · 등급 ${grade}`, 590, 166, 18, COLORS.silver, 'left', 640);
  label(`병종 ${main} · 역할 ${Sim.roleOf(key)} · 칭호 ${sub}`, 590, 200, 21, COLORS.gold, 'left', 640); label(`전투력 ⚔${Sim.statPower(stats)} · ITEM ${item ? item.name : '없음'}`, 590, 234, 17, COLORS.silver2, 'left', 640);
  const values = [['HP', stats.maxHp], ['MP', growth.maxMp ?? unit.mp ?? 0], ['FT', 0], ['AT', stats.atk], ['DF', stats.df], ['AD', stats.ad], ['MD', stats.md], ['AA', stats.aa], ['HR', stats.hr], ['SP', stats.sp], ['AR', stats.ar], ['DR', stats.dr]];
  const gp = mobile ? 44 : 50, ey0 = mobile ? 430 : 448;
  values.forEach(([name, value], i) => { const col = i % 4, row = Math.floor(i / 4); panel(438 + col * 194, 282 + row * gp, 178, 38, COLORS.silver2, 1, 'rgba(15,44,52,.8)'); label(name, 448 + col * 194, 301 + row * gp, 15, COLORS.gold); if (!mobile) label(STAT_DESC[name], 480 + col * 194, 302 + row * 50, 11, COLORS.silver2); label(String(Math.round(value * 10) / 10), 606 + col * 194, 301 + row * gp, 17, COLORS.silver, 'right'); });
  label('칭호·고유 효과', 438, ey0, 19, COLORS.gold); const lp = mobile ? 26 : 24; let effects = [...(Sim.titleDesc(sub) || ['고유 칭호 효과 없음. 기본 병종과 특수기를 사용한다.'])]; if (unit.movingShot) effects.push('기마궁술: 이동 중에도 원거리 공격 가능.');
  if (mobile) effects = effects.flatMap(t => wrapText(t, 40));   // 글자가 커서 긴 효과는 줄바꿈
  effects.forEach((t, i) => label(t, 438, ey0 + 28 + i * lp, 15, COLORS.silver, 'left', 840)); const ey = ey0 + 28 + effects.length * lp + 10;   // 효과 줄 수에 맞춰 아래 항목을 내려 겹치지 않게 한다
  label(`특수기: ${unit.special ? `${SPECIAL[unit.special]?.name} — ${SPECIAL_EFFECT[unit.special] || '고유 행동'}` : '없음'}`, 438, ey, 15, COLORS.goldSel, 'left', 840);
  label(`주문: ${unit.spells?.length ? unit.spells.map(s => SPELL[s]?.name).filter(Boolean).join(' · ') : '없음'}`, 438, ey + 26, 15, COLORS.goldSel, 'left', 840);
  if (!mobile) label(STAT_NOTE, 438, 626, 11, COLORS.silver2);
  ctx.restore();
}
let rosterSquad = { left: 0, right: 0 }, rosterEquipPage = 0;   // 모바일 교환 화면: 양쪽 군단이 한 번에 한 분대(6명)만 보인다
const rosterTargetN = () => mobile ? 4 : 10, rosterDetailN = () => mobile ? 8 : 16, rosterEquipN = () => mobile ? 4 : 99;
function button2(id, x, y, w, h, line1, line2, on, col1 = COLORS.silver, col2 = COLORS.silver2) {   // 두 줄 버튼 (모바일 목록 칸)
  panel(x, y, w, h, on ? COLORS.gold : COLORS.silver2, on ? 3 : 1, on ? 'rgba(117,96,25,.65)' : 'rgba(15,44,52,.8)');
  label(line1, x + 12, y + h * 0.32, 16, on ? COLORS.goldSel : col1, 'left', w - 24); if (line2) label(line2, x + 12, y + h * 0.7, 14, col2, 'left', w - 24);
  btns.push({ id, x, y, w, h });
}
function drawRosterMobile() {   // 모바일 군단 편성: 모든 버튼 86px 이상, 글자 22 가상 px 이상 — 교환 화면은 열(병과·능력치)을 줄이고 분대 단위로 본다
  ctx.fillStyle = '#0b3036'; ctx.fillRect(0, 0, VW, VH);
  panel(6, 4, 1268, 98, COLORS.gold, 3, 'rgba(6,17,23,.9)');
  label(rosterMode === 'select' ? '군단 편성 · 교환 선택' : rosterMode === 'equip' ? '군단 편성 · 장비 관리' : rosterMode === 'detail' ? '군단 편성 · 장수 상세' : '군단 편성 · 군단 간 교환', 20, 34, 19, COLORS.gold, 'left', 470);
  label(`보유 ${roster.length} / ${ROSTER_MAX}군단`, 20, 76, 12, COLORS.silver, 'left', 470);
  const sel = rosterMode === 'select', bx = sel ? [500, 668, 866, 1074] : [866, 1074], by = 10, bh = TOUCH;
  if (sel) { button('roster:equip', bx[0], by, 160, bh, '장비 관리', false, 16); button('roster:detail', bx[1], by, 190, bh, '장수 상세 ' + rosterHeroes().length, false, 16); }
  button('roster:prisoners', bx[sel ? 2 : 0], by, 200, bh, '포로 관리 ' + campaign.prisoners.filter(p => p.owner === playerFaction()).length, false, 16);
  button('roster:back', bx[sel ? 3 : 1], by, 190, bh, sel ? '전략으로' : '군단 선택', false, 16);
  const top = 108, bottom = 660;
  if (rosterMode === 'select') {
    const corps = roster[rosterSource], count = corps.units.filter(Boolean).length;
    panel(6, top, 610, bottom - top, COLORS.gold, 3, 'rgba(8,20,25,.92)');
    label('교환할 군단', 20, top + 22, 15, COLORS.silver2); label(`${rosterSource + 1}군단 · ${corpsName(corps)}`, 20, top + 56, 21, COLORS.gold, 'left', 580);
    label(`${count} / 18명 · ${Math.ceil(count / 6)}분대 · 전투력 ⚔${corpsPow(corps)}`, 20, top + 90, 15, COLORS.silver, 'left', 580);
    button('roster:source:prev', 16, top + 110, 288, TOUCH, '◀ 이전 군단', false, 17); button('roster:source:next', 316, top + 110, 288, TOUCH, '다음 군단 ▶', false, 17);
    for (let squad = 0; squad < 3; squad++) {
      const members = corps.units.slice(squad * 6, squad * 6 + 6).filter(Boolean), y = top + 212 + squad * 112;
      panel(16, y, 588, 100, members.length ? COLORS.silver2 : COLORS.dim, 1, 'rgba(15,44,52,.8)');
      label(`${squad + 1}분대`, 28, y + 20, 16, members.length ? COLORS.gold : COLORS.dim);
      label(members.length ? `⚔${Sim.corpsPower(corps.units.slice(squad * 6, squad * 6 + 6), 'player', corps.growth.slice(squad * 6, squad * 6 + 6))}` : '', 592, y + 20, 15, COLORS.goldSel, 'right');
      for (let row = 0; row < 2; row++) label(members.length ? members.slice(row * 3, row * 3 + 3).map(k => Sim.U[k].name).join(' · ') : row ? '' : '비어 있음', 28, y + 48 + row * 28, 14, members.length ? COLORS.silver : COLORS.dim, 'left', 560);
    }
    panel(626, top, 648, bottom - top, COLORS.silver2, 2, 'rgba(8,20,25,.92)');
    label('교환 대상 군단', 640, top + 22, 20, COLORS.gold);
    const N = rosterTargetN(), targets = roster.map((c, index) => ({ c, index })).filter(x => x.index !== rosterSource), pages = Math.max(1, Math.ceil(targets.length / N));
    rosterPage = Math.max(0, Math.min(rosterPage, pages - 1));
    targets.slice(rosterPage * N, rosterPage * N + N).forEach(({ c, index }, row) => button2(`roster:target:${index}`, 638, top + 44 + row * 90, 624, TOUCH, `${index + 1}군단  ${corpsName(c)}`, `${c.units.filter(Boolean).length}/18명 · ⚔${corpsPow(c)}`, false));
    const fy = bottom - TOUCH - 8;
    button('roster:new', 638, fy, 280, TOUCH, roster.length < ROSTER_MAX ? '새 군단 생성' : '군단 보유 한도 100', false, 16);
    button('roster:page:prev', 930, fy, 160, TOUCH, '◀', false, 18); button('roster:page:next', 1102, fy, 160, TOUCH, '▶', false, 18);
    label(`${rosterPage + 1}/${pages}`, 1176, fy - 14, 15, COLORS.silver2, 'center');
  } else if (rosterMode === 'detail') {
    const all = rosterHeroes(), per = rosterDetailN(), pages = Math.max(1, Math.ceil(all.length / per));
    if (!all.some(x => x.ci === rosterDetailCorps && x.slot === rosterDetailSlot)) { rosterDetailCorps = all[0]?.ci ?? 0; rosterDetailSlot = all[0]?.slot ?? 0; }
    rosterDetailPage = Math.max(0, Math.min(rosterDetailPage, pages - 1));
    const corps = roster[rosterDetailCorps], key = corps.units[rosterDetailSlot], unit = key && Sim.U[key], growth = corps.growth[rosterDetailSlot] || {}, stats = unit && Sim.unitStats(key, 'player', growth), item = Sim.ITEMS[growth.item];
    const passive = unit && (Sim.TITLE_EFFECT[Sim.unitSubclass(key)] || {}).passive; if (passive) for (const [stat, pct] of Object.entries(passive)) stats[stat] *= 1 + pct / 100;
    panel(6, top, 370, bottom - top, COLORS.silver2, 2, 'rgba(8,20,25,.92)'); panel(386, top, 888, bottom - top, COLORS.gold, 2, 'rgba(8,20,25,.92)');
    label(`${playerFaction()}군 전체 장수 ${all.length}명`, 18, top + 22, 15, COLORS.gold, 'left', 350);
    all.slice(rosterDetailPage * per, rosterDetailPage * per + per).forEach(({ key: k, slot, ci }, i) => button2(`roster:detail:${ci}:${slot}`, 14 + (i % 2) * 180, top + 44 + Math.floor(i / 2) * 90, 172, TOUCH, Sim.U[k].name, `${ci + 1}군단`, ci === rosterDetailCorps && slot === rosterDetailSlot));
    if (!all.length) label('편성된 이름 있는 장수가 없습니다.', 191, top + 200, 17, COLORS.dim, 'center', 350);
    const fy = bottom - TOUCH - 8;
    button('roster:detail:prev', 14, fy, 172, TOUCH, '◀', false, 18); label(`${rosterDetailPage + 1}/${pages}`, 191, fy - 14, 15, COLORS.silver2, 'center'); button('roster:detail:next', 194, fy, 172, TOUCH, '▶', false, 18);
    if (unit) drawHeroInfo(key, unit, growth, stats, item);
  } else if (rosterMode === 'equip') {
    const corps = roster[rosterSource], named = corps.units.map((key, slot) => ({ key, slot })).filter(x => x.key && !Sim.U[x.key].generic), N = rosterEquipN(), pages = Math.max(1, Math.ceil(named.length / N));
    rosterEquipPage = Math.max(0, Math.min(rosterEquipPage, pages - 1));
    panel(6, top, 1268, bottom - top, COLORS.silver2, 2, 'rgba(8,20,25,.92)');
    label(`${rosterSource + 1}군단 · ${corpsName(corps)} · ITEM 탈부착`, 20, top + 26, 17, COLORS.gold, 'left', 700);
    label('보유: ' + (Object.entries(Sim.ITEMS).filter(([k]) => campaign.items[k] > 0).map(([k, it]) => `${it.unique ? '★' : ''}${it.name} ${campaign.items[k]}`).join(' · ') || '없음'), 20, top + 106, 15, COLORS.silver, 'left', 1000);
    button('roster:equip:prev', 920, top + 6, 160, TOUCH, '◀ 이전', false, 17); button('roster:equip:next', 1092, top + 6, 170, TOUCH, '다음 ▶', false, 17); label(`${rosterEquipPage + 1}/${pages}`, 1180, top + 104, 15, COLORS.silver2, 'center');
    if (!named.length) label('이 군단에는 장비할 수 있는 장수가 없습니다.', 640, top + 250, 20, COLORS.dim, 'center');
    named.slice(rosterEquipPage * N, rosterEquipPage * N + N).forEach(({ key, slot }, row) => {
      const g = corps.growth[slot] || {}, it = Sim.ITEMS[g.item], ry = top + 130 + row * 94, bonus = it ? Object.entries(it).filter(([, v]) => Number.isFinite(v)).map(([k, v]) => `${k.toUpperCase()}+${v}`).join(' ') : '';
      panel(16, ry, 1244, TOUCH, 'rgba(206,231,224,.25)', 1, 'rgba(15,44,52,.75)');
      label(String(slot + 1).padStart(2, '0'), 28, ry + TOUCH / 2, 14, COLORS.silver2); label(Sim.U[key].name, 78, ry + TOUCH / 2, 16, COLORS.goldSel, 'left', 200);
      button(`roster:item:${slot}:-1`, 290, ry, TOUCH, TOUCH, '◀', false, 16); label(it ? `${it.unique ? '★ ' : ''}${it.name}` : '— 없음 —', 540, ry + TOUCH / 2, 16, it ? COLORS.gold : COLORS.dim, 'center', 240); button(`roster:item:${slot}:1`, 672, ry, TOUCH, TOUCH, '▶', false, 16);
      label(bonus, 780, ry + TOUCH / 2, 15, COLORS.silver, 'left', 470);
    });
  } else {
    const drawCorps = (corpsId, x, w, side) => {
      const corps = roster[corpsId], squad = rosterSquad[side], count = corps.units.filter(Boolean).length; panel(x, top, w, bottom - top, COLORS.silver2, 2, 'rgba(8,20,25,.92)');
      label(`${corpsId + 1}군단 · ${corpsName(corps)}`, x + 12, top + 22, 15, COLORS.gold, 'left', w * 0.5);
      label(`${count}/18명 · ⚔${corpsPow(corps)}`, x + w - 12, top + 22, 14, COLORS.silver, 'right', w * 0.45);
      const tw = (w - 24 - 16) / 3;
      for (let q = 0; q < 3; q++) button(`roster:squad:${side}:${q}`, x + 12 + q * (tw + 8), top + 40, tw, TOUCH, `${q + 1}분대 ${corps.units.slice(q * 6, q * 6 + 6).filter(Boolean).length}/6`, q === squad, 16);
      const cw = (w - 24 - 8) / 2;
      for (let k = 0; k < 6; k++) {
        const slot = squad * 6 + k, key = corps.units[slot], unit = key ? Sim.U[key] : null, cx = x + 12 + (k % 2) * (cw + 8), cy = top + 40 + TOUCH + 10 + Math.floor(k / 2) * 94, selected = rosterPick && rosterPick.side === side && rosterPick.slot === slot;
        panel(cx, cy, cw, TOUCH, selected ? COLORS.goldSel : 'rgba(206,231,224,.4)', selected ? 3 : 1, selected ? 'rgba(117,96,25,.65)' : 'rgba(15,44,52,.8)');
        label(String(slot + 1).padStart(2, '0'), cx + 10, cy + 24, 13, COLORS.silver2); label(unit ? unit.name : '—', cx + 52, cy + 24, 16, unit && !unit.generic ? COLORS.goldSel : unit ? COLORS.silver : COLORS.dim, 'left', cw - 52 - 84);
        if (slot === 0) label('군단장', cx + cw - 10, cy + 24, 14, COLORS.gold, 'right');
        else if (unit && unit.generic) { const sg = Sim.validGrade(corps.growth[slot]?.sg); label(gradeTag(sg), cx + cw - 10, cy + 24, 14, Sim.SOLDIER_GRADE_COLOR[sg], 'right'); }
        if (unit) { const st = Sim.unitStats(key, 'player', corps.growth[slot]); label(`${CATEGORY_NAME[Sim.unitCategory(key)]}·${Sim.unitSubclass(key)}`, cx + 10, cy + 60, 14, COLORS.silver2, 'left', cw - 20 - 96); label(`HP${st.maxHp}`, cx + cw - 10, cy + 60, 14, COLORS.silver, 'right'); }
        btns.push({ id: `roster:unit:${side}:${slot}`, x: cx, y: cy, w: cw, h: TOUCH });
      }
    };
    drawCorps(rosterSource, 6, 626, 'left'); drawCorps(rosterTarget, 642, 632, 'right');
  }
  panel(6, 666, 1268, 50, 'rgba(255,255,255,.35)', 1, 'rgba(0,0,0,.35)');
  label(campaign.notice || '분대원을 선택하세요.', VW / 2, 691, 16, COLORS.silver, 'center', 1240);
}
function drawRoster() {
  if (mobile) { drawRosterMobile(); return; }
  ctx.fillStyle = '#0b3036'; ctx.fillRect(0, 0, VW, VH);
  panel(18, 16, 1244, 54, COLORS.gold, 3, 'rgba(6,17,23,.9)');
  label(rosterMode === 'select' ? mobile ? '군단 편성 · 교환 선택' : '군단 편성 · 교환 군단 선택' : rosterMode === 'equip' ? '군단 편성 · 장비 관리' : rosterMode === 'detail' ? '군단 편성 · 장수 상세' : '군단 편성 · 군단 간 교환', 42, 43, mobile ? 19 : 27, COLORS.gold);
  label(`보유 ${roster.length} / ${ROSTER_MAX}군단`, mobile ? 42 : 375, mobile ? 82 : 43, mobile ? 12 : 17, COLORS.silver);
  if (rosterMode === 'select') button('roster:equip', 545, 25, 145, 36, '장비 관리', false, 16);
  if (rosterMode === 'select') button('roster:detail', 700, 25, 190, 36, '장수 상세 ' + rosterHeroes().length, false, 16);
  button('roster:prisoners', 900, 25, 180, 36, '포로 관리 ' + campaign.prisoners.filter(p => p.owner === playerFaction()).length, false, 16);
  button('roster:back', 1095, 25, 145, 36, rosterMode === 'select' ? '전략으로' : '군단 선택', false, 16);
  if (rosterMode === 'select') {
    const corps = roster[rosterSource], count = corps.units.filter(Boolean).length;
    panel(28, 94, 570, 536, COLORS.gold, 3, 'rgba(8,20,25,.92)');
    label('교환할 군단', 52, 126, 19, COLORS.silver2);
    label(`${rosterSource + 1}군단 · ${corpsName(corps)}`, 52, 174, 28, COLORS.gold);
    label(`${count} / 18명 · ${Math.ceil(count / 6)}분대 · 전투력 ⚔${corpsPow(corps)}`, 52, 215, 19, COLORS.silver);
    button('roster:source:prev', 52, 252, 245, 46, '◀ 이전 군단', false, 17);
    button('roster:source:next', 315, 252, 245, 46, '다음 군단 ▶', false, 17);
    for (let squad = 0; squad < 3; squad++) {
      const members = corps.units.slice(squad * 6, squad * 6 + 6).filter(Boolean);
      panel(52, 326 + squad * 82, 508, 66, members.length ? COLORS.silver2 : COLORS.dim, 1, 'rgba(15,44,52,.8)');
      label(`${squad + 1}분대`, 70, 340 + squad * 82, 16, members.length ? COLORS.gold : COLORS.dim);
      for (let row = 0; row < 2; row++) label(members.length ? members.slice(row * 3, row * 3 + 3).map(k => Sim.U[k].name).join(' · ') : row ? '' : '비어 있음', 70, 360 + row * 20 + squad * 82, 14, members.length ? COLORS.silver : COLORS.dim);
      label(members.length ? `⚔${Sim.corpsPower(corps.units.slice(squad * 6, squad * 6 + 6), 'player', corps.growth.slice(squad * 6, squad * 6 + 6))}` : '', 548, 340 + squad * 82, 15, COLORS.goldSel, 'right');
    }
    panel(622, 94, 630, 536, COLORS.silver2, 2, 'rgba(8,20,25,.92)');
    label('교환 대상 군단', 646, 126, 20, COLORS.gold);
    const targets = roster.map((c, index) => ({ c, index })).filter(x => x.index !== rosterSource), page = targets.slice(rosterPage * rosterTargetN(), rosterPage * rosterTargetN() + rosterTargetN());
    page.forEach(({ c, index }, row) => button(`roster:target:${index}`, 646, 154 + row * 40, 582, 34, `${index + 1}군단  ${corpsName(c)}  ${c.units.filter(Boolean).length}/18 · ⚔${corpsPow(c)}`, false, 15));
    button('roster:new', 646, 564, 280, 42, roster.length < ROSTER_MAX ? '새 군단 생성' : '군단 보유 한도 100', false, 16);
    button('roster:page:prev', 944, 564, 132, 42, '◀', false, 18); button('roster:page:next', 1096, 564, 132, 42, '▶', false, 18);
  } else if (rosterMode === 'detail') {
    const all = rosterHeroes(), per = rosterDetailN(), pages = Math.max(1, Math.ceil(all.length / per));
    if (!all.some(x => x.ci === rosterDetailCorps && x.slot === rosterDetailSlot)) { rosterDetailCorps = all[0]?.ci ?? 0; rosterDetailSlot = all[0]?.slot ?? 0; }
    rosterDetailPage = Math.max(0, Math.min(rosterDetailPage, pages - 1));
    const corps = roster[rosterDetailCorps], key = corps.units[rosterDetailSlot], unit = key && Sim.U[key], growth = corps.growth[rosterDetailSlot] || {}, stats = unit && Sim.unitStats(key, 'player', growth), item = Sim.ITEMS[growth.item];
    const passive = unit && (Sim.TITLE_EFFECT[Sim.unitSubclass(key)] || {}).passive; if (passive) for (const [stat, pct] of Object.entries(passive)) stats[stat] *= 1 + pct / 100;
    panel(28, 92, 360, 548, COLORS.silver2, 2, 'rgba(8,20,25,.92)'); panel(408, 92, 844, 548, COLORS.gold, 2, 'rgba(8,20,25,.92)');
    label(`${playerFaction()}군 전체 장수 ${all.length}명`, 46, 122, 21, COLORS.gold);
    all.slice(rosterDetailPage * per, rosterDetailPage * per + per).forEach(({ key: k, slot, ci }, row) => button(`roster:detail:${ci}:${slot}`, 46, 146 + row * 28, 324, 26, `${Sim.U[k].name} · ${ci + 1}군단`, ci === rosterDetailCorps && slot === rosterDetailSlot, 14));
    if (!all.length) label('편성된 이름 있는 장수가 없습니다.', 208, 330, 17, COLORS.dim, 'center');
    button('roster:detail:prev', 46, 600, 100, 30, '◀', false, 16); label(`${rosterDetailPage + 1}/${pages}`, 208, 616, 15, COLORS.silver2, 'center'); button('roster:detail:next', 270, 600, 100, 30, '▶', false, 16);
    if (unit) drawHeroInfo(key, unit, growth, stats, item);
  } else if (rosterMode === 'equip') {
    const corps = roster[rosterSource]; panel(28, 92, 1224, 548, COLORS.silver2, 2, 'rgba(8,20,25,.92)');
    label(`${rosterSource + 1}군단 · ${corpsName(corps)} · 장수 ITEM 탈부착`, 46, 120, 22, COLORS.gold);
    label('보유: ' + Object.entries(Sim.ITEMS).filter(([k]) => campaign.items[k] > 0).map(([k, it]) => `${it.unique ? '★' : ''}${it.name} ${campaign.items[k]}`).join(' · '), 1236, 120, 15, COLORS.silver, 'right');
    const named = corps.units.map((key, slot) => ({ key, slot })).filter(x => x.key && !Sim.U[x.key].generic);
    if (!named.length) label('이 군단에는 장비할 수 있는 장수가 없습니다.', 640, 360, 20, COLORS.dim, 'center');
    named.forEach(({ key, slot }, row) => {
      const g = corps.growth[slot] || {}, it = Sim.ITEMS[g.item], ry = 142 + row * 26, bonus = it ? Object.entries(it).filter(([, v]) => Number.isFinite(v)).map(([k, v]) => `${k.toUpperCase()}+${v}`).join(' ') : '';
      panel(38, ry, 1204, 24, 'rgba(206,231,224,.25)', 1, 'rgba(15,44,52,.75)');
      label(String(slot + 1).padStart(2, '0'), 50, ry + 12, 13, COLORS.silver2); label(Sim.U[key].name, 100, ry + 12, 15, COLORS.goldSel);
      button(`roster:item:${slot}:-1`, 420, ry, 40, 24, '◀', false, 14); label(it ? `${it.unique ? '★ ' : ''}${it.name}` : '— 없음 —', 560, ry + 12, 15, it ? COLORS.gold : COLORS.dim, 'center'); button(`roster:item:${slot}:1`, 660, ry, 40, 24, '▶', false, 14);
      label(bonus, 730, ry + 12, 14, COLORS.silver);
    });
  } else {
    const drawCorps = (corpsId, x, side) => {
      const corps = roster[corpsId]; panel(x, 92, 600, 548, COLORS.silver2, 2, 'rgba(8,20,25,.92)');
      label(`${corpsId + 1}군단 · ${corpsName(corps)}`, x + 18, 120, 22, COLORS.gold);
      label(`${corps.units.filter(Boolean).length}/18명 · ⚔${corpsPow(corps)}`, x + 582, 120, 16, COLORS.silver, 'right');
      corps.units.forEach((key, slot) => {
        const unit = key ? Sim.U[key] : null, ry = 142 + slot * 26, squadStart = slot % 6 === 0, commander = slot === 0, selected = rosterPick && rosterPick.side === side && rosterPick.slot === slot;
        panel(x + 10, ry, 580, 24, selected ? COLORS.goldSel : squadStart ? '#698b94' : 'rgba(206,231,224,.25)', selected ? 2 : 1, selected ? 'rgba(117,96,25,.65)' : squadStart ? 'rgba(23,72,84,.95)' : 'rgba(15,44,52,.75)');
        label(String(slot + 1).padStart(2, '0'), x + 20, ry + 12, 13, COLORS.silver2);
        label(squadStart ? `${slot / 6 + 1}분대` : '', x + 55, ry + 12, 13, COLORS.gold);
        label(unit ? unit.name : '—', x + 130, ry + 12, 15, unit && !unit.generic ? COLORS.goldSel : unit ? COLORS.silver : COLORS.dim);
        if (unit) { const stats = Sim.unitStats(key, 'player', corps.growth[slot]); label(`${CATEGORY_NAME[Sim.unitCategory(key)]}·${Sim.unitSubclass(key)}`, x + 250, ry + 12, 12, COLORS.silver2); label(`HP${stats.maxHp} AT${stats.atk} DF${stats.df} AD${stats.ad} MD${stats.md}`, x + 340, ry + 12, 10, COLORS.silver); }
        label(commander ? '군단장' : '', x + 570, ry + 12, 13, COLORS.gold, 'right'); if (unit && unit.generic) { const sg = Sim.validGrade(corps.growth[slot]?.sg); label(gradeTag(sg), x + 570, ry + 12, 12, Sim.SOLDIER_GRADE_COLOR[sg], 'right'); }
        btns.push({ id: `roster:unit:${side}:${slot}`, x: x + 10, y: ry, w: 580, h: 24 });
      });
    };
    drawCorps(rosterSource, 28, 'left'); drawCorps(rosterTarget, 652, 'right');
  }
  panel(18, 666, 1244, 38, 'rgba(255,255,255,.35)', 1, 'rgba(0,0,0,.35)');
  label(campaign.notice || '분대원을 선택하세요.', VW / 2, 685, 16, COLORS.silver, 'center');
}
// 미니맵 (우측 상단): 지형 축소도 + 아군(파랑)·적군(빨강) 점 + 현재 화면 사각형. 누르거나 끌면 그 위치를 4초 둘러본다 (look).
function drawMinimap() {
  const mw = mobile ? 200 : 180, mh = Math.round(mw * Sim.MH / Sim.MW), mx = VW - mw - 6, my = mobile ? 6 : TB_H + 6, k = mw / WW; mini = { x: mx, y: my, w: mw, h: mh, k };
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 0.92; ctx.drawImage(terrain, mx, my, mw, mh); ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.5; ctx.strokeRect(mx, my, mw, mh);
  for (const e of S.units) if (alive(e)) { ctx.fillStyle = e.team === 'player' ? '#4fb0ff' : '#ff5a4a'; const s = e.isLeader ? 4 : 2.5; ctx.fillRect(mx + e.x * k - s / 2, my + e.y * k - s / 2, s, s); }
  const c = ctrlOf(); if (c && alive(c)) { ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 1.5; ctx.strokeRect(mx + c.x * k - 3.5, my + c.y * k - 3.5, 7, 7); }
  ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 1.5; ctx.strokeRect(mx + cam.x * k, my + cam.y * k, VPW / Z() * k, vh / Z() * k); ctx.restore();
}
function draw() {
  btns = []; mini = null;
  if ((state === 'title' || state === 'map' || state === 'roster') && custodyOpen()) { drawCustody(); return; }
  if (state === 'title') { drawTitle(); return; }
  if (state === 'map') { drawStageMap(); return; }
  if (state === 'roster') { drawRoster(); return; }
  if(!BATTLE_ART.ready){ctx.fillStyle=COLORS.ink;ctx.fillRect(0,0,VW,VH);label(BATTLE_ART.error?'전투 이미지를 불러오지 못했습니다':'전투 이미지를 불러오는 중',VW/2,300,30,COLORS.gold,'center');label(BATTLE_ART.error?'연결을 확인한 뒤 화면을 누르거나 Enter로 다시 시도하세요.':'잠시만 기다려 주세요.',VW/2,360,22,COLORS.silver,'center');return;}
  layout(); clampCam(); const mobileSelect = mobile && selectMode && !menuOpen && !S.over;
  ctx.fillStyle = COLORS.ink; ctx.fillRect(0, 0, VW, VH);
  drawWorld();
  if (mobile) {
    if (!mobileSelect) { drawToolbarMobile(); drawMobileStatus(); drawMobileSide(); drawStick(); drawActionsMobile(); }
  } else { drawToolbar(); drawLeftPanel(); drawSpellPanel(); drawPad(); drawTable(); }
  if (!mobileSelect) drawMinimap();
  if (S.auto && !mobileSelect) label('자동 전투', VW - 10, (mini ? mini.y + mini.h : TB_H) + 20, 18, COLORS.gold, 'right');
  if (S.t < 14 && !S.over && !mobileSelect) label(mobile ? '왼쪽 화면을 눌러 끌면 이동 · 적에게 부딪치면 공격 · 오른쪽 행동 버튼' : '숫자패드(또는 WASD+QEZC)로 조작 캐릭터 이동 · 적에게 부딪치면 공격 · Space 특수기/마법', LEFT_W + VPW / 2, TB_H + vh - (mobile ? 112 : 16), 16, COLORS.silver2, 'center');
  if (tutorialStep >= 0) { drawTutorial(); return; }
  if (S.events.length) { drawEvent(S.events[0]); return; }
  if (selectMode && !menuOpen && !S.over) drawSelectUI();
  if (menuOpen) drawMenu();
  if (supportOpen) drawSupport();
  if (S.over === 'win') drawOverlay('승 리', [`${!campaign.battle ? '적 군단을 모두 물리쳤다!' : campaign.explore ? '적 군단을 모두 물리쳤다!' : campaign.invasion || isAllyCity(campaign.battle) ? campaign.battle.name + ' 방어에 성공했다!' : eulReul(campaign.battle.name) + ' 점령했다!'}`, `${Math.round(S.t)}초 · 격파 ${S.stats.kills} · 도주 ${S.stats.fled} · 전사 ${S.stats.lost} · 레벨업 ${S.stats.levelups}`, '아래 [전략 화면으로] 버튼 (R 키)'], COLORS.gold);
  else if (S.over === 'lose') drawOverlay('패 배', [S.overWhy === 'retreat' ? '전군이 후퇴하여 전투에서 패배했다…' : '출전 병력이 전투를 계속할 수 없다…', `${Math.round(S.t)}초 · 격파 ${S.stats.kills} · 전사 ${S.stats.lost}`, '아래 [전략 화면으로] 버튼 (R 키)'], COLORS.danger);
  else if (paused && !menuOpen) drawOverlay('일시정지', [mobile ? '화면을 탭하면 계속' : 'P 로 계속'], COLORS.silver);
}

function drawSupport() {
  const list = supportArmies(), cols = mobile ? 2 : 1, rows = Math.max(1, Math.ceil(list.length / cols)), pitch = mobile ? 96 : 58, w = mobile ? 1100 : 430, x = mobile ? (VW - w) / 2 : VW - w - 12, y = mobile ? 6 : TB_H + 10, h = (mobile ? 104 : 90) + rows * pitch - (mobile ? 0 : 0);
  panel(x, y, w, h, COLORS.gold, 3, 'rgba(8,10,18,.96)');
  label('지원 요청', x + 18, y + (mobile ? TOUCH / 2 : 25), mobile ? 24 : 20, COLORS.gold);
  button('support:close', x + w - (mobile ? 170 : 82), y + (mobile ? 6 : 8), mobile ? 150 : 68, tb(34), '닫기', false, 15);
  if (!list.length) label('연결된 도시에서 참전 가능한 군단이 없습니다.', x + w / 2, y + (mobile ? 120 : 78), 17, COLORS.silver2, 'center', w - 40);
  const cw = mobile ? (w - 36) / 2 : w;
  list.forEach((A, i) => {
    const cx = mobile ? x + 12 + (i % 2) * (cw + 12) : x, yy = y + (mobile ? 100 : 52) + Math.floor(i / cols) * pitch, groups = S.armies.filter(B => B.team === 'player' && B.support && B.corps === A.corps), corps = roster.find(c => c.id === A.corps);
    if (mobile) panel(cx, yy, cw, TOUCH, 'rgba(206,231,224,.3)', 1, 'rgba(15,44,52,.6)');
    label(`${corps ? corpsName(corps) : A.name} · ${groups.reduce((n, B) => n + B.units.filter(u => !u.dead).length, 0)}명`, cx + (mobile ? 12 : 18), yy + (mobile ? TOUCH / 2 : 24), mobile ? 19 : 16, COLORS.silver, 'left', mobile ? cw - 190 : undefined);
    button('support:' + A.id, cx + cw - (mobile ? 166 : 150), yy + (mobile ? 0 : 7), mobile ? 156 : 132, tb(42), '참전', false, 17);
  });
}

// ---------- 명령 ----------
function mark(x, y, col) { marks.push({ x, y, col, t: 0.7 }); }
function floatText(u, s, col) { S.texts.push({ x: u.x, y: u.y - 60, s, col, t: 1 }); }
function confirmSelect() {   // 확정: 보던 적이 있으면 군단이 그 적을 집중 공격, 전투 재개
  if (selTarget && alive(selTarget)) { Sim.focus(S, army(), selTarget); mark(selTarget.x, selTarget.y, COLORS.danger); }
  selTarget = null; selectMode = false;
}
function cancelSelect() { selTarget = null; selectMode = false; }   // 취소(Esc): 지시 없이 재개
function beginSelect() { if (SHOW.pauseSel && !S.over && !menuOpen) selectMode = true; }
function pick(u) { if (!u || !alive(u) || u.team !== 'player' || u.army.ally) return;   // 동맹 군단은 조작할 수 없다
  look = null; armyIdx = u.army.id; Sim.setCtrl(S, u.army, u); selTarget = null; beginSelect(); }
function cycleUnit(dir) {
  const list = army().units.filter(alive); if (!list.length) return;
  const i = list.indexOf(ctrlOf()); pick(list[i < 0 ? 0 : (i + dir + list.length) % list.length]);
}
function act(alt) { const u = ctrlOf(); if (u && !Sim.action(S, u, alt)) floatText(u, u.spells.length && !alt ? (S.lock.player > 0 ? '마법 잠금' : '사용 불가') : '준비중', '#cfd3e6'); }
function useCommand(id, A = army()) {
  if (['charge', 'stop', 'retreat', 'idle'].includes(id)) { Sim.armyOrder(S, A, id, A === army() ? ctrlOf() : null); return; }
  if (id === 'act') act(false); else if (id === 'auto') Sim.setAuto(S, !S.auto); else if (id === 'support') supportOpen = !supportOpen; else if (id === 'menu') menuOpen = true;
}
function cycleFormation(A) { const forms = Object.keys(FORMATION_NAME), i = forms.indexOf(A.formation); Sim.setFormation(A, forms[(i + 1) % forms.length]); }
function pickRosterUnit(side, slot) {
  const pick = { side, slot }, corpsId = side === 'left' ? rosterSource : rosterTarget;
  if (!rosterPick) { if (!roster[corpsId].units[slot]) { campaign.notice = '먼저 이동하거나 교환할 장수를 선택하세요.'; return; } rosterPick = pick; campaign.notice = '반대쪽 군단의 교환 위치를 선택하세요.'; return; }
  if (rosterPick.side === side && rosterPick.slot === slot) { rosterPick = null; campaign.notice = '선택을 취소했습니다.'; return; }
  const fromId = rosterPick.side === 'left' ? rosterSource : rosterTarget, from = roster[fromId], to = roster[corpsId];
  [from.units[rosterPick.slot], to.units[slot]] = [to.units[slot], from.units[rosterPick.slot]];
  [from.growth[rosterPick.slot], to.growth[slot]] = [to.growth[slot], from.growth[rosterPick.slot]]; rosterPick = null;
  campaign.notice = '군단 간 편성을 교환했습니다. 첫 칸의 군단장을 확인하세요.';
}
function cycleItem(slot, d) {   // 장수의 ITEM 을 보유 목록에서 앞뒤로 바꾼다. 떼면 보유로 돌아간다
  const corps = roster[rosterSource], key = corps.units[slot]; if (!key || Sim.U[key].generic) return;
  const g = corps.growth[slot] || (corps.growth[slot] = {}), cur = g.item || null, opts = [null, ...Object.keys(Sim.ITEMS)].filter(k => k === null || k === cur || ((!Sim.ITEMS[k].owner || Sim.ITEMS[k].owner === key) && (campaign.items[k] || 0) > 0)), next = opts[(opts.indexOf(cur) + d + opts.length) % opts.length];
  if (cur) campaign.items[cur] = (campaign.items[cur] || 0) + 1; if (next) campaign.items[next]--; g.item = next;
  campaign.notice = next ? `${Sim.U[key].name}에게 ${Sim.ITEMS[next].name}을 장착했습니다.` : `${Sim.U[key].name}의 ITEM을 해제했습니다.`;
}
function uiClick(id) {   // 군단 편성 조작 뒤에는 비어 버린 군단을 자동 해제한다
  uiClickCore(id); if (state === 'roster' || id.startsWith('roster:')) autoDisbandEmpty();
}
function uiClickCore(id) {
  if (id === 'campaign:opt:news') id = 'campaign:news'; else if (id === 'campaign:opt:diff') id = 'campaign:diff';   // 턴 진행 중 팝업의 토글 버튼은 지도 패널 토글과 같다
  if ((state === 'map' || state === 'roster') && custodyOpen() && !id.startsWith('custody:') && id !== 'campaign:movemode' && id !== 'campaign:news' && id !== 'campaign:diff') return;
  if (id === 'campaign:help') { if (mapFree()) stratTutStep = 0; return; }
  if (id.startsWith('stut:')) { if (stratTutStep >= 0) stratTutNav(id.slice(5)); return; }
  if (id === 'roster:prisoners') { custodyView = true; custodyPage = 0; return; }
  if (id.startsWith('custody:')) {
    if (id === 'custody:close') { if (!pendingPrisoners().length) { custodyView = false; custodyPage = 0; } }
    else if (id === 'custody:report-close') { if (turnSummary) { turnSummary = null; inTurnFlow = false; } else campaign.custodyNews = []; custodyPage = 0; }
    else if (id === 'custody:prev') custodyPage = Math.max(0, custodyPage - 1);
    else if (id === 'custody:next') custodyPage++;
    else { const [, action, key] = id.split(':'); const p = campaign.prisoners.find(p => p.key === key); if (p && p.owner === playerFaction()) custodyAction(key, action); }
    return;
  }
  if (id === 'start-diff') { const k = Object.keys(AI_PROFILES); startDifficulty = k[(k.indexOf(startDifficulty) + 1) % k.length]; return; }
  if (/^start-faction:/.test(id)) { const faction = id.slice(14); if (PLAYABLE_FACTIONS.includes(faction)) { startNewGame(faction); if (!stratTutSeen) stratTutStep = 0; } return; }   // 새 게임 첫 진입에만 전략 튜토리얼 (불러오기는 제외)
  if (id === 'campaign:save') { saveSlotMode = 'save'; return; }
  if (id === 'campaign:load') { saveSlotMode = 'load'; return; }
  if (id === 'save-slot:close') { saveSlotMode = null; return; }
  if (/^save-slot:[1-3]$/.test(id)) {
    const slot = +id.slice(10), mode = saveSlotMode; saveSlotMode = null;
    if (mode === 'new') { activeSaveSlot = slot; startFactionSelect = true; }
    else if (mode === 'save') { if (!canManualSave()) campaign.notice = '저장은 전략 화면에서 이동·교전 처리가 끝난 뒤에만 할 수 있습니다.'; else { campaign.notice = `${slot}번 슬롯에 ${campaign.turn}턴 원정을 저장했습니다.`; if (!saveCampaign(slot, true)) campaign.notice = '저장하지 못했습니다. (브라우저 저장 공간을 확인하세요)'; } }
    else if (mode === 'load' && loadGame(slot) && state === 'map') campaign.notice = `${slot}번 슬롯의 ${campaign.turn}턴 원정을 불러왔습니다.`;
    return;
  }
  if (id === 'campaign:roster') { state = 'roster'; rosterMode = 'select'; rosterPick = null; campaign.notice = '좌측 군단과 교환할 대상 군단을 선택하세요.'; return; }
  if (id === 'campaign:heroes') { mapTool = null; moveSelectOpen = false; exploreSelectOpen = false; heroView = { faction: playerFaction(), page: 0 }; campaign.notice = '세력별 전체 장수 정보를 확인합니다.'; return; }
  if (id === 'campaign:heroes:close') { heroView = null; return; }
  if (/^campaign:heroes:faction:/.test(id)) { heroView = { faction: id.split(':').pop(), page: 0 }; return; }
  if (id === 'campaign:heroes:prev' || id === 'campaign:heroes:next') { const pages = Math.max(1, Math.ceil(FACTION_HEROES[heroView.faction].length / heroN())), d = id.endsWith('next') ? 1 : -1; heroView.page = (heroView.page + d + pages) % pages; return; }
  if (id === 'campaign:intel:continue') { const encounter = campaign.pendingEncounter; if (!encounter) return; if (encounter.guardDefense) { resolveGuardDefense(encounter); return; } if (encounter.unopposed) { enemyTakesCity(encounter.stage); if (encounter.stage.id === playerCapital()) { defeatCampaign(`${encounter.stage.name}이 함락되어 원정에 패배했습니다.`); return; } campaign.notice = `${encounter.stage.name}이 무방비로 함락되었습니다.`; finishMovementStep(); return; } encounter.intelSeen = true; campaign.notice = `${encounter.stage.name} 방어에 나설 군단을 선택하세요.`; saveCampaign(); return; }
  if (id === 'campaign:movement:skip') {   // 남은 적 군단 이동 안내를 건너뛴다 — 아군 이동·교전·팝업·아군 도시로 오는 이동은 남겨 반드시 알린다
    const keepFrom = campaign.movementPage + 1; campaign.movement = campaign.movement.filter((m, i) => i < keepFrom || m.team === 'player' || (m.popups && m.popups.length) || !!movementEncounter(m) || (stageById(m.to) && (stageById(m.to).owner === 'player' || hostsPlayer(stageById(m.to)))));
    campaign.notice = '아군과 상호작용하지 않는 적 군단 이동 안내를 건너뛰었습니다.'; id = 'campaign:movement:close';
  }
  if (id === 'campaign:movement:close') { const encounter = movementEncounter(campaign.movement[campaign.movementPage]); if (state !== 'map') return; if (encounter && encounter.capture) { encounter.stage.owner = 'player'; resetCityGuards(encounter.stage, captureRatio(encounter.stage)); relocateCapitals(); const prize = captureReward(encounter.stage); campaign.notice = `${encounter.stage.name}을 무혈 점령했습니다.${captureNote(encounter.stage)}${prize ? ' 점령 보상: ' + prize + '.' : ''}`; if (!completeCampaignIfWon()) finishMovementStep(); return; } if (encounter) { campaign.pendingEncounter = encounter; campaign.responsePage = 0; campaign.notice = encounter.invasion ? `${encounter.stage.name} 침공군 정보를 확인하세요.` : `${encounter.stage.name}에서 공격할 군단을 선택하세요.`; saveCampaign(); return; } finishMovementStep(); return; }
  if (id === 'campaign:response:prev' || id === 'campaign:response:next') { const pages = Math.ceil(campaign.pendingEncounter.responders.length / respN()), d = id.endsWith('next') ? 1 : -1; campaign.responsePage = Math.max(0, Math.min(pages - 1, campaign.responsePage + d)); return; }
  if (id === 'campaign:response:abandon') { const encounter = campaign.pendingEncounter; if (encounter.invasion) { if (encounter.stage.owner === 'player' && guardsAt(encounter.stage).length) { retreatAll(encounter.stage); resolveGuardDefense(encounter); return; } enemyTakesCity(encounter.stage); if (encounter.stage.id === playerCapital()) { defeatCampaign(`${encounter.stage.name} 방어를 포기하여 원정에 패배했습니다.`); return; } const moved = retreatAll(encounter.stage); campaign.notice = `${encounter.stage.name} 방어를 포기했다.${moved.length ? ' ' + moved.map(m => `${corpsName(m.c)} → ${m.back.name}`).join(', ') + ' 퇴각.' : ''}`; } else { const mover = roster[encounter.moverIndex]; if (mover) mover.at = encounter.from; campaign.notice = `${encounter.stage.name} 공격을 포기하고 철수했다.`; } finishMovementStep(); return; }
  if (/^campaign:response:\d+$/.test(id)) {
    const encounter = campaign.pendingEncounter, index = +id.slice(18), corps = roster[index]; if (!encounter || !encounter.responders.includes(index) || !corps) return;
    const from = encounter.invasion || index !== encounter.moverIndex ? corps.at : encounter.from; corps.at = encounter.stage.id; campaign.corps = index; campaign.at = encounter.stage.id; campaign.from = from; campaign.destination = corps.target; campaign.invasion = encounter.invasion; campaign.responsePage = 0; campaign.notice = `${corpsName(corps)}이 ${encounter.stage.name} ${encounter.invasion ? '요격' : '공격'}에 나선다.`; startBattle(encounter.stage); return;
  }
  if (id === 'campaign:scout' || id === 'campaign:diplomacy') { const tool = id.slice(9); mapTool = mapTool === tool ? null : tool; moveSelectOpen = false; exploreSelectOpen = false; diplomacyView = null; moveMode = 'corps'; campaign.notice = mapTool ? (tool === 'scout' ? '정찰할 적 지역을 선택하세요. (군단이 같은 지역이나 연결 지역에 있어야 함)' : '외교할 세력의 수도를 선택하세요.') : '선택을 취소했습니다.'; return; }
  if (id === 'campaign:scout:close') { scoutView = null; return; }
  if (id === 'campaign:econ') { econView = true; moveSelectOpen = false; exploreSelectOpen = false; return; }
  if (id === 'campaign:econ:close') { econView = false; return; }
  if (id === 'campaign:ally:help' && allyChoice) { const c = allyChoice; allyChoice = null; allyHelpIds = c.ids; startBattle(c.stage, c.explore); return; }
  if (id === 'campaign:ally:retreat' && allyChoice) {
    const c = allyChoice; allyChoice = null; const corps = roster[campaign.corps], back = alliedBack(corps, c.stage); if (corps && back) corps.at = back.id;
    campaign.battle = null; campaign.invasion = false; campaign.at = corps ? corps.at : campaign.at; campaign.notice = `동맹 도시 ${c.stage.name}에서 ${back ? back.name : '이전 도시'}(으)로 퇴각했다.`;
    showDiplomacyResult('동맹군을 두고 퇴각', [`${corps ? corpsName(corps) : '군단'}이(가) ${c.stage.name}을 떠나 ${back ? back.name : '이전 도시'}(으)로 퇴각했습니다.`, '동맹군은 그 도시에 남아 싸웁니다.'], false); finishMovementStep(); return;
  }
  if (id === 'campaign:warn:ok' && warnMove) { const w = warnMove; warnMove = null; moveCampaign(w.id, true); moveMode = 'corps'; moveSelectOpen = true; return; }
  if (id === 'campaign:warn:cancel') { warnMove = null; moveMode = 'corps'; moveSelectOpen = true; campaign.notice = '이동 계획을 취소했습니다.'; return; }
  if (id === 'campaign:movemode') { campaign.moveMode = MOVE_MODES[(MOVE_MODES.indexOf(campaign.moveMode || 'detail') + 1) % MOVE_MODES.length]; campaign.notice = `턴 진행 중 적 군단 이동 안내: ${MOVE_NAME[campaign.moveMode]}${campaign.moveMode === 'skip' ? ' (아군과 상호작용하는 이동은 팝업으로 알린다)' : ''}`; saveCampaign(); return; }
  if (id === 'campaign:news') { campaign.newsMode = NEWS_MODES[(NEWS_MODES.indexOf(campaign.newsMode || 'important') + 1) % NEWS_MODES.length]; campaign.notice = `타 세력 소식: ${NEWS_NAME[campaign.newsMode]}`; saveCampaign(); return; }
  if (id === 'campaign:diff') { if (campaign.turn > 1) { campaign.notice = '난이도는 첫 턴에만 바꿀 수 있습니다.'; return; } const k = Object.keys(AI_PROFILES); campaign.difficulty = k[(k.indexOf(campaign.difficulty || 'normal') + 1) % k.length]; campaign.notice = `AI 난이도: ${aiP().name}`; saveCampaign(); return; }
  if (id === 'campaign:diplomacy:ok') { diplomacyResult = diplomacyQueue.shift() || null; return; }
  if (id === 'campaign:diplomacy:close') { diplomacyView = null; return; }
  if (/^campaign:diplomacy:(ally|truce|war)$/.test(id)) { const f = diplomacyView, r = proposeDiplomacy(f, id.split(':')[2]); if (r.blocked) { diplomacyView = null; showDiplomacyResult('외교 실패', [`${f}군과 지금은 그 선택을 할 수 없습니다.`, r.blocked], false); } return; }   // 성립·거절 팝업은 proposeDiplomacy 가 띄운다
  if (id === 'campaign:move') { mapTool = null; moveSelectOpen = true; moveMode = 'corps'; movePage = Math.floor(campaign.corps / listN()); campaign.notice = '이동할 군단을 선택하세요.'; return; }
  if (id === 'campaign:move:close') { moveSelectOpen = false; moveMode = 'corps'; return; }
  if (id === 'campaign:move:prev' || id === 'campaign:move:next') { const pages = Math.max(1, Math.ceil(roster.length / listN())), d = id.endsWith('next') ? 1 : -1; movePage = (movePage + d + pages) % pages; return; }
  if (/^campaign:move:\d+$/.test(id)) { const index = +id.slice(14), corps = roster[index]; if (!corps) return; if (!combatReadyCorps(corps)) { campaign.notice = '군단장이 없는 군단은 편성 전까지 이동할 수 없습니다.'; return; } campaign.corps = index; campaign.at = corps.at; campaign.destination = corps.target; moveMode = 'city'; moveSelectOpen = false; campaign.notice = `${corpsName(corps)}이 이동할 지역을 지도에서 선택하세요.`; return; }
  if (id === 'campaign:end') { mapTool = null; moveSelectOpen = false; exploreSelectOpen = false; moveMode = 'corps'; endCampaignTurn(); return; }
  if (id === 'campaign:explore') { moveSelectOpen = false; exploreSelectOpen = true; explorePage = 0; campaign.notice = '탐색할 군단을 선택하세요.'; return; }
  if (id === 'campaign:explore:close') { exploreSelectOpen = false; return; }
  if (id === 'campaign:explore:prev' || id === 'campaign:explore:next') { const available = roster.filter(c => combatReadyCorps(c) && stageById(c.at).owner === 'player'), pages = Math.max(1, Math.ceil(available.length / listN())), d = id.endsWith('next') ? 1 : -1; explorePage = (explorePage + d + pages) % pages; return; }
  if (/^campaign:explore:\d+$/.test(id)) { const index = +id.slice(17); exploreSelectOpen = false; exploreCampaign(index); return; }
  if (id === 'roster:detail') { rosterMode = 'detail'; rosterDetailCorps = rosterSource; const own = roster[rosterSource].units.findIndex(k => k && !Sim.U[k].generic), first = rosterHeroes()[0]; if (own >= 0) rosterDetailSlot = own; else if (first) { rosterDetailCorps = first.ci; rosterDetailSlot = first.slot; } rosterDetailPage = Math.max(0, Math.floor(rosterHeroes().findIndex(x => x.ci === rosterDetailCorps && x.slot === rosterDetailSlot) / 16)); campaign.notice = '왼쪽 목록에서 상세 정보를 볼 장수를 선택하세요. (세력 내 모든 장수)'; return; }
  if (id === 'roster:detail:prev' || id === 'roster:detail:next') { rosterDetailPage = Math.max(0, rosterDetailPage + (id.endsWith('next') ? 1 : -1)); return; }
  if (/^roster:detail:\d+:\d+$/.test(id)) { const [, , ci, slot] = id.split(':'); rosterDetailCorps = +ci; rosterDetailSlot = +slot; return; }
  if (id.startsWith('roster:squad:')) { const [, , side, q] = id.split(':'); rosterSquad[side] = +q; return; }
  if (id === 'roster:equip:prev' || id === 'roster:equip:next') { rosterEquipPage = Math.max(0, rosterEquipPage + (id.endsWith('next') ? 1 : -1)); return; }
  if (id === 'roster:equip') { rosterMode = 'equip'; rosterEquipPage = 0; campaign.notice = '◀ ▶ 로 장수의 ITEM 을 바꿉니다.'; return; }
  if (id.startsWith('roster:item:')) { const [, , slot, d] = id.split(':'); cycleItem(+slot, +d); return; }
  if (id === 'roster:back') {
    if (rosterMode === 'equip' || rosterMode === 'detail') { const save = rosterMode === 'equip'; rosterMode = 'select'; campaign.notice = '교환할 군단을 선택하세요.'; if (save) saveCampaign(); return; }
    if (rosterMode === 'exchange') {
      if (rosterNew !== null && roster[rosterNew] && !roster[rosterNew].units.some(Boolean)) { roster.splice(rosterNew, 1); campaign.notice = '배치가 없어 새 군단 생성을 취소했습니다.'; }
      else campaign.notice = '교환할 군단을 선택하세요.';
      rosterNew = null; rosterTarget = null; rosterMode = 'select'; rosterPick = null; return;
    }
    const error = rosterError(); if (error) { campaign.notice = error; return; }
    state = 'map'; rosterPick = null; campaign.notice = '편성이 저장되었습니다.'; saveCampaign(); return;
  }
  if (id === 'roster:source:prev' || id === 'roster:source:next') { const d = id.endsWith('next') ? 1 : -1; rosterSource = (rosterSource + d + roster.length) % roster.length; rosterPage = 0; return; }
  if (id.startsWith('roster:target:')) { rosterTarget = +id.slice(14); rosterMode = 'exchange'; rosterPick = null; campaign.notice = '장수를 선택한 뒤 반대쪽 교환 위치를 선택하세요.'; return; }
  if (id === 'roster:new') {
    if (roster.length >= ROSTER_MAX) { campaign.notice = '군단은 최대 100개까지 보유할 수 있습니다.'; return; }
    const newId = Math.max(...roster.map(c => c.id)) + 1; roster.push({ id: newId, name: `신규 군단 ${newId}`, at: roster[campaign.corps].at, target: null, units: Array(18).fill(null), growth: Array(18).fill(null) }); rosterTarget = roster.length - 1; rosterNew = rosterTarget; rosterMode = 'exchange'; rosterPick = null; campaign.notice = '새 군단을 편성 중입니다. 배치 없이 나가면 생성되지 않습니다.'; return;
  }
  if (id === 'roster:page:prev' || id === 'roster:page:next') { const pages = Math.max(1, Math.ceil((roster.length - 1) / rosterTargetN())), d = id.endsWith('next') ? 1 : -1; rosterPage = (rosterPage + d + pages) % pages; return; }
  if (id.startsWith('roster:unit:')) { const [, , side, slot] = id.split(':'); pickRosterUnit(side, +slot); return; }
  if (id.startsWith('stage:')) mapSel = id.slice(6);
  if (id.startsWith('stage:') && mapTool) { useMapTool(stageById(id.slice(6))); return; }
  if (id.startsWith('stage:')) { if (moveMode === 'city') { moveCampaign(id.slice(6)); /* 도시를 고르면 군단 선택으로 돌아가 다음 군단을 이어서 지정 */ if (!warnMove) { moveMode = 'corps'; moveSelectOpen = true; movePage = Math.floor(campaign.corps / listN()); } } else campaign.notice = '이동 버튼에서 군단을 선택한 뒤 지도에서 지역을 선택하세요.'; return; }
  if (id === 'tut:prev') { tutorialStep = Math.max(0, tutorialStep - 1); return; }
  if (id === 'tut:next') { if (tutorialStep >= 3) finishTutorial(); else tutorialStep++; return; }
  if (id === 'tut:skip') { finishTutorial(); return; }
  if (id.startsWith('order:')) { const [, index, command] = id.split(':'); useCommand(command, S.armies[+index]); return; }
  if (id === 'support:close') { supportOpen = false; return; }
  if (id.startsWith('support:')) { const A = S.armies[+id.slice(8)]; if (!A) return; const groups = S.armies.filter(B => B.team === 'player' && B.support && B.corps === A.corps); let count = 0; for (const B of groups) count += Sim.deployArmy(S, B, B.ctrl, true); if (count) { const corps = roster.find(c => c.id === A.corps); S.events.push({ type: 'notice', team: 'player', text: `아군 ${corps ? corpsName(corps) : A.name}이 참전했습니다.` }); supportOpen = false; } else S.events.push({ type: 'notice', team: 'player', text: '출진 구역이 가득 차 참전할 수 없습니다. 아군이 자리를 비우면 다시 시도하세요.' }); return; }
  if (id.startsWith('form:')) { cycleFormation(S.armies[+id.slice(5)]); return; }
  if (/^army\d/.test(id)) { armyIdx = +id.slice(4); beginSelect(); return; }
  if (id.startsWith('slot') || id.startsWith('col')) {
    const u = S.units.find(x => x.id === +id.replace(/\D/g, '')); if (!u || u.dead) return;
    const dbl = lastPortrait.id === u.id && T - lastPortrait.t < 0.4; lastPortrait = { id: u.id, t: T };
    if (alive(u)) { pick(u); if (dbl) snapCam(); } return;
  }
  if (id.startsWith('cmd:')) { useCommand(id.slice(4)); return; }
  if (id.startsWith('spell:')) { const u = ctrlOf(); if (u) Sim.selectSpell(u, +id.slice(6)); return; }
  if (id === 'prev') cycleUnit(-1); else if (id === 'next') cycleUnit(1); else if (id === 'armyT') { armyIdx = nextCorps(); cancelSelect(); snapCam(); }
  else if (id === 'm:act') act(false); else if (id === 'm:alt') act(true);
  else if (id === 'm:spell') { const u = ctrlOf(); if (u && u.spells.length) Sim.selectSpell(u, (u.spellSel + 1) % u.spells.length); }
  else if (id === 'm:speed') speedIdx = (speedIdx + 1) % SPEEDS.length; else if (id === 'm:pad') padVisible = !padVisible;
  else if (id === 'm:zoom') setZoom((zoomIdx + 1) % ZOOMS.length);
  else if (id === 'm:info') { selTarget = null; selectMode = true; }
  else if (id.startsWith('m:form:')) Sim.setFormation(army(), id.slice(7));
  else if (id === 'm:formation') cycleFormation(army());
  else if (id === 'm:pausesel') { SHOW.pauseSel = !SHOW.pauseSel; saveShow(); if (!SHOW.pauseSel) cancelSelect(); }
  else if (id === 'm:dmg') { SHOW.dmg = !SHOW.dmg; saveShow(); }
  else if (id === 'm:tutorial') { menuOpen = false; selectMode = false; tutorialStep = 0; }
  else if (id === 'm:mode') setMobile(!mobile);
  else if (id === 'm:status') { SHOW.status = !SHOW.status; saveShow(); }
  else if (id === 'm:compact') { tblCompact = !tblCompact; layout(); snapCam(); }
  else if (id === 'm:abil') tblAbility = !tblAbility;
  else if (id === 'm:auto') Sim.setAuto(S, !S.auto); else if (id === 'm:return') finishBattle(); else if (id === 'm:restart') { allyHelpIds = lastHelpIds.length ? lastHelpIds : null; startBattle(campaign.battle); } else if (id === 'm:close') menuOpen = false;
}
function mapClick(sx, sy, right) {   // 적을 클릭 = 군단이 그 적을 집중 공격, 아군을 클릭 = 그 캐릭터를 조작, 우클릭 = 집중 공격 해제
  const [wx, wy] = toWorld(sx, sy);
  if (right) { for (const u of army().units) if (u.order.type === 'attack') u.order = { type: army().order }; return true; }
  const hit = Sim.unitAt(S, wx, wy);
  if (hit && hit.team === 'enemy') { if (SHOW.pauseSel && !S.over && !menuOpen) { selTarget = hit; selectMode = true; } else { Sim.focus(S, army(), hit); mark(hit.x, hit.y, COLORS.danger); } } else if (hit) pick(hit);
  return !!hit;
}

// ---------- 입력 (포인터 이벤트: 마우스·터치 공용, 터치는 멀티터치 — 패드를 누른 채 다른 손가락으로 행동) ----------
function pos(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * VW / r.width, y: (e.clientY - r.top) * VH / r.height }; }
const inBtn = (b, x, y) => b.r ? Math.hypot(x - b.cx, y - b.cy) <= b.r + 6 : x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
function hitBtn(x, y) {
  const hit = [...btns].reverse().find(b => inBtn(b, x, y));
  if (!hit || !mobile || !hit.id.startsWith('stage:')) return hit;
  let best = hit, bd = Infinity;   // 모바일 도시 판정 영역(86×86)이 이웃과 겹치면 중심이 가까운 도시를 고른다
  for (const b of btns) if (b.id.startsWith('stage:') && inBtn(b, x, y)) { const d = Math.hypot(x - (b.x + b.w / 2), y - (b.y + b.h / 2)); if (d < bd) { bd = d; best = b; } }
  return best;
}
const padOf = id => { const [dx, dy] = id.slice(4).split(',').map(Number); return [dx, dy]; };
const STICK_R = 70, D8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const inStickZone = (x, y) => mobile && x >= LEFT_W && x < VW * 0.5 && y > TB_H;   // 맹장전 방식: 상태창을 제외한 왼쪽 전장에 플로팅 조이스틱
function stickMove(x, y) {   // 손가락 위치 → 노브 위치(반지름 제한) + 8방향
  const dx = x - stick.ox, dy = y - stick.oy, d = Math.hypot(dx, dy), k = d > STICK_R ? STICK_R / d : 1; stick.kx = dx * k; stick.ky = dy * k;
  if (d > 10) stick.moved = true;
  stick.dir = d > 10 ? D8[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8] : null;
}
const refreshPad = () => { const v = [...padPtrs.values()]; padDir = stick && stick.dir ? stick.dir : v.length ? v[v.length - 1] : null; };
function goFullscreen() { try { const d = document.documentElement, f = d.requestFullscreen || d.webkitRequestFullscreen; if (f && !document.fullscreenElement && !document.webkitFullscreenElement) { const p = f.call(d); if (p && p.catch) p.catch(() => {}); } const o = screen.orientation; if (o && o.lock) o.lock('landscape').catch(() => {}); } catch (e) { /* 지원하지 않는 브라우저(iOS 사파리 등)는 무시 */ } }
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
  const p = pos(e), b = hitBtn(p.x, p.y); mouse.x = p.x; mouse.y = p.y; mouse.in = true;
  if (e.pointerType === 'touch' && !mobile) setMobile(true);   // 터치가 감지되면 모바일 화면으로 전환
  if(state==='play'&&!BATTLE_ART.ready){if(BATTLE_ART.error)loadBattleArt();return;}
  if ((state === 'title' || state === 'map' || state === 'roster') && custodyOpen()) { if (b && (b.id.startsWith('custody:') || isTurnOpt(b.id))) uiClick(b.id); return; }
  if (state === 'title') { if (mobile) goFullscreen(); if (startFactionSelect) { if (b && (b.id.startsWith('start-faction:') || b.id === 'start-diff')) uiClick(b.id); } else if (saveSlotMode) { if (b && b.id.startsWith('save-slot:')) uiClick(b.id); } else if (b && b.id === 'title:new') startNewFromTitle(); else if (b && b.id === 'title:load') saveSlotMode = 'load'; return; }
  if ((state === 'map' || state === 'roster') && custodyOpen()) { if (b && (b.id.startsWith('custody:') || isTurnOpt(b.id))) uiClick(b.id); return; }
  if (state === 'map' && stratTutStep >= 0) { if (b && b.id.startsWith('stut:')) uiClick(b.id); return; }   // 전략 튜토리얼 중에는 튜토리얼 버튼만
  if (state === 'map' && mapFree()) { if (inMapMini(p)) { mapDrag = { id: e.pointerId, mini: true }; miniJump(p); return; } if (!b && p.x < MAP_VW) { mapDrag = { id: e.pointerId, x: p.x, y: p.y, cx: mcam.x, cy: mcam.y }; return; } }   // 지도: 미니맵을 누르면 그 위치로, 빈 곳을 끌면 지도가 움직인다 (도시 버튼은 pointerdown 한 번에 동작)
  if (state === 'map' && b && isTurnOpt(b.id) && (diplomacyResult || campaign.movement.length || turnSummary)) { uiClick(b.id); return; }   // 턴 진행 중 팝업의 이동·소식 토글
  if (state === 'map' || state === 'roster') { if (saveSlotMode) { if (b && b.id.startsWith('save-slot:')) uiClick(b.id); return; } const response = campaign.pendingEncounter; if (state !== 'map' || (warnMove ? b && b.id.startsWith('campaign:warn:') : allyChoice ? b && b.id.startsWith('campaign:ally:') : diplomacyResult ? b && b.id === 'campaign:diplomacy:ok' : response ? b && (b.id.startsWith('campaign:response:') || b.id.startsWith('campaign:intel:')) : campaign.movement.length ? b && b.id.startsWith('campaign:movement:') : diplomacyView ? b && b.id.startsWith('campaign:diplomacy:') : heroView ? b && b.id.startsWith('campaign:heroes:') : econView ? b && b.id === 'campaign:econ:close' : scoutView ? b && b.id === 'campaign:scout:close' : exploreSelectOpen ? b && b.id.startsWith('campaign:explore:') : !moveSelectOpen || b && b.id.startsWith('campaign:move:'))) { if (b) uiClick(b.id); } return; }
  if (tutorialStep >= 0) { if (b && b.id.startsWith('tut:')) uiClick(b.id); return; }
  if (S.events.length) { advanceBattleEvent(); return; }
  if (S.over) { if (b && b.id.startsWith('rep:')) { if (b.id === 'rep:side') repToggle(); else if (b.id === 'rep:done') { if (T - overAt > 0.5) finishBattle(); } else repTurn(b.id === 'rep:next' ? 1 : -1); } return; }   // 빈 곳 탭은 아무 일도 없다
  if (paused && !menuOpen) { paused = false; return; }   // 일시정지(앱 전환 등)는 화면을 탭하면 계속
  if (menuOpen) { if (b && /^m:(?!act$|alt$|spell$)/.test(b.id)) uiClick(b.id); return; }
  if (supportOpen) { if (b && b.id.startsWith('support:')) uiClick(b.id); return; }
  if (!b && inMini(p)) { miniPtr = e.pointerId; lookAt(p); return; }   // 미니맵: 누르거나 끌면 그 위치를 잠시 본다
  if (b && b.id.startsWith('order:')) { cancelSelect(); uiClick(b.id); return; }
  if (selectMode && mobile && !b && inStickZone(p.x, p.y)) confirmSelect();   // 모바일: 조이스틱을 잡으면 확정하고 바로 이동
  if (selectMode) {
    if (b && b.id === 'sel:ok') { confirmSelect(); return; }
    if (b && b.id === 'sel:solo') { const u = ctrlOf(); if (u) Sim.unitRetreat(S, u); confirmSelect(); return; }   // 개인 후퇴 후 전투 재개
    if (b && /^(slot|col|army|prev|next)/.test(b.id)) { uiClick(b.id); return; }   // 다른 캐릭터·군단 고르기 (계속 선택 단계)
    if (!b && inView(p.x, p.y)) { const [wx, wy] = toWorld(p.x, p.y), hit = Sim.unitAt(S, wx, wy); if (hit && hit.team === 'player') pick(hit); else if (hit && hit.team === 'enemy') selTarget = hit; else confirmSelect(); return; }   // 아군을 누르면 그 캐릭터로, 빈 곳·적이면 확정
    confirmSelect();   // 보조키·명령 버튼은 확정하고 그대로 입력
  }
  if (!b && !stick && inStickZone(p.x, p.y)) { stick = { id: e.pointerId, ox: p.x, oy: p.y, kx: 0, ky: 0, dir: null, t0: T, moved: false }; stickMove(p.x, p.y); refreshPad(); return; }
  if (b && b.id.startsWith('pad:')) { const [dx, dy] = padOf(b.id); if (dx || dy) { padPtrs.set(e.pointerId, [dx, dy]); refreshPad(); } else if (!mobile) act(false); return; }
  if (b) { uiClick(b.id); return; }
  if (inView(p.x, p.y)) { if (mobile && !mapClick(p.x, p.y, false)) act(false); else if (!mobile) mapClick(p.x, p.y, e.button === 2); }
});
cv.addEventListener('pointermove', e => {
  const p = pos(e); mouse.x = p.x; mouse.y = p.y; mouse.in = true;
  if (mapDrag && mapDrag.id === e.pointerId) { if (mapDrag.mini) miniJump(p); else { mcam.x = mapDrag.cx - (p.x - mapDrag.x); mcam.y = mapDrag.cy - (p.y - mapDrag.y); clampMcam(); } return; }
  if (miniPtr === e.pointerId) { if (mini) lookAt({ x: Math.max(mini.x, Math.min(mini.x + mini.w, p.x)), y: Math.max(mini.y, Math.min(mini.y + mini.h, p.y)) }); return; }
  if (stick && stick.id === e.pointerId) { stickMove(p.x, p.y); refreshPad(); return; }
  if (padPtrs.has(e.pointerId)) { const b = hitBtn(p.x, p.y); if (b && b.id.startsWith('pad:')) { const [dx, dy] = padOf(b.id); if (dx || dy) padPtrs.set(e.pointerId, [dx, dy]); else padPtrs.delete(e.pointerId); } else padPtrs.delete(e.pointerId); refreshPad(); }   // 패드 위에서 손가락을 미끄러뜨리면 방향 전환
});
function tapInfo(x, y) {   // 가상패드 영역을 끌지 않고 짧게 터치만 하면 그 자리의 정보를 보여준다 (아군=조작 전환, 적=적 정보, 빈 곳=조작 장수 정보)
  const hit = inView(x, y) ? Sim.unitAt(S, ...toWorld(x, y)) : null;
  if (hit && hit.team === 'player') pick(hit); else selTarget = hit && hit.team === 'enemy' ? hit : null;
  selectMode = true;
}
const endPtr = (e, cancel) => {
  if (mapDrag && mapDrag.id === e.pointerId) mapDrag = null;
  if (miniPtr === e.pointerId) miniPtr = -1;
  padPtrs.delete(e.pointerId);
  if (stick && stick.id === e.pointerId) { const t = stick; stick = null; if (!cancel && !t.moved && T - t.t0 < 0.4 && state === 'play' && !menuOpen && !S.over && !S.events.length && tutorialStep < 0) tapInfo(t.ox, t.oy); }
  refreshPad();
};
addEventListener('pointerup', e => endPtr(e, false)); addEventListener('pointercancel', e => endPtr(e, true));
addEventListener('keydown', e => {
  if(state==='play'&&!BATTLE_ART.ready){if(BATTLE_ART.error&&e.key==='Enter')loadBattleArt();return;}
  if (e.repeat) return;
  if ([' ', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F10'].includes(e.key)) e.preventDefault();
  if ((state === 'title' || state === 'map' || state === 'roster') && custodyOpen()) return;
  if (state === 'title') { if (startFactionSelect) { if (e.key === 'Escape') startFactionSelect = false; else if (/^[1-3]$/.test(e.key)) uiClick('start-faction:' + PLAYABLE_FACTIONS[+e.key - 1]); } else if (saveSlotMode) { if (e.key === 'Escape') saveSlotMode = null; else if (/^[1-3]$/.test(e.key)) uiClick('save-slot:' + e.key); } else if (e.key === 'Enter' || e.key.toLowerCase() === 'n') startNewFromTitle(); else if (e.key.toLowerCase() === 'l') saveSlotMode = 'load'; return; }
  if ((state === 'map' || state === 'roster') && custodyOpen()) return;
  if (state === 'map' && stratTutStep >= 0) { if (e.key === 'Escape') finishStratTut(); else if (e.key === 'ArrowLeft') stratTutNav('prev'); else if (['Enter', ' ', 'ArrowRight'].includes(e.key)) stratTutNav('next'); return; }
  if (state === 'map') { if (e.key.startsWith('Arrow')) mapKeys.add(e.key); else if (e.key === 'Home' && mapFree()) centerMap(); }
  if (state === 'map') { if (saveSlotMode) { if (e.key === 'Escape') saveSlotMode = null; else if (/^[1-3]$/.test(e.key)) uiClick('save-slot:' + e.key); } else if (e.key === 'Escape') { moveSelectOpen = false; exploreSelectOpen = false; heroView = null; } return; }
  if (state === 'roster') { if (e.code === 'Escape') uiClick('roster:back'); return; }
  if (tutorialStep >= 0) { if (e.key === 'Escape') finishTutorial(); else if (e.key === 'ArrowLeft') tutorialStep = Math.max(0, tutorialStep - 1); else if (['Enter', ' ', 'ArrowRight'].includes(e.key)) tutorialStep >= 3 ? finishTutorial() : tutorialStep++; return; }
  if (S.events.length) { if (['Enter', ' ', 'Escape'].includes(e.key)) advanceBattleEvent(); return; }
  if (S.over) { if (e.key === 'ArrowRight') repTurn(1); else if (e.key === 'ArrowLeft') repTurn(-1); else if (e.key === 'Tab') { e.preventDefault(); repToggle(); } else if (e.key.toLowerCase() === 'r' && T - overAt > 1) finishBattle(); return; }
  if (e.code in DIRS) { if (selectMode) confirmSelect(); dirStack = dirStack.filter(c => c !== e.code); dirStack.push(e.code); e.preventDefault(); return; }   // 방향 입력 (NumLock 상태와 무관하게 code 로 판별)
  keys[e.key] = true;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (selectMode && k === 'Enter') { confirmSelect(); return; }   // 선택 확정 → 전투 재개
  if (selectMode && k === ' ') { const cast = !selTarget; confirmSelect(); if (cast) act(false); return; }   // 아군 선택 중 Space 는 확정과 행동을 함께 실행
  if (selectMode && k === 'Escape') { if (selTarget) cancelSelect(); else confirmSelect(); return; }   // 적 정보는 Esc 로 지시 없이 닫는다   // 선택 확정 → 전투 재개
  if (supportOpen && k === 'Escape') { supportOpen = false; return; }
  if (k === 'Escape' || k === 'F10') { menuOpen = !menuOpen; return; }
  if (menuOpen) return;
  if (k === 'ArrowLeft') cycleUnit(-1); else if (k === 'ArrowRight') cycleUnit(1);
  else if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'Tab') { armyIdx = nextArmy(k === 'ArrowUp' ? -1 : 1); beginSelect(); }
  else if (k === ' ') act(false); else if (k === 'x') act(true);
  else if (k === '[') setZoom(zoomIdx - 1); else if (k === ']') setZoom(zoomIdx + 1);
  else if (k === 'f') useCommand('charge'); else if (k === 'v') useCommand('stop'); else if (k === 'r') useCommand('retreat'); else if (k === 'b') useCommand('idle');
  else if (k === 't') useCommand('auto'); else if (k === 'p') paused = !paused;
  else if (k >= '1' && k <= '5') { const u = ctrlOf(); if (u) Sim.selectSpell(u, +k - 1); }
});
cv.addEventListener('wheel', e => { if (!mapFree()) return; e.preventDefault(); if (e.shiftKey) mcam.x += e.deltaY || e.deltaX; else { mcam.y += e.deltaY; mcam.x += e.deltaX; } clampMcam(); }, { passive: false });   // 지도 휠: 세로 이동, Shift+휠: 가로 이동
addEventListener('keyup', e => { mapKeys.delete(e.key); dirStack = dirStack.filter(c => c !== e.code); keys[e.key] = false; });
addEventListener('blur', () => { mapKeys.clear(); mapDrag = null; keys = {}; dirStack = []; padPtrs.clear(); stick = null; padDir = null; });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play' && !S.over) { paused = true; keys = {}; padPtrs.clear(); stick = null; padDir = null; } });   // 앱 전환·화면 꺼짐 시 자동 일시정지
if (/[?&]m=1\b/.test(location.search) || (window.matchMedia && matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 900)) setMobile(true);

// ---------- 루프 ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now; T += dt;
  if (state === 'map' && mapKeys.size && mapFree()) { const v = 650 * dt; if (mapKeys.has('ArrowLeft')) mcam.x -= v; if (mapKeys.has('ArrowRight')) mcam.x += v; if (mapKeys.has('ArrowUp')) mcam.y -= v; if (mapKeys.has('ArrowDown')) mcam.y += v; clampMcam(); }   // 방향키를 누르고 있는 동안 지도 이동
  if (state === 'play') {
    for (const m of marks) m.t -= dt; marks = marks.filter(m => m.t > 0);
    if (BATTLE_ART.ready && !paused && !menuOpen && !supportOpen && tutorialStep < 0 && !S.over && !selectMode && !S.events.length) {
      const d = padDir || (dirStack.length ? DIRS[dirStack[dirStack.length - 1]] : null), u = ctrlOf();
      let r = dt * BATTLE_SPEED * (keys.Control ? 3 : SPEEDS[speedIdx]);
      let steps = 0;
      while (r > 0 && steps++ < MAX_SIM_STEPS && !S.over && !S.events.length) { const s = Math.min(r, 1 / 60); if (d && u && alive(u)) Sim.control(S, u, d[0], d[1]); Sim.step(S, s); r -= s; }
    }
    if (S.over && !overAt) { overAt = T; if (S.over === 'win' && campaign.battle && !isAllyCity(campaign.battle)) { capturedOnWin = campaign.battle.owner !== 'player'; campaign.battle.owner = 'player'; } }
    if (!ctrlOf() || !alive(ctrlOf())) { const next = activePlayerArmies().find(A => corpsKey(A) === corpsKey(army())) || activePlayerArmies()[0]; if (next) armyIdx = next.id; }
    snapCam();   // 조작 캐릭터를 전장 표시 영역의 정확한 중앙에 고정
  }
  draw(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

