# A등급 고유 장수 v0.1.396 — 원소 세력

- 내장 imagegen으로 기존 고유 시트의 인물·복장·무기·색을 유지하고, `lubu-v390`의 큰 머리·굵은 외곽선·부드러운 단계 명암에 맞춰 다시 그렸다.
- `yuan.png`, `yan.png`, `wen.png`은 각각 8열×7행 56컷이다: 대기 8, 보행 16, 찌르기 16, 베기 16.
- 런타임에서는 기존 장수 키를 건드리지 않고 전용 그림 키 `a_yuan`, `a_yan`, `a_wen`으로 연결한다. 병종·판정·능력치는 바꾸지 않는다.
- 검증: `node tools/lubu-faction-atlas.js src/assets/a-heroes-v396`.

