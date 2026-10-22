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
const MAX_SIM_STEPS = 12;   // 느린 프레임에서 배속 연산이 한꺼번에 몰려 브라우저가 멈추는 것을 방지
// 방향 입력: 숫자패드(NumLock 꺼져 있어도 code 는 Numpad*) + 노트북용 WASD/QEZC
const DIRS = { Numpad7: [-1, -1], Numpad8: [0, -1], Numpad9: [1, -1], Numpad4: [-1, 0], Numpad6: [1, 0], Numpad1: [-1, 1], Numpad2: [0, 1], Numpad3: [1, 1], KeyQ: [-1, -1], KeyW: [0, -1], KeyE: [1, -1], KeyA: [-1, 0], KeyD: [1, 0], KeyZ: [-1, 1], KeyS: [0, 1], KeyC: [1, 1] };
const PAD = [[7, -1, -1, '↖'], [8, 0, -1, '↑'], [9, 1, -1, '↗'], [4, -1, 0, '←'], [5, 0, 0, '행동'], [6, 1, 0, '→'], [1, -1, 1, '↙'], [2, 0, 1, '↓'], [3, 1, 1, '↘']];   // 보조키 윈도우: 숫자패드 배열

let S = null, terrain = null, state = 'title', T = 0, overAt = 0, paused = false, menuOpen = false, supportOpen = false, titleNotice = '';
// 원정 지도는 퍼스트퀸4 방식의 거점 이동용 최소 흐름이다. 전투 규칙·편성은 기존 Sim 전투를 그대로 쓴다.
const STAGES = [
  { id: 'chenliu', name: '진류', region: '연주', faction: '여포', stage: 1, level: 2, difficulty: '초급', note: '출발·정비', theme: 'plains', x: 850, y: 90, owner: 'player', links: ['puyang'], reinforce: 0, mapSeed: 5 },
  { id: 'puyang', name: '복양', region: '연주', faction: '조조', stage: 2, level: 2, difficulty: '초급', note: '평야 전초', theme: 'plains', x: 740, y: 175, owner: 'enemy', links: ['chenliu', 'dingtao'], reinforce: 1, mapSeed: 7 },
  { id: 'dingtao', name: '정도', region: '연주', faction: '조조', stage: 3, level: 4, difficulty: '초급', note: '강가 넓은 여울', theme: 'riverside', wideRiver: true, x: 620, y: 270, owner: 'enemy', links: ['puyang', 'changyi', 'xiapi'], reinforce: 1, mapSeed: 11 },
  { id: 'changyi', name: '창읍', region: '연주', faction: '조조', stage: 4, level: 6, difficulty: '중급', note: '평야 교전', theme: 'plains', x: 470, y: 215, owner: 'enemy', links: ['dingtao', 'rencheng'], reinforce: 2, mapSeed: 13 },
  { id: 'xiapi', name: '하비', region: '서주', faction: '유비', stage: 5, level: 8, difficulty: '중급', note: '성채 전초', theme: 'fortress', x: 610, y: 395, owner: 'enemy', links: ['dingtao', 'xiaopei'], reinforce: 2, mapSeed: 17 },
  { id: 'rencheng', name: '임성', region: '연주', faction: '조조', stage: 6, level: 10, difficulty: '중급', note: '산악 협로', theme: 'mountain', x: 350, y: 310, owner: 'enemy', links: ['changyi', 'tanxian'], reinforce: 3, mapSeed: 19 },
  { id: 'xiaopei', name: '소패', region: '서주', faction: '유비', stage: 7, level: 14, difficulty: '상급', note: '평야 방어선', theme: 'plains', x: 530, y: 500, owner: 'enemy', links: ['xiapi', 'pengcheng'], reinforce: 3, mapSeed: 23 },
  { id: 'pengcheng', name: '팽성', region: '서주', faction: '유비', stage: 8, level: 18, difficulty: '상급', note: '강가 도하', theme: 'riverside', wideRiver: true, x: 430, y: 575, owner: 'enemy', links: ['xiaopei', 'guangling'], reinforce: 4, mapSeed: 29 },
  { id: 'guangling', name: '광릉', region: '서주', faction: '유비', stage: 9, level: 24, difficulty: '최상', note: '강가 관문', theme: 'riverside', wideRiver: true, x: 260, y: 440, owner: 'enemy', links: ['pengcheng', 'tanxian'], reinforce: 4, mapSeed: 31 },
  { id: 'tanxian', name: '담현', region: '서주', faction: '유비', stage: 10, level: 30, difficulty: '최상', note: '성채 결전', theme: 'fortress', x: 310, y: 620, owner: 'enemy', links: ['rencheng', 'guangling'], reinforce: 5, mapSeed: 37 },
];
const START_STAGE = 'chenliu', FINAL_STAGE = 'tanxian';
const stageById = id => STAGES.find(s => s.id === id);
const BASE_ENEMIES = Sim.ARMIES.filter(a => a.team === 'enemy');
const RESERVE_LEADERS = ['guo', 'xuchu', 'zhanghe', 'machao', 'xuhuang', 'zhangfei', 'pangtong', 'jiangwei', 'weiyan'];
const THEME_NAME = { plains: '평야', mountain: '산악', riverside: '강가', fortress: '성채' };
const FACTION_STYLE = {
  '여포': { main: '#2e77c7', light: '#cce8ff', dark: '#163b70' },
  '조조': { main: '#b84338', light: '#ffd4c9', dark: '#68221f' },
  '유비': { main: '#d2a82e', light: '#fff0a3', dark: '#705616' },
};
const stageFaction = stage => stage.owner === 'player' ? '여포' : stage.faction;
const THEME_UNITS = { plains: ['ecav', 'esword', 'earcher'], mountain: ['esword', 'eshield', 'earcher'], riverside: ['earcher', 'esword', 'eshield'], fortress: ['eshield', 'earcher', 'esword'] };
const ROUT_CHANCE = { 초급: 0.09, 중급: 0.075, 상급: 0.055, 최상: 0.035 };
const EARLY_SUPPORT = { xiapi: 12, rencheng: 10, tanxian: 6 };
const EXPEDITION_INTERVAL = 5, EXPEDITION_PER_CITY = 1;   // 도시당 기본 원정 군단 수 (v0.1.126: 2 → 1, 절반)
const GARRISON_BY_STAGE = [0, 0, 3, 4, 4, 5, 5, 6, 6, 7, 7], garrisonTarget = stage => GARRISON_BY_STAGE[stage.stage] || 7;
const tripleEnemyUnits = (units, pool, offset = 0) => units.concat(Array.from({ length: Math.min(Sim.ARMY_MAX, units.length * 3) - units.length }, (_, n) => pool[(offset + n) % pool.length]));
function enemyGrowth(key, level) { const st = Sim.levelStats(key, 'enemy', level); return { ...st, xp: 0 }; }   // 레벨업 규칙(명세 21)과 같은 가산 성장
function ensureEnemyLeader(key, name) { if (!Sim.U[key]) Sim.U[key] = { ...Sim.U.ecap, name, synthetic: true }; return key; }   // synthetic: 역사 인물이 아닌 가상 지휘관 (전투 중 군단장일 때만 이름 표기)
function expeditionLeader(stage, wave) { return ensureEnemyLeader(`exp_${stage.id}_${wave}`, `${stage.faction}군 원정 지휘관 ${wave}차`); }
function setEnemyRole(force, stage, role, level = stage.level) {
  const unit = Sim.U[force.army.leader], n = force.wave || String(force.army.leader).match(/_(\d+)$/)?.[1], label = role === 'garrison' ? '수비' : '원정';
  force.role = role; force.home = force.home || stage.id; force.level = level; force.army.role = role;
  if (unit && unit.synthetic) { unit.name = force.wave ? `${stage.faction}군 원정 지휘관 ${n}차` : `${stage.faction}군 ${stage.name} ${label}대장${n ? ' ' + n : ''}`; force.leaderName = unit.name; }
  force.army.name = unit && !unit.synthetic ? `${stage.faction}군 · ${unit.name} 부대` : `${stage.faction}군 · ${label}군${n ? ' ' + n : ''}`;
  force.army.growth = force.army.units.map(key => enemyGrowth(key, level)); return force;
}
const enemyForces = [];
function addEnemyRoleForce(stage, role, n, at, offset = 0) {
  const label = role === 'garrison' ? '수비' : '원정', leader = ensureEnemyLeader(`role_${stage.id}_${role}_${n}`, `${stage.faction}군 ${stage.name} ${label}대장 ${n}`), pool = THEME_UNITS[stage.theme], units = tripleEnemyUnits([leader, ...pool, ...pool], pool, offset);
  const force = setEnemyRole({ id: Math.max(-1, ...enemyForces.map(f => f.id)) + 1, at: stage.id, active: true, leaderName: Sim.U[leader].name, army: { team: 'enemy', name: '', at, leader, reserve: true, reserveAt: role === 'garrison' ? 8 : 12, leaderRear: stage.stage >= 7, formation: stage.stage >= 7 ? 'guard' : 'block', units, trig: { near: 12, t: 60 } } }, stage, role);
  enemyForces.push(force);
}
for (let i = 0; i < BASE_ENEMIES.length; i++) {
  const stage = STAGES[i + 1], army = BASE_ENEMIES[i], pool = THEME_UNITS[stage.theme], add = stage.reinforce, protect = stage.stage >= 7;
  const units = army.units.concat(Array.from({ length: add }, (_, n) => pool[(i + n) % pool.length]));
  enemyForces.push(setEnemyRole({ id: enemyForces.length, at: stage.id, active: true, army: { ...army, leaderRear: protect, formation: protect ? 'guard' : 'block', units: tripleEnemyUnits(units, pool, i) } }, stage, 'garrison'));
  const leader = RESERVE_LEADERS[i], size = Math.min(8, 3 + Math.ceil(stage.stage / 2));
  const reserveUnits = [leader, ...Array.from({ length: size - 1 }, (_, n) => pool[(i + n + 1) % pool.length])];
  enemyForces.push(setEnemyRole({ id: enemyForces.length, at: stage.id, active: true, army: { team: 'enemy', name: '', at: army.at, leader, reserve: true, reserveAt: EARLY_SUPPORT[stage.id] ?? 20, leaderRear: protect, formation: protect ? 'guard' : 'block', units: tripleEnemyUnits(reserveUnits, pool, i + 1), trig: { near: 12, t: 60 } } }, stage, 'expedition'));
  for (let n = 2; n <= garrisonTarget(stage); n++) addEnemyRoleForce(stage, 'garrison', n, army.at, i + n);
  for (let n = 2; n <= EXPEDITION_PER_CITY; n++) addEnemyRoleForce(stage, 'expedition', n, army.at, i + n + 7);
}
function fillEnemyRoleRatio() {
  for (const stage of STAGES.slice(1).filter(s => s.owner === 'enemy')) for (const [role, target] of [['garrison', garrisonTarget(stage)], ['expedition', EXPEDITION_PER_CITY]]) {
    let count = enemyForces.filter(f => f.active && f.home === stage.id && f.role === role).length;
    let n = 1;
    while (count < target) { while (enemyForces.some(f => f.army.leader === `role_${stage.id}_${role}_${n}`)) n++; addEnemyRoleForce(stage, role, n, BASE_ENEMIES[stage.stage - 2]?.at || [45, 20], stage.stage + ++count); }   // 전멸한 군단의 장수 키와 겹치지 않는 번호를 쓴다
  }
}
function applyGarrisonCurve() { for (const stage of STAGES.slice(1)) enemyForces.filter(f => f.active && f.home === stage.id && f.role === 'garrison').slice(garrisonTarget(stage)).forEach(f => f.active = false); fillEnemyRoleRatio(); }
const stageEnemyCount = stage => enemyForces.filter(f => f.active && f.at === stage.id).reduce((n, f) => n + f.army.units.length, 0);
const campaign = { at: START_STAGE, corps: 0, from: null, battle: null, explore: false, invasion: false, destination: null, movement: [], movementPage: 0, pendingEncounter: null, responsePage: 0, intel: [], turn: 1, frontlineHp50: true, hp30v1: true, hp50v2: true, enemyRolesLv1: true, enemyWavesLv2: true, enemyRatioLv3: true, enemyRatioLv4: true, enemyCurveV1: true, uniqueItemsV1: true, expeditionWaves: {}, rewarded: {}, items: { ironsword: 2, armor: 2, bowguard: 1, charm: 1, seal_ar: 1, seal_dr: 1, green_dragon: 1, twin_halberd: 1, sky_halberd: 0 }, notice: '진류에서 연주·서주 원정을 시작한다.' };
// 원정 지도 편성: 기존 본대·기마대·궁병대는 한 군단의 1·2·3분대다.
const ROSTER_MAX = 100;
const roster = [
  { id: 1, name: '신규 군단 1', at: START_STAGE, target: null, units: Sim.ARMIES.filter(a => a.team === 'player').flatMap(a => a.units), growth: [{ item: 'sky_halberd' }, ...Array(17).fill(null)] },
  { id: 2, name: '신규 군단 2', at: START_STAGE, target: null, units: ['gao', 'sword', 'shield', 'sword', 'shield', 'spear', 'chengong', 'mage', 'mage', 'shield', 'sword', 'spear', 'lulingqi', 'cav', 'cav', 'cav', 'archer', 'archer'], growth: Array(18).fill(null) },
];
const SAVE_KEY = 'sgsp-campaign-v1', SAVE_VERSION = 3, SAVE_SLOTS = 3,   // v3: 연주·서주와 여포군 시나리오 — 이전 저장은 호환되지 않는다
  INITIAL_CAMPAIGN = JSON.stringify({ owners: STAGES.map(s => s.owner), enemyForces, roster });
let activeSaveSlot = 1, saveSlotMode = null;
const saveKey = slot => `${SAVE_KEY}-${slot}`;
function resetCampaignData() {
  const data = JSON.parse(INITIAL_CAMPAIGN); STAGES.forEach((s, i) => s.owner = data.owners[i]); enemyForces.splice(0, enemyForces.length, ...data.enemyForces); roster.splice(0, roster.length, ...data.roster);
  Object.assign(campaign, { at: START_STAGE, corps: 0, from: null, battle: null, explore: false, invasion: false, destination: null, movement: [], movementPage: 0, pendingEncounter: null, responsePage: 0, intel: [], turn: 1, frontlineHp50: true, hp30v1: true, hp50v2: true, enemyRolesLv1: true, enemyWavesLv2: true, enemyRatioLv3: true, enemyRatioLv4: true, enemyCurveV1: true, uniqueItemsV1: true, expeditionWaves: {}, rewarded: {}, items: { ironsword: 2, armor: 2, bowguard: 1, charm: 1, seal_ar: 1, seal_dr: 1, green_dragon: 1, twin_halberd: 1, sky_halberd: 0 }, notice: '진류에서 연주·서주 원정을 시작한다.' });
}
function saveCampaign(slot = activeSaveSlot) {
  activeSaveSlot = slot;
  try { localStorage.setItem(saveKey(slot), JSON.stringify({ ver: SAVE_VERSION, owners: STAGES.map(s => s.owner), enemyForces, roster, campaign: { ...campaign, battle: campaign.battle && campaign.battle.id, pendingEncounter: campaign.pendingEncounter && { ...campaign.pendingEncounter, stage: campaign.pendingEncounter.stage.id } } })); } catch (e) { /* 저장소를 못 쓰면 현재 플레이는 계속한다 */ }
}
const rawSave = slot => localStorage.getItem(saveKey(slot)) || (slot === 1 ? localStorage.getItem(SAVE_KEY) : '') || '';
function readCampaign(slot = activeSaveSlot) { try { const d = JSON.parse(rawSave(slot) || 'null'); return d && d.ver === SAVE_VERSION ? d : null; } catch (e) { return null; } }
function staleSave(slot) { try { const raw = rawSave(slot); return !!raw && !readCampaign(slot); } catch (e) { return false; } }   // 이전 규칙으로 저장된 데이터
function hasCampaign(slot = null) { try { return slot ? !!readCampaign(slot) : Array.from({ length: SAVE_SLOTS }, (_, i) => i + 1).some(hasCampaign); } catch (e) { return false; } }
function restoreCampaign(data) {
  if (!data || !Array.isArray(data.owners) || data.owners.length !== STAGES.length || !Array.isArray(data.enemyForces) || !Array.isArray(data.roster) || !data.roster.length || !data.campaign || data.roster.some(c => !stageById(c.at) || !Array.isArray(c.units)) || data.enemyForces.some(f => !stageById(f.at) || !f.army)) return false;
  const battle = data.campaign.battle && stageById(data.campaign.battle), pendingStage = data.campaign.pendingEncounter && stageById(data.campaign.pendingEncounter.stage); if (data.campaign.battle && !battle || data.campaign.pendingEncounter && !pendingStage) return false;
  STAGES.forEach((s, i) => s.owner = data.owners[i]); enemyForces.splice(0, enemyForces.length, ...data.enemyForces); roster.splice(0, roster.length, ...data.roster);
  for (const force of enemyForces) if (force.leaderName) ensureEnemyLeader(force.army.leader, force.leaderName); else if (force.wave) expeditionLeader(stageById(force.home) || stageById(force.at), force.wave);
  if (!data.campaign.frontlineHp50) { const frontline = ['sword', 'spear', 'shield', 'esword', 'eshield']; for (const corps of roster) (corps.growth || []).forEach((g, i) => { if (g && frontline.includes(corps.units[i])) g.maxHp = Math.round(g.maxHp * 0.5); }); data.campaign.frontlineHp50 = true; }
  if (!data.campaign.hp30v1) { for (const group of [...roster.map(c => c.growth), ...enemyForces.map(f => f.army.growth)]) for (const g of group || []) if (g && Number.isFinite(g.maxHp)) g.maxHp = Math.max(1, Math.round(g.maxHp * 0.3)); data.campaign.hp30v1 = true; }
  if (!data.campaign.hp50v2) { for (const group of [...roster.map(c => c.growth), ...enemyForces.map(f => f.army.growth)]) for (const g of group || []) if (g && Number.isFinite(g.maxHp)) g.maxHp = Math.max(1, Math.round(g.maxHp * 5 / 3)); data.campaign.hp50v2 = true; }
  if (!data.campaign.enemyRolesLv1) { for (const force of enemyForces) setEnemyRole(force, STAGES[Math.floor(force.id / 2) + 1] || stageById(force.at), force.id % 2 ? 'expedition' : 'garrison'); data.campaign.enemyRolesLv1 = true; }
  if (!data.campaign.enemyWavesLv2) { for (const force of enemyForces) { const stage = stageById(force.home) || STAGES[Math.floor(force.id / 2) + 1] || stageById(force.at); setEnemyRole(force, stage, force.role || (force.id % 2 ? 'expedition' : 'garrison')); } data.campaign.enemyWavesLv2 = true; data.campaign.expeditionWaves = {}; }
  if (!data.campaign.enemyRatioLv3) { fillEnemyRoleRatio(); data.campaign.enemyRatioLv3 = true; }
  if (!data.campaign.enemyRatioLv4) { for (const stage of STAGES.slice(1)) enemyForces.filter(f => f.active && !f.wave && f.home === stage.id && f.role === 'expedition').slice(EXPEDITION_PER_CITY).forEach(f => f.active = false); data.campaign.enemyRatioLv4 = true; }
  if (!data.campaign.enemyCurveV1) { applyGarrisonCurve(); data.campaign.enemyCurveV1 = true; }
  for (const force of enemyForces) setEnemyRole(force, stageById(force.home) || stageById(force.at), force.role || 'garrison', force.level);
  data.campaign.items ||= {};
  for (const key of Object.keys(Sim.ITEMS)) if (!Number.isFinite(data.campaign.items[key])) data.campaign.items[key] = 0;
  if (!data.campaign.uniqueItemsV1) {
    const equipped = new Set(roster.flatMap(c => (c.growth || []).map(g => g && g.item).filter(Boolean)));
    for (const [itemKey, item] of Object.entries(Sim.ITEMS).filter(([, item]) => item.unique)) if (!equipped.has(itemKey)) {
      const corps = roster.find(c => c.units.includes(item.owner)), slot = corps && corps.units.indexOf(item.owner); if (corps) { corps.growth ||= Array(18).fill(null); const g = corps.growth[slot] || (corps.growth[slot] = {}); if (!g.item) g.item = itemKey; else data.campaign.items[itemKey]++; } else data.campaign.items[itemKey]++;
    }
    data.campaign.uniqueItemsV1 = true;
  }
  Object.assign(campaign, data.campaign); campaign.corps = Math.max(0, Math.min(roster.length - 1, campaign.corps || 0)); campaign.battle = battle; if (campaign.pendingEncounter) { campaign.pendingEncounter.stage = pendingStage; campaign.pendingEncounter.responders = (campaign.pendingEncounter.responders || []).filter(i => combatReadyCorps(roster[i])); campaign.pendingEncounter.unopposed = !campaign.pendingEncounter.responders.length; }
  return true;
}
function defeatCampaign(message) { try { localStorage.removeItem(saveKey(activeSaveSlot)); if (activeSaveSlot === 1) localStorage.removeItem(SAVE_KEY); } catch (e) { /* 무시 */ } S = null; state = 'title'; campaign.battle = null; moveSelectOpen = false; exploreSelectOpen = false; saveSlotMode = null; titleNotice = message; }
let mapTool = null, scoutView = null, diplomacyRnd = Math.random;   // 지도 도구(정찰·외교) 선택 상태 / 정찰 보고 창
let rosterSource = 0, rosterTarget = null, rosterPage = 0, rosterMode = 'select', rosterPick = null, rosterNew = null, rosterDetailSlot = 0, moveSelectOpen = false, moveMode = 'corps', movePage = 0, exploreSelectOpen = false, explorePage = 0;
const SPECIAL_EFFECT = { spin: '주변 적에게 강한 물리 피해', dash: '최대 6칸 돌진·밀치기·거리 비례 추가 피해', volley: '화살 5발 연속 사격', bless: '주변 아군 HP 30% 회복·FT 20 감소' };
const STAT_GUIDE = ['HP 생명력 · MP 주문 자원 · FT 피로도(높을수록 전투 효율 감소)', 'AT 물리 공격 · DF 물리 방어 · AD 화살 방어 · MD 마법 방어', 'AA 화살 회피율 · HR 정지 중 체력 회복 · SP 이동 속도', 'AR 공격 효율 배율 · DR 방어 효율 배율'];
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
function stageArmies(stage) {
  return rosterArmies().concat(enemyForces.filter(f => f.active && f.at === stage.id).map(f => ({ ...f.army, units: [...f.army.units], forceId: f.id })));
}
let selTarget = null;   // 선택 단계에서 정보를 보고 있는 적 (확정하면 군단이 그 적을 집중 공격)
let selectMode = false;   // 캐릭터 선택 단계: 전투가 멈추고 능력치 창이 뜬다 (확정하면 재개)
let tutorialStep = -1, tutorialSeen = false;
try { tutorialSeen = localStorage.getItem('sgsp-tutorial') === '1'; } catch (e) { /* 저장소를 못 쓰면 매번 안내 */ }
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
let wz = 1;   // 월드를 그리는 동안의 줌 — 글자 크기를 화면 기준으로 유지하려고 label 이 나눈다
let vh = 0, tblH = 0;   // 레이아웃: 맵 높이 / 하단 표 높이

function layout() { tblH = mobile ? 0 : tblCompact ? 54 : 236; vh = VH - TB_H - tblH; }
function setMobile(on) {   // 모바일: 상단 큰 버튼 줄, 좌측 상세 상태창, 글자 확대
  mobile = on; loadZoom(on); TB_H = on ? 0 : 58; LEFT_W = on ? 0 : 150; VPW = VW - LEFT_W; FS = on ? 1.3 : 1; padPtrs.clear(); stick = null; padDir = null; layout(); if (S) snapCam();
}
function startBattle(stage, explore = false) {
  if (!combatReadyCorps(roster[campaign.corps])) { state = 'map'; campaign.battle = null; campaign.notice = '군단 편성에서 1번 칸에 이름 있는 군단장을 배치해야 출전할 수 있습니다.'; saveCampaign(); return false; }
  campaign.battle = stage || campaign.battle;
  campaign.explore = explore;
  const armies = stageArmies(campaign.battle).filter(a => !explore || a.team === 'player');
  const emptySlots = roster.reduce((n, c) => n + c.units.filter((x, i) => !x && i > 0).length, 0);
  S = Sim.createBattle((Date.now() % 100000) + 1, { armies, mapSeed: campaign.battle ? campaign.battle.mapSeed : 7, theme: campaign.battle ? campaign.battle.theme : 'plains', wideRiver: !!(campaign.battle && campaign.battle.wideRiver), routChance: campaign.battle ? ROUT_CHANCE[campaign.battle.difficulty] : 0.065, explore, attackingTeam: campaign.invasion ? 'enemy' : 'player', surrenderSlots: emptySlots + (roster.length < ROSTER_MAX ? 17 : 0) }); terrain = buildTerrain(S.map, Sim.MW, Sim.MH, TILE);
  if (campaign.battle) S.events.push({ type: 'notice', team: 'enemy', text: campaign.invasion ? `적 군단이 ${campaign.battle.name}을 침공했습니다!` : `${campaign.battle.stage}지역 ${campaign.battle.name} · ${campaign.battle.difficulty} · ${campaign.battle.note}` + ` · 전투력 아군 ⚔${S.armies.filter(A => A.team === "player" && !A.support).reduce((n, A) => n + Sim.battlePower(A), 0)} / 적 ⚔${S.armies.filter(A => A.team === "enemy").reduce((n, A) => n + Sim.battlePower(A), 0)}` });
  state = 'play'; overAt = 0; paused = false; menuOpen = false; supportOpen = false; selectMode = false; selTarget = null; tutorialStep = tutorialSeen ? -1 : 0; armyIdx = 0; marks = []; speedIdx = 0; dirStack = []; padPtrs.clear(); stick = null; padDir = null;
  layout(); snapCam(); saveCampaign();
  return true;
}
function startCampaign() {
  state = 'map'; S = null; campaign.battle = null; moveSelectOpen = false; exploreSelectOpen = false; moveMode = 'corps'; campaign.notice = '이동 버튼에서 군단과 이동할 도시를 선택하세요.';
}
function startNewGame() { resetCampaignData(); titleNotice = ''; startCampaign(); saveCampaign(); }
function startNewFromTitle() { activeSaveSlot = Array.from({ length: SAVE_SLOTS }, (_, i) => i + 1).find(slot => !hasCampaign(slot)) || activeSaveSlot; startNewGame(); }
function loadGame(slot = activeSaveSlot) {
  const data = readCampaign(slot); if (!restoreCampaign(data)) { const msg = staleSave(slot) ? `${slot}번 슬롯은 이전 시나리오 저장이라 불러올 수 없습니다. 새 게임으로 시작하세요.` : `${slot}번 슬롯에 불러올 데이터가 없습니다.`; if (state === 'title') titleNotice = msg; else campaign.notice = msg; return false; }
  activeSaveSlot = slot;
  const battle = campaign.battle, explore = campaign.explore, notice = campaign.notice; titleNotice = '';
  if (battle) startBattle(battle, explore); else { startCampaign(); campaign.notice = notice || `${campaign.turn}턴 원정을 불러왔습니다.`; }
  return true;
}
// 전투력: 장수·병사 능력치를 환산해(Sim.unitPower) 군단별로 합산한다.
const corpsPow = corps => Sim.corpsPower(corps.units, 'player', corps.growth);
const forcePow = force => Sim.corpsPower(force.army.units, 'enemy', force.army.growth);
const enemyPowerAt = stage => enemyForces.filter(f => f.active && f.at === stage.id).reduce((n, f) => n + forcePow(f), 0);
const enemyRolesAt = stage => { const forces = enemyForces.filter(f => f.active && f.at === stage.id); return `수${forces.filter(f => f.role === 'garrison').length} 원${forces.filter(f => f.role === 'expedition').length}`; };
// 어떤 도시에 개입할 수 있는 아군 군단(같은 도시 또는 연결된 도시)의 전투력 합 — 침공 대응 규칙과 같은 범위
const playerPowerNear = stage => roster.filter(c => combatReadyCorps(c) && (c.at === stage.id || stage.links.includes(c.at))).reduce((n, c) => n + corpsPow(c), 0);
const AI_ATTACK_RATIO = 1.2;   // 침공: 집결한 적 전투력이 상대 대응 전투력의 1.2배 이상일 때만
const AI_DEFEND_RATIO = 0.8;   // 방어: 아군이 닿을 수 있는 위협 전투력이 자기 도시 전투력의 0.8배 이상이면 자리를 지킨다
// 적 군단 한 부대의 행동 결정: 진군(advance) 또는 대기(hold). 판단 근거를 함께 돌려준다.
function enemyDecision(force) {
  const here = stageById(force.at), path = route(force.at, START_STAGE), next = path.length > 1 ? stageById(path[1]) : null;
  const own = enemyPowerAt(here), threat = playerPowerNear(here), mine = forcePow(force);
  const base = { own, threat, mine, from: here.id, to: next ? next.id : null };
  if (force.role === 'garrison') return { ...base, act: 'hold', mode: '수비', reason: '도시 방어 전담' };
  if (!next) return { ...base, act: 'hold', mode: '대기', reason: '목표 도달' };
  if (threat > 0 && threat >= own * AI_DEFEND_RATIO) return { ...base, act: 'hold', mode: '방어', reason: `아군 위협 ${threat} ≥ 주둔 ${own}×${AI_DEFEND_RATIO}` };
  if (next.owner === 'player') {
    const def = playerPowerNear(next);
    if (def === 0) return { ...base, act: 'advance', mode: '침공', def, reason: '무방비 지역' };
    if (own >= def * AI_ATTACK_RATIO) return { ...base, act: 'advance', mode: '침공', def, reason: `집결 ${own} ≥ 대응 ${def}×${AI_ATTACK_RATIO}` };
    return { ...base, act: 'hold', mode: '집결', def, reason: `집결 ${own} < 대응 ${def}×${AI_ATTACK_RATIO}` };
  }
  return { ...base, act: 'advance', mode: '진군', reason: '자국 영토 이동' };
}
function route(from, to) {
  const q = [[from]], seen = new Set([from]);
  while (q.length) { const path = q.shift(), id = path[path.length - 1]; if (id === to) return path; for (const next of stageById(id).links) if (!seen.has(next)) { seen.add(next); q.push(path.concat(next)); } }
  return [];
}
const moveTurns = corps => corps.target ? Math.max(0, route(corps.at, corps.target).length - 1) : 0;
function moveCampaign(id) {
  const corps = roster[campaign.corps], next = stageById(id); if (!corps || !next) return;
  corps.target = corps.target === next.id || corps.at === next.id ? null : next.id; campaign.destination = corps.target;
  campaign.notice = corps.target ? `${corpsName(corps)}: ${stageById(corps.at).name} → ${next.name} · ${moveTurns(corps)}턴.` : `${corpsName(corps)}의 이동 계획을 취소했다.`;
  saveCampaign();
}
function advanceEnemyForces() {
  campaign.intel = [];   // 이번 턴 적 판단 기록 (전투력·방어/침공 근거)
  const decisions = enemyForces.filter(force => force.active).map(force => ({ force, d: enemyDecision(force) }));   // 같은 턴의 판단은 이동 전 상태로 동시에 내린다
  for (const { force, d } of decisions) {
    const from = force.at; if (d.act === 'advance' && d.to) { force.prevAt = from; force.at = d.to; }
    const note = `적 ${force.army.name} [${force.role === 'garrison' ? '수비' : '원정'}] Lv${force.level} ⚔${d.mine} · ${stageById(from).name}${from !== force.at ? ' → ' + stageById(force.at).name + ' · 1턴 이동' : ''} · ${d.mode}(${d.reason})`;
    campaign.intel.push({ text: note, mode: d.mode, force: force.army.name, power: d.mine, from, to: force.at });
    if (from !== force.at) campaign.movement.push({ text: note, name: `적 ${force.army.name}`, commander: Sim.U[force.army.leader] ? Sim.U[force.army.leader].name : force.army.name, from, to: force.at, team: 'enemy', faction: stageById(force.home || from).faction, forceId: force.id });
  }
}
function spawnExpeditions() {
  if (campaign.turn % EXPEDITION_INTERVAL) return;
  for (const stage of STAGES.filter(s => s.owner === 'enemy')) {
    const wave = (campaign.expeditionWaves[stage.id] || 0) + 1, leader = expeditionLeader(stage, wave), pool = THEME_UNITS[stage.theme], units = tripleEnemyUnits([leader, ...pool, ...pool], pool, wave);
    campaign.expeditionWaves[stage.id] = wave;
    const force = setEnemyRole({ id: Math.max(-1, ...enemyForces.map(f => f.id)) + 1, at: stage.id, active: true, wave, army: { team: 'enemy', name: '', at: BASE_ENEMIES[stage.stage - 2]?.at || [45, 20], leader, reserve: true, reserveAt: 12, formation: stage.stage >= 7 ? 'guard' : 'block', units, trig: { near: 12, t: 60 } } }, stage, 'expedition', stage.level + wave);
    enemyForces.push(force); campaign.intel.push({ text: `적 ${force.army.name} 생성 · Lv${force.level}`, mode: '증원', force: force.army.name, power: forcePow(force), from: stage.id, to: stage.id });
  }
}
const intelSummary = () => { const n = {}; for (const i of campaign.intel || []) n[i.mode] = (n[i.mode] || 0) + 1; const t = Object.entries(n).map(([k, v]) => `${k} ${v}`).join('·'); return t ? ` 적 동향: ${t}` : ''; };
function movementEncounter(move) {
  const stage = stageById(move.to); if (!stage) return null;
  if (move.team === 'player') {
    if (stage.owner !== 'enemy') return null;
    if (!enemyForces.some(f => f.active && f.at === stage.id)) return { stage, invasion: false, capture: true };
    const corps = roster[move.corpsIndex]; return combatReadyCorps(corps) ? { stage, responders: [move.corpsIndex], invasion: false, from: move.from, moverIndex: move.corpsIndex } : null;
  }
  if (stage.owner !== 'player' || !enemyForces.some(f => f.active && f.at === stage.id)) return null;
  const responders = roster.map((c, index) => ({ c, index })).filter(({ c }) => combatReadyCorps(c) && (c.at === stage.id || stage.links.includes(c.at))).map(({ index }) => index);
  if (!responders.length) return { stage, responders, invasion: true, from: move.from, unopposed: true };
  return { stage, responders, invasion: true, from: move.from };
}
function finishMovementStep() {
  campaign.pendingEncounter = null; campaign.responsePage = 0;
  if (campaign.movementPage < campaign.movement.length - 1) campaign.movementPage++;
  else { campaign.movement = []; campaign.movementPage = 0; continueCampaignTurn(); }
  saveCampaign();
}
function continueCampaignTurn() {
  const encounter = campaign.pendingEncounter; campaign.pendingEncounter = null;
  if (!encounter) { campaign.at = roster[campaign.corps].at; campaign.destination = roster[campaign.corps].target; campaign.notice = `${campaign.turn}턴 이동을 완료했다.${intelSummary()}`; saveCampaign(); return; }
  if (encounter.invasion) { campaign.pendingEncounter = encounter; campaign.notice = `${encounter.stage.name} 방어에 나설 군단을 선택하세요.`; saveCampaign(); return; }
  campaign.corps = encounter.index; campaign.at = encounter.stage.id; campaign.from = encounter.from; campaign.destination = roster[encounter.index].target; campaign.invasion = false; campaign.notice = `${encounter.stage.name}에 적이 주둔 중이다. 전투를 시작한다.`; startBattle(encounter.stage);
}
function endCampaignTurn() {
  campaign.turn++; campaign.movement = []; campaign.movementPage = 0; campaign.pendingEncounter = null;
  roster.forEach((corps, index) => {
    const from = corps.at;
    if (corps.target) { const path = route(corps.at, corps.target); if (path.length < 2) corps.target = null; else { corps.at = path[1]; if (corps.at === corps.target) corps.target = null; } }
    if (from !== corps.at) campaign.movement.push({ text: `${corpsName(corps)} · ${stageById(from).name} → ${stageById(corps.at).name} · 1턴 이동`, name: corpsName(corps), commander: corps.units[0] && Sim.U[corps.units[0]] ? Sim.U[corps.units[0]].name : corpsName(corps), from, to: corps.at, team: 'player', corpsIndex: index });
  });
  advanceEnemyForces(); spawnExpeditions(); saveCampaign();
  if (!campaign.movement.length) continueCampaignTurn();
}
function exploreCampaign(index) {
  const corps = roster[index]; if (!corps) return; const stage = stageById(corps.at); if (stage.owner !== 'player') { campaign.notice = '점령한 지역만 탐색할 수 있습니다.'; return; }
  campaign.corps = index; campaign.destination = corps.target;
  campaign.at = stage.id; campaign.from = null; campaign.notice = `${stage.name}을 탐색한다.`; startBattle(stage, true);
}
function applyBattleResults() {
  if (!S || !campaign.battle) return;
  const growthOf = u => ({ lv: u.lv, xp: u.xp, maxHp: u.maxHp, maxMp: u.maxMp, atk: Sim.itemBase(u, 'atk'), df: Sim.itemBase(u, 'df'), ad: Sim.itemBase(u, 'ad'), md: Sim.itemBase(u, 'md'), aa: u.aa, hr: u.hr, sp: u.sp, ar: Sim.itemBase(u, 'ar'), dr: Sim.itemBase(u, 'dr'), item: u.item });   // 아이템 보정은 빼고 저장 (떼면 사라지도록)
  for (const u of S.units.filter(x => !x.dead && x.originTeam === 'player')) {
    const corps = roster.find(c => c.id === u.army.corps); if (corps && Number.isInteger(u.rosterSlot)) corps.growth[u.rosterSlot] = growthOf(u);
  }
  for (const u of S.units.filter(x => x.dead && x.originTeam === 'player')) {
    const corps = roster.find(c => c.id === u.army.corps); if (!corps || !Number.isInteger(u.rosterSlot)) continue; corps.units[u.rosterSlot] = null; corps.growth[u.rosterSlot] = null; if (u.item) campaign.items[u.item] = (campaign.items[u.item] || 0) + 1;
  }
  for (const u of S.units.filter(x => x.originTeam === 'enemy' && (x.dead || x.team === 'player'))) { const force = enemyForces.find(f => f.id === u.forceId); if (!force) continue; const slot = force.army.units.indexOf(u.key); if (slot >= 0) force.army.units.splice(slot, 1); }
  for (const force of enemyForces) if (force.active && !force.army.units.includes(force.army.leader)) force.active = false;
  for (const u of S.units.filter(x => !x.dead && x.originTeam === 'enemy' && x.team === 'player')) {
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
}
// 아이템 획득 (명세 12 보강): 전투 승리 시 쓰러뜨린 적에게서 드롭 + 지역 첫 점령 보상. 확률·보상표는 설계 추정.
const DROP_POOL = Object.keys(Sim.ITEMS).filter(k => !Sim.ITEMS[k].unique), DROP_RATE = { soldier: 0.02, captain: 0.15, hero: 0.35 };
const CAPTURE_REWARD = ['ironsword', 'armor', 'bowguard', 'charm', 'seal_ar', 'seal_dr', 'ironsword', 'armor', 'bowguard'];   // 지역 번호 2~10 순서
const addItem = k => { campaign.items[k] = (campaign.items[k] || 0) + 1; return Sim.ITEMS[k].name; };
function battleDrops() {   // S: 방금 승리한 전투
  const got = []; for (const u of S.units) if (u.originTeam === 'enemy' && u.dead) { const T = Sim.U[u.key], rate = T.generic ? DROP_RATE.soldier : T.name.startsWith('적 ') || T.synthetic ? DROP_RATE.captain : DROP_RATE.hero; if (S.rnd() < rate) got.push(addItem(DROP_POOL[Math.floor(S.rnd() * DROP_POOL.length)])); }
  return got;
}
function captureReward(stage) { if (stage.stage < 2 || campaign.rewarded[stage.id]) return ''; campaign.rewarded[stage.id] = true; return addItem(CAPTURE_REWARD[(stage.stage - 2) % CAPTURE_REWARD.length]); }
// 정찰·외교 (명세 22): 적 지역을 고르면 동작. 군단이 그 지역이나 연결 지역에 있어야 한다(침공 대응과 같은 범위).
const corpsNear = stage => roster.map((c, i) => ({ c, i })).filter(({ c }) => c.units.some(Boolean) && (c.at === stage.id || stage.links.includes(c.at)));
const RECRUIT = { esword: 'sword', eshield: 'shield', earcher: 'archer', ecav: 'cav', emage: 'mage' };
function useMapTool(stage) {
  const tool = mapTool; mapTool = null;
  if (stage.owner === 'player') { campaign.notice = '적이 있는 지역을 선택하세요.'; return; }
  const near = corpsNear(stage); if (!near.length) { campaign.notice = `${stage.name}은 군단이 같은 지역이나 연결된 지역에 있어야 합니다.`; return; }
  if (tool === 'scout') { scoutView = stage.id; campaign.notice = `${stage.name} 정찰 보고`; return; }
  diplomacy(stage, near);
}
function diplomacy(stage, near) {   // 투항 권유: 가장 약한 적 군단의 일반 병사 최대 6명을 가까운 아군 군단의 빈 자리로 데려온다
  campaign.diplomacy = campaign.diplomacy || {};
  if (campaign.diplomacy[stage.id] === campaign.turn) { campaign.notice = `${stage.name}에는 이번 턴에 이미 외교를 시도했습니다.`; return; }
  const forces = enemyForces.filter(f => f.active && f.at === stage.id); if (!forces.length) { campaign.notice = `${stage.name}에는 설득할 적이 없습니다.`; return; }
  campaign.diplomacy[stage.id] = campaign.turn;
  const own = near.reduce((n, { c }) => n + corpsPow(c), 0), foe = forces.reduce((n, f) => n + forcePow(f), 0), chance = Math.max(0.1, Math.min(0.7, 0.1 + 0.4 * own / foe));
  if (diplomacyRnd() >= chance) { campaign.notice = `${stage.name} 외교 실패 (성공 확률 ${Math.round(chance * 100)}%).`; return; }
  const target = forces.slice().sort((a, b) => forcePow(a) - forcePow(b))[0], idx = target.army.units.map((k, i) => RECRUIT[k] ? i : -1).filter(i => i >= 0).slice(0, 6), taken = [];
  for (const { c } of near) for (let slot = 0; slot < 18 && taken.length < idx.length; slot++) if (!c.units[slot]) { c.units[slot] = RECRUIT[target.army.units[idx[taken.length]]]; c.growth[slot] = null; taken.push({ c, i: idx[taken.length] }); }
  if (!taken.length) { campaign.notice = '합류할 빈 자리가 없습니다. 군단 편성에서 자리를 비우세요.'; return; }
  const gone = new Set(taken.map(t => t.i)); target.army.units = target.army.units.filter((_, i) => !gone.has(i)); if (target.army.growth) target.army.growth = target.army.growth.filter((_, i) => !gone.has(i)); if (!target.army.units.length) target.active = false;
  campaign.notice = `${stage.name} 외교 성공(${Math.round(chance * 100)}%): 투항병 ${taken.length}명이 ${corpsName(taken[0].c)}에 합류했다.`;
}
function finishBattle() {
  const turnEncounter = campaign.pendingEncounter; applyBattleResults(); const active = roster[campaign.corps], lostHome = S && S.over !== 'win' && campaign.invasion && campaign.battle && campaign.battle.id === START_STAGE;
  const routed = new Set(S ? S.armies.filter(A => A.team === 'enemy' && A.routed).map(A => A.forceId) : []);
  for (const force of enemyForces.filter(f => f.active && routed.has(f.id) && campaign.battle && f.at === campaign.battle.id)) {
    const fallback = route(force.at, FINAL_STAGE), back = force.prevAt && stageById(force.prevAt) ? force.prevAt : fallback[1]; if (back) force.at = back; else force.active = false; force.prevAt = null;
  }
  if (S && S.over === 'win' && campaign.battle) {
    for (const force of enemyForces.filter(f => f.active && f.at === campaign.battle.id)) { const path = route(force.at, FINAL_STAGE); if (path.length > 1) force.at = path[1]; else force.active = false; }
    campaign.battle.owner = 'player'; const prize = captureReward(campaign.battle), drops = battleDrops(); campaign.notice = `${campaign.battle.name}을 점령했다.${prize ? ' 점령 보상: ' + prize + '.' : ''}${drops.length ? ' 전리품: ' + drops.join(', ') + '.' : ''}`;
  }
  else if (campaign.explore) campaign.notice = `${campaign.battle.name} 탐색을 마쳤다.`;
  else { campaign.notice = `${campaign.battle ? campaign.battle.name : '전장'}에서 후퇴했다.`; if (campaign.invasion && campaign.battle) campaign.battle.owner = 'enemy'; if (campaign.from) active.at = campaign.from; }
  if (lostHome) { defeatCampaign('진류 방어에 실패하여 원정에 패배했습니다.'); return; }
  campaign.at = active.at; campaign.destination = active.target; campaign.from = null; campaign.battle = null; campaign.explore = false; campaign.invasion = false; S = null; state = 'map'; overAt = 0; menuOpen = false; supportOpen = false; selectMode = false;
  if (turnEncounter) finishMovementStep(); else saveCampaign();
}
const army = () => S.armies[armyIdx];
const ctrlOf = () => army().ctrl;
const activePlayerArmies = () => S.armies.filter(A => A.team === 'player' && A.units.length && (!A.support || A.state !== 'support'));
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
function label(s, x, y, size, col, align = 'left') {
  size = Math.round(size * FS / wz);
  ctx.font = `bold ${size}px sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineWidth = size / 5; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function panel(x, y, w, h, border, bw = 2, fill = 'rgba(10,12,20,.92)') { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); ctx.strokeStyle = border; ctx.lineWidth = bw; ctx.strokeRect(x, y, w, h); }
function bar(x, y, w, h, p, col) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x, y, w, h); ctx.fillStyle = col; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, p)), h); }
function button(id, x, y, w, h, text, on, size = 16) {
  panel(x, y, w, h, on ? COLORS.gold : COLORS.silver2, on ? 3 : 2);
  label(text, x + w / 2, y + h / 2, size, on ? COLORS.goldSel : COLORS.silver, 'center');
  btns.push({ id, x, y, w, h });
}
const styleOf = u => u.key !== 'guan' && u.category === 'sword' ? { ...STYLES[u.style], weapon: 'sword' } : STYLES[u.style];
const stText = u => u.dead ? '전사' : u.fled ? '도주' : u.out ? '철수' : u === u.army.ctrl && u.team === 'player' && (!S.auto || u.manual) ? '조작' : (ORDER_NAME[u.order.type] || '자유');
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
  ctx.setLineDash(ally || mine ? [] : [6, 5]); ctx.beginPath(); ctx.ellipse(x, y + u.r * 0.35, u.r * 1.3, u.r * 0.7, 0, 0, TAU); ctx.stroke(); ctx.restore();
  { const marks = [...(u.buffs || []).map(b => [true, b.col]), [u.ftDebuffT > 0, '#ff9a4a'], ...Object.entries(u.auraOn || {}).filter(([, on]) => on).map(([k]) => [true, Sim.TITLE_EFFECT[k].col])].filter(m => m[0]), pulse = 0.45 + 0.3 * Math.sin(T * 6);   // 효과가 켜져 있는 동안 발밑에 색 고리 (공격 금·방어 청·피로 디버프 주황)
    if (marks.length) { ctx.save(); ctx.lineWidth = 2; marks.forEach((m, i) => { ctx.globalAlpha = pulse; ctx.strokeStyle = m[1]; ctx.beginPath(); ctx.ellipse(x, y + u.r * 0.35, u.r * (1.6 + i * 0.28), u.r * (1.6 + i * 0.28) * 0.55, 0, 0, TAU); ctx.stroke(); }); ctx.restore(); }
    const TA = (Sim.TITLE_EFFECT[u.subclass] || {}).aura && Sim.TITLE_EFFECT[u.subclass]; if (TA) { ctx.save(); ctx.globalAlpha = 0.16 + 0.06 * Math.sin(T * 3); ctx.strokeStyle = TA.col; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.ellipse(x, y + u.r * 0.35, Sim.AURA_RANGE, Sim.AURA_RANGE * 0.55, 0, 0, TAU); ctx.stroke(); ctx.restore(); } }   // 무신(관우 등) 공격·화살·마법 방어 +20%, 간웅(조조) 전 능력 +10% 오라 범위
  const swing = u.anim > 0 ? -1.3 + 2.6 * (1 - u.anim / 0.28) : 0.9;
  const k = Math.max(0, Math.min(1, u.hitT / (u.hitDuration || 0.35))), mag = (u.hitMag || 1) * (u.hitState < 0 ? 1.25 : u.hitState > 0 ? 0.55 : 1), ds = Math.cos(u.hitAng) >= 0 ? 1 : -1, ap = u.anim > 0 && u.range === 0 ? Math.sin((1 - u.anim / 0.28) * Math.PI) : 0;   // 상성 우세는 짧은 방어 반응, 불리는 강한 경직
  const tilt = ds * 0.5 * mag * k * Math.cos((1 - k) * 6) + (u.stun > 0 ? Math.sin(T * 8) * 0.16 : 0), sqy = 1 - 0.13 * mag * k - 0.05 * ap, sqx = 1 + 0.09 * mag * k + 0.04 * ap;
  const ox = Math.cos(u.hitAng) * 7 * mag * k + Math.sin(T * 100) * 2.5 * k + Math.cos(u.face) * 7 * ap, oy = Math.sin(u.hitAng) * 5 * mag * k + Math.sin(u.face) * 4 * ap;
  ctx.save(); ctx.translate(x + ox, y + oy); ctx.rotate(tilt); ctx.scale(sqx, sqy); ctx.translate(-x, -y);
  drawBody(ctx, x, y, u.r * 1.15, u.face, styleOf(u), { flash: u.flash > 0, t: T + u.id, moving: u.moving, weaponAng: u.face + swing - ds * 0.9 * mag * k, weaponLen: u.r * (u.isLeader ? 4.4 : 3.4), bob: u.moving ? Math.abs(Math.sin(T * 9 + u.id)) * 1.5 : 0 });
  ctx.restore();
  const top = y - u.r * 4.4 - (u.style === 'lubu' ? 22 : 0) - (styleOf(u).horse ? 10 : 0), w = u.r * 2.4;
  if (ally || u.hp < u.maxHp || u.isLeader) { bar(x - w / 2, top, w, 4, u.hp / u.maxHp, hpCol(u.hp / u.maxHp, ally ? COLORS.ally : COLORS.danger)); if (u.maxMp && ally) bar(x - w / 2, top + 5, w, 2, u.mp / u.maxMp, '#8a6aff'); const sk = u.special && Sim.SPECIAL[u.special]; if (sk) { const ready = u.spT <= 0, cy = top + (u.maxMp && ally ? 8 : 5); bar(x - w / 2, cy, w, 2.5, ready ? 1 : 1 - Math.max(0, u.spT) / sk.cd, ready ? COLORS.gold : '#c7822f'); } }   // 특수기(스킬) 쿨타임 바: 차오르는 중 주황, 준비되면 금색 가득
  if (mine || other) { ctx.fillStyle = mine ? COLORS.gold : COLORS.ally; ctx.beginPath(); ctx.moveTo(x - 7, top - 14); ctx.lineTo(x + 7, top - 14); ctx.lineTo(x, top - 4); ctx.closePath(); ctx.fill(); }
  if ((u.named && !Sim.U[u.key].synthetic) || u.isLeader) { const current = u.named ? (ally ? COLORS.goldSel : '#ff9a8a') : ally ? COLORS.silver : '#ffb0a0'; label(u.name, x, top - (mine ? 26 : 12), u.named ? 17 : 16, hpCol(u.hp / u.maxHp, current), 'center'); }   // 이름도 HP 30%·10% 구간을 같이 표시
}
function drawWorld() {
  ctx.save(); ctx.beginPath(); ctx.rect(LEFT_W, TB_H, VPW, vh); ctx.clip();
  const z = Z(), vw = VPW / z, vhh = vh / z; wz = z;
  ctx.drawImage(terrain, cam.x, cam.y, vw, vhh, LEFT_W, TB_H, VPW, vh);
  ctx.translate(LEFT_W, TB_H); ctx.scale(z, z); ctx.translate(-cam.x, -cam.y);
  const tileBox = (tx, ty, col, fill) => { if (fill) { ctx.fillStyle = fill; ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE); } ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(tx * TILE + 1, ty * TILE + 1, TILE - 2, TILE - 2); };
  const c = ctrlOf();
  if (c && alive(c)) { tileBox(c.tx, c.ty, COLORS.gold, 'rgba(255,211,77,.16)'); if (c.mv) tileBox(c.mv.nx, c.mv.ny, 'rgba(255,211,77,.5)'); }   // 조작 캐릭터가 서 있는 칸
  for (const t of new Set(army().units.filter(u => alive(u) && u.order.type === 'attack' && u.order.target && alive(u.order.target)).map(u => u.order.target))) tileBox(t.tx, t.ty, COLORS.danger, 'rgba(255,90,74,.18)');   // 집중 공격 표적
  for (const m of marks) { const tx = Math.floor(m.x / TILE), ty = Math.floor(m.y / TILE), g = 1.4 - m.t; ctx.strokeStyle = m.col; ctx.globalAlpha = m.t / 0.7; ctx.lineWidth = 3; ctx.strokeRect(tx * TILE - g * 6, ty * TILE - g * 6, TILE + g * 12, TILE + g * 12); ctx.globalAlpha = 1; }
  for (const f of S.fx) {
    const p = 1 - f.t / f.max; ctx.globalAlpha = 1 - p;
    if (f.kind === 'spark') { ctx.strokeStyle = f.col || '#fff3c0'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); for (let i = 0; i < (f.count || 6); i++) { const a = f.ang + (i - ((f.count || 6) - 1) / 2) * 0.55, r0 = 6 + p * 8, r1 = 12 + p * (f.count > 6 ? 30 : 22); ctx.moveTo(f.x + Math.cos(a) * r0, f.y + Math.sin(a) * r0 * 0.8); ctx.lineTo(f.x + Math.cos(a) * r1, f.y + Math.sin(a) * r1 * 0.8); } ctx.stroke(); ctx.fillStyle = f.col || '#fff3c0'; ctx.globalAlpha *= 0.7; ctx.beginPath(); ctx.arc(f.x, f.y, 8 * (1 - p), 0, TAU); ctx.fill(); }
    else if (f.kind === 'guard') { const r = 15 + p * 7; ctx.strokeStyle = f.col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(f.x - r * 0.7, f.y - r * 0.65); ctx.lineTo(f.x + r * 0.7, f.y - r * 0.65); ctx.lineTo(f.x + r * 0.55, f.y + r * 0.2); ctx.quadraticCurveTo(f.x, f.y + r, f.x - r * 0.55, f.y + r * 0.2); ctx.closePath(); ctx.stroke(); }
    else if (f.kind === 'fall') { const e = 1 - (1 - p) * (1 - p), sd = Math.cos(f.ang) >= 0 ? 1 : -1; ctx.save(); ctx.globalAlpha = Math.max(0, 1 - p * p); ctx.translate(f.x + Math.cos(f.ang) * 14 * e, f.y + Math.sin(f.ang) * 8 * e); ctx.rotate(sd * 1.45 * e); ctx.translate(-f.x, -f.y); drawBody(ctx, f.x, f.y, f.r * 1.15, f.face, { ...STYLES[f.style], weapon: null }, { flash: p < 0.15, t: T }); ctx.restore(); }
    else if (f.kind === 'buff') {   // 바닥 고리가 퍼지고 효과 기호가 떠오른다
      const gy = f.y - f.r * 2 - p * 24; ctx.strokeStyle = f.col; ctx.fillStyle = f.col; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.ellipse(f.x, f.y + f.r * 0.35, f.r * (1.2 + p * 1.6), f.r * (1.2 + p * 1.6) * 0.5, 0, 0, TAU); ctx.stroke();
      if (f.glyph === 'atk' || f.glyph === 'down') { const d = f.glyph === 'atk' ? -1 : 1; for (let i = 0; i < 3; i++) { const yy = gy - d * (i * 7 - 7) + 14; ctx.globalAlpha = (1 - p) * (1 - i * 0.25); ctx.beginPath(); ctx.moveTo(f.x - 8, yy - d * 5); ctx.lineTo(f.x, yy + d * 3); ctx.lineTo(f.x + 8, yy - d * 5); ctx.stroke(); } }
      else if (f.glyph === 'all') { for (let i = 0; i < 3; i++) { const px = f.x + (i - 1) * 12, py = gy + (i === 1 ? -6 : 3) - p * 3, q = 5; ctx.globalAlpha = 1 - p; ctx.beginPath(); ctx.moveTo(px, py - q); ctx.lineTo(px + q * 0.35, py - q * 0.35); ctx.lineTo(px + q, py); ctx.lineTo(px + q * 0.35, py + q * 0.35); ctx.lineTo(px, py + q); ctx.lineTo(px - q * 0.35, py + q * 0.35); ctx.lineTo(px - q, py); ctx.lineTo(px - q * 0.35, py - q * 0.35); ctx.closePath(); ctx.fill(); } }
      else if (f.glyph === 'guard') { const r = 11; ctx.beginPath(); ctx.moveTo(f.x - r * 0.8, gy - r * 0.7); ctx.lineTo(f.x + r * 0.8, gy - r * 0.7); ctx.lineTo(f.x + r * 0.6, gy + r * 0.2); ctx.quadraticCurveTo(f.x, gy + r * 1.1, f.x - r * 0.6, gy + r * 0.2); ctx.closePath(); ctx.globalAlpha = (1 - p) * 0.35; ctx.fill(); ctx.globalAlpha = 1 - p; ctx.stroke(); }
      else { for (let i = -1; i <= 1; i++) { const px = f.x + i * 11, py = gy + (i === 0 ? -6 : 4) - p * 4; ctx.beginPath(); ctx.moveTo(px - 4, py); ctx.lineTo(px + 4, py); ctx.moveTo(px, py - 4); ctx.lineTo(px, py + 4); ctx.stroke(); } }
    }
    else if (f.kind === 'ring') { ctx.strokeStyle = f.col; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (0.4 + 0.6 * p), f.r * (0.4 + 0.6 * p) * 0.6, 0, 0, TAU); ctx.stroke(); }
    else { ctx.fillStyle = 'rgba(30,25,20,.5)'; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (1 + p), f.r * (1 + p) * 0.5, 0, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  for (const u of S.units.filter(alive).sort((a, b) => a.y - b.y)) { if (u.x < cam.x - 60 || u.x > cam.x + vw + 60 || u.y < cam.y - 90 || u.y > cam.y + vhh + 60) continue; drawUnit(u); }
  for (const p of S.proj) {
    if (p.kind === 'arrow') { ctx.strokeStyle = p.team === 'player' ? '#e8f4ff' : '#ffc9b8'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.cos(p.a) * 14, p.y - Math.sin(p.a) * 14); ctx.stroke(); }
    else if (p.kind === 'roll') { ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y + 10, 8, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,200,120,.5)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(p.x, p.y + 10); ctx.lineTo(p.x - Math.cos(p.a) * 22, p.y + 10 - Math.sin(p.a) * 22); ctx.stroke(); }   // 불공: 땅을 구른다
    else if (p.kind === 'ball') { ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, TAU); ctx.fill(); }   // 불꽃탄
    else { const L = p.kind === 'pierce' ? 46 : 30; ctx.fillStyle = p.col || '#9fe8ff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.kind === 'pierce' ? 9 : 7, 0, TAU); ctx.fill(); ctx.strokeStyle = (p.col || '#9fe8ff') + '88'; ctx.lineWidth = p.kind === 'pierce' ? 12 : 8; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.cos(p.a) * L, p.y - Math.sin(p.a) * L); ctx.stroke(); }   // 장풍(추적)·관통 마법
  }
  for (const t of S.texts) { if (t.k && t.k !== 'sys' && !SHOW[t.k]) continue; ctx.globalAlpha = Math.min(1, t.t * 2); label(String(t.s), t.x, t.y, 18, t.col, 'center'); ctx.globalAlpha = 1; }
  ctx.restore(); wz = 1;
}

// ---------- HUD (PC) ----------
function drawPortraits(x0, y0, w, h, step, A = army(), vert = false, cols = 2) {   // 군단 초상: 클릭 = 조작 캐릭터로 선택(그 군단으로 전환), 더블클릭 = 화면 이동
  A.units.forEach((u, i) => {
    const x = vert ? x0 + (i % cols) * (w + 2) : x0 + i * step, y = vert ? y0 + Math.floor(i / cols) * step : y0, on = A === army() && u === ctrlOf(), cx = x + w / 2, k = h / 36;
    panel(x, y, w, h, on ? COLORS.gold : 'rgba(255,255,255,.25)', on ? 3 : 1);
    ctx.save(); ctx.beginPath(); ctx.rect(x + 1, y + 1, w - 2, h - 2); ctx.clip(); ctx.globalAlpha = u.dead ? 0.25 : u.out ? 0.45 : 1;
    drawBody(ctx, cx, y + h, 9 * k, Math.PI / 2, { ...styleOf(u), weapon: null, horse: null }, { t: T }); ctx.restore();
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
// 능력치 실시간 표기: 기본값(아이템 포함) → 현재값(버프·오라·피로 반영). 달라지면 "기본→현재" 로 쓰고 올랐으면 초록, 내렸으면 주황으로 칠한다.
class StatText extends String { constructor(t, col) { super(t); this.col = col; } }
const FATIGUE_KEYS = ['atk', 'df', 'ad', 'md', 'sp'];
function statShow(u, key) {
  const base = Math.round(u[key]), live = Math.round(combatStat(u, key) * (FATIGUE_KEYS.includes(key) ? Sim.fatigueMultiplier(u) : 1)), sfx = key === 'aa' ? '%' : '';
  return live === base ? new StatText(base + sfx, null) : new StatText(`${base}→${live}${sfx}`, live > base ? '#7dff9a' : '#ff9a7d');
}
const combatStat = (u, key) => Sim.combatStat(S, u, key);
function drawLeftPanel() {
  panel(0, TB_H, LEFT_W, vh, 'rgba(255,255,255,.2)', 1);
  const u = ctrlOf(); if (!u) return;
  const rows = [['HP', `${Math.ceil(u.hp)}/${u.maxHp}`], ['MP', u.maxMp ? `${Math.floor(u.mp)}/${u.maxMp}` : '—'], ['FT', Math.round(Sim.effectiveFt(u))], ['XP', `${u.xp}/${Sim.XP_NEED(u.lv)}`], ['AT', statShow(u, 'atk')], ['DF', statShow(u, 'df')], ['AR', statShow(u, 'ar')], ['DR', statShow(u, 'dr')], ['AD', statShow(u, 'ad')], ['MD', statShow(u, 'md')], ['AA', statShow(u, 'aa')], ['HR', statShow(u, 'hr')], ['SP', statShow(u, 'sp')], ['상태', stText(u)]];
  label(u.name, 10, TB_H + 18, 20, hpCol(u.hp / u.maxHp, COLORS.gold)); label(`${CATEGORY_NAME[u.category]}·${u.subclass} Lv${u.lv}`, 10, TB_H + 42, 16, COLORS.silver);
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
      const cells = tblAbility ? [u.name, statShow(u, 'atk'), statShow(u, 'df'), statShow(u, 'ad'), statShow(u, 'md'), statShow(u, 'aa'), statShow(u, 'hr'), stText(u)] : [u.name, CATEGORY_NAME[u.category], Math.ceil(u.hp), u.maxMp ? Math.floor(u.mp) : '—', u.lv, Math.round(Sim.effectiveFt(u)), u.xp, stText(u)];
      cells.forEach((v, i) => label(String(v), x + cw / 2, dataY + 12 + i * rh, 15, v && v.col ? v.col : !tblAbility && i === 2 ? hpCol(u.hp / u.maxHp, col) : !tblAbility && i === 5 && u.ft > 50 ? '#ffb04d' : col, 'center'));
      btns.push({ id: 'col' + u.id, x, y: dataY, w: cw, h: tblH - headH });
    });
  });
}

// ---------- HUD (모바일) ----------
function drawToolbarMobile() {   // 하단: 분대별 묶음 (군단 선택·진형 / 장수·병사 초상 / 행동지침). 행동·마법 버튼은 오른쪽 빈 곳
  const ORDERS = [['idle', '자유'], ['stop', '정지'], ['charge', '돌격'], ['retreat', '후퇴']], y0 = VH - 100;
  armySlots().forEach((A, j) => {
    const gx = 4 + j * 352, selected = !A.empty && armyIdx === A.id;
    panel(gx - 2, y0 - 2, 344, 102, selected ? COLORS.gold : 'rgba(255,255,255,.35)', selected ? 4 : 2, selected ? 'rgba(50,42,20,.55)' : 'rgba(8,10,18,.84)');
    if (A.empty) { label(`${j + 1}분대 · 비어있음`, gx + 170, y0 + 48, 16, COLORS.dim, 'center'); return; }
    const i = A.id;
    button('army' + i, gx, y0, 168, 22, `${j + 1}분대 · ⚔${Sim.battlePower(A)}`, selected, 13);
    button('form:' + i, gx + 172, y0, 164, 22, '진형:' + FORMATION_NAME[A.formation], false, 13);
    drawPortraits(gx, y0 + 24, 54, 40, 56, A);
    ORDERS.forEach(([id, title], k) => button('order:' + i + ':' + id, gx + k * 84, y0 + 66, 82, 32, title, A.order === id, 14));
  });
}
function drawMobileSide() {   // 상단: 화면 → 전투 → 군단 → 메뉴 순으로 큰 터치 버튼을 묶는다
  [['화면', 137], ['전투', 411], ['군단', 620], ['메뉴', 758]].forEach(([s, x]) => label(s, x, 8, 13, COLORS.silver2, 'center'));
  button('m:zoom', 6, 20, 128, 42, '거리 ×' + Z(), false, 17);
  button('m:speed', 140, 20, 128, 42, '속도 ×' + SPEEDS[speedIdx], false, 17);
  button('cmd:auto', 274, 20, 128, 42, S.auto ? '자동 ON' : '자동 OFF', S.auto, 17);
  button('cmd:support', 408, 20, 136, 42, `지원 ${supportArmies().length}`, supportOpen, 17);
  button('armyT', 550, 20, 140, 42, '군단 전환', false, 17);
  button('cmd:menu', 698, 20, 120, 42, '시스템', false, 17);
}
function roundBtn(id, cx, cy, r, title, sub, col, on) {
  ctx.fillStyle = on ? 'rgba(80,60,16,.75)' : 'rgba(10,12,20,.6)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.stroke();
  label(title, cx, cy - (sub ? 12 : 0), r > 60 ? 22 : 17, COLORS.silver, 'center'); if (sub) label(sub, cx, cy + 16, r > 60 ? 22 : 15, col, 'center');
  btns.push({ id, x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, cx, cy, r });
}
function drawActionsMobile() {   // 오른쪽 행동 영역: 행동·보조·마법
  const u = ctrlOf(); if (!u) return;
  const primary = actionInfo(u), alt = actionInfo(u, true), sp = u.spells.length ? SPELL[u.spells[u.spellSel]] : null;
  roundBtn('m:act', 1196, 548, 74, primary.name, cooldownText(primary), primary.ready ? COLORS.gold : COLORS.silver2, primary.ready);
  if (u.spells.length ? u.special : u.special && u.range > 0) roundBtn('m:alt', 1112, 650, 46, '보조', cooldownText(alt), alt.ready ? COLORS.gold : COLORS.silver2, alt.ready);
  if (u.spells.length > 1) roundBtn('m:spell', 1000, 540, 46, S.lock.player > 0 ? '잠금' : sp.name, S.lock.player > 0 ? Math.ceil(S.lock.player) + '초' : sp.mp + 'MP', S.lock.player > 0 ? COLORS.danger : COLORS.silver2, false);
}
function drawMobileStatus() {   // 왼쪽 상단 전투 설정 아래에 조작 중인 장수 정보를 표시한다
  if (!SHOW.status) return;
  const u = ctrlOf(); if (!u) return;
  const w = 262, x = 6, y = 68, rh = 23, fs = 16, lo = 32, orange = '#ff9a3c', pr = actionInfo(u), sp = u.spells && u.spells.length ? u.spells : [];
  const h = 34 + 20 + 3 * 22 + 3 * rh + 3 * rh + (sp.length ? 20 + sp.length * 24 : 0) + 26 + 14;
  panel(x, y, w, h, 'rgba(255,255,255,.25)', 1, 'rgba(10,12,20,.55)');
  let yy = y + 20; label(u.name, x + 10, yy, 20, hpCol(u.hp / u.maxHp, COLORS.gold)); label('LV ' + u.lv, x + w - 10, yy, 17, orange, 'right');
  yy += 24; label(`${CATEGORY_NAME[u.category]}·${u.subclass}`, x + 10, yy, 15, COLORS.silver);
  yy += 18; bar(x + 10, yy, w - 20, 9, u.hp / u.maxHp, hpCol(u.hp / u.maxHp)); yy += 22; label('HP', x + 10, yy, fs, orange); label(`${Math.ceil(u.hp)}/${u.maxHp}`, x + w - 10, yy, fs, hpCol(u.hp / u.maxHp, COLORS.silver), 'right');
  yy += 22; if (u.maxMp) bar(x + 10, yy - 12, w - 20, 7, u.mp / u.maxMp, '#8a6aff'); label('MP', x + 10, yy + 4, fs, orange); label(u.maxMp ? `${Math.floor(u.mp)}/${u.maxMp}` : '—', x + w - 10, yy + 4, fs, COLORS.silver, 'right');
  yy += 24; label('FT', x + 10, yy, fs, orange); label(String(Math.round(Sim.effectiveFt(u))), x + 40, yy, fs, Sim.effectiveFt(u) > 50 ? '#ffb04d' : COLORS.silver); label('XP', x + 110, yy, fs, orange); label(`${u.xp}/${Sim.XP_NEED(u.lv)}`, x + 142, yy, fs, COLORS.silver);
  const c = (w - 20) / 3, cell = (k, v, i, r) => { label(k, x + 10 + i * c, yy + r * rh, fs, orange); label(String(v), x + 10 + i * c + lo, yy + r * rh, fs, v && v.col ? v.col : COLORS.silver); };
  yy += rh; cell('AT', statShow(u, 'atk'), 0, 0); cell('DF', statShow(u, 'df'), 1, 0); cell('AA', statShow(u, 'aa'), 2, 0);
  cell('AR', statShow(u, 'ar'), 0, 1); cell('DR', statShow(u, 'dr'), 1, 1); cell('AD', statShow(u, 'ad'), 2, 1);
  cell('MD', statShow(u, 'md'), 0, 2); cell('HR', statShow(u, 'hr'), 1, 2); cell('SP', statShow(u, 'sp'), 2, 2);
  yy += 3 * rh; label('ST', x + 10, yy, fs, orange); label(stText(u), x + 42, yy, fs, COLORS.silver); label('지형', x + 130, yy, fs, orange); label(TERRAIN_NAME[S.map[Sim.ti(u.tx, u.ty)]] || '—', x + 172, yy, fs, COLORS.silver);
  yy += rh; label('ITEM', x + 10, yy, fs, orange); label(itemName(u), x + 62, yy, fs, COLORS.silver);
  if (sp.length) { yy += 22; label('마법 · 터치하여 선택', x + 10, yy, fs, orange); sp.forEach((k, i) => { yy += 24; button('spell:' + i, x + 10, yy - 11, w - 20, 22, `${i + 1} ${SPELL[k].name}  ${SPELL[k].mp}MP`, u.spellSel === i, 14); }); }
  yy += 26; label('행동 ' + pr.name, x + 10, yy, 15, COLORS.silver2); label(pr.cd > 0 ? cooldownText(pr) : '가능', x + w - 10, yy, 15, pr.ready ? COLORS.gold : COLORS.silver2, 'right');
}

const itemName = u => u.item ? `${Sim.ITEMS[u.item].unique ? '★ ' : ''}${Sim.ITEMS[u.item].name}` : WEAPON_NAME[(styleOf(u) || {}).weapon] || '—';
const TERRAIN_NAME = ['평지', '숲', '바위', '물', '여울'], WEAPON_NAME = { glaive: '청룡언월도', halberd: '방천화극', lance: '창', twin: '쌍철극', sword: '검', spear: '창', bow: '활', fan: '부채' };
function drawStatGrid(u, x, y, w, fs, col = COLORS.gold) {   // 원작 능력치 창과 같은 줄 구성
  const rh = fs + 9, top = rh * 1.5 + 6, c = w / 3, orange = '#ff9a3c', cell = (k, v, i, r, span = 1) => { label(k, x + 8 + i * c, y + top + r * rh, fs, orange); label(String(v), x + 8 + i * c + fs * 2.2, y + top + r * rh, fs, v && v.col ? v.col : COLORS.silver); };
  label(u.name, x + 8, y + 2 + rh * 0.5, fs + 2, hpCol(u.hp / u.maxHp, col)); label('LV ' + u.lv, x + w - 8, y + 2 + rh * 0.5, fs, orange, 'right');
  const tile = Sim.ti(u.tx, u.ty), terrain = TERRAIN_NAME[S.map[tile]] || '—', wp = itemName(u);
  label('HP', x + 8, y + top, fs, orange); label(Math.ceil(u.hp) + '/' + u.maxHp, x + 8 + fs * 2.2, y + top, fs, hpCol(u.hp / u.maxHp, COLORS.silver)); label('HR', x + 8 + 2 * c, y + top, fs, orange); label(String(statShow(u, 'hr')), x + 8 + 2 * c + fs * 2.2, y + top, fs, COLORS.silver);
  cell('AT', statShow(u, 'atk'), 0, 1); cell('DF', statShow(u, 'df'), 1, 1); cell('AA', statShow(u, 'aa'), 2, 1);
  cell('AR', statShow(u, 'ar'), 0, 2); cell('DR', statShow(u, 'dr'), 1, 2); cell('AD', statShow(u, 'ad'), 2, 2);
  cell('MD', statShow(u, 'md'), 0, 3); cell('FT', Math.round(Sim.effectiveFt(u)), 1, 3); cell('SP', statShow(u, 'sp'), 2, 3);
  label('ST', x + 8, y + top + 4 * rh, fs, orange); label(stText(u), x + 8 + fs * 2.2, y + top + 4 * rh, fs, COLORS.silver); label('지형', x + 8 + 1.6 * c, y + top + 4 * rh, fs, orange); label(terrain, x + 8 + 1.6 * c + fs * 2.6, y + top + 4 * rh, fs, COLORS.silver);
  label('ITEM', x + 8, y + top + 5 * rh, fs, orange); label(wp, x + 8 + fs * 3, y + top + 5 * rh, fs, COLORS.silver);
  return top + 5 * rh + 14;
}
function drawSelectUI() {   // 선택 단계: 원작 상태창처럼 능력치 창 + 확정 버튼, 전투는 멈춰 있다 (적을 눌렀으면 그 적의 정보)
  const u = selTarget && alive(selTarget) ? selTarget : ctrlOf(); if (!u) return; const foe = u.team === 'enemy';
  label(foe ? '적 정보 — 전투 일시정지' : '캐릭터 선택 중 — 전투 일시정지', LEFT_W + VPW / 2, TB_H + 22, 20, foe ? COLORS.danger : COLORS.gold, 'center');
  const z = Z(), sx = LEFT_W + (u.x - cam.x) * z, sy = TB_H + (u.y - cam.y) * z, w = mobile ? 380 : 300, h = mobile ? 260 : 232, col = foe ? COLORS.danger : COLORS.gold;
  if (foe) { ctx.strokeStyle = COLORS.danger; ctx.lineWidth = 3; ctx.strokeRect(sx - 20 * z, sy - 36 * z, 40 * z, 44 * z); }   // 가리킨 적 표시
  const x = Math.max(LEFT_W + 6, Math.min(LEFT_W + VPW - w - 6, sx + 36)), y = Math.max(TB_H + 40, Math.min(TB_H + vh - h - 90, sy - h / 2));
  panel(x, y, w, h, col, 3, 'rgba(10,12,20,.95)');
  const gh = drawStatGrid(u, x, y, w, mobile ? 20 : 16, col);
  if (u.range > 0) label('사거리 ' + Math.round(u.range / TILE) + '칸', x + 8, y + gh + 12, 15, COLORS.silver2);
  if (u.spells && u.spells.length) label(u.spells.map(k => SPELL[k].name).join('·'), x + w - 8, y + gh + 12, 14, COLORS.silver2, 'right');
  button('sel:ok', LEFT_W + VPW / 2 - 110, TB_H + vh - (mobile ? 92 : 70), 220, mobile ? 64 : 44, foe ? (mobile ? '확정 (집중 공격)' : '확정: 집중 공격 (Enter)') : (mobile ? '확정' : '확정 (Enter)'), true, 18);
}
function drawMenu() {   // 시스템: PC·모바일 공통 기능을 용도별 두 영역으로 구분한다
  const display = [['m:pausesel', `캐릭터 선택 일시정지: ${SHOW.pauseSel ? 'ON' : 'OFF'}`, SHOW.pauseSel], ['m:dmg', `피해량 표시: ${SHOW.dmg ? 'ON' : 'OFF'}`, SHOW.dmg]];
  if (mobile) display.push(['m:status', `조작 장수 정보: ${SHOW.status ? 'ON' : 'OFF'}`, SHOW.status]);
  else display.push(['m:compact', tblCompact ? '하단 장수 정보: 축소' : '하단 장수 정보: 확대', !tblCompact], ['m:abil', tblAbility ? '하단 표 내용: 능력치' : '하단 표 내용: 상태']);
  const game = [['m:tutorial', '조작법 다시 보기'], ['m:mode', mobile ? 'PC 화면으로 전환' : '모바일 화면으로 전환'], [campaign.explore ? 'm:return' : 'm:restart', campaign.explore ? '탐색 종료 · 전략으로' : '전투 다시 시작'], ['m:close', mobile ? '전투로 돌아가기' : '전투로 돌아가기 (Esc)']];
  const ih = mobile ? 56 : 42, st = ih + 10, w = mobile ? 820 : 760, h = 112 + Math.max(display.length, game.length) * st, x = (VW - w) / 2, y = (VH - h) / 2, gap = 18, cw = (w - 72 - gap) / 2;
  panel(x, y, w, h, COLORS.gold, 3, 'rgba(10,12,20,.96)');
  label(mobile ? '모바일 시스템' : 'PC 시스템', x + 24, y + 30, 24, COLORS.gold); label('설정 중에는 전투가 일시정지됩니다', x + w - 24, y + 30, 15, COLORS.silver2, 'right');
  label('전투 표시', x + 28, y + 68, 18, COLORS.gold); label('화면 · 게임', x + 44 + cw + gap, y + 68, 18, COLORS.gold);
  display.forEach((it, i) => button(it[0], x + 26, y + 82 + i * st, cw, ih, it[1], !!it[2], mobile ? 18 : 16));
  game.forEach((it, i) => button(it[0], x + 44 + cw + gap, y + 82 + i * st, cw, ih, it[1], false, mobile ? 18 : 16));
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
  const p = pages[tutorialStep], x = 250, y = 190, w = 780, h = 340;
  ctx.fillStyle = 'rgba(4,6,12,.78)'; ctx.fillRect(0, 0, VW, VH); panel(x, y, w, h, COLORS.gold, 4, 'rgba(18,21,31,.98)');
  label(`전투 튜토리얼  ${tutorialStep + 1}/${pages.length}`, x + 36, y + 42, 20, COLORS.silver2);
  label(p[0], x + w / 2, y + 100, 36, COLORS.gold, 'center');
  label(p[1], x + w / 2, y + 160, 20, COLORS.silver, 'center'); label(p[2], x + w / 2, y + 202, 20, COLORS.silver, 'center');
  if (tutorialStep > 0) button('tut:prev', x + 36, y + h - 74, 160, 46, '이전', false, 18);
  button('tut:skip', x + w / 2 - 80, y + h - 74, 160, 46, '건너뛰기', false, 18);
  button('tut:next', x + w - 196, y + h - 74, 160, 46, tutorialStep === pages.length - 1 ? '전투 시작' : '다음', true, 18);
}
function drawOverlay(title, lines, col) {
  ctx.fillStyle = 'rgba(10,12,20,.8)'; ctx.fillRect(0, 0, VW, VH);
  label(title, VW / 2, 230, 96, col, 'center'); lines.forEach((s, i) => label(s, VW / 2, 330 + i * 38, 22, COLORS.silver, 'center'));
}
function drawEvent(e) {
  ctx.fillStyle = 'rgba(10,12,20,.55)'; ctx.fillRect(0, 0, VW, VH);
  const col = e.team === 'enemy' ? '#ff8a32' : COLORS.gold, w = e.type === 'dialogue' ? 760 : 700, h = e.type === 'dialogue' ? 150 : 104, x = (VW - w) / 2, y = (VH - h) / 2;
  panel(x, y, w, h, col, 4, '#e7e1cf');
  if (e.type === 'dialogue') {
    panel(x + 14, y + 14, 112, h - 28, COLORS.ink, 2, '#b9c5c7');
    drawBody(ctx, x + 70, y + 112, 22, e.team === 'enemy' ? Math.PI : 0, STYLES[e.key] || STYLES.captain, { t: T, weaponLen: 62 });
    label(e.speaker, x + 148, y + 42, 21, e.team === 'enemy' ? '#c55a2d' : '#315a86'); label(e.text, x + 148, y + 84, 22, '#292520');
  } else label(e.text, VW / 2, y + 50, 24, col, 'center');
  label(mobile ? '화면을 탭하여 계속' : '클릭 / Enter', x + w - 16, y + h - 14, 14, '#68645d', 'right');
}
function drawTitle() {
  const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, COLORS.dusk1); g.addColorStop(0.55, COLORS.dusk2); g.addColorStop(1, COLORS.dusk3); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = COLORS.moon; ctx.beginPath(); ctx.arc(1010, 150, 52, 0, TAU); ctx.fill();
  ctx.fillStyle = COLORS.ink2; ctx.beginPath(); ctx.moveTo(0, VH); ctx.lineTo(0, 620); for (let x = 0; x <= VW; x += 40) ctx.lineTo(x, 620 + 26 * Math.sin(x * 0.006) + 16 * Math.sin(x * 0.02)); ctx.lineTo(VW, VH); ctx.closePath(); ctx.fill();
  [['guan', 250], ['zhao', 360], ['huang', 470], ['kong', 570], ['diao', 670], ['lubu', 880], ['captain', 1000], ['dian', 1100]].forEach(([k, x]) => drawBody(ctx, x, 670, 30, x < 780 ? 0 : Math.PI, STYLES[k], { t: T, weaponLen: k === 'guan' ? 110 : 130, weaponAng: k === 'guan' ? -0.85 : undefined }));
  label('삼국 사우스파크', VW / 2, 150, 100, COLORS.gold, 'center'); label('v0.1.149', 24, 30, 16, COLORS.silver2);
  (mobile ? ['왼쪽 화면을 누르고 끌기(조이스틱): 캐릭터 이동 · 아군을 탭: 조작 장수 변경', '오른쪽 행동 버튼·빈 곳 탭: 특수기·마법 · 적을 탭: 집중 공격', '왼쪽 위: 화면·전투·군단·메뉴 · 오른쪽 아래: 부대별 진형·행동 지침'] : ['조작 캐릭터 이동: 숫자패드 (또는 WASD+QEZC, 화면의 보조키) — 적이 있는 칸으로 밀면 공격', 'Space: 특수기·마법 · X: 보조 행동 · 1 2 3: 마법 선택 · ←→ 조작 캐릭터 변경 · ↑↓ 군단 변경', '돌격 F · 정지 V · 후퇴 R · 자유 B · 자동전투 T · 적을 클릭: 집중 공격 · Ctrl: 가속 · Esc: 시스템']).forEach((s, i) => label(s, VW / 2, 295 + i * 34, 20, COLORS.silver, 'center'));
  button('title:new', 430, 410, 200, 58, '뉴게임', true, 24); button('title:load', 650, 410, 200, 58, hasCampaign() ? '로드' : '로드 · 저장 없음', false, 22);
  label(mobile ? '버튼을 터치해 시작' : 'Enter: 뉴게임 · L: 로드', VW / 2, 495, 18, COLORS.silver2, 'center'); if (titleNotice) label(titleNotice, VW / 2, 535, 20, COLORS.danger, 'center');
  if (saveSlotMode) drawSaveSlots();
}
function drawSaveSlots() {
  const title = saveSlotMode === 'new' ? '새 게임 슬롯 선택' : saveSlotMode === 'save' ? '저장 슬롯 선택' : '불러오기 슬롯 선택';
  panel(390, 145, 500, 370, COLORS.gold, 3, 'rgba(8,20,25,.97)'); label(title, 640, 182, 25, COLORS.gold, 'center');
  for (let slot = 1; slot <= SAVE_SLOTS; slot++) {
    const data = readCampaign(slot), saved = data && data.campaign, stage = saved && stageById(data.campaign.at);
    button(`save-slot:${slot}`, 430, 215 + (slot - 1) * 70, 420, 54, saved ? `${slot}번 · ${data.campaign.turn || 1}턴 · ${stage ? stage.name : '원정'}` : `${slot}번 · 비어 있음`, slot === activeSaveSlot, 18);
  }
  button('save-slot:close', 540, 440, 200, 44, '닫기', false, 17);
}
function drawMapFlag(x, y, faction, mark, highlight = false) {
  const style = FACTION_STYLE[faction] || FACTION_STYLE['여포'], w = highlight ? 38 : 31, h = highlight ? 27 : 22;
  ctx.save(); ctx.strokeStyle = '#211b18'; ctx.lineWidth = highlight ? 4 : 3;
  ctx.beginPath(); ctx.moveTo(x, y + 18); ctx.lineTo(x, y - h); ctx.stroke();
  ctx.fillStyle = style.main; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + w, y - h + 3); ctx.lineTo(x + w - 7, y - 8); ctx.lineTo(x, y - 11); ctx.closePath(); ctx.fill(); ctx.stroke();
  label(mark, x + w * .48, y - 12, highlight ? 14 : 12, style.light, 'center'); ctx.restore();
}
function drawStageMap() {
  const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#345d55'); g.addColorStop(0.55, '#66834c'); g.addColorStop(1, '#9a8150'); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = '#1f6677'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(120, 0); ctx.bezierCurveTo(80, 160, 165, 255, 105, 405); ctx.bezierCurveTo(60, 520, 125, 630, 40, VH); ctx.lineTo(0, VH); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(206,231,224,.6)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(250, 30); ctx.bezierCurveTo(330, 180, 270, 330, 430, 475); ctx.bezierCurveTo(570, 590, 750, 470, 990, 680); ctx.stroke();
  ctx.fillStyle = 'rgba(25,55,30,.25)'; for (let x = 170; x < 980; x += 90) for (let y = 75; y < 690; y += 75) { ctx.beginPath(); ctx.arc(x + (y % 35), y, 30, 0, TAU); ctx.fill(); }
  const corps = roster[campaign.corps], here = stageById(corps.at);
  for (const s of STAGES) for (const id of s.links) { const t = stageById(id); if (s.id < t.id) { ctx.strokeStyle = 'rgba(29,25,20,.82)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y); ctx.stroke(); ctx.strokeStyle = '#d9c98a'; ctx.lineWidth = 2; ctx.stroke(); } }
  const targetRows = {};
  for (const [corpsIndex, c] of roster.entries()) if (c.target) {
    const path = route(c.at, c.target).map(stageById), goal = path[path.length - 1], row = targetRows[c.target] || 0; targetRows[c.target] = row + 1; if (path.length < 2) continue;
    ctx.save(); ctx.strokeStyle = '#75dcff'; ctx.lineWidth = 4; ctx.setLineDash([10, 7]); ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y); for (const s of path.slice(1)) ctx.lineTo(s.x, s.y); ctx.stroke(); ctx.restore();
    const a = path[0], b = path[1], fx = (a.x + b.x) / 2, fy = (a.y + b.y) / 2 - row * 24, commander = Sim.U[c.units[0]]?.name || corpsName(c);
    drawMapFlag(fx, fy, '여포', String(corpsIndex + 1)); label(commander, fx + 18, fy + 32, 12, '#bcecff', 'center');
    label('이동 예정', goal.x, goal.y - 42 - row * 16, 13, '#bcecff', 'center');
  }
  campaign.movement.forEach((m, i) => { const a = stageById(m.from), b = stageById(m.to); if (!a || !b) return; const faction = m.team === 'player' ? '여포' : m.faction || a.faction, style = FACTION_STYLE[faction], highlight = i === campaign.movementPage; ctx.strokeStyle = style.light; ctx.lineWidth = highlight ? 11 : 7; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); const fx = (a.x + b.x) / 2, fy = (a.y + b.y) / 2; drawMapFlag(fx, fy, faction, String(m.team === 'player' ? (m.corpsIndex || 0) + 1 : (m.forceId ?? i) + 1), highlight); label(m.commander, fx + 20, fy + 32, 12, style.light, 'center'); });
  for (const s of STAGES) {
    const on = s === here, faction = stageFaction(s), style = FACTION_STYLE[faction], targeted = s.id === (campaign.destination || corps.target);
    ctx.fillStyle = style.main; ctx.beginPath(); ctx.arc(s.x, s.y, on ? 22 : 16, 0, TAU); ctx.fill(); ctx.strokeStyle = on ? COLORS.gold : style.dark; ctx.lineWidth = on ? 5 : 3; ctx.stroke();
    drawMapFlag(s.x + 10, s.y - 3, faction, faction[0], on);
    label(`${s.stage}. ${s.name}`, s.x, s.y + 38, 18, on ? COLORS.goldSel : '#f3eed8', 'center');
    label(`${THEME_NAME[s.theme]} · ${s.difficulty}`, s.x, s.y + 61, 14, s.theme === 'fortress' ? '#ffb06a' : COLORS.silver2, 'center');
    if (targeted) { ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(s.x, s.y, 28, 0, TAU); ctx.stroke(); }
    btns.push({ id: 'stage:' + s.id, x: s.x - 32, y: s.y - 36, w: 72, h: 84 });
  }
  panel(1005, 20, 250, 680, COLORS.gold, 3, 'rgba(8,20,25,.88)');
  label('전략', 1130, 52, 27, COLORS.gold, 'center');
  label(`점령 ${STAGES.filter(s => s.owner === 'player').length}/${STAGES.length} · ${campaign.turn}턴`, 1025, 96, 15, COLORS.silver);
  label(moveMode === 'city' && !moveSelectOpen ? '지도에서 이동할 지역을 선택' : `이동 예정 ${roster.filter(c => c.target).length}개 군단`, 1130, 130, 14, moveMode === 'city' && !moveSelectOpen ? COLORS.gold : COLORS.silver2, 'center');
  ['여포', '조조', '유비'].forEach((faction, i) => { ctx.fillStyle = FACTION_STYLE[faction].main; ctx.fillRect(1025 + i * 70, 151, 12, 12); label(faction, 1042 + i * 70, 162, 12, FACTION_STYLE[faction].light); });
  label('연주 진류 → 정도 → 2개 진군로 → 서주 담현', 1025, 184, 15, COLORS.gold);
  STAGES.forEach((s, i) => {
    const faction = stageFaction(s); label(`${s.stage}. ${s.region}·${s.name} · ${faction} · Lv${s.level}`, 1025, 210 + i * 21, 12, s === here ? COLORS.goldSel : FACTION_STYLE[faction].light);
    label(s.stage === 1 && !stageEnemyCount(s) ? '정비' : `${enemyRolesAt(s)} · ${stageEnemyCount(s)}명 ⚔${enemyPowerAt(s)}`, 1233, 210 + i * 21, 11, s.theme === 'fortress' ? '#ffb06a' : COLORS.silver2, 'right');
  });
  button('campaign:scout', 1025, 418, 100, 34, '정찰', mapTool === 'scout', 15); button('campaign:diplomacy', 1135, 418, 100, 34, '외교', mapTool === 'diplomacy', 15);
  ctx.save(); ctx.strokeStyle = COLORS.gold; ctx.fillStyle = COLORS.gold; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(1043, 433, 6, 0, TAU); ctx.moveTo(1047.5, 437.5); ctx.lineTo(1054, 444); ctx.stroke();   // 정찰: 돋보기
  ctx.beginPath(); ctx.moveTo(1153, 444); ctx.lineTo(1153, 427); ctx.stroke(); ctx.beginPath(); ctx.moveTo(1153, 427); ctx.lineTo(1166, 431); ctx.lineTo(1153, 436); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();   // 외교: 백기
  button('campaign:move', 1025, 466, 210, 36, moveMode === 'city' && !moveSelectOpen ? '지역 선택 중' : '이동', moveSelectOpen || moveMode === 'city', 16);
  button('campaign:roster', 1025, 508, 210, 36, '군단 편성', false, 16);
  button('campaign:explore', 1025, 550, 100, 38, '탐색', false, 16); button('campaign:end', 1135, 550, 100, 38, '턴 종료', true, 16);
  button('campaign:save', 1025, 594, 100, 34, '저장', false, 15); button('campaign:load', 1135, 594, 100, 34, '로드', false, 15);
  panel(1025, 636, 210, 54, 'rgba(255,255,255,.35)', 1, 'rgba(0,0,0,.3)');
  label(campaign.notice, 1130, 654, 13, COLORS.silver, 'center');
  label('이동 지정 → 저장 → 턴 종료', 1130, 678, 12, COLORS.goldSel, 'center');
  if (moveSelectOpen) drawMoveSelect();
  if (exploreSelectOpen) drawExploreSelect();
  if (scoutView) drawScoutView();
  if (campaign.pendingEncounter) campaign.pendingEncounter.invasion && !campaign.pendingEncounter.intelSeen ? drawInvasionIntel() : drawResponseSelect();
  else if (campaign.movement.length) drawMovementNotice();
  if (saveSlotMode) drawSaveSlots();
}
function drawInvasionIntel() {
  const encounter = campaign.pendingEncounter, forces = enemyForces.filter(f => f.active && f.at === encounter.stage.id), shown = forces.slice(0, 13), x = 300, y = 80, w = 680, h = 560;
  ctx.fillStyle = 'rgba(10,12,20,.72)'; ctx.fillRect(0, 0, VW, VH); panel(x, y, w, h, COLORS.danger, 3, 'rgba(8,20,25,.98)');
  label(`${encounter.stage.name} 적 침공 정보`, x + w / 2, y + 42, 27, '#ff9a7d', 'center');
  label(`적 ${forces.length}개 군단·${forces.reduce((n, f) => n + f.army.units.length, 0)}명 · 총 전투력 ⚔${forces.reduce((n, f) => n + forcePow(f), 0)}`, x + w / 2, y + 78, 17, COLORS.goldSel, 'center');
  shown.forEach((force, row) => { const commander = Sim.U[force.army.leader]?.name || force.army.name, role = force.role === 'garrison' ? '수비' : '원정'; label(`${commander} · ${role} Lv${force.level} · ${force.army.units.length}명 · ⚔${forcePow(force)}`, x + 55, y + 118 + row * 27, 15, COLORS.silver); });
  if (forces.length > shown.length) label(`외 ${forces.length - shown.length}개 군단`, x + 55, y + 118 + shown.length * 27, 14, COLORS.silver2);
  button('campaign:intel:continue', x + w / 2 - 110, y + h - 50, 220, 36, '대응 군단 선택', true, 16);
}
function drawMovementNotice() {
  const x = 10, y = 10, w = 420, h = 116, pages = campaign.movement.length, move = campaign.movement[campaign.movementPage];
  const encounter = movementEncounter(move), event = encounter ? encounter.capture ? '점령 발생' : move.team === 'enemy' ? '요격 발생' : '공격 발생' : '군단 이동 완료'; panel(x, y, w, h, move.team === 'enemy' ? COLORS.danger : COLORS.gold, 3, 'rgba(8,20,25,.96)'); label(`${event} · ${campaign.movementPage + 1}/${pages}`, x + w / 2, y + 28, 21, move.team === 'enemy' ? '#ff9a7d' : COLORS.gold, 'center');
  label(move.text, x + w / 2, y + 60, 14, COLORS.silver, 'center');
  button('campaign:movement:close', x + w / 2 - 66, y + h - 38, 132, 30, campaign.movementPage < pages - 1 ? '다음 군단' : campaign.pendingEncounter ? '계속' : '확인', true, 14);
}
function drawResponseSelect() {
  const encounter = campaign.pendingEncounter, pageSize = 8, pages = Math.ceil(encounter.responders.length / pageSize), shown = encounter.responders.slice(campaign.responsePage * pageSize, campaign.responsePage * pageSize + pageSize);
  ctx.fillStyle = 'rgba(10,12,20,.7)'; ctx.fillRect(0, 0, VW, VH);
  const x = 300, y = 110, w = 680, h = 500; panel(x, y, w, h, COLORS.danger, 3, 'rgba(8,20,25,.98)');
  label(`${encounter.stage.name} ${encounter.invasion ? '요격' : '공격'} · 대응 군단 선택`, x + w / 2, y + 42, 26, '#ffb06a', 'center');
  label(`적 전투력 ⚔${enemyPowerAt(encounter.stage)} · 대응 가능 아군 ⚔${encounter.responders.reduce((n, i) => n + corpsPow(roster[i]), 0)}`, x + w / 2, y + 92, 15, COLORS.goldSel, 'center');
  label(encounter.invasion ? '같은 도시 또는 연결된 도시의 군단이 요격할 수 있습니다.' : '도착한 군단으로 공격을 시작합니다.', x + w / 2, y + 76, 16, COLORS.silver, 'center');
  shown.forEach((index, row) => { const corps = roster[index]; button(`campaign:response:${index}`, x + 40, y + 102 + row * 42, w - 80, 36, `${corpsName(corps)} · ${stageById(corps.at).name} · ${corps.units.filter(Boolean).length}/18명 · ⚔${corpsPow(corps)}`, false, 16); });
  button('campaign:response:prev', x + 40, y + h - 50, 90, 36, '◀', false, 18);
  button('campaign:response:abandon', x + w / 2 - 90, y + h - 50, 180, 36, encounter.invasion ? '방어 포기' : '공격 포기', false, 16);
  button('campaign:response:next', x + w - 130, y + h - 50, 90, 36, '▶', false, 18);
  label(`${campaign.responsePage + 1}/${pages}`, x + w - 150, y + 44, 15, COLORS.silver, 'right');
}
function drawMoveSelect() {
  ctx.fillStyle = 'rgba(10,12,20,.62)'; ctx.fillRect(0, 0, VW, VH);
  const x = 300, y = 70, w = 680, h = 580;
  panel(x, y, w, h, COLORS.gold, 3, 'rgba(8,20,25,.97)');
  const page = roster.slice(movePage * 8, movePage * 8 + 8);
  label('1. 이동할 군단 선택', x + w / 2, y + 40, 25, COLORS.gold, 'center');
  label('군단을 선택한 뒤 전략 지도에서 목적지를 선택합니다.', x + w / 2, y + 75, 16, COLORS.silver, 'center');
  page.forEach((corps, row) => { const target = corps.target ? `${stageById(corps.target).name}(${moveTurns(corps)}턴)` : '대기'; button(`campaign:move:${movePage * 8 + row}`, x + 40, y + 105 + row * 46, w - 80, 38, `${corpsName(corps)}  ${stageById(corps.at).name} → ${target}  · ${corps.units.filter(Boolean).length}/18명 · ⚔${corpsPow(corps)}`, campaign.corps === movePage * 8 + row, 16); });
  button('campaign:move:prev', x + 40, y + h - 50, 100, 36, '◀', false, 18); button('campaign:move:close', x + w - 140, y + h - 50, 100, 36, '닫기', false, 16); button('campaign:move:next', x + w - 250, y + h - 50, 100, 36, '▶', false, 18);
}
function drawScoutView() {
  const stage = stageById(scoutView), forces = enemyForces.filter(f => f.active && f.at === stage.id).sort((a, b) => forcePow(b) - forcePow(a)), x = 260, y = 60, w = 760, h = 600;
  ctx.fillStyle = 'rgba(10,12,20,.62)'; ctx.fillRect(0, 0, VW, VH); panel(x, y, w, h, COLORS.gold, 3, 'rgba(8,20,25,.97)');
  label(`${stage.name} 정찰 보고 · 적 ${forces.length}군단 ⚔${enemyPowerAt(stage)}`, x + w / 2, y + 40, 24, COLORS.gold, 'center');
  label(`내 군단 ⚔${corpsNear(stage).reduce((n, { c }) => n + corpsPow(c), 0)} (지역·연결 지역)`, x + w / 2, y + 72, 16, COLORS.silver, 'center');
  forces.slice(0, 12).forEach((f, i) => label(`${f.army.name} [${f.role === 'garrison' ? '수비' : '원정'}] Lv${f.level} · ${f.army.units.length}명 · ⚔${forcePow(f)} · ${Sim.U[f.army.leader].name}`, x + 30, y + 112 + i * 36, 17, i === 0 ? COLORS.goldSel : COLORS.silver));
  if (!forces.length) label('주둔한 적이 없습니다.', x + w / 2, y + 300, 20, COLORS.dim, 'center');
  button('campaign:scout:close', x + w / 2 - 70, y + h - 50, 140, 36, '닫기', true, 16);
}
function drawExploreSelect() {
  ctx.fillStyle = 'rgba(10,12,20,.62)'; ctx.fillRect(0, 0, VW, VH);
  const x = 300, y = 70, w = 680, h = 580, available = roster.map((corps, index) => ({ corps, index })).filter(({ corps }) => combatReadyCorps(corps) && stageById(corps.at).owner === 'player'), pages = Math.max(1, Math.ceil(available.length / 8)), page = available.slice(explorePage * 8, explorePage * 8 + 8);
  panel(x, y, w, h, COLORS.gold, 3, 'rgba(8,20,25,.97)');
  label('탐색할 군단 선택', x + w / 2, y + 40, 25, COLORS.gold, 'center');
  label('선택한 군단이 현재 주둔 중인 점령 지역을 탐색합니다.', x + w / 2, y + 75, 16, COLORS.silver, 'center');
  page.forEach(({ corps, index }, row) => button(`campaign:explore:${index}`, x + 40, y + 105 + row * 46, w - 80, 38, `${corpsName(corps)} · ${stageById(corps.at).name} · ${corps.units.filter(Boolean).length}/18명 · ⚔${corpsPow(corps)}`, false, 16));
  button('campaign:explore:prev', x + 40, y + h - 50, 100, 36, '◀', false, 18); button('campaign:explore:close', x + w - 140, y + h - 50, 100, 36, '닫기', false, 16); button('campaign:explore:next', x + w - 250, y + h - 50, 100, 36, '▶', false, 18); label(`${explorePage + 1}/${pages}`, x + w / 2, y + h - 32, 14, COLORS.silver2, 'center');
}
function drawRoster() {
  ctx.fillStyle = '#0b3036'; ctx.fillRect(0, 0, VW, VH);
  panel(18, 16, 1244, 54, COLORS.gold, 3, 'rgba(6,17,23,.9)');
  label(rosterMode === 'select' ? '군단 편성 · 교환 군단 선택' : rosterMode === 'equip' ? '군단 편성 · 장비 관리' : rosterMode === 'detail' ? '군단 편성 · 장수 상세' : '군단 편성 · 군단 간 교환', 42, 43, 27, COLORS.gold);
  label(`보유 ${roster.length} / ${ROSTER_MAX}군단 · 군단당 6명×3분대`, 520, 43, 17, COLORS.silver);
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
      label(`${squad + 1}분대`, 70, 359 + squad * 82, 18, members.length ? COLORS.gold : COLORS.dim);
      label(members.length ? members.map(k => Sim.U[k].name).join(' · ') : '비어 있음', 150, 359 + squad * 82, 15, members.length ? COLORS.silver : COLORS.dim);
      label(members.length ? `⚔${Sim.corpsPower(corps.units.slice(squad * 6, squad * 6 + 6), 'player', corps.growth.slice(squad * 6, squad * 6 + 6))}` : '', 548, 359 + squad * 82, 15, COLORS.goldSel, 'right');
    }
    button('roster:detail', 52, 574, 164, 38, '장수 상세', false, 15);
    button('roster:equip', 224, 574, 164, 38, '장비 관리', false, 15);
    if (roster.length > 1) button('roster:dismiss', 396, 574, 164, 38, '군단 해제', false, 15);
    panel(622, 94, 630, 536, COLORS.silver2, 2, 'rgba(8,20,25,.92)');
    label('교환 대상 군단', 646, 126, 20, COLORS.gold);
    const targets = roster.map((c, index) => ({ c, index })).filter(x => x.index !== rosterSource), page = targets.slice(rosterPage * 10, rosterPage * 10 + 10);
    page.forEach(({ c, index }, row) => button(`roster:target:${index}`, 646, 154 + row * 40, 582, 34, `${index + 1}군단  ${corpsName(c)}  ${c.units.filter(Boolean).length}/18 · ⚔${corpsPow(c)}`, false, 15));
    button('roster:new', 646, 564, 280, 42, roster.length < ROSTER_MAX ? '새 군단 생성' : '군단 보유 한도 100', false, 16);
    button('roster:page:prev', 944, 564, 132, 42, '◀', false, 18); button('roster:page:next', 1096, 564, 132, 42, '▶', false, 18);
  } else if (rosterMode === 'detail') {
    const corps = roster[rosterSource], named = corps.units.map((key, slot) => ({ key, slot })).filter(x => x.key && !Sim.U[x.key].generic);
    if (!named.some(x => x.slot === rosterDetailSlot)) rosterDetailSlot = named[0]?.slot ?? 0;
    const key = corps.units[rosterDetailSlot], unit = key && Sim.U[key], growth = corps.growth[rosterDetailSlot] || {}, stats = unit && Sim.unitStats(key, 'player', growth), item = Sim.ITEMS[growth.item];
    panel(28, 92, 360, 548, COLORS.silver2, 2, 'rgba(8,20,25,.92)'); panel(408, 92, 844, 548, COLORS.gold, 2, 'rgba(8,20,25,.92)');
    label(`${rosterSource + 1}군단 · ${corpsName(corps)}`, 46, 122, 21, COLORS.gold);
    named.forEach(({ key: k, slot }, row) => button(`roster:detail:${slot}`, 46, 146 + row * 26, 324, 24, `${Math.floor(slot / 6) + 1}분대 · ${Sim.U[k].name}`, slot === rosterDetailSlot, 14));
    if (!named.length) label('이 군단에는 이름 있는 장수가 없습니다.', 208, 330, 17, COLORS.dim, 'center');
    if (unit) {
      drawBody(ctx, 500, 236, 28, 0, STYLES[unit.style] || STYLES.captain, { t: T, weaponLen: 95 });
      const main = CATEGORY_NAME[Sim.unitCategory(key)], sub = Sim.unitSubclass(key), grade = Sim.GRADE[key] || '일반', lv = growth.lv || 1, xp = growth.xp || 0;
      label(unit.name, 590, 130, 30, COLORS.goldSel); label(`LV ${lv} · XP ${xp}/${Sim.XP_NEED(lv)} · 등급 ${grade}`, 590, 166, 18, COLORS.silver);
      label(`병종 ${main} · 칭호 ${sub}`, 590, 200, 21, COLORS.gold); label(`전투력 ⚔${Sim.unitPower(key, 'player', growth)} · ITEM ${item ? item.name : '없음'}`, 590, 234, 17, COLORS.silver2);
      const values = [['HP', stats.maxHp], ['MP', growth.maxMp ?? unit.mp ?? 0], ['FT', 0], ['AT', stats.atk], ['DF', stats.df], ['AD', stats.ad], ['MD', stats.md], ['AA', stats.aa], ['HR', stats.hr], ['SP', stats.sp], ['AR', stats.ar], ['DR', stats.dr]];
      values.forEach(([name, value], i) => { const col = i % 4, row = Math.floor(i / 4); panel(438 + col * 194, 282 + row * 50, 178, 38, COLORS.silver2, 1, 'rgba(15,44,52,.8)'); label(name, 452 + col * 194, 301 + row * 50, 15, COLORS.gold); label(String(Math.round(value * 10) / 10), 600 + col * 194, 301 + row * 50, 17, COLORS.silver, 'right'); });
      label('칭호 효과', 438, 448, 19, COLORS.gold); const effects = [...(Sim.titleDesc(sub) || ['고유 칭호 효과 없음. 기본 병종과 특수기를 사용한다.']), ...(Sim.titleDesc(sub) ? ['아군 소속이면 수치 ×' + Sim.TITLE_BONUS + '.'] : [])]; effects.forEach((s, i) => label(s, 438, 478 + i * 27, 16, COLORS.silver));
      label(`특수기: ${unit.special ? `${SPECIAL[unit.special]?.name} — ${SPECIAL_EFFECT[unit.special] || '고유 행동'}` : '없음'}`, 438, 532, 15, COLORS.goldSel);
      label(`주문: ${unit.spells?.length ? unit.spells.map(s => SPELL[s]?.name).filter(Boolean).join(' · ') : '없음'}`, 438, 558, 15, COLORS.goldSel);
      STAT_GUIDE.forEach((s, i) => label(s, 438, 586 + i * 16, 11, COLORS.silver2));
    }
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
        label(commander ? '군단장' : '', x + 570, ry + 12, 13, COLORS.gold, 'right');
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
  ctx.save(); ctx.globalAlpha = 0.92; ctx.drawImage(terrain, mx, my, mw, mh); ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.5; ctx.strokeRect(mx, my, mw, mh);
  for (const e of S.units) if (alive(e)) { ctx.fillStyle = e.team === 'player' ? '#4fb0ff' : '#ff5a4a'; const s = e.isLeader ? 4 : 2.5; ctx.fillRect(mx + e.x * k - s / 2, my + e.y * k - s / 2, s, s); }
  const c = ctrlOf(); if (c && alive(c)) { ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 1.5; ctx.strokeRect(mx + c.x * k - 3.5, my + c.y * k - 3.5, 7, 7); }
  ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 1.5; ctx.strokeRect(mx + cam.x * k, my + cam.y * k, VPW / Z() * k, vh / Z() * k); ctx.restore();
}
function draw() {
  btns = []; mini = null;
  if (state === 'title') { drawTitle(); return; }
  if (state === 'map') { drawStageMap(); return; }
  if (state === 'roster') { drawRoster(); return; }
  layout(); clampCam();
  ctx.fillStyle = COLORS.ink; ctx.fillRect(0, 0, VW, VH);
  drawWorld();
  if (mobile) {
    drawToolbarMobile(); drawMobileStatus(); drawMobileSide(); drawStick(); drawActionsMobile();
  } else { drawToolbar(); drawLeftPanel(); drawSpellPanel(); drawPad(); drawTable(); }
  drawMinimap();
  if (S.auto) label('자동 전투', VW - 10, (mini ? mini.y + mini.h : TB_H) + 20, 18, COLORS.gold, 'right');
  if (S.t < 14 && !S.over) label(mobile ? '왼쪽 화면을 눌러 끌면 이동 · 적에게 부딪치면 공격 · 오른쪽 행동 버튼' : '숫자패드(또는 WASD+QEZC)로 조작 캐릭터 이동 · 적에게 부딪치면 공격 · Space 특수기/마법', LEFT_W + VPW / 2, TB_H + vh - (mobile ? 112 : 16), 16, COLORS.silver2, 'center');
  if (tutorialStep >= 0) { drawTutorial(); return; }
  if (S.events.length) { drawEvent(S.events[0]); return; }
  if (selectMode && !menuOpen && !S.over) drawSelectUI();
  if (menuOpen) drawMenu();
  if (supportOpen) drawSupport();
  if (S.over === 'win') drawOverlay('승 리', [`${campaign.battle ? campaign.battle.name + '을 점령했다!' : '적 군단을 모두 물리쳤다!'}`, `${Math.round(S.t)}초 · 격파 ${S.stats.kills} · 도주 ${S.stats.fled} · 전사 ${S.stats.lost} · 레벨업 ${S.stats.levelups}`, mobile ? '화면을 탭하면 전략으로' : '클릭 / R 로 전략 화면'], COLORS.gold);
  else if (S.over === 'lose') drawOverlay('패 배', ['총대장 관우가 쓰러졌다…', `${Math.round(S.t)}초 · 격파 ${S.stats.kills} · 전사 ${S.stats.lost}`, mobile ? '화면을 탭하면 전략으로' : '클릭 / R 로 전략 화면'], COLORS.danger);
  else if (paused && !menuOpen) drawOverlay('일시정지', [mobile ? '화면을 탭하면 계속' : 'P 로 계속'], COLORS.silver);
}

function drawSupport() {
  const list = supportArmies(), w = mobile ? 620 : 430, x = mobile ? (VW - w) / 2 : VW - w - 12, y = mobile ? 90 : TB_H + 10, h = 90 + Math.max(1, list.length) * 58;
  panel(x, y, w, h, COLORS.gold, 2, 'rgba(8,10,18,.96)');
  label('지원 요청', x + 18, y + 25, mobile ? 24 : 20, COLORS.gold);
  button('support:close', x + w - 82, y + 8, 68, 34, '닫기', false, 15);
  if (!list.length) label('연결된 도시에서 참전 가능한 군단이 없습니다.', x + w / 2, y + 78, 17, COLORS.silver2, 'center');
  list.forEach((A, i) => {
    const yy = y + 52 + i * 58, groups = S.armies.filter(B => B.team === 'player' && B.support && B.corps === A.corps), corps = roster.find(c => c.id === A.corps);
    label(`${corps ? corpsName(corps) : A.name} · ${groups.reduce((n, B) => n + B.units.filter(u => !u.dead).length, 0)}명`, x + 18, yy + 24, mobile ? 19 : 16, COLORS.silver);
    button('support:' + A.id, x + w - 150, yy + 7, 132, 42, '참전', false, 17);
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
function pick(u) { if (!u || !alive(u) || u.team !== 'player') return; look = null; armyIdx = u.army.id; Sim.setCtrl(S, u.army, u); selTarget = null; beginSelect(); }
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
function uiClick(id) {
  if (id === 'campaign:save') { saveSlotMode = 'save'; return; }
  if (id === 'campaign:load') { saveSlotMode = 'load'; return; }
  if (id === 'save-slot:close') { saveSlotMode = null; return; }
  if (/^save-slot:[1-3]$/.test(id)) {
    const slot = +id.slice(10), mode = saveSlotMode; saveSlotMode = null;
    if (mode === 'new') { activeSaveSlot = slot; startNewGame(); }
    else if (mode === 'save') { campaign.notice = `${slot}번 슬롯에 ${campaign.turn}턴 원정을 저장했습니다.`; saveCampaign(slot); }
    else if (mode === 'load' && loadGame(slot) && state === 'map') campaign.notice = `${slot}번 슬롯의 ${campaign.turn}턴 원정을 불러왔습니다.`;
    return;
  }
  if (id === 'campaign:roster') { state = 'roster'; rosterMode = 'select'; rosterPick = null; campaign.notice = '좌측 군단과 교환할 대상 군단을 선택하세요.'; return; }
  if (id === 'campaign:intel:continue') { const encounter = campaign.pendingEncounter; if (!encounter) return; if (encounter.unopposed) { encounter.stage.owner = 'enemy'; if (encounter.stage.id === START_STAGE) { defeatCampaign('진류가 함락되어 원정에 패배했습니다.'); return; } campaign.notice = `${encounter.stage.name}이 무방비로 함락되었습니다.`; finishMovementStep(); return; } encounter.intelSeen = true; campaign.notice = `${encounter.stage.name} 방어에 나설 군단을 선택하세요.`; saveCampaign(); return; }
  if (id === 'campaign:movement:close') { const encounter = movementEncounter(campaign.movement[campaign.movementPage]); if (state !== 'map') return; if (encounter && encounter.capture) { encounter.stage.owner = 'player'; const prize = captureReward(encounter.stage); campaign.notice = `${encounter.stage.name}을 무혈 점령했습니다.${prize ? ' 점령 보상: ' + prize + '.' : ''}`; finishMovementStep(); return; } if (encounter) { campaign.pendingEncounter = encounter; campaign.responsePage = 0; campaign.notice = encounter.invasion ? `${encounter.stage.name} 침공군 정보를 확인하세요.` : `${encounter.stage.name}에서 공격할 군단을 선택하세요.`; saveCampaign(); return; } finishMovementStep(); return; }
  if (id === 'campaign:response:prev' || id === 'campaign:response:next') { const pages = Math.ceil(campaign.pendingEncounter.responders.length / 8), d = id.endsWith('next') ? 1 : -1; campaign.responsePage = Math.max(0, Math.min(pages - 1, campaign.responsePage + d)); return; }
  if (id === 'campaign:response:abandon') { const encounter = campaign.pendingEncounter; if (encounter.invasion) { encounter.stage.owner = 'enemy'; if (encounter.stage.id === START_STAGE) { defeatCampaign('진류 방어를 포기하여 원정에 패배했습니다.'); return; } campaign.notice = `${encounter.stage.name} 방어를 포기했다.`; } else { const mover = roster[encounter.moverIndex]; if (mover) mover.at = encounter.from; campaign.notice = `${encounter.stage.name} 공격을 포기하고 철수했다.`; } finishMovementStep(); return; }
  if (/^campaign:response:\d+$/.test(id)) {
    const encounter = campaign.pendingEncounter, index = +id.slice(18), corps = roster[index]; if (!encounter || !encounter.responders.includes(index) || !corps) return;
    const from = encounter.invasion || index !== encounter.moverIndex ? corps.at : encounter.from; corps.at = encounter.stage.id; campaign.corps = index; campaign.at = encounter.stage.id; campaign.from = from; campaign.destination = corps.target; campaign.invasion = encounter.invasion; campaign.responsePage = 0; campaign.notice = `${corpsName(corps)}이 ${encounter.stage.name} ${encounter.invasion ? '요격' : '공격'}에 나선다.`; startBattle(encounter.stage); return;
  }
  if (id === 'campaign:scout' || id === 'campaign:diplomacy') { const tool = id.slice(9); mapTool = mapTool === tool ? null : tool; moveSelectOpen = false; exploreSelectOpen = false; moveMode = 'corps'; campaign.notice = mapTool ? (tool === 'scout' ? '정찰할 적 지역을 선택하세요. (군단이 같은 지역이나 연결 지역에 있어야 함)' : '외교를 시도할 적 지역을 선택하세요. (턴마다 지역당 1회, 성공하면 투항병 합류)') : '선택을 취소했습니다.'; return; }
  if (id === 'campaign:scout:close') { scoutView = null; return; }
  if (id === 'campaign:move') { mapTool = null; moveSelectOpen = true; moveMode = 'corps'; movePage = Math.floor(campaign.corps / 8); campaign.notice = '이동할 군단을 선택하세요.'; return; }
  if (id === 'campaign:move:close') { moveSelectOpen = false; moveMode = 'corps'; return; }
  if (id === 'campaign:move:prev' || id === 'campaign:move:next') { const pages = Math.max(1, Math.ceil(roster.length / 8)), d = id.endsWith('next') ? 1 : -1; movePage = (movePage + d + pages) % pages; return; }
  if (/^campaign:move:\d+$/.test(id)) { const index = +id.slice(14), corps = roster[index]; if (!corps) return; if (!combatReadyCorps(corps)) { campaign.notice = '군단장이 없는 군단은 편성 전까지 이동할 수 없습니다.'; return; } campaign.corps = index; campaign.at = corps.at; campaign.destination = corps.target; moveMode = 'city'; moveSelectOpen = false; campaign.notice = `${corpsName(corps)}이 이동할 지역을 지도에서 선택하세요.`; return; }
  if (id === 'campaign:end') { mapTool = null; moveSelectOpen = false; exploreSelectOpen = false; moveMode = 'corps'; endCampaignTurn(); return; }
  if (id === 'campaign:explore') { moveSelectOpen = false; exploreSelectOpen = true; explorePage = 0; campaign.notice = '탐색할 군단을 선택하세요.'; return; }
  if (id === 'campaign:explore:close') { exploreSelectOpen = false; return; }
  if (id === 'campaign:explore:prev' || id === 'campaign:explore:next') { const available = roster.filter(c => combatReadyCorps(c) && stageById(c.at).owner === 'player'), pages = Math.max(1, Math.ceil(available.length / 8)), d = id.endsWith('next') ? 1 : -1; explorePage = (explorePage + d + pages) % pages; return; }
  if (/^campaign:explore:\d+$/.test(id)) { const index = +id.slice(17); exploreSelectOpen = false; exploreCampaign(index); return; }
  if (id === 'roster:detail') { rosterMode = 'detail'; rosterDetailSlot = roster[rosterSource].units.findIndex(k => k && !Sim.U[k].generic); campaign.notice = '왼쪽 목록에서 상세 정보를 볼 장수를 선택하세요.'; return; }
  if (/^roster:detail:\d+$/.test(id)) { rosterDetailSlot = +id.slice(14); return; }
  if (id === 'roster:equip') { rosterMode = 'equip'; campaign.notice = '◀ ▶ 로 장수의 ITEM 을 바꿉니다.'; return; }
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
  if (id === 'roster:dismiss') {
    if (roster.length <= 1 || roster[rosterSource].units.some(Boolean)) { campaign.notice = '장수를 다른 군단으로 모두 이동한 빈 군단만 해제할 수 있습니다.'; return; }
    const removed = rosterSource; roster.splice(removed, 1); campaign.corps = campaign.corps === removed ? 0 : campaign.corps > removed ? campaign.corps - 1 : campaign.corps; rosterSource = 0; rosterPage = 0; campaign.at = roster[campaign.corps].at; campaign.destination = roster[campaign.corps].target; campaign.notice = '빈 군단을 해산했습니다.'; return;
  }
  if (id.startsWith('roster:target:')) { rosterTarget = +id.slice(14); rosterMode = 'exchange'; rosterPick = null; campaign.notice = '장수를 선택한 뒤 반대쪽 교환 위치를 선택하세요.'; return; }
  if (id === 'roster:new') {
    if (roster.length >= ROSTER_MAX) { campaign.notice = '군단은 최대 100개까지 보유할 수 있습니다.'; return; }
    const newId = Math.max(...roster.map(c => c.id)) + 1; roster.push({ id: newId, name: `신규 군단 ${newId}`, at: roster[campaign.corps].at, target: null, units: Array(18).fill(null), growth: Array(18).fill(null) }); rosterTarget = roster.length - 1; rosterNew = rosterTarget; rosterMode = 'exchange'; rosterPick = null; campaign.notice = '새 군단을 편성 중입니다. 배치 없이 나가면 생성되지 않습니다.'; return;
  }
  if (id === 'roster:page:prev' || id === 'roster:page:next') { const pages = Math.max(1, Math.ceil((roster.length - 1) / 10)), d = id.endsWith('next') ? 1 : -1; rosterPage = (rosterPage + d + pages) % pages; return; }
  if (id.startsWith('roster:unit:')) { const [, , side, slot] = id.split(':'); pickRosterUnit(side, +slot); return; }
  if (id.startsWith('stage:') && mapTool) { useMapTool(stageById(id.slice(6))); return; }
  if (id.startsWith('stage:')) { if (moveMode === 'city') { moveCampaign(id.slice(6)); moveMode = 'corps'; moveSelectOpen = false; } else campaign.notice = '이동 버튼에서 군단을 선택한 뒤 지도에서 지역을 선택하세요.'; return; }
  if (id === 'tut:prev') { tutorialStep = Math.max(0, tutorialStep - 1); return; }
  if (id === 'tut:next') { if (tutorialStep >= 3) finishTutorial(); else tutorialStep++; return; }
  if (id === 'tut:skip') { finishTutorial(); return; }
  if (id.startsWith('order:')) { const [, index, command] = id.split(':'); useCommand(command, S.armies[+index]); return; }
  if (id === 'support:close') { supportOpen = false; return; }
  if (id.startsWith('support:')) { const A = S.armies[+id.slice(8)]; if (!A) return; const groups = S.armies.filter(B => B.team === 'player' && B.support && B.corps === A.corps); let count = 0; for (const B of groups) count += Sim.deployArmy(S, B, B.ctrl, true); if (count) { const corps = roster.find(c => c.id === A.corps); S.events.push({ type: 'notice', team: 'player', text: `아군 ${corps ? corpsName(corps) : A.name}이 참전했습니다.` }); supportOpen = false; } return; }
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
  else if (id === 'm:auto') Sim.setAuto(S, !S.auto); else if (id === 'm:return') finishBattle(); else if (id === 'm:restart') startBattle(campaign.battle); else if (id === 'm:close') menuOpen = false;
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
const hitBtn = (x, y) => [...btns].reverse().find(b => b.r ? Math.hypot(x - b.cx, y - b.cy) <= b.r + 6 : x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
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
  if (state === 'title') { if (mobile) goFullscreen(); if (saveSlotMode) { if (b && b.id.startsWith('save-slot:')) uiClick(b.id); } else if (b && b.id === 'title:new') startNewFromTitle(); else if (b && b.id === 'title:load') saveSlotMode = 'load'; return; }
  if (state === 'map' || state === 'roster') { if (saveSlotMode) { if (b && b.id.startsWith('save-slot:')) uiClick(b.id); return; } const response = campaign.pendingEncounter; if (state !== 'map' || (response ? b && (b.id.startsWith('campaign:response:') || b.id.startsWith('campaign:intel:')) : campaign.movement.length ? b && b.id.startsWith('campaign:movement:') : scoutView ? b && b.id === 'campaign:scout:close' : exploreSelectOpen ? b && b.id.startsWith('campaign:explore:') : !moveSelectOpen || b && b.id.startsWith('campaign:move:'))) { if (b) uiClick(b.id); } return; }
  if (tutorialStep >= 0) { if (b && b.id.startsWith('tut:')) uiClick(b.id); return; }
  if (S.events.length) { S.events.shift(); return; }
  if (S.over) { if (T - overAt > 1) finishBattle(); return; }
  if (paused && !menuOpen) { paused = false; return; }   // 일시정지(앱 전환 등)는 화면을 탭하면 계속
  if (menuOpen) { if (b && /^m:(?!act$|alt$|spell$)/.test(b.id)) uiClick(b.id); return; }
  if (supportOpen) { if (b && b.id.startsWith('support:')) uiClick(b.id); return; }
  if (!b && inMini(p)) { miniPtr = e.pointerId; lookAt(p); return; }   // 미니맵: 누르거나 끌면 그 위치를 잠시 본다
  if (b && b.id.startsWith('order:')) { cancelSelect(); uiClick(b.id); return; }
  if (selectMode && mobile && !b && inStickZone(p.x, p.y)) confirmSelect();   // 모바일: 조이스틱을 잡으면 확정하고 바로 이동
  if (selectMode) {
    if (b && b.id === 'sel:ok') { confirmSelect(); return; }
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
  if (miniPtr === e.pointerId) miniPtr = -1;
  padPtrs.delete(e.pointerId);
  if (stick && stick.id === e.pointerId) { const t = stick; stick = null; if (!cancel && !t.moved && T - t.t0 < 0.4 && state === 'play' && !menuOpen && !S.over && !S.events.length && tutorialStep < 0) tapInfo(t.ox, t.oy); }
  refreshPad();
};
addEventListener('pointerup', e => endPtr(e, false)); addEventListener('pointercancel', e => endPtr(e, true));
addEventListener('keydown', e => {
  if (e.repeat) return;
  if ([' ', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F10'].includes(e.key)) e.preventDefault();
  if (state === 'title') { if (saveSlotMode) { if (e.key === 'Escape') saveSlotMode = null; else if (/^[1-3]$/.test(e.key)) uiClick('save-slot:' + e.key); } else if (e.key === 'Enter' || e.key.toLowerCase() === 'n') startNewFromTitle(); else if (e.key.toLowerCase() === 'l') saveSlotMode = 'load'; return; }
  if (state === 'map') { if (saveSlotMode) { if (e.key === 'Escape') saveSlotMode = null; else if (/^[1-3]$/.test(e.key)) uiClick('save-slot:' + e.key); } else if (e.key === 'Escape') { moveSelectOpen = false; exploreSelectOpen = false; } return; }
  if (state === 'roster') { if (e.code === 'Escape') uiClick('roster:back'); return; }
  if (tutorialStep >= 0) { if (e.key === 'Escape') finishTutorial(); else if (e.key === 'ArrowLeft') tutorialStep = Math.max(0, tutorialStep - 1); else if (['Enter', ' ', 'ArrowRight'].includes(e.key)) tutorialStep >= 3 ? finishTutorial() : tutorialStep++; return; }
  if (S.events.length) { if (['Enter', ' ', 'Escape'].includes(e.key)) S.events.shift(); return; }
  if (S.over) { if (e.key.toLowerCase() === 'r' && T - overAt > 1) finishBattle(); return; }
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
addEventListener('keyup', e => { dirStack = dirStack.filter(c => c !== e.code); keys[e.key] = false; });
addEventListener('blur', () => { keys = {}; dirStack = []; padPtrs.clear(); stick = null; padDir = null; });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play' && !S.over) { paused = true; keys = {}; padPtrs.clear(); stick = null; padDir = null; } });   // 앱 전환·화면 꺼짐 시 자동 일시정지
if (/[?&]m=1\b/.test(location.search) || (window.matchMedia && matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 900)) setMobile(true);

// ---------- 루프 ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now; T += dt;
  if (state === 'play') {
    for (const m of marks) m.t -= dt; marks = marks.filter(m => m.t > 0);
    if (!paused && !menuOpen && !supportOpen && tutorialStep < 0 && !S.over && !selectMode && !S.events.length) {
      const d = padDir || (dirStack.length ? DIRS[dirStack[dirStack.length - 1]] : null), u = ctrlOf();
      let r = dt * (keys.Control ? 3 : SPEEDS[speedIdx]);
      let steps = 0;
      while (r > 0 && steps++ < MAX_SIM_STEPS && !S.over && !S.events.length) { const s = Math.min(r, 1 / 60); if (d && u && alive(u)) Sim.control(S, u, d[0], d[1]); Sim.step(S, s); r -= s; }
    }
    if (S.over && !overAt) { overAt = T; if (S.over === 'win' && campaign.battle) campaign.battle.owner = 'player'; }
    if (!ctrlOf() || !alive(ctrlOf())) { const next = activePlayerArmies().find(A => corpsKey(A) === corpsKey(army())) || activePlayerArmies()[0]; if (next) armyIdx = next.id; }
    snapCam();   // 조작 캐릭터를 전장 표시 영역의 정확한 중앙에 고정
  }
  draw(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

