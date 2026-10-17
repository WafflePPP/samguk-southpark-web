'use strict';
// 퍼스트퀸4 식 실시간 전투 시뮬레이션 (DOM 없음 → node 에서도 돌려 테스트한다).
// 군단(최대 18명, 3개 분대)의 캐릭터를 하나씩 지휘한다: 이동·공격·돌격·정지·이동불가·후퇴·특수기·마법.
// 이동은 정사각형 타일 격자: 한 칸에는 한 명만 설 수 있고, 한 번에 한 칸씩(8방향) 걸어간다. 이동 중에는 출발·도착 두 칸을 모두 점유한다.
// 유닛은 명령이 없으면 시야 안의 적과 알아서 싸운다. 피로도·레벨업·방패 방어·번개 잠금·대장 전사 시 도주·철수 후 재출진을 갖는다.
const Sim = (() => {
const TILE = 32, MW = 64, MH = 40, WW = MW * TILE, WH = MH * TILE;
const GRASS = 0, FOREST = 1, ROCK = 2, WATER = 3, ROAD = 4;
const SOLDIER_HP = 0.5;   // 일반 병사(generic) 체력 배율 — 장수는 그대로
const FRONTLINE_HP = 1.5; // 보병·방패병은 기존 일반 병사 체력의 3배
const SIZE = 0.6;   // 캐릭터 크기 배율 (몸·무기·체력바·피격 판정 반지름에 모두 적용)
const HP_MUL = 2.5;   // 전원 체력 배율 (고정 회복량에도 곱함)
const DMG = 0.32;   // 전체 피해 배율(전투 길이). 적도 아군과 같은 능력치 기준 — 난이도는 적 군단 구성(장수·병사 수)으로 맞춘다
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- 병종/영웅 표 ----------
// cls: warrior 전사 · cavalry 기마 · archer 궁병 · shield 방패병 · mage 법사 · cleric 성직자
// df 물리방어 · ad 화살방어 · md 마법방어 · aa 화살 회피율(%) · hr 체력 회복률(서 있으면 초당 최대체력의 hr/1000) · sp 속도(px/s, 32px = 1칸 → 180 = 5.6칸/초) · range 사거리(px, 없으면 근접=인접 칸) · cd 공격간격(s)
const U = {
  guan: { name: '관우', cls: 'warrior', aa: 15, hr: 10, sp: 180, hp: 520, atk: 66, df: 40, ad: 32, md: 20, cd: 1.0, r: 14, style: 'guan', special: 'spin' },
  dian: { name: '전위', cls: 'warrior', aa: 10, hr: 12, sp: 173, hp: 440, atk: 66, df: 55, ad: 40, md: 20, cd: 1.0, r: 14, style: 'dian', special: 'spin' },
  zhao: { name: '조운', cls: 'cavalry', aa: 14, hr: 10, sp: 270, hp: 520, atk: 84, df: 42, ad: 21, md: 20, cd: 0.8, r: 14, style: 'zhao', special: 'dash' },
  huang: { name: '황충', cls: 'archer', aa: 25, hr: 8, sp: 166, hp: 260, atk: 68, df: 12, ad: 12, md: 16, cd: 1.3, range: 270, r: 13, style: 'huang', special: 'volley' },
  diao: { name: '초선', cls: 'cleric', mp: 999, aa: 20, hr: 12, sp: 180, hp: 400, atk: 66, df: 30, ad: 24, md: 24, cd: 1.0, r: 12, style: 'diao', spells: ['heal'], special: 'bless' },
  kong: { name: '제갈량', cls: 'mage', mp: 999, aa: 18, hr: 8, sp: 166, hp: 300, atk: 30, df: 18, ad: 18, md: 30, cd: 1.4, range: 200, r: 12, style: 'kong', spells: ['bolt', 'phoenix', 'fireball', 'thunder', 'web'] },
  sword: { name: '보병', cls: 'warrior', hp: 120, atk: 21, df: 8, ad: 5, md: 4, aa: 12, hr: 5, sp: 180, cd: 1.0, r: 11, style: 'ally_sword', generic: true },
  spear: { name: '보병(창)', cls: 'warrior', hp: 120, atk: 21, df: 8, ad: 5, md: 4, aa: 12, hr: 5, sp: 180, cd: 1.0, r: 11, style: 'ally_sword', generic: true },
  shield: { name: '방패병', cls: 'shield', hp: 200, atk: 15, df: 14, ad: 14, md: 5, aa: 6, hr: 5, sp: 153, cd: 1.1, r: 12, style: 'ally_shield', shield: true, generic: true },
  archer: { name: '궁병', cls: 'archer', hp: 80, atk: 22, df: 4, ad: 3, md: 4, aa: 16, hr: 5, sp: 173, cd: 1.4, range: 250, r: 11, style: 'ally_archer', generic: true },
  cav: { name: '기마병', cls: 'cavalry', hp: 160, atk: 27, df: 8, ad: 4, md: 4, aa: 4, hr: 5, sp: 270, cd: 0.9, r: 13, style: 'ally_cav', generic: true },
  mage: { name: '법사', cls: 'mage', hp: 70, mp: 999, atk: 8, df: 2, ad: 2, md: 10, aa: 12, hr: 5, sp: 166, cd: 1.5, range: 190, r: 11, style: 'mage', spells: ['bolt', 'fireball', 'ice'], generic: true },
  lubu: { name: '여포', cls: 'cavalry', aa: 14, hr: 12, sp: 252, hp: 760, atk: 84, df: 48, ad: 32, md: 24, cd: 0.8, r: 15, style: 'lubu', special: 'dash', fanatic: true },
  ecap: { name: '적 장수', cls: 'warrior', aa: 12, hr: 10, sp: 173, hp: 400, atk: 64, df: 40, ad: 24, md: 20, cd: 1.0, r: 14, style: 'captain', special: 'spin' },
  esword: { name: '적 보병', cls: 'warrior', hp: 115, atk: 20, df: 8, ad: 5, md: 4, aa: 12, hr: 5, sp: 180, cd: 1.0, r: 11, style: 'soldier', generic: true },
  eshield: { name: '적 방패', cls: 'shield', hp: 200, atk: 14, df: 14, ad: 14, md: 5, aa: 6, hr: 5, sp: 153, cd: 1.1, r: 12, style: 'shield', shield: true, generic: true },
  earcher: { name: '적 궁병', cls: 'archer', hp: 75, atk: 21, df: 4, ad: 3, md: 4, aa: 16, hr: 5, sp: 173, cd: 1.4, range: 250, r: 11, style: 'archer', generic: true },
  ecav: { name: '적 기마', cls: 'cavalry', hp: 155, atk: 26, df: 8, ad: 4, md: 4, aa: 4, hr: 5, sp: 270, cd: 0.9, r: 13, style: 'cav', generic: true },
  hua: { name: '화웅', cls: 'warrior', sp: 173, cd: 1.0, r: 14, aa: 10, hr: 10, style: 'hua', special: 'spin', fanatic: true },
  jang: { name: '장료', cls: 'cavalry', sp: 252, cd: 0.8, r: 15, aa: 14, hr: 10, style: 'jang', special: 'dash' },
  xun: { name: '순욱', cls: 'mage', mp: 999, sp: 166, cd: 1.4, range: 200, r: 12, aa: 18, hr: 8, style: 'xun', spells: ['bolt', 'phoenix', 'fireball', 'thunder'], fanatic: true },
  emage: { name: '적 법사', cls: 'mage', hp: 70, mp: 999, atk: 8, df: 2, ad: 2, md: 10, aa: 12, hr: 5, sp: 166, cd: 1.5, range: 190, r: 11, style: 'emage', spells: ['bolt', 'roll', 'tornado'], generic: true },
  esage: { name: '적 군사', cls: 'mage', mp: 999, aa: 18, hr: 8, sp: 166, hp: 300, atk: 30, df: 18, ad: 18, md: 30, cd: 1.4, range: 200, r: 12, style: 'emage', spells: ['bolt', 'phoenix', 'thunder', 'quake', 'web'], fanatic: true },
};
// 장수 등급. 일반 대장(적 장수·적 군사)은 병종별 기준 능력치 [hp, atk, df, ad, md]. 정예 장수는 같은 병종 일반 대장 × 배율 (2배 이상, 관우·여포 4배, 조운·황충·전위 3배 = 기본 2배 × 1.5, 초선·제갈량 2배).
const CAPTAIN = { warrior: [400, 64, 40, 24, 20], cavalry: [400, 70, 32, 20, 18], archer: [260, 68, 12, 12, 16], mage: [300, 30, 18, 18, 30], cleric: [400, 66, 30, 24, 24] };
const ELITE = { guan: 4, lubu: 4, zhao: 3, huang: 3, dian: 3, diao: 2, kong: 2, hua: 3, jang: 3, xun: 2 };   // 아군 정예 + 적 정예(화웅·장료·순욱)
const STAT5 = ['hp', 'atk', 'df', 'ad', 'md'];
const CLONES = { yan: ['hua', '안량'], wen: ['hua', '문추'], gao: ['hua', '고순'], xia: ['hua', '하후돈'], guo: ['xun', '곽가'] };   // 이름만 다른 적 정예 장수
for (const [k, [src, name]] of Object.entries(CLONES)) { U[k] = { ...U[src], name }; ELITE[k] = 1; }   // 복제 장수는 일반 대장 등급 (정예 3배로 두면 독립 군단 9개가 한꺼번에 몰려 자동 전투 승률 0%)
for (const k of ['ecap', 'esage']) STAT5.forEach((f, i) => { U[k][f] = CAPTAIN[U[k].cls][i]; });
for (const [k, x] of Object.entries(ELITE)) STAT5.forEach((f, i) => { U[k][f] = Math.round(CAPTAIN[U[k].cls][i] * x); });
// 일반 병사만 현재 전투 능력치의 2.5배. 이동·사거리·공격 간격·MP와 장수 등급은 유지한다.
for (const u of Object.values(U)) if (u.generic) for (const f of [...STAT5, 'aa', 'hr']) u[f] *= 2.5;
// named: 이름 있는 장수(관우·여포·화웅 …)는 필드에 항상 이름을 표기 (적 장수·적 군사 같은 직함·병사는 제외)
const CLS_NAME = { warrior: '전사', cavalry: '기마', archer: '궁병', shield: '방패', mage: '법사', cleric: '성직' };
const CATEGORY_NAME = { cavalry: '기병', sword: '검병', spear: '창병', archer: '궁병', military: '군사' };
const CATEGORY = { warrior: 'sword', shield: 'spear', cavalry: 'cavalry', archer: 'archer', mage: 'military', cleric: 'military' };
const UNIT_CATEGORY = { guan: 'sword', dian: 'spear', sword: 'sword', shield: 'sword', xia: 'sword', yan: 'sword', wen: 'spear', spear: 'spear', esword: 'spear', eshield: 'spear' };
const SUBCLASS = { guan: '무신', dian: '철벽', sword: '보병(검)', shield: '방패병(검)', xia: '맹장', yan: '맹장', wen: '용장', lubu: '비장', zhao: '백마의종', jang: '전신', huang: '신궁', mage: '법사', emage: '법사', esage: '법사', kong: '법사', xun: '법사', diao: '성직', spear: '보병(창)', esword: '보병(창)', eshield: '방패병(창)', archer: '궁병', earcher: '궁병', cav: '기병', ecav: '기병' };
// 표에 적힌 공격 병과별 최종 피해 배율.
const CLASS_DAMAGE = { cavalry: { cavalry: 1, sword: 2, archer: 2, military: 2, spear: 0.8 }, sword: { sword: 1, spear: 1.2, archer: 1.2, military: 1.2, cavalry: 0.5 }, spear: { spear: 1, sword: 1.2, archer: 1.2, military: 1.2, cavalry: 1.2 }, archer: { archer: 1, sword: 1.5, spear: 1.5, cavalry: 2, military: 1.5 }, military: { military: 1, sword: 1.5, spear: 1.5, cavalry: 2, archer: 1.5 } };
const classMultiplier = (attacker, defender) => CLASS_DAMAGE[attacker]?.[defender] ?? 1;
const matchup = (attacker, defender) => classMultiplier(attacker, defender) < 1 ? 1 : classMultiplier(attacker, defender) > 1 ? -1 : 0;
const FORMATION_NAME = { block: '기본', line: '횡대', wedge: '쐐기' };
const ENEMY_FIELD_MAX = 36, ARMY_MAX = 18, SQUAD_MAX = 3;
// 마법표 (퍼스트퀸4). dmg = [기본, 대상 MD 1당 감소, 최소] — 시전자 능력치와 무관, 대상의 마법방어(MD)만 본다.
//  확인된 것(나무위키): 장풍·불새·얼음칼날·회오리바람 140/4/20, 불꽃탄·불공 35/1/5, 장풍=추적, 불새·얼음칼날·회오리=관통, 번개=아주 넓고 아군도 맞음,
//  지진=약한 피해·아군 안 맞음, 번개·지진·거미줄·마법의 벽·소환은 쓰면 모든 마법이 한동안 잠김(lock), 한 캐릭터 마법 최대 5개.
//  설계값(자료 없음): 범위·속도·MP·쿨·번개/지진 피해·거미줄 효과·lock 7초.
const BOLT = [140, 4, 20], BALL = [35, 1, 5];
const SPELL = {
  bolt: { name: '장풍', kind: 'homing', mp: 8, range: 260, cd: 1.2, dmg: BOLT, col: '#9fe8ff' },
  phoenix: { name: '불새', kind: 'pierce', mp: 14, range: 260, cd: 1.8, dmg: BOLT, col: '#ff8a3a' },
  ice: { name: '얼음칼날', kind: 'pierce', mp: 12, range: 260, cd: 1.6, dmg: BOLT, col: '#bfe8ff' },
  tornado: { name: '회오리바람', kind: 'pierce', mp: 12, range: 260, cd: 1.6, dmg: BOLT, col: '#d8ffd0' },
  fireball: { name: '불꽃탄', kind: 'ball', mp: 10, range: 260, cd: 1.5, dmg: BALL, r: 56, col: '#ff7a3a' },
  roll: { name: '불공', kind: 'roll', mp: 8, range: 220, cd: 1.2, dmg: BALL, r: 34, col: '#ff9a4a' },
  thunder: { name: '번개', kind: 'wide', mp: 30, range: 300, cd: 3.0, lock: 7, r: 110, dmg: [120, 3, 20], friendly: true, col: '#fff2a0' },
  quake: { name: '지진', kind: 'quake', mp: 25, range: 0, cd: 3.0, lock: 7, r: 140, dmg: [25, 1, 5], col: '#c9a56a' },
  web: { name: '거미줄', kind: 'web', mp: 20, range: 240, cd: 3.0, lock: 7, r: 70, root: 3, col: '#e8e8e8' },
  heal: { name: '치유', kind: 'heal', mp: 6, range: 130, cd: 1.2 },
};
const AI_LOCK_GAP = 20;   // AI 가 전체 쿨 마법을 다시 쓰기까지의 간격(초, 설계값)
const MAGIC = 0.5;   // 마법 피해 배율 (원작 수치를 이 프로토의 체력 규모에 맞춘다)
const magicDmg = (sp, t) => Math.max(sp.dmg[2], sp.dmg[0] - sp.dmg[1] * t.md * ftDef(t)) * MAGIC;
const SPECIAL = { spin: { name: '회전참', cd: 12 }, dash: { name: '돌진', cd: 10 }, volley: { name: '연사', cd: 12 }, bless: { name: '축복', cd: 25 } };

// 군단 편성. 한 군단은 18명·3분대까지 가능하며, squads 를 지정하지 않으면 기존 편성 전체를 대장 1명의 1분대로 해석한다.
// at = 진형 중심 타일. 적 군단은 trig 조건(접근·시간·다른 군단 붕괴)이 되면 wait → advance
const ARMIES = [
  { team: 'player', name: '본대', at: [5, 18], leader: 'guan', units: ['guan', 'dian', 'sword', 'shield', 'sword', 'shield'] },
  { team: 'player', name: '기마대', at: [5, 25], leader: 'zhao', units: ['zhao', 'cav', 'cav', 'cav', 'cav', 'cav'] },
  { team: 'enemy', name: '장료대', at: [37, 19], leader: 'jang', units: ['jang', 'ecap', 'esword'], trig: { near: 15, t: 25 } },
  { team: 'enemy', name: '여포대', at: [53, 20], leader: 'lubu', commander: true, units: ['lubu', 'eshield'], trig: { near: 13, t: 110, after: 2 } },
  { team: 'enemy', name: '순욱대', at: [45, 7], leader: 'xun', units: ['xun', 'esage'], trig: { near: 14, t: 70 } },
  { team: 'enemy', name: '하후돈대', at: [37, 11], leader: 'xia', units: ['xia', 'earcher'], trig: { near: 15, t: 25 } },
  { team: 'enemy', name: '화웅대', at: [37, 27], leader: 'hua', units: ['hua', 'ecav'], trig: { near: 15, t: 25 } },
  { team: 'enemy', name: '곽가대', at: [45, 14], leader: 'guo', units: ['guo', 'emage'], trig: { near: 14, t: 70 } },
  { team: 'enemy', name: '문추대', at: [45, 27], leader: 'wen', units: ['wen'], trig: { near: 14, t: 70 } },
  { team: 'enemy', name: '고순대', at: [53, 13], leader: 'gao', units: ['gao'], trig: { near: 13, t: 110, after: 2 } },
  { team: 'enemy', name: '안량대', at: [53, 27], leader: 'yan', units: ['yan'], trig: { near: 13, t: 110, after: 2 } },
  { team: 'player', name: '궁병대', at: [5, 11], leader: 'huang', units: ['huang', 'archer', 'archer', 'archer', 'archer', 'archer'] },   // 아군 3부대 (적 군단 인덱스가 밀리지 않게 맨 끝)
];
for (let i = 0; i < 0; i++) ARMIES[2 + i % 9].units.push(['esword', 'eshield', 'earcher'][i % 3]);
// ---------- 지형 / 격자 ----------
function genMap(seed = 7, armies = ARMIES) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const m = new Uint8Array(MW * MH), set = (x, y, t) => { if (x >= 0 && y >= 0 && x < MW && y < MH) m[y * MW + x] = t; };
  for (let i = 0; i < 22; i++) {   // 숲
    const cx = 10 + rnd() * 52, cy = rnd() * MH, rx = 2 + rnd() * 4, ry = 2 + rnd() * 3;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 && rnd() < 0.9) set(x, y, FOREST);
  }
  for (let y = 0; y < MH; y++) {   // 강: 세 곳의 여울로만 건널 수 있다
    const rx = Math.round(28 + 2 * Math.sin(y * 0.35));
    for (let x = rx - 1; x <= rx + 1; x++) set(x, y, (y >= 6 && y <= 11) || (y >= 18 && y <= 23) || (y >= 30 && y <= 34) ? ROAD : WATER);
  }
  for (let i = 0; i < 40; i++) { const x = 8 + Math.floor(rnd() * 54), y = Math.floor(rnd() * MH); if (m[y * MW + x] === GRASS || m[y * MW + x] === FOREST) set(x, y, ROCK); }
  for (const a of armies) for (let y = -4; y <= 4; y++) for (let x = -5; x <= 5; x++) { const tx = a.at[0] + x, ty = a.at[1] + y; if (tx >= 0 && ty >= 0 && tx < MW && ty < MH && m[ty * MW + tx] !== WATER && m[ty * MW + tx] !== ROAD) m[ty * MW + tx] = GRASS; }
  for (let y = 0; y < MH; y++) for (const x of [0, 1, MW - 2, MW - 1]) if (m[y * MW + x] === ROCK) m[y * MW + x] = GRASS;
  return m;
}
const ti = (tx, ty) => ty * MW + tx;
const inMap = (tx, ty) => tx >= 0 && ty >= 0 && tx < MW && ty < MH;
const okTile = (S, tx, ty) => inMap(tx, ty) && S.map[ti(tx, ty)] !== ROCK && S.map[ti(tx, ty)] !== WATER;
const tileOf = (x, y) => clamp(Math.floor(y / TILE), 0, MH - 1) * MW + clamp(Math.floor(x / TILE), 0, MW - 1);
const tcx = t => (t + 0.5) * TILE, tcy = t => (t + 0.5) * TILE + 8;   // 발 위치는 칸 중앙보다 8px 아래 (몸이 칸 안에 들어오도록)
const cheb = (a, b) => Math.max(Math.abs(a.tx - b.tx), Math.abs(a.ty - b.ty));
const tileMul = (S, tx, ty) => { const t = S.map[ti(tx, ty)]; return t === FOREST ? 0.6 : t === ROAD ? 1.15 : 1; };
const diagOk = (S, x, y, dx, dy) => !dx || !dy || (okTile(S, x + dx, y) && okTile(S, x, y + dy));   // 모서리 가로지르기 금지

const ASTAR_CAP = 800, prof = { astar: 0 };   // prof: 테스트용 호출 횟수
const sameTeam = (S, u, id) => { const o = S.units[id - 1]; return !!o && o.team === u.team; };   // 유닛 id = 배열 위치 + 1
function astar(S, u, gtx, gty, dyn) {   // 타일 A* (8방향). dyn: 다른 유닛이 서 있는 칸도 막힌 칸으로 본다 (도착 칸은 예외)
  prof.astar++; let g = ti(gtx, gty); const s = ti(u.tx, u.ty);
  if (!okTile(S, gtx, gty)) { let best = -1, bd = 1e9; for (let i = 0; i < MW * MH; i++) if (okTile(S, i % MW, i / MW | 0)) { const d = Math.hypot(i % MW - gtx, (i / MW | 0) - gty); if (d < bd) { bd = d; best = i; } } g = best; }
  if (s === g) return [];
  const ok = i => S.map[i] !== ROCK && S.map[i] !== WATER && (!dyn || i === g || S.occ[i] === 0 || S.occ[i] === u.id || sameTeam(S, u, S.occ[i]));
  const gc = new Float32Array(MW * MH).fill(1e9), from = new Int32Array(MW * MH).fill(-1), closed = new Uint8Array(MW * MH), heap = [[0, s]];
  gc[s] = 0;
  const h = i => { const dx = Math.abs(i % MW - g % MW), dy = Math.abs((i / MW | 0) - (g / MW | 0)); return Math.max(dx, dy) + 0.41 * Math.min(dx, dy); };
  const push = e => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  let nodes = 0, near = s;   // 노드 확장 상한(설계값 800): 넘으면 목표에 가장 가까웠던 칸까지의 부분 경로
  while (heap.length) {
    const c = pop()[1]; if (closed[c]) continue; closed[c] = 1; if (c === g) break;
    if (h(c) < h(near)) near = c;
    if (++nodes > ASTAR_CAP) { g = near; break; }
    const cx = c % MW, cy = c / MW | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; if (!inMap(nx, ny)) continue;
      const n = ti(nx, ny); if (!ok(n) || closed[n] || !diagOk(S, cx, cy, dx, dy)) continue;
      const cost = gc[c] + (dx && dy ? 1.41 : 1) * (S.map[n] === FOREST ? 1.6 : 1);
      if (cost < gc[n]) { gc[n] = cost; from[n] = c; push([cost + h(n), n]); }
    }
  }
  if (from[g] < 0 && g !== s) return null;
  const path = []; for (let c = g; c !== s && c >= 0; c = from[c]) path.push({ tx: c % MW, ty: c / MW | 0 });
  path.reverse(); if (nodes > ASTAR_CAP) path.partial = true;
  return path;
}

// ---------- 전투 생성 ----------
function createBattle(seed = 1, opts = {}) {
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const armyDefs = opts.armies || ARMIES;
  const S = { t: 0, map: genMap(opts.mapSeed || 7, armyDefs), occ: new Int32Array(MW * MH), units: [], armies: [], proj: [], later: [], fx: [], texts: [], events: [], talked: new Set(), over: null, rnd, nextId: 1, auto: !!opts.auto, lock: { player: 0, enemy: 0 }, lockAI: { player: 0, enemy: 0 }, stats: { kills: 0, lost: 0, fled: 0, levelups: 0 } };
  const cnt = {}; let enemyField = 0, reserves = false;
  armyDefs.forEach((d, ai) => {
    const squadDefs = d.squads || (d.units.length ? [{ leader: d.leader, units: d.units }] : []);
    if (squadDefs.length > SQUAD_MAX) throw new Error(d.name + ': 분대는 최대 ' + SQUAD_MAX + '개');
    const members = [];
    squadDefs.forEach((q, squad) => {
      const leader = U[q.leader];
      if (!leader || leader.generic || leader.name.startsWith('적 ') || q.units.filter(k => k === q.leader).length !== 1) throw new Error(d.name + ': 분대장은 이름 있는 장수 1명이어야 함');
      q.units.forEach(key => members.push({ key, squad }));
    });
    const keys = members.slice(0, ARMY_MAX), reserve = d.team === 'enemy' && (reserves || enemyField + keys.length > ENEMY_FIELD_MAX);
    if (reserve) reserves = true; else if (d.team === 'enemy') enemyField += keys.length;
    const leaderKey = d.leader || (squadDefs[0] && squadDefs[0].leader);
    const A = { id: ai, team: d.team, name: d.name, units: [], squads: squadDefs.map((q, id) => ({ id, leader: null, units: [] })), leader: null, commander: !!d.commander, trig: d.trig, state: d.team === 'player' ? 'player' : reserve ? 'reserve' : 'wait', formation: 'block', routed: false, order: 'idle', ctrl: null };
    S.armies.push(A);
    keys.forEach(({ key, squad }, i) => {
      const T = U[key], sgn = d.team === 'player' ? 1 : -1; cnt[key] = (cnt[key] || 0) + 1;
      const tx = d.at[0] - sgn * Math.floor(i / 4), ty = d.at[1] + (i % 4) - 1;   // 4행 × 3열, 한 칸에 한 명
      const u = { id: S.nextId++, key, name: T.name + (T.generic ? String.fromCharCode(64 + cnt[key]) : ''), cls: T.cls, category: UNIT_CATEGORY[key] || CATEGORY[T.cls], subclass: SUBCLASS[key] || CLS_NAME[T.cls], team: d.team, army: A, tx, ty, x: tcx(tx), y: tcy(ty), mv: null,
        hp: T.hp * HP_MUL * (['sword', 'spear', 'shield', 'esword', 'eshield'].includes(key) ? FRONTLINE_HP : T.generic ? SOLDIER_HP : 1), maxHp: T.hp * HP_MUL * (['sword', 'spear', 'shield', 'esword', 'eshield'].includes(key) ? FRONTLINE_HP : T.generic ? SOLDIER_HP : 1), mp: T.mp || 0, maxMp: T.mp || 0, lv: 1, xp: 0, ft: 0, atk: T.atk, df: T.df, ad: T.ad, md: T.md, sp: T.sp, cd: T.cd, cdT: rnd(), range: T.range || 0, r: T.r * SIZE, style: T.style,
        aa: T.aa, hr: T.hr, named: !T.generic && !T.name.startsWith('적 '), lastHurt: -99, shield: !!T.shield, special: T.special || null, spT: 0, spells: T.spells || [], fanatic: !!(T.fanatic || d.commander), isLeader: key === leaderKey, isSquadLeader: key === squadDefs[squad].leader, squad: A.squads[squad],
        face: d.team === 'player' ? 0 : Math.PI, order: { type: 'idle' }, slot: { dx: tx - d.at[0], dy: ty - d.at[1] }, claim: -1, claimT: 0, repathT: 0, path: null, pathGoal: -1, waitT: 0, stuck: 0, thinkT: rnd() * 0.3, flash: 0, anim: 0, stun: 0, dashQ: null, dead: false, out: reserve, reserve, fled: false, moving: false, autoCharge: false };
      u.spellSel = 0; u.ctrlIn = null; u.root = 0; u.hitT = 0; u.hitAng = 0; u.hitMag = 1;
      if (!reserve) S.occ[ti(tx, ty)] = u.id; S.units.push(u); A.units.push(u); u.squad.units.push(u); if (u.isSquadLeader) u.squad.leader = u; if (u.isLeader) A.leader = u;
    });
    if (d.team === 'player') setCtrl(S, A, A.leader);   // 군단마다 조작 캐릭터 한 명 (처음엔 대장)
  });
  return S;
}

// ---------- 전투 계산 ----------
// 피로도(FT 0~100) 설정 — 한 곳에서 조절한다. 효율(eff) = 쌓이는 속도 1/eff · 회복 속도 eff배 (1 이면 교전 1분에 100 가까이, 10 이면 거의 안 쌓임; 3 이면 격렬한 교전 뒤에만 50~70까지 오르고 쉬면 내려감)
const FT = { eff: 3, gain: { hit: 1.8, spell: 2, special: 3, step: 0.1 }, recover: 0.04, penalty: 0.004, max: 100 };   // gain: 행동 한 번당 상승량 / recover: 초당 회복 / penalty: FT 1 당 능력 감소 (100 이면 -40%)
const tire = (u, kind) => { u.ft = Math.min(FT.max, u.ft + FT.gain[kind] / FT.eff); };
const ftMul = u => 1 - u.ft * FT.penalty;   // 공격·이동 속도 배율
const ftDef = u => 1 - u.ft * FT.penalty;   // 방어 배율 (설계값, ftMul 과 별개로 둘 수 있게 분리)
const live = u => !u.dead && !u.out;
let cur = null;   // step() 중인 전투 (phys 의 난수용)
const mitigate = (a, d) => a * a / (a + Math.max(0, d));   // 공격 a 가 방어 d 를 만났을 때의 유효 공격 (방어가 같으면 절반)
const phys = (u, t, mul = 1) => Math.max(1, mitigate(u.atk * mul * (0.85 + cur.rnd() * 0.3) * ftMul(u), t.df * ftDef(t))) * DMG;
function text(S, x, y, s, col, k = 'sys') { S.texts.push({ x, y, s, col, t: 1.0, k }); }   // k: dmg 피해량 / buff 회복·방어·회피·레벨업 등 효과 / sys 안내(항상 표시)
function notice(S, team, text) { S.events.push({ type: 'notice', team, text }); }
function dialogue(S, u, text) { S.events.push({ type: 'dialogue', team: u.team, key: u.key, speaker: u.name, text }); }
function ring(S, x, y, r, col, t = 0.4) { S.fx.push({ kind: 'ring', x, y, r, col, t, max: t }); }
function release(S, u) {   // 점유 중인 칸(출발·도착)을 비운다
  const p = u.mv && u.mv.swap;   // 맞바꾸던 상대가 쓰러지거나 떠나면, 남은 쪽은 그 칸으로 가는 보통 이동으로 바꾸고 도착 칸을 바로 점유한다 (아니면 빈 칸으로 보여 다른 유닛이 겹쳐 들어온다)
  if (p && p.mv && p.mv.swap === u) { p.mv.swap = null; S.occ[ti(p.mv.nx, p.mv.ny)] = p.id; }
  if (S.occ[ti(u.tx, u.ty)] === u.id) S.occ[ti(u.tx, u.ty)] = 0;
  if (u.mv && S.occ[ti(u.mv.nx, u.mv.ny)] === u.id) S.occ[ti(u.mv.nx, u.mv.ny)] = 0;
  u.mv = null;
}
function gainXp(S, u, n) {
  if (!live(u)) return; u.xp += n;
  while (u.xp >= u.lv * 60) {   // 레벨업: 능력치 상승 + 부분 회복 (퍼스트퀸4 의 전투 중 레벨업)
    u.xp -= u.lv * 60; u.lv++; u.maxHp = Math.round(u.maxHp * 1.08); u.hp = Math.min(u.maxHp, u.hp + 20 * HP_MUL); u.atk = Math.round(u.atk * 1.05 * 10) / 10; u.maxMp = Math.round(u.maxMp * 1.05);
    text(S, u.x, u.y - u.r * 4, 'LEVEL UP', '#ffd34d', 'buff'); ring(S, u.x, u.y, 30, '#ffd34d', 0.5); S.stats.levelups++;
  }
}
function die(S, u, killer) {
  u.dead = true; u.hp = 0; S.fx.push({ kind: 'dust', x: u.x, y: u.y, r: u.r, t: 0.7, max: 0.7 }, { kind: 'fall', x: u.x, y: u.y, r: u.r, style: u.style, face: u.face, ang: u.hitAng, t: 0.9, max: 0.9 }); release(S, u);
  if (u.team === 'player') S.stats.lost++; else { S.stats.kills++; if (killer && killer.team === 'player') gainXp(S, killer, 18 + u.lv * 6); }
  if (u.isLeader && !u.army.routed) {
    u.army.routed = true; text(S, u.x, u.y - 60, u.army.name + ' 지휘관 전사!', '#ff5a4a');
    dialogue(S, u, u.team === 'player' ? '내 뜻을 이어 전투를 계속하라…' : '내가 여기서 쓰러지다니…');
    if (u.team === 'enemy') {
      let fleeing = false; for (const m of u.army.units) if (live(m) && !m.fanatic) { m.order = { type: 'flee' }; m.path = null; fleeing = true; }
      if (fleeing) notice(S, 'enemy', '적 ' + u.army.name + '가 후퇴합니다.');
    }
  }
}
function hurt(S, from, t, dmg) {
  if (!live(t) || dmg <= 0) return;
  const tier = from && from.team !== t.team ? matchup(from.category, t.category) : 0;
  if (from && from.team !== t.team) dmg *= classMultiplier(from.category, t.category);
  t.hp -= dmg; t.flash = 0.12; t.lastHurt = S.t;
  t.hitState = tier; t.hitDuration = tier > 0 ? 0.24 : tier < 0 ? 0.48 : 0.35; t.hitT = t.hitDuration;
  t.hitMag = clamp(dmg / (t.maxHp * 0.06), 0.5, 1.6) * (tier > 0 ? 0.65 : tier < 0 ? 1.35 : 1); t.hitAng = from && from !== t ? Math.atan2(t.y - from.y, t.x - from.x) : cur.rnd() * 6.283;
  S.fx.push({ kind: tier > 0 ? 'guard' : 'spark', x: t.x, y: t.y - t.r * 1.6, ang: t.hitAng, col: tier < 0 ? '#ff654d' : tier > 0 ? '#75d8ff' : '#fff3c0', count: tier < 0 ? 10 : 6, t: 0.24, max: 0.24 });
  if (tier) text(S, t.x, t.y - t.r * 4, tier > 0 ? '상성 방어' : '상성 불리', tier > 0 ? '#75d8ff' : '#ff654d', 'buff');
  if (t.isLeader || dmg >= 18) text(S, t.x, t.y - t.r * 4, Math.round(dmg), tier < 0 ? '#ff9a32' : tier > 0 ? '#999999' : '#ffffff', 'dmg');
  if (t.hp <= 0) die(S, t, from);
}
function aoe(S, from, x, y, r, fn, col, friendly = false) {   // friendly: 시전자를 뺀 같은 편도 맞는다 (번개)
  ring(S, x, y, r, col, 0.45);
  for (const e of S.units) if (live(e) && e !== from && (friendly || e.team !== from.team) && Math.hypot(e.x - x, e.y - y) <= r + e.r) fn(e);
}
function arrowHit(S, p, t) {   // 방패: 정면 화살은 정지 중 항상, 이동 중 35% 막는다. 회피: 기마는 낮다 (퍼스트퀸4 의 화살 규칙)
  if (t.shield && Math.cos(t.face - p.a - Math.PI) > 0.2 && (!t.moving || S.rnd() < 0.35)) { text(S, t.x, t.y - t.r * 4, '방어', '#9aa7b8', 'buff'); ring(S, t.x, t.y, 14, '#cfd3e6', 0.2); return; }
  if (S.rnd() < t.aa / 100) { text(S, t.x, t.y - t.r * 4, '회피', '#cfd3e6', 'buff'); return; }
  hurt(S, p.from, t, Math.max(1, mitigate(p.atk * (0.85 + S.rnd() * 0.3), t.ad * ftDef(t))) * DMG);
}
function shoot(S, u, tx, ty, mul = 1, spread = 0) {
  const a = Math.atan2(ty - u.y, tx - u.x) + spread;
  S.proj.push({ kind: 'arrow', x: u.x, y: u.y - u.r * 1.4, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, left: u.range * 1.25, atk: u.atk * mul * ftMul(u), from: u, team: u.team, a });
}
function attack(S, u, t) {
  u.face = Math.atan2(t.y - u.y, t.x - u.x);
  if (u.cls === 'mage') { if (!castSpell(S, u, u.spells[0], t.x, t.y)) u.cdT = 0.5; return; }   // 법사의 평타 = 장풍 (MP 소모)
  u.cdT = u.cd; u.anim = 0.28; tire(u, 'hit');
  if (u.range > 0) shoot(S, u, t.x, t.y); else hurt(S, u, t, phys(u, t));
}

// ---------- 마법·특수기 ----------
function castSpell(S, u, key, x, y) {
  const sp = SPELL[key]; if (!sp || !live(u) || !u.spells.includes(key) || u.mp < sp.mp || u.cdT > 0 || u.stun > 0 || S.lock[u.team] > 0) return false;
  const ang = Math.atan2(y - u.y, x - u.x), d = Math.min(sp.range, Math.hypot(x - u.x, y - u.y)), px = u.x + Math.cos(ang) * d, py = u.y + Math.sin(ang) * d;
  const shot = o => S.proj.push({ x: u.x, y: u.y - u.r * 1.4, from: u, team: u.team, a: ang, sp: key, col: sp.col, ...o });
  if (sp.kind === 'heal') {
    let t = null, bd = 1e9; for (const e of S.units) if (live(e) && e.team === u.team && e.hp < e.maxHp && Math.hypot(e.x - x, e.y - y) < 60 && dist(e, u) <= sp.range) { const r = e.hp / e.maxHp; if (r < bd) { bd = r; t = e; } }
    if (!t) return false;
    const heal = Math.round((70 + u.lv * 5) * HP_MUL); t.hp = Math.min(t.maxHp, t.hp + heal); text(S, t.x, t.y - t.r * 4, '+' + heal, '#7dff9a', 'buff'); ring(S, t.x, t.y, 24, '#7dff9a', 0.4);
  } else if (sp.kind === 'homing') {   // 장풍: 가까운 적을 쫓아간다 (조준한 곳 가까이에 적이 없으면 직진)
    let tgt = null, bd = 80; for (const e of S.units) if (live(e) && e.team !== u.team) { const dd = Math.hypot(e.x - x, e.y - y); if (dd < bd) { bd = dd; tgt = e; } }
    shot({ kind: 'homing', vx: Math.cos(ang) * 420, vy: Math.sin(ang) * 420, left: sp.range * 1.5, tgt });
  } else if (sp.kind === 'pierce') shot({ kind: 'pierce', vx: Math.cos(ang) * 460, vy: Math.sin(ang) * 460, left: sp.range * 1.25, hit: new Set() });   // 불새·얼음칼날·회오리바람: 관통
  else if (sp.kind === 'roll') shot({ kind: 'roll', vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260, left: sp.range * 1.2 });   // 불공: 땅을 구르다 처음 맞은 적에서 터진다
  else if (sp.kind === 'ball') shot({ kind: 'ball', tx: px, ty: py, vx: Math.cos(ang) * 380, vy: Math.sin(ang) * 380 });   // 불꽃탄: 날아가 범위 폭발
  else if (sp.kind === 'wide') {   // 번개: 넓은 범위, 시전자 외 같은 편도 맞는다
    ring(S, px, py, sp.r, 'rgba(255,240,120,.7)', 0.6);
    S.later.push({ t: 0.5, fn: () => aoe(S, u, px, py, sp.r, e => hurt(S, u, e, magicDmg(sp, e)), sp.col, true) });
  } else if (sp.kind === 'quake') {   // 지진: 시전자 주위, 약한 피해, 아군은 안 맞는다
    ring(S, u.x, u.y, sp.r, 'rgba(201,165,106,.8)', 0.7);
    S.later.push({ t: 0.3, fn: () => aoe(S, u, u.x, u.y, sp.r, e => hurt(S, u, e, magicDmg(sp, e)), sp.col) });
  } else if (sp.kind === 'web') {   // 거미줄: 범위 안 적이 한동안 움직이지 못한다
    ring(S, px, py, sp.r, 'rgba(232,232,232,.8)', 0.5);
    aoe(S, u, px, py, sp.r, e => { e.root = sp.root; e.path = null; text(S, e.x, e.y - e.r * 4, '속박', '#e8e8e8', 'buff'); }, sp.col);
  }
  if (sp.lock) S.lock[u.team] = sp.lock;   // 전체 쿨 마법
  u.mp -= sp.mp; u.cdT = sp.cd; u.anim = 0.4; u.face = ang; tire(u, 'spell');
  return true;
}
function useSpecial(S, u, x, y) {
  if (!live(u) || !u.special || u.spT > 0 || u.stun > 0 || u.dashQ) return false;
  cur = S; const ang = Math.atan2(y - u.y, x - u.x), sp = SPECIAL[u.special];
  if (u.special === 'spin') aoe(S, u, u.x, u.y, 80, e => hurt(S, u, e, phys(u, e, 2.2)), '#ffd34d');
  else if (u.special === 'dash') {   // 돌진: 바라보는 8방향 직선으로 최대 6칸, 빈 칸까지만 질주한 뒤 충격
    const dx = Math.round(Math.cos(ang)), dy = Math.round(Math.sin(ang)), q = []; let cx = u.tx, cy = u.ty;
    if ((!dx && !dy) || u.mv) return false;
    while (q.length < 6) { const nx = cx + dx, ny = cy + dy; if (!okTile(S, nx, ny) || S.occ[ti(nx, ny)] || !diagOk(S, cx, cy, dx, dy)) break; q.push({ tx: nx, ty: ny }); cx = nx; cy = ny; }
    if (!q.length) return false;
    u.dashQ = q; ring(S, u.x, u.y, 30, '#7fd0ff', 0.3);
  }
  else if (u.special === 'volley') for (let k = -2; k <= 2; k++) shoot(S, u, x, y, 1.3, k * 0.13);
  else if (u.special === 'bless') { for (const e of S.units) if (live(e) && e.team === u.team && dist(e, u) <= 150) { const h = Math.round(e.maxHp * 0.3); e.hp = Math.min(e.maxHp, e.hp + h); e.ft = Math.max(0, e.ft - 20); text(S, e.x, e.y - e.r * 4, '+' + h, '#7dff9a', 'buff'); } ring(S, u.x, u.y, 150, '#7dff9a', 0.6); }
  u.spT = sp.cd; u.anim = 0.4; u.face = ang; tire(u, 'special');
  return true;
}

// ---------- 이동 (한 칸 = 한 명) ----------
const stepDur = (S, u, nx, ny) => TILE * (nx !== u.tx && ny !== u.ty ? 1.414 : 1) / (u.sp * tileMul(S, nx, ny) * ftMul(u));
const isBack = x => x.range > 0 || x.cls === 'cleric';   // 후열: 궁병·법사·성직
function canSwap(S, u, n) {   // 가만히 서 있는(이동·공격·돌진 중이 아니고 적과 맞붙지도 않은) 같은 편이 그 칸에 있으면 자리를 맞바꿔 지나갈 수 있다
  const o = n && S.units[S.occ[ti(n.tx, n.ty)] - 1];
  return o && o !== u && o.team === u.team && live(o) && (o !== o.army.ctrl || S.auto) && !(isBack(u) && !isBack(o) && u.order.type !== 'retreat' && u.order.type !== 'flee') &&   // 플레이어가 조작하는 캐릭터는 AI 가 밀지 못한다
     !o.mv && !o.dashQ && o.anim <= 0 && o.stun <= 0 && !S.units.some(e => live(e) && e.team !== o.team && cheb(o, e) <= 1) && diagOk(S, u.tx, u.ty, n.tx - u.tx, n.ty - u.ty) ? o : null;
}
function beginSwap(S, a, b) {   // 두 유닛이 서로의 칸으로 동시에 이동 (점유표는 도착할 때 한꺼번에 갱신) → 어느 순간에도 한 칸에 둘이 멈춰 있지 않다
  const dur = Math.max(stepDur(S, a, b.tx, b.ty), stepDur(S, b, a.tx, a.ty));
  a.mv = { fx: a.x, fy: a.y, nx: b.tx, ny: b.ty, t: 0, dur, swap: b }; b.mv = { fx: b.x, fy: b.y, nx: a.tx, ny: a.ty, t: 0, dur, swap: a };
  a.face = Math.atan2(b.ty - a.ty, b.tx - a.tx); b.face = a.face + Math.PI; a.stuck = 0; tire(a, 'step'); tire(b, 'step');
}
function beginStep(S, u, nx, ny, dur) {   // 다음 칸을 즉시 점유하고, 출발 칸은 도착할 때까지 유지 → 두 칸을 오가는 동안에도 겹치지 않는다
  u.mv = { fx: u.x, fy: u.y, nx, ny, t: 0, dur: dur || stepDur(S, u, nx, ny) };
  S.occ[ti(nx, ny)] = u.id; u.face = Math.atan2(ny - u.ty, nx - u.tx); u.stuck = 0; tire(u, 'step');
}
function advanceMove(S, u, dt) {
  const m = u.mv; m.t += dt; const p = Math.min(1, m.t / m.dur); u.moving = true;
  u.x = m.fx + (tcx(m.nx) - m.fx) * p; u.y = m.fy + (tcy(m.ny) - m.fy) * p;
  if (p >= 1) {
    const fin = x => { const mm = x.mv; if (!mm.swap && S.occ[ti(x.tx, x.ty)] === x.id) S.occ[ti(x.tx, x.ty)] = 0; x.tx = mm.nx; x.ty = mm.ny; x.mv = null; if (mm.swap) S.occ[ti(x.tx, x.ty)] = x.id; x.x = tcx(x.tx); x.y = tcy(x.ty); };
    const o = m.swap; fin(u); if (o && o.mv && o.mv.swap === u) fin(o);   // 맞바꾸기는 둘이 함께 끝난다
  }
}
function sidestep(S, u, gx, gy) {   // 앞이 막혔을 때: 목표에 더 가까워지는 빈 인접 칸, 오래 막혔으면 아무 빈 칸
  let best = null, bd = u.stuck > 1.5 ? 1e9 : Math.hypot(u.tx - gx, u.ty - gy);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = u.tx + dx, ny = u.ty + dy; if ((!dx && !dy) || !okTile(S, nx, ny) || S.occ[ti(nx, ny)] || !diagOk(S, u.tx, u.ty, dx, dy)) continue;
    const d = Math.hypot(nx - gx, ny - gy) + (u.stuck > 1.5 ? cur.rnd() * 2 : 0); if (d < bd) { bd = d; best = { tx: nx, ty: ny }; }
  }
  return best;
}
function stepToward(S, u, gx, gy) {   // 목표 칸 쪽으로 한 칸 내딛는다 → 'arrived' | 'moving' | 'blocked'
  if (u.tx === gx && u.ty === gy) return 'arrived';
  if (u.waitT > 0 || u.root > 0) return 'blocked';
  const gk = ti(gx, gy), free = n => n && (S.occ[ti(n.tx, n.ty)] === 0 || !!canSwap(S, u, n));
  let nxt = u.pathGoal === gk && u.path && u.path[0] || null;
  if (!free(nxt)) {
    if (u.repathT > 0 && u.stuck < 1.5) { u.path = null; nxt = null; }   // 재탐색 간격 0.3초 (오래 막혔으면 무시)
    else {
      u.repathT = 0.3; u.path = astar(S, u, gx, gy, true); u.pathGoal = gk; nxt = u.path && u.path[0];
      if (!free(nxt)) {   // 부분 경로를 받았으면 dyn=false 재탐색은 건너뛴다
        if (!(u.path && u.path.partial)) { const sp = astar(S, u, gx, gy, false), want = sp && sp[0]; nxt = free(want) ? want : null; }
        if (!free(nxt)) nxt = sidestep(S, u, gx, gy); u.path = null;   // 부분 경로의 첫 칸이 막혀 있어도 그대로 밟지 않는다
      }
    }
  }
  if (!nxt) { u.waitT = 0.05 + cur.rnd() * 0.05; u.stuck += u.waitT; return 'blocked'; }
  if (u.path && u.path[0] === nxt) u.path.shift();
  const ally = S.occ[ti(nxt.tx, nxt.ty)] ? canSwap(S, u, nxt) : null;
  if (ally) beginSwap(S, u, ally); else beginStep(S, u, nxt.tx, nxt.ty);
  return 'moving';
}
function leave(S, u) {   // 후퇴(아군: 출발 시점에 가까운 가장자리로 철수, 쪽은 고정 / 적: 오른쪽 가장자리 도주) — 도착하면 필드에서 사라진다
  if (u.team === 'player' && !u.order.side) u.order.side = u.tx < MW / 2 ? -1 : 1;   // 쪽은 명령 객체에 저장 → 새 명령이면 다시 정한다
  const side = u.order.side;   // 되돌리려면 이 줄을 -1 고정으로
  const gx = u.team === 'player' ? (side < 0 ? 1 : MW - 2) : MW - 2;
  if (u.team === 'player' ? (side < 0 ? u.tx <= 1 : u.tx >= MW - 2) : u.tx >= MW - 2) {
    release(S, u); u.out = true; u.moving = false;
    if (u.team === 'player') { u.hp = u.maxHp; u.mp = u.maxMp; u.ft = 0; u.order = { type: 'idle' }; text(S, u.x, u.y, u.name + ' 철수', '#cfd3e6'); } else { u.fled = true; S.stats.fled++; }
    return;
  }
  stepToward(S, u, gx, u.ty);
}

// ---------- 유닛 AI ----------
const SIGHT = 6.5 * TILE;
function nearestEnemy(S, u, maxD) {
  let best = null, bd = maxD;
  for (const e of S.units) { if (!live(e) || e.team === u.team) continue; const d = Math.hypot(e.x - u.x, e.y - u.y); if (d < bd) { bd = d; best = e; } }
  return best;
}
function inReach(u, t) { return u.range > 0 ? Math.hypot((u.tx - t.tx) * TILE, (u.ty - t.ty) * TILE) <= u.range : cheb(u, t) <= 1; }   // 근접 = 인접한 8칸
function engage(S, u, t, canMove) {
  if (inReach(u, t)) { u.claim = -1; u.face = Math.atan2(t.y - u.y, t.x - u.x); if (u.cdT <= 0) attack(S, u, t); return; }
  if (!canMove) return;
  if (u.range > 0) { stepToward(S, u, t.tx, t.ty); return; }
  const k = freeAdj(S, u, t);   // 근접: 적에게 인접한 빈 칸을 목표로 (다른 유닛이 잡은 칸 제외)
  if (k >= 0) stepToward(S, u, k % MW, k / MW | 0); else if (cheb(u, t) > 2) stepToward(S, u, t.tx, t.ty);
}
function freeAdj(S, u, t) {
  const ok = k => { const x = k % MW, y = k / MW | 0; return cheb({ tx: x, ty: y }, t) === 1 && okTile(S, x, y) && (!S.occ[k] || S.occ[k] === u.id) && !S.units.some(v => v !== u && v.claim === k && v.claimT > S.t - 1 && live(v)); };
  if (u.claim >= 0 && ok(u.claim)) { u.claimT = S.t; return u.claim; }
  let best = -1, bd = 1e9;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue; const x = t.tx + dx, y = t.ty + dy; if (!inMap(x, y)) continue;
    const k = ti(x, y), d = Math.hypot(x - u.tx, y - u.ty); if (d < bd && ok(k)) { bd = d; best = k; }
  }
  u.claimT = S.t; return u.claim = best;
}
function setFormation(A, type) {
  if (!FORMATION_NAME[type]) return false; A.formation = type;
  const sgn = A.team === 'player' ? 1 : -1, mid = Math.floor((A.units.length - 1) / 2);
  A.units.forEach((u, i) => {
    if (type === 'line') u.slot = { dx: 0, dy: i - mid };
    else if (type === 'wedge') { const row = Math.ceil(i / 2); u.slot = { dx: -sgn * row, dy: i ? (i % 2 ? -row : row) : 0 }; }
    else u.slot = { dx: -sgn * Math.floor(i / 4), dy: (i % 4) - 1 };
    u.path = null;
  });
  return true;
}
// 대형: 슬롯 = 앵커 칸 + (자기 슬롯 - 앵커 슬롯). 앵커: 아군 = 조작 캐릭터, 적 = 대장(없으면 가장 전방 슬롯)
function anchorOf(A) {
  if (A.team === 'player') return A.ctrl && live(A.ctrl) ? A.ctrl : null;
  if (A.leader && live(A.leader)) return A.leader;
  let b = null; for (const v of A.units) if (live(v) && (!b || v.slot.dx < b.slot.dx)) b = v; return b;
}
function homeOf(S, u) {
  const a = anchorOf(u.army); if (!a || a === u) return null;
  return { tx: clamp(a.tx + u.slot.dx - a.slot.dx, 0, MW - 1), ty: clamp(a.ty + u.slot.dy - a.slot.dy, 0, MH - 1) };
}
const LEASH = 7, GATHER = 0.6;   // 슬롯에서 추격 한계(칸) / 대장 전진에 필요한 대장 4칸 이내 구성원 비율 (설계값)
function formation(S, u, t) {   // 시야 안 적은 슬롯 7칸 이내일 때만 추격, 아니면 슬롯 복귀
  const h = homeOf(S, u);
  if (t && (!h || cheb(u, h) < LEASH)) { engage(S, u, t, true); return; }
  if (h && cheb(u, h) > 1) stepToward(S, u, h.tx, h.ty);
}
function advanceUnit(S, u) {   // 적 군단 진격: 대장이 전진, 나머지는 슬롯 (대장은 구성원 60% 가 4칸 안일 때만)
  const t = nearestEnemy(S, u, Math.max(SIGHT, u.range));
  if (u !== anchorOf(u.army)) return formation(S, u, t);
  if (t) return engage(S, u, t, true);
  const m = u.army.units.filter(live); if (m.filter(v => cheb(v, u) <= 4).length < m.length * GATHER) return;
  const n = nearestEnemy(S, u, 1e9); if (n) engage(S, u, n, true);
}
function autoAbilities(S, u, aggressive) {   // 성직자 치유 / 법사 광역 마법 / 특수기 자동 사용 — 썼으면 true
  if (u.cdT > 0 || u.stun > 0) return false;
  if (u.spells.includes('heal')) {
    let t = null, bd = 0.7; for (const e of S.units) if (live(e) && e.team === u.team && e.hp / e.maxHp < bd && dist(u, e) <= SPELL.heal.range) { bd = e.hp / e.maxHp; t = e; }
    if (t && castSpell(S, u, 'heal', t.x, t.y)) return true;
  }
  if (u.cls === 'mage' && aggressive && !S.units.some(e => live(e) && e.team !== u.team && cheb(u, e) <= 1)) {   // 근접 교전 중에는 자동으로 마법을 쓰지 않는다 (원작). 평타(장풍)는 그대로
    const t = nearestEnemy(S, u, 260); if (!t) return false;
    const cnt = (x, y, r, own) => { let c = 0; for (const e of S.units) if (live(e) && e !== u && (own ? e.team === u.team : e.team !== u.team) && Math.hypot(e.x - x, e.y - y) <= r + e.r) c++; return c; };
    const cast = (k, x, y) => { if (!u.spells.includes(k)) return false; if (SPELL[k].lock && S.lockAI[u.team] > 0) return false; const ok = castSpell(S, u, k, x, y); if (ok && SPELL[k].lock) S.lockAI[u.team] = AI_LOCK_GAP; return ok; };
    if (cnt(t.x, t.y, SPELL.thunder.r, false) >= 4 && !cnt(t.x, t.y, SPELL.thunder.r, true) && cast('thunder', t.x, t.y)) return true;   // 번개는 아군이 없을 때만
    if (cnt(u.x, u.y, SPELL.quake.r, false) >= 5 && cast('quake', u.x, u.y)) return true;
    if (cnt(t.x, t.y, SPELL.web.r, false) >= 3 && cast('web', t.x, t.y)) return true;
    if (cnt(t.x, t.y, SPELL.fireball.r, false) >= 2 && cast('fireball', t.x, t.y)) return true;
    if (S.rnd() < 0.35) for (const k of ['phoenix', 'ice', 'tornado', 'roll']) if (cast(k, t.x, t.y)) return true;   // 원작 AI 는 마법을 무작위로 쓴다
  }
  if (u.special && u.spT <= 0 && aggressive) {
    if (u.special === 'bless') { let n = 0; for (const e of S.units) if (live(e) && e.team === u.team && e.hp < e.maxHp * 0.6 && dist(u, e) <= 150) n++; if (n >= 3 && useSpecial(S, u, u.x, u.y)) return true; }
    else { const t = nearestEnemy(S, u, u.special === 'volley' ? u.range : u.special === 'dash' ? 200 : 70); if (t && useSpecial(S, u, t.x, t.y)) return true; }
  }
  return false;
}
function updateUnit(S, u, dt) {
  u.cdT -= dt; u.spT -= dt; u.root -= dt; u.hitT -= dt; u.flash -= dt; u.anim -= dt; u.waitT -= dt; u.repathT -= dt; u.thinkT -= dt; u.moving = false;
  if (!u.mv && !u.dashQ && u.anim <= 0 && u.hitT <= 0 && S.t - u.lastHurt > 3 && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * u.hr * 0.001 * dt);   // HR: 서 있는 동안 체력이 조금씩 찬다
  if (u.maxMp && u.mp < u.maxMp) u.mp = Math.min(u.maxMp, u.mp + 0.6 * dt);
  u.ft = Math.max(0, u.ft - FT.recover * FT.eff * dt);
  if (u.stun > 0) { u.stun -= dt; return; }
  if (u.mv) { advanceMove(S, u, dt); if (u.mv) return; }   // 한 칸을 걷는 동안에는 다른 행동을 하지 않는다. 칸에 도착하면 같은 틱에 다음 입력·행동을 이어서 처리 (끊김 없이)
  if (u.dashQ) {
    const n = u.dashQ.shift();
    if (n && !S.occ[ti(n.tx, n.ty)]) { beginStep(S, u, n.tx, n.ty, 0.06); advanceMove(S, u, 0); return; }
    u.dashQ = null; aoe(S, u, u.x, u.y, 60, e => hurt(S, u, e, phys(u, e, 2)), '#7fd0ff'); return;
  }
  let o = u.order;
  if (o.type === 'retreat' || o.type === 'flee') return leave(S, u);
  const ctrl = u === u.army.ctrl && u.team === 'player';
  if (ctrl && !S.auto && u.ctrlIn && S.t - u.ctrlIn.t < 0.12) { directMove(S, u, u.ctrlIn.dx, u.ctrlIn.dy); return; }   // 조작 캐릭터: 방향 입력이 있으면 그 칸으로 (적이 있으면 밀어붙여 공격)
  if (ctrl && S.auto && o.type === 'stop') o = u.order = { type: 'idle' };   // 자동 전투 중에는 조작 캐릭터도 AI 가 움직인다
  if (o.type === 'charge' && u.autoCharge && !S.auto) o = u.order = { type: ctrl ? 'stop' : 'idle' };   // 자동전투를 끄면 자동으로 돌격 중이던 유닛은 평상시로
  if (o.type === 'idle' && ((S.auto && u.team === 'player') || u.army.state === 'advance')) { o = u.order = { type: 'charge' }; u.autoCharge = u.team === 'player'; }
  const aggressive = u.team === 'enemy' || S.auto || o.type === 'charge';
  if (autoAbilities(S, u, aggressive)) return;
  if (u.cls === 'cleric') {   // 성직자는 직접 싸우지 않고, 정지·고정이 아니면(자유·돌격·자동) 조작 캐릭터(없으면 대장) 곁을 따라다닌다
    if (o.type !== 'stop') { const c = u.army.ctrl, a = c && c !== u && live(c) ? c : u.army.leader; if (a && a !== u && live(a) && cheb(u, a) > 2) stepToward(S, u, a.tx, a.ty); }
    return;
  }
  if (o.type === 'attack') { if (!o.target || !live(o.target)) { u.order = { type: 'idle' }; return; } engage(S, u, o.target, true); return; }
  if (o.type === 'charge' && u.team === 'enemy' && u.army.state === 'advance') return advanceUnit(S, u);
  if (o.type === 'charge') {
    if (!o.tgt || !live(o.tgt) || u.thinkT <= 0) { const n = nearestEnemy(S, u, 1e9); if (!o.tgt || !live(o.tgt) || (n && dist(u, n) < dist(u, o.tgt) * 0.7)) o.tgt = n; u.thinkT = 0.5; }
    if (o.tgt) engage(S, u, o.tgt, true); return;
  }
  if (o.type === 'stop') { const t = nearestEnemy(S, u, u.range > 0 ? u.range : TILE * 1.5); if (t) engage(S, u, t, false); return; }   // 제자리에서 사거리 안의 적만 친다
  formation(S, u, nearestEnemy(S, u, Math.max(SIGHT, u.range)));   // idle: 시야 안의 적과 싸우고, 적이 없거나 너무 멀어지면 대형 복귀
}

// ---------- 투사체 ----------
function updateProj(S, dt) {
  for (const p of S.proj) {
    if (p.kind === 'homing' && p.tgt && live(p.tgt)) { const a = Math.atan2(p.tgt.y - p.tgt.r * 1.4 - p.y, p.tgt.x - p.x), v = Math.hypot(p.vx, p.vy); p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v; p.a = a; }
    const sx = p.vx * dt, sy = p.vy * dt, st = Math.hypot(sx, sy), sp = p.sp && SPELL[p.sp];
    if (p.kind === 'ball') { if (Math.hypot(p.tx - p.x, p.ty - p.y) <= st + 2) { p.done = true; aoe(S, p.from, p.tx, p.ty, sp.r, e => hurt(S, p.from, e, magicDmg(sp, e)), sp.col); continue; } }
    else { p.left -= st; if (p.left <= 0) { p.done = true; continue; } }
    p.x += sx; p.y += sy;
    if (p.kind === 'ball') continue;
    if (S.map[tileOf(p.x, p.y + 12)] === ROCK) { p.done = true; continue; }   // 바위는 화살·마법을 막는다
    for (const e of S.units) {
      if (!live(e) || e.team === p.team || (p.hit && p.hit.has(e))) continue;
      if (Math.hypot(e.x - p.x, e.y - e.r * 1.4 - p.y) < e.r + 4) {
        if (p.kind === 'arrow') { arrowHit(S, p, e); p.done = true; break; }
        if (p.kind === 'pierce') { p.hit.add(e); hurt(S, p.from, e, magicDmg(sp, e)); continue; }   // 관통
        p.done = true;   // 장풍·불공: 맞은 적에서 끝 (불공은 작은 폭발)
        if (p.kind === 'roll') aoe(S, p.from, e.x, e.y, sp.r, t => hurt(S, p.from, t, magicDmg(sp, t)), sp.col); else hurt(S, p.from, e, magicDmg(sp, e));
        break;
      }
    }
  }
  S.proj = S.proj.filter(p => !p.done);
}

// ---------- 적 군단 AI / 종료 판정 ----------
function enemyAI(S) {
  let field = S.units.filter(u => u.team === 'enemy' && live(u)).length;
  for (const A of S.armies) if (A.team === 'enemy' && A.state === 'reserve') {
    const ready = A.units.filter(u => !u.dead && !u.fled).length; if (!ready || field + ready > ENEMY_FIELD_MAX) continue;
    field += deployArmy(S, A);
  }
  for (const A of S.armies) {
    if (A.team !== 'enemy' || A.state !== 'wait') continue;
    const tr = A.trig, ref = A.leader || A.units.find(live);
    let go = S.t >= tr.t || (tr.after != null && S.armies[tr.after].routed) || A.units.some(u => live(u) && u.hp < u.maxHp);
    if (!go && ref) for (const e of S.units) if (live(e) && e.team === 'player' && dist(ref, e) < tr.near * TILE) { go = true; break; }
    if (go) { A.state = 'advance'; notice(S, 'enemy', '적 ' + A.name + '가 참전했습니다.'); if (ref) text(S, ref.x, ref.y - 70, A.name + ' 진격!', '#ff5a4a'); }
  }
}
function commanderDialogue(S) {
  for (const A of S.armies) {
    const e = A.team === 'enemy' && A.state === 'advance' && A.leader && live(A.leader) ? A.leader : null; if (!e || S.talked.has(A.id)) continue;
    let p = null, bd = 7 * TILE; for (const P of S.armies) { const l = P.team === 'player' && P.leader && live(P.leader) ? P.leader : null; if (l && dist(e, l) < bd) { bd = dist(e, l); p = l; } }
    if (p) { S.talked.add(A.id); dialogue(S, e, p.name + ', 여기서 승부를 내자!'); dialogue(S, p, '좋다. 정면으로 받아주마!'); }
  }
}
function checkEnd(S) {
  const lord = S.armies.find(A => A.team === 'player' && A.units.length)?.leader;
  if (!lord || lord.dead || !S.units.some(u => u.team === 'player' && !u.dead)) S.over = 'lose';
  else if (!S.units.some(u => u.team === 'enemy' && !u.dead && !u.fled)) S.over = 'win';
}
function step(S, dt) {
  if (S.over) return;
  cur = S; S.t += dt; enemyAI(S); commanderDialogue(S);
  for (const k of ['player', 'enemy']) { if (S.lock[k] > 0) S.lock[k] -= dt; if (S.lockAI[k] > 0) S.lockAI[k] -= dt; }
  for (const A of S.armies) if (A.team === 'player' && (!A.ctrl || !live(A.ctrl))) setCtrl(S, A, A.units.find(live));   // 조작 캐릭터가 쓰러지거나 철수하면 다음 캐릭터로
  const order = S.units.filter(live); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(S.rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  for (const u of order) if (live(u)) updateUnit(S, u, dt);   // 처리 순서를 매 틱 섞는다 (먼저 만든 군단이 빈 칸을 독점하지 않게)
  updateProj(S, dt);
  for (const l of S.later) { l.t -= dt; if (l.t <= 0) l.fn(); } S.later = S.later.filter(l => l.t > 0);
  for (const f of S.fx) f.t -= dt; S.fx = S.fx.filter(f => f.t > 0);
  for (const x of S.texts) { x.t -= dt; x.y -= 22 * dt; } S.texts = S.texts.filter(x => x.t > 0);
  checkEnd(S);
}

// ---------- 명령 (UI → 시뮬레이션) ----------
const mine = units => units.filter(u => live(u) && u.team === 'player');
// 퍼스트퀸4 조작: 군단마다 "조작 캐릭터" 한 명을 직접 움직이고(방향 입력 = 한 칸 이동, 적이 있는 칸으로 밀면 공격), 나머지는 AI + 군단 명령(돌격·정지·후퇴·자유)
function setCtrl(S, A, u) {
  if (!u || !live(u) || A.ctrl === u) return;
  const old = A.ctrl; A.ctrl = u; if (u.order.type !== 'retreat') u.order = { type: 'stop' };   // 후퇴 중인 캐릭터가 조작 캐릭터가 되어도 후퇴 명령은 유지 u.ctrlIn = null; u.autoCharge = false; u.path = null;
  if (old && live(old) && old.order.type !== 'retreat') { old.order = { type: A.order }; old.ctrlIn = null; }   // 풀려난 캐릭터는 군단 명령을 따른다
}
function control(S, u, dx, dy) { u.ctrlIn = { dx, dy, t: S.t }; }   // 방향 입력 (누르고 있는 동안 매 프레임 호출)
function directMove(S, u, dx, dy) {
  if (u.root > 0) return;   // 속박(거미줄) 중에는 걷지 못한다
  const nx = u.tx + dx, ny = u.ty + dy; u.face = Math.atan2(dy, dx);
  const eid = inMap(nx, ny) ? S.occ[ti(nx, ny)] : 0, e = eid && S.units.find(x => x.id === eid);
  if (e && e.team !== u.team) { if (u.cdT <= 0 && diagOk(S, u.tx, u.ty, dx, dy)) { cur = S; u.cdT = u.cd; u.anim = 0.28; tire(u, 'hit'); hurt(S, u, e, phys(u, e, u.range > 0 ? 0.5 : 1)); } return; }   // 밀어붙이기 = 공격 (원거리 병종은 약하게)
  if (e && e.team === u.team) { if (canSwap(S, u, { tx: nx, ty: ny })) beginSwap(S, u, e); return; }   // 아군은 자리를 맞바꿔 지나간다
  if (okTile(S, nx, ny) && !eid && diagOk(S, u.tx, u.ty, dx, dy)) beginStep(S, u, nx, ny);
}
function aimAt(S, u, range) {   // 바라보는 방향 ±55° 안의 가장 가까운 적, 없으면 정면 150px
  let best = null, bd = range;
  for (const e of S.units) { if (!live(e) || e.team === u.team) continue; const d = dist(u, e), a = Math.atan2(e.y - u.y, e.x - u.x); if (d < bd && Math.cos(a - u.face) > 0.57) { bd = d; best = e; } }
  return best ? [best.x, best.y] : [u.x + Math.cos(u.face) * 150, u.y + Math.sin(u.face) * 150];
}
function action(S, u, alt) {   // Space(주): 마법 > 특수기 > 화살 / X(보조): 마법 보유자는 특수기, 그 밖은 화살
  if (!live(u) || u.stun > 0) return false; cur = S;
  const sel = !alt && u.spells.length, sp = sel ? u.spells[u.spellSel] : null;
  if (sp === 'heal') { let t = null, bd = 1; for (const e of S.units) if (live(e) && e.team === u.team && e.hp / e.maxHp < bd && dist(u, e) <= SPELL.heal.range) { bd = e.hp / e.maxHp; t = e; } return t ? castSpell(S, u, 'heal', t.x, t.y) : false; }
  if (sp) { const [x, y] = aimAt(S, u, SPELL[sp].range); return castSpell(S, u, sp, x, y); }
  if (u.special && (!alt || u.spells.length)) { const [x, y] = aimAt(S, u, u.special === 'volley' ? u.range : 150); return useSpecial(S, u, x, y); }
  if (u.range > 0 && u.cdT <= 0 && u.cls !== 'mage') { const [x, y] = aimAt(S, u, u.range); u.face = Math.atan2(y - u.y, x - u.x); u.cdT = u.cd; u.anim = 0.28; tire(u, 'hit'); shoot(S, u, x, y); return true; }
  return false;
}
function selectSpell(u, i) { if (u.spells[i]) u.spellSel = i; }
function armyOrder(S, A, type, directCtrl = A.ctrl) {   // 현재 직접 조작 중인 캐릭터만 제외 (후퇴는 전원)
  if (type === 'retreat' && A.order !== 'retreat') notice(S, A.team, (A.team === 'player' ? '아군 ' : '적 ') + A.name + '가 후퇴합니다.');
  A.order = type;
  for (const u of A.units) if (live(u) && (u !== directCtrl || type === 'retreat')) { u.order = { type }; u.path = null; u.autoCharge = false; }
}
function focus(S, A, target) { for (const u of A.units) if (live(u) && u !== A.ctrl && u.cls !== 'cleric') { u.order = { type: 'attack', target }; u.path = null; u.autoCharge = false; } }   // 적을 클릭 = 군단이 그 적에게 집중 공격
function recall(S, u, quiet = false, directCtrl = u.army.ctrl) {   // 철수한 유닛을 출진 지점(왼쪽)의 빈 칸에 다시 투입 — 체력은 철수할 때 이미 회복
  if (!u.out || u.fled || u.dead || u.team !== 'player') return false;
  for (let k = 0; k < 80; k++) {
    const tx = 3 + Math.floor(S.rnd() * 4), ty = 14 + Math.floor(S.rnd() * 14);
    if (okTile(S, tx, ty) && !S.occ[ti(tx, ty)]) { u.tx = tx; u.ty = ty; u.x = tcx(tx); u.y = tcy(ty); S.occ[ti(tx, ty)] = u.id; u.out = false; u.order = { type: u === directCtrl ? 'stop' : u.army.order }; u.path = null; text(S, u.x, u.y - 40, u.name + ' 출진', '#7dff9a'); if (!quiet) notice(S, 'player', '아군 ' + u.name + ' 참전!'); return true; }
  }
  return false;
}
function deployArmy(S, A, directCtrl = A.ctrl) {
  let count = 0;
  if (A.team === 'player') {
    for (const u of A.units) if (recall(S, u, true, directCtrl)) count++;
  } else {
    for (const u of A.units) {
      if (!u.out || u.dead || u.fled) continue;
      for (let k = 0; k < 120; k++) {
        const tx = MW - 4 - Math.floor(S.rnd() * 4), ty = 3 + Math.floor(S.rnd() * (MH - 6));
        if (!okTile(S, tx, ty) || S.occ[ti(tx, ty)]) continue;
        u.tx = tx; u.ty = ty; u.x = tcx(tx); u.y = tcy(ty); S.occ[ti(tx, ty)] = u.id; u.out = false; u.reserve = false; u.order = { type: 'charge' }; u.path = null; count++; break;
      }
    }
    if (count) { A.state = 'advance'; setFormation(A, A.formation); }
  }
  if (count) notice(S, A.team, (A.team === 'player' ? '아군 ' : '적 ') + A.name + '가 참전했습니다.');
  return count;
}
function unitAt(S, wx, wy, team) {   // 월드 좌표에서 (몸+머리 높이까지) 클릭된 유닛
  let best = null, bd = 1e9;
  for (const u of S.units) { if (!live(u) || (team && u.team !== team)) continue; const d = Math.hypot(u.x - wx, (u.y - u.r * 1.6) - wy); if (d < Math.max(u.r * 2.2, 24) && d < bd) { bd = d; best = u; } }
  return best;
}

return { CAPTAIN, ELITE, CLONES, stepToward, prof, TILE, MW, MH, WW, WH, U, CLS_NAME, CATEGORY_NAME, FORMATION_NAME, SPELL, SPECIAL, ARMIES, ARMY_MAX, SQUAD_MAX, matchup, classMultiplier, createBattle, step, setCtrl, setFormation, control, action, selectSpell, armyOrder, focus, castSpell, useSpecial, recall, deployArmy, unitAt, live, ti };
})();
if (typeof module !== 'undefined') module.exports = Sim;
