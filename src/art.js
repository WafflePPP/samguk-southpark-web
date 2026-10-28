'use strict';
// 그래픽 출처: 삼국 맹장전(TKC) 아트방향.md 팔레트 + 91-render-world.js drawBody/drawHorse 도형 규칙을 이 프로젝트용으로 축약 이식.
// 캐릭터는 전투 PNG를 모든 화면에서 공유하고, 표시·효과는 캔버스로 그린다.
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
  f_xian: { base: 'shield', armorPlate: '#54515a', helmColor: '#202126', enemyHelm: '#202126', plumeColor: '#e5e7eb', bulk: 1.1, towerShield: true },   // 여포 검정 투구 + 밝은 회색 깃털(검정만으론 어두워 보조색 병행), 몸통은 팀색(아군 청/적 암) — v0.1.279 세력 색 정렬
  f_bing: { base: 'cav', feathers: true, featherColor: '#202126', plumeColor: '#202126', helmColor: '#e5e7eb', weapon: 'lance', fixedWeapon: true },
  f_nu: { base: 'archer', helmColor: '#4a5a66', plumeColor: '#d2a82e', weapon: 'crossbow', weaponScale: 1.15 },
  f_ji: { base: 'sword', weapon: 'halberd', fixedWeapon: true, pauldrons: true, plumeColor: '#d2a82e' },
  f_qing: { base: 'sword', wrap: true, wrapColor: '#2e77c7', armorPlate: '#cce8ff', helm: false },
  f_hubao: { base: 'cav', plume: 1.8, plumeColor: '#2e77c7', armorPlate: '#54515a', fur: true, tigerEars: true, stripes: '#e8892a', bulk: 1.18, weapon: 'lance', fixedWeapon: true },
  f_bai: { base: 'sword', helmColor: '#f0ece0', plume: 1.4, plumeColor: '#329653', cape: '#329653', weapon: 'spear' },
  f_dan: { base: 'sword', helm: false, hairCap: true, band: true, bandGem: '#329653', sleeves: '#329653', strawHat: true },
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

const HERO_TRANSITIONS=new WeakMap();
function connectHeroPose(u,pose,t) {
  const key=pose.state+':'+battleDirection(u.face),sample={...pose},old=HERO_TRANSITIONS.get(u);
  let layers;
  if(!old||t<old.t||t-old.t>.5)layers=[{key,pose:sample,face:u.face,weight:1}];
  else {
    const mix=1-Math.exp(-Math.max(0,t-old.t)/.045);
    layers=old.layers.map(l=>({...l,weight:l.weight*(1-mix)}));
    const same=layers.find(l=>l.key===key);
    if(same){same.pose=sample;same.face=u.face;same.weight+=mix;}
    else if(mix>0)layers.push({key,pose:sample,face:u.face,weight:mix});
    layers=layers.filter(l=>l.weight>.001).sort((a,b)=>b.weight-a.weight).slice(0,4);
    const total=layers.reduce((n,l)=>n+l.weight,0);for(const l of layers)l.weight/=total;
  }
  HERO_TRANSITIONS.set(u,{t,layers});pose.layers=layers;return pose;
}
// 화면만 보간하며 공격·피격 판정과 타이머는 변경하지 않는다.
function heroPose(u, s, t) {
  if (!u.named) return null;
  const action = u.anim > 0 ? u.actionKind || 'attack' : '', duration = action === 'attack' || action === 'melee' ? 0.28 : 0.4;
  const p = Math.max(0, Math.min(1, 1 - u.anim / duration)), kick = action ? (1 - p) ** 2 : 0;
  const fleeing = u.order && ['retreat', 'flee'].includes(u.order.type);
  const gait = u.moving ? Math.sin(t * (fleeing ? 14 : 10) + u.id) : 0;
  const pose = { state: u.moving ? 'move' : 'idle', progress:p, walkFrame:Math.floor(t*8+(u.id||0)*.73)%4, angle: u.face + 0.9, reach: 0, lean: 0, bob: Math.abs(gait) * 2, stride: gait, pull: 0, glow: null, glowAlpha: 0.7 * kick, trail: kick, impact: Math.max(0, Math.min(1, u.hitT / (u.hitDuration || 0.35))) };
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
  pose.breath=Math.sin(t*2.2+(u.id||0))*.007;
  return connectHeroPose(u,pose,t);
}

// 로비·전략·상세도 전투와 같은 캐릭터 이미지를 사용한다.
function drawBody(g,x,y,r,face,s,o={}){drawBattleBody(g,x,y,r,face,s,o);}

// UI에서도 병과별 몸체 높이를 유지하며, 무기·말 전체가 칸 안에 들어가게 한다.
function drawBattlePortrait(g,x,y,w,h,s,o={}){
  if(!BATTLE_ART.ready)return;
  const model=BATTLE_ART.models.get(battleModelKey(s,o.team)),image=model?.idle?.[1]||model?.frames?.[0];if(!image)return;
  const ref=battleFrameHeight(image),foot=image.footX??image.width/2;
  const scale=Math.min(battleSpriteHeight(Math.min(w/6,h/5.4),s)/ref,Math.max(0,w/2-2)/Math.max(foot,image.width-foot),Math.max(0,h-4)/image.height);
  g.save();g.beginPath();g.rect(x,y,w,h);g.clip();
  drawBattleBody(g,x+w/2,y+h-2,scale*ref/battleSpriteHeight(1,s),Math.PI/4,s,{...o,pose:{state:'idle'}});
  g.restore();
}

// 효과 선은 정수 픽셀만 칠한다.
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

const BATTLE_ATLASES = [{"file":"units-0.png","view":"front","keys":["guan","lubu","zhao","diao","dian","huang","kong","ally_sword","ally_archer","ally_shield","ally_cav","mage"],"frames":[{"x":38,"y":97,"w":170,"h":190,"sx":64,"sy":97},{"x":271,"y":97,"w":180,"h":190,"sx":295,"sy":97},{"x":507,"y":42,"w":257,"h":248,"sx":609,"sy":42},{"x":773,"y":39,"w":253,"h":251,"sx":882,"sy":39},{"x":1058,"y":77,"w":185,"h":213,"sx":1141,"sy":77},{"x":1285,"y":77,"w":232,"h":213,"sx":1375,"sy":77},{"x":68,"y":343,"w":162,"h":180,"sx":139,"sy":343},{"x":288,"y":342,"w":173,"h":181,"sx":371,"sy":342},{"x":524,"y":349,"w":235,"h":173,"sx":626,"sy":349},{"x":772,"y":346,"w":243,"h":180,"sx":868,"sy":346},{"x":1071,"y":347,"w":173,"h":176,"sx":1141,"sy":347},{"x":1301,"y":352,"w":180,"h":171,"sx":1384,"sy":352},{"x":78,"y":579,"w":144,"h":161,"sx":131,"sy":579},{"x":300,"y":577,"w":166,"h":164,"sx":367,"sy":577},{"x":580,"y":590,"w":147,"h":146,"sx":633,"sy":590},{"x":818,"y":590,"w":152,"h":146,"sx":874,"sy":590},{"x":1099,"y":597,"w":152,"h":146,"sx":1150,"sy":597},{"x":1339,"y":599,"w":141,"h":144,"sx":1389,"sy":599},{"x":78,"y":815,"w":137,"h":174,"sx":84,"sy":815},{"x":302,"y":826,"w":154,"h":163,"sx":304,"sy":826},{"x":528,"y":791,"w":238,"h":200,"sx":631,"sy":791},{"x":780,"y":789,"w":245,"h":204,"sx":885,"sy":789},{"x":1103,"y":829,"w":136,"h":161,"sx":1150,"sy":829},{"x":1324,"y":825,"w":161,"h":165,"sx":1384,"sy":825}]},{"file":"units-1.png","view":"front","keys":["soldier","archer","shield","cav","captain","hua","jang","gong","lulingqi","gao","cao","xia"],"frames":[{"x":72,"y":66,"w":136,"h":150,"sx":125,"sy":66},{"x":314,"y":66,"w":131,"h":150,"sx":367,"sy":66},{"x":571,"y":66,"w":148,"h":150,"sx":633,"sy":66},{"x":820,"y":66,"w":145,"h":155,"sx":883,"sy":66},{"x":1057,"y":34,"w":176,"h":188,"sx":1062,"sy":34},{"x":1311,"y":34,"w":177,"h":193,"sx":1315,"sy":34},{"x":16,"y":276,"w":266,"h":206,"sx":117,"sy":276},{"x":286,"y":277,"w":259,"h":205,"sx":374,"sy":277},{"x":561,"y":261,"w":193,"h":217,"sx":644,"sy":261},{"x":811,"y":261,"w":192,"h":221,"sx":890,"sy":261},{"x":1038,"y":293,"w":240,"h":189,"sx":1136,"sy":293},{"x":1290,"y":288,"w":239,"h":194,"sx":1384,"sy":288},{"x":16,"y":523,"w":269,"h":221,"sx":116,"sy":523},{"x":286,"y":523,"w":267,"h":222,"sx":381,"sy":523},{"x":545,"y":516,"w":218,"h":234,"sx":644,"sy":516},{"x":790,"y":516,"w":203,"h":235,"sx":884,"sy":516},{"x":1041,"y":530,"w":251,"h":220,"sx":1127,"sy":530},{"x":1296,"y":530,"w":226,"h":220,"sx":1369,"sy":530},{"x":16,"y":775,"w":222,"h":215,"sx":113,"sy":775},{"x":272,"y":779,"w":227,"h":208,"sx":375,"sy":779},{"x":546,"y":804,"w":201,"h":183,"sx":649,"sy":804},{"x":793,"y":803,"w":210,"h":183,"sx":900,"sy":803},{"x":1058,"y":811,"w":195,"h":176,"sx":1136,"sy":811},{"x":1304,"y":811,"w":212,"h":181,"sx":1395,"sy":811}]},{"file":"units-2.png","view":"front","keys":["xiahouyuan","liubei","zhangfei","machao","xuhuang","yuan","yan","wen","sima","xuchu","dong","guo"],"frames":[{"x":42,"y":29,"w":191,"h":213,"sx":115,"sy":29},{"x":311,"y":34,"w":187,"h":208,"sx":384,"sy":34},{"x":579,"y":84,"w":168,"h":157,"sx":659,"sy":84},{"x":806,"y":84,"w":184,"h":157,"sx":897,"sy":84},{"x":1057,"y":91,"w":215,"h":150,"sx":1126,"sy":91},{"x":1316,"y":91,"w":196,"h":150,"sx":1381,"sy":91},{"x":32,"y":277,"w":243,"h":218,"sx":123,"sy":277},{"x":297,"y":272,"w":246,"h":223,"sx":395,"sy":272},{"x":568,"y":280,"w":210,"h":215,"sx":636,"sy":280},{"x":806,"y":277,"w":220,"h":218,"sx":881,"sy":277},{"x":1053,"y":316,"w":184,"h":179,"sx":1160,"sy":316},{"x":1294,"y":312,"w":188,"h":183,"sx":1388,"sy":312},{"x":32,"y":525,"w":245,"h":226,"sx":122,"sy":525},{"x":304,"y":527,"w":239,"h":224,"sx":401,"sy":527},{"x":556,"y":527,"w":234,"h":224,"sx":635,"sy":527},{"x":799,"y":524,"w":240,"h":227,"sx":881,"sy":524},{"x":1073,"y":570,"w":158,"h":181,"sx":1149,"sy":570},{"x":1306,"y":570,"w":170,"h":181,"sx":1384,"sy":570},{"x":32,"y":821,"w":215,"h":156,"sx":120,"sy":821},{"x":296,"y":818,"w":209,"h":159,"sx":383,"sy":818},{"x":569,"y":787,"w":183,"h":190,"sx":657,"sy":787},{"x":794,"y":786,"w":208,"h":191,"sx":899,"sy":786},{"x":1082,"y":817,"w":149,"h":160,"sx":1141,"sy":817},{"x":1322,"y":816,"w":139,"h":161,"sx":1373,"sy":816}]},{"file":"units-3.png","view":"front","keys":["xun","emage","f_xian","f_bing","f_nu","f_ji","f_qing","f_hubao","f_bai","f_dan","ally_spear","enemy_spear"],"frames":[{"x":83,"y":79,"w":126,"h":170,"sx":133,"sy":79},{"x":299,"y":79,"w":142,"h":170,"sx":363,"sy":79},{"x":592,"y":79,"w":126,"h":170,"sx":645,"sy":79},{"x":808,"y":81,"w":139,"h":168,"sx":879,"sy":81},{"x":1093,"y":55,"w":136,"h":194,"sx":1112,"sy":55},{"x":1319,"y":55,"w":133,"h":194,"sx":1340,"sy":55},{"x":64,"y":277,"w":234,"h":227,"sx":159,"sy":277},{"x":300,"y":279,"w":254,"h":227,"sx":390,"sy":279},{"x":602,"y":356,"w":142,"h":143,"sx":644,"sy":356},{"x":824,"y":356,"w":144,"h":143,"sx":869,"sy":356},{"x":1072,"y":311,"w":208,"h":193,"sx":1138,"sy":311},{"x":1298,"y":314,"w":206,"h":190,"sx":1373,"sy":314},{"x":86,"y":599,"w":159,"h":144,"sx":135,"sy":599},{"x":312,"y":599,"w":160,"h":144,"sx":364,"sy":599},{"x":526,"y":526,"w":254,"h":219,"sx":609,"sy":526},{"x":752,"y":525,"w":265,"h":221,"sx":882,"sy":525},{"x":1064,"y":580,"w":177,"h":165,"sx":1150,"sy":580},{"x":1285,"y":580,"w":198,"h":165,"sx":1380,"sy":580},{"x":81,"y":812,"w":152,"h":149,"sx":134,"sy":812},{"x":307,"y":812,"w":154,"h":149,"sx":362,"sy":812},{"x":535,"y":816,"w":182,"h":145,"sx":644,"sy":816},{"x":772,"y":816,"w":176,"h":145,"sx":874,"sy":816},{"x":1063,"y":816,"w":171,"h":145,"sx":1163,"sy":816},{"x":1286,"y":816,"w":174,"h":145,"sx":1389,"sy":816}]},{"file":"back-0.png","view":"back","keys":["guan","lubu","zhao","diao","dian","huang","kong","ally_sword","ally_archer","ally_shield","ally_cav","mage"],"frames":[{"x":44,"y":96,"w":204,"h":189,"sx":130,"sy":96},{"x":282,"y":96,"w":207,"h":190,"sx":372,"sy":96},{"x":508,"y":14,"w":260,"h":276,"sx":608,"sy":14},{"x":779,"y":16,"w":247,"h":275,"sx":870,"sy":16},{"x":1053,"y":71,"w":224,"h":219,"sx":1143,"sy":71},{"x":1301,"y":73,"w":223,"h":217,"sx":1393,"sy":73},{"x":63,"y":344,"w":178,"h":183,"sx":117,"sy":344},{"x":288,"y":339,"w":185,"h":185,"sx":353,"sy":339},{"x":508,"y":344,"w":237,"h":183,"sx":622,"sy":344},{"x":766,"y":344,"w":247,"h":183,"sx":881,"sy":344},{"x":1055,"y":346,"w":190,"h":181,"sx":1135,"sy":346},{"x":1301,"y":350,"w":202,"h":183,"sx":1387,"sy":350},{"x":66,"y":573,"w":165,"h":175,"sx":129,"sy":573},{"x":300,"y":573,"w":175,"h":171,"sx":374,"sy":573},{"x":569,"y":589,"w":168,"h":155,"sx":625,"sy":589},{"x":815,"y":589,"w":163,"h":153,"sx":871,"sy":589},{"x":1094,"y":592,"w":150,"h":156,"sx":1149,"sy":592},{"x":1322,"y":590,"w":156,"h":158,"sx":1383,"sy":590},{"x":57,"y":786,"w":156,"h":199,"sx":199,"sy":786},{"x":299,"y":789,"w":161,"h":198,"sx":449,"sy":789},{"x":517,"y":773,"w":239,"h":225,"sx":623,"sy":773},{"x":772,"y":766,"w":235,"h":232,"sx":881,"sy":766},{"x":1082,"y":815,"w":166,"h":169,"sx":1167,"sy":815},{"x":1323,"y":815,"w":171,"h":175,"sx":1402,"sy":815}]},{"file":"back-1.png","view":"back","keys":["soldier","archer","shield","cav","captain","hua","jang","gong","lulingqi","gao","cao","xia"],"frames":[{"x":80,"y":65,"w":133,"h":149,"sx":124,"sy":65},{"x":317,"y":65,"w":135,"h":152,"sx":364,"sy":65},{"x":568,"y":65,"w":147,"h":152,"sx":634,"sy":65},{"x":824,"y":64,"w":142,"h":157,"sx":896,"sy":64},{"x":1072,"y":37,"w":163,"h":181,"sx":1228,"sy":37},{"x":1328,"y":37,"w":163,"h":184,"sx":1484,"sy":37},{"x":16,"y":268,"w":257,"h":215,"sx":144,"sy":268},{"x":272,"y":269,"w":247,"h":216,"sx":390,"sy":269},{"x":544,"y":258,"w":191,"h":219,"sx":623,"sy":258},{"x":792,"y":262,"w":197,"h":215,"sx":846,"sy":262},{"x":1046,"y":285,"w":229,"h":194,"sx":1142,"sy":285},{"x":1297,"y":285,"w":234,"h":198,"sx":1403,"sy":285},{"x":15,"y":521,"w":259,"h":229,"sx":141,"sy":521},{"x":272,"y":523,"w":246,"h":230,"sx":391,"sy":523},{"x":559,"y":512,"w":194,"h":239,"sx":661,"sy":512},{"x":799,"y":513,"w":197,"h":239,"sx":898,"sy":513},{"x":1050,"y":531,"w":231,"h":225,"sx":1154,"sy":531},{"x":1305,"y":531,"w":225,"h":226,"sx":1410,"sy":531},{"x":18,"y":771,"w":219,"h":211,"sx":120,"sy":771},{"x":266,"y":772,"w":219,"h":206,"sx":364,"sy":772},{"x":544,"y":799,"w":197,"h":183,"sx":645,"sy":799},{"x":791,"y":799,"w":206,"h":183,"sx":891,"sy":799},{"x":1043,"y":799,"w":220,"h":183,"sx":1137,"sy":799},{"x":1298,"y":803,"w":215,"h":179,"sx":1390,"sy":803}]},{"file":"back-2.png","view":"back","keys":["xiahouyuan","liubei","zhangfei","machao","xuhuang","yuan","yan","wen","sima","xuchu","dong","guo"],"frames":[{"x":34,"y":23,"w":210,"h":223,"sx":123,"sy":23},{"x":301,"y":24,"w":206,"h":222,"sx":390,"sy":24},{"x":574,"y":75,"w":188,"h":167,"sx":659,"sy":75},{"x":804,"y":74,"w":193,"h":168,"sx":897,"sy":74},{"x":1063,"y":81,"w":208,"h":165,"sx":1133,"sy":81},{"x":1301,"y":81,"w":207,"h":163,"sx":1373,"sy":81},{"x":29,"y":268,"w":262,"h":231,"sx":135,"sy":268},{"x":300,"y":268,"w":241,"h":231,"sx":394,"sy":268},{"x":569,"y":268,"w":227,"h":231,"sx":649,"sy":268},{"x":806,"y":268,"w":226,"h":230,"sx":886,"sy":268},{"x":1056,"y":313,"w":209,"h":183,"sx":1155,"sy":313},{"x":1293,"y":310,"w":206,"h":186,"sx":1390,"sy":310},{"x":34,"y":518,"w":248,"h":234,"sx":129,"sy":518},{"x":300,"y":518,"w":238,"h":234,"sx":397,"sy":518},{"x":559,"y":517,"w":238,"h":235,"sx":651,"sy":517},{"x":796,"y":517,"w":247,"h":235,"sx":891,"sy":517},{"x":1070,"y":561,"w":185,"h":191,"sx":1158,"sy":561},{"x":1302,"y":561,"w":187,"h":191,"sx":1393,"sy":561},{"x":33,"y":814,"w":220,"h":167,"sx":132,"sy":814},{"x":295,"y":814,"w":219,"h":167,"sx":393,"sy":814},{"x":564,"y":777,"w":201,"h":204,"sx":662,"sy":777},{"x":795,"y":777,"w":213,"h":204,"sx":906,"sy":777},{"x":1075,"y":810,"w":178,"h":171,"sx":1152,"sy":810},{"x":1310,"y":810,"w":175,"h":171,"sx":1386,"sy":810}]},{"file":"back-3.png","view":"back","keys":["xun","emage","f_xian","f_bing","f_nu","f_ji","f_qing","f_hubao","f_bai","f_dan","ally_spear","enemy_spear"],"frames":[{"x":68,"y":71,"w":164,"h":179,"sx":134,"sy":71},{"x":304,"y":71,"w":159,"h":177,"sx":369,"sy":71},{"x":573,"y":71,"w":163,"h":181,"sx":644,"sy":71},{"x":810,"y":71,"w":160,"h":181,"sx":881,"sy":71},{"x":1089,"y":34,"w":166,"h":212,"sx":1245,"sy":34},{"x":1327,"y":34,"w":160,"h":218,"sx":1476,"sy":34},{"x":66,"y":268,"w":235,"h":249,"sx":157,"sy":268},{"x":320,"y":267,"w":245,"h":250,"sx":411,"sy":267},{"x":604,"y":352,"w":146,"h":150,"sx":651,"sy":352},{"x":827,"y":352,"w":149,"h":153,"sx":877,"sy":352},{"x":1076,"y":307,"w":211,"h":201,"sx":1156,"sy":307},{"x":1309,"y":312,"w":204,"h":196,"sx":1395,"sy":312},{"x":79,"y":590,"w":150,"h":155,"sx":138,"sy":590},{"x":312,"y":591,"w":149,"h":156,"sx":366,"sy":591},{"x":549,"y":522,"w":251,"h":229,"sx":633,"sy":522},{"x":780,"y":525,"w":258,"h":226,"sx":862,"sy":525},{"x":1069,"y":578,"w":199,"h":169,"sx":1154,"sy":578},{"x":1302,"y":576,"w":191,"h":171,"sx":1388,"sy":576},{"x":74,"y":802,"w":159,"h":161,"sx":133,"sy":802},{"x":306,"y":803,"w":166,"h":163,"sx":369,"sy":803},{"x":579,"y":800,"w":189,"h":163,"sx":645,"sy":800},{"x":819,"y":800,"w":190,"h":166,"sx":885,"sy":800},{"x":1096,"y":803,"w":190,"h":160,"sx":1161,"sy":803},{"x":1324,"y":802,"w":187,"h":164,"sx":1393,"sy":802}]}];
STYLES.zhangliao={...STYLES.jang};
for(const [key,style] of Object.entries(STYLES)) style.battleStyle=key;
const BATTLE_TERRAIN_OBJECTS=[{"x":66,"y":104,"w":831,"h":419,"sx":450,"sy":320},{"x":984,"y":200,"w":485,"h":313,"sx":1220,"sy":350},{"x":68,"y":574,"w":829,"h":373,"sx":470,"sy":750},{"x":1010,"y":682,"w":459,"h":253,"sx":1230,"sy":820}];
const BATTLE_ART={ready:typeof Image==='undefined',loading:false,error:'',models:new Map(),terrain:null,ground:null,attempt:0};
const HERO_REWORK_KEYS=['gao','yuan','cao','xia','dian','yan','wen','xiahouyuan','xuchu','guo','sima','liubei','guan','kong','zhao','diao','huang','captain','jang','gong','zhangfei','machao','xuhuang','dong','xun','hua'];
const LUBU_STYLE_KEYS=['gao','yuan','cao','xia','dian','yan'];
const LULINGQI_STYLE_KEYS=['lubu','gao'];
const STRONG_LUBU_KEYS=['lubu'];
const TROOP_REWORK_BINDINGS={troop_sword:['ally_sword','soldier'],troop_spear:['ally_spear','enemy_spear'],troop_sword_shield:['ally_shield','shield_sword'],troop_spear_shield:['ally_shield_spear','shield'],f_xian:['f_xian','f_xian_enemy'],f_bing:['f_bing','f_bing_enemy']};
const REMAINING_REWORK_BINDINGS={"huang":["huang"],"captain":["captain"],"hua":["hua"],"jang":["jang"],"gong":["gong"],"lulingqi":["lulingqi"],"zhangfei":["zhangfei"],"machao":["machao"],"xuhuang":["xuhuang"],"dong":["dong"],"xun":["xun"],"troop_archer":["ally_archer","archer"],"troop_cav":["ally_cav","cav"],"troop_mage":["mage","emage"],"f_nu":["f_nu","f_nu_enemy"],"f_ji":["f_ji","f_ji_enemy"],"f_qing":["f_qing","f_qing_enemy"],"f_hubao":["f_hubao","f_hubao_enemy"],"f_bai":["f_bai","f_bai_enemy"],"f_dan":["f_dan","f_dan_enemy"]};
function extractBattleSprite(image,b,tint=false,cutoff=128) {
  const c=document.createElement('canvas');c.width=b.w;c.height=b.h;const g=c.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=false;g.drawImage(image,b.x,b.y,b.w,b.h,0,0,b.w,b.h);
  const pixels=g.getImageData(0,0,b.w,b.h),d=pixels.data,seen=new Uint8Array(b.w*b.h),queue=new Int32Array(b.w*b.h);let head=0,tail=1;const seed=(b.sy-b.y)*b.w+b.sx-b.x;queue[0]=seed;seen[seed]=1;
  if(seed<0||seed>=seen.length||d[seed*4+3]<cutoff)throw new Error('스프라이트 투명 경계 오류');
  // 같은 사각형에 걸친 이웃의 무기를 제거하고 이 스프라이트의 연결된 알파만 사용한다.
  while(head<tail){const i=queue[head++],x=i%b.w,y=Math.floor(i/b.w);for(const n of [x?i-1:-1,x+1<b.w?i+1:-1,y?i-b.w:-1,y+1<b.h?i+b.w:-1])if(n>=0&&!seen[n]&&d[n*4+3]>=cutoff){seen[n]=1;queue[tail++]=n;}}
  if(tail<500)throw new Error('빈 스프라이트 이미지');
  for(let i=0;i<seen.length;i++){const j=i*4;if(!seen[i]){d[j+3]=0;continue;}d[j+3]=255;if(tint&&d[j+2]>d[j]*1.18&&d[j+2]>d[j+1]*1.05){const r=d[j],g=d[j+1],blue=d[j+2];d[j]=Math.min(255,blue*.9+25);d[j+1]=g*.7+8;d[j+2]=r*.8+8;}}
  const feet=new Uint32Array(b.w);let total=0;for(let y=Math.floor(b.h*.85);y<b.h;y++)for(let x=0;x<b.w;x++)if(seen[y*b.w+x]){feet[x]++;total++;}
  let weight=0;c.footX=b.w/2;for(let x=0;x<b.w;x++){weight+=feet[x];if(weight>=total/2){c.footX=x;break;}}
  let mass=0,top=0;while(top<b.h&&mass<tail*.15){for(let x=0;x<b.w;x++)mass+=seen[top*b.w+x];top++;}c.bodyHeight=b.h-top+1;
  g.putImageData(pixels,0,0);return c;
}
function loadBattleArt() {
  if(typeof Image==='undefined')return Promise.resolve();if(BATTLE_ART.loading)return BATTLE_ART.promise;
  BATTLE_ART.ready=false;BATTLE_ART.loading=true;BATTLE_ART.error='';BATTLE_ART.models.clear();const attempt=++BATTLE_ART.attempt;
  const load=(path,version=277)=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error(path));image.src=path+'?v='+version+'&try='+attempt;});
  const manifest=(folder,version)=>fetch('src/assets/'+folder+'/layout.json?v='+version+'&try='+attempt).then(r=>{if(!r.ok)throw new Error(folder+' 아트 목록 로드 실패');return r.json();});
  BATTLE_ART.promise=Promise.all([Promise.all([load('src/assets/battle-v274/terrain.png',274),load('src/assets/battle-v311/ground.png',311),load('src/assets/battle-v311/props.png',311)]),manifest('heroes-v308',309),manifest('heroes-v314',314),manifest('heroes-v316',316),manifest('heroes-v317',317),manifest('troops-v305',305),manifest('rework-v303',303)]).then(async ([images,heroes,lubuStyle,lulingqiStyle,strongLubu,troops,remaining])=>{
    const complete=(list,bindings)=>list.length===Object.keys(bindings).length&&new Set(list.map(h=>h.key)).size===list.length&&Object.keys(bindings).every(k=>list.some(h=>h.key===k));
    if(heroes.length!==HERO_REWORK_KEYS.length||new Set(heroes.map(h=>h.key)).size!==heroes.length||HERO_REWORK_KEYS.some(k=>!heroes.some(h=>h.key===k)))throw new Error('장수 리워크 외형 누락');
    if(lubuStyle.length!==LUBU_STYLE_KEYS.length||LUBU_STYLE_KEYS.some(k=>!lubuStyle.some(h=>h.key===k)))throw new Error('여포 기준 장수 외형 누락');
    if(lulingqiStyle.length!==LULINGQI_STYLE_KEYS.length||LULINGQI_STYLE_KEYS.some(k=>!lulingqiStyle.some(h=>h.key===k)))throw new Error('여령기 기준 장수 외형 누락');
    if(strongLubu.length!==STRONG_LUBU_KEYS.length||STRONG_LUBU_KEYS.some(k=>!strongLubu.some(h=>h.key===k)))throw new Error('강인한 여포 외형 누락');
    if(!complete(troops,TROOP_REWORK_BINDINGS)||!complete(remaining,REMAINING_REWORK_BINDINGS))throw new Error('전체 리워크 외형 누락');
    for(const key of new Set([...Object.keys(STYLES),...Object.values(TROOP_REWORK_BINDINGS).flat(),...Object.values(REMAINING_REWORK_BINDINGS).flat()]))BATTLE_ART.models.set(key,{frames:[],back:[]});
    // 모든 캐릭터가 교체되어 옛 앞뒤/방향 시트는 내려받거나 추출하지 않는다.
    BATTLE_ART.terrain=images[0];BATTLE_ART.ground=images[1];BATTLE_ART.terrainObjects=BATTLE_TERRAIN_OBJECTS.map(b=>extractBattleSprite(images[2],b));
    const jang=await fetch('src/assets/zhangliao-v287/layout.json?v=287&try='+attempt).then(r=>{if(!r.ok)throw new Error('장료 아트 목록 로드 실패');return r.json();});
    const jangSheets=await Promise.all(jang.map(async sheet=>{const image=await load('src/assets/zhangliao-v287/'+sheet.file,287);return {kind:sheet.kind,frames:sheet.frames.map(b=>extractBattleSprite(image,b,false,200))};}));
    BATTLE_ART.models.set('zhangliao',{...BATTLE_ART.models.get('jang')});
    installLubuRework(jangSheets,'zhangliao');
    await Promise.all(heroes.filter(h=>!LULINGQI_STYLE_KEYS.includes(h.key)).map(async h=>{
      if(h.frames.length!==56||h.actions?.length!==2||new Set(h.actions).size!==2||h.actions.some(a=>!['thrust','slash','shoot','cast','heal'].includes(a)))throw new Error('장수 리워크 동작 누락: '+h.key);
      const image=await load('src/assets/heroes-v308/'+h.file,309),frames=h.frames.map(b=>extractBattleSprite(image,b,false,200));
      installAtlasRework(h,frames,frames,[h.key]);
    }));
    await Promise.all(lubuStyle.filter(h=>!LULINGQI_STYLE_KEYS.includes(h.key)).map(async h=>{
      if(h.frames.length!==56||h.actions?.length!==2)throw new Error('여포 기준 장수 동작 누락: '+h.key);
      const image=await load('src/assets/heroes-v314/'+h.file,314),frames=h.frames.map(b=>extractBattleSprite(image,b,false,200));
      installAtlasRework(h,frames,frames,[h.key]);
    }));
    await Promise.all(lulingqiStyle.filter(h=>!STRONG_LUBU_KEYS.includes(h.key)).map(async h=>{
      if(h.frames.length!==64||h.actions?.join(',')!=='thrust,slash')throw new Error('여령기 기준 장수 동작 누락: '+h.key);
      const image=await load('src/assets/heroes-v316/'+h.file,316),frames=h.frames.map(b=>extractBattleSprite(image,b,false,200));
      installAtlasRework(h,frames,frames,[h.key]);
    }));
    await Promise.all(strongLubu.map(async h=>{
      if(h.frames.length!==64||h.actions?.join(',')!=='thrust,slash')throw new Error('강인한 여포 동작 누락');
      const image=await load('src/assets/heroes-v317/'+h.file,317),frames=h.frames.map(b=>extractBattleSprite(image,b,false,200));
      installAtlasRework(h,frames,frames,[h.key]);
    }));
    await Promise.all(troops.map(async h=>{
      if(![56,64,72].includes(h.frames.length)||h.actions?.join(',')!=='thrust,slash')throw new Error('병사 동작 누락: '+h.key);
      const image=await load('src/assets/troops-v305/'+h.file,305);
      const frames=h.frames.map(b=>extractTroopSprite(image,b,false)),enemy=h.frames.map(b=>extractTroopSprite(image,b,true));
      installAtlasRework(h,frames,enemy);
    }));
    await Promise.all(remaining.filter(h=>!HERO_REWORK_KEYS.includes(h.key)).map(async h=>{
      if(![56,64,72].includes(h.frames.length)||h.actions?.length!==2||new Set(h.actions).size!==2||h.actions.some(a=>!['thrust','slash','shoot','cast','heal'].includes(a)))throw new Error('추가 리워크 동작 누락: '+h.key);
      const image=await load('src/assets/rework-v303/'+h.file,303),keys=REMAINING_REWORK_BINDINGS[h.key],frames=h.frames.map(b=>extractTroopSprite(image,b,false));
      const enemy=keys.length===2?h.frames.map(b=>extractTroopSprite(image,b,true)):frames;
      installAtlasRework(h,frames,enemy,keys);
    }));
    for(const [key,model]of BATTLE_ART.models)if(model.idle?.length!==8||model.directions?.length!==8)throw new Error('캐릭터 리워크 연결 누락: '+key);
    BATTLE_ART.ready=true;
  }).catch(e=>{BATTLE_ART.error=e.message;}).finally(()=>{BATTLE_ART.loading=false;});return BATTLE_ART.promise;
}
// 시뮬레이션의 판정 반경과 독립된 공통 외형 크기. 기병은 말까지 포함한다.
const BATTLE_UNIT_RADIUS=8.5;
// 여포의 기수·말을 기준으로 원본마다 다른 머리/갑옷 비중을 시각 보정한다.
// 머리(투구·머리카락 포함) 가로폭을 여포(=1) 기준으로 맞춘 배율. 전투 정면 확대 비교에서 여포 머리 폭 58px 기준선에 맞춰 눈대중(±8%)으로 정함 — 새 외형을 추가하면 같은 방식으로 다시 맞춘다
const FACE_SCALE={ally_sword:.8,ally_shield:.64,liubei:.67,guan:.8,zhao:.8,jang:.9,gong:.7,lulingqi:.95,xiahouyuan:.72,machao:1.05,xuhuang:.65,yan:1,wen:.95,zhangliao:.9,diao:.9,dian:1,huang:.78,kong:.68,captain:.78,hua:.74,gao:1,cao:1,xia:1,zhangfei:.9,xun:.93,ally_archer:.72,ally_cav:.78,mage:.97,f_xian:.8,f_bing:.97,f_nu:.93,f_ji:1.05,f_qing:1.05,f_hubao:.9,f_bai:.9,f_dan:.85,yuan:1,sima:.77,xuchu:.6,dong:.83,guo:.72,soldier:.8,archer:.72,shield:.64,cav:.78,emage:.97};
const LULINGQI_SCALE=FACE_SCALE.lulingqi,LUBU_SCALE=1.05;
function battleSpriteHeight(r,s){return r*1.2*(s.horse?4.8:3.6)*(s.sizeScale??FACE_SCALE[String(s.battleStyle).replace(/_enemy$/,"")]??1);}
function battleFrameHeight(image){return image.bodyHeight>0?image.bodyHeight/.8:image.height;}
function installDiaoRework(sheets){
  const idle=sheets.find(s=>s.kind==='idle')?.frames,walk=sheets.find(s=>s.kind==='walk')?.frames,model=BATTLE_ART.models.get('diao');
  if(sheets.length!==2||idle?.length!==8||walk?.length!==32||!model)throw new Error('초선 방향/동작 이미지 누락');
  model.idle=idle;model.directions=Array.from({length:8},(_,d)=>Array.from({length:4},(_,f)=>walk[f*8+d]));
  model.directionHeight=Math.max(...walk.map(c=>c.height));
  const body=a=>a.map(c=>c.bodyHeight).sort((a,b)=>a-b)[Math.floor(a.length/2)];
  model.bodyRatio=body(walk)/model.directionHeight;model.idleHeight=body(idle)/model.bodyRatio;model.reworked=true;
}
function battleDirection(face){return ((Math.round(face/(Math.PI/4))%8)+8)%8;}
function installLubuRework(sheets,key='lubu',actions=['thrust','slash']) {
  const idle=sheets.find(s=>s.kind==='idle')?.frames,walk=sheets.find(s=>s.kind==='walk')?.frames,attack=sheets.find(s=>s.kind==='attack')?.frames;
  if(sheets.length!==3||idle?.length!==8||walk?.length!==32||attack?.length!==32)throw new Error(key+' 방향/동작 이미지 누락');
  const model=BATTLE_ART.models.get(key);if(!model)throw new Error(key+' 기본 모델 누락');
  model.idle=idle;model.directions=Array.from({length:8},(_,d)=>Array.from({length:4},(_,f)=>walk[f*8+d]));
  model.attacks=Object.fromEntries(actions.map((kind,i)=>[kind,Array.from({length:8},(_,d)=>[attack[i*16+d],attack[i*16+8+d]])]));
  model.directionHeight=Math.max(...walk.map(c=>c.height));
  const body=a=>a.map(c=>c.bodyHeight).sort((a,b)=>a-b)[Math.floor(a.length/2)],ref=body(walk);
  model.idleHeight=model.directionHeight*body(idle)/ref;model.attackHeight=model.directionHeight*body(attack)/ref;model.reworked=true;
}
function extractTroopSprite(image,b,enemy) {
  const source=extractBattleSprite(image,b,enemy,200),scale=Math.min(1,128/source.height);
  if(scale===1)return source;
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(source.width*scale));canvas.height=Math.max(1,Math.round(source.height*scale));
  const g=canvas.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=false;g.drawImage(source,0,0,canvas.width,canvas.height);
  canvas.footX=source.footX*canvas.width/source.width;canvas.bodyHeight=source.bodyHeight*canvas.height/source.height;return canvas;
}
function installAtlasRework(spec,frames,enemyFrames,keys=TROOP_REWORK_BINDINGS[spec.key]) {
  if(!keys||![56,64,72].includes(frames.length)||enemyFrames.length!==frames.length)throw new Error('병사 방향/동작 누락: '+spec.key);
  keys.forEach((key,i)=>{
    const all=i?enemyFrames:frames;BATTLE_ART.models.set(key,{frames:[],back:[]});
    const attackStart=all.length-32,walk=all.slice(8,attackStart);
    // 3자세 보행은 접지→통과→반대 접지→통과의 왕복 주기로 연결한다.
    if(walk.length===24)walk.push(...walk.slice(8,16));
    if(walk.length===16)walk.push(...walk);
    installLubuRework([{kind:'idle',frames:all.slice(0,8)},{kind:'walk',frames:walk},{kind:'attack',frames:all.slice(attackStart)}],key,spec.actions);
    const model=BATTLE_ART.models.get(key);model.bodyRatio=model.directions.flat().map(c=>c.bodyHeight).sort((a,b)=>a-b)[16]/model.directionHeight;model.troop=keys.length===2;
  });
}
function battleActionWeight(p){p=Math.max(0,Math.min(1,p||0));const k=p<.2?p/.2:(1-p)/.8;return k*k*(3-2*k);}
// 기존 타이머를 읽어 대기 자세에서 동작을 거쳐 같은 기준점으로 복귀한다.
function battleHeroMotion(pose,face,r) {
  const m={x:0,y:0,turn:0,face,frame:0,stretch:pose.state==='idle'?1+(pose.breath||0):1}, k=pose.trail>0?battleActionWeight(pose.progress):0, hit=pose.impact||0, size=r/15, side=Math.cos(face)<0?-1:1;
  let reach=0;
  switch(pose.state){
    case 'move': m.y=-Math.abs(pose.stride||0)*2; m.turn=(pose.stride||0)*.035; m.frame=pose.stride>0?1:0; break;
    case 'thrust': reach=18*k; m.turn=side*.2*k; m.frame=k>.12?1:0; break;
    case 'slash': reach=10*k; m.turn=side*(-.48*k+.38*Math.sin(Math.PI*(pose.progress||0))); m.frame=k>.12?1:0; break;
    case 'shoot': reach=-7*k; m.turn=-side*.12*k; m.frame=k>.35?1:0; break;
    case 'cast': case 'heal': case 'bless': m.y=-5*k; m.turn=side*.06*k; m.frame=k>.25?1:0; break;
    case 'spin': m.face=face+Math.PI*2*(pose.progress||0); m.turn=side*.18*Math.sin(Math.PI*2*(pose.progress||0)); m.frame=k>.2?1:0; break;
    case 'dash': reach=8; m.y=-(pose.bob||0); m.turn=side*.2; m.frame=pose.bob>1.5?1:0; break;
    case 'guard': reach=-3*hit; m.turn=-side*.08*hit; break;
    case 'hurt': reach=-7*hit; m.turn=-side*.24*hit; break;
  }
  m.x=Math.round(Math.cos(face)*reach*size);m.y=Math.round((m.y+Math.sin(face)*reach)*size);
  return m;
}
function drawBattleMeleeTrail(g,x,y,r,face,pose,horse=false) {
  if(!pose||!['thrust','slash'].includes(pose.state)||!(pose.trail>0))return;
  const p=pose.progress||0,fade=battleActionWeight(p),cs=Math.cos(face),sn=Math.sin(face),side=cs<0?-1:1;
  const point=(along,across)=>[x+cs*along-sn*across*side,y-r*(horse?2.15:1.7)+sn*along+cs*across*.65*side];
  const line=(a,b,col,w=1)=>{const aa=point(...a),bb=point(...b);pixelLine(g,...aa,...bb,col,w);};
  g.save();g.globalAlpha*=Math.min(.9,fade*1.6);
  if(pose.state==='thrust'){
    const tip=r*(2.8-p*.8);
    line([r*.5,0],[tip,0],'#fff3cf',2);
    line([r*.7,-4],[tip-5,-2],'#b0d9d4');line([r*.7,4],[tip-5,2],'#b0d9d4');
    line([tip-6,-4],[tip,0],'#fff3cf');line([tip,0],[tip-6,4],'#fff3cf');
  }else{
    const end=-.8+p*2.6,start=end-1.8;
    for(let i=0;i<12;i++){
      const a=start+(end-start)*i/12,b=start+(end-start)*(i+1)/12;
      for(const [radius,col,width] of [[r*2.5,'#b0d9d4',1],[r*2.2,'#fff3cf',2]])
        line([Math.cos(a)*radius,Math.sin(a)*radius],[Math.cos(b)*radius,Math.sin(b)*radius],col,width);
    }
  }
  g.restore();
}
function battleModelKey(s,team){
  let key=s.battleStyle;if(key==='ally_sword'&&s.weapon==='spear')key='ally_spear';if(key==='soldier'&&s.weapon==='spear')key='enemy_spear';
  if(key==='ally_shield'&&s.weapon==='spear')key='ally_shield_spear';if(key==='shield'&&s.weapon==='sword')key='shield_sword';
  if(team==='player')key=({soldier:'ally_sword',enemy_spear:'ally_spear',shield:'ally_shield_spear',shield_sword:'ally_shield'})[key]||key;
  const enemy=team==='enemy'||s.teamBase&&s.body===STYLES[ENEMY_BASE_STYLE[s.teamBase]].body;
  if(enemy)key=({ally_sword:'soldier',ally_spear:'enemy_spear',ally_archer:'archer',ally_shield:'shield_sword',ally_shield_spear:'shield',ally_cav:'cav',mage:'emage',f_xian:'f_xian_enemy',f_bing:'f_bing_enemy',f_nu:'f_nu_enemy',f_ji:'f_ji_enemy',f_qing:'f_qing_enemy',f_hubao:'f_hubao_enemy',f_bai:'f_bai_enemy',f_dan:'f_dan_enemy'})[key]||key;
  return key;
}
function drawBattleBody(g,x,y,r,face,s,o={}) {
  if(!BATTLE_ART.ready||!BATTLE_ART.models.size)return;
  const key=battleModelKey(s,o.team),enemy=o.team==='enemy'||s.teamBase&&s.body===STYLES[ENEMY_BASE_STYLE[s.teamBase]].body;
  const model=BATTLE_ART.models.get(key);if(!model)throw new Error('전투 이미지 누락: '+key);
  if(model.directions&&model.idle){drawConnectedHero(g,x,y,r,face,s,o,model);return;}
  const pose=o.pose,phase=pose?.trail||0,motion=pose?battleHeroMotion(pose,face,r):null,view=motion?motion.face:face,back=Math.sin(view)<-.25;
  const directional=!!model.directions,frame=directional?(pose&&['move','dash'].includes(pose.state)||!pose&&o.moving?pose?.walkFrame??Math.floor((o.t||0)*8)%4:phase>0?Math.min(3,Math.floor((pose.progress||0)*4)):0):motion?motion.frame:o.moving?Math.floor((o.t||0)*7)%2:phase>.4?1:0;
  const frames=directional?model.directions[battleDirection(view)]:back?(enemy&&model.enemyBack?model.enemyBack:model.back):(enemy&&model.enemy?model.enemy:model.frames);let image=frames[frame];
  if(o.flash){if(!image.flash){const white=document.createElement('canvas');white.width=image.width;white.height=image.height;white.footX=image.footX;white.bodyHeight=image.bodyHeight;const p=white.getContext('2d');p.drawImage(image,0,0);p.globalCompositeOperation='source-in';p.fillStyle='#fff4db';p.fillRect(0,0,white.width,white.height);image.flash=white;}image=image.flash;}
  const scale=battleSpriteHeight(r,s)/battleFrameHeight(image),h=image.height*scale,w=image.width*scale;g.save();g.imageSmoothingEnabled=false;if(o.alpha!=null)g.globalAlpha*=o.alpha;
  g.translate(Math.round(x+(motion?.x||0)),Math.round(y+(motion?motion.y:o.moving&&frame?-1:0)));if(motion?.turn)g.rotate(motion.turn);const sourceLeft=!back&&['ally_spear','enemy_spear','f_bai'].includes(key);if(!directional&&(Math.cos(view)<-.25)!==sourceLeft)g.scale(-1,1);
  g.drawImage(image,Math.round(-(image.footX??image.width/2)*h/image.height),-Math.round(h),Math.round(w),Math.round(h));g.restore();
  drawBattleMeleeTrail(g,x,y,r,face,pose,!!s.horse);
}
function drawConnectedHero(g,x,y,r,face,s,o,model) {
  const layers=o.pose?.layers||[{pose:o.pose||{state:'idle'},face,weight:1}];
  const samples=layers.map(l=>{
    const p=l.pose,m=battleHeroMotion(p,l.face,r),d=battleDirection(m.face),idle=p.state==='idle'||model.reworked&&['guard','hurt','cast','heal','bless'].includes(p.state);
    const walking=['move','dash'].includes(p.state),f=walking?p.walkFrame??Math.floor((o.t||0)*8)%4:p.trail>0?Math.min(3,Math.floor((p.progress||0)*4)):0;
    let image=idle?model.idle[d]:model.directions[d][f];
    const action=({dash:'thrust',spin:'slash',bless:'heal'})[p.state]||p.state,kind=model.attacks?.[action]?action:null;
    if(kind){const progress=p.state==='dash'?.25:p.progress||0,rest=progress<.12||progress>.88;image=rest?model.idle[d]:model.attacks[kind][d][progress<.5?0:1];}
    return {...l,m,image,height:battleFrameHeight(image)};
  });
  const motion={x:0,y:0,turn:0,stretch:0};for(const l of samples)for(const k of Object.keys(motion))motion[k]+=l.m[k]*l.weight;
  const l=samples[0];let image=l.image;
  if(o.flash){if(!image.flash){const c=document.createElement('canvas');c.width=image.width;c.height=image.height;c.footX=image.footX;const cg=c.getContext('2d');cg.drawImage(image,0,0);cg.globalCompositeOperation='source-in';cg.fillStyle='#fff4db';cg.fillRect(0,0,c.width,c.height);image.flash=c;}image=image.flash;}
  const scale=battleSpriteHeight(r,s)/l.height,h=image.height*scale*motion.stretch,w=image.width*scale;
  g.save();g.imageSmoothingEnabled=false;if(o.alpha!=null)g.globalAlpha*=o.alpha;
  g.translate(Math.round(x+motion.x),Math.round(y+motion.y));g.rotate(motion.turn);
  g.drawImage(image,Math.round(-(image.footX??image.width/2)*scale),-Math.round(h),Math.round(w),Math.round(h));
  g.restore();drawBattleMeleeTrail(g,x,y,r,face,o.pose,!!s.horse);
}
if(typeof Image==='function')loadBattleArt();

function drawBattleEffect(g, f, t) {
  const p=Math.max(0,Math.min(1,1-f.t/f.max));
  g.save(); g.globalAlpha*=1-p;
  if(f.kind==='fall') {
    const e=1-(1-p)**2;g.translate(Math.round(f.x+Math.cos(f.ang)*14*e),Math.round(f.y+Math.sin(f.ang)*8*e));g.rotate(p>0.25?(Math.cos(f.ang)>=0?1:-1)*Math.PI/2:0);
    drawBattleBody(g,0,0,BATTLE_UNIT_RADIUS,f.face,{...STYLES[f.style],weapon:null},{flash:p<0.15,t});g.restore();return;
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
function buildTerrain(map,MW,MH,TILE) {
  const c=document.createElement('canvas');c.width=MW*TILE;c.height=MH*TILE;c.battleAtlasReady=!!BATTLE_ART.terrain;
  if(!BATTLE_ART.ready||!BATTLE_ART.terrain||!BATTLE_ART.ground)return c;
  const g=c.getContext('2d'),ground=document.createElement('canvas');g.imageSmoothingEnabled=false;ground.width=ground.height=512;
  const gg=ground.getContext('2d');gg.imageSmoothingEnabled=false;gg.drawImage(BATTLE_ART.ground,0,0,512,512);
  g.filter='saturate(70%) brightness(86%)';g.fillStyle=g.createPattern(ground,'repeat');g.fillRect(0,0,c.width,c.height);g.filter='none';
  let seed=12345;const rnd=()=>((seed=seed*16807%2147483647)/2147483647),atlas=BATTLE_ART.terrain;
  const tile=(index,x,y)=>{const col=index%4,row=Math.floor(index/4),sx=Math.floor(col*atlas.width/4)+6,sy=Math.floor(row*atlas.height/3)+6,sw=Math.floor((col+1)*atlas.width/4)-sx-6,sh=Math.floor((row+1)*atlas.height/3)-sy-6;g.drawImage(atlas,sx,sy,sw,sh,x,y,TILE,TILE);};
  g.filter='saturate(55%) brightness(82%)';
  for(let ty=0;ty<MH;ty++)for(let tx=0;tx<MW;tx++){
    const t=map[ty*MW+tx],x=tx*TILE,y=ty*TILE,v=rnd();
    if(t===3)tile(v<.5?8:9,x,y);else if(t===4)tile(v<.5?3:11,x,y);
  }
  g.filter='none';
  // 수풀·바위는 투명 이미지를 겹쳐 타일의 사각 테두리가 드러나지 않게 한다.
  const covered=new Set();g.filter='saturate(78%) brightness(92%)';
  for(let ty=0;ty<MH;ty++)for(let tx=0;tx<MW;tx++){
    const index=ty*MW+tx,t=map[index];if(t!==1&&t!==2||covered.has(index))continue;
    const group=t===1&&tx+1<MW&&ty+1<MH&&[index+1,index+MW,index+MW+1].every(i=>map[i]===1&&!covered.has(i));
    if(group)for(const i of [index+1,index+MW,index+MW+1])covered.add(i);
    const object=BATTLE_ART.terrainObjects[(t===1?0:2)+((tx*7+ty*11)%2)],w=TILE*(t===1?(group?2.5:1.4):1.12),h=w*object.height/object.width;
    g.drawImage(object,Math.round((tx+(group?1:.5))*TILE-w/2),Math.round((ty+(group?2:1))*TILE-h),Math.round(w),Math.round(h));
  }
  g.filter='none';
  return c;
}
