'use strict';
// 렌더 · 입력 · HUD — 퍼스트퀸4 전투 화면/조작: 군단마다 "조작 캐릭터" 한 명을 방향키(숫자패드)로 직접 움직이고 Space 로 특수기·마법,
// 나머지는 AI + 하단 부대별 군단 명령(돌격·정지·후퇴). ←→ 조작 캐릭터 변경, ↑↓ 군단 변경, Ctrl 가속, 적을 클릭하면 집중 공격.
// 모바일(터치): 같은 조작을 큰 버튼으로 — 왼쪽 이동패드(누르고 있기·멀티터치), 오른쪽 행동/보조/마법 버튼, 상단 두 군단 초상 줄·군단 명령, 왼쪽 중간 미니맵, 왼쪽 아래 시스템.
// 전투 규칙은 sim.js, 도형은 art.js.
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const { TILE, WW, WH, SPELL, SPECIAL, CATEGORY_NAME, FORMATION_NAME, CLS_NAME } = Sim;
const VW = 1280, VH = 720;
let TB_H = 44, LEFT_W = 150, VPW = VW - LEFT_W, FS = 1, mobile = false;   // 레이아웃은 PC/모바일 모드에 따라 바뀐다 (setMobile)
const ORDER_NAME = { idle: '자유', attack: '공격', charge: '돌격', stop: '정지', retreat: '후퇴', flee: '도주' };
const SPEEDS = [1, 2, 3];
// 방향 입력: 숫자패드(NumLock 꺼져 있어도 code 는 Numpad*) + 노트북용 WASD/QEZC
const DIRS = { Numpad7: [-1, -1], Numpad8: [0, -1], Numpad9: [1, -1], Numpad4: [-1, 0], Numpad6: [1, 0], Numpad1: [-1, 1], Numpad2: [0, 1], Numpad3: [1, 1], KeyQ: [-1, -1], KeyW: [0, -1], KeyE: [1, -1], KeyA: [-1, 0], KeyD: [1, 0], KeyZ: [-1, 1], KeyS: [0, 1], KeyC: [1, 1] };
const PAD = [[7, -1, -1, '↖'], [8, 0, -1, '↑'], [9, 1, -1, '↗'], [4, -1, 0, '←'], [5, 0, 0, '행동'], [6, 1, 0, '→'], [1, -1, 1, '↙'], [2, 0, 1, '↓'], [3, 1, 1, '↘']];   // 보조키 윈도우: 숫자패드 배열

let S = null, terrain = null, state = 'title', T = 0, overAt = 0, paused = false, menuOpen = false, supportOpen = false, titleNotice = '';
// 원정 지도는 퍼스트퀸4 방식의 거점 이동용 최소 흐름이다. 전투 규칙·편성은 기존 Sim 전투를 그대로 쓴다.
const STAGES = [
  { id: 'beiping', name: '북평', stage: 1, difficulty: '초급', note: '출발·정비', theme: 'plains', x: 850, y: 92, owner: 'player', links: ['ji'], reinforce: 0, mapSeed: 5 },
  { id: 'ji', name: '계', stage: 2, difficulty: '초급', note: '평야 전초', theme: 'plains', x: 750, y: 150, owner: 'enemy', links: ['beiping', 'tak'], reinforce: 1, mapSeed: 7 },
  { id: 'tak', name: '탁현', stage: 3, difficulty: '초급', note: '강가 넓은 여울', theme: 'riverside', wideRiver: true, x: 625, y: 108, owner: 'enemy', links: ['ji', 'zhongshan'], reinforce: 1, mapSeed: 11 },
  { id: 'zhongshan', name: '중산', stage: 4, difficulty: '중급', note: '평야 교전', theme: 'plains', x: 535, y: 190, owner: 'enemy', links: ['tak', 'changshan'], reinforce: 2, mapSeed: 13 },
  { id: 'changshan', name: '상산', stage: 5, difficulty: '중급', note: '산악 협로', theme: 'mountain', x: 685, y: 270, owner: 'enemy', links: ['zhongshan', 'ye'], reinforce: 2, mapSeed: 17 },
  { id: 'ye', name: '업', stage: 6, difficulty: '중급', note: '넓은 평야', theme: 'plains', x: 555, y: 350, owner: 'enemy', links: ['changshan', 'henei'], reinforce: 3, mapSeed: 19 },
  { id: 'henei', name: '하내', stage: 7, difficulty: '상급', note: '하천 방어선', theme: 'riverside', wideRiver: true, x: 440, y: 425, owner: 'enemy', links: ['ye', 'mengjin'], reinforce: 3, mapSeed: 23 },
  { id: 'mengjin', name: '맹진', stage: 8, difficulty: '상급', note: '황하 도하', theme: 'riverside', wideRiver: true, x: 585, y: 505, owner: 'enemy', links: ['henei', 'hulao'], reinforce: 4, mapSeed: 29 },
  { id: 'hulao', name: '호뢰관', stage: 9, difficulty: '최상', note: '성채 관문', theme: 'fortress', x: 455, y: 585, owner: 'enemy', links: ['mengjin', 'luoyang'], reinforce: 4, mapSeed: 31 },
  { id: 'luoyang', name: '낙양', stage: 10, difficulty: '최상', note: '성채 결전', theme: 'fortress', x: 305, y: 650, owner: 'enemy', links: ['hulao'], reinforce: 5, mapSeed: 37 },
];
const stageById = id => STAGES.find(s => s.id === id);
const BASE_ENEMIES = Sim.ARMIES.filter(a => a.team === 'enemy');
const RESERVE_LEADERS = ['gong', 'yuan', 'cao', 'dong', 'zhanghe', 'xuhuang', 'xuchu', 'sima', 'lijue'];
const THEME_NAME = { plains: '평야', mountain: '산악', riverside: '강가', fortress: '성채' };
const THEME_UNITS = { plains: ['ecav', 'esword', 'earcher'], mountain: ['esword', 'eshield', 'earcher'], riverside: ['earcher', 'esword', 'eshield'], fortress: ['eshield', 'earcher', 'esword'] };
const ROUT_CHANCE = { 초급: 0.9, 중급: 0.75, 상급: 0.55, 최상: 0.35 };
const EARLY_SUPPORT = { changshan: 12, ye: 10, luoyang: 6 };
const tripleEnemyUnits = (units, pool, offset = 0) => units.concat(Array.from({ length: Math.min(Sim.ARMY_MAX, units.length * 3) - units.length }, (_, n) => pool[(offset + n) % pool.length]));
const enemyForces = [];
for (let i = 0; i < BASE_ENEMIES.length; i++) {
  const stage = STAGES[i + 1], army = BASE_ENEMIES[i], pool = THEME_UNITS[stage.theme], add = stage.reinforce, protect = stage.stage >= 7;
  const units = army.units.concat(Array.from({ length: add }, (_, n) => pool[(i + n) % pool.length]));
  enemyForces.push({ id: enemyForces.length, at: stage.id, active: true, army: { ...army, leaderRear: protect, formation: protect ? 'guard' : 'block', units: tripleEnemyUnits(units, pool, i) } });
  const leader = RESERVE_LEADERS[i], size = Math.min(8, 3 + Math.ceil(stage.stage / 2));
  const reserveUnits = [leader, ...Array.from({ length: size - 1 }, (_, n) => pool[(i + n + 1) % pool.length])];
  enemyForces.push({ id: enemyForces.length, at: stage.id, active: true, army: { team: 'enemy', name: `${stage.name} 제2군단`, at: army.at, leader, reserve: true, reserveAt: EARLY_SUPPORT[stage.id] ?? 20, leaderRear: protect, formation: protect ? 'guard' : 'block', units: tripleEnemyUnits(reserveUnits, pool, i + 1), trig: { near: 12, t: 60 } } });
}
const stageEnemyCount = stage => enemyForces.filter(f => f.active && f.at === stage.id).reduce((n, f) => n + f.army.units.length, 0);
const campaign = { at: 'beiping', corps: 0, from: null, battle: null, explore: false, invasion: false, destination: null, movement: [], movementPage: 0, pendingEncounter: null, responsePage: 0, intel: [], turn: 1, notice: '북평에서 낙양 원정을 시작한다.' };
// 원정 지도 편성: 기존 본대·기마대·궁병대는 한 군단의 1·2·3분대다.
const ROSTER_MAX = 100;
const roster = [
  { id: 1, name: '신규 군단 1', at: 'beiping', target: null, units: Sim.ARMIES.filter(a => a.team === 'player').flatMap(a => a.units), growth: Array(18).fill(null) },
  { id: 2, name: '신규 군단 2', at: 'beiping', target: null, units: ['kong', 'diao', 'mage', 'mage', 'sword', 'shield', ...Array(12).fill(null)], growth: Array(18).fill(null) },
];
const SAVE_KEY = 'sgsp-campaign-v1', SAVE_SLOTS = 3, INITIAL_CAMPAIGN = JSON.stringify({ owners: STAGES.map(s => s.owner), enemyForces, roster });
let activeSaveSlot = 1, saveSlotMode = null;
const saveKey = slot => `${SAVE_KEY}-${slot}`;
function resetCampaignData() {
  const data = JSON.parse(INITIAL_CAMPAIGN); STAGES.forEach((s, i) => s.owner = data.owners[i]); enemyForces.splice(0, enemyForces.length, ...data.enemyForces); roster.splice(0, roster.length, ...data.roster);
  Object.assign(campaign, { at: 'beiping', corps: 0, from: null, battle: null, explore: false, invasion: false, destination: null, movement: [], movementPage: 0, pendingEncounter: null, responsePage: 0, intel: [], turn: 1, notice: '북평에서 낙양 원정을 시작한다.' });
}
function saveCampaign(slot = activeSaveSlot) {
  activeSaveSlot = slot;
  try { localStorage.setItem(saveKey(slot), JSON.stringify({ owners: STAGES.map(s => s.owner), enemyForces, roster, campaign: { ...campaign, battle: campaign.battle && campaign.battle.id, pendingEncounter: campaign.pendingEncounter && { ...campaign.pendingEncounter, stage: campaign.pendingEncounter.stage.id } } })); } catch (e) { /* 저장소를 못 쓰면 현재 플레이는 계속한다 */ }
}
function readCampaign(slot = activeSaveSlot) { try { return JSON.parse(localStorage.getItem(saveKey(slot)) || (slot === 1 ? localStorage.getItem(SAVE_KEY) : '') || 'null'); } catch (e) { return null; } }
function hasCampaign(slot = null) { try { return slot ? !!(localStorage.getItem(saveKey(slot)) || slot === 1 && localStorage.getItem(SAVE_KEY)) : Array.from({ length: SAVE_SLOTS }, (_, i) => i + 1).some(hasCampaign); } catch (e) { return false; } }
function restoreCampaign(data) {
  if (!data || !Array.isArray(data.owners) || data.owners.length !== STAGES.length || !Array.isArray(data.enemyForces) || !Array.isArray(data.roster) || !data.roster.length || !data.campaign || data.roster.some(c => !stageById(c.at) || !Array.isArray(c.units)) || data.enemyForces.some(f => !stageById(f.at) || !f.army)) return false;
  const battle = data.campaign.battle && stageById(data.campaign.battle), pendingStage = data.campaign.pendingEncounter && stageById(data.campaign.pendingEncounter.stage); if (data.campaign.battle && !battle || data.campaign.pendingEncounter && !pendingStage) return false;
  STAGES.forEach((s, i) => s.owner = data.owners[i]); enemyForces.splice(0, enemyForces.length, ...data.enemyForces); roster.splice(0, roster.length, ...data.roster);
  Object.assign(campaign, data.campaign); campaign.corps = Math.max(0, Math.min(roster.length - 1, campaign.corps || 0)); campaign.battle = battle; if (campaign.pendingEncounter) campaign.pendingEncounter.stage = pendingStage;
  return true;
}
function defeatCampaign(message) { try { localStorage.removeItem(saveKey(activeSaveSlot)); if (activeSaveSlot === 1) localStorage.removeItem(SAVE_KEY); } catch (e) { /* 무시 */ } S = null; state = 'title'; campaign.battle = null; moveSelectOpen = false; saveSlotMode = null; titleNotice = message; }
let rosterSource = 0, rosterTarget = null, rosterPage = 0, rosterMode = 'select', rosterPick = null, rosterNew = null, moveSelectOpen = false, moveMode = 'corps', movePage = 0;
const namedRosterUnit = key => { const u = Sim.U[key]; return u && !u.generic && !u.name.startsWith('적 '); };
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
    if (corps === active || battle && corps.at !== battle.id && !battle.links.includes(corps.at)) return;
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
  mobile = on; loadZoom(on); TB_H = on ? 0 : 44; LEFT_W = on ? 0 : 150; VPW = VW - LEFT_W; FS = on ? 1.3 : 1; padPtrs.clear(); stick = null; padDir = null; layout(); if (S) snapCam();
}
function startBattle(stage, explore = false) {
  campaign.battle = stage || campaign.battle;
  campaign.explore = explore;
  const armies = stageArmies(campaign.battle).filter(a => !explore || a.team === 'player');
  const emptySlots = roster.reduce((n, c) => n + c.units.filter((x, i) => !x && i > 0).length, 0);
  S = Sim.createBattle((Date.now() % 100000) + 1, { armies, mapSeed: campaign.battle ? campaign.battle.mapSeed : 7, theme: campaign.battle ? campaign.battle.theme : 'plains', wideRiver: !!(campaign.battle && campaign.battle.wideRiver), routChance: campaign.battle ? ROUT_CHANCE[campaign.battle.difficulty] : 0.65, explore, attackingTeam: campaign.invasion ? 'enemy' : 'player', surrenderSlots: emptySlots + (roster.length < ROSTER_MAX ? 17 : 0) }); terrain = buildTerrain(S.map, Sim.MW, Sim.MH, TILE);
  if (campaign.battle) S.events.push({ type: 'notice', team: 'enemy', text: campaign.invasion ? `적 군단이 ${campaign.battle.name}을 침공했습니다!` : `${campaign.battle.stage}지역 ${campaign.battle.name} · ${campaign.battle.difficulty} · ${campaign.battle.note}` + ` · 전투력 아군 ⚔${S.armies.filter(A => A.team === "player" && !A.support).reduce((n, A) => n + Sim.battlePower(A), 0)} / 적 ⚔${S.armies.filter(A => A.team === "enemy").reduce((n, A) => n + Sim.battlePower(A), 0)}` });
  state = 'play'; overAt = 0; paused = false; menuOpen = false; supportOpen = false; selectMode = false; selTarget = null; tutorialStep = tutorialSeen ? -1 : 0; armyIdx = 0; marks = []; speedIdx = 0; dirStack = []; padPtrs.clear(); stick = null; padDir = null;
  layout(); snapCam(); saveCampaign();
}
function startCampaign() {
  state = 'map'; S = null; campaign.battle = null; moveSelectOpen = false; moveMode = 'corps'; campaign.notice = '이동 버튼에서 군단과 이동할 도시를 선택하세요.';
}
function startNewGame() { resetCampaignData(); titleNotice = ''; startCampaign(); saveCampaign(); }
function loadGame(slot = activeSaveSlot) {
  const data = readCampaign(slot); if (!restoreCampaign(data)) { if (state === 'title') titleNotice = `${slot}번 슬롯에 불러올 데이터가 없습니다.`; else campaign.notice = `${slot}번 슬롯에 불러올 데이터가 없습니다.`; return false; }
  activeSaveSlot = slot;
  const battle = campaign.battle, explore = campaign.explore, notice = campaign.notice; titleNotice = '';
  if (battle) startBattle(battle, explore); else { startCampaign(); campaign.notice = notice || `${campaign.turn}턴 원정을 불러왔습니다.`; }
  return true;
}
// 전투력: 장수·병사 능력치를 환산해(Sim.unitPower) 군단별로 합산한다.
const corpsPow = corps => Sim.corpsPower(corps.units, 'player', corps.growth);
const forcePow = force => Sim.corpsPower(force.army.units, 'enemy');
const enemyPowerAt = stage => enemyForces.filter(f => f.active && f.at === stage.id).reduce((n, f) => n + forcePow(f), 0);
// 어떤 도시에 개입할 수 있는 아군 군단(같은 도시 또는 연결된 도시)의 전투력 합 — 침공 대응 규칙과 같은 범위
const playerPowerNear = stage => roster.filter(c => c.units.some(Boolean) && (c.at === stage.id || stage.links.includes(c.at))).reduce((n, c) => n + corpsPow(c), 0);
const AI_ATTACK_RATIO = 1.2;   // 침공: 집결한 적 전투력이 상대 대응 전투력의 1.2배 이상일 때만
const AI_DEFEND_RATIO = 0.8;   // 방어: 아군이 닿을 수 있는 위협 전투력이 자기 도시 전투력의 0.8배 이상이면 자리를 지킨다
// 적 군단 한 부대의 행동 결정: 진군(advance) 또는 대기(hold). 판단 근거를 함께 돌려준다.
function enemyDecision(force) {
  const here = stageById(force.at), path = route(force.at, 'beiping'), next = path.length > 1 ? stageById(path[1]) : null;
  const own = enemyPowerAt(here), threat = playerPowerNear(here), mine = forcePow(force);
  const base = { own, threat, mine, from: here.id, to: next ? next.id : null };
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
    const note = `적 ${force.army.name} ⚔${d.mine} · ${stageById(from).name}${from !== force.at ? ' → ' + stageById(force.at).name + ' · 1턴 이동' : ''} · ${d.mode}(${d.reason})`;
    campaign.intel.push({ text: note, mode: d.mode, force: force.army.name, power: d.mine, from, to: force.at });
    if (from !== force.at) campaign.movement.push({ text: note, name: `적 ${force.army.name}`, commander: Sim.U[force.army.leader] ? Sim.U[force.army.leader].name : force.army.name, from, to: force.at, team: 'enemy' });
  }
  for (const stage of STAGES) {
    if (!enemyForces.some(f => f.active && f.at === stage.id)) continue;
    if (stage.owner !== 'player') continue;
    const responders = roster.map((c, index) => ({ c, index })).filter(({ c }) => c.units.some(Boolean) && (c.at === stage.id || stage.links.includes(c.at))).map(({ index }) => index);
    if (responders.length) return { stage, responders, invasion: true };
    stage.owner = 'enemy'; if (stage.id === 'beiping') { defeatCampaign('북평이 함락되어 원정에 패배했습니다.'); return { defeat: true }; }
  }
  return null;
}
const intelSummary = () => { const n = {}; for (const i of campaign.intel || []) n[i.mode] = (n[i.mode] || 0) + 1; const t = Object.entries(n).map(([k, v]) => `${k} ${v}`).join('·'); return t ? ` 적 동향: ${t}` : ''; };
function continueCampaignTurn() {
  const encounter = campaign.pendingEncounter; campaign.pendingEncounter = null;
  if (!encounter) { campaign.at = roster[campaign.corps].at; campaign.destination = roster[campaign.corps].target; campaign.notice = `${campaign.turn}턴 이동을 완료했다.${intelSummary()}`; saveCampaign(); return; }
  if (encounter.invasion) { campaign.pendingEncounter = encounter; campaign.notice = `${encounter.stage.name} 방어에 나설 군단을 선택하세요.`; saveCampaign(); return; }
  campaign.corps = encounter.index; campaign.at = encounter.stage.id; campaign.from = encounter.from; campaign.destination = roster[encounter.index].target; campaign.invasion = false; campaign.notice = `${encounter.stage.name}에 적이 주둔 중이다. 전투를 시작한다.`; startBattle(encounter.stage);
}
function endCampaignTurn() {
  campaign.turn++; campaign.movement = []; campaign.movementPage = 0; campaign.pendingEncounter = null; let encounter = null;
  roster.forEach((corps, index) => {
    const from = corps.at;
    if (corps.target) { const path = route(corps.at, corps.target); if (path.length < 2) corps.target = null; else { corps.at = path[1]; if (corps.at === corps.target) corps.target = null; } }
    if (from !== corps.at) campaign.movement.push({ text: `${corpsName(corps)} · ${stageById(from).name} → ${stageById(corps.at).name} · 1턴 이동`, name: corpsName(corps), commander: corps.units[0] && Sim.U[corps.units[0]] ? Sim.U[corps.units[0]].name : corpsName(corps), from, to: corps.at, team: 'player' });
    const stage = stageById(corps.at); if (!encounter && stage.owner === 'enemy') encounter = { stage, index, from };
  });
  const invasion = advanceEnemyForces(); if (invasion && invasion.defeat) return; campaign.pendingEncounter = invasion || encounter; saveCampaign();
  if (!campaign.movement.length) continueCampaignTurn();
}
function exploreCampaign() {
  const corps = roster[campaign.corps], stage = stageById(corps.at); if (stage.owner !== 'player') { campaign.notice = '점령한 지역만 탐색할 수 있습니다.'; return; }
  campaign.at = stage.id; campaign.from = null; campaign.notice = `${stage.name}을 탐색한다.`; startBattle(stage, true);
}
function applyBattleResults() {
  if (!S || !campaign.battle) return;
  const growthOf = u => ({ lv: u.lv, xp: u.xp, maxHp: u.maxHp, maxMp: u.maxMp, atk: u.atk, df: u.df, ad: u.ad, md: u.md, aa: u.aa, hr: u.hr, sp: u.sp });
  for (const u of S.units.filter(x => !x.dead && x.originTeam === 'player')) {
    const corps = roster.find(c => c.id === u.army.corps); if (corps && Number.isInteger(u.rosterSlot)) corps.growth[u.rosterSlot] = growthOf(u);
  }
  for (const u of S.units.filter(x => x.dead && x.originTeam === 'player')) {
    const corps = roster.find(c => c.id === u.army.corps); if (!corps || !Number.isInteger(u.rosterSlot)) continue; corps.units[u.rosterSlot] = null; corps.growth[u.rosterSlot] = null;
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
function finishBattle() {
  applyBattleResults(); const active = roster[campaign.corps], lostBeiping = S && S.over !== 'win' && campaign.invasion && campaign.battle && campaign.battle.id === 'beiping';
  const routed = new Set(S ? S.armies.filter(A => A.team === 'enemy' && A.routed).map(A => A.forceId) : []);
  for (const force of enemyForces.filter(f => f.active && routed.has(f.id) && campaign.battle && f.at === campaign.battle.id)) {
    const fallback = route(force.at, 'luoyang'), back = force.prevAt && stageById(force.prevAt) ? force.prevAt : fallback[1]; if (back) force.at = back; else force.active = false; force.prevAt = null;
  }
  if (S && S.over === 'win' && campaign.battle) {
    for (const force of enemyForces.filter(f => f.active && f.at === campaign.battle.id)) { const path = route(force.at, 'luoyang'); if (path.length > 1) force.at = path[1]; else force.active = false; }
    campaign.battle.owner = 'player'; campaign.notice = `${campaign.battle.name}을 점령했다.`;
  }
  else if (campaign.explore) campaign.notice = `${campaign.battle.name} 탐색을 마쳤다.`;
  else { campaign.notice = `${campaign.battle ? campaign.battle.name : '전장'}에서 후퇴했다.`; if (campaign.invasion && campaign.battle) campaign.battle.owner = 'enemy'; if (campaign.from) active.at = campaign.from; }
  if (lostBeiping) { defeatCampaign('북평 방어에 실패하여 원정에 패배했습니다.'); return; }
  campaign.at = active.at; campaign.destination = active.target; campaign.from = null; campaign.battle = null; campaign.explore = false; campaign.invasion = false; S = null; state = 'map'; overAt = 0; menuOpen = false; supportOpen = false; selectMode = false;
  saveCampaign();
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
function camTarget() { const u = ctrlOf(), z = Z(); return u ? [u.x - VPW / z / 2, u.y - vh / z / 2] : [cam.x, cam.y]; }
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
  const swing = u.anim > 0 ? -1.3 + 2.6 * (1 - u.anim / 0.28) : 0.9;
  const k = Math.max(0, Math.min(1, u.hitT / (u.hitDuration || 0.35))), mag = (u.hitMag || 1) * (u.hitState < 0 ? 1.25 : u.hitState > 0 ? 0.55 : 1), ds = Math.cos(u.hitAng) >= 0 ? 1 : -1, ap = u.anim > 0 && u.range === 0 ? Math.sin((1 - u.anim / 0.28) * Math.PI) : 0;   // 상성 우세는 짧은 방어 반응, 불리는 강한 경직
  const tilt = ds * 0.5 * mag * k * Math.cos((1 - k) * 6) + (u.stun > 0 ? Math.sin(T * 8) * 0.16 : 0), sqy = 1 - 0.13 * mag * k - 0.05 * ap, sqx = 1 + 0.09 * mag * k + 0.04 * ap;
  const ox = Math.cos(u.hitAng) * 7 * mag * k + Math.sin(T * 100) * 2.5 * k + Math.cos(u.face) * 7 * ap, oy = Math.sin(u.hitAng) * 5 * mag * k + Math.sin(u.face) * 4 * ap;
  ctx.save(); ctx.translate(x + ox, y + oy); ctx.rotate(tilt); ctx.scale(sqx, sqy); ctx.translate(-x, -y);
  drawBody(ctx, x, y, u.r * 1.15, u.face, styleOf(u), { flash: u.flash > 0, t: T + u.id, moving: u.moving, weaponAng: u.face + swing - ds * 0.9 * mag * k, weaponLen: u.r * (u.isLeader ? 4.4 : 3.4), bob: u.moving ? Math.abs(Math.sin(T * 9 + u.id)) * 1.5 : 0 });
  ctx.restore();
  const top = y - u.r * 4.4 - (u.style === 'lubu' ? 22 : 0) - (styleOf(u).horse ? 10 : 0), w = u.r * 2.4;
  if (ally || u.hp < u.maxHp || u.isLeader) { bar(x - w / 2, top, w, 4, u.hp / u.maxHp, hpCol(u.hp / u.maxHp, ally ? COLORS.ally : COLORS.danger)); if (u.maxMp && ally) bar(x - w / 2, top + 5, w, 2, u.mp / u.maxMp, '#8a6aff'); }
  if (mine || other) { ctx.fillStyle = mine ? COLORS.gold : COLORS.ally; ctx.beginPath(); ctx.moveTo(x - 7, top - 14); ctx.lineTo(x + 7, top - 14); ctx.lineTo(x, top - 4); ctx.closePath(); ctx.fill(); }
  if (u.named || u.isLeader || mine) { const current = u.named ? (ally ? COLORS.goldSel : '#ff9a8a') : ally ? COLORS.silver : '#ffb0a0'; label(u.name, x, top - (mine ? 26 : 12), u.named ? 17 : 16, hpCol(u.hp / u.maxHp, current), 'center'); }   // 이름도 HP 30%·10% 구간을 같이 표시
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
  label('조작: ' + (pArmies().indexOf(army()) + 1) + ' ' + army().name + (u ? ' · ' + u.name : ''), 12, 22, 17, COLORS.gold);
  label('Space 행동 · ← → 장수 · ↑ ↓ 부대', 290, 22, 16, COLORS.silver2);
  button('m:zoom', 540, 4, 114, 36, '거리 ×' + Z(), false);
  button('cmd:auto', 660, 4, 114, 36, S.auto ? '자동 ON' : '자동 OFF', S.auto);
  button('m:speed', 780, 4, 114, 36, '속도 ×' + SPEEDS[speedIdx], false);
  button('cmd:support', 900, 4, 124, 36, `지원 ${supportArmies().length}`, supportOpen);
  button('armyT', 1030, 4, 120, 36, '군단 전환', false);
  button('cmd:menu', 1156, 4, 120, 36, '시스템', false);
}
function drawLeftPanel() {
  panel(0, TB_H, LEFT_W, vh, 'rgba(255,255,255,.2)', 1);
  const u = ctrlOf(); if (!u) return;
  const rows = [['HP', `${Math.ceil(u.hp)}/${u.maxHp}`], ['MP', u.maxMp ? `${Math.floor(u.mp)}/${u.maxMp}` : '—'], ['FT', Math.round(u.ft)], ['XP', `${u.xp}/${u.lv * 60}`], ['AT', u.atk.toFixed(0)], ['DF', u.df], ['AD', u.ad], ['MD', u.md], ['AA', u.aa + '%'], ['HR', u.hr], ['SP', u.sp], ['상태', stText(u)]];
  label(u.name, 10, TB_H + 18, 20, hpCol(u.hp / u.maxHp, COLORS.gold)); label(`${CATEGORY_NAME[u.category]}·${u.subclass} Lv${u.lv}`, 10, TB_H + 42, 16, COLORS.silver);
  bar(8, TB_H + 58, LEFT_W - 16, 5, u.hp / u.maxHp, hpCol(u.hp / u.maxHp));
  rows.forEach((r, i) => { const y = TB_H + 76 + i * 21.5; label(r[0], 10, y, 16, COLORS.silver2); label(String(r[1]), LEFT_W - 8, y, 16, r[0] === 'HP' ? hpCol(u.hp / u.maxHp, COLORS.silver) : r[0] === 'FT' && r[1] > 50 ? '#ffb04d' : COLORS.silver, 'right'); });
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
    const gx = LEFT_W + j * gw, bw = (gw - 144) / 4;
    if (A.empty) { ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.strokeRect(gx, y0 + 2, gw, tblH - 4); label(A.name, gx + 12, y0 + 21, 14, COLORS.silver2); label('비어있음', gx + gw / 2, y0 + (compact ? 30 : 126), 18, COLORS.dim, 'center'); return; }
    button('army' + A.id, gx + 2, y0 + 6, 72, 30, A.name, armyIdx === A.id, 13); label('⚔ 전투력 ' + Sim.battlePower(A), gx + 8, y0 + 46, 13, COLORS.goldSel);
    button('form:' + A.id, gx + 78, y0 + 6, 62, 30, FORMATION_NAME[A.formation], false, 13);
    [['idle', '자유'], ['stop', '정지'], ['charge', '돌격'], ['retreat', '후퇴']].forEach(([id, title], k) => button('order:' + A.id + ':' + id, gx + 144 + k * bw, y0 + 6, bw - 2, 30, title, A.order === id, 14));
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; ctx.strokeRect(gx, y0 + 2, gw, tblH - 4);
    if (compact) return;
    A.units.forEach((u, c) => {
      const x = gx + c * cw, isSel = u === ctrlOf(), gone = u.dead || u.out;
      if (isSel) { ctx.fillStyle = 'rgba(255,211,77,.18)'; ctx.fillRect(x, dataY, cw, tblH - headH); ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 2; ctx.strokeRect(x + 1, dataY + 1, cw - 2, tblH - headH - 3); }
      if (!gone && hpRow >= 0) { ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = hpCol(u.hp / u.maxHp); ctx.fillRect(x + 3, dataY + 2 + hpRow * rh, (cw - 6) * u.hp / u.maxHp, rh - 4); ctx.restore(); }
    const col = u.dead ? COLORS.danger : u.out ? COLORS.dim : isSel ? COLORS.goldSel : COLORS.silver;
      const cells = tblAbility ? [u.name, u.atk.toFixed(0), u.df, u.ad, u.md, u.aa + '%', u.hr, stText(u)] : [u.name, CATEGORY_NAME[u.category], Math.ceil(u.hp), u.maxMp ? Math.floor(u.mp) : '—', u.lv, Math.round(u.ft), u.xp, stText(u)];
      cells.forEach((v, i) => label(String(v), x + cw / 2, dataY + 12 + i * rh, 15, !tblAbility && i === 2 ? hpCol(u.hp / u.maxHp, col) : !tblAbility && i === 5 && u.ft > 50 ? '#ffb04d' : col, 'center'));
      btns.push({ id: 'col' + u.id, x, y: dataY, w: cw, h: tblH - headH });
    });
  });
}

// ---------- HUD (모바일) ----------
function drawToolbarMobile() {   // 오른쪽 한 열에는 부대 버튼만: 1부대 · 2부대 · 3부대 (초상 3열×2줄 + 명령 한 줄). 장수 정보는 이 열 바로 왼쪽에 붙는다
  const ORDERS = [['idle', '자유'], ['stop', '정지'], ['charge', '돌격'], ['retreat', '후퇴']], x0 = VW - 216;
  ctx.fillStyle = 'rgba(8,10,18,.84)'; ctx.fillRect(x0, 0, 216, VH);
  armySlots().forEach((A, j) => {
    const y0 = j * 240, i = A.id;
    if (A.empty) { panel(x0 + 2, y0 + 2, 212, 230, 'rgba(255,255,255,.25)', 1); label(A.name, x0 + 12, y0 + 14, 14, COLORS.silver2); label('비어있음', x0 + 108, y0 + 116, 18, COLORS.dim, 'center'); return; }
    button('army' + i, x0 + 2, y0 + 2, 116, 22, A.name + ' ⚔' + Sim.battlePower(A), armyIdx === i, 13);
    button('form:' + i, x0 + 122, y0 + 2, 92, 22, '진형:' + FORMATION_NAME[A.formation], false, 12);
    drawPortraits(x0 + 2, y0 + 26, 69, 70, 72, A, true, 3);
    ORDERS.forEach(([id, title], k) => button('order:' + i + ':' + id, x0 + 2 + k * 53, y0 + 174, 51, 58, title, A.order === id, 15));
  });
}
function drawMobileSide() {   // 자주 쓰는 전투 설정은 왼쪽 상단에 모은다
  button('cmd:menu', 6, 6, 112, 56, '시스템', false, 18);
  button('cmd:auto', 124, 6, 112, 56, S.auto ? '자동 ON' : '자동 OFF', S.auto, 18);
  button('m:speed', 242, 6, 128, 56, '속도 ×' + SPEEDS[speedIdx], false, 18);
  button('m:zoom', 376, 6, 130, 56, '거리 ×' + Z(), false, 18);
  button('cmd:support', 512, 6, 140, 56, `지원 ${supportArmies().length}`, supportOpen, 18);
  button('armyT', 658, 6, 150, 56, '군단 전환', false, 18);
}
function roundBtn(id, cx, cy, r, title, sub, col, on) {
  ctx.fillStyle = on ? 'rgba(80,60,16,.75)' : 'rgba(10,12,20,.6)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.stroke();
  label(title, cx, cy - (sub ? 12 : 0), r > 60 ? 22 : 17, COLORS.silver, 'center'); if (sub) label(sub, cx, cy + 16, r > 60 ? 22 : 15, col, 'center');
  btns.push({ id, x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, cx, cy, r });
}
function drawActionsMobile() {   // 오른쪽 행동 영역: 행동·보조·마법
  const u = ctrlOf(); if (!u) return;
  const primary = actionInfo(u), alt = actionInfo(u, true), sp = u.spells.length ? SPELL[u.spells[u.spellSel]] : null;
  roundBtn('m:act', 978, 614, 74, primary.name, cooldownText(primary), primary.ready ? COLORS.gold : COLORS.silver2, primary.ready);
  if (u.spells.length ? u.special : u.special && u.range > 0) roundBtn('m:alt', 838, 662, 46, '보조', cooldownText(alt), alt.ready ? COLORS.gold : COLORS.silver2, alt.ready);
  if (u.spells.length > 1) roundBtn('m:spell', 850, 556, 46, S.lock.player > 0 ? '잠금' : sp.name, S.lock.player > 0 ? Math.ceil(S.lock.player) + '초' : sp.mp + 'MP', S.lock.player > 0 ? COLORS.danger : COLORS.silver2, false);
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
  yy += 24; label('FT', x + 10, yy, fs, orange); label(String(Math.round(u.ft)), x + 40, yy, fs, u.ft > 50 ? '#ffb04d' : COLORS.silver); label('XP', x + 110, yy, fs, orange); label(`${u.xp}/${u.lv * 60}`, x + 142, yy, fs, COLORS.silver);
  const c = (w - 20) / 3, cell = (k, v, i, r) => { label(k, x + 10 + i * c, yy + r * rh, fs, orange); label(String(v), x + 10 + i * c + lo, yy + r * rh, fs, COLORS.silver); };
  yy += rh; cell('AT', u.atk.toFixed(0), 0, 0); cell('DF', u.df, 1, 0); cell('AA', u.aa + '%', 2, 0);
  cell('AR', '—', 0, 1); cell('DR', '—', 1, 1); cell('AD', u.ad, 2, 1);
  cell('MD', u.md, 0, 2); cell('HR', u.hr, 1, 2); cell('SP', u.sp, 2, 2);
  yy += 3 * rh; label('ST', x + 10, yy, fs, orange); label(stText(u), x + 42, yy, fs, COLORS.silver); label('지형', x + 130, yy, fs, orange); label(TERRAIN_NAME[S.map[Sim.ti(u.tx, u.ty)]] || '—', x + 172, yy, fs, COLORS.silver);
  yy += rh; label('ITEM', x + 10, yy, fs, orange); label(WEAPON_NAME[(styleOf(u) || {}).weapon] || '—', x + 62, yy, fs, COLORS.silver);
  if (sp.length) { yy += 22; label('마법 · 터치하여 선택', x + 10, yy, fs, orange); sp.forEach((k, i) => { yy += 24; button('spell:' + i, x + 10, yy - 11, w - 20, 22, `${i + 1} ${SPELL[k].name}  ${SPELL[k].mp}MP`, u.spellSel === i, 14); }); }
  yy += 26; label('행동 ' + pr.name, x + 10, yy, 15, COLORS.silver2); label(pr.cd > 0 ? cooldownText(pr) : '가능', x + w - 10, yy, 15, pr.ready ? COLORS.gold : COLORS.silver2, 'right');
}

const TERRAIN_NAME = ['평지', '숲', '바위', '물', '여울'], WEAPON_NAME = { glaive: '청룡언월도', halberd: '방천화극', lance: '창', twin: '쌍철극', sword: '검', spear: '창', bow: '활', fan: '부채' };
function drawStatGrid(u, x, y, w, fs, col = COLORS.gold) {   // 원작 능력치 창과 같은 줄 구성. AR·DR·EL+ 는 이 프로토에 없는 능력치라 빈 값으로 둔다
  const rh = fs + 9, top = rh * 1.5 + 6, c = w / 3, orange = '#ff9a3c', cell = (k, v, i, r, span = 1) => { label(k, x + 8 + i * c, y + top + r * rh, fs, orange); label(String(v), x + 8 + i * c + fs * 2.2, y + top + r * rh, fs, COLORS.silver); };
  label(u.name, x + 8, y + 2 + rh * 0.5, fs + 2, hpCol(u.hp / u.maxHp, col)); label('LV ' + u.lv, x + w - 8, y + 2 + rh * 0.5, fs, orange, 'right');
  const tile = Sim.ti(u.tx, u.ty), terrain = TERRAIN_NAME[S.map[tile]] || '—', wp = WEAPON_NAME[(styleOf(u) || {}).weapon] || '—';
  label('HP', x + 8, y + top, fs, orange); label(Math.ceil(u.hp) + '/' + u.maxHp, x + 8 + fs * 2.2, y + top, fs, hpCol(u.hp / u.maxHp, COLORS.silver)); label('HR', x + 8 + 2 * c, y + top, fs, orange); label(String(u.hr), x + 8 + 2 * c + fs * 2.2, y + top, fs, COLORS.silver);
  cell('AT', u.atk.toFixed(0), 0, 1); cell('DF', u.df, 1, 1); cell('AA', u.aa + '%', 2, 1);
  cell('AR', '—', 0, 2); cell('DR', '—', 1, 2); cell('AD', u.ad, 2, 2);
  cell('MD', u.md, 0, 3); cell('FT', Math.round(u.ft), 1, 3); cell('EL+', '----', 2, 3);
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
function drawMenu() {   // 시스템: 표시 설정·전투 설정
  const items = [['m:pausesel', `선택 시 일시정지 [${SHOW.pauseSel ? 'ON' : 'OFF'}]`, SHOW.pauseSel], ['m:dmg', `피해량 표기 [${SHOW.dmg ? 'ON' : 'OFF'}]`, SHOW.dmg]];
  if (mobile) items.push(['m:status', `장수 정보 [${SHOW.status ? 'ON' : 'OFF'}]`, SHOW.status]);
  else items.push(['m:compact', `장수 정보 축소 [${tblCompact ? 'ON' : 'OFF'}]`, tblCompact], ['m:abil', tblAbility ? '표시 전환: 상태' : '표시 전환: 능력']);
  items.push(['m:tutorial', '튜토리얼 다시 보기'], ['m:mode', mobile ? '화면 모드: 모바일 → PC' : '화면 모드: PC → 모바일']);
  if (campaign.explore) items.push(['m:return', '탐색 종료 · 원정 지도로']); else items.push(['m:restart', '전투 다시 시작']);
  items.push(['m:close', '닫기 (Esc)']);
  const ih = mobile ? 54 : 38, st = mobile ? 62 : 44, w = 480, h = 70 + items.length * st, x = (VW - w) / 2, y = Math.max(6, (VH - h) / 2);
  panel(x, y, w, h, COLORS.gold, 3); label('시스템', x + w / 2, y + 30, 22, COLORS.gold, 'center');
  items.forEach((it, i) => button(it[0], x + 30, y + 56 + i * st, w - 60, ih, it[1], !!it[2], 18));
}
function finishTutorial() {
  tutorialStep = -1; tutorialSeen = true;
  try { localStorage.setItem('sgsp-tutorial', '1'); } catch (e) { /* 무시 */ }
}
function drawTutorial() {
  const pages = mobile ? [
    ['이동과 카메라', '전장 왼쪽을 누른 채 끌면 가상패드가 생기고, 손을 떼면 멈춥니다.', '끌지 않고 짧게 터치만 하면 그 자리의 장수 정보가 나옵니다.'],
    ['공격과 기술', '오른쪽 행동 버튼으로 특수기·마법을 사용합니다.', '버튼 아래 숫자는 다시 사용할 수 있을 때까지 남은 시간입니다.'],
    ['부대 지휘', '오른쪽 끝에 부대들이 있습니다. 초상으로 조작 장수를, 아래 버튼으로 부대 명령을 내립니다.', '오른쪽 진형 버튼으로 기본·횡대·쐐기를 선택합니다.'],
    ['전투 정보', '왼쪽 위 전투 설정 아래에 조작 중인 장수의 능력치가 항상 표시됩니다.', '왼쪽 위에서 자동·속도·거리와 시스템을 조정합니다.']
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
  label('삼국 사우스파크', VW / 2, 150, 100, COLORS.gold, 'center'); label('v0.1.95', 24, 30, 16, COLORS.silver2);
  (mobile ? ['왼쪽 화면을 누르고 끌기(조이스틱): 캐릭터 이동 · 아군을 탭: 조작 장수 변경', '오른쪽 행동 버튼·빈 곳 탭: 특수기·마법 · 적을 탭: 집중 공격', '오른쪽 끝: 부대 버튼 · 왼쪽 위: 시스템·자동·속도·거리·장수 정보'] : ['조작 캐릭터 이동: 숫자패드 (또는 WASD+QEZC, 화면의 보조키) — 적이 있는 칸으로 밀면 공격', 'Space: 특수기·마법 · X: 보조 행동 · 1 2 3: 마법 선택 · ←→ 조작 캐릭터 변경 · ↑↓ 군단 변경', '돌격 F · 정지 V · 후퇴 R · 자유 B · 자동전투 T · 적을 클릭: 집중 공격 · Ctrl: 가속 · Esc: 시스템']).forEach((s, i) => label(s, VW / 2, 295 + i * 34, 20, COLORS.silver, 'center'));
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
function drawArmyFlag(x, y, name, col, highlight = false) {
  const k = highlight ? 1.35 : 1;
  if (highlight) { ctx.strokeStyle = `rgba(255,215,80,${0.55 + 0.35 * Math.sin(T * 8)})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y - 8, 30 + 6 * Math.sin(T * 8), 0, TAU); ctx.stroke(); }
  ctx.strokeStyle = highlight ? '#fff1a6' : '#e8e1c8'; ctx.lineWidth = highlight ? 5 : 3; ctx.beginPath(); ctx.moveTo(x, y + 18 * k); ctx.lineTo(x, y - 24 * k); ctx.stroke(); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - 24 * k); ctx.lineTo(x + 30 * k, y - 15 * k); ctx.lineTo(x, y - 6 * k); ctx.closePath(); ctx.fill(); label(name, x + 15 * k, y - 35 * k, highlight ? 17 : 13, highlight ? '#ffe36a' : col, 'center');
}
function drawStageMap() {
  const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#345d55'); g.addColorStop(0.55, '#66834c'); g.addColorStop(1, '#9a8150'); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = '#1f6677'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(120, 0); ctx.bezierCurveTo(80, 160, 165, 255, 105, 405); ctx.bezierCurveTo(60, 520, 125, 630, 40, VH); ctx.lineTo(0, VH); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(206,231,224,.6)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(250, 30); ctx.bezierCurveTo(330, 180, 270, 330, 430, 475); ctx.bezierCurveTo(570, 590, 750, 470, 990, 680); ctx.stroke();
  ctx.fillStyle = 'rgba(25,55,30,.25)'; for (let x = 170; x < 980; x += 90) for (let y = 75; y < 690; y += 75) { ctx.beginPath(); ctx.arc(x + (y % 35), y, 30, 0, TAU); ctx.fill(); }
  const corps = roster[campaign.corps], here = stageById(corps.at);
  for (const s of STAGES) for (const id of s.links) { const t = stageById(id); if (s.id < t.id) { ctx.strokeStyle = 'rgba(29,25,20,.82)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y); ctx.stroke(); ctx.strokeStyle = '#d9c98a'; ctx.lineWidth = 2; ctx.stroke(); } }
  const targetRows = {}, movingFlags = []; let planIndex = 0;
  for (const c of roster) if (c.target) {
    const path = route(c.at, c.target).map(stageById), goal = path[path.length - 1], row = targetRows[c.target] || 0; targetRows[c.target] = row + 1; if (path.length < 2) continue;
    ctx.save(); ctx.strokeStyle = '#75dcff'; ctx.lineWidth = 4; ctx.setLineDash([10, 7]); ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y); for (const s of path.slice(1)) ctx.lineTo(s.x, s.y); ctx.stroke(); ctx.restore();
    const run = (T * 0.45 + planIndex++ * 0.23) % (path.length - 1), seg = Math.floor(run), p = run - seg, a = path[seg], b = path[seg + 1], commander = c.units[0] && Sim.U[c.units[0]] ? Sim.U[c.units[0]].name : corpsName(c); movingFlags.push({ x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, name: commander, col: '#75dcff' }); label('이동 예정', goal.x, goal.y - 42 - row * 16, 13, '#bcecff', 'center');
  }
  campaign.movement.forEach((m, i) => { const a = stageById(m.from), b = stageById(m.to); if (!a || !b) return; const col = m.team === 'player' ? '#79bfff' : '#ff765f', p = 0.15 + 0.7 * ((T * 0.5 + i * 0.19) % 1), highlight = i === campaign.movementPage && m.team === 'enemy'; ctx.strokeStyle = col; ctx.lineWidth = highlight ? 11 : 7; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); movingFlags.push({ x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, name: m.commander || m.name, col, highlight }); });
  for (const s of STAGES) {
    const on = s === here, friendly = s.owner === 'player', targeted = s.id === (campaign.destination || corps.target); const col = friendly ? COLORS.ally : COLORS.danger;
    ctx.fillStyle = on ? COLORS.gold : col; ctx.beginPath(); ctx.arc(s.x, s.y, on ? 22 : 16, 0, TAU); ctx.fill(); ctx.strokeStyle = on ? '#fff3c0' : '#161722'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = friendly ? '#e9f4ff' : '#ffd8cb'; ctx.beginPath(); ctx.moveTo(s.x + 10, s.y - 26); ctx.lineTo(s.x + 10, s.y - 4); ctx.lineTo(s.x + 36, s.y + 2); ctx.lineTo(s.x + 10, s.y + 8); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#28211a'; ctx.lineWidth = 2; ctx.stroke();
    label(`${s.stage}. ${s.name}`, s.x, s.y + 38, 18, on ? COLORS.goldSel : '#f3eed8', 'center');
    label(`${THEME_NAME[s.theme]} · ${s.difficulty}`, s.x, s.y + 61, 14, s.theme === 'fortress' ? '#ffb06a' : COLORS.silver2, 'center');
    if (targeted) { ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(s.x, s.y, 28, 0, TAU); ctx.stroke(); }
    btns.push({ id: 'stage:' + s.id, x: s.x - 32, y: s.y - 36, w: 72, h: 84 });
  }
  for (const f of movingFlags) drawArmyFlag(f.x, f.y, f.name, f.col, f.highlight);
  panel(1005, 20, 250, 680, COLORS.gold, 3, 'rgba(8,20,25,.88)');
  label('삼국지 원정', 1130, 52, 27, COLORS.gold, 'center');
  label(`${corpsName(corps)} · ${campaign.turn}턴`, 1025, 88, 17, COLORS.silver);
  label(`${here.name} → ${corps.target ? `${stageById(corps.target).name} · ${moveTurns(corps)}턴` : '대기'}`, 1025, 116, 17, COLORS.goldSel);
  label(`점령 ${STAGES.filter(s => s.owner === 'player').length}/${STAGES.length} · ${THEME_NAME[here.theme]}`, 1025, 144, 15, COLORS.silver);
  label(moveMode === 'city' && !moveSelectOpen ? '지도에서 이동할 지역을 선택' : `이동 예정 ${roster.filter(c => c.target).length}개 군단`, 1130, 177, 14, moveMode === 'city' && !moveSelectOpen ? COLORS.gold : COLORS.silver2, 'center');
  label('북평 → 10개 지역 → 낙양', 1025, 218, 16, COLORS.gold);
  STAGES.forEach((s, i) => {
    label(`${s.stage}. ${s.name} · ${THEME_NAME[s.theme]}`, 1025, 244 + i * 21, 13, s === here ? COLORS.goldSel : COLORS.silver);
    label(s.stage === 1 && !stageEnemyCount(s) ? '정비' : `적 ${stageEnemyCount(s)}명 ⚔${enemyPowerAt(s)}`, 1233, 244 + i * 21, 13, s.theme === 'fortress' ? '#ffb06a' : COLORS.silver2, 'right');
  });
  button('campaign:move', 1025, 466, 210, 36, moveMode === 'city' && !moveSelectOpen ? '지역 선택 중' : '이동', moveSelectOpen || moveMode === 'city', 16);
  button('campaign:roster', 1025, 508, 210, 36, '편성 · NEW TEAM · DISMISS', false, 14);
  button('campaign:explore', 1025, 550, 100, 38, '탐색', false, 16); button('campaign:end', 1135, 550, 100, 38, '턴 종료', true, 16);
  button('campaign:save', 1025, 594, 100, 34, '저장', false, 15); button('campaign:load', 1135, 594, 100, 34, '로드', false, 15);
  panel(1025, 636, 210, 54, 'rgba(255,255,255,.35)', 1, 'rgba(0,0,0,.3)');
  label(campaign.notice, 1130, 654, 13, COLORS.silver, 'center');
  label('이동 지정 → 저장 → 턴 종료', 1130, 678, 12, COLORS.goldSel, 'center');
  if (moveSelectOpen) drawMoveSelect();
  if (campaign.movement.length) drawMovementNotice();
  else if (campaign.pendingEncounter && campaign.pendingEncounter.invasion) drawResponseSelect();
  if (saveSlotMode) drawSaveSlots();
}
function drawMovementNotice() {
  const x = 10, y = 10, w = 420, h = 116, pages = campaign.movement.length, move = campaign.movement[campaign.movementPage];
  panel(x, y, w, h, move.team === 'enemy' ? COLORS.danger : COLORS.gold, 3, 'rgba(8,20,25,.96)'); label(`군단 이동 완료 · ${campaign.movementPage + 1}/${pages}`, x + w / 2, y + 28, 21, move.team === 'enemy' ? '#ff9a7d' : COLORS.gold, 'center');
  label(move.text, x + w / 2, y + 60, 14, COLORS.silver, 'center');
  button('campaign:movement:prev', x + 14, y + h - 38, 64, 30, '◀', false, 16);
  button('campaign:movement:close', x + w / 2 - 66, y + h - 38, 132, 30, campaign.movementPage < pages - 1 ? '다음 군단' : campaign.pendingEncounter ? '계속' : '확인', true, 14);
  button('campaign:movement:next', x + w - 78, y + h - 38, 64, 30, '▶', false, 16);
}
function drawResponseSelect() {
  const encounter = campaign.pendingEncounter, pageSize = 8, pages = Math.ceil(encounter.responders.length / pageSize), shown = encounter.responders.slice(campaign.responsePage * pageSize, campaign.responsePage * pageSize + pageSize);
  ctx.fillStyle = 'rgba(10,12,20,.7)'; ctx.fillRect(0, 0, VW, VH);
  const x = 300, y = 110, w = 680, h = 500; panel(x, y, w, h, COLORS.danger, 3, 'rgba(8,20,25,.98)');
  label(`${encounter.stage.name} 침공 · 대응 군단 선택`, x + w / 2, y + 42, 26, '#ffb06a', 'center');
  label(`침공 적 전투력 ⚔${enemyPowerAt(encounter.stage)} · 대응 가능 아군 ⚔${playerPowerNear(encounter.stage)}`, x + w / 2, y + 92, 15, COLORS.goldSel, 'center');
  label('같은 도시 또는 연결된 도시의 군단이 대응할 수 있습니다.', x + w / 2, y + 76, 16, COLORS.silver, 'center');
  shown.forEach((index, row) => { const corps = roster[index]; button(`campaign:response:${index}`, x + 40, y + 102 + row * 42, w - 80, 36, `${corpsName(corps)} · ${stageById(corps.at).name} · ${corps.units.filter(Boolean).length}/18명 · ⚔${corpsPow(corps)}`, false, 16); });
  button('campaign:response:prev', x + 40, y + h - 50, 90, 36, '◀', false, 18);
  button('campaign:response:abandon', x + w / 2 - 90, y + h - 50, 180, 36, '방어 포기', false, 16);
  button('campaign:response:next', x + w - 130, y + h - 50, 90, 36, '▶', false, 18);
  label(`${campaign.responsePage + 1}/${pages}`, x + w - 150, y + 44, 15, COLORS.silver, 'right');
}
function drawMoveSelect() {
  ctx.fillStyle = 'rgba(10,12,20,.62)'; ctx.fillRect(0, 0, VW, VH);
  const x = 300, y = 70, w = 680, h = 580;
  panel(x, y, w, h, COLORS.gold, 3, 'rgba(8,20,25,.97)');
  const page = roster.slice(movePage * 8, movePage * 8 + 8);
  label('1. 이동할 군단 선택', x + w / 2, y + 40, 25, COLORS.gold, 'center');
  label('군단을 선택한 뒤 스테이지 지도에서 목적지를 선택합니다.', x + w / 2, y + 75, 16, COLORS.silver, 'center');
  page.forEach((corps, row) => { const target = corps.target ? `${stageById(corps.target).name}(${moveTurns(corps)}턴)` : '대기'; button(`campaign:move:${movePage * 8 + row}`, x + 40, y + 105 + row * 46, w - 80, 38, `${corpsName(corps)}  ${stageById(corps.at).name} → ${target}  · ${corps.units.filter(Boolean).length}/18명 · ⚔${corpsPow(corps)}`, campaign.corps === movePage * 8 + row, 16); });
  button('campaign:move:prev', x + 40, y + h - 50, 100, 36, '◀', false, 18); button('campaign:move:close', x + w - 140, y + h - 50, 100, 36, '닫기', false, 16); button('campaign:move:next', x + w - 250, y + h - 50, 100, 36, '▶', false, 18);
}
function drawRoster() {
  ctx.fillStyle = '#0b3036'; ctx.fillRect(0, 0, VW, VH);
  panel(18, 16, 1244, 54, COLORS.gold, 3, 'rgba(6,17,23,.9)');
  label(rosterMode === 'select' ? '장수 편성 · 교환 군단 선택' : '장수 편성 · 군단 간 교환', 42, 43, 27, COLORS.gold);
  label(`보유 ${roster.length} / ${ROSTER_MAX}군단 · 군단당 6명×3분대`, 520, 43, 17, COLORS.silver);
  button('roster:back', 1095, 25, 145, 36, rosterMode === 'select' ? '원정 지도로' : '군단 선택', false, 16);
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
    if (roster.length > 1) button('roster:dismiss', 52, 574, 508, 38, 'DISMISS · 군단 해제', false, 15);
    panel(622, 94, 630, 536, COLORS.silver2, 2, 'rgba(8,20,25,.92)');
    label('교환 대상 군단', 646, 126, 20, COLORS.gold);
    const targets = roster.map((c, index) => ({ c, index })).filter(x => x.index !== rosterSource), page = targets.slice(rosterPage * 10, rosterPage * 10 + 10);
    page.forEach(({ c, index }, row) => button(`roster:target:${index}`, 646, 154 + row * 40, 582, 34, `${index + 1}군단  ${corpsName(c)}  ${c.units.filter(Boolean).length}/18 · ⚔${corpsPow(c)}`, false, 15));
    button('roster:new', 646, 564, 280, 42, roster.length < ROSTER_MAX ? 'NEW TEAM · 새 군단' : '군단 보유 한도 100', false, 16);
    button('roster:page:prev', 944, 564, 132, 42, '◀', false, 18); button('roster:page:next', 1096, 564, 132, 42, '▶', false, 18);
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
        label(unit ? (CLS_NAME[unit.cls] || unit.cls) : '', x + 380, ry + 12, 13, COLORS.silver2);
        label(commander ? '군단장' : '', x + 570, ry + 12, 13, COLORS.gold, 'right');
        btns.push({ id: `roster:unit:${side}:${slot}`, x: x + 10, y: ry, w: 580, h: 24 });
      });
    };
    drawCorps(rosterSource, 28, 'left'); drawCorps(rosterTarget, 652, 'right');
  }
  panel(18, 666, 1244, 38, 'rgba(255,255,255,.35)', 1, 'rgba(0,0,0,.35)');
  label(campaign.notice || '분대원을 선택하세요.', VW / 2, 685, 16, COLORS.silver, 'center');
}
function draw() {
  btns = [];
  if (state === 'title') { drawTitle(); return; }
  if (state === 'map') { drawStageMap(); return; }
  if (state === 'roster') { drawRoster(); return; }
  layout(); clampCam();
  ctx.fillStyle = COLORS.ink; ctx.fillRect(0, 0, VW, VH);
  drawWorld();
  if (mobile) {
    drawToolbarMobile(); drawMobileStatus(); drawMobileSide(); drawStick(); drawActionsMobile();
  } else { drawToolbar(); drawLeftPanel(); drawSpellPanel(); drawPad(); drawTable(); }
  if (S.auto) label('자동 전투', VW - 10, TB_H + 18, 18, COLORS.gold, 'right');
  if (S.t < 14 && !S.over) label(mobile ? '왼쪽 화면을 눌러 끌면 이동 · 적에게 부딪치면 공격 · 오른쪽 행동 버튼' : '숫자패드(또는 WASD+QEZC)로 조작 캐릭터 이동 · 적에게 부딪치면 공격 · Space 특수기/마법', LEFT_W + VPW / 2, TB_H + vh - (mobile ? 30 : 16), 16, COLORS.silver2, 'center');
  if (tutorialStep >= 0) { drawTutorial(); return; }
  if (S.events.length) { drawEvent(S.events[0]); return; }
  if (selectMode && !menuOpen && !S.over) drawSelectUI();
  if (menuOpen) drawMenu();
  if (supportOpen) drawSupport();
  if (S.over === 'win') drawOverlay('승 리', [`${campaign.battle ? campaign.battle.name + '을 점령했다!' : '적 군단을 모두 물리쳤다!'}`, `${Math.round(S.t)}초 · 격파 ${S.stats.kills} · 도주 ${S.stats.fled} · 전사 ${S.stats.lost} · 레벨업 ${S.stats.levelups}`, mobile ? '화면을 탭하면 원정 지도로' : '클릭 / R 로 원정 지도'], COLORS.gold);
  else if (S.over === 'lose') drawOverlay('패 배', ['총대장 관우가 쓰러졌다…', `${Math.round(S.t)}초 · 격파 ${S.stats.kills} · 전사 ${S.stats.lost}`, mobile ? '화면을 탭하면 원정 지도로' : '클릭 / R 로 원정 지도'], COLORS.danger);
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
function pick(u) { if (!u || !alive(u) || u.team !== 'player') return; armyIdx = u.army.id; Sim.setCtrl(S, u.army, u); selTarget = null; beginSelect(); }
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
  if (id === 'campaign:movement:prev' || id === 'campaign:movement:next') { const pages = campaign.movement.length, d = id.endsWith('next') ? 1 : -1; campaign.movementPage = Math.max(0, Math.min(pages - 1, campaign.movementPage + d)); return; }
  if (id === 'campaign:movement:close') { const pages = campaign.movement.length; if (campaign.movementPage < pages - 1) { campaign.movementPage++; return; } campaign.movement = []; campaign.movementPage = 0; continueCampaignTurn(); return; }
  if (id === 'campaign:response:prev' || id === 'campaign:response:next') { const pages = Math.ceil(campaign.pendingEncounter.responders.length / 8), d = id.endsWith('next') ? 1 : -1; campaign.responsePage = Math.max(0, Math.min(pages - 1, campaign.responsePage + d)); return; }
  if (id === 'campaign:response:abandon') { const encounter = campaign.pendingEncounter; encounter.stage.owner = 'enemy'; campaign.pendingEncounter = null; campaign.responsePage = 0; if (encounter.stage.id === 'beiping') { defeatCampaign('북평 방어를 포기하여 원정에 패배했습니다.'); return; } campaign.notice = `${encounter.stage.name} 방어를 포기했다.`; saveCampaign(); return; }
  if (/^campaign:response:\d+$/.test(id)) {
    const encounter = campaign.pendingEncounter, index = +id.slice(18), corps = roster[index]; if (!encounter || !encounter.responders.includes(index) || !corps) return;
    const from = corps.at; corps.at = encounter.stage.id; corps.target = null; campaign.corps = index; campaign.at = encounter.stage.id; campaign.from = from; campaign.destination = null; campaign.invasion = true; campaign.pendingEncounter = null; campaign.responsePage = 0; campaign.notice = `${corpsName(corps)}이 ${encounter.stage.name} 방어에 나선다.`; startBattle(encounter.stage); return;
  }
  if (id === 'campaign:move') { moveSelectOpen = true; moveMode = 'corps'; movePage = Math.floor(campaign.corps / 8); campaign.notice = '이동할 군단을 선택하세요.'; return; }
  if (id === 'campaign:move:close') { moveSelectOpen = false; moveMode = 'corps'; return; }
  if (id === 'campaign:move:prev' || id === 'campaign:move:next') { const pages = Math.max(1, Math.ceil(roster.length / 8)), d = id.endsWith('next') ? 1 : -1; movePage = (movePage + d + pages) % pages; return; }
  if (/^campaign:move:\d+$/.test(id)) { const index = +id.slice(14), corps = roster[index]; if (!corps) return; campaign.corps = index; campaign.at = corps.at; campaign.destination = corps.target; moveMode = 'city'; moveSelectOpen = false; campaign.notice = `${corpsName(corps)}이 이동할 지역을 지도에서 선택하세요.`; return; }
  if (id === 'campaign:end') { moveSelectOpen = false; moveMode = 'corps'; endCampaignTurn(); return; }
  if (id === 'campaign:explore') { exploreCampaign(); return; }
  if (id === 'roster:back') {
    if (rosterMode === 'exchange') {
      if (rosterNew !== null && roster[rosterNew] && !roster[rosterNew].units.some(Boolean)) { roster.splice(rosterNew, 1); campaign.notice = '배치가 없어 NEW TEAM 생성을 취소했습니다.'; }
      else campaign.notice = '교환할 군단을 선택하세요.';
      rosterNew = null; rosterTarget = null; rosterMode = 'select'; rosterPick = null; return;
    }
    const error = rosterError(); if (error) { campaign.notice = error; return; }
    state = 'map'; rosterPick = null; campaign.notice = '편성이 저장되었습니다.'; saveCampaign(); return;
  }
  if (id === 'roster:source:prev' || id === 'roster:source:next') { const d = id.endsWith('next') ? 1 : -1; rosterSource = (rosterSource + d + roster.length) % roster.length; rosterPage = 0; return; }
  if (id === 'roster:dismiss') {
    if (roster.length <= 1 || roster[rosterSource].units.some(Boolean)) { campaign.notice = '장수를 다른 군단으로 모두 이동한 빈 군단만 DISMISS 할 수 있습니다.'; return; }
    const removed = rosterSource; roster.splice(removed, 1); campaign.corps = campaign.corps === removed ? 0 : campaign.corps > removed ? campaign.corps - 1 : campaign.corps; rosterSource = 0; rosterPage = 0; campaign.at = roster[campaign.corps].at; campaign.destination = roster[campaign.corps].target; campaign.notice = '빈 군단을 해산했습니다.'; return;
  }
  if (id.startsWith('roster:target:')) { rosterTarget = +id.slice(14); rosterMode = 'exchange'; rosterPick = null; campaign.notice = '장수를 선택한 뒤 반대쪽 교환 위치를 선택하세요.'; return; }
  if (id === 'roster:new') {
    if (roster.length >= ROSTER_MAX) { campaign.notice = '군단은 최대 100개까지 보유할 수 있습니다.'; return; }
    const newId = Math.max(...roster.map(c => c.id)) + 1; roster.push({ id: newId, name: `신규 군단 ${newId}`, at: roster[campaign.corps].at, target: null, units: Array(18).fill(null), growth: Array(18).fill(null) }); rosterTarget = roster.length - 1; rosterNew = rosterTarget; rosterMode = 'exchange'; rosterPick = null; campaign.notice = '새 군단을 편성 중입니다. 배치 없이 나가면 생성되지 않습니다.'; return;
  }
  if (id === 'roster:page:prev' || id === 'roster:page:next') { const pages = Math.max(1, Math.ceil((roster.length - 1) / 10)), d = id.endsWith('next') ? 1 : -1; rosterPage = (rosterPage + d + pages) % pages; return; }
  if (id.startsWith('roster:unit:')) { const [, , side, slot] = id.split(':'); pickRosterUnit(side, +slot); return; }
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
  if (state === 'title') { if (mobile) goFullscreen(); if (saveSlotMode) { if (b && b.id.startsWith('save-slot:')) uiClick(b.id); } else if (b && b.id === 'title:new') saveSlotMode = 'new'; else if (b && b.id === 'title:load') saveSlotMode = 'load'; return; }
  if (state === 'map' || state === 'roster') { if (saveSlotMode) { if (b && b.id.startsWith('save-slot:')) uiClick(b.id); return; } const response = campaign.pendingEncounter && campaign.pendingEncounter.invasion; if (state !== 'map' || (campaign.movement.length ? b && b.id.startsWith('campaign:movement:') : response ? b && b.id.startsWith('campaign:response:') : !moveSelectOpen || b && b.id.startsWith('campaign:move:'))) { if (b) uiClick(b.id); } return; }
  if (tutorialStep >= 0) { if (b && b.id.startsWith('tut:')) uiClick(b.id); return; }
  if (S.events.length) { S.events.shift(); return; }
  if (S.over) { if (T - overAt > 1) finishBattle(); return; }
  if (paused && !menuOpen) { paused = false; return; }   // 일시정지(앱 전환 등)는 화면을 탭하면 계속
  if (menuOpen) { if (b && /^m:(?!act$|alt$|spell$)/.test(b.id)) uiClick(b.id); return; }
  if (supportOpen) { if (b && b.id.startsWith('support:')) uiClick(b.id); return; }
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
  if (stick && stick.id === e.pointerId) { stickMove(p.x, p.y); refreshPad(); return; }
  if (padPtrs.has(e.pointerId)) { const b = hitBtn(p.x, p.y); if (b && b.id.startsWith('pad:')) { const [dx, dy] = padOf(b.id); if (dx || dy) padPtrs.set(e.pointerId, [dx, dy]); else padPtrs.delete(e.pointerId); } else padPtrs.delete(e.pointerId); refreshPad(); }   // 패드 위에서 손가락을 미끄러뜨리면 방향 전환
});
function tapInfo(x, y) {   // 가상패드 영역을 끌지 않고 짧게 터치만 하면 그 자리의 정보를 보여준다 (아군=조작 전환, 적=적 정보, 빈 곳=조작 장수 정보)
  const hit = inView(x, y) ? Sim.unitAt(S, ...toWorld(x, y)) : null;
  if (hit && hit.team === 'player') pick(hit); else selTarget = hit && hit.team === 'enemy' ? hit : null;
  selectMode = true;
}
const endPtr = (e, cancel) => {
  padPtrs.delete(e.pointerId);
  if (stick && stick.id === e.pointerId) { const t = stick; stick = null; if (!cancel && !t.moved && T - t.t0 < 0.4 && state === 'play' && !menuOpen && !S.over && !S.events.length && tutorialStep < 0) tapInfo(t.ox, t.oy); }
  refreshPad();
};
addEventListener('pointerup', e => endPtr(e, false)); addEventListener('pointercancel', e => endPtr(e, true));
addEventListener('keydown', e => {
  if (e.repeat) return;
  if ([' ', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F10'].includes(e.key)) e.preventDefault();
  if (state === 'title') { if (saveSlotMode) { if (e.key === 'Escape') saveSlotMode = null; else if (/^[1-3]$/.test(e.key)) uiClick('save-slot:' + e.key); } else if (e.key === 'Enter' || e.key.toLowerCase() === 'n') saveSlotMode = 'new'; else if (e.key.toLowerCase() === 'l') saveSlotMode = 'load'; return; }
  if (state === 'map') { if (saveSlotMode) { if (e.key === 'Escape') saveSlotMode = null; else if (/^[1-3]$/.test(e.key)) uiClick('save-slot:' + e.key); } else if (moveSelectOpen && e.key === 'Escape') moveSelectOpen = false; return; }
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
addEventListener('blur', () => { dirStack = []; padPtrs.clear(); stick = null; padDir = null; });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play' && !S.over) { paused = true; padPtrs.clear(); stick = null; padDir = null; } });   // 앱 전환·화면 꺼짐 시 자동 일시정지
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
      while (r > 0) { const s = Math.min(r, 1 / 60); if (d && u && alive(u)) Sim.control(S, u, d[0], d[1]); Sim.step(S, s); r -= s; }
    }
    if (S.over && !overAt) { overAt = T; if (S.over === 'win' && campaign.battle) campaign.battle.owner = 'player'; }
    if (!ctrlOf() || !alive(ctrlOf())) { const next = activePlayerArmies().find(A => corpsKey(A) === corpsKey(army())) || activePlayerArmies()[0]; if (next) armyIdx = next.id; }
    snapCam();   // 조작 캐릭터를 전장 표시 영역의 정확한 중앙에 고정
  }
  draw(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

