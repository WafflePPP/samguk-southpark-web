'use strict';
// 렌더 · 입력 · HUD — 퍼스트퀸4 전투 화면/조작: 군단마다 "조작 캐릭터" 한 명을 방향키(숫자패드)로 직접 움직이고 Space 로 특수기·마법,
// 나머지는 AI + 상단 아이콘의 군단 명령(돌격·정지·후퇴). ←→ 조작 캐릭터 변경, ↑↓ 군단 변경, Ctrl 가속, 적을 클릭하면 집중 공격.
// 모바일(터치): 같은 조작을 큰 버튼으로 — 왼쪽 이동패드(누르고 있기·멀티터치), 오른쪽 행동/보조/마법 버튼, 상단 ◀▶ 캐릭터·군단 명령.
// 전투 규칙은 sim.js, 도형은 art.js.
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const { TILE, WW, WH, SPELL, SPECIAL, CLS_NAME } = Sim;
const VW = 1280, VH = 720;
let TB_H = 44, LEFT_W = 150, VPW = VW - LEFT_W, FS = 1, mobile = false;   // 레이아웃은 PC/모바일 모드에 따라 바뀐다 (setMobile)
const ORDER_NAME = { idle: '자유', attack: '공격', charge: '돌격', stop: '정지', retreat: '후퇴', flee: '도주' };
const SPEEDS = [1, 2, 3];
// 방향 입력: 숫자패드(NumLock 꺼져 있어도 code 는 Numpad*) + 노트북용 WASD/QEZC
const DIRS = { Numpad7: [-1, -1], Numpad8: [0, -1], Numpad9: [1, -1], Numpad4: [-1, 0], Numpad6: [1, 0], Numpad1: [-1, 1], Numpad2: [0, 1], Numpad3: [1, 1], KeyQ: [-1, -1], KeyW: [0, -1], KeyE: [1, -1], KeyA: [-1, 0], KeyD: [1, 0], KeyZ: [-1, 1], KeyS: [0, 1], KeyC: [1, 1] };
const PAD = [[7, -1, -1, '↖'], [8, 0, -1, '↑'], [9, 1, -1, '↗'], [4, -1, 0, '←'], [5, 0, 0, '행동'], [6, 1, 0, '→'], [1, -1, 1, '↙'], [2, 0, 1, '↓'], [3, 1, 1, '↘']];   // 보조키 윈도우: 숫자패드 배열

let S = null, terrain = null, state = 'title', T = 0, overAt = 0, paused = false, menuOpen = false;
let armyIdx = 0, tblOpen = true, tblAbility = false, speedIdx = 0, padLarge = true;
let cam = { x: 0, y: 0 }, mouse = { x: 0, y: 0, in: false }, btns = [], marks = [], lastPortrait = { id: 0, t: 0 }, keys = {}, dirStack = [], padPtrs = new Map(), padDir = null, stick = null;   // stick: 모바일 가상 조이스틱 {id, ox, oy, kx, ky}
let vh = 0, tblH = 0;   // 레이아웃: 맵 높이 / 하단 표 높이

function layout() { tblH = mobile ? 0 : (tblOpen ? 236 : 64); vh = VH - TB_H - tblH; }
function setMobile(on) {   // 모바일: 상단 큰 버튼 줄, 좌측 패널·하단 표 없음(맵 전체), 글자 확대
  mobile = on; TB_H = on ? 64 : 44; LEFT_W = on ? 0 : 150; VPW = VW - LEFT_W; FS = on ? 1.3 : 1; padPtrs.clear(); stick = null; padDir = null; layout(); if (S) snapCam();
}
function startBattle() {
  S = Sim.createBattle((Date.now() % 100000) + 1); terrain = terrain || buildTerrain(S.map, Sim.MW, Sim.MH, TILE);
  state = 'play'; overAt = 0; paused = false; menuOpen = false; armyIdx = 0; marks = []; speedIdx = 0; dirStack = []; padPtrs.clear(); stick = null; padDir = null;
  layout(); snapCam();
}
const army = () => S.armies[armyIdx];
const ctrlOf = () => army().ctrl;
const alive = u => Sim.live(u);
function camTarget() { const u = ctrlOf(); return u ? [u.x - VPW / 2, u.y - vh / 2 - 20] : [cam.x, cam.y]; }
function clampCam() { cam.x = Math.max(0, Math.min(WW - VPW, cam.x)); cam.y = Math.max(0, Math.min(WH - vh, cam.y)); }
function snapCam() { const [x, y] = camTarget(); cam.x = x; cam.y = y; clampCam(); }
const toWorld = (sx, sy) => [sx - LEFT_W + cam.x, sy - TB_H + cam.y];
const inView = (x, y) => x >= LEFT_W && x < VW && y >= TB_H && y < TB_H + vh;
const tcx = t => (t + 0.5) * TILE, tcy = t => (t + 0.5) * TILE + 8;

// ---------- 그리기 도구 ----------
function label(s, x, y, size, col, align = 'left') {
  size = Math.round(size * FS);
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
const styleOf = u => STYLES[u.style];
const stText = u => u.dead ? '전사' : u.fled ? '도주' : u.out ? '철수' : u === u.army.ctrl && u.team === 'player' && !S.auto ? '조작' : (ORDER_NAME[u.order.type] || '자유');
const hpCol = p => p > 0.5 ? COLORS.ally : p > 0.25 ? '#ffb04d' : COLORS.danger;

// ---------- 월드 그리기 ----------
function drawUnit(u) {
  const x = u.x, y = u.y, ally = u.team === 'player', mine = u === ctrlOf(), other = ally && u === S.armies[1 - armyIdx].ctrl;
  ctx.save(); ctx.lineWidth = mine ? 4 : 3; ctx.strokeStyle = mine ? COLORS.gold : ally ? COLORS.ally : COLORS.danger;   // 팀 표시(아트방향 5-5): 아군 청 실선 / 적 주홍 점선 / 조작 중 금
  ctx.setLineDash(ally || mine ? [] : [6, 5]); ctx.beginPath(); ctx.ellipse(x, y + u.r * 0.35, u.r * 1.3, u.r * 0.7, 0, 0, TAU); ctx.stroke(); ctx.restore();
  const swing = u.anim > 0 ? -1.3 + 2.6 * (1 - u.anim / 0.28) : 0.9;
  const k = Math.max(0, u.hitT / 0.35), mag = u.hitMag || 1, ds = Math.cos(u.hitAng) >= 0 ? 1 : -1, ap = u.anim > 0 && u.range === 0 ? Math.sin((1 - u.anim / 0.28) * Math.PI) : 0;   // k: 피격 진행(1→0), ap: 근접 공격 찌르기(0→1→0)
  const tilt = ds * 0.5 * mag * k * Math.cos((1 - k) * 6) + (u.stun > 0 ? Math.sin(T * 8) * 0.16 : 0), sqy = 1 - 0.13 * mag * k - 0.05 * ap, sqx = 1 + 0.09 * mag * k + 0.04 * ap;
  const ox = Math.cos(u.hitAng) * 7 * mag * k + Math.sin(T * 100) * 2.5 * k + Math.cos(u.face) * 7 * ap, oy = Math.sin(u.hitAng) * 5 * mag * k + Math.sin(u.face) * 4 * ap;
  ctx.save(); ctx.translate(x + ox, y + oy); ctx.rotate(tilt); ctx.scale(sqx, sqy); ctx.translate(-x, -y);
  drawBody(ctx, x, y, u.r * 1.15, u.face, styleOf(u), { flash: u.flash > 0, t: T + u.id, moving: u.moving, weaponAng: u.face + swing - ds * 0.9 * mag * k, weaponLen: u.r * (u.isLeader ? 4.4 : 3.4), bob: u.moving ? Math.abs(Math.sin(T * 9 + u.id)) * 1.5 : 0 });
  ctx.restore();
  const top = y - u.r * 4.4 - (u.style === 'lubu' ? 22 : 0) - (styleOf(u).horse ? 10 : 0), w = u.r * 2.4;
  if (ally || u.hp < u.maxHp || u.isLeader) { bar(x - w / 2, top, w, 4, u.hp / u.maxHp, ally ? hpCol(u.hp / u.maxHp) : COLORS.danger); if (u.maxMp && ally) bar(x - w / 2, top + 5, w, 2, u.mp / u.maxMp, '#8a6aff'); }
  if (mine || other) { ctx.fillStyle = mine ? COLORS.gold : COLORS.ally; ctx.beginPath(); ctx.moveTo(x - 7, top - 14); ctx.lineTo(x + 7, top - 14); ctx.lineTo(x, top - 4); ctx.closePath(); ctx.fill(); }
  if (u.isLeader || mine) label(u.name, x, top - (mine ? 26 : 12), 16, ally ? COLORS.silver : '#ffb0a0', 'center');
}
function drawWorld() {
  ctx.save(); ctx.beginPath(); ctx.rect(LEFT_W, TB_H, VPW, vh); ctx.clip();
  ctx.drawImage(terrain, cam.x, cam.y, VPW, vh, LEFT_W, TB_H, VPW, vh);
  ctx.translate(LEFT_W - cam.x, TB_H - cam.y);
  const tileBox = (tx, ty, col, fill) => { if (fill) { ctx.fillStyle = fill; ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE); } ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(tx * TILE + 1, ty * TILE + 1, TILE - 2, TILE - 2); };
  const c = ctrlOf();
  if (c && alive(c)) { tileBox(c.tx, c.ty, COLORS.gold, 'rgba(255,211,77,.16)'); if (c.mv) tileBox(c.mv.nx, c.mv.ny, 'rgba(255,211,77,.5)'); }   // 조작 캐릭터가 서 있는 칸
  for (const t of new Set(army().units.filter(u => alive(u) && u.order.type === 'attack' && u.order.target && alive(u.order.target)).map(u => u.order.target))) tileBox(t.tx, t.ty, COLORS.danger, 'rgba(255,90,74,.18)');   // 집중 공격 표적
  for (const m of marks) { const tx = Math.floor(m.x / TILE), ty = Math.floor(m.y / TILE), g = 1.4 - m.t; ctx.strokeStyle = m.col; ctx.globalAlpha = m.t / 0.7; ctx.lineWidth = 3; ctx.strokeRect(tx * TILE - g * 6, ty * TILE - g * 6, TILE + g * 12, TILE + g * 12); ctx.globalAlpha = 1; }
  for (const f of S.fx) {
    const p = 1 - f.t / f.max; ctx.globalAlpha = 1 - p;
    if (f.kind === 'spark') { ctx.strokeStyle = '#fff3c0'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = f.ang + (i - 2.5) * 0.55, r0 = 6 + p * 8, r1 = 12 + p * 22; ctx.moveTo(f.x + Math.cos(a) * r0, f.y + Math.sin(a) * r0 * 0.8); ctx.lineTo(f.x + Math.cos(a) * r1, f.y + Math.sin(a) * r1 * 0.8); } ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(f.x, f.y, 8 * (1 - p), 0, TAU); ctx.fill(); }
    else if (f.kind === 'fall') { const e = 1 - (1 - p) * (1 - p), sd = Math.cos(f.ang) >= 0 ? 1 : -1; ctx.save(); ctx.globalAlpha = Math.max(0, 1 - p * p); ctx.translate(f.x + Math.cos(f.ang) * 14 * e, f.y + Math.sin(f.ang) * 8 * e); ctx.rotate(sd * 1.45 * e); ctx.translate(-f.x, -f.y); drawBody(ctx, f.x, f.y, f.r * 1.15, f.face, { ...STYLES[f.style], weapon: null }, { flash: p < 0.15, t: T }); ctx.restore(); }
    else if (f.kind === 'ring') { ctx.strokeStyle = f.col; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (0.4 + 0.6 * p), f.r * (0.4 + 0.6 * p) * 0.6, 0, 0, TAU); ctx.stroke(); }
    else { ctx.fillStyle = 'rgba(30,25,20,.5)'; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (1 + p), f.r * (1 + p) * 0.5, 0, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  for (const u of S.units.filter(alive).sort((a, b) => a.y - b.y)) { if (u.x < cam.x - 60 || u.x > cam.x + VPW + 60 || u.y < cam.y - 90 || u.y > cam.y + vh + 60) continue; drawUnit(u); }
  for (const p of S.proj) {
    if (p.kind === 'arrow') { ctx.strokeStyle = p.team === 'player' ? '#e8f4ff' : '#ffc9b8'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.cos(p.a) * 14, p.y - Math.sin(p.a) * 14); ctx.stroke(); }
    else if (p.kind === 'bolt') { ctx.fillStyle = '#9fe8ff'; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(159,232,255,.5)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.cos(p.a) * 30, p.y - Math.sin(p.a) * 30); ctx.stroke(); }
    else { ctx.fillStyle = '#ff7a3a'; ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, TAU); ctx.fill(); }
  }
  for (const t of S.texts) { ctx.globalAlpha = Math.min(1, t.t * 2); label(String(t.s), t.x, t.y, 18, t.col, 'center'); ctx.globalAlpha = 1; }
  ctx.restore();
}

// ---------- HUD (PC) ----------
function drawToolbar() {
  ctx.fillStyle = COLORS.ink; ctx.fillRect(0, 0, VW, TB_H); ctx.fillStyle = 'rgba(255,211,77,.35)'; ctx.fillRect(0, TB_H - 2, VW, 2);
  for (let i = 0; i < 2; i++) button('army' + i, 4 + i * 72, 4, 68, 36, `${i + 1} ${S.armies[i].name}`, armyIdx === i);
  army().units.forEach((u, i) => {   // 군단 초상 (최대 12명): 클릭 = 조작 캐릭터로 선택, 더블클릭 = 화면 이동
    const x = LEFT_W + 6 + i * 38, on = u === ctrlOf();
    panel(x, 4, 36, 36, on ? COLORS.gold : 'rgba(255,255,255,.25)', on ? 3 : 1);
    ctx.save(); ctx.beginPath(); ctx.rect(x + 1, 5, 34, 34); ctx.clip(); ctx.globalAlpha = u.dead ? 0.25 : u.out ? 0.45 : 1;
    drawBody(ctx, x + 18, 40, 9, Math.PI / 2, { ...styleOf(u), weapon: null, horse: null }, { t: T }); ctx.restore();
    if (!u.dead && !u.out) bar(x + 2, 36, 32, 3, u.hp / u.maxHp, hpCol(u.hp / u.maxHp));
    if (u.dead) label('✕', x + 18, 22, 22, COLORS.danger, 'center'); else if (u.out) label('철', x + 18, 22, 16, COLORS.silver2, 'center');
    btns.push({ id: 'slot' + u.id, x, y: 4, w: 36, h: 36 });
  });
  const A = army(), cmds = [['charge', '돌격 F'], ['stop', '정지 V'], ['retreat', '후퇴 R'], ['idle', '자유 B'], ['deploy', '출진 G'], ['act', '행동 ␣'], ['auto', S.auto ? '자동 ON' : '자동 T'], ['menu', '시스템']];
  cmds.forEach((c, i) => button('cmd:' + c[0], 612 + i * 83, 4, 80, 36, c[1], A.order === c[0] || (c[0] === 'auto' && S.auto)));
}
function drawLeftPanel() {
  panel(0, TB_H, LEFT_W, vh, 'rgba(255,255,255,.2)', 1);
  const u = ctrlOf(); if (!u) return;
  const rows = [['HP', `${Math.ceil(u.hp)}/${u.maxHp}`], ['MP', u.maxMp ? `${Math.floor(u.mp)}/${u.maxMp}` : '—'], ['FT', Math.round(u.ft)], ['XP', `${u.xp}/${u.lv * 60}`], ['AT', u.atk.toFixed(0)], ['DF', u.df], ['AD', u.ad], ['MD', u.md], ['SP', u.sp], ['상태', stText(u)]];
  label(u.name, 10, TB_H + 18, 20, COLORS.gold); label(`${CLS_NAME[u.cls]} Lv${u.lv}`, 10, TB_H + 42, 16, COLORS.silver);
  bar(8, TB_H + 58, LEFT_W - 16, 5, u.hp / u.maxHp, hpCol(u.hp / u.maxHp));
  rows.forEach((r, i) => { const y = TB_H + 82 + i * 24; label(r[0], 10, y, 16, COLORS.silver2); label(String(r[1]), LEFT_W - 8, y, 16, r[0] === 'FT' && r[1] > 50 ? '#ffb04d' : COLORS.silver, 'right'); });
  const mw = LEFT_W - 12, mh = Math.round(mw * Sim.MH / Sim.MW), my = TB_H + vh - mh - 6, mx = 6, k = mw / WW;   // 미니맵
  ctx.drawImage(terrain, mx, my, mw, mh); ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1; ctx.strokeRect(mx, my, mw, mh);
  for (const e of S.units) if (alive(e)) { ctx.fillStyle = e.team === 'player' ? '#4fb0ff' : '#ff5a4a'; ctx.fillRect(mx + e.x * k - 1, my + e.y * k - 1, e.isLeader ? 4 : 2.5, e.isLeader ? 4 : 2.5); }
  ctx.strokeStyle = COLORS.gold; ctx.strokeRect(mx + cam.x * k, my + cam.y * k, VPW * k, vh * k);
}
function drawSpellPanel() {
  const u = ctrlOf(); if (!u || !u.spells.length) return;
  const x = LEFT_W + 8, y = TB_H + 8, locked = S.lock.player > 0;
  panel(x, y, 210, 30 + u.spells.length * 28, locked ? COLORS.danger : COLORS.gold, 2);
  label(locked ? `마법 잠금 ${Math.ceil(S.lock.player)}초` : `${u.name} 마법 (Space)`, x + 8, y + 15, 16, locked ? COLORS.danger : COLORS.gold);
  u.spells.forEach((k, i) => { const sp = SPELL[k], ok = u.mp >= sp.mp && !locked; label(`${i + 1} ${sp.name}  ${sp.mp}MP`, x + 8, y + 44 + i * 28, 16, u.spellSel === i ? COLORS.gold : ok ? COLORS.silver : COLORS.dim); if (u.spellSel === i) label('◀', x + 196, y + 44 + i * 28, 16, COLORS.gold, 'right'); btns.push({ id: 'spell:' + i, x, y: y + 30 + i * 28, w: 210, h: 28 }); });
}
function drawStick() {   // 맹장전 조이스틱: 누른 자리에 반투명 링, 노브가 손가락을 따라간다 (방향이 잡히면 금색)
  if (!stick) return;
  ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(stick.ox, stick.oy, STICK_R, 0, TAU); ctx.stroke();
  ctx.fillStyle = stick.dir ? COLORS.gold : '#fff'; ctx.beginPath(); ctx.arc(stick.ox + stick.kx, stick.oy + stick.ky, 30, 0, TAU); ctx.fill(); ctx.restore();
}
function drawPad() {   // 보조키 윈도우: 마우스·터치로 누르는 숫자패드 (누르고 있으면 계속 이동, 가운데 = 행동). 모바일은 왼쪽 아래에 크게
  const bs = mobile ? 84 : padLarge ? 52 : 34, g = mobile ? 4 : 3, head = mobile ? 0 : 24, w = bs * 3 + g * 4 + (mobile ? 0 : 6), h = bs * 3 + g * 4 + head;
  const x0 = mobile ? 14 : VW - w - 10, y0 = mobile ? VH - h - 14 : TB_H + vh - h - 10;
  if (!mobile) { panel(x0, y0, w, h, COLORS.silver2, 2, 'rgba(10,12,20,.78)'); label('보조키', x0 + w / 2, y0 + 12, 16, COLORS.silver2, 'center'); }
  PAD.forEach(([n, dx, dy, ch], i) => {
    const x = x0 + (mobile ? 0 : 5) + g + (i % 3) * (bs + g), y = y0 + head + g + Math.floor(i / 3) * (bs + g), on = padDir && padDir[0] === dx && padDir[1] === dy && (dx || dy);
    panel(x, y, bs, bs, on ? COLORS.gold : COLORS.silver, on ? 3 : 1, on ? 'rgba(80,60,16,.9)' : mobile ? 'rgba(30,34,50,.55)' : 'rgba(30,34,50,.85)');
    label(mobile && !dx && !dy ? '●' : ch, x + bs / 2, y + bs / 2, dx || dy ? (padLarge || mobile ? 26 : 18) : 16, on ? COLORS.gold : COLORS.silver, 'center');
    btns.push({ id: 'pad:' + dx + ',' + dy, x, y, w: bs, h: bs });
  });
}
function drawTable() {
  const y0 = TB_H + vh; ctx.fillStyle = COLORS.ink; ctx.fillRect(0, y0, VW, tblH); ctx.fillStyle = 'rgba(255,211,77,.35)'; ctx.fillRect(0, y0, VW, 2);
  const names = tblOpen ? (tblAbility ? ['NAME', 'AT', 'DF', 'AD', 'MD', 'SP', 'LV', 'ST'] : ['NAME', '병종', 'HP', 'MP', 'LV', 'FT', 'XP', 'ST']) : ['NAME', 'HP'], rh = 28, cw = VPW / 12;
  const hpRow = tblOpen ? (tblAbility ? -1 : 2) : 1;
  names.forEach((r, i) => label(r, 10, y0 + 18 + i * rh, 16, COLORS.silver2));
  army().units.forEach((u, c) => {
    const x = LEFT_W + c * cw, isSel = u === ctrlOf(), gone = u.dead || u.out;
    if (isSel) { ctx.fillStyle = 'rgba(255,211,77,.18)'; ctx.fillRect(x, y0 + 4, cw, tblH - 6); ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y0 + 5, cw - 2, tblH - 8); }
    if (!gone && hpRow >= 0) { ctx.fillStyle = 'rgba(79,176,255,.3)'; ctx.fillRect(x + 3, y0 + 6 + hpRow * rh, (cw - 6) * u.hp / u.maxHp, rh - 4); }
    const col = u.dead ? COLORS.danger : u.out ? COLORS.dim : isSel ? COLORS.goldSel : COLORS.silver;
    const cells = tblOpen ? (tblAbility ? [u.name, u.atk.toFixed(0), u.df, u.ad, u.md, u.sp, u.lv, stText(u)] : [u.name, CLS_NAME[u.cls], Math.ceil(u.hp), u.maxMp ? Math.floor(u.mp) : '—', u.lv, Math.round(u.ft), u.xp, stText(u)]) : [u.name, Math.ceil(u.hp)];
    cells.forEach((v, i) => label(String(v), x + cw / 2, y0 + 18 + i * rh, 16, !tblAbility && tblOpen && i === 5 && u.ft > 50 ? '#ffb04d' : col, 'center'));
    btns.push({ id: 'col' + u.id, x, y: y0, w: cw, h: tblH });
  });
}

// ---------- HUD (모바일) ----------
function drawToolbarMobile() {
  ctx.fillStyle = COLORS.ink; ctx.fillRect(0, 0, VW, TB_H); ctx.fillStyle = 'rgba(255,211,77,.35)'; ctx.fillRect(0, TB_H - 2, VW, 2);
  const u = ctrlOf(), A = army();
  button('prev', 6, 4, 62, 56, '◀', false, 22);
  panel(72, 4, 190, 56, COLORS.gold, 2); label(u ? u.name : '-', 167, 22, 20, COLORS.gold, 'center');
  if (u) { bar(82, 40, 170, 8, u.hp / u.maxHp, hpCol(u.hp / u.maxHp)); if (u.maxMp) bar(82, 51, 170, 4, u.mp / u.maxMp, '#8a6aff'); }
  button('next', 266, 4, 62, 56, '▶', false, 22);
  button('armyT', 334, 4, 112, 56, `${armyIdx + 1} ${A.name}`, false, 18);
  const cmds = [['charge', '돌격'], ['stop', '정지'], ['retreat', '후퇴'], ['idle', '자유'], ['deploy', '출진'], ['auto', S.auto ? '자동ON' : '자동'], ['menu', '≡']];
  cmds.forEach((c, i) => button('cmd:' + c[0], 456 + i * 117, 4, 112, 56, c[1], A.order === c[0] || (c[0] === 'auto' && S.auto), c[0] === 'menu' ? 28 : 20));
}
function roundBtn(id, cx, cy, r, title, sub, col, on) {
  ctx.fillStyle = on ? 'rgba(80,60,16,.75)' : 'rgba(10,12,20,.6)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.stroke();
  label(title, cx, cy - (sub ? 12 : 0), r > 60 ? 22 : 17, COLORS.silver, 'center'); if (sub) label(sub, cx, cy + 16, r > 60 ? 22 : 15, col, 'center');
  btns.push({ id, x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, cx, cy, r });
}
function drawActionsMobile() {   // 오른쪽 아래 원형 버튼 (맹장전 배치): 큰 행동 + 보조 + 마법 전환
  const u = ctrlOf(); if (!u || S.auto) return;
  const sp = u.spells.length ? SPELL[u.spells[u.spellSel]] : null, primary = sp ? sp.name : u.special ? SPECIAL[u.special].name : u.range > 0 ? '화살' : '공격';
  const ready = sp ? u.mp >= sp.mp && S.lock.player <= 0 : u.special ? u.spT <= 0 : true;
  roundBtn('m:act', 1168, 614, 74, '행동', primary, ready ? COLORS.gold : COLORS.silver2, ready);
  const alt = u.spells.length ? (u.special ? SPECIAL[u.special].name : '') : (u.special && u.range > 0 ? '화살' : '');
  if (alt) roundBtn('m:alt', 1028, 662, 46, '보조', alt, COLORS.silver2, false);
  if (u.spells.length > 1) roundBtn('m:spell', 1040, 556, 46, S.lock.player > 0 ? '잠금' : sp.name, S.lock.player > 0 ? Math.ceil(S.lock.player) + 's' : sp.mp + 'MP', S.lock.player > 0 ? COLORS.danger : COLORS.silver2, false);
}

function drawMenu() {   // 퍼스트퀸4 시스템 메뉴: 게임 속도 조정 / 보조키 윈도우 확대·축소 표시 / 상태표시 교환 / 자동 전투
  const items = [['m:speed', `게임 속도 조정  ×${SPEEDS[speedIdx]}`], ['m:mode', mobile ? '화면 모드: 모바일 → PC' : '화면 모드: PC → 모바일']];
  if (!mobile) items.push(['m:padbig', '보조키 윈도우 확대표시'], ['m:padsmall', '보조키 윈도우 축소표시'], ['m:tbl', tblOpen ? '상태창 축소표시' : '상태창 확대표시'], ['m:abil', tblAbility ? '상태표시 교환 (→ 상태)' : '상태표시 교환 (→ 능력)']);
  items.push(['m:auto', `자동 전투 [${S.auto ? 'ON' : 'OFF'}]`], ['m:restart', '전투 다시 시작'], ['m:close', '닫기 (Esc)']);
  const ih = mobile ? 54 : 38, st = mobile ? 62 : 44, w = 480, h = 70 + items.length * st, x = (VW - w) / 2, y = Math.max(6, (VH - h) / 2);
  panel(x, y, w, h, COLORS.gold, 3); label('시스템', x + w / 2, y + 30, 22, COLORS.gold, 'center');
  items.forEach((it, i) => button(it[0], x + 30, y + 56 + i * st, w - 60, ih, it[1], false, 18));
}
function drawOverlay(title, lines, col) {
  ctx.fillStyle = 'rgba(10,12,20,.8)'; ctx.fillRect(0, 0, VW, VH);
  label(title, VW / 2, 230, 96, col, 'center'); lines.forEach((s, i) => label(s, VW / 2, 330 + i * 38, 22, COLORS.silver, 'center'));
}
function drawTitle() {
  const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, COLORS.dusk1); g.addColorStop(0.55, COLORS.dusk2); g.addColorStop(1, COLORS.dusk3); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = COLORS.moon; ctx.beginPath(); ctx.arc(1010, 150, 52, 0, TAU); ctx.fill();
  ctx.fillStyle = COLORS.ink2; ctx.beginPath(); ctx.moveTo(0, VH); ctx.lineTo(0, 620); for (let x = 0; x <= VW; x += 40) ctx.lineTo(x, 620 + 26 * Math.sin(x * 0.006) + 16 * Math.sin(x * 0.02)); ctx.lineTo(VW, VH); ctx.closePath(); ctx.fill();
  [['guan', 250], ['zhao', 360], ['huang', 470], ['kong', 570], ['diao', 670], ['lubu', 880], ['captain', 1000], ['dian', 1100]].forEach(([k, x]) => drawBody(ctx, x, 670, 30, x < 780 ? 0 : Math.PI, STYLES[k], { t: T, weaponLen: 130 }));
  label('삼국 사우스파크', VW / 2, 150, 100, COLORS.gold, 'center'); label('퍼스트퀸4 식 실시간 군단 전투 프로토', VW / 2, 225, 28, COLORS.moon, 'center');
  (mobile ? ['왼쪽 화면을 누르고 끌기(조이스틱): 캐릭터 이동 · 부딪치면 공격', '오른쪽 행동 버튼·빈 곳 탭: 특수기·마법 · 적을 탭: 집중 공격', '위 ◀▶: 캐릭터 변경 · 군단 명령 · ≡ 메뉴'] : ['조작 캐릭터 이동: 숫자패드 (또는 WASD+QEZC, 화면의 보조키) — 적이 있는 칸으로 밀면 공격', 'Space: 특수기·마법 · X: 보조 행동 · 1 2 3: 마법 선택 · ←→ 조작 캐릭터 변경 · ↑↓ 군단 변경', '돌격 F · 정지 V · 후퇴 R · 자유 B · 출진 G · 자동전투 T · 적을 클릭: 집중 공격 · Ctrl: 가속 · Esc: 시스템']).forEach((s, i) => label(s, VW / 2, 295 + i * 34, 20, COLORS.silver, 'center'));
  label(mobile ? '화면을 탭하면 전투 시작' : '클릭 / Enter 로 전투 시작', VW / 2, 440, 30, COLORS.gold, 'center');
}
function draw() {
  btns = [];
  if (state === 'title') { drawTitle(); return; }
  layout(); clampCam();
  ctx.fillStyle = COLORS.ink; ctx.fillRect(0, 0, VW, VH);
  drawWorld();
  if (mobile) {
    drawToolbarMobile(); drawStick(); drawActionsMobile();
    const u = ctrlOf(); if (u) { panel(8, TB_H + 8, 230, 54, 'rgba(255,255,255,.25)', 1, 'rgba(10,12,20,.6)'); label(`${CLS_NAME[u.cls]} Lv${u.lv}  ${Math.ceil(u.hp)}/${u.maxHp}`, 16, TB_H + 26, 16, COLORS.silver); label(`FT ${Math.round(u.ft)}${u.maxMp ? `  MP ${Math.floor(u.mp)}` : ''}  ${stText(u)}`, 16, TB_H + 48, 16, COLORS.silver2); }
  } else { drawToolbar(); drawLeftPanel(); drawSpellPanel(); drawPad(); drawTable(); }
  if (S.auto) label('자동 전투', VW - 10, TB_H + 18, 18, COLORS.gold, 'right');
  if (S.t < 14 && !S.over) label(mobile ? '왼쪽 화면을 눌러 끌면 이동 · 적에게 부딪치면 공격 · 오른쪽 행동 버튼' : '숫자패드(또는 WASD+QEZC)로 조작 캐릭터 이동 · 적에게 부딪치면 공격 · Space 특수기/마법', LEFT_W + VPW / 2, TB_H + vh - (mobile ? 30 : 16), 16, COLORS.silver2, 'center');
  if (menuOpen) drawMenu();
  if (S.over === 'win') drawOverlay('승 리', ['적 군단을 모두 물리쳤다!', `${Math.round(S.t)}초 · 격파 ${S.stats.kills} · 도주 ${S.stats.fled} · 전사 ${S.stats.lost} · 레벨업 ${S.stats.levelups}`, mobile ? '화면을 탭하면 다시 시작' : '클릭 / R 로 다시 시작'], COLORS.gold);
  else if (S.over === 'lose') drawOverlay('패 배', ['총대장 관우가 쓰러졌다…', `${Math.round(S.t)}초 · 격파 ${S.stats.kills} · 전사 ${S.stats.lost}`, mobile ? '화면을 탭하면 다시 시작' : '클릭 / R 로 다시 시작'], COLORS.danger);
  else if (paused && !menuOpen) drawOverlay('일시정지', [mobile ? '화면을 탭하면 계속' : 'P 로 계속'], COLORS.silver);
}

// ---------- 명령 ----------
function mark(x, y, col) { marks.push({ x, y, col, t: 0.7 }); }
function floatText(u, s, col) { S.texts.push({ x: u.x, y: u.y - 60, s, col, t: 1 }); }
function pick(u) { if (!u || !alive(u) || u.team !== 'player') return; armyIdx = u.army.id; Sim.setCtrl(S, u.army, u); }
function cycleUnit(dir) {
  const list = army().units.filter(alive); if (!list.length) return;
  const i = list.indexOf(ctrlOf()); pick(list[i < 0 ? 0 : (i + dir + list.length) % list.length]);
}
function act(alt) { const u = ctrlOf(); if (u && !S.auto && !Sim.action(S, u, alt)) floatText(u, u.spells.length && !alt ? (S.lock.player > 0 ? '마법 잠금' : '사용 불가') : '준비중', '#cfd3e6'); }
function useCommand(id) {
  if (['charge', 'stop', 'retreat', 'idle'].includes(id)) { Sim.armyOrder(S, army(), id); return; }
  if (id === 'deploy') { for (const u of army().units) if (u.out && !u.fled && !u.dead) Sim.recall(S, u); return; }
  if (id === 'act') act(false); else if (id === 'auto') S.auto = !S.auto; else if (id === 'menu') menuOpen = true;
}
function uiClick(id) {
  if (id.startsWith('army')) { armyIdx = +id.slice(4); return; }
  if (id.startsWith('slot') || id.startsWith('col')) {
    const u = S.units.find(x => x.id === +id.replace(/\D/g, '')); if (!u || u.dead) return;
    const dbl = lastPortrait.id === u.id && T - lastPortrait.t < 0.4; lastPortrait = { id: u.id, t: T };
    if (alive(u)) pick(u); else if (u.out) Sim.recall(S, u); if (dbl) snapCam(); return;   // 철수한 캐릭터의 초상을 누르면 그 캐릭터만 출진
  }
  if (id.startsWith('cmd:')) { useCommand(id.slice(4)); return; }
  if (id.startsWith('spell:')) { const u = ctrlOf(); if (u) Sim.selectSpell(u, +id.slice(6)); return; }
  if (id === 'prev') cycleUnit(-1); else if (id === 'next') cycleUnit(1); else if (id === 'armyT') armyIdx = 1 - armyIdx;
  else if (id === 'm:act') act(false); else if (id === 'm:alt') act(true);
  else if (id === 'm:spell') { const u = ctrlOf(); if (u && u.spells.length) Sim.selectSpell(u, (u.spellSel + 1) % u.spells.length); }
  else if (id === 'm:speed') speedIdx = (speedIdx + 1) % SPEEDS.length; else if (id === 'm:padbig') padLarge = true; else if (id === 'm:padsmall') padLarge = false;
  else if (id === 'm:mode') setMobile(!mobile);
  else if (id === 'm:tbl') tblOpen = !tblOpen; else if (id === 'm:abil') tblAbility = !tblAbility;
  else if (id === 'm:auto') S.auto = !S.auto; else if (id === 'm:restart') startBattle(); else if (id === 'm:close') menuOpen = false;
}
function mapClick(sx, sy, right) {   // 적을 클릭 = 군단이 그 적을 집중 공격, 아군을 클릭 = 그 캐릭터를 조작, 우클릭 = 집중 공격 해제
  const [wx, wy] = toWorld(sx, sy);
  if (right) { for (const u of army().units) if (u.order.type === 'attack') u.order = { type: army().order }; return true; }
  const hit = Sim.unitAt(S, wx, wy);
  if (hit && hit.team === 'enemy') { Sim.focus(S, army(), hit); mark(hit.x, hit.y, COLORS.danger); } else if (hit) pick(hit);
  return !!hit;
}

// ---------- 입력 (포인터 이벤트: 마우스·터치 공용, 터치는 멀티터치 — 패드를 누른 채 다른 손가락으로 행동) ----------
function pos(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * VW / r.width, y: (e.clientY - r.top) * VH / r.height }; }
const hitBtn = (x, y) => [...btns].reverse().find(b => b.r ? Math.hypot(x - b.cx, y - b.cy) <= b.r + 6 : x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
const padOf = id => { const [dx, dy] = id.slice(4).split(',').map(Number); return [dx, dy]; };
const STICK_R = 70, D8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const inStickZone = (x, y) => mobile && x < VW * 0.5 && y > TB_H;   // 맹장전 방식: 왼쪽 화면 어디를 눌러도 그 자리에 조이스틱이 생긴다 (플로팅)
function stickMove(x, y) {   // 손가락 위치 → 노브 위치(반지름 제한) + 8방향
  const dx = x - stick.ox, dy = y - stick.oy, d = Math.hypot(dx, dy), k = d > STICK_R ? STICK_R / d : 1; stick.kx = dx * k; stick.ky = dy * k;
  stick.dir = d > 10 ? D8[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8] : null;
}
const refreshPad = () => { const v = [...padPtrs.values()]; padDir = stick && stick.dir ? stick.dir : v.length ? v[v.length - 1] : null; };
function goFullscreen() { try { const d = document.documentElement, f = d.requestFullscreen || d.webkitRequestFullscreen; if (f && !document.fullscreenElement && !document.webkitFullscreenElement) { const p = f.call(d); if (p && p.catch) p.catch(() => {}); } const o = screen.orientation; if (o && o.lock) o.lock('landscape').catch(() => {}); } catch (e) { /* 지원하지 않는 브라우저(iOS 사파리 등)는 무시 */ } }
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
  const p = pos(e); mouse.x = p.x; mouse.y = p.y; mouse.in = true;
  if (e.pointerType === 'touch' && !mobile) setMobile(true);   // 터치가 감지되면 모바일 화면으로 전환
  if (state === 'title') { if (mobile) goFullscreen(); startBattle(); return; }
  if (S.over) { if (T - overAt > 1) startBattle(); return; }
  if (paused && !menuOpen) { paused = false; return; }   // 일시정지(앱 전환 등)는 화면을 탭하면 계속
  const b = hitBtn(p.x, p.y);
  if (menuOpen) { if (b && b.id.startsWith('m:')) uiClick(b.id); return; }
  if (!b && !stick && inStickZone(p.x, p.y)) { stick = { id: e.pointerId, ox: p.x, oy: p.y, kx: 0, ky: 0, dir: null }; stickMove(p.x, p.y); refreshPad(); return; }
  if (b && b.id.startsWith('pad:')) { const [dx, dy] = padOf(b.id); if (dx || dy) { padPtrs.set(e.pointerId, [dx, dy]); refreshPad(); } else if (!mobile) act(false); return; }
  if (b) { uiClick(b.id); return; }
  if (inView(p.x, p.y)) { if (mobile && !mapClick(p.x, p.y, false)) act(false); else if (!mobile) mapClick(p.x, p.y, e.button === 2); }
});
cv.addEventListener('pointermove', e => {
  const p = pos(e); mouse.x = p.x; mouse.y = p.y; mouse.in = true;
  if (stick && stick.id === e.pointerId) { stickMove(p.x, p.y); refreshPad(); return; }
  if (padPtrs.has(e.pointerId)) { const b = hitBtn(p.x, p.y); if (b && b.id.startsWith('pad:')) { const [dx, dy] = padOf(b.id); if (dx || dy) padPtrs.set(e.pointerId, [dx, dy]); else padPtrs.delete(e.pointerId); } else padPtrs.delete(e.pointerId); refreshPad(); }   // 패드 위에서 손가락을 미끄러뜨리면 방향 전환
});
const endPtr = e => { padPtrs.delete(e.pointerId); if (stick && stick.id === e.pointerId) stick = null; refreshPad(); };
addEventListener('pointerup', endPtr); addEventListener('pointercancel', endPtr);
addEventListener('keydown', e => {
  if (e.repeat) return;
  if ([' ', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F10'].includes(e.key)) e.preventDefault();
  if (state === 'title') { if (e.key === 'Enter') startBattle(); return; }
  if (S.over) { if (e.key.toLowerCase() === 'r' && T - overAt > 1) startBattle(); return; }
  if (e.code in DIRS) { dirStack = dirStack.filter(c => c !== e.code); dirStack.push(e.code); e.preventDefault(); return; }   // 방향 입력 (NumLock 상태와 무관하게 code 로 판별)
  keys[e.key] = true;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === 'Escape' || k === 'F10') { menuOpen = !menuOpen; return; }
  if (menuOpen) return;
  if (k === 'ArrowLeft') cycleUnit(-1); else if (k === 'ArrowRight') cycleUnit(1);
  else if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'Tab') armyIdx = 1 - armyIdx;
  else if (k === ' ') act(false); else if (k === 'x') act(true);
  else if (k === 'f') useCommand('charge'); else if (k === 'v') useCommand('stop'); else if (k === 'r') useCommand('retreat'); else if (k === 'b') useCommand('idle');
  else if (k === 'g') useCommand('deploy'); else if (k === 't') useCommand('auto'); else if (k === 'p') paused = !paused;
  else if (k === '1' || k === '2' || k === '3') { const u = ctrlOf(); if (u) Sim.selectSpell(u, +k - 1); }
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
    if (!paused && !menuOpen && !S.over) {
      const d = padDir || (dirStack.length ? DIRS[dirStack[dirStack.length - 1]] : null), u = ctrlOf();
      let r = dt * (keys.Control ? 3 : SPEEDS[speedIdx]);
      while (r > 0) { const s = Math.min(r, 1 / 60); if (d && u && alive(u)) Sim.control(S, u, d[0], d[1]); Sim.step(S, s); r -= s; }
    }
    if (S.over && !overAt) overAt = T;
    const [tx, ty] = camTarget(); cam.x += (tx - cam.x) * Math.min(1, dt * 7); cam.y += (ty - cam.y) * Math.min(1, dt * 7);   // 조작 캐릭터를 따라 맵이 스크롤
  }
  draw(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
