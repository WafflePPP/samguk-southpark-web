# 병사6종 최종 도트

내장 imagegen으로 여포(`lubu-v284/idle.png`)의 도트풍, 고순(`heroes-v293/gao.png`)의 배치와 비율을 참고하여 최종 시트를 직접 제작했다. 중간 원화 제작 없음. PNG 알파 원본은 보존하며 게임에서 최근접 픽셀 추출·축소 및 적군 색상 처리를 한다.

| 외형 | 원본 | 대기 | 보행 | 찌르기/회수·베기/회수 |
|---|---|---:|---:|---:|
| 공통 검보병 | troop_sword.png | 8 | 32 | 32 |
| 공통 창보병 | troop_spear.png | 8 | 24 | 32 |
| 공통 검 방패병 | troop_sword_shield.png | 8 | 32 | 32 |
| 공통 창 방패병 | troop_spear_shield.png | 8 | 24 | 32 |
| 함진병 | f_xian.png | 8 | 24 | 32 |
| 병주 기병 | f_bing.png | 8 | 24 | 32 |

총400개 실제 분리 영역. 64컷 시트는 보행 0→1→2→1의 4박 주기를 사용한다. 432개 고유 원본을 제작했다는 의미가 아니다. 방향 열은 E/SE/S/SW/W/NW/N/NE, 행은 대기→보행3~4→찌르기→회수→베기→회수. 인접 방향 일부는 실루엣 차이가 작으며 정면 창은 몸 뒤로 가려지는 구도가 있다.

공통4종은 남색 천·철갑·단순 투구, 함진병은 흰 술·검은 중갑·사각 방패, 병주 기병은 검은 술·갈색 말로 구분한다. 능력치·병종 분류 변경 없음. 모델은 기존 유닛의 실제 검/창 분류를 읽는다. 검방패와 창방패가 별도 모집 병종으로 추가되는 것은 아니다.

제작 프롬프트와 편집 기록: `prompts.json`. 생성6회, 편집7회. 9행 생성 실패와 프레임 접촉을 검사하여 아래 원본을 채택했다. 나머지 생성 후보는 앱 기본 생성 폴더에 보존한다.

| 프로젝트 파일 | 채택된 생성 파일 |
|---|---|
| troop_sword.png | exec-cc40102a-157c-4247-94b5-df35667a02ad.png |
| troop_spear.png | exec-ce85c750-adbc-4c6e-8672-b5eeebf99e87.png |
| troop_sword_shield.png | exec-f42e542f-a913-45ad-a89f-0ce31ec33634.png |
| troop_spear_shield.png | exec-c2e4ee93-6205-455a-9bb9-e99428b3488d.png |
| f_xian.png | exec-8d3c415e-a0c2-4088-b226-ada54d20ef59.png |
| f_bing.png | exec-dfff9f7e-9b97-4d2b-93f7-4ccbdfdbf2c8.png |

생성 폴더: `C:/Users/neomi/.codex/generated_images/01a17232-e0f8-7d50-a476-eadb04ebd846/`. 게임은 프로젝트의 PNG만 읽는다.

검사: `node tools/hero-rework-atlas.js --root=src/assets/troops-v300`, `node test/troop-rework.test.js`.
