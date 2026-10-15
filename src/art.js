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
  diao: { body: '#c86aa8', trim: '#ffd34d', skin: '#f4d9bd', sleeves: '#f7b3d3', hairCap: true, longHair: true, crown: true, flower: true, weapon: 'fan' },
  dian: { body: '#8a3a22', trim: '#d4a73a', skin: '#c98a6a', beard: true, wrap: true, pauldrons: true, cape: '#5a2418', weapon: 'twin' },
  huang: { body: '#5c5a3c', trim: '#d4a73a', skin: '#d9a98a', helm: true, helmColor: '#c9a24a', plume: 1, beard: true, beardColor: '#e8e4da', pauldrons: true, cape: '#a8321f', weapon: 'bow' },
  kong: { body: '#2a3f7a', trim: '#ffd34d', skin: '#e8c9a8', hairCap: true, beard: true, beardColor: '#e8e4da', sleeves: '#6a86d8', weapon: 'fan' },
  // 아군 병졸: 영웅과 구분되게 청색 계열 몸통 (밝으면 영웅, 어두우면 적 — 아트방향 4)
  ally_sword: { body: '#35506e', trim: '#9aa7b8', skin: '#e0b08a', helm: true, helmColor: '#2c3340', plume: 0.5, weapon: 'spear' },
  ally_archer: { body: '#3d5a6a', trim: '#9aa7b8', skin: '#e0b08a', helm: true, helmColor: '#4a5a66', plume: 0.4, weapon: 'bow' },
  ally_shield: { body: '#35506e', trim: '#9aa7b8', skin: '#e0b08a', helm: true, helmColor: '#2c3340', plume: 0.5, pauldrons: true, weapon: 'axe', shield: true },
  ally_cav: { body: '#2f5f8a', trim: '#c9cfd8', skin: '#e0b08a', helm: true, helmColor: '#2c3340', plume: 1.2, pauldrons: true, weapon: 'spear', horse: '#d8d2c0' },
  mage: { body: '#3a5a8a', trim: '#ffd34d', skin: '#e8c9a8', hairCap: true, sleeves: '#8fb0e8', weapon: 'fan' },
  soldier: { body: '#4a2b33', trim: '#a02b2b', skin: '#d9a77e', helm: true, helmColor: '#34303a', plume: 1, pauldrons: true, weapon: 'spear' },
  archer: { body: '#3d3a46', trim: '#8a2a2a', skin: '#d9a77e', helm: true, helmColor: '#5a4332', plume: 0.7, weapon: 'bow' },
  shield: { body: '#3a4a5a', trim: '#9aa7b8', skin: '#d9a77e', helm: true, helmColor: '#2c3340', plume: 0.5, pauldrons: true, weapon: 'axe', shield: true },
  cav: { body: '#3b3f4b', trim: '#c9302c', skin: '#d9a77e', helm: true, helmColor: '#2b2d36', plume: 1.2, pauldrons: true, weapon: 'spear', horse: '#4a3a30' },
  captain: { body: '#5a1c24', trim: '#e0b13a', skin: '#c9946a', helm: true, helmColor: '#24222c', plume: 1.6, pauldrons: true, weapon: 'axe' },
  hua: { body: '#7a1c24', trim: '#ffd34d', skin: '#c9946a', cape: '#3a0e14', helm: true, helmColor: '#1c1c26', plume: 1.8, pauldrons: true, beard: true, weapon: 'axe' },
  jang: { body: '#3b3f4b', trim: '#ffd34d', skin: '#d9a77e', cape: '#5a1c24', helm: true, helmColor: '#2b2d36', plume: 1.6, pauldrons: true, weapon: 'spear', horse: '#26262e' },
  xun: { body: '#4a2a5a', trim: '#ffd34d', skin: '#d9a77e', hairCap: true, crown: true, beard: true, beardColor: '#cfd3e6', sleeves: '#7a4a8a', weapon: 'fan' },
  emage: { body: '#4a2a5a', trim: '#c9302c', skin: '#d9a77e', hairCap: true, sleeves: '#7a4a8a', weapon: 'fan' },
};

function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }

function drawWeapon(g, kind, x, y, ang, len, r) {
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  g.lineCap = 'round';
  if (kind === 'fan') {
    const hx = x + dx * len * 0.42, hy = y + dy * len * 0.42, R = 22;
    g.strokeStyle = '#8a5a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(hx, hy); g.stroke();
    g.fillStyle = '#ff9ac8'; g.beginPath(); g.moveTo(hx, hy); g.arc(hx, hy, R, ang - 0.95, ang + 0.95); g.closePath(); g.fill();
    g.strokeStyle = COLORS.gold; g.lineWidth = 1.5; g.beginPath(); g.arc(hx, hy, R, ang - 0.95, ang + 0.95); g.stroke();
    return;
  }
  if (kind === 'bow') {
    const cx = x + dx * 14, cy = y + dy * 14, R = r * 1.1;
    g.strokeStyle = '#6a4a2a'; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, R, ang - 1.2, ang + 1.2); g.stroke();
    g.strokeStyle = '#ddd'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx + Math.cos(ang - 1.2) * R, cy + Math.sin(ang - 1.2) * R); g.lineTo(cx + Math.cos(ang + 1.2) * R, cy + Math.sin(ang + 1.2) * R); g.stroke();
    return;
  }
  if (kind === 'twin') {
    for (const sd of [-1, 1]) {
      const a2 = ang + sd * 0.42, c2 = Math.cos(a2), s2 = Math.sin(a2), L2 = len * 0.62;
      const bx = x + Math.cos(ang + Math.PI / 2) * sd * 7, by = y + Math.sin(ang + Math.PI / 2) * sd * 7, tx = bx + c2 * L2, ty = by + s2 * L2;
      g.strokeStyle = '#3a2a1e'; g.lineWidth = 4.5; g.beginPath(); g.moveTo(bx - c2 * 8, by - s2 * 8); g.lineTo(tx, ty); g.stroke();
      g.fillStyle = '#d6dbe3'; g.beginPath(); g.moveTo(tx - c2 * 10, ty - s2 * 10); g.lineTo(tx + c2 * 22, ty + s2 * 22); g.lineTo(tx - s2 * 14, ty + c2 * 14); g.closePath(); g.fill();
    }
    return;
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

// TKC drawBody 축약: 타원 몸통 + 원 머리 + 띠, 영웅별 장식 플래그. o = { flash, alpha, weaponAng, weaponLen, bob, t, moving }
function drawBody(g, x, y, r, face, s, o = {}) {
  const cx = Math.cos(face), sy = Math.sin(face), f = o.flash, W = '#fff';
  if (s.horse) { drawHorse(g, x, y, r * 1.1, face, f ? W : s.horse, o.t || 0, o.moving); y -= r * 0.6; }
  const by = y - r * 0.9 - (o.bob || 0), hy = by - r * 1.15;
  const wp = s.weapon ? { ang: o.weaponAng != null ? o.weaponAng : face + 0.9, len: o.weaponLen || 80 } : null;
  g.save(); if (o.alpha != null) g.globalAlpha = o.alpha;
  if (!s.horse) { g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(x, y + r * 0.35, r * 1.15, r * 0.55, 0, 0, TAU); g.fill(); }
  if (wp && sy < 0) drawWeapon(g, s.weapon, x + cx * r * 0.3, by + r * 0.2, wp.ang, wp.len, r);
  if (s.longHair) { g.fillStyle = f ? W : '#1e1624'; g.beginPath(); g.ellipse(x - cx * r * 0.1, hy + r * 1.0, r * 0.72, r * 1.45, 0, 0, TAU); g.fill(); }
  g.fillStyle = f ? W : s.body; g.beginPath(); g.ellipse(x, by, r * 0.9, r * 1.15, 0, 0, TAU); g.fill();
  if (s.pauldrons) { g.fillStyle = f ? W : s.trim; for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(x + sd * r * 0.82, by - r * 0.45, r * 0.34, r * 0.26, sd * 0.4, 0, TAU); g.fill(); } }
  if (s.cape) { g.fillStyle = f ? W : s.cape; g.beginPath(); g.moveTo(x - r * 0.9, by - r * 0.3); g.quadraticCurveTo(x - cx * r * 1.4, by + r * 1.6, x, by + r * 1.3); g.quadraticCurveTo(x + cx * r * 1.4, by + r * 1.6, x + r * 0.9, by - r * 0.3); g.fill(); }
  g.fillStyle = f ? W : s.trim; g.fillRect(x - r * 0.88, by + r * 0.05, r * 1.76, r * 0.24);
  if (s.sleeves) { const sw = Math.sin((o.t || 0) * 3) * r * 0.25; g.lineCap = 'round'; for (const sd of [-1, 1]) { g.strokeStyle = f ? W : s.sleeves; g.lineWidth = r * 0.42; g.beginPath(); g.moveTo(x + sd * r * 0.85, by - r * 0.35); g.quadraticCurveTo(x + sd * r * 1.75, by + r * 0.2 + sw * sd, x + sd * r * 1.4, by + r * 1.35 + sw * sd * 0.5); g.stroke(); } }
  g.fillStyle = f ? W : s.skin; circle(g, x, hy, r * 0.6);
  if (s.helm) {
    g.fillStyle = f ? W : (s.helmColor || '#1c1c26'); g.beginPath(); g.arc(x, hy, r * 0.66, Math.PI, TAU); g.fill();
    if (s.plume) { const q = s.plume; g.fillStyle = f ? W : '#c9302c'; g.beginPath(); g.moveTo(x - r * 0.14, hy - r * 0.62); g.quadraticCurveTo(x - r * 0.55 * q, hy - r * 1.05 * q, x + r * 0.02, hy - r * (0.7 + 0.65 * q)); g.quadraticCurveTo(x + r * 0.08, hy - r * 0.95, x + r * 0.16, hy - r * 0.62); g.closePath(); g.fill(); }
    if (s.feathers) { g.strokeStyle = f ? W : '#c9302c'; g.lineWidth = 4; g.beginPath(); g.moveTo(x - r * 0.3, hy - r * 0.5); g.quadraticCurveTo(x - r * 1.2, hy - r * 2.2, x - r * 0.6, hy - r * 2.9); g.moveTo(x + r * 0.3, hy - r * 0.5); g.quadraticCurveTo(x + r * 1.2, hy - r * 2.2, x + r * 0.6, hy - r * 2.9); g.stroke(); }
  }
  if (s.beard) { g.fillStyle = f ? W : (s.beardColor || '#17171b'); g.beginPath(); g.moveTo(x - r * 0.5, hy + r * 0.1); g.quadraticCurveTo(x, hy + r * 1.7, x + r * 0.5, hy + r * 0.1); g.quadraticCurveTo(x, hy + r * 0.35, x - r * 0.5, hy + r * 0.1); g.fill(); }
  if (s.hair) { g.fillStyle = f ? W : '#2b2433'; g.beginPath(); g.arc(x, hy - r * 0.04, r * 0.64, Math.PI, TAU); g.fill(); g.strokeStyle = f ? W : '#2b2433'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - cx * r * 0.2, hy - r * 0.3); g.quadraticCurveTo(x - cx * r * 1.1, hy - r * 0.1, x - cx * r * 1.3, hy + r * 0.7); g.stroke(); }
  if (s.shield) { g.fillStyle = f ? W : s.trim; g.strokeStyle = '#1c2230'; g.lineWidth = 2; g.beginPath(); g.ellipse(x + cx * r * 0.95, by + 2, r * 0.5, r * 1.0, 0, 0, TAU); g.fill(); g.stroke(); }
  if (s.band) { g.fillStyle = f ? W : '#c9cfd8'; g.fillRect(x - r * 0.62, hy - r * 0.3, r * 1.24, r * 0.15); g.fillStyle = f ? W : '#3a8be0'; circle(g, x, hy - r * 0.225, r * 0.1); }
  if (s.hat) { g.fillStyle = f ? W : '#2a6b44'; g.beginPath(); g.arc(x, hy - r * 0.1, r * 0.64, Math.PI * 1.02, TAU * 0.999); g.fill(); g.fillStyle = f ? W : '#d4a73a'; g.fillRect(x - r * 0.64, hy - r * 0.18, r * 1.28, r * 0.12); }
  if (s.wrap) { g.fillStyle = f ? W : '#b3281f'; g.beginPath(); g.arc(x, hy - r * 0.08, r * 0.68, Math.PI * 0.98, TAU + 0.04); g.fill(); }
  if (s.hairCap) { g.fillStyle = f ? W : '#1e1624'; g.beginPath(); g.arc(x, hy - r * 0.04, r * 0.66, Math.PI * 0.95, TAU + 0.05); g.fill(); }
  if (s.crown) { g.fillStyle = f ? W : COLORS.gold; g.beginPath(); g.moveTo(x - r * 0.5, hy - r * 0.5); g.lineTo(x - r * 0.42, hy - r * 1.0); g.lineTo(x - r * 0.2, hy - r * 0.72); g.lineTo(x, hy - r * 1.14); g.lineTo(x + r * 0.2, hy - r * 0.72); g.lineTo(x + r * 0.42, hy - r * 1.0); g.lineTo(x + r * 0.5, hy - r * 0.5); g.closePath(); g.fill(); }
  if (s.flower) { g.fillStyle = f ? W : '#ff9ac8'; for (let k = 0; k < 5; k++) { const an = k * TAU / 5 - 1.2; circle(g, x + r * 0.58 + Math.cos(an) * r * 0.2, hy - r * 0.4 + Math.sin(an) * r * 0.2, r * 0.17); } }
  g.fillStyle = '#111'; for (const sd of [-1, 1]) circle(g, x + sd * r * 0.24 + cx * r * 0.14, hy + sy * r * 0.1 + r * 0.02, r * 0.075);
  if (wp && sy >= 0) drawWeapon(g, s.weapon, x + cx * r * 0.3, by + r * 0.2, wp.ang, wp.len, r);
  g.restore();
}

// 전장 지형: TKC buildBG 의 먼지 황갈색 + 32px 타일 이음매 위에 숲·바위·강·여울을 사전 렌더. map: 0 풀 1 숲 2 바위 3 강 4 여울
function buildTerrain(map, MW, MH, TILE) {
  const c = document.createElement('canvas'); c.width = MW * TILE; c.height = MH * TILE; const g = c.getContext('2d');
  let s = 12345; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  g.fillStyle = COLORS.field; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < MW * MH * 1.2; i++) { g.fillStyle = `rgba(${90 + r() * 60 | 0},${70 + r() * 50 | 0},${40 + r() * 30 | 0},${0.12 + r() * 0.18})`; g.beginPath(); g.ellipse(r() * c.width, r() * c.height, 4 + r() * 16, 2 + r() * 8, 0, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(70,110,50,.45)'; g.fillRect(0, 0, c.width, c.height);
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
    const t = map[ty * MW + tx], x = tx * TILE, y = ty * TILE, v = r();
    g.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.02 + v * 0.09})` : `rgba(255,240,200,${0.012 + (v - 0.5) * 0.07})`; g.fillRect(x, y, TILE, TILE);
    if (t === 3) { g.fillStyle = '#2f5f8a'; g.fillRect(x, y, TILE, TILE); g.strokeStyle = 'rgba(200,230,255,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 4, y + 10 + v * 8); g.quadraticCurveTo(x + 14, y + 4 + v * 8, x + 26, y + 10 + v * 8); g.stroke(); }
    else if (t === 4) { g.fillStyle = '#a89a72'; g.fillRect(x, y, TILE, TILE); for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(90,78,52,.5)'; g.fillRect(x + r() * 28, y + r() * 28, 3, 2); } }
    else if (t === 1) { g.fillStyle = 'rgba(20,50,25,.55)'; g.fillRect(x, y, TILE, TILE); for (let k = 0; k < 2; k++) { const px = x + 8 + k * 14 + r() * 4, py = y + 12 + r() * 10; g.fillStyle = '#4a3320'; g.fillRect(px - 2, py, 4, 10); g.fillStyle = k ? '#2f6a35' : '#27592d'; g.beginPath(); g.arc(px, py, 11, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.arc(px - 3, py - 3, 5, 0, TAU); g.fill(); } }
    else if (t === 2) { g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x + 16, y + 24, 15, 6, 0, 0, TAU); g.fill(); g.fillStyle = `rgb(${110 + r() * 25 | 0},${105 + r() * 20 | 0},${95 + r() * 15 | 0})`; g.beginPath(); g.ellipse(x + 16, y + 17, 14, 11, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.ellipse(x + 12, y + 13, 6, 4, 0, 0, TAU); g.fill(); }
  }
  g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1; g.beginPath();
  for (let x = 0; x <= c.width; x += TILE) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, c.height); }
  for (let y = 0; y <= c.height; y += TILE) { g.moveTo(0, y + 0.5); g.lineTo(c.width, y + 0.5); }
  g.stroke();
  return c;
}
