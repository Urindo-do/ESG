# 환경이 마을 3D 홈 화면 (frontend)

청결 점수(0~100)에 따라 캐릭터 '환경이'와 숲 마을이 **기본 · happy · sad** 세 단계로 바뀌는 Three.js + Vite 화면입니다.
캐릭터와 마을 소품은 코드로 조립하지 않고 Blender에서 만든 GLB 파일을 불러옵니다. 원본과 재생성 방법은 `../assets-src/`에 있습니다.

## 실행

Node.js 22.12 이상에서 이 폴더 기준으로 실행합니다.

```bash
npm install
npm run dev        # http://127.0.0.1:5173 (로그인 또는 "로그인 없이 둘러보기"로 들어가면 홈 화면에 개발용 패널이 항상 보임)
npm test           # 점수 구간·이동 경로·행동 전환 검사 (11개)
npm run build      # dist/ 생성
npm run preview    # 빌드 결과 확인
```

로그인 화면이 앱 진입점(`src/main.js`)이 되면서 URL 파라미터(`?score=`·`?dev=1`)는 더 이상 쓰지 않습니다. 홈 화면(`src/app/screens/home.js`)이 `createVillage`를 부를 때 항상 `dev: true`를 넘겨서, 로그인 계정이든 게스트든 홈 화면에 개발용 패널(청결 점수 슬라이더·행동 버튼)이 뜹니다. 이 패널의 조작은 화면 미리보기용이며 실제 점수(로그인 계정은 `profiles.score`, 게스트는 메모리 값)를 저장하지 않습니다.

## 세 가지 상태

| 점수 | 상태 | 캐릭터 | 마을 |
|---|---|---|---|
| 70 이상 | happy (반짝반짝) | 웃는 눈(^^), 폴짝 뛰기·손 흔들기, 새싹 화분 | 루피너스·데이지가 가득, 반딧불·반짝이·빛줄기, 개울에 물고기 |
| 30~69 | 기본 (보통) | 기본 표정, 물 주기·씨앗 심기·낙엽 쓸기·낮잠 등 | 초록 들판과 맑은 개울, 나비와 떨어지는 나뭇잎 |
| 30 미만 | sad (꼬질꼬질) | 걱정 눈썹·눈물, 먼지 얼룩, 시든 새싹, 마른 가지 | 갈라진 땅, 마른 나무, 쓰레기·기름 웅덩이, 탁한 개울, 공장과 스모그 |

- 구간 값(70/30), 전환 시간, 먼지가 묻기 시작하는 점수는 `src/config.js` 한 곳에서 바꿉니다. 기획서 7장 점수 규칙을 바꾸면 여기도 같이 고칩니다.
- 먼지·시듦은 점수에 따라 연속으로 변합니다. 55점부터 조금씩 묻기 시작해 10점에서 최대입니다.
- 세 상태의 하늘·안개·조명 색은 `src/scene/Sky.js`, 땅 색은 `src/scene/Ground.js` 맨 위 표에서 조정합니다.

## 기획서 프롬프트와 다른 점

`기획서/환경이_3D화면_프롬프트.md`는 5단계와 '도토리 모자·나뭇가지 뿔' 캐릭터를 기준으로 쓰였습니다. 이 구현은 팀이 새로 정한 기준을 따릅니다.

- 청결 단계는 5단계가 아니라 기본·happy·sad 3단계입니다. 먼지·시듦만 점수에 따라 연속으로 변합니다.
- 캐릭터는 기준 이미지 세 장(`assets-src/reference/`)의 새싹 후드 디자인입니다. 새싹 잎, 후드 옆 도토리 장식, 나무 배지, 잎 튜닉, 가죽 가방, 도토리 화분을 갖추고 있습니다.
- 연결 약속(API) 함수 이름과 역할은 프롬프트와 같습니다.

## 연결 약속(API)

3D 화면은 로그인·카메라·AI·저장을 직접 하지 않습니다. 아래 함수와 이벤트로만 주고받습니다.

```js
import { createVillage } from './village.js';

const village = createVillage(document.querySelector('#app'), {
  initialScore: 62,
  remaining: { meal: 3, product: 2, phrase: 10 },
});

await village.ready;                              // GLB 로딩 완료 (그 전에 호출해도 안전)
village.setCleanliness(75);                       // 0~100, 상태 전환 연출 포함
village.setRemaining({ meal: 2, product: 2, phrase: 9 });
village.celebrate(10);                            // +10 표시, 정화 효과, 폴짝
const off = village.onMissionSelect(kind => {     // 'meal' | 'product' | 'phrase'
  // 여기서 카메라 화면을 열고, Supabase Edge Function 판정 결과를 받아
  // setCleanliness / setRemaining / celebrate 를 호출한다.
});
village.getState();                               // { score, mood, remaining, action }
village.dispose();                                // 화면을 떠날 때
```

Supabase와 연결할 때의 흐름(예시)은 다음과 같습니다.

```js
village.onMissionSelect(async kind => {
  const photo = await openCamera(kind);                            // 3D 모듈 밖에서 구현
  const { data } = await supabase.functions.invoke('judge', { body: { kind, photo } });
  if (data.accepted) {
    village.setCleanliness(data.score);
    village.setRemaining(data.remaining);
    village.celebrate(data.points);
  }
});
```

API 키나 비밀번호는 이 폴더의 코드에 넣지 않습니다.

## 폴더 구조

```text
src/
  main.js                 앱 진입 — 로그인/게스트/홈 화면 전환 (Supabase 연결은 app/ 폴더, 구조는 연결명세 참고)
  village.js              createVillage 와 연결 약속(API), 렌더러·카메라·클릭 처리
  config.js               점수 구간, 전환 시간, 에셋 경로, 미션 목록
  states/mood.js          점수 → 상태, 부드러운 전환 가중치, 먼지·시듦 정도
  scene/Sky.js            하늘 셰이더, 상태별 하늘·안개·조명 색
  scene/Ground.js         섬 지형(흙길·개울·갈라진 땅), 개울 물, 기름 웅덩이
  scene/Effects.js        반딧불·반짝이·먼지·나뭇잎·공장 연기, 빛줄기, 나비, 정화 효과
  world/layout.js         마을 배치 좌표, 장애물, 개울·흙길 정의 (숫자만 바꿔 배치 조정)
  world/World.js          village.glb 복제·배치, 꽃·풀 인스턴싱, 나무 교체, 쓰레기·공장·물고기
  character/Hwangyeongi.js 캐릭터 GLB, 동작 전환, 표정 교체, 손 소품, 먼지 셰이더 연결
  character/grime.js      먼지(uDirt)·시듦(uWither) 셰이더 패치
  behaviors/actions.js    행동 목록(상태별), 클릭 대상 → 행동 연결
  behaviors/navigation.js 장애물 회피 A* 경로
  behaviors/BehaviorController.js 이동·앉기·행동·자동 전환 상태기계
  ui/UI.js, ui/styles.css 한글 UI (게이지, 미션 버튼, 보조 버튼, 말풍선, 개발용 패널)
public/models/            hwangyeongi.glb (캐릭터), village.glb (마을 에셋) — meshopt 압축
public/textures/          표정 텍스처 6종 (기본·깜박임·happy·sad·sad 깜박임·잠)
tests/village.test.js     node --test 검사
```

## 캐릭터 GLB 규격

- 키 약 1.26m(새싹 끝까지), 발바닥 원점, 정면 +Z, 약 3만 1천 삼각형(소품 포함), 압축 후 약 450KB
- 뼈: `root, hips, spine, head, sprout, leaf_L, leaf_R, arm_L/R, hand_L/R, socket_L/R, leg_L/R, cape, bag`
- 동작 클립 16개: `idle, happy_idle, sad_idle, walk, sad_walk, jump, wave, water, plant, sweep, shake, pickup, sleep, sit_sad, stretch, look`
- 메시 이름으로 켜고 끄는 소품: `prop_pot`(기본·happy), `prop_twig`(sad). 물뿌리개·빗자루·모종삽은 `socket_R`에 코드로 붙입니다.
- 표정은 `face` 재질의 텍스처를 바꿔 끼웁니다(텍스처는 glTF 규칙에 맞춰 `flipY = false`).

## 클릭하면 하는 행동

물뿌리개 → 물 주기, 텃밭·모종삽 → 씨앗 심기, 빗자루 → 낙엽 쓸기, 벤치 → 낮잠, 개울·징검다리 → 산책, 표지판 → 손 흔들기, 집 → 기지개, 우편함 → 편지 확인, 분리수거함 → 살피기, 쓰레기(sad) → 줍기 후 멈칫, 환경이 → 상태별 반응(기본: 손 흔들기, happy: 점프, sad: 먼지 털기)

## 검증 기록

- `npm test` 11개 통과: 점수 구간, 가중치 합, 먼지 단조 증가, 모든 행동 목적지 경로, 쓰레기 주변 설 자리, 상태별 자동 행동 연속성, 줍기→멈칫, 벤치 앉기·내려오기, 일시 정지, 상태 변경 시 행동 교체
- `npm run build` 성공
- 헤드리스 Chromium(소프트웨어 WebGL)에서 1280×800, 390×844 화면으로 세 상태와 물 주기·낙엽 쓸기·씨앗 심기·낮잠·쓰레기 줍기·정화 효과 화면을 확인 (`../assets-src/previews/`)

## 아직 확인하지 않은 것

- 실제 휴대폰에서의 프레임 속도와 발열 (소프트웨어 렌더러에서만 확인). happy 상태가 가장 무겁습니다(꽃·풀 인스턴스 약 20만 삼각형, 기본 약 6만 5천, sad 약 7천). 느리면 `world/World.js`의 꽃 개수나 `config.js`의 `RENDER` 값을 줄이세요.
- 한글 글꼴(Jua, Gowun Dodum)은 Google Fonts에서 받습니다. 연결이 안 되면 시스템 한글 글꼴로 표시됩니다.
- 동작은 코드로 키를 잡은 단순 루프입니다. 더 자연스러운 동작이 필요하면 `assets-src/blend/hwangyeongi_rigged.blend`에서 직접 다듬고 다시 내보내면 됩니다.
