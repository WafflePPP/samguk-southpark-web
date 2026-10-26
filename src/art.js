'use strict';
// 그래픽 출처: 삼국 맹장전(TKC) 아트방향.md 팔레트 + 91-render-world.js drawBody/drawHorse 도형 규칙을 이 프로젝트용으로 축약 이식.
// 이미지 파일 없이 캔버스 도형만 쓴다 (TKC 와 동일 방식).
const TAU = Math.PI * 2;
const COLORS = {
  ink: '#0a0c14', ink2: '#0c0814', gold: '#ffd34d', goldTrim: '#d4a73a', goldSel: '#ffe9a0',
  silver: '#cfd3e6', silver2: '#aab3c8', dim: '#8a90a6', danger: '#ff5a4a', ally: '#4fb0ff', heal: '#7dff9a',
  dusk1: '#1a1228', dusk2: '#8c3a48', dusk3: '#e58a4a', moon: '#f6edcf', field: '#7a6a47',
};

// 영웅 6명(TKC HEROES.style 그대로) + 적 병종(TKC ENEMY 스타일) + 이 프로젝트용 병종
const STYLES = {
  guan: { body: '#2f8f5b', trim: '#d4a73a', skin: '#c9553f', cape: '#1f6a42', beard: true, hat: true, weapon: 'glaive' },
  lubu: { body: '#2a2030', trim: '#c9302c', skin: '#e0b08a', helm: true, feathers: true, pauldrons: true, weapon: 'halberd', horse: '#a8321f' },
  zhao: { body: '#2b6a6e', trim: '#c9cfd8', skin: '#e0b08a', cape: '#1f4a50', hair: true, band: true, pauldrons: true, weapon: 'lance', horse: '#f0ece0' },
  diao: { body: '#c86aa8', trim: '#ffd34d', skin: '#f4d9bd', sleeves: '#f7b3d3', hairCap: true, longHair: true, crown: true, flower: true, weapon: 'fan', weaponScale: 0.5 },
  dian: { body: '#8a3a22', trim: '#d4a73a', skin: '#c98a6a', beard: true, wrap: true, pauldrons: true, cape: '#5a2418', weapon: 'twin' },
  huang: { body: '#5c5a3c', trim: '#d4a73a', skin: '#d9a98a', helm: true, helmColor: '#c9a24a', plume: 1, beard: true, beardColor: '#e8e4da', pauldrons: true, cape: '#a8321f', weapon: 'bow' },
  kong: { body: '#2a3f7a', trim: '#ffd34d', skin: '#e8c9a8', hairCap: true, beard: true, beardColor: '#e8e4da', sleeves: '#6a86d8', weapon: 'fan', weaponScale: 0.5 },
  // 아군 병졸: 영웅과 구분되게 청색 계열 몸통 (밝으면 영웅, 어두우면 적 — 아트방향 4)
  ally_sword: { body: '#35506e', trim: '#9aa7b8', skin: '#e0b08a', helm: true, helmColor: '#2c3340', plume: 0.5, weapon: 'spear' },
  ally_archer: { body: '#3d5a6a', trim: '#9aa7b8', skin: '#e0b08a', helm: true, helmColor: '#4a5a66', plume: 0.4, weapon: 'bow' },
  ally_shield: { body: '#35506e', trim: '#9aa7b8', skin: '#e0b08a', helm: true, helmColor: '#2c3340', plume: 0.5, pauldrons: true, weapon: 'axe', shield: true },
  ally_cav: { body: '#2f5f8a', trim: '#c9cfd8', skin: '#e0b08a', helm: true, helmColor: '#2c3340', plume: 1.2, pauldrons: true, weapon: 'spear', horse: '#d8d2c0' },
  mage: { body: '#3a5a8a', trim: '#ffd34d', skin: '#e8c9a8', hairCap: true, sleeves: '#8fb0e8', weapon: 'fan', weaponScale: 0.5 },
  soldier: { body: '#4a2b33', trim: '#a02b2b', skin: '#d9a77e', helm: true, helmColor: '#34303a', plume: 1, pauldrons: true, weapon: 'spear' },
  archer: { body: '#3d3a46', trim: '#8a2a2a', skin: '#d9a77e', helm: true, helmColor: '#5a4332', plume: 0.7, weapon: 'bow' },
  shield: { body: '#4a2b33', trim: '#b8433a', skin: '#d9a77e', helm: true, helmColor: '#2c3340', plume: 0.5, pauldrons: true, weapon: 'axe', shield: true },
  cav: { body: '#3b3f4b', trim: '#c9302c', skin: '#d9a77e', helm: true, helmColor: '#2b2d36', plume: 1.2, pauldrons: true, weapon: 'spear', horse: '#4a3a30' },
  captain: { body: '#5a1c24', trim: '#e0b13a', skin: '#c9946a', helm: true, helmColor: '#24222c', plume: 1.6, pauldrons: true, weapon: 'sword' },
  hua: { body: '#7a1c24', trim: '#ffd34d', skin: '#c9946a', cape: '#3a0e14', helm: true, helmColor: '#1c1c26', plume: 1.8, pauldrons: true, beard: true, weapon: 'axe' },
  jang: { body: '#29263d', trim: '#c99a52', skin: '#c98f6a', cape: '#513285', helm: true, helmColor: '#c8d1dc', plume: 1.9, plumeColor: '#4655b8', pauldrons: true, beard: true, weapon: 'lance', tassel: '#b53632', horse: '#24212b' },
  gong: { body: '#e3e7e4', trim: '#4f83a8', skin: '#d8a17b', cape: '#d7e1df', helm: true, helmColor: '#d8dde0', plume: 1.5, plumeColor: '#eef4f2', pauldrons: true, beard: true, weapon: 'bow', horse: '#f1eee4' },
  lulingqi: { body: '#e3e4e8', trim: '#7650a5', skin: '#f1d0b3', sleeves: '#d8d9e2', hairCap: true, longHair: true, crown: true, pauldrons: true, weapon: 'lance', tassel: '#c9302c', horse: '#343039' },
  gao: { body: '#302722', trim: '#755a3f', skin: '#c68f6d', cape: '#17171c', helm: true, helmColor: '#29272d', plume: 2, plumeColor: '#c42e2e', pauldrons: true, beard: true, weapon: 'sword' },
  cao: { body: '#242334', trim: '#c79b3b', skin: '#c98f6a', cape: '#30294e', hairCap: true, crown: true, beard: true, pauldrons: true, armorPlate: '#54515a', weapon: 'sword' },
  xia: { body: '#353248', trim: '#8d6bb0', skin: '#bd805e', cape: '#465878', helm: true, helmColor: '#b08a3e', plume: 1.1, plumeColor: '#b89a58', eyePatch: true, beard: true, pauldrons: true, weapon: 'sword' },
  xiahouyuan: { body: '#385565', trim: '#b7c8d3', skin: '#c98f6a', cape: '#58798a', helm: true, helmColor: '#566779', plume: 1.5, plumeColor: '#294d75', beard: true, pauldrons: true, weapon: 'bow', horse: '#49372e' },
  liubei: { body: '#542b2f', trim: '#d5a945', skin: '#d4a27f', sleeves: '#b45f35', cape: '#7f3829', hairCap: true, crown: true, beard: true, weapon: 'sword' },
  zhangfei: { body: '#6f4a22', trim: '#d5a33b', skin: '#b9784f', wrap: true, wrapColor: '#b72c28', beard: true, pauldrons: true, armorPlate: '#86652f', bulk: 1.14, weapon: 'spear', tassel: '#b72c28' },
  machao: { body: '#223c48', trim: '#d6aa4b', skin: '#ddb18c', cape: '#e7e2d4', helm: true, helmColor: '#d6d9da', plume: 1.5, plumeColor: '#e2c56c', horns: true, fur: true, pauldrons: true, weapon: 'lance', horse: '#dedbd1' },
  xuhuang: { body: '#4d4140', trim: '#b68b54', skin: '#bd805e', cape: '#67363d', helm: true, helmColor: '#76533c', plume: 1.7, plumeColor: '#bf3330', beard: true, pauldrons: true, weapon: 'axe', fixedWeapon: true, horse: '#382d2a' },
  yuan: { body: '#48372e', trim: '#e0b13a', skin: '#c98f6a', cape: '#5a3b87', helm: true, helmColor: '#d1a537', plume: 1.5, plumeColor: '#d8ad39', beard: true, pauldrons: true, armorPlate: '#b98b28', weapon: 'sword' },
  yan: { body: '#4f5a58', trim: '#c9cfd8', skin: '#bc7c58', cape: '#9b3d34', helm: true, helmColor: '#b8aa82', plume: 1.8, plumeColor: '#32934a', beard: true, pauldrons: true, weapon: 'spear', horse: '#58392c' },
  wen: { body: '#3a3034', trim: '#c39a52', skin: '#b97b59', cape: '#4a2528', helm: true, helmColor: '#3a3438', plume: 1.7, plumeColor: '#b32f2d', beard: true, pauldrons: true, weapon: 'spear', horse: '#332825' },
  sima: { body: '#302b43', trim: '#b89c68', skin: '#c58e6c', cape: '#d9dce0', sleeves: '#6c667d', courtHat: true, beard: true, weapon: 'fan', weaponScale: 0.45 },
  xuchu: { body: '#444746', trim: '#a98853', skin: '#b97750', cape: '#35613d', wrap: true, wrapColor: '#3d8a50', beard: true, pauldrons: true, armorPlate: '#a9a9a0', bulk: 1.18, weapon: 'sword' },
  dong: { body: '#282634', trim: '#b78b3e', skin: '#b77b58', sleeves: '#4d3448', courtHat: true, crown: true, beard: true, armorPlate: '#493642', bulk: 1.22, weapon: 'sword' },
  guo: { body: '#30446b', trim: '#c2a35d', skin: '#d0a180', sleeves: '#5e83b7', hairCap: true, weapon: 'fan', weaponScale: 0.45 },
  xun: { body: '#4a2a5a', trim: '#ffd34d', skin: '#d9a77e', hairCap: true, crown: true, beard: true, beardColor: '#cfd3e6', sleeves: '#7a4a8a', weapon: 'fan', weaponScale: 0.5 },
  emage: { body: '#4a2a5a', trim: '#c9302c', skin: '#d9a77e', hairCap: true, sleeves: '#7a4a8a', weapon: 'fan', weaponScale: 0.5 },
};
// 세력 고유 병종(명세 53 §3.5): 몸통·장식 위주로 구별한다. 아군/적 팀색(body·trim·horse)은 game.js styleOf 가 base 로 바꿔 끼운다.
const FACTION_UNIT_STYLES = {
  f_xian: { base: 'shield', body: '#3f78c0', armorPlate: '#54515a', helmColor: '#163b70', enemyHelm: '#3a1418', plumeColor: '#cce8ff', bulk: 1.1, towerShield: true },   // 아군 밝은 청 몸통·은 방패 / 적 암적 몸통·붉은 방패 (v0.1.264)
  f_bing: { base: 'cav', feathers: true, plumeColor: '#c9302c', weapon: 'lance', fixedWeapon: true },
  f_nu: { base: 'archer', helmColor: '#4a5a66', plumeColor: '#dce8c6', weapon: 'crossbow', weaponScale: 1.15 },
  f_ji: { base: 'sword', weapon: 'halberd', fixedWeapon: true, pauldrons: true, plumeColor: '#d1a537' },
  f_qing: { base: 'sword', wrap: true, wrapColor: '#e0c040', helm: false },
  f_hubao: { base: 'cav', plume: 1.8, plumeColor: '#b84338', armorPlate: '#54515a', fur: true, tigerEars: true, stripes: '#e8892a', bulk: 1.18, weapon: 'lance', fixedWeapon: true },
  f_bai: { base: 'sword', helmColor: '#f0ece0', plume: 1.4, plumeColor: '#ffffff', cape: '#e8e4da', weapon: 'spear' },
  f_dan: { base: 'sword', helm: false, hairCap: true, band: true, sleeves: '#bc9b72', strawHat: true },
};
const ENEMY_BASE_STYLE = { sword: 'soldier', shield: 'shield', archer: 'archer', cav: 'cav' };
const ALLY_BASE_STYLE = { sword: 'ally_sword', shield: 'ally_shield', archer: 'ally_archer', cav: 'ally_cav' };
for (const [k, v] of Object.entries(FACTION_UNIT_STYLES)) { STYLES[k] = { ...STYLES[ALLY_BASE_STYLE[v.base]], ...v }; delete STYLES[k].base; STYLES[k].teamBase = v.base; }

function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }

function drawWeapon(g, kind, x, y, ang, len, r, scale = 1, tassel, bowPull = 0) {
  g.save(); g.translate(x, y); g.scale(scale, scale); g.translate(-x, -y);
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  g.lineCap = 'round';
  if (kind === 'sword') {   // 짧은 손잡이·가드와 곧은 양날 검신으로 창과 구분한다.
    const guard = len * 0.14, width = len * 0.1;
    g.strokeStyle = '#5a3020'; g.lineWidth = 4; g.beginPath(); g.moveTo(x - dx * len * 0.22, y - dy * len * 0.22); g.lineTo(x, y); g.stroke();
    g.fillStyle = '#dce8f2'; g.beginPath(); g.moveTo(x + nx * width, y + ny * width); g.lineTo(x + dx * len * 0.78 + nx * width * 0.7, y + dy * len * 0.78 + ny * width * 0.7); g.lineTo(x + dx * len, y + dy * len); g.lineTo(x + dx * len * 0.78 - nx * width * 0.7, y + dy * len * 0.78 - ny * width * 0.7); g.lineTo(x - nx * width, y - ny * width); g.closePath(); g.fill();
    g.strokeStyle = '#7c9ab5'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx * len * 0.9, y + dy * len * 0.9); g.stroke();
    g.strokeStyle = COLORS.goldTrim; g.lineWidth = 3; g.beginPath(); g.moveTo(x - nx * guard, y - ny * guard); g.lineTo(x + nx * guard, y + ny * guard); g.stroke();
    g.restore(); return;
  }
  if (kind === 'fan') {
    const hx = x + dx * len * 0.42, hy = y + dy * len * 0.42, R = 22;
    g.strokeStyle = '#8a5a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(hx, hy); g.stroke();
    g.fillStyle = '#ff9ac8'; g.beginPath(); g.moveTo(hx, hy); g.arc(hx, hy, R, ang - 0.95, ang + 0.95); g.closePath(); g.fill();
    g.strokeStyle = COLORS.gold; g.lineWidth = 1.5; g.beginPath(); g.arc(hx, hy, R, ang - 0.95, ang + 0.95); g.stroke();
    g.restore(); return;
  }
  if (kind === 'crossbow') {
    g.strokeStyle = '#35281d'; g.lineWidth = 6; g.beginPath(); g.moveTo(x - dx * r, y - dy * r); g.lineTo(x + dx * r * 1.8, y + dy * r * 1.8); g.stroke();
    g.strokeStyle = '#cfd3e6'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + nx * r * 1.2, y + ny * r * 1.2); g.lineTo(x + dx * r * 0.7, y + dy * r * 0.7); g.lineTo(x - nx * r * 1.2, y - ny * r * 1.2); g.stroke();
    g.lineWidth = 1; g.beginPath(); g.moveTo(x + nx * r * 1.2, y + ny * r * 1.2); g.lineTo(x - dx * r * 0.5, y - dy * r * 0.5); g.lineTo(x - nx * r * 1.2, y - ny * r * 1.2); g.stroke();
    g.restore(); return;
  }
  if (kind === 'bow') {
    const cx = x + dx * 14, cy = y + dy * 14, R = r * 1.1;
    g.strokeStyle = '#6a4a2a'; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, R, ang - 1.2, ang + 1.2); g.stroke();
    g.strokeStyle = '#ddd'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx + Math.cos(ang - 1.2) * R, cy + Math.sin(ang - 1.2) * R); if (bowPull > 0) g.lineTo(cx - dx * R * bowPull, cy - dy * R * bowPull); g.lineTo(cx + Math.cos(ang + 1.2) * R, cy + Math.sin(ang + 1.2) * R); g.stroke();
    g.restore(); return;
  }
  if (kind === 'twin') {
    for (const sd of [-1, 1]) {
      const a2 = ang + sd * 0.42, c2 = Math.cos(a2), s2 = Math.sin(a2), L2 = len * 0.62;
      const bx = x + Math.cos(ang + Math.PI / 2) * sd * 7, by = y + Math.sin(ang + Math.PI / 2) * sd * 7, tx = bx + c2 * L2, ty = by + s2 * L2;
      g.strokeStyle = '#3a2a1e'; g.lineWidth = 4.5; g.beginPath(); g.moveTo(bx - c2 * 8, by - s2 * 8); g.lineTo(tx, ty); g.stroke();
      g.fillStyle = '#d6dbe3'; g.beginPath(); g.moveTo(tx - c2 * 10, ty - s2 * 10); g.lineTo(tx + c2 * 22, ty + s2 * 22); g.lineTo(tx - s2 * 14, ty + c2 * 14); g.closePath(); g.fill();
    }
    g.restore(); return;
  }
  const bx = x - dx * len * 0.22, by = y - dy * len * 0.22, tx = x + dx * len, ty = y + dy * len;
  g.strokeStyle = '#5a3a1a'; g.lineWidth = kind === 'glaive' || kind === 'halberd' ? 6 : 5; g.beginPath(); g.moveTo(bx, by); g.lineTo(tx, ty); g.stroke();
  g.fillStyle = kind === 'glaive' ? '#cfe8ff' : '#d8d8d8';
  const bl = kind === 'glaive' ? len * 0.32 : kind === 'halberd' ? len * 0.26 : len * 0.2;
  g.beginPath();
  if (kind === 'glaive') {   // 청룡언월도: 넓은 초승달 날
    g.moveTo(tx - dx * bl, ty - dy * bl); g.quadraticCurveTo(tx + nx * bl * 1.1 - dx * bl * 0.2, ty + ny * bl * 1.1 - dy * bl * 0.2, tx + dx * bl * 0.7, ty + dy * bl * 0.7);
    g.quadraticCurveTo(tx + nx * bl * 0.3, ty + ny * bl * 0.3, tx - dx * bl, ty - dy * bl);
  } else if (kind === 'halberd') {   // 방천화극: 양날
    g.moveTo(tx - dx * bl, ty - dy * bl); g.lineTo(tx + dx * bl * 0.9, ty + dy * bl * 0.9); g.lineTo(tx - dx * bl * 0.3 + nx * bl * 0.7, ty - dy * bl * 0.3 + ny * bl * 0.7);
    g.moveTo(tx - dx * bl, ty - dy * bl); g.lineTo(tx - dx * bl * 0.3 - nx * bl * 0.7, ty - dy * bl * 0.3 - ny * bl * 0.7); g.lineTo(tx + dx * bl * 0.9, ty + dy * bl * 0.9);
  } else if (kind === 'axe') {
    g.moveTo(tx - dx * bl * 0.6, ty - dy * bl * 0.6); g.lineTo(tx + nx * bl * 1.1, ty + ny * bl * 1.1); g.lineTo(tx + dx * bl * 0.6, ty + dy * bl * 0.6);
  } else {   // lance / spear: 곧은 창날
    g.moveTo(tx - dx * bl * 0.2 + nx * bl * 0.3, ty - dy * bl * 0.2 + ny * bl * 0.3); g.lineTo(tx + dx * bl * 1.2, ty + dy * bl * 1.2); g.lineTo(tx - dx * bl * 0.2 - nx * bl * 0.3, ty - dy * bl * 0.2 - ny * bl * 0.3);
  }
  g.closePath(); g.fill();
  if (tassel && (kind === 'lance' || kind === 'spear')) {
    const jx = tx - dx * bl * 0.7, jy = ty - dy * bl * 0.7;
    g.strokeStyle = tassel; g.lineWidth = 3; g.beginPath(); g.moveTo(jx, jy); g.lineTo(jx - dx * bl * 0.45 + nx * bl * 0.45, jy - dy * bl * 0.45 + ny * bl * 0.45); g.stroke();
  }
  if (kind === 'glaive') {   // 금색 용 장식과 붉은 수술로 일반 장병기와 구분한다.
    const jx = tx - dx * bl * 0.85, jy = ty - dy * bl * 0.85;
    g.strokeStyle = COLORS.goldTrim; g.lineWidth = 3; g.beginPath(); g.arc(jx, jy, bl * 0.22, 0, TAU); g.stroke();
    g.strokeStyle = '#b52b2b'; g.lineWidth = 3; g.beginPath(); g.moveTo(jx, jy); g.lineTo(jx - dx * bl * 0.35 + nx * bl * 0.35, jy - dy * bl * 0.35 + ny * bl * 0.35); g.stroke();
  }
  g.restore();
}

// TKC drawHorse 축약: 몸통·네 다리(보행/질주)·목과 머리·꼬리
function drawHorse(g, x, y, r, f, coat, t, moving) {
  const c = Math.cos(f), sn = Math.sin(f), gal = moving ? t * 16 : 0;
  g.save(); g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(x, y + r * 0.45, r * 1.6, r * 0.65, 0, 0, TAU); g.fill();
  g.strokeStyle = '#1d1614'; g.lineWidth = r * 0.17; g.lineCap = 'round';
  for (const [a, l, ph] of [[0.75, 0.35, 0], [0.75, -0.35, 2.4], [-0.75, 0.35, 3.1], [-0.75, -0.35, 5.5]]) {
    const bx = x + (a * c - l * sn) * r, by = y + (a * sn + l * c) * r * 0.9 - r * 0.2, sw = Math.sin(gal + ph) * r * 0.38;
    g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + c * sw, by + r * 0.8 + sn * sw * 0.5); g.stroke();
  }
  g.translate(x, y - r * 0.35); g.rotate(f); g.fillStyle = coat;
  g.beginPath(); g.ellipse(0, 0, r * 1.35, r * 0.62, 0, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(r * 0.9, -r * 0.25); g.quadraticCurveTo(r * 1.5, -r * 0.55, r * 1.75, -r * 0.2); g.lineTo(r * 1.7, r * 0.25); g.quadraticCurveTo(r * 1.4, r * 0.3, r * 0.9, r * 0.3); g.closePath(); g.fill();
  g.beginPath(); g.ellipse(r * 1.95, 0, r * 0.5, r * 0.27, 0.15, 0, TAU); g.fill();
  g.strokeStyle = '#1d1614'; g.lineWidth = r * 0.14; g.beginPath(); g.moveTo(-r * 1.3, 0); g.quadraticCurveTo(-r * 1.9, Math.sin(t * 8) * r * 0.3, -r * 2.1, r * 0.2); g.stroke();
  g.restore();
}

// 피해·발사 즉시 발동하는 전투이므로 선딜을 만들지 않고 타격 자세에서 복귀한다.
function heroPose(u, s, t) {
  if (!u.named) return null;
  const action = u.anim > 0 ? u.actionKind || 'attack' : '', duration = action === 'attack' || action === 'melee' ? 0.28 : 0.4;
  const p = Math.max(0, Math.min(1, 1 - u.anim / duration)), kick = action ? (1 - p) ** 2 : 0;
  const fleeing = u.order && ['retreat', 'flee'].includes(u.order.type);
  const gait = u.moving ? Math.sin(t * (fleeing ? 14 : 10) + u.id) : 0;
  const pose = { state: u.moving ? 'move' : 'idle', angle: u.face + 0.9, reach: 0, lean: 0, bob: Math.abs(gait) * 2, stride: gait, pull: 0, glow: null, glowAlpha: 0.7 * kick, trail: kick, impact: Math.max(0, Math.min(1, u.hitT / (u.hitDuration || 0.35))) };
  if (action) {
    if (action === 'cast' || action === 'heal' || action === 'bless') {
      pose.state = action; pose.angle = u.face - 0.6 * kick; pose.reach = 3 * kick; pose.bob += 3 * kick; pose.glow = action === 'cast' ? '#b398ff' : '#7dff9a';
    } else if (action === 'volley' || action === 'attack' && s.weapon === 'bow') {
      pose.state = 'shoot'; pose.angle = u.face; pose.pull = 0.7 * kick; pose.reach = -3 * kick; pose.lean = -0.12 * Math.cos(u.face) * kick;
    } else if (action === 'spin') {
      pose.state = 'spin'; pose.angle = u.face + Math.PI * 2 * p; pose.lean = 0.12 * Math.sin(p * Math.PI * 2);
    } else if (u.category === 'spear' || s.weapon === 'lance' || s.weapon === 'spear') {
      pose.state = 'thrust'; pose.angle = u.face + 0.9 * (1 - kick); pose.reach = 12 * kick; pose.lean = 0.12 * Math.cos(u.face) * kick;
    } else {
      pose.state = 'slash'; pose.angle = u.face - 1.1 + 2 * p; pose.reach = 5 * kick; pose.lean = 0.16 * Math.cos(u.face) * kick;
    }
  }
  if (u.dashQ && u.dashQ.length) { pose.state = 'dash'; pose.angle = u.face; pose.reach = 10; pose.lean = 0.22 * Math.cos(u.face); pose.bob = Math.abs(Math.sin(t * 24)) * 3; }
  if (u.hitT > 0 || u.stun > 0 || u.knockQ && u.knockQ.length) { pose.state = u.hitState > 0 ? 'guard' : 'hurt'; pose.angle = u.face + (pose.state === 'guard' ? -0.5 : 1.5); pose.reach = -3; pose.glow = null; pose.lean = 0; }
  return pose;
}

// TKC drawBody 축약: 타원 몸통 + 원 머리 + 띠, 영웅별 장식 플래그.
function drawBody(g, x, y, r, face, s, o = {}) {
  const pose = o.pose;
  g.save();
  if (pose) { g.translate(x, y); g.rotate(pose.lean); g.translate(-x, -y); o = { ...o, weaponAng: pose.angle, bob: pose.bob }; }
  const cx = Math.cos(face), sy = Math.sin(face), f = o.flash, W = '#fff', bulk = s.bulk || 1;
  if (s.horse) { drawHorse(g, x, y, r * 1.1, face, f ? W : s.horse, o.t || 0, o.moving); y -= r * 0.6; }
  const by = y - r * 0.9 - (o.bob || 0), hy = by - r * 1.15;
  const wp = s.weapon ? { ang: o.weaponAng != null ? o.weaponAng : face + 0.9, len: o.weaponLen || 80 } : null;
  g.save(); if (o.alpha != null) g.globalAlpha = o.alpha;
  if (!s.horse) { g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(x, y + r * 0.35, r * 1.15, r * 0.55, 0, 0, TAU); g.fill(); }
  if (pose && !s.horse) { g.strokeStyle = f ? W : '#242332'; g.lineWidth = r * 0.32; g.lineCap = 'round'; for (const side of [-1, 1]) { g.beginPath(); g.moveTo(x + side * r * 0.4, y - r * 0.5); g.lineTo(x + side * r * 0.4 + cx * pose.stride * side * r * 0.45, y + r * 0.25 + sy * pose.stride * side * r * 0.3); g.stroke(); } }
  if (wp && sy < 0) drawWeapon(g, s.weapon, x + cx * (r * 0.3 + (pose?.reach || 0)), by + r * 0.2 + sy * (pose?.reach || 0), wp.ang, wp.len, r, s.weaponScale ?? 1, s.tassel, pose?.pull || 0);
  if (s.longHair) { g.fillStyle = f ? W : '#1e1624'; g.beginPath(); g.ellipse(x - cx * r * 0.1, hy + r * 1.0, r * 0.72, r * 1.45, 0, 0, TAU); g.fill(); }
  g.fillStyle = f ? W : s.body; g.beginPath(); g.ellipse(x, by, r * 0.9 * bulk, r * 1.15, 0, 0, TAU); g.fill();
  if (s.pauldrons) { g.fillStyle = f ? W : s.trim; for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(x + sd * r * 0.82, by - r * 0.45, r * 0.34, r * 0.26, sd * 0.4, 0, TAU); g.fill(); } }
  if (s.cape) { g.fillStyle = f ? W : s.cape; g.beginPath(); g.moveTo(x - r * 0.9, by - r * 0.3); g.quadraticCurveTo(x - cx * r * 1.4, by + r * 1.6, x, by + r * 1.3); g.quadraticCurveTo(x + cx * r * 1.4, by + r * 1.6, x + r * 0.9, by - r * 0.3); g.fill(); }
  if (s.armorPlate) { g.fillStyle = f ? W : s.armorPlate; g.beginPath(); g.ellipse(x, by - r * 0.15, r * 0.58 * bulk, r * 0.72, 0, 0, TAU); g.fill(); }
  if (s.fur) { g.fillStyle = f ? W : '#eee9df'; for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(x + sd * r * 0.68, by - r * 0.5, r * 0.45, r * 0.34, sd * 0.35, 0, TAU); g.fill(); } }
  g.fillStyle = f ? W : s.trim; g.fillRect(x - r * 0.88 * bulk, by + r * 0.05, r * 1.76 * bulk, r * 0.24);
  if (s.sleeves) { const sw = Math.sin((o.t || 0) * 3) * r * 0.25; g.lineCap = 'round'; for (const sd of [-1, 1]) { g.strokeStyle = f ? W : s.sleeves; g.lineWidth = r * 0.42; g.beginPath(); g.moveTo(x + sd * r * 0.85, by - r * 0.35); g.quadraticCurveTo(x + sd * r * 1.75, by + r * 0.2 + sw * sd, x + sd * r * 1.4, by + r * 1.35 + sw * sd * 0.5); g.stroke(); } }
  g.fillStyle = f ? W : s.skin; circle(g, x, hy, r * 0.6);
  if (s.helm) {
    g.fillStyle = f ? W : (s.helmColor || '#1c1c26'); g.beginPath(); g.arc(x, hy, r * 0.66, Math.PI, TAU); g.fill();
    if (s.plume) { const q = s.plume; g.fillStyle = f ? W : (s.plumeColor || '#c9302c'); g.beginPath(); g.moveTo(x - r * 0.14, hy - r * 0.62); g.quadraticCurveTo(x - r * 0.55 * q, hy - r * 1.05 * q, x + r * 0.02, hy - r * (0.7 + 0.65 * q)); g.quadraticCurveTo(x + r * 0.08, hy - r * 0.95, x + r * 0.16, hy - r * 0.62); g.closePath(); g.fill(); }
    if (s.feathers) { g.strokeStyle = f ? W : '#c9302c'; g.lineWidth = 4; g.beginPath(); g.moveTo(x - r * 0.3, hy - r * 0.5); g.quadraticCurveTo(x - r * 1.2, hy - r * 2.2, x - r * 0.6, hy - r * 2.9); g.moveTo(x + r * 0.3, hy - r * 0.5); g.quadraticCurveTo(x + r * 1.2, hy - r * 2.2, x + r * 0.6, hy - r * 2.9); g.stroke(); }
    if (s.horns) { g.strokeStyle = f ? W : s.trim; g.lineWidth = r * 0.16; g.beginPath(); g.moveTo(x - r * 0.45, hy - r * 0.45); g.quadraticCurveTo(x - r * 1.05, hy - r * 0.9, x - r * 0.92, hy - r * 1.35); g.moveTo(x + r * 0.45, hy - r * 0.45); g.quadraticCurveTo(x + r * 1.05, hy - r * 0.9, x + r * 0.92, hy - r * 1.35); g.stroke(); }
  }
  if (s.stripes) { g.strokeStyle = f ? W : s.stripes; g.lineWidth = Math.max(2, r * 0.2); g.lineCap = 'butt'; g.beginPath(); for (const o of [-0.5, 0, 0.5]) { g.moveTo(x + (o - 0.18) * r, by - r * 0.85); g.lineTo(x + (o + 0.18) * r, by + r * 0.05); } g.stroke(); }
  if (s.tigerEars) { g.fillStyle = f ? W : s.stripes; g.strokeStyle = '#1c2230'; g.lineWidth = 1.5; for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(x + sd * r * 0.2, hy - r * 0.55); g.lineTo(x + sd * r * 0.85, hy - r * 1.35); g.lineTo(x + sd * r * 0.8, hy - r * 0.3); g.closePath(); g.fill(); g.stroke(); } }
  if (s.strawHat) { g.fillStyle = f ? W : '#d2b06a'; g.strokeStyle = '#1c2230'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, hy - r * 1.55); g.lineTo(x + r * 1.15, hy - r * 0.25); g.lineTo(x - r * 1.15, hy - r * 0.25); g.closePath(); g.fill(); g.stroke(); }
  if (s.beard) { g.fillStyle = f ? W : (s.beardColor || '#17171b'); g.beginPath(); g.moveTo(x - r * 0.5, hy + r * 0.1); g.quadraticCurveTo(x, hy + r * 1.7, x + r * 0.5, hy + r * 0.1); g.quadraticCurveTo(x, hy + r * 0.35, x - r * 0.5, hy + r * 0.1); g.fill(); }
  if (s.hair) { g.fillStyle = f ? W : '#2b2433'; g.beginPath(); g.arc(x, hy - r * 0.04, r * 0.64, Math.PI, TAU); g.fill(); g.strokeStyle = f ? W : '#2b2433'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - cx * r * 0.2, hy - r * 0.3); g.quadraticCurveTo(x - cx * r * 1.1, hy - r * 0.1, x - cx * r * 1.3, hy + r * 0.7); g.stroke(); }
  if (s.shield) { g.fillStyle = f ? W : s.trim; g.strokeStyle = '#1c2230'; g.lineWidth = 2; g.beginPath(); if (s.towerShield) g.rect(x + cx * r * 0.95 - r * 0.65, by - r, r * 1.3, r * 2.2); else g.ellipse(x + cx * r * 0.95, by + 2, r * 0.5, r * 1.0, 0, 0, TAU); g.fill(); g.stroke(); }
  if (s.band) { g.fillStyle = f ? W : '#c9cfd8'; g.fillRect(x - r * 0.62, hy - r * 0.3, r * 1.24, r * 0.15); g.fillStyle = f ? W : '#3a8be0'; circle(g, x, hy - r * 0.225, r * 0.1); }
  if (s.hat) { g.fillStyle = f ? W : '#2a6b44'; g.beginPath(); g.arc(x, hy - r * 0.1, r * 0.64, Math.PI * 1.02, TAU * 0.999); g.fill(); g.fillStyle = f ? W : '#d4a73a'; g.fillRect(x - r * 0.64, hy - r * 0.18, r * 1.28, r * 0.12); }
  if (s.wrap) { g.fillStyle = f ? W : (s.wrapColor || '#b3281f'); g.beginPath(); g.arc(x, hy - r * 0.08, r * 0.68, Math.PI * 0.98, TAU + 0.04); g.fill(); }
  if (s.hairCap) { g.fillStyle = f ? W : '#1e1624'; g.beginPath(); g.arc(x, hy - r * 0.04, r * 0.66, Math.PI * 0.95, TAU + 0.05); g.fill(); }
  if (s.courtHat) { g.fillStyle = f ? W : '#171923'; g.beginPath(); g.moveTo(x - r * 0.5, hy - r * 0.45); g.lineTo(x - r * 0.58, hy - r * 1.38); g.lineTo(x + r * 0.58, hy - r * 1.38); g.lineTo(x + r * 0.5, hy - r * 0.45); g.closePath(); g.fill(); g.strokeStyle = f ? W : s.trim; g.lineWidth = 2; g.stroke(); }
  if (s.crown) { g.fillStyle = f ? W : COLORS.gold; g.beginPath(); g.moveTo(x - r * 0.5, hy - r * 0.5); g.lineTo(x - r * 0.42, hy - r * 1.0); g.lineTo(x - r * 0.2, hy - r * 0.72); g.lineTo(x, hy - r * 1.14); g.lineTo(x + r * 0.2, hy - r * 0.72); g.lineTo(x + r * 0.42, hy - r * 1.0); g.lineTo(x + r * 0.5, hy - r * 0.5); g.closePath(); g.fill(); }
  if (s.flower) { g.fillStyle = f ? W : '#ff9ac8'; for (let k = 0; k < 5; k++) { const an = k * TAU / 5 - 1.2; circle(g, x + r * 0.58 + Math.cos(an) * r * 0.2, hy - r * 0.4 + Math.sin(an) * r * 0.2, r * 0.17); } }
  g.fillStyle = '#111'; for (const sd of [-1, 1]) circle(g, x + sd * r * 0.24 + cx * r * 0.14, hy + sy * r * 0.1 + r * 0.02, r * 0.075);
  if (s.eyePatch) { g.strokeStyle = f ? W : '#17151a'; g.lineWidth = r * 0.12; g.beginPath(); g.moveTo(x - r * 0.58, hy - r * 0.2); g.lineTo(x + r * 0.56, hy + r * 0.12); g.stroke(); g.fillStyle = f ? W : '#17151a'; circle(g, x - r * 0.2 + cx * r * 0.14, hy + sy * r * 0.1, r * 0.18); }
  if (wp && sy >= 0) drawWeapon(g, s.weapon, x + cx * (r * 0.3 + (pose?.reach || 0)), by + r * 0.2 + sy * (pose?.reach || 0), wp.ang, wp.len, r, s.weaponScale ?? 1, s.tassel, pose?.pull || 0);
  if (pose?.glow) {
    g.save(); g.globalAlpha *= pose.glowAlpha; g.strokeStyle = pose.glow; g.lineWidth = 2;
    const ex = x + cx * r * 1.3, ey = by + sy * r, radius = r * (1.6 - pose.glowAlpha);
    g.beginPath(); g.arc(ex, ey, radius, 0, TAU); g.stroke();
    for (let i = 0; i < 4; i++) { const a = face + i * TAU / 4; g.beginPath(); g.moveTo(ex + Math.cos(a) * radius * 1.2, ey + Math.sin(a) * radius * 1.2); g.lineTo(ex + Math.cos(a) * radius * 1.6, ey + Math.sin(a) * radius * 1.6); g.stroke(); }
    g.restore();
  }
  if (pose && ['guard', 'hurt'].includes(pose.state)) {   // 색 없이도 구분: 방어=방패 마름모(채움+굵은 테두리), 피격=뾰족한 충격 별 (v0.1.264)
    const guard = pose.state === 'guard', ex = x + cx * r, ey = by + sy * r, k = Math.max(0.6, pose.impact), R = r * (guard ? 1.25 : 1.4);
    g.save(); g.globalAlpha *= k; g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = '#1c2230'; g.fillStyle = guard ? '#b4e8ff' : '#ffe27a';
    g.beginPath();
    if (guard) { g.moveTo(ex, ey - R); g.lineTo(ex + R * 0.8, ey); g.lineTo(ex, ey + R * 1.15); g.lineTo(ex - R * 0.8, ey); g.closePath(); }
    else { for (let i = 0; i < 16; i++) { const a = face + i * TAU / 16, d = i % 2 ? R * 0.4 : R; i ? g.lineTo(ex + Math.cos(a) * d, ey + Math.sin(a) * d) : g.moveTo(ex + Math.cos(a) * d, ey + Math.sin(a) * d); } g.closePath(); }
    g.stroke(); g.fill(); g.restore();
  }
  if (pose && ['slash', 'thrust', 'dash'].includes(pose.state)) {
    g.save(); g.globalAlpha *= pose.state === 'dash' ? 0.45 : pose.trail * 0.6; g.strokeStyle = '#ffe9a0'; g.lineWidth = 2; g.beginPath();
    if (pose.state === 'slash') g.arc(x, by, r * 2, pose.angle - 0.7, pose.angle + 0.3);
    else { for (const side of [-1, 1]) { const ex = x - sy * side * r, ey = by + cx * side * r; g.moveTo(ex - cx * r * 1.8, ey - sy * r * 1.8); g.lineTo(ex + cx * r * 0.5, ey + sy * r * 0.5); } }
    g.stroke(); g.restore();
  }
  g.restore();
  g.restore();
}

// 전투 전용: 정수 픽셀만 칠한다. 기존 drawBody는 타이틀·전략 장수 상세에 유지한다.
function pixelLine(g, x, y, xx, yy, col, width = 1) {
  x = Math.round(x); y = Math.round(y); xx = Math.round(xx); yy = Math.round(yy);
  const dx = Math.abs(xx - x), dy = -Math.abs(yy - y), sx = x < xx ? 1 : -1, sy = y < yy ? 1 : -1; let err = dx + dy;
  g.fillStyle = col;
  for (;;) { g.fillRect(x, y, width, width); if (x === xx && y === yy) break; const e = err * 2; if (e >= dy) { err += dy; x += sx; } if (e <= dx) { err += dx; y += sy; } }
}
function pixelPoly(g, pts, col) {
  g.fillStyle = col;
  const lo = Math.floor(Math.min(...pts.map(p => p[1]))), hi = Math.ceil(Math.max(...pts.map(p => p[1])));
  for (let y = lo; y < hi; y++) {
    const edges = [];
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] <= y + 0.5 && b[1] > y + 0.5) || (b[1] <= y + 0.5 && a[1] > y + 0.5)) edges.push(a[0] + (y + 0.5 - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); }
    edges.sort((a, b) => a - b);
    for (let i = 0; i + 1 < edges.length; i += 2) { const x = Math.ceil(edges[i]); g.fillRect(x, y, Math.max(0, Math.ceil(edges[i + 1]) - x), 1); }
  }
}
const PIXEL_SPRITES = new Map();
function drawBattleBody(g, x, y, r, face, s, o = {}) {
  const dir = (Math.round(face / (Math.PI / 2)) % 4 + 4) % 4, walk = o.moving ? Math.floor((o.t || 0) * 7) % 2 : 0, pose = o.pose;
  const state = pose ? pose.state : o.moving ? 'move' : 'idle', phase = Math.min(2, Math.floor((pose?.trail || pose?.impact || 0) * 3));
  const angle = Math.round((pose?.angle ?? o.weaponAng ?? face + 0.7) / (Math.PI / 4)), reach = Math.round((pose?.reach || 0) / 4);
  const key = JSON.stringify(s) + [dir, walk, state, phase, angle, reach, Math.round((o.weaponLen||48)/4), !!o.flash].join('/');
  let c = PIXEL_SPRITES.get(key);
  if (!c) {
    c = document.createElement('canvas'); c.width = 88; c.height = 80; const p = c.getContext('2d'), ink = '#18201e', white = '#fff4d6'; p.translate(12,0);
    const rect = (x, y, w, h, col) => { p.fillStyle = o.flash ? white : col; p.fillRect(x, y, w, h); };
    const line = (x, y, xx, yy, col, w = 1) => pixelLine(p, x, y, xx, yy, o.flash ? white : col, w);
    const poly = (pts, col) => pixelPoly(p, pts, o.flash ? white : col);
    const back = dir === 3, left = dir === 2, bob = walk && !s.horse ? 1 : 0, hy = (s.horse ? 20 : 26) - bob, by = hy + 12, wide = s.bulk > 1.1 ? 1 : 0;
    if (left) { p.translate(64, 0); p.scale(-1, 1); }
    rect(23, 52, 20, 2, '#30782b'); rect(20, 51, 25, 1, '#30782b');
    if (s.horse) {
      poly([[16,39],[20,35],[38,35],[41,29],[47,30],[50,36],[47,41],[42,41],[41,47],[20,48],[16,44]], ink);
      poly([[18,39],[21,37],[38,37],[42,31],[46,32],[48,36],[45,39],[40,39],[39,45],[21,46],[18,43]], s.horse);
      poly([[39,39],[40,30],[44,27],[49,28],[50,31],[55,33],[55,38],[49,40],[44,38]],ink);
      poly([[41,37],[42,31],[45,29],[48,30],[48,33],[53,34],[53,37],[48,38],[44,36]],s.horse);
      rect(20, 38, 17, 3, '#bd8958'); rect(24, 39, 10, 7, s.cape || s.body); rect(26, 40, 7, 1, s.trim);
      for (const [lx, step] of [[20,walk],[26,1-walk],[35,walk],[40,1-walk]]) { rect(lx, 45, 3, 7 - step, ink); rect(lx, 46, 2, 4 - step, s.horse); rect(lx - step, 51 - step, 4, 2, ink); }
      line(18,39,13,46,ink,2); line(13,46,12,49,ink,2); line(40,32,43,30,ink,2); rect(47,31,1,1,white); rect(52,35,1,1,ink); line(47,33,51,37,s.trim); line(51,37,34,37,s.trim);
    } else { rect(25, by + 9, 5, 9 - walk, ink); rect(33, by + 9, 5, 8 + walk, ink); rect(25, by + 9, 4, 4, '#79634d'); rect(34, by + 9, 3, 4, '#79634d'); }
    if (s.cape || s.longHair) poly([[24,by],[39,by],[42,by+13],[35,by+11],[25,by+14],[21,by+10]], s.cape || '#272337');
    rect(24-wide, by-1, 16+wide*2, 12, ink); rect(25-wide, by, 14+wide*2, 10, s.body); rect(26, by, 3, 8, s.trim);
    rect(27, by+3, 10, 1, s.trim); rect(26, by+7, 12, 2, s.trim); rect(31, by+7, 2, 2, '#ffdf75');
    if (s.armorPlate) { rect(29,by+1,7,6,s.armorPlate); line(29,by+3,35,by+3,ink); }
    if (s.stripes) for (let i=0;i<3;i++) rect(30+i*2,by+1,1,5,s.stripes);
    rect(21-wide,by,4,7,ink); rect(22-wide,by+1,3,5,s.sleeves||s.body); rect(39+wide,by,4,7,ink); rect(39+wide,by+1,3,5,s.sleeves||s.body);
    if (s.pauldrons || s.fur) { rect(22-wide,by-1,5,3,s.fur?'#eee6c6':s.trim); rect(37+wide,by-1,5,3,s.fur?'#eee6c6':s.trim); }
    // 큰 머리·짧은 몸통과 1픽셀 윤곽으로 원본 참고 이미지의 SD 비율을 맞춘다.
    poly([[27,hy-1],[37,hy-1],[40,hy+2],[40,hy+9],[37,hy+12],[27,hy+12],[24,hy+9],[24,hy+2]],ink);
    rect(26,hy+2,12,8,s.skin); rect(28,hy+1,8,10,s.skin); rect(27,hy+3,3,5,'#ffe2b1');
    if (back) { rect(25,hy,14,10,s.helmColor||'#292638'); rect(27,hy+1,9,2,s.trim); }
    else { rect(29,hy+6,2,2,ink); rect(35,hy+6,2,2,ink); rect(33,hy+8,2,1,'#b57353'); rect(30,hy+10,5,1,ink); }
    if (s.helm) { rect(25,hy,14,4,s.helmColor||'#53596a'); rect(27,hy-2,10,3,s.helmColor||'#53596a'); rect(27,hy-1,6,1,'#aab9c3'); rect(25,hy+3,14,1,s.trim); rect(25,hy+3,2,5,s.helmColor||ink); }
    if (s.hair || s.hairCap || s.longHair) { rect(26,hy-1,12,4,'#292337'); rect(25,hy+2,2,6,'#292337'); }
    if (s.hat) { rect(26,hy-3,12,6,'#247142'); rect(25,hy+2,14,2,s.trim); }
    if (s.courtHat) { rect(27,hy-7,10,9,ink); rect(28,hy-6,1,6,s.trim); rect(24,hy,17,2,ink); }
    if (s.wrap) { rect(25,hy-1,14,4,s.wrapColor||'#b6372e'); line(25,hy+1,21,hy+6,s.wrapColor||'#b6372e',2); }
    if (s.band) rect(25,hy+3,14,2,'#dbe5df');
    if (s.beard && !back) poly([[28,hy+8],[37,hy+8],[35,hy+15],[32,hy+17],[29,hy+14]],s.beardColor||'#242127');
    if (s.eyePatch && !back) { line(26,hy+4,38,hy+8,ink); rect(28,hy+5,4,3,ink); }
    if (s.plume && !s.feathers) { line(32,hy-2,34,hy-7-Math.round(s.plume),s.plumeColor||'#c13c32',2); }
    if (s.feathers) for (const side of [-1,1]) { const xx=32+side*3; line(xx,hy-2,xx+side*5,hy-12,'#261f24',3); line(xx,hy-3,xx+side*5,hy-13,'#d63836',2); line(xx+side*5,hy-13,xx+side*2,hy-16,'#d63836',2); }
    if (s.crown || s.horns || s.tigerEars) { rect(26,hy-4,3,4,s.tigerEars?'#e99435':s.trim); rect(36,hy-4,3,4,s.tigerEars?'#e99435':s.trim); if(s.crown)rect(31,hy-6,3,5,'#ffe477'); }
    if (s.flower) { rect(37,hy+1,4,4,'#ff7cb3'); rect(38,hy+2,2,2,'#ffe477'); }
    if (s.strawHat) { poly([[31,hy-5],[43,hy+3],[22,hy+3]],ink); poly([[31,hy-4],[40,hy+2],[25,hy+2]],'#d9ba6b'); rect(23,hy+3,19,2,'#f5d987'); }
    if (s.shield) { const h=s.towerShield?14:10; rect(19,by+2,8,h,ink); rect(20,by+3,6,h-2,s.trim); rect(22,by+4,1,h-4,'#eef2df'); }
    if(s.weapon==='twin')for(const hx of [23,41]){line(hx,by+8,hx+2,by-10,ink,3);line(hx,by+8,hx+2,by-10,'#a77542');poly([[hx+1,by-10],[hx+7,by-7],[hx+2,by-3]],'#dce7e3');rect(hx-1,by+4,3,3,s.skin);}
    if (s.weapon && s.weapon!=='twin') {
      let a=angle*Math.PI/4; if(left)a=Math.PI-a;
      const dx=Math.cos(a), dy=Math.sin(a), nx=-dy, ny=dx, hx=38+reach, yy=by+5, len=Math.round((s.weapon==='fan'?18*(s.weaponScale||1):s.weapon==='bow'?10:s.weapon==='crossbow'?14:s.weapon==='sword'?18:24)*(o.weaponLen?Math.min(1.2,o.weaponLen/48):1));
      const tx=hx+dx*len, ty=yy+dy*len;
      line(hx-dx*5,yy-dy*5,tx,ty,ink,3); line(hx-dx*4,yy-dy*4,tx,ty,'#a77542',1);
      if (s.weapon==='bow'||s.weapon==='crossbow') { const R=s.weapon==='crossbow'?9:7,pull=3+(state==='shoot'?phase*2:0); line(hx+nx*R,yy+ny*R,hx+dx*5,yy+dy*5,'#d6b26d',2); line(hx+dx*5,yy+dy*5,hx-nx*R,yy-ny*R,'#d6b26d',2); line(hx+nx*R,yy+ny*R,hx-dx*pull,yy-dy*pull,white); line(hx-dx*pull,yy-dy*pull,hx-nx*R,yy-ny*R,white); }
      else if(s.weapon==='fan') { poly([[hx,yy],[tx+nx*6,ty+ny*6],[tx+dx*4,ty+dy*4],[tx-nx*6,ty-ny*6]],'#f0dba4'); }
      else { const blade=s.weapon==='sword'?10:6; line(tx-dx*blade,ty-dy*blade,tx,ty,'#dce7e3',2); if(['glaive','halberd','axe','twin'].includes(s.weapon)){line(tx-dx*5+nx*5,ty-dy*5+ny*5,tx+dx*2,ty+dy*2,'#dce7e3',3);if(s.weapon==='halberd'||s.weapon==='twin')line(tx-dx*5-nx*5,ty-dy*5-ny*5,tx+dx*2,ty+dy*2,'#aebfc9',2);}else {line(tx-dx*4+nx*2,ty-dy*4+ny*2,tx+dx*2,ty+dy*2,white);line(tx-dx*4-nx*2,ty-dy*4-ny*2,tx+dx*2,ty+dy*2,white);} }
      rect(hx-1,yy,3,3,s.skin);
    }
    if (['cast','heal','bless'].includes(state)) { const col=state==='cast'?'#b398ff':'#7dff9a', R=5+phase; line(43-R,by,43+R,by,col);line(43,by-R,43,by+R,col);rect(42,by-1,3,3,white); }
    if (state==='guard') { poly([[42,by-2],[48,by+2],[46,by+9],[42,by+12],[38,by+9],[36,by+2]],ink); poly([[42,by],[46,by+3],[44,by+8],[42,by+10],[40,by+8],[38,by+3]],'#b4e8ff'); }
    if (state==='hurt') for(let i=0;i<8;i++){const a=i*TAU/8;line(43+Math.cos(a)*3,by+Math.sin(a)*3,43+Math.cos(a)*(7+phase),by+Math.sin(a)*(7+phase),'#ffe27a',2);}
    if (['slash','thrust','spin','dash'].includes(state)) { line(42,by-4,48+phase*2,by-9,'#ffe9a0',2); if(state==='dash')for(let i=0;i<3;i++)line(14,40+i*4,22,40+i*4,'#ffe9a0'); }
    // 최대 512장(픽셀 약 14MiB)으로 제한해 다수 유닛의 짧은 자세를 무한히 쌓지 않는다.
    if (PIXEL_SPRITES.size >= 512) PIXEL_SPRITES.delete(PIXEL_SPRITES.keys().next().value);
    PIXEL_SPRITES.set(key,c);
  }
  const scale = r / 12; g.save(); g.imageSmoothingEnabled=false;
  if(o.alpha!=null)g.globalAlpha*=o.alpha;
  g.drawImage(c,Math.round(x-44*scale),Math.round(y-54*scale),88*scale,80*scale); g.restore();
}

function drawBattleEffect(g, f, t) {
  const p=Math.max(0,Math.min(1,1-f.t/f.max));
  g.save(); g.globalAlpha*=1-p;
  if(f.kind==='fall') {
    const e=1-(1-p)**2;g.translate(Math.round(f.x+Math.cos(f.ang)*14*e),Math.round(f.y+Math.sin(f.ang)*8*e));g.rotate(p>0.25?(Math.cos(f.ang)>=0?1:-1)*Math.PI/2:0);
    drawBattleBody(g,0,0,f.r*1.15,f.face,{...STYLES[f.style],weapon:null},{flash:p<0.15,t});g.restore();return;
  }
  g.translate(Math.round(f.x/2)*2,Math.round(f.y/2)*2);g.scale(2,2);
  const line=(x,y,xx,yy,col=f.col||'#ffe8a0',w=1)=>pixelLine(g,x,y,xx,yy,col,w), rect=(x,y,w,h,col)=>{g.fillStyle=col;g.fillRect(Math.round(x),Math.round(y),w,h);};
  const ring=(rx,ry,col)=>{for(let i=0;i<16;i++){const a=i*TAU/16,b=(i+1)*TAU/16;line(Math.cos(a)*rx,Math.sin(a)*ry,Math.cos(b)*rx,Math.sin(b)*ry,col);}};
  if(f.kind==='spark') {for(let i=0;i<(f.count||6);i++){const a=f.ang+(i-((f.count||6)-1)/2)*0.55;line(Math.cos(a)*(3+p*4),Math.sin(a)*(3+p*4),Math.cos(a)*(6+p*13),Math.sin(a)*(6+p*13));}rect(-1,-1,2,2,'#fff4da');}
  else if(f.kind==='guard') {pixelPoly(g,[[0,-7],[7,-4],[5,4],[0,8],[-5,4],[-7,-4]],'#18201e');pixelPoly(g,[[0,-5],[5,-3],[3,3],[0,6],[-3,3],[-5,-3]],f.col||'#b4e8ff');}
  else if(f.kind==='ring')ring(f.r/2*(0.4+0.6*p),f.r/2*(0.4+0.6*p)*0.6,f.col);
  else if(f.kind==='buff') {
    ring(f.r/2*(1.2+p*1.6),f.r/4*(1.2+p*1.6),f.col);const y=-f.r-p*12;
    if(f.glyph==='atk'||f.glyph==='down'){const d=f.glyph==='atk'?-1:1;for(let i=0;i<3;i++){line(-4,y+i*4,0,y+i*4+d*3);line(0,y+i*4+d*3,4,y+i*4);}}
    else if(f.glyph==='guard')pixelPoly(g,[[0,y-5],[5,y-2],[3,y+4],[0,y+6],[-3,y+4],[-5,y-2]],f.col);
    else if(f.glyph==='all')for(let i=-1;i<=1;i++){const x=i*6,yy=y+(i?2:-3);pixelPoly(g,[[x,yy-4],[x+1,yy-1],[x+4,yy],[x+1,yy+1],[x,yy+4],[x-1,yy+1],[x-4,yy],[x-1,yy-1]],f.col);}
    else for(let i=-1;i<=1;i++){const x=i*6,yy=y+(i?2:-3);line(x-2,yy,x+2,yy);line(x,yy-2,x,yy+2);}
  } else for(let i=0;i<6;i++)rect(Math.cos(i*2.4)*(3+p*6),Math.sin(i*2.4)*(2+p*3),2,1,'#6e7842');
  g.restore();
}
function drawBattleProjectile(g,p) {
  g.save();g.translate(Math.round(p.x/2)*2,Math.round(p.y/2)*2);g.scale(2,2);
  const dx=Math.cos(p.a),dy=Math.sin(p.a),col=p.col||'#9fe8ff';
  if(p.kind==='arrow'){pixelLine(g,0,0,-dx*8,-dy*8,'#493627',2);pixelLine(g,0,0,-dx*7,-dy*7,p.team==='player'?'#e8f4ff':'#ffc9b8');pixelLine(g,-dx*2-dy*2,-dy*2+dx*2,dx,dy,'#fff4d6');}
  else {const y=p.kind==='roll'?5:0,R=p.kind==='pierce'?5:4;pixelLine(g,-dx*(p.kind==='pierce'?18:10),y-dy*(p.kind==='pierce'?18:10),0,y,col,2);pixelPoly(g,[[-R+1,y-R],[R-1,y-R],[R+1,y-1],[R,y+R-1],[0,y+R],[-R,y+R-1],[-R-1,y]],'#18201e');pixelPoly(g,[[-R+2,y-R+1],[R-2,y-R+1],[R,y],[R-1,y+R-2],[-R+1,y+R-2],[-R,y]],col);g.fillStyle=p.kind==='ball'||p.kind==='roll'?'#ffe59a':'#e3fff2';g.fillRect(-1,y-2,2,2);}
  g.restore();
}
function drawBattleRing(g,x,y,rx,ry,col,dashed=false) {
  g.save();g.translate(Math.round(x/2)*2,Math.round(y/2)*2);g.scale(2,2);
  for(let i=0;i<32;i++){if(dashed&&i%2)continue;const a=i*TAU/32,b=(i+1)*TAU/32;pixelLine(g,Math.cos(a)*rx/2,Math.sin(a)*ry/2,Math.cos(b)*rx/2,Math.sin(b)*ry/2,col);}
  g.restore();
}

// map: 0 풀 1 숲 2 바위 3 강 4 여울. 판정 격자는 유지하고 2px 도트로만 그린다.
function buildTerrain(map, MW, MH, TILE) {
  const c = document.createElement('canvas'); c.width = MW * TILE; c.height = MH * TILE; const g = c.getContext('2d');
  let s = 12345; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  g.scale(2,2); const tile=TILE/2;
  g.fillStyle = '#49b72e'; g.fillRect(0,0,c.width/2,c.height/2);
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
    const t=map[ty*MW+tx],x=tx*tile,y=ty*tile;
    if(t===3||t===4){g.fillStyle=t===3?'#397d9c':'#c4ac68';g.fillRect(x,y,tile,tile);}
    for(let i=0;i<7;i++){g.fillStyle=t===3?(i%2?'#67b4c0':'#2f668b'):t===4?(i%2?'#e2ce8d':'#9b9158'):(i%2?'#399c2a':'#64c53b');g.fillRect(x+Math.floor(r()*tile),y+Math.floor(r()*tile),t===3?3:1,1);}
    if(t===1){g.fillStyle='#4d4327';g.fillRect(x+6,y+11,4,5);pixelPoly(g,[[x+4,y],[x+12,y],[x+16,y+4],[x+16,y+10],[x+12,y+14],[x+3,y+14],[x,y+10],[x,y+4]],'#1e5427');pixelPoly(g,[[x+4,y+1],[x+11,y+1],[x+15,y+5],[x+14,y+10],[x+10,y+12],[x+3,y+11],[x+1,y+8],[x+2,y+4]],'#258b30');for(let i=0;i<9;i++){g.fillStyle=i%2?'#65c43b':'#3eac30';g.fillRect(x+3+Math.floor(r()*9),y+2+Math.floor(r()*8),2,1);}}
    if(t===2){pixelPoly(g,[[x+4,y+3],[x+10,y+1],[x+14,y+6],[x+16,y+13],[x+12,y+15],[x+2,y+14],[x,y+10]],'#384c43');pixelPoly(g,[[x+4,y+4],[x+10,y+2],[x+13,y+7],[x+13,y+12],[x+3,y+13],[x+1,y+9]],'#8a9990');pixelPoly(g,[[x+4,y+4],[x+9,y+3],[x+11,y+7],[x+5,y+8],[x+2,y+10]],'#c4c9b0');}
  }
  return c;
}
