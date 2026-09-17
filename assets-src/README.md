# 환경이 3D 에셋 원본 (assets-src)

`frontend/public/models/`의 GLB 두 개와 `frontend/public/textures/`의 표정 텍스처는 모두 이 폴더의 스크립트로 만듭니다.
AI 이미지→3D 변환 없이, 기준 이미지 세 장(`reference/`)을 보고 Blender 파이썬으로 직접 모델링·리깅·애니메이션을 했습니다.

## 폴더

```text
blender/
  lib.py                 공용 도구 (잎 모양 생성, 구면·원뿔면 배치, 튜브, 재질, 합치기)
  make_textures.py       표정 6종·배지 문양·도토리 무늬 (Pillow)
  build_character.py     환경이 모델 (머리·후드·새싹·도토리·얼굴 데칼·목깃·잎 튜닉·망토·배지·가방·팔다리·손 소품)
  rig_and_export.py      뼈대 18개 + 동작 클립 16개 → hwangyeongi.glb
  build_village.py       마을 에셋 37종 → village.glb
  preview_*.py           Cycles 미리보기 렌더
blend/
  hwangyeongi_rigged.blend  뼈대·동작이 들어 있는 캐릭터 (Blender 4.5에서 열어 수정)
  village_assets.blend      마을 에셋 모음
reference/               기준 이미지 (01 기본, 02 happy, 03 sad)
previews/                모델·동작·웹 화면 확인 이미지
build_assets.sh          전체 재생성 스크립트
```

## 다시 만들기

```bash
# Blender 앱이 있을 때
BLENDER=blender ./assets-src/build_assets.sh

# bpy 파이썬 모듈을 쓸 때 (pip install bpy==4.5.* pillow, 파이썬 3.11)
BPY=python3 ./assets-src/build_assets.sh
```

약 1분 걸리고, 결과는 `assets-src/build/`(원본 GLB, .blend)와 `frontend/public/`(압축본)에 저장됩니다.

## 자주 고칠 부분

| 바꾸고 싶은 것 | 파일 · 위치 |
|---|---|
| 몸 비율, 머리 크기 | `build_character.py` 맨 위 치수 (`HEAD_R`, `HOOD_R`, `NECK_Z` …) |
| 색 | `build_character.py`, `build_village.py`의 색 상수 (16진수) |
| 표정 모양 | `make_textures.py`의 `face_*` 함수 (눈 위치 `EYE_X`, `EYE_Z`) |
| 동작 | `rig_and_export.py`의 동작 함수 (`idle`, `wave` …) — 회전 축 설명은 파일 맨 위 주석 |
| 새 동작 추가 | 동작 함수를 만들고 `CLIPS`에 이름·길이를 넣은 뒤, `frontend/src/behaviors/actions.js`에서 `clip` 이름으로 사용 |
| 마을 소품 추가 | `build_village.py`에 함수 추가 → 이름으로 `frontend/src/world/layout.js`에 배치 |

`blend/` 파일을 Blender에서 직접 고쳐도 됩니다. 이때는 스크립트를 다시 돌리면 덮어써지므로, 고친 .blend에서 바로 `파일 → 내보내기 → glTF 2.0(.glb)`으로 내보낸 뒤 `build_assets.sh`의 5단계(압축) 명령만 실행하세요. 내보낼 때 애니메이션 모드는 `Actions`로 둡니다.

## 규칙

- 좌표: Blender Z 위, 정면 -Y → glTF Y 위, 정면 +Z
- 캐릭터 오른쪽 = -X (화분을 드는 손), 도토리 장식은 후드 오른쪽 위
- 모든 캐릭터 부품은 뼈 하나에 가중치 100%(망토·끈만 두 뼈 사이 보간)
- 글자가 들어가는 곳(표지판, 분리수거함 이름표)은 모델에 넣지 않고 코드에서 입힘
