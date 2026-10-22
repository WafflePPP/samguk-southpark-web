'use strict';
// 퍼스트퀸4 식 실시간 전투 시뮬레이션 (DOM 없음 → node 에서도 돌려 테스트한다).
// 군단(최대 18명, 3개 분대)의 캐릭터를 하나씩 지휘한다: 이동·공격·돌격·정지·이동불가·후퇴·특수기·마법.
// 이동은 정사각형 타일 격자: 한 칸에는 한 명만 설 수 있고, 한 번에 한 칸씩(8방향) 걸어간다. 이동 중에는 출발·도착 두 칸을 모두 점유한다.
// 유닛은 명령이 없으면 시야 안의 적과 알아서 싸운다. 피로도·레벨업·방패 방어·번개 잠금·대장 전사 시 도주를 갖는다.
const Sim = (() => {
const TILE = 32, MW = 64, MH = 40, WW = MW * TILE, WH = MH * TILE;
const GRASS = 0, FOREST = 1, ROCK = 2, WATER = 3, ROAD = 4;
const SOLDIER_HP = 2.5;   // 일반 병사(generic) 최종 체력 ×5 — 장수는 그대로
const FRONTLINE_HP = 3.75; // 일반 보병·방패병 HP: v0.1.96 기준 50%
const SIZE = 0.6;   // 캐릭터 크기 배율 (몸·무기·체력바·피격 판정 반지름에 모두 적용)
const HP_MUL = 1.25;   // v0.1.115: 모든 장수·병사 체력을 v0.1.113 기준의 50%로 축소 (고정 회복량도 동일 비율)
const DMG = 0.32;   // 전체 피해 배율(전투 길이). 적도 아군과 같은 능력치 기준 — 난이도는 적 군단 구성(장수·병사 수)으로 맞춘다
const DEF_EFF = 1.3;   // 모든 장수·병사의 DF·AD·MD 방어 효율
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
  esword: { name: '적 보병', cls: 'warrior', hp: 120, atk: 20, df: 8, ad: 5, md: 4, aa: 12, hr: 5, sp: 180, cd: 1.0, r: 11, style: 'soldier', generic: true },
  eshield: { name: '적 방패', cls: 'shield', hp: 200, atk: 14, df: 14, ad: 14, md: 5, aa: 6, hr: 5, sp: 153, cd: 1.1, r: 12, style: 'shield', shield: true, generic: true },
  earcher: { name: '적 궁병', cls: 'archer', hp: 80, atk: 21, df: 4, ad: 3, md: 4, aa: 16, hr: 5, sp: 173, cd: 1.4, range: 250, r: 11, style: 'archer', generic: true },
  ecav: { name: '적 기마', cls: 'cavalry', hp: 160, atk: 26, df: 8, ad: 4, md: 4, aa: 4, hr: 5, sp: 270, cd: 0.9, r: 13, style: 'cav', generic: true },
  hua: { name: '화웅', cls: 'warrior', sp: 173, cd: 1.0, r: 14, aa: 10, hr: 10, style: 'hua', special: 'spin', fanatic: true },
  jang: { name: '장료', cls: 'cavalry', sp: 252, cd: 0.8, r: 15, aa: 14, hr: 10, style: 'jang', special: 'dash' },
  xun: { name: '순욱', cls: 'mage', mp: 999, sp: 166, cd: 1.4, range: 200, r: 12, aa: 18, hr: 8, style: 'xun', spells: ['bolt', 'phoenix', 'fireball', 'thunder'], fanatic: true },
  emage: { name: '적 법사', cls: 'mage', hp: 70, mp: 999, atk: 8, df: 2, ad: 2, md: 10, aa: 12, hr: 5, sp: 166, cd: 1.5, range: 190, r: 11, style: 'emage', spells: ['bolt', 'roll', 'tornado'], generic: true },
  esage: { name: '적 군사', cls: 'mage', mp: 999, aa: 18, hr: 8, sp: 166, hp: 300, atk: 30, df: 18, ad: 18, md: 30, cd: 1.4, range: 200, r: 12, style: 'emage', spells: ['bolt', 'phoenix', 'thunder', 'quake', 'web'], fanatic: true },
};
// 장수 등급. 일반 대장(적 장수·적 군사)은 병종별 기준 능력치 [hp, atk, df, ad, md]. 정예 장수는 같은 병종 일반 대장 × 배율 (2배 이상, 관우·여포 4배, 조운·황충·전위 3배 = 기본 2배 × 1.5, 초선·제갈량 2배).
const CAPTAIN = { warrior: [400, 64, 40, 24, 20], cavalry: [400, 70, 32, 20, 18], archer: [260, 68, 12, 12, 16], mage: [300, 30, 18, 18, 30], cleric: [400, 66, 30, 24, 24] };   // 군단장급 병사(= 가상 대장·적 장수·적 군사)
// 이름 있는 장수(삼국지 정사·연의 인물)의 등급 = 연의에서의 비중. 군단장급 병사(CAPTAIN) 능력치 × 등급 배율. 기획 명세 17.
const GRADE_MUL = { S: 4, A: 3, B: 2, C: 1.5, D: 1.25 };
const GRADE = { guan: 'S', lubu: 'S', zhao: 'A', dian: 'A', huang: 'A', jang: 'A', hua: 'A', zhangfei: 'A', machao: 'A', kong: 'S', diao: 'B', xun: 'B', xia: 'B', xuchu: 'B', liubei: 'B', pangtong: 'B', jiangwei: 'B', weiyan: 'B', chengong: 'B', lulingqi: 'S', yan: 'C', wen: 'C', cao: 'S', dong: 'C', sima: 'C', guo: 'C', gao: 'D', zhanghe: 'D', xuhuang: 'D', gong: 'D', yuan: 'D', lijue: 'D' };
const ELITE = Object.fromEntries(Object.entries(GRADE).map(([k, g]) => [k, GRADE_MUL[g]]));
ELITE.lulingqi = GRADE_MUL.S * 0.7;   // 여령기: 여포(S)의 70% 성능 (명세 26)
const STAT5 = ['hp', 'atk', 'df', 'ad', 'md'];
const CLONES = {
  yan: ['hua', '안량'], wen: ['hua', '문추'], gao: ['hua', '고순'], xia: ['hua', '하후돈'], guo: ['xun', '곽가'],
  gong: ['jang', '공손찬'], yuan: ['hua', '원소'], cao: ['hua', '조조'], dong: ['hua', '동탁'], zhanghe: ['hua', '장합'],
  xuhuang: ['hua', '서황'], xuchu: ['hua', '허저'], sima: ['xun', '사마의'], lijue: ['hua', '이각'],
  chengong: ['xun', '진궁'], lulingqi: ['jang', '여령기'], liubei: ['guan', '유비'], zhangfei: ['hua', '장비'],
  machao: ['jang', '마초'], pangtong: ['xun', '방통'], jiangwei: ['jang', '강유'], weiyan: ['hua', '위연'],
};   // 이름만 다른 고유 장수를 스테이지 제2군단장으로 사용
for (const [k, [src, name]] of Object.entries(CLONES)) U[k] = { ...U[src], name };   // 복제 장수: 외형·병종은 원본, 능력치는 GRADE 로 따로
U.gao.style = 'gao'; U.lulingqi.style = 'lulingqi';
for (const k of ['ecap', 'esage']) STAT5.forEach((f, i) => { U[k][f] = CAPTAIN[U[k].cls][i]; });
for (const [k, x] of Object.entries(ELITE)) STAT5.forEach((f, i) => { U[k][f] = Math.round(CAPTAIN[U[k].cls][i] * x); });
const HERO_DEFAULT = {
  warrior: { aa: 12, hr: 10, sp: 173, cd: 1, r: 14, mp: 0, range: 0 }, cavalry: { aa: 8, hr: 10, sp: 252, cd: 0.8, r: 15, mp: 0, range: 0 },
  archer: { aa: 20, hr: 8, sp: 166, cd: 1.3, r: 13, mp: 0, range: 270 }, mage: { aa: 18, hr: 8, sp: 166, cd: 1.4, r: 12, mp: 999, range: 200 },
  cleric: { aa: 20, hr: 12, sp: 180, cd: 1, r: 12, mp: 999, range: 0 }, shield: { aa: 8, hr: 10, sp: 153, cd: 1.1, r: 14, mp: 0, range: 0 },
};
const HERO_STATS = [...STAT5, 'aa', 'hr', 'sp', 'cd', 'r', 'mp', 'range'];
for (const u of Object.values(U)) if (!u.generic) {
  STAT5.forEach((f, i) => { if (!Number.isFinite(u[f])) u[f] = CAPTAIN[u.cls][i]; });
  for (const [f, value] of Object.entries(HERO_DEFAULT[u.cls])) if (!Number.isFinite(u[f])) u[f] = value;
  if (HERO_STATS.some(f => !Number.isFinite(u[f]))) throw new Error(u.name + ': 누락된 능력치가 있습니다.');
}
// 일반 병사만 현재 전투 능력치의 2.5배. 이동·사거리·공격 간격·MP와 장수 등급은 유지한다.
for (const u of Object.values(U)) if (u.generic) for (const f of [...STAT5, 'aa', 'hr']) u[f] *= 2.5;
// named: 이름 있는 장수(관우·여포·화웅 …)는 필드에 항상 이름을 표기 (적 장수·적 군사 같은 직함·병사는 제외)
const CLS_NAME = { warrior: '전사', cavalry: '기마', archer: '궁병', shield: '방패', mage: '법사', cleric: '성직' };
const CATEGORY_NAME = { cavalry: '기병', sword: '검병', spear: '창병', archer: '궁병', military: '군사' };
const CATEGORY = { warrior: 'sword', shield: 'spear', cavalry: 'cavalry', archer: 'archer', mage: 'military', cleric: 'military' };
const UNIT_CATEGORY = { guan: 'spear', dian: 'sword', sword: 'sword', shield: 'sword', xia: 'sword', yan: 'sword', wen: 'spear', spear: 'spear', esword: 'spear', eshield: 'spear' };
const SUBCLASS = { guan: '무신', dian: '철벽', cao: '간웅', lubu: '비장', zhao: '상승', jang: '전신', huang: '신궁', zhangfei: '만인적', machao: '금마초', hua: '효장', kong: '와룡', pangtong: '봉추', xun: '왕좌', chengong: '모주', diao: '경국', xia: '맹장', xuchu: '호치', liubei: '인덕', weiyan: '반골', jiangwei: '지용', lulingqi: '소비장', yan: '상장', wen: '용장', dong: '폭군', guo: '귀재', sima: '총호', yuan: '맹주', gao: '함진', zhanghe: '교변', xuhuang: '주아부', gong: '백마', lijue: '횡포', sword: '보병(검)', shield: '방패병(검)', mage: '법사', emage: '법사', esage: '법사', spear: '보병(창)', esword: '보병(창)', eshield: '방패병(창)', archer: '궁병', earcher: '궁병', cav: '기병', ecav: '기병' };   // 칭호(명세 26). 이름 있는 장수는 TITLE_EFFECT 에 효과가 있다
// 표에 적힌 공격 병과별 최종 피해 배율.
const CLASS_DAMAGE = { cavalry: { cavalry: 1, sword: 2, archer: 2, military: 2, spear: 0.8 }, sword: { sword: 1, spear: 1.2, archer: 1.2, military: 1.2, cavalry: 0.5 }, spear: { spear: 1, sword: 1.2, archer: 1.2, military: 1.2, cavalry: 1.2 }, archer: { archer: 1, sword: 0.8, spear: 0.8, cavalry: 0.5, military: 1.5 }, military: { military: 1, sword: 0.8, spear: 0.8, cavalry: 0.5, archer: 0.67 } };
// 상성 우세(배율 > 1)의 피해 효율을 50% 더 높인다 (v0.1.101). 불리(배율 < 1)는 표 그대로.
const MATCHUP_BONUS = 1.5;
const classMultiplier = (attacker, defender) => CLASS_DAMAGE[attacker]?.[defender] ?? 1;
// ITEM: 이름 있는 장수만 장착. owner가 있는 고유 장비는 해당 장수 전용이다.
const ITEMS = {
  ironsword: { name: '철검', atk: 12 }, armor: { name: '철갑', df: 12 }, bowguard: { name: '궁갑', ad: 12 }, charm: { name: '마법 부적', md: 12 }, seal_ar: { name: '공격율 인장', ar: 10 }, seal_dr: { name: '방어율 인장', dr: 10 },
  green_dragon: { name: '청룡언월도', atk: 18, ar: 5, owner: 'guan', unique: true }, twin_halberd: { name: '쌍철극', atk: 12, df: 8, owner: 'dian', unique: true }, sky_halberd: { name: '방천화극', atk: 18, ar: 5, owner: 'lubu', unique: true },
};
const ITEM_STATS = ['atk', 'df', 'ad', 'md', 'ar', 'dr'];
const itemOf = key => ITEMS[key] || {};
const itemBase = (u, k) => u[k] - (itemOf(u.item)[k] || 0);   // 아이템 보정을 뺀 값 (성장치 저장용)
const unitCategory = key => UNIT_CATEGORY[key] || CATEGORY[U[key].cls];
const unitSubclass = key => SUBCLASS[key] || CLS_NAME[U[key].cls];
const matchup = (attacker, defender) => classMultiplier(attacker, defender) < 1 ? 1 : classMultiplier(attacker, defender) > 1 ? -1 : 0;
const FORMATION_NAME = { block: '기본', line: '횡대', wedge: '쐐기', guard: '호위' };
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
const MAGIC = 1;   // 마법 피해 배율 (원작 수치를 이 프로토의 체력 규모에 맞춘다)
const magicDmg = (sp, t, from) => Math.max(sp.dmg[2], sp.dmg[0] - sp.dmg[1] * combatStat(cur, t, 'md') * DEF_EFF * combatStat(cur, t, 'dr') / 100 * ftDef(t)) * MAGIC * (from ? combatStat(cur, from, 'ar') / 100 * (1 + skillPct(from, 'dmg') / 100) : 1);   // AR·DR 은 마법에도 적용
const SPECIAL = { spin: { name: '회전참', cd: 12 }, dash: { name: '돌진', cd: 10, range: TILE * 6, pass: 2 }, volley: { name: '연사', cd: 12 }, bless: { name: '축복', cd: 25 } };
const TRAIT_TIME = 5, AURA_RANGE = 150, TITLE_BONUS = 1.25;   // 아군 소속 장수의 칭호 효과 수치는 ×1.25 (명세 26: 아군 효과 상향)
const ALL_STATS = ['atk', 'df', 'ad', 'md', 'aa', 'hr', 'sp', 'ar', 'dr'], STAT_NAME = { atk: 'AT', df: 'DF', ad: 'AD', md: 'MD', aa: 'AA', hr: 'HR', sp: 'SP', ar: 'AR', dr: 'DR' };
// 칭호 효과 (명세 26). aura 반경 안 아군(cats 가 있으면 그 병종만) · passive 상시 · hp 기준 이하 진입 시 5초 버프 · dash 돌진 후 · onSpecial 특수기 발동 시 · skill 군사의 스킬 효율(마법 피해·쿨타임·치유량 %). 수치는 % (자기 능력치 곱).
const TITLE_EFFECT = {
  무신: { aura: { stats: ['atk', 'ad', 'md'], pct: 20 }, col: '#ffb347', glyph: 'atk' },
  간웅: { aura: { stats: ALL_STATS, pct: 10 }, col: '#c78bff', glyph: 'all' },
  함진: { aura: { stats: ['df'], pct: 10, cats: ['sword', 'spear'] }, col: '#9fdcff', glyph: 'guard' },
  인덕: { aura: { stats: ['dr', 'hr'], pct: 10 }, col: '#7dff9a', glyph: 'heal' },
  맹주: { aura: { stats: ['hr'], pct: 10 }, col: '#7dff9a', glyph: 'heal' },
  철벽: { hp: { below: 0.3, mods: { ad: 30, md: 30, ar: 30 }, glyph: 'guard', col: '#9fdcff', text: '철벽 발동' } },
  맹장: { hp: { below: 0.5, mods: { atk: 30 }, glyph: 'atk', col: '#ffd34d', text: '맹장 발동' } },
  반골: { hp: { below: 0.5, mods: { atk: 20, sp: 10 }, glyph: 'atk', col: '#ffd34d', text: '반골 발동' } },
  비장: { dash: { any: true, self: { atk: 30 }, foeFt: 10 } }, 전신: { dash: { any: true, foeFt: 10 } }, 상승: { dash: { any: true, self: { atk: 30 } } },
  소비장: { dash: { any: true, self: { atk: 30 }, foeFt: 10, scale: 0.7 } },
  금마초: { dash: { self: { sp: 20, atk: 15 } } }, 지용: { dash: { self: { ar: 15, dr: 15 }, glyph: 'guard', col: '#9fdcff' } }, 백마: { dash: { self: { sp: 15 } } },
  신궁: { onSpecial: { volley: { self: { atk: 30 } } } }, 효장: { onSpecial: { spin: { self: { atk: 20 } } } },
  만인적: { onSpecial: { spin: { foeFt: 10 } } }, 폭군: { onSpecial: { spin: { foeFt: 10 } } },
  경국: { skill: { heal: 30, cd: 20 }, onSpecial: { bless: { foeFt: 10 } } },
  와룡: { skill: { dmg: 30, cd: 20 } }, 봉추: { skill: { dmg: 20 } }, 왕좌: { skill: { cd: 15 } }, 모주: { skill: { dmg: 10, cd: 10 } }, 귀재: { skill: { dmg: 10 } },
  호치: { passive: { df: 10, ad: 10 } }, 교변: { passive: { sp: 10, aa: 5 } }, 주아부: { passive: { df: 8, ad: 8 } }, 상장: { passive: { atk: 10 } }, 용장: { passive: { df: 10 } }, 총호: { passive: { md: 15, dr: 10 } }, 횡포: { passive: { atk: 5 } },
};
const teamMul = u => u.team === 'player' ? TITLE_BONUS : 1;
const modsText = (m, k = 1) => Object.entries(m).map(([s, v]) => STAT_NAME[s] + ' +' + +(v * k).toFixed(1) + '%').join(' ');
function titleDesc(name) {   // 장수 상세에 쓰는 칭호 효과 문장 (기준 수치, 아군이면 ×1.25)
  const T = TITLE_EFFECT[name]; if (!T) return null; const L = [];
  if (T.aura) L.push(`반경 ${AURA_RANGE}px 아군${T.aura.cats ? ' ' + T.aura.cats.map(x => CATEGORY_NAME[x]).join('·') : ''}의 ${T.aura.stats === ALL_STATS ? '전 능력' : T.aura.stats.map(x => STAT_NAME[x]).join('·')} +${T.aura.pct}%.`);
  if (T.passive) L.push('상시 자신 ' + modsText(T.passive) + '.');
  if (T.hp) L.push(`HP ${T.hp.below * 100}% 이하 진입 시 ${modsText(T.hp.mods)} ${TRAIT_TIME}초.`);
  if (T.dash) { const k = T.dash.scale || 1; if (T.dash.any) L.push('거리 제한 없이 돌진. 0칸에서도 충격 발동.'); const p = []; if (T.dash.self) p.push('돌진 후 ' + modsText(T.dash.self, k) + ' ' + TRAIT_TIME + '초'); if (T.dash.foeFt) p.push('맞은 적 FT +' + +(T.dash.foeFt * k).toFixed(1) + '% ' + TRAIT_TIME + '초'); if (p.length) L.push(p.join(' · ') + '.'); }
  if (T.onSpecial) for (const [sp, o] of Object.entries(T.onSpecial)) L.push(`${SPECIAL[sp].name} 발동 시 ${[o.self && '자신 ' + modsText(o.self) + ' ' + TRAIT_TIME + '초', o.foeFt && '주변 적 FT +' + o.foeFt + '% ' + TRAIT_TIME + '초'].filter(Boolean).join(' · ')}.`);
  if (T.skill) L.push('스킬 효율: ' + [T.skill.dmg && '마법 피해 +' + T.skill.dmg + '%', T.skill.cd && '쿨타임 −' + T.skill.cd + '%', T.skill.heal && '치유량 +' + T.skill.heal + '%'].filter(Boolean).join(' · ') + '.');
  return L;
}
const dashAny = u => !!((TITLE_EFFECT[u.subclass] || {}).dash || {}).any;
const skillPct = (u, k) => Math.min(k === 'cd' ? 60 : 300, (((TITLE_EFFECT[u.subclass] || {}).skill || {})[k] || 0) * teamMul(u));

// 군단 편성. 한 군단은 18명·3분대까지 가능하며, squads 를 지정하지 않으면 기존 편성 전체를 대장 1명의 1분대로 해석한다.
// at = 진형 중심 타일. 적 군단은 trig 조건(접근·시간·다른 군단 붕괴)이 되면 wait → advance
const ARMIES = [
  { team: 'player', name: '1분대', at: [5, 18], leader: 'lubu', units: ['lubu', 'cav', 'cav', 'cav', 'cav', 'cav'] },
  { team: 'player', name: '2분대', at: [5, 25], leader: 'jang', units: ['jang', 'cav', 'cav', 'cav', 'cav', 'cav'] },
  { team: 'enemy', weak: 0.85, name: '조조군', at: [37, 19], leader: 'cao', units: ['cao', 'ecap', 'esword', 'ecap', 'esword', 'eshield'], trig: { near: 15, t: 25 } },
  { team: 'enemy', weak: 0.85, name: '전위군', at: [53, 20], leader: 'dian', commander: true, units: ['dian', 'eshield', 'ecap', 'esword', 'eshield'], trig: { near: 13, t: 110, after: 2 } },
  { team: 'enemy', weak: 0.85, name: '하후돈군', at: [45, 7], leader: 'xia', units: ['xia', 'ecap', 'esword', 'ecap', 'eshield'], trig: { near: 14, t: 70 } },
  { team: 'enemy', weak: 0.85, name: '유비군', at: [37, 11], leader: 'liubei', units: ['liubei', 'earcher', 'ecap', 'esword', 'eshield'], trig: { near: 15, t: 25 } },
  { team: 'enemy', weak: 0.85, name: '순욱군', at: [37, 27], leader: 'xun', units: ['xun', 'emage', 'ecap', 'esword', 'eshield'], trig: { near: 15, t: 25 } },
  { team: 'enemy', weak: 0.85, name: '관우군', at: [45, 14], leader: 'guan', units: ['guan', 'ecap', 'ecap', 'esword', 'eshield'], trig: { near: 14, t: 70 } },
  { team: 'enemy', name: '조운군', at: [45, 27], leader: 'zhao', units: ['zhao'], trig: { near: 14, t: 70 } },
  { team: 'enemy', weak: 0.85, name: '황충군', at: [53, 13], leader: 'huang', units: ['huang'], trig: { near: 13, t: 110, after: 2 } },
  { team: 'enemy', weak: 0.85, name: '제갈량군', at: [53, 27], leader: 'kong', units: ['kong'], trig: { near: 13, t: 110, after: 2 } },
  { team: 'player', name: '3분대', at: [5, 11], leader: 'diao', units: ['diao', 'sword', 'shield', 'sword', 'shield', 'mage'] },   // 아군 3분대 (적 군단 인덱스가 밀리지 않게 맨 끝)
];
for (let i = 0; i < 0; i++) ARMIES[2 + i % 9].units.push(['esword', 'eshield', 'earcher'][i % 3]);
// 병종별 기본 최대 체력. warrior 장수는 등급 HP를 그대로 써서 검병·창병 등급 차이를 보존한다.
function baseMaxHp(key, team) {
  const T = U[key], frontline = ['sword', 'spear', 'shield', 'esword', 'eshield'].includes(key), ownHp = Math.round(T.hp * HP_MUL * (frontline ? FRONTLINE_HP : T.generic ? SOLDIER_HP : 1));
  if (T.generic || (T.cls === 'warrior' && GRADE[key])) return ownHp;
  const peerKey = (team === 'enemy' ? { warrior: 'esword', shield: 'eshield', cavalry: 'ecav', archer: 'earcher', mage: 'emage', cleric: 'emage' } : { warrior: 'sword', shield: 'shield', cavalry: 'cav', archer: 'archer', mage: 'mage', cleric: 'mage' })[T.cls], peer = peerKey && U[peerKey];
  const peerHp = peer && Math.round(peer.hp * HP_MUL * (['sword', 'shield', 'esword', 'eshield'].includes(peerKey) ? FRONTLINE_HP : SOLDIER_HP));
  return !peer ? ownHp : Math.max(ownHp * 1.5, peerHp * 1.5);
}

// ---------- 전투력 ----------
// 한 유닛의 능력치를 가중합해 하나의 수로 환산한다 (체력 100당 1, 공격·방어·명중 계열은 반영, 이동 속도는 약하게). 군단 전투력은 소속 유닛 전투력의 합.
// 장수는 일반 병사의 약 3~10배가 되도록 능력치가 설계돼 있으므로 환산값도 그 비율을 따른다.
const POWER_W = { maxHp: 0.01, atk: 1, df: 1, ad: 0.5, md: 1.5, aa: 0.5, hr: 1, sp: 0.1 };
const statPower = s => Math.round(Object.entries(POWER_W).reduce((n, [k, w]) => n + (Number(s[k]) || 0) * w, 0) + ((s.ar ?? 100) - 100 + (s.dr ?? 100) - 100) * 0.25);
// 전투 전(원정 지도)에도 쓰도록 병종 키와 저장된 성장치(growth)만으로 능력치를 만든다.
function unitStats(key, team = 'player', growth = null) {
  const T = U[key], G = growth || {};
  const s = { maxHp: G.maxHp ?? baseMaxHp(key, team), atk: G.atk ?? T.atk, df: G.df ?? T.df, ad: G.ad ?? T.ad, md: G.md ?? T.md, aa: G.aa ?? T.aa, hr: G.hr ?? T.hr, sp: G.sp ?? T.sp, ar: G.ar ?? 100, dr: G.dr ?? 100 };
  const item = itemOf(G.item); if (!T.generic && (!item.owner || item.owner === key)) for (const k of ITEM_STATS) s[k] += item[k] || 0;
  return s;
}
const unitPower = (key, team = 'player', growth = null) => statPower(unitStats(key, team, growth));
// keys: 병종 키 배열(빈 칸은 null/undefined), growth: 같은 순서의 성장치 배열(선택)
const corpsPower = (keys, team = 'player', growth = []) => keys.reduce((n, k, i) => n + (k ? unitPower(k, team, growth[i]) : 0), 0);
// 전투 중 군단의 현재 전투력: 살아 있는 유닛의 현재 능력치 기준 (체력은 현재값)
const battlePower = A => A.units.filter(u => !u.dead && !u.fled).reduce((n, u) => n + statPower({ ...u, maxHp: u.hp }), 0);

// ---------- 지형 / 격자 ----------
function genMap(seed = 7, armies = ARMIES, theme = 'riverside', wideRiver = false) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const m = new Uint8Array(MW * MH), set = (x, y, t) => { if (x >= 0 && y >= 0 && x < MW && y < MH) m[y * MW + x] = t; };
  const forests = theme === 'plains' ? 8 : theme === 'mountain' ? 16 : theme === 'fortress' ? 6 : 22;
  for (let i = 0; i < forests; i++) {   // 숲
    const cx = 10 + rnd() * 52, cy = rnd() * MH, rx = 2 + rnd() * 4, ry = 2 + rnd() * 3;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 && rnd() < 0.9) set(x, y, FOREST);
  }
  if (theme === 'riverside') for (let y = 0; y < MH; y++) {   // 강: 세 곳의 여울로만 건널 수 있다
    const rx = Math.round(28 + 2 * Math.sin(y * 0.35));
    const ford = wideRiver || (y >= 6 && y <= 11) || (y >= 18 && y <= 23) || (y >= 30 && y <= 34);
    for (let x = rx - 1; x <= rx + 1; x++) set(x, y, ford ? ROAD : WATER);
  }
  if (theme === 'plains') for (let x = 4; x < MW - 4; x++) set(x, 20, ROAD);
  if (theme === 'fortress') for (const x of [38, 39]) for (let y = 2; y < MH - 2; y++) set(x, y, (y >= 5 && y <= 14) || (y >= 24 && y <= 34) ? ROAD : ROCK);
  const rocks = theme === 'mountain' ? 130 : theme === 'plains' ? 12 : theme === 'fortress' ? 24 : 40;
  for (let i = 0; i < rocks; i++) { const x = 8 + Math.floor(rnd() * 54), y = Math.floor(rnd() * MH); if (m[y * MW + x] === GRASS || m[y * MW + x] === FOREST) set(x, y, ROCK); }
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
  const sourceDefs = opts.armies || ARMIES, teamOrder = { player: 0, enemy: 0 };
  const armyDefs = opts.attackingTeam ? sourceDefs.map(d => {
    const n = teamOrder[d.team]++, rank = Math.floor(n / 6), attack = d.team === opts.attackingTeam;
    const tx = d.team === 'player' ? (attack ? 5 : 14) + rank * 5 : (attack ? 58 : 49) - rank * 5;
    return { ...d, at: [tx, 4 + (n % 6) * 6], role: attack ? 'attack' : 'defense' };
  }) : sourceDefs;
  const unique = new Set();
  for (const d of armyDefs) for (const key of d.units) {
    const u = U[key];
    if (!u || u.generic || u.name.startsWith('적 ')) continue;
    if (unique.has(u.name)) throw new Error(u.name + ': 고유 장수는 한 명만 편성할 수 있습니다.');
    unique.add(u.name);
  }
  const S = { t: 0, map: genMap(opts.mapSeed || 7, armyDefs, opts.theme, !!opts.wideRiver), theme: opts.theme || 'riverside', occ: new Int32Array(MW * MH), units: [], armies: [], proj: [], later: [], fx: [], texts: [], events: [], talked: new Set(), over: null, explore: !!opts.explore, rnd, nextId: 1, auto: !!opts.auto, routChance: opts.routChance ?? 0.065, surrenderSlots: opts.surrenderSlots || 0, lock: { player: 0, enemy: 0 }, lockAI: { player: 0, enemy: 0 }, stats: { kills: 0, lost: 0, fled: 0, levelups: 0 } };
  const cnt = {}; let enemyField = 0, reserves = false;
  armyDefs.forEach((d, ai) => {
    const squadDefs = d.squads || (d.units.length ? [{ leader: d.leader, units: d.units }] : []);
    if (squadDefs.length > SQUAD_MAX) throw new Error(d.name + ': 분대는 최대 ' + SQUAD_MAX + '개');
    const members = [];
    if (d.units.length && !d.detachment) {
      const leader = U[d.leader];
      if (!leader || leader.generic || leader.name.startsWith('적 ') || d.units.filter(k => k === d.leader).length !== 1) throw new Error(d.name + ': 군단장은 이름 있는 장수 1명이어야 함');
    }
    squadDefs.forEach((q, squad) => {
      q.units.forEach((key, index) => members.push({ key, squad, growth: (q.growth || d.growth || [])[index], rosterSlot: (q.rosterSlots || d.rosterSlots || [])[index] }));
    });
    if (d.leaderRear) { const leaderIndex = members.findIndex(m => m.key === d.leader), leader = members.splice(leaderIndex, 1)[0]; members.splice(Math.min(4, members.length), 0, leader); }
    const keys = members.slice(0, ARMY_MAX), forcedReserve = d.team === 'enemy' && !!d.reserve;
    const reserve = d.team === 'enemy' ? forcedReserve || reserves || enemyField + keys.length > ENEMY_FIELD_MAX : !!d.support;
    if (d.team === 'enemy' && !forcedReserve) { if (reserve) reserves = true; else enemyField += keys.length; }
    const leaderKey = d.leader || (squadDefs[0] && squadDefs[0].leader);
    const A = { id: ai, team: d.team, ally: !!d.ally, name: d.name, corps: d.corps, squadIndex: d.squadIndex, forceId: d.forceId, role: d.role, stagedReserve: !!d.reserve, reserveAt: d.reserveAt ?? 20, units: [], squads: squadDefs.map((q, id) => ({ id, units: [] })), leader: null, commander: !!d.commander, trig: d.trig, support: !!d.support, state: d.support ? 'support' : d.team === 'player' ? 'player' : reserve ? 'reserve' : d.role === 'attack' ? 'advance' : 'wait', formation: d.formation || 'block', routed: false, order: 'idle', ctrl: null };
    S.armies.push(A);
    keys.forEach(({ key, squad, growth, rosterSlot }, i) => {
      const T = U[key], G = growth || {}, sgn = d.team === 'player' ? 1 : -1; cnt[key] = (cnt[key] || 0) + 1;
      const tx = d.at[0] - sgn * Math.floor(i / 4), ty = d.at[1] + (i % 4) - 1;   // 4행 × 3열, 한 칸에 한 명
      const baseHp = baseMaxHp(key, d.team);
      const u = { id: S.nextId++, key, name: T.name + (T.generic ? String.fromCharCode(64 + cnt[key]) : ''), cls: T.cls, category: unitCategory(key), subclass: unitSubclass(key), team: d.team, army: A, tx, ty, x: tcx(tx), y: tcy(ty), mv: null,
        hp: G.maxHp ?? baseHp, maxHp: G.maxHp ?? baseHp, mp: G.maxMp ?? (T.mp || 0), maxMp: G.maxMp ?? (T.mp || 0), lv: G.lv || 1, xp: G.xp || 0, ft: 0, atk: G.atk ?? T.atk, df: G.df ?? T.df, ad: G.ad ?? T.ad, md: G.md ?? T.md, sp: G.sp ?? T.sp, cd: T.cd, cdT: rnd(), range: T.range || 0, r: T.r * SIZE, style: T.style,
        aa: G.aa ?? T.aa, hr: G.hr ?? T.hr, ar: G.ar ?? 100, dr: G.dr ?? 100, item: !T.generic && ITEMS[G.item] && (!ITEMS[G.item].owner || ITEMS[G.item].owner === key) ? G.item : null, named: !T.generic && !T.name.startsWith('적 '), generic: !!T.generic, rosterSlot, originTeam: d.team, forceId: d.forceId, surrenderChecked: false, lastHurt: -99, shield: !!T.shield, special: T.special || (T.cls === 'cavalry' ? 'dash' : null), spT: 0, spells: T.spells || [], fanatic: !!(T.fanatic || d.commander), isLeader: key === leaderKey, squad: A.squads[squad],
        face: d.team === 'player' ? 0 : Math.PI, order: { type: 'idle' }, slot: { dx: tx - d.at[0], dy: ty - d.at[1] }, claim: -1, claimT: 0, repathT: 0, path: null, pathGoal: -1, waitT: 0, stuck: 0, thinkT: rnd() * 0.3, flash: 0, anim: 0, stun: 0, dashQ: null, knockQ: null, passT: 0, atkBuffT: 0, guardBuffT: 0, ftDebuffT: 0, ironwallUsed: false, dead: false, out: reserve, reserve, retreated: false, fled: false, moving: false, autoCharge: false, manual: false };
      if (u.item) for (const k of ITEM_STATS) u[k] += itemOf(u.item)[k] || 0;
      if (d.weak && d.weak !== 1) { u.maxHp = u.hp = Math.round(u.maxHp * d.weak); u.atk = Math.round(u.atk * d.weak); u.df = Math.round(u.df * d.weak); }   // 시나리오 군단 약화 배율 (HP·ATK·DF)
      u.spellSel = 0; u.ctrlIn = null; u.root = 0; u.hitT = 0; u.hitAng = 0; u.hitMag = 1;
      if (!reserve) S.occ[ti(tx, ty)] = u.id; S.units.push(u); A.units.push(u); u.squad.units.push(u); if (u.isLeader) A.leader = u;
    });
    A.initialHp = A.units.reduce((n, u) => n + u.maxHp, 0); A.nextHpRetreatCheck = 0; A.retreatByHp = false;
    if (d.formation) setFormation(A, d.formation);
    if (d.team === 'player') setCtrl(S, A, A.leader || A.units[0]);   // 분견 분대는 첫 병사를 조작 대상으로 사용한다
  });
  return S;
}

// ---------- 전투 계산 ----------
// 피로도(FT 0~100) 설정 — 한 곳에서 조절한다. 효율(eff) = 쌓이는 속도 1/eff · 회복 속도 eff배 (1 이면 교전 1분에 100 가까이, 10 이면 거의 안 쌓임; 3 이면 격렬한 교전 뒤에만 50~70까지 오르고 쉬면 내려감)
const FT = { eff: 3, gain: { hit: 1.8, spell: 2, special: 3, step: 0.1 }, recover: 0.04, penalty: 0.004, max: 100 };   // gain: 행동 한 번당 상승량 / recover: 초당 회복 / penalty: FT 1 당 능력 감소 (100 이면 -40%)
const tire = (u, kind) => { u.ft = Math.min(FT.max, u.ft + FT.gain[kind] / FT.eff); };
const effectiveFt = u => Math.min(FT.max, u.ft + (u.ftDebuffT > 0 ? (u.ftDebuffAmt || 10) : 0));
const ftMul = u => 1 - effectiveFt(u) * FT.penalty;   // 공격·이동 속도 배율
const ftDef = u => 1 - effectiveFt(u) * FT.penalty;   // 방어 배율 (설계값, ftMul 과 별개로 둘 수 있게 분리)
const live = u => !u.dead && !u.out;
let cur = null;   // step() 중인 전투 (phys 의 난수용)
function combatStat(S, u, key) {
  let value = u[key]; if (!S || !Number.isFinite(value)) return value;
  const TE = TITLE_EFFECT[u.subclass]; if (TE && TE.passive && TE.passive[key]) value *= 1 + TE.passive[key] / 100 * teamMul(u);
  if (u.buffs) for (const b of u.buffs) if (b.mods[key]) value *= 1 + b.mods[key] / 100 * b.mul;
  for (const a of S.units) if (a !== u && live(a) && a.team === u.team && dist(a, u) <= AURA_RANGE) { const A = (TITLE_EFFECT[a.subclass] || {}).aura; if (A && A.stats.includes(key) && (!A.cats || A.cats.includes(u.category))) value *= 1 + A.pct / 100 * teamMul(a); }
  return value;
}
const mitigate = (a, d) => a * a / (a + Math.max(0, d));   // 공격 a 가 방어 d 를 만났을 때의 유효 공격 (방어가 같으면 절반)
const phys = (u, t, mul = 1) => Math.max(1, mitigate(combatStat(cur, u, 'atk') * combatStat(cur, u, 'ar') / 100 * mul * (0.85 + cur.rnd() * 0.3) * ftMul(u), combatStat(cur, t, 'df') * DEF_EFF * combatStat(cur, t, 'dr') / 100 * ftDef(t))) * DMG;
function text(S, x, y, s, col, k = 'sys') { S.texts.push({ x, y, s, col, t: 1.0, k }); }   // k: dmg 피해량 / buff 회복·방어·회피·레벨업 등 효과 / sys 안내(항상 표시)
function notice(S, team, text) { S.events.push({ type: 'notice', team, text }); }
function dialogue(S, u, text) { S.events.push({ type: 'dialogue', team: u.team, key: u.key, speaker: u.name, text }); }
function buffFx(S, u, glyph, col) { S.fx.push({ kind: 'buff', glyph, x: u.x, y: u.y, r: u.r, col, t: 0.9, max: 0.9 }); }   // 버프·디버프·회복이 걸릴 때 유닛 위에 뜨는 이펙트 (glyph: atk ▲ / guard 방패 / down ▼ / heal +)
// 범위 버프(오라, TITLE_EFFECT.aura): 범위에 들어오면 이펙트, 있는 동안은 u.auraOn[칭호] 표시. 능력치 계산(combatStat)과 같은 조건.
const AURA_TITLES = Object.entries(TITLE_EFFECT).filter(([, t]) => t.aura);
function updateAuras(S) {
  const bearers = S.units.filter(b => live(b) && (TITLE_EFFECT[b.subclass] || {}).aura); if (!bearers.length && !S.units.some(u => u.auraOn && Object.values(u.auraOn).some(Boolean))) return;
  for (const u of S.units) {
    if (!live(u)) { u.auraOn = {}; continue; }
    u.auraOn = u.auraOn || {}; u.auraFxT = u.auraFxT || {};
    for (const [sub, T] of AURA_TITLES) {
      const on = bearers.some(b => b !== u && b.team === u.team && b.subclass === sub && dist(b, u) <= AURA_RANGE && (!T.aura.cats || T.aura.cats.includes(u.category)));
      if (on && !u.auraOn[sub] && S.t - (u.auraFxT[sub] ?? -99) > 3) { buffFx(S, u, T.glyph, T.col); u.auraFxT[sub] = S.t; }
      u.auraOn[sub] = on;
    }
  }
}
// 칭호 버프(발동형)와 적 FT 디버프
function addBuff(S, u, id, mods, glyph, col, scale = 1) {
  const mul = teamMul(u) * scale; u.buffs = u.buffs || []; const old = u.buffs.find(b => b.id === id);
  if (old) { old.t = TRAIT_TIME; old.mods = mods; old.mul = mul; old.glyph = glyph; old.col = col; } else u.buffs.push({ id, t: TRAIT_TIME, mods, mul, glyph, col });
  buffFx(S, u, glyph, col); text(S, u.x, u.y - u.r * 4, modsText(mods, mul), col, 'buff');
}
function foeFt(S, e, amt, scale = 1) { e.ftDebuffT = TRAIT_TIME; e.ftDebuffAmt = amt * scale; buffFx(S, e, 'down', '#ff9a4a'); text(S, e.x, e.y - e.r * 4, 'FT +' + +(amt * scale).toFixed(1) + '%', '#ff9a4a', 'buff'); }
function ring(S, x, y, r, col, t = 0.4) { S.fx.push({ kind: 'ring', x, y, r, col, t, max: t }); }
function release(S, u) {   // 점유 중인 칸(출발·도착)을 비운다
  const p = u.mv && u.mv.swap;   // 맞바꾸던 상대가 쓰러지거나 떠나면, 남은 쪽은 그 칸으로 가는 보통 이동으로 바꾸고 도착 칸을 바로 점유한다 (아니면 빈 칸으로 보여 다른 유닛이 겹쳐 들어온다)
  if (p && p.mv && p.mv.swap === u) { p.mv.swap = null; S.occ[ti(p.mv.nx, p.mv.ny)] = p.id; }
  if (S.occ[ti(u.tx, u.ty)] === u.id) S.occ[ti(u.tx, u.ty)] = 0;
  if (u.mv && S.occ[ti(u.mv.nx, u.mv.ny)] === u.id) S.occ[ti(u.mv.nx, u.mv.ny)] = 0;
  u.mv = null;
}
// 레벨업 (원작식, 명세 21): 곱셈 성장 → 가산. 경험치는 "공격을 적중시킨 횟수" 위주(처치·피격·회피 보너스 없음).
// HP +4~6%(1레벨 기준 최대 체력의 가산), 레벨업 차례마다 AT→DF→AR→DR 순서로 한 항목씩(AT·DF 는 1레벨 기준값의 8%, AR·DR 은 +2), 16의 배수 레벨에 HR→AA→AD→MD 순서로 한 항목(HR·AA +1, AD·MD 는 기준값의 8%).
const XP_NEED = lv => lv * 30;
const lvGain = (T, k) => Math.max(1, Math.round((T[k] || 0) * 0.08));
function applyLevelUp(st, key, team, lv, hpRate) {   // st: 능력치 객체(maxHp·atk·df·ad·md·aa·hr·ar·dr), lv: 오르기 전 레벨. hpRate: 0.04~0.06
  const T = U[key]; st.maxHp += Math.round(baseMaxHp(key, team) * hpRate);
  const o = ['atk', 'df', 'ar', 'dr'][(lv - 1) % 4]; st[o] = o === 'ar' || o === 'dr' ? st[o] + 2 : Math.round((st[o] + lvGain(T, o)) * 10) / 10;
  if ((lv + 1) % 16 === 0) { const q = ['hr', 'aa', 'ad', 'md'][((lv + 1) / 16 - 1) % 4]; st[q] = q === 'ad' || q === 'md' ? st[q] + lvGain(T, q) : Math.min(q === 'aa' ? 80 : 100, st[q] + 1); }
  return st;
}
// 레벨 L 시점의 평균 능력치(HP 5%): 적 지역 레벨표(명세 15)가 같은 규칙을 쓰도록 공유
function levelStats(key, team, level) {
  const st = unitStats(key, team); st.maxMp = U[key].mp || 0;
  for (let lv = 1; lv < level; lv++) applyLevelUp(st, key, team, lv, 0.05);
  st.maxHp = Math.round(st.maxHp); st.lv = level; return st;
}
function gainXp(S, u, n) {
  if (!live(u)) return; u.xp += n;
  while (u.xp >= XP_NEED(u.lv)) {   // 레벨업: 능력치 가산 + 부분 회복 (퍼스트퀸4 의 전투 중 레벨업)
    u.xp -= XP_NEED(u.lv); const was = u.maxHp, bonus = k => itemOf(u.item)[k] || 0;
    for (const k of ITEM_STATS) u[k] -= bonus(k);   // 아이템 보정은 빼고 성장시킨 뒤 다시 더한다
    applyLevelUp(u, u.key, u.originTeam, u.lv, 0.04 + S.rnd() * 0.02); u.lv++;
    for (const k of ITEM_STATS) u[k] += bonus(k);
    u.hp = Math.min(u.maxHp, u.hp + (u.maxHp - was) + 20 * HP_MUL);
    text(S, u.x, u.y - u.r * 4, 'LEVEL UP', '#ffd34d', 'buff'); ring(S, u.x, u.y, 30, '#ffd34d', 0.5); S.stats.levelups++;
  }
}
const gainCombatXp = (S, u, base) => gainXp(S, u, Math.max(1, Math.round(base * (u.named ? 1.5 : 1))));
function tryRout(S, A) {
  if (S.rnd() >= S.routChance) { A.nextRoutCheck = S.t + 15; return false; }
  let fleeing = false; for (const m of A.units) if (live(m) && !m.fanatic) { m.surrenderChecked = false; m.order = { type: 'flee' }; m.path = null; fleeing = true; }
  if (fleeing) A.fleeing = true;
  A.nextRoutCheck = 0; return fleeing;
}
// 군단 퇴각 조건 (적 군단): ① 군단장 사망(die → tryRout) ② 군단장 생명력 RETREAT_HP 이하 → 후퇴 또는 군단장 투항 ③ 군단 전체 생명력 RETREAT_CORPS_HP 이하 → 후퇴.
// ②③ 판정은 12초마다, 확률은 군단장 전투력이 높을수록 낮다(차등). 퇴각이 시작되면 그 군단 소속은 투항 확률이 오른다(hurt).
const RETREAT_HP = 0.3, RETREAT_CORPS_HP = 0.5, RETREAT_CHANCE_SCALE = 0.1, LEADER_SURRENDER = 0.3, SURRENDER_HP = [0.2, 0.5], SURRENDER_CHANCE = [0.25, 0.6];   // 후퇴 확률은 직전 기준의 10%, 투항 확률은 유지
function startRetreat(S, A) { A.routed = true; A.fleeing = true; A.retreatByHp = true; for (const u of A.units) if (live(u)) { u.surrenderChecked = false; u.order = { type: 'flee' }; u.path = null; } }
function tryHpRetreat(S, A) {
  const L = A.leader; if (A.team !== 'enemy' || A.state === 'reserve' || A.routed || !A.initialHp || !L || !live(L) || S.t < A.nextHpRetreatCheck) return false;
  const total = A.units.reduce((n, u) => n + (live(u) ? Math.max(0, u.hp) : 0), 0), leaderLow = L.hp <= L.maxHp * RETREAT_HP, corpsLow = total <= A.initialHp * RETREAT_CORPS_HP;
  if (!leaderLow && !corpsLow) return false;
  A.nextHpRetreatCheck = S.t + 12;
  const power = statPower(L), chance = clamp(0.78 - 0.58 * power / (power + 1200), 0.2, 0.78) * RETREAT_CHANCE_SCALE; if (S.rnd() >= chance) return false;
  const why = leaderLow ? '군단장 생명력 ' + Math.round(RETREAT_HP * 100) + '% 이하' : '군단 생명력 ' + Math.round(RETREAT_CORPS_HP * 100) + '% 이하', info = ` · 군단장 전투력 ${Math.round(power)} · 확률 ${Math.round(chance * 100)}%`;
  if (leaderLow && S.surrenderSlots > 0 && S.rnd() < LEADER_SURRENDER) { surrender(S, L); startRetreat(S, A); notice(S, 'enemy', `적 ${A.name} 군단장이 투항하고 군단이 후퇴합니다. · ${why}${info}`); return true; }
  startRetreat(S, A); notice(S, 'enemy', `적 ${A.name}가 ${why}로 후퇴합니다.${info}`); return true;
}
function die(S, u, killer) {
  u.dead = true; u.hp = 0; S.fx.push({ kind: 'dust', x: u.x, y: u.y, r: u.r, t: 0.7, max: 0.7 }, { kind: 'fall', x: u.x, y: u.y, r: u.r, style: u.style, face: u.face, ang: u.hitAng, t: 0.9, max: 0.9 }); release(S, u);
  const ai = u.army.units.indexOf(u); if (ai >= 0) u.army.units.splice(ai, 1);
  if (u.squad) { const si = u.squad.units.indexOf(u); if (si >= 0) u.squad.units.splice(si, 1); }
  if (u.team === 'player') { S.stats.lost++; S.surrenderSlots++; } else S.stats.kills++;
  if (u.team === 'player') dialogue(S, u, '아군 ' + u.name + '이 전사했습니다.');
  if (u.isLeader && !u.army.routed) {
    u.army.routed = true; text(S, u.x, u.y - 60, u.army.name + ' 지휘관 전사!', '#ff5a4a');
    if (u.team === 'enemy') dialogue(S, u, '내가 여기서 쓰러지다니…');
    if (u.team === 'enemy') {
      const fleeing = tryRout(S, u.army);
      notice(S, 'enemy', fleeing ? '적 ' + u.army.name + '가 후퇴합니다.' : '적 ' + u.army.name + '가 지휘관 없이 전투를 계속합니다.');
    }
  }
}
function surrender(S, u) {
  let A = S.armies.find(a => a.team === 'player' && a.units.filter(x => !x.dead).length < 6);
  if (!A) {
    const squad = { id: 0, units: [] };
    A = { id: S.armies.length, team: 'player', name: '투항 군단', corps: 'surrender', squadIndex: 0, units: [], squads: [squad], leader: null, commander: false, trig: null, support: false, state: 'player', formation: 'block', routed: false, order: 'idle', ctrl: null };
    S.armies.push(A);
  }
  const old = u.army, oi = old.units.indexOf(u); if (oi >= 0) old.units.splice(oi, 1);
  if (old.leader === u) { old.leader = null; old.routed = true; }
  if (u.squad) { const si = u.squad.units.indexOf(u); if (si >= 0) u.squad.units.splice(si, 1); }
  const squad = A.squads[0] || (A.squads[0] = { id: 0, units: [] });
  u.team = 'player'; u.army = A; u.squad = squad; u.isLeader = false; u.order = { type: 'idle' }; u.path = null; u.face = 0;
  A.units.push(u); squad.units.push(u); if (!A.ctrl) A.ctrl = u; if (A.support) A.state = 'player'; setFormation(A, A.formation); S.surrenderSlots--;
  dialogue(S, u, '목숨을 살려주십시오. 아군으로 싸우겠습니다!'); return true;
}
function hurt(S, from, t, dmg) {
  if (!live(t) || dmg <= 0) return;
  const opposed = from && from.team !== t.team, tier = opposed ? matchup(from.category, t.category) : 0;
  if (opposed) { const m = classMultiplier(from.category, t.category); dmg *= m > 1 ? m * MATCHUP_BONUS : m; }
  t.hp -= dmg; t.flash = 0.12; t.lastHurt = S.t;
  if (opposed) gainCombatXp(S, from, 1);
  t.hitState = tier; t.hitDuration = tier > 0 ? 0.24 : tier < 0 ? 0.48 : 0.35; t.hitT = t.hitDuration;
  t.hitMag = clamp(dmg / (t.maxHp * 0.06), 0.5, 1.6) * (tier > 0 ? 0.65 : tier < 0 ? 1.35 : 1); t.hitAng = from && from !== t ? Math.atan2(t.y - from.y, t.x - from.x) : cur.rnd() * 6.283;
  S.fx.push({ kind: tier > 0 ? 'guard' : 'spark', x: t.x, y: t.y - t.r * 1.6, ang: t.hitAng, col: tier < 0 ? '#ff654d' : tier > 0 ? '#75d8ff' : '#fff3c0', count: tier < 0 ? 10 : 6, t: 0.24, max: 0.24 });
  if (tier) text(S, t.x, t.y - t.r * 4, tier > 0 ? '상성 방어' : '상성 불리', tier > 0 ? '#75d8ff' : '#ff654d', 'buff');
  if (t.isLeader || dmg >= 18) text(S, t.x, t.y - t.r * 4, Math.round(dmg), tier < 0 ? '#ff9a32' : tier > 0 ? '#999999' : '#ffffff', 'dmg');
  if (t.team === 'enemy' && !t.surrenderChecked && t.hp > 0 && t.hp / t.maxHp <= SURRENDER_HP[+!!t.army.fleeing]) { t.surrenderChecked = true; if (S.surrenderSlots > 0 && S.rnd() < SURRENDER_CHANCE[+!!t.army.fleeing]) surrender(S, t); }
  if (t.hp <= 0) die(S, t, from);
}
function aoe(S, from, x, y, r, fn, col, friendly = false) {   // friendly: 시전자를 뺀 같은 편도 맞는다 (번개)
  ring(S, x, y, r, col, 0.45);
  for (const e of S.units) if (live(e) && e !== from && (friendly || e.team !== from.team) && Math.hypot(e.x - x, e.y - y) <= r + e.r) fn(e);
}
function arrowHit(S, p, t) {   // 방패: 정면 화살은 정지 중 항상, 이동 중 35% 막는다. 회피: 기마는 낮다 (퍼스트퀸4 의 화살 규칙)
  if (t.shield && Math.cos(t.face - p.a - Math.PI) > 0.2 && (!t.moving || S.rnd() < 0.35)) { text(S, t.x, t.y - t.r * 4, '방어', '#9aa7b8', 'buff'); ring(S, t.x, t.y, 14, '#cfd3e6', 0.2); return; }
  if (S.rnd() < combatStat(S, t, 'aa') / 100) { text(S, t.x, t.y - t.r * 4, '회피', '#cfd3e6', 'buff'); return; }
  hurt(S, p.from, t, Math.max(1, mitigate(p.atk * (0.85 + S.rnd() * 0.3), combatStat(S, t, 'ad') * DEF_EFF * combatStat(S, t, 'dr') / 100 * ftDef(t))) * DMG);
}
function shoot(S, u, tx, ty, mul = 1, spread = 0) {
  const a = Math.atan2(ty - u.y, tx - u.x) + spread;
  S.proj.push({ kind: 'arrow', x: u.x, y: u.y - u.r * 1.4, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, left: u.range * 1.25, atk: combatStat(S, u, 'atk') * combatStat(S, u, 'ar') / 100 * mul * ftMul(u), from: u, team: u.team, a });
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
    const heal = Math.round((70 + u.lv * 5) * HP_MUL * (1 + skillPct(u, 'heal') / 100)); t.hp = Math.min(t.maxHp, t.hp + heal); text(S, t.x, t.y - t.r * 4, '+' + heal, '#7dff9a', 'buff'); ring(S, t.x, t.y, 24, '#7dff9a', 0.4); buffFx(S, t, 'heal', '#7dff9a');
  } else if (sp.kind === 'homing') {   // 장풍: 가까운 적을 쫓아간다 (조준한 곳 가까이에 적이 없으면 직진)
    let tgt = null, bd = 80; for (const e of S.units) if (live(e) && e.team !== u.team) { const dd = Math.hypot(e.x - x, e.y - y); if (dd < bd) { bd = dd; tgt = e; } }
    shot({ kind: 'homing', vx: Math.cos(ang) * 420, vy: Math.sin(ang) * 420, left: sp.range * 1.5, tgt });
  } else if (sp.kind === 'pierce') shot({ kind: 'pierce', vx: Math.cos(ang) * 460, vy: Math.sin(ang) * 460, left: sp.range * 1.25, hit: new Set() });   // 불새·얼음칼날·회오리바람: 관통
  else if (sp.kind === 'roll') shot({ kind: 'roll', vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260, left: sp.range * 1.2 });   // 불공: 땅을 구르다 처음 맞은 적에서 터진다
  else if (sp.kind === 'ball') shot({ kind: 'ball', tx: px, ty: py, vx: Math.cos(ang) * 380, vy: Math.sin(ang) * 380 });   // 불꽃탄: 날아가 범위 폭발
  else if (sp.kind === 'wide') {   // 번개: 넓은 범위, 시전자 외 같은 편도 맞는다
    ring(S, px, py, sp.r, 'rgba(255,240,120,.7)', 0.6);
    S.later.push({ t: 0.5, fn: () => aoe(S, u, px, py, sp.r, e => hurt(S, u, e, magicDmg(sp, e, u)), sp.col, true) });
  } else if (sp.kind === 'quake') {   // 지진: 시전자 주위, 약한 피해, 아군은 안 맞는다
    ring(S, u.x, u.y, sp.r, 'rgba(201,165,106,.8)', 0.7);
    S.later.push({ t: 0.3, fn: () => aoe(S, u, u.x, u.y, sp.r, e => hurt(S, u, e, magicDmg(sp, e, u)), sp.col) });
  } else if (sp.kind === 'web') {   // 거미줄: 범위 안 적이 한동안 움직이지 못한다
    ring(S, px, py, sp.r, 'rgba(232,232,232,.8)', 0.5);
    aoe(S, u, px, py, sp.r, e => { e.root = sp.root; e.path = null; text(S, e.x, e.y - e.r * 4, '속박', '#e8e8e8', 'buff'); }, sp.col);
  }
  if (sp.lock) S.lock[u.team] = sp.lock;   // 전체 쿨 마법
  u.mp -= sp.mp; u.cdT = sp.cd * (1 - skillPct(u, 'cd') / 100); u.anim = 0.4; u.face = ang; tire(u, 'spell');
  return true;
}
function useSpecial(S, u, x, y) {
  if (!live(u) || !u.special || u.spT > 0 || u.stun > 0 || u.dashQ || u.knockQ) return false;
  cur = S; const ang = Math.atan2(y - u.y, x - u.x), sp = SPECIAL[u.special];
  if (u.special === 'spin') aoe(S, u, u.x, u.y, 80, e => hurt(S, u, e, phys(u, e, 2.2)), '#ffd34d');
  else if (u.special === 'dash') {   // 돌진: 바라보는 8방향 직선으로 최대 6칸, 빈 칸까지만 질주한 뒤 충격
    const dx = Math.round(Math.cos(ang)), dy = Math.round(Math.sin(ang)), q = []; let cx = u.tx, cy = u.ty;
    if ((!dx && !dy) || u.mv) return false;
    while (q.length < 6) { const nx = cx + dx, ny = cy + dy; if (!okTile(S, nx, ny) || S.occ[ti(nx, ny)] || !diagOk(S, cx, cy, dx, dy)) break; q.push({ tx: nx, ty: ny }); cx = nx; cy = ny; }
    if (!q.length && !(dashAny(u) && S.units.some(e => live(e) && e.team !== u.team && dist(u, e) <= 60))) return false;
    u.dashQ = q; u.dashDir = [dx, dy]; u.dashMoved = 0; ring(S, u.x, u.y, 30, '#7fd0ff', 0.3);
  }
  else if (u.special === 'volley') for (let k = -2; k <= 2; k++) shoot(S, u, x, y, 1.3, k * 0.13);
  else if (u.special === 'bless') { for (const e of S.units) if (live(e) && e.team === u.team && dist(e, u) <= 150) { const h = Math.round(e.maxHp * 0.3 * (1 + skillPct(u, 'heal') / 100)); e.hp = Math.min(e.maxHp, e.hp + h); e.ft = Math.max(0, e.ft - 20); text(S, e.x, e.y - e.r * 4, '+' + h, '#7dff9a', 'buff'); buffFx(S, e, 'heal', '#7dff9a'); } ring(S, u.x, u.y, 150, '#7dff9a', 0.6); }
  const OS = ((TITLE_EFFECT[u.subclass] || {}).onSpecial || {})[u.special];
  if (OS) { if (OS.self) addBuff(S, u, 'special', OS.self, 'atk', '#ffd34d'); if (OS.foeFt) for (const e of S.units) if (live(e) && e.team !== u.team && dist(e, u) <= (u.special === 'bless' ? 150 : 100)) foeFt(S, e, OS.foeFt); }
  u.spT = sp.cd * (1 - skillPct(u, 'cd') / 100); u.anim = 0.4; u.face = ang; tire(u, 'special');
  return true;
}

// ---------- 이동 (한 칸 = 한 명) ----------
const stepDur = (S, u, nx, ny) => TILE * (nx !== u.tx && ny !== u.ty ? 1.414 : 1) / (combatStat(S, u, 'sp') * tileMul(S, nx, ny) * ftMul(u));
const isBack = x => x.range > 0 || x.cls === 'cleric';   // 후열: 궁병·법사·성직
function canSwap(S, u, n) {   // 가만히 서 있는(이동·공격·돌진 중이 아니고 적과 맞붙지도 않은) 같은 편이 그 칸에 있으면 자리를 맞바꿔 지나갈 수 있다
  const o = n && S.units[S.occ[ti(n.tx, n.ty)] - 1];
  return o && o !== u && o.team === u.team && live(o) && (o !== o.army.ctrl || (S.auto && !o.manual)) && !(isBack(u) && !isBack(o) && u.order.type !== 'retreat' && u.order.type !== 'flee') &&   // 수동 조작 중인 캐릭터는 AI 가 밀지 못한다
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
function knockBack(S, u, dx, dy, tiles) {
  if (!live(u) || u.knockQ || u.category === 'spear') return 0;
  const q = []; let x = u.tx, y = u.ty;
  while (q.length < tiles) { const nx = x + dx, ny = y + dy; if (!okTile(S, nx, ny) || S.occ[ti(nx, ny)] || !diagOk(S, x, y, dx, dy)) break; q.push({ tx: nx, ty: ny }); x = nx; y = ny; }
  if (q.length) { u.path = null; u.knockQ = q; }
  return q.length;
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
  const gk = ti(gx, gy), phasing = u.passT > 0, free = n => n && (S.occ[ti(n.tx, n.ty)] === 0 || !!canSwap(S, u, n));
  let nxt = u.pathGoal === gk && u.path && u.path[0] || null;
  if (!free(nxt)) {
    if (u.repathT > 0 && u.stuck < 1.5) { u.path = null; nxt = null; }   // 재탐색 간격 0.3초 (오래 막혔으면 무시)
    else {
      u.repathT = 0.3; u.path = astar(S, u, gx, gy, !phasing); u.pathGoal = gk; nxt = u.path && u.path[0];
      if (phasing && u.path) { while (u.path[0] && S.occ[ti(u.path[0].tx, u.path[0].ty)]) u.path.shift(); nxt = u.path[0] || null; }
      if (!free(nxt)) {   // 부분 경로를 받았으면 dyn=false 재탐색은 건너뛴다
        if (!(u.path && u.path.partial)) { const sp = astar(S, u, gx, gy, false), want = sp && sp[0]; nxt = free(want) ? want : null; }
        if (!free(nxt)) nxt = sidestep(S, u, gx, gy); u.path = null;   // 부분 경로의 첫 칸이 막혀 있어도 그대로 밟지 않는다
      }
    }
  }
  if (!nxt) { u.waitT = 0.05 + cur.rnd() * 0.05; u.stuck += u.waitT; return 'blocked'; }
  if (u.path && u.path[0] === nxt) u.path.shift();
  const ally = S.occ[ti(nxt.tx, nxt.ty)] ? canSwap(S, u, nxt) : null;
  if (ally) beginSwap(S, u, ally); else beginStep(S, u, nxt.tx, nxt.ty, phasing ? stepDur(S, u, nxt.tx, nxt.ty) * cheb(u, nxt) : undefined);
  return 'moving';
}
function leave(S, u) {   // 후퇴(아군: 출발 시점에 가까운 가장자리로 철수, 쪽은 고정 / 적: 오른쪽 가장자리 도주) — 도착하면 필드에서 사라진다
  if (u.team === 'player' && !u.order.side) u.order.side = u.tx < MW / 2 ? -1 : 1;   // 쪽은 명령 객체에 저장 → 새 명령이면 다시 정한다
  const side = u.order.side;   // 되돌리려면 이 줄을 -1 고정으로
  const gx = u.team === 'player' ? (side < 0 ? 1 : MW - 2) : MW - 2;
  if (u.team === 'player' ? (side < 0 ? u.tx <= 1 : u.tx >= MW - 2) : u.tx >= MW - 2) {
    release(S, u); u.out = true; u.moving = false;
    if (u.team === 'player') { u.retreated = true; u.hp = u.maxHp; u.mp = u.maxMp; u.ft = 0; u.order = { type: 'idle' }; text(S, u.x, u.y, u.name + ' 철수', '#cfd3e6'); } else { u.fled = true; S.stats.fled++; }
    return;
  }
  stepToward(S, u, gx, u.ty);
}

// ---------- 유닛 AI ----------
const SIGHT = 6.5 * TILE;
function nearestEnemy(S, u, maxD) {
  let best = null, bd = maxD;
  for (const e of S.units) { if (!live(e) || e.team === u.team) continue; const d = Math.hypot(e.x - u.x, e.y - u.y); if (d < bd) { bd = d; best = e; } }
  let leader = null, ld = Math.min(maxD, bd + 3 * TILE); if (u.named) for (const e of S.units) if (live(e) && e.team !== u.team && e.isLeader) { const d = Math.hypot(e.x - u.x, e.y - u.y); if (d < ld) { ld = d; leader = e; } }
  return leader || best;
}
function inReach(u, t) { return u.range > 0 ? Math.hypot((u.tx - t.tx) * TILE, (u.ty - t.ty) * TILE) <= u.range : cheb(u, t) <= 1; }   // 근접 = 인접한 8칸
function engage(S, u, t, canMove) {
  if (!t || !live(t) || t.team === u.team) return;
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
    else if (type === 'guard') { const n = A.units.filter(v => !v.isLeader).indexOf(u); u.slot = u.isLeader ? { dx: -sgn, dy: 0 } : { dx: -sgn * Math.floor(n / 4), dy: (n % 4) - 1 }; }
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
  const h = homeOf(S, u), a = anchorOf(u.army), following = u.team === 'player' && a && a.mv;
  if (following && h && cheb(u, h) > 1) { stepToward(S, u, h.tx, h.ty); return; }   // 자유: 조작 장수가 이동 중일 때만 추종을 전투보다 우선한다
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
// ---------- 군사 AI (치유 장수의 분대 추종 · 군사의 후열 유지) ----------
const isHealer = u => u.spells.includes('heal') || u.special === 'bless';   // 치유 스킬을 쓰는 장수
const squadMates = u => { const all = (u.squad ? u.squad.units : u.army.units).filter(m => m !== u && live(m)); return all.length ? all : u.army.units.filter(m => m !== u && live(m)); };
function centroidTile(list) { let x = 0, y = 0; for (const m of list) { x += m.tx; y += m.ty; } return { tx: Math.round(x / list.length), ty: Math.round(y / list.length) }; }
function kiteFrom(S, u, foe, mates) {   // 가까운 적에게서 한 칸 물러난다 (분대 중심 쪽을 선호). 물러날 칸이 없으면 false
  const c = mates.length ? centroidTile(mates) : null; let best = null, bs = -1e9;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue; const nx = u.tx + dx, ny = u.ty + dy; if (!inMap(nx, ny) || !okTile(S, nx, ny) || S.occ[ti(nx, ny)] || !diagOk(S, u.tx, u.ty, dx, dy)) continue;
    const df = Math.hypot(nx - foe.tx, ny - foe.ty); if (df <= Math.hypot(u.tx - foe.tx, u.ty - foe.ty)) continue;
    const sc = df - (c ? 0.35 * Math.hypot(nx - c.tx, ny - c.ty) : 0); if (sc > bs) { bs = sc; best = { tx: nx, ty: ny }; }
  }
  if (!best) return false; return stepToward(S, u, best.tx, best.ty) === 'moving';
}
function healerFollow(S, u) {   // 치유 장수는 명령(정지 포함)과 상관없이 항상 자기 분대를 따라다니며, 다친 분대원 쪽으로 붙고, 적이 다가오면 분대 쪽으로 물러난다
  const mates = squadMates(u); if (!mates.length) return;
  const foe = nearestEnemy(S, u, TILE * 4); if (foe && cheb(u, foe) <= 2 && kiteFrom(S, u, foe, mates)) return;
  let w = null, wr = 0.7; for (const m of mates) { const r = m.hp / m.maxHp; if (r < wr) { wr = r; w = m; } }
  if (w) { if (cheb(u, w) > 2) stepToward(S, u, w.tx, w.ty); return; }
  const c = centroidTile(mates); if (cheb(u, c) > 2) stepToward(S, u, c.tx, c.ty);
}
function autoAbilities(S, u, aggressive) {   // 성직자 치유 / 법사 광역 마법 / 특수기 자동 사용 — 썼으면 true
  if (u.cdT > 0 || u.stun > 0) return false;
  if (u.cls === 'cavalry' && u.special === 'dash' && u.spT <= 0) { const any = dashAny(u), t = nearestEnemy(S, u, any ? 1e9 : SPECIAL.dash.range); if (t && (any || dist(u, t) > TILE * 1.5) && useSpecial(S, u, t.x, t.y)) return true; }
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
    else if (u.special !== 'dash') { const t = nearestEnemy(S, u, u.special === 'volley' ? u.range : 70); if (t && useSpecial(S, u, t.x, t.y)) return true; }
  }
  return false;
}
function updateUnit(S, u, dt) {
  u.cdT -= dt; u.spT -= dt; u.root -= dt; u.hitT -= dt; u.flash -= dt; u.anim -= dt; u.waitT -= dt; u.repathT -= dt; u.thinkT -= dt; u.passT -= dt; u.ftDebuffT -= dt; if (u.buffs) { for (const b of u.buffs) b.t -= dt; u.buffs = u.buffs.filter(b => b.t > 0); } u.moving = false;
  const HT = (TITLE_EFFECT[u.subclass] || {}).hp; if (HT) { if (u.hp <= u.maxHp * HT.below && !u.hpTrig) { u.hpTrig = true; addBuff(S, u, 'hp', HT.mods, HT.glyph, HT.col); text(S, u.x, u.y - u.r * 5, HT.text, HT.col, 'buff'); ring(S, u.x, u.y, 36, HT.col, 0.5); } else if (u.hp > u.maxHp * HT.below) u.hpTrig = false; }
  if (!u.mv && !u.dashQ && !u.knockQ && u.anim <= 0 && u.hitT <= 0 && S.t - u.lastHurt > 3 && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * combatStat(S, u, 'hr') * 0.001 * dt);   // HR: 서 있는 동안 체력이 조금씩 찬다
  if (u.maxMp && u.mp < u.maxMp) u.mp = Math.min(u.maxMp, u.mp + 0.6 * dt);
  u.ft = Math.max(0, u.ft - FT.recover * FT.eff * dt);
  if (u.stun > 0) { u.stun -= dt; return; }
  if (u.mv) { advanceMove(S, u, dt); if (u.mv) return; }   // 한 칸을 걷는 동안에는 다른 행동을 하지 않는다. 칸에 도착하면 같은 틱에 다음 입력·행동을 이어서 처리 (끊김 없이)
  if (u.knockQ) { const n = u.knockQ.shift(); if (n && !S.occ[ti(n.tx, n.ty)]) { beginStep(S, u, n.tx, n.ty, 0.08); advanceMove(S, u, 0); return; } u.knockQ = null; return; }
  if (u.dashQ) {
    const n = u.dashQ.shift();
    if (n && !S.occ[ti(n.tx, n.ty)]) { u.dashMoved++; beginStep(S, u, n.tx, n.ty, 0.06); advanceMove(S, u, 0); return; }
    const [dx, dy] = u.dashDir || [Math.round(Math.cos(u.face)), Math.round(Math.sin(u.face))], push = Math.max(1, Math.ceil((u.dashMoved || 1) / 2));
    u.dashQ = null; u.passT = SPECIAL.dash.pass;
    const D = (TITLE_EFFECT[u.subclass] || {}).dash, sc = (D && D.scale) || 1;
    aoe(S, u, u.x, u.y, 60, e => { const moved = knockBack(S, e, dx, dy, push); hurt(S, u, e, phys(u, e, 2 + moved * 0.5)); if (live(e) && D && D.foeFt) foeFt(S, e, D.foeFt, sc); }, '#7fd0ff');
    if (D && D.self) addBuff(S, u, 'dash', D.self, D.glyph || 'atk', D.col || '#ffd34d', sc); return;
  }
  let o = u.order;
  if (o.type === 'retreat' || o.type === 'flee') return leave(S, u);
  const ctrl = u === u.army.ctrl && u.team === 'player';
  if (ctrl && (!S.auto || u.manual) && u.ctrlIn && S.t - u.ctrlIn.t < 0.12) { if (u.cls === 'cavalry' && autoAbilities(S, u, true)) return; directMove(S, u, u.ctrlIn.dx, u.ctrlIn.dy); return; }   // 수동 기병도 이동보다 준비된 돌격을 우선한다
  if (ctrl && S.auto && !u.manual && o.type === 'stop') o = u.order = { type: 'idle' };   // 자동 전투 중에는 조작 캐릭터도 AI 가 움직인다
  if (o.type === 'charge' && u.autoCharge && !S.auto) o = u.order = { type: ctrl ? 'stop' : 'idle' };   // 자동전투를 끄면 자동으로 돌격 중이던 유닛은 평상시로
  if (o.type === 'idle' && ((S.auto && u.team === 'player' && !u.manual) || u.army.state === 'advance')) { o = u.order = { type: 'charge' }; u.autoCharge = u.team === 'player'; }
  const aggressive = u.team === 'enemy' || (S.auto && !u.manual) || o.type === 'charge';
  if (autoAbilities(S, u, aggressive)) return;
  if (isHealer(u) && !(u === u.army.ctrl && u.team === 'player' && (u.manual || !S.auto))) { healerFollow(S, u); return; }   // 치유 장수: 항상 분대 추종 (직접 조작 중일 때만 예외)
  if (u.cls === 'cleric') {   // 치유 스킬이 없는 성직자는 직접 싸우지 않고, 정지·고정이 아니면 조작 캐릭터(없으면 대장) 곁을 따라다닌다
    if (o.type !== 'stop') { const c = u.army.ctrl, a = c && c !== u && live(c) ? c : u.army.leader; if (a && a !== u && live(a) && cheb(u, a) > 2) stepToward(S, u, a.tx, a.ty); }
    return;
  }
  if (u.cls === 'mage' && !(u === u.army.ctrl && u.team === 'player' && (u.manual || !S.auto))) { const foe = nearestEnemy(S, u, TILE * 4); if (foe && cheb(u, foe) <= 2 && S.units.some(m => m !== u && live(m) && m.team === u.team && !isBack(m)) && kiteFrom(S, u, foe, squadMates(u).filter(m => !isBack(m)))) return; }   // 군사(법사): 전열 뒤에서 싸운다 — 적이 2칸 안으로 붙으면 물러난다
  if (o.type === 'attack') { if (!o.target || !live(o.target) || o.target.team === u.team) { u.order = { type: 'idle' }; return; } engage(S, u, o.target, true); return; }
  if (o.type === 'charge' && u.team === 'enemy' && u.army.state === 'advance') return advanceUnit(S, u);
  if (o.type === 'charge') {
    const stale = !o.tgt || !live(o.tgt) || o.tgt.team === u.team;   // 투항해 같은 편이 된 대상을 계속 노리며 멈춰 서지 않게
    if (stale || u.thinkT <= 0) { const n = nearestEnemy(S, u, 1e9); if (stale || (n && dist(u, n) < dist(u, o.tgt) * 0.7)) o.tgt = n; u.thinkT = 0.5; }
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
    if (p.kind === 'ball') { if (Math.hypot(p.tx - p.x, p.ty - p.y) <= st + 2) { p.done = true; aoe(S, p.from, p.tx, p.ty, sp.r, e => hurt(S, p.from, e, magicDmg(sp, e, p.from)), sp.col); continue; } }
    else { p.left -= st; if (p.left <= 0) { p.done = true; continue; } }
    p.x += sx; p.y += sy;
    if (p.kind === 'ball') continue;
    if (S.map[tileOf(p.x, p.y + 12)] === ROCK) { p.done = true; continue; }   // 바위는 화살·마법을 막는다
    for (const e of S.units) {
      if (!live(e) || e.team === p.team || (p.hit && p.hit.has(e))) continue;
      if (Math.hypot(e.x - p.x, e.y - e.r * 1.4 - p.y) < e.r + 4) {
        if (p.kind === 'arrow') { arrowHit(S, p, e); p.done = true; break; }
        if (p.kind === 'pierce') { p.hit.add(e); hurt(S, p.from, e, magicDmg(sp, e, p.from)); continue; }   // 관통
        p.done = true;   // 장풍·불공: 맞은 적에서 끝 (불공은 작은 폭발)
        if (p.kind === 'roll') aoe(S, p.from, e.x, e.y, sp.r, t => hurt(S, p.from, t, magicDmg(sp, t, p.from)), sp.col); else hurt(S, p.from, e, magicDmg(sp, e, p.from));
        break;
      }
    }
  }
  S.proj = S.proj.filter(p => !p.done);
}

// ---------- 적 군단 AI / 종료 판정 ----------
function enemyAI(S) {
  for (const A of S.armies) tryHpRetreat(S, A);
  for (const A of S.armies) if (A.team === 'enemy' && A.routed && A.nextRoutCheck && S.t >= A.nextRoutCheck && tryRout(S, A)) notice(S, 'enemy', '적 ' + A.name + '가 사기 저하로 후퇴합니다.');
  let field = S.units.filter(u => u.team === 'enemy' && live(u)).length;
  for (const A of S.armies) if (A.team === 'enemy' && A.state === 'reserve') {
    if (A.stagedReserve && S.t < A.reserveAt && !S.armies.some(B => B.team === 'enemy' && B !== A && B.routed)) continue;
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
  else if (!S.explore && !S.units.some(u => u.team === 'enemy' && !u.dead && !u.fled)) S.over = 'win';
}
function step(S, dt) {
  if (S.over) return;
  cur = S; S.t += dt; enemyAI(S); commanderDialogue(S);
  for (const k of ['player', 'enemy']) { if (S.lock[k] > 0) S.lock[k] -= dt; if (S.lockAI[k] > 0) S.lockAI[k] -= dt; }
  for (const A of S.armies) if (A.team === 'player' && (!A.ctrl || !live(A.ctrl))) setCtrl(S, A, A.units.find(live));   // 조작 캐릭터가 쓰러지거나 철수하면 다음 캐릭터로
  const order = S.units.filter(live); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(S.rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  for (const u of order) if (live(u)) updateUnit(S, u, dt);
  updateAuras(S);   // 처리 순서를 매 틱 섞는다 (먼저 만든 군단이 빈 칸을 독점하지 않게)
  updateProj(S, dt);
  for (const l of S.later) { l.t -= dt; if (l.t <= 0) l.fn(); } S.later = S.later.filter(l => l.t > 0);
  for (const f of S.fx) f.t -= dt; S.fx = S.fx.filter(f => f.t > 0);
  for (const x of S.texts) { x.t -= dt; x.y -= 22 * dt; } S.texts = S.texts.filter(x => x.t > 0);
  checkEnd(S);
}

// ---------- 명령 (UI → 시뮬레이션) ----------
const mine = units => units.filter(u => live(u) && u.team === 'player');
function releaseManualControl(S, except) {
  if (!S.auto) return;
  for (const u of S.units) if (u !== except && u.team === 'player' && u.manual) { u.manual = false; u.ctrlIn = null; if (u.order.type !== 'retreat') { u.order = { type: 'charge' }; u.autoCharge = true; u.path = null; } }
}
// 퍼스트퀸4 조작: 군단마다 "조작 캐릭터" 한 명을 직접 움직이고(방향 입력 = 한 칸 이동, 적이 있는 칸으로 밀면 공격), 나머지는 AI + 군단 명령(돌격·정지·후퇴·자유)
function setCtrl(S, A, u) {
  if (!u || !live(u)) return;
  releaseManualControl(S, u); if (A.ctrl === u) return;
  const old = A.ctrl; A.ctrl = u; u.manual = false; if (u.order.type !== 'retreat') u.order = { type: S.auto ? 'charge' : 'stop' }; u.ctrlIn = null; u.autoCharge = S.auto; u.path = null;
  if (old && live(old) && old.order.type !== 'retreat') { old.order = { type: S.auto ? 'charge' : A.order }; old.ctrlIn = null; old.manual = false; old.autoCharge = S.auto; }   // 풀려난 캐릭터는 군단 명령을 따른다
}
function takeControl(S, u) { if (S.auto && u.team === 'player' && u === u.army.ctrl && !u.manual) { releaseManualControl(S, u); u.manual = true; u.order = { type: 'stop' }; u.autoCharge = false; u.path = null; } }
function control(S, u, dx, dy) { takeControl(S, u); u.ctrlIn = { dx, dy, t: S.t }; }   // 자동 중에는 현재 장수만 수동으로 전환
function directMove(S, u, dx, dy) {
  if (u.root > 0) return;   // 속박(거미줄) 중에는 걷지 못한다
  let nx = u.tx + dx, ny = u.ty + dy; u.face = Math.atan2(dy, dx);
  let eid = inMap(nx, ny) ? S.occ[ti(nx, ny)] : 0;
  if (eid && u.passT > 0) while (eid && okTile(S, nx + dx, ny + dy) && diagOk(S, nx, ny, dx, dy)) { nx += dx; ny += dy; eid = S.occ[ti(nx, ny)]; }
  const e = eid && S.units.find(x => x.id === eid);
  if (e && e.team !== u.team) { if (u.cdT <= 0 && diagOk(S, u.tx, u.ty, dx, dy)) { cur = S; u.cdT = u.cd; u.anim = 0.28; tire(u, 'hit'); hurt(S, u, e, phys(u, e, u.range > 0 ? 0.5 : 1)); } return; }   // 밀어붙이기 = 공격 (원거리 병종은 약하게)
  if (e && e.team === u.team) { if (canSwap(S, u, { tx: nx, ty: ny })) beginSwap(S, u, e); return; }   // 아군은 자리를 맞바꿔 지나간다
  if (okTile(S, nx, ny) && !eid && diagOk(S, u.tx, u.ty, dx, dy)) beginStep(S, u, nx, ny, u.passT > 0 ? stepDur(S, u, nx, ny) * cheb(u, { tx: nx, ty: ny }) : undefined);
}
function aimAt(S, u, range) {   // 바라보는 방향 ±55° 안의 가장 가까운 적, 없으면 정면 150px
  let best = null, bd = range;
  for (const e of S.units) { if (!live(e) || e.team === u.team) continue; const d = dist(u, e), a = Math.atan2(e.y - u.y, e.x - u.x); if (d < bd && Math.cos(a - u.face) > 0.57) { bd = d; best = e; } }
  return best ? [best.x, best.y] : [u.x + Math.cos(u.face) * 150, u.y + Math.sin(u.face) * 150];
}
function action(S, u, alt) {   // Space(주): 마법 > 특수기 > 화살 / X(보조): 마법 보유자는 특수기, 그 밖은 화살
  if (!live(u) || u.stun > 0) return false; takeControl(S, u); cur = S;
  const sel = !alt && u.spells.length, sp = sel ? u.spells[u.spellSel] : null;
  if (sp === 'heal') { let t = null, bd = 1; for (const e of S.units) if (live(e) && e.team === u.team && e.hp / e.maxHp < bd && dist(u, e) <= SPELL.heal.range) { bd = e.hp / e.maxHp; t = e; } return t ? castSpell(S, u, 'heal', t.x, t.y) : false; }
  if (sp) { const [x, y] = aimAt(S, u, SPELL[sp].range); return castSpell(S, u, sp, x, y); }
  if (u.special && (!alt || u.spells.length)) { const [x, y] = aimAt(S, u, u.special === 'volley' ? u.range : u.special === 'dash' ? 1e9 : 150); return useSpecial(S, u, x, y); }
  if (u.range > 0 && u.cdT <= 0 && u.cls !== 'mage') { const [x, y] = aimAt(S, u, u.range); u.face = Math.atan2(y - u.y, x - u.x); u.cdT = u.cd; u.anim = 0.28; tire(u, 'hit'); shoot(S, u, x, y); return true; }
  return false;
}
function selectSpell(u, i) { if (u.spells[i]) u.spellSel = i; }
function setAuto(S, on) {
  S.auto = on;
  for (const u of S.units) if (live(u) && u.team === 'player') {
    u.manual = false;
    if (on) { u.order = { type: 'charge' }; u.autoCharge = true; u.path = null; }
  }
}
function armyOrder(S, A, type, directCtrl = A.ctrl) {   // 현재 직접 조작 중인 캐릭터만 제외 (후퇴는 전원)
  if (type === 'retreat' && A.order !== 'retreat') notice(S, A.team, (A.team === 'player' ? '아군 ' : '적 ') + A.name + '가 후퇴합니다.');
  A.order = type;
  for (const u of A.units) if (live(u) && (u !== directCtrl || type === 'retreat')) { u.order = { type }; u.path = null; u.autoCharge = false; }
}
function focus(S, A, target) { for (const u of A.units) if (live(u) && u !== A.ctrl && u.cls !== 'cleric') { u.order = { type: 'attack', target }; u.path = null; u.autoCharge = false; } }   // 적을 클릭 = 군단이 그 적에게 집중 공격
function recall(S, u, quiet = false, directCtrl = u.army.ctrl) {   // 아직 참전하지 않은 지원군만 출진할 수 있다.
  if (!u.out || u.retreated || u.fled || u.dead || u.team !== 'player') return false;
  for (let k = 0; k < 80; k++) {
    const tx = 3 + Math.floor(S.rnd() * 4), ty = 14 + Math.floor(S.rnd() * 14);
    if (okTile(S, tx, ty) && !S.occ[ti(tx, ty)]) { u.tx = tx; u.ty = ty; u.x = tcx(tx); u.y = tcy(ty); S.occ[ti(tx, ty)] = u.id; u.out = false; u.order = { type: u === directCtrl ? 'stop' : u.army.order }; u.path = null; text(S, u.x, u.y - 40, u.name + ' 출진', '#7dff9a'); if (!quiet) notice(S, 'player', '아군 ' + u.name + ' 참전!'); return true; }
  }
  return false;
}
function deployArmy(S, A, directCtrl = A.ctrl, quiet = false) {
  let count = 0;
  if (A.team === 'player') {
    for (const u of A.units) if (recall(S, u, true, directCtrl)) count++;
    if (count) {
      A.state = A.support ? 'player' : 'advance'; A.order = A.support ? 'idle' : 'charge';
      for (const u of A.units) if (live(u)) { u.order = { type: A.support && !S.auto ? 'idle' : 'charge' }; u.autoCharge = A.support && S.auto; }
      setFormation(A, A.formation);
    }
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
  if (count && !quiet) notice(S, A.team, (A.team === 'player' ? '아군 ' : '적 ') + A.name + '가 참전했습니다.');
  return count;
}
function unitAt(S, wx, wy, team) {   // 월드 좌표에서 (몸+머리 높이까지) 클릭된 유닛
  let best = null, bd = 1e9;
  for (const u of S.units) { if (!live(u) || (team && u.team !== team)) continue; const d = Math.hypot(u.x - wx, (u.y - u.r * 1.6) - wy); if (d < Math.max(u.r * 2.2, 24) && d < bd) { bd = d; best = u; } }
  return best;
}

return { TITLE_EFFECT, titleDesc, addBuff, effectiveFt, TITLE_BONUS, AURA_RANGE, XP_NEED, levelStats, GRADE, GRADE_MUL, ITEMS, ITEM_STATS, itemBase, unitCategory, unitSubclass, combatStat, MATCHUP_BONUS, RETREAT_HP, RETREAT_CORPS_HP, baseMaxHp, statPower, unitStats, unitPower, corpsPower, battlePower, POWER_W, CAPTAIN, ELITE, CLONES, stepToward, prof, fatigueMultiplier: ftMul, TILE, MW, MH, WW, WH, U, CLS_NAME, CATEGORY_NAME, FORMATION_NAME, SPELL, SPECIAL, ARMIES, ARMY_MAX, SQUAD_MAX, matchup, classMultiplier, createBattle, step, setCtrl, setFormation, setAuto, control, action, selectSpell, armyOrder, focus, castSpell, useSpecial, recall, deployArmy, unitAt, live, ti };
})();
if (typeof module !== 'undefined') module.exports = Sim;
