# BGMS Companion 재설계 (스토어 출시 대비)

작성일: 2026-11-13. 상태: 앱 쪽 1~4, 6 구현 완료(커밋 전). 결정은 권고안대로 승인(광고만 먼저). 웹 `bookmark` 허용은 웹 저장소 워크트리 `ka6865/overwolf-bookmark-kind`에 준비, 배포 전.
기준 커밋: 앱 `bbc59f4` (0.5.1) + 커밋 안 된 최장 킬 거리 단위 수정.

## 왜 재설계하나

1. **수익화가 출시의 필수 조건이 됐다.** 2026-11-01부터 Overwolf는 Overwolf 광고나 Tebex 구독을 붙인 앱만 승인한다([monetization overview](https://dev.overwolf.com/ow-native/monetization/overview)). 현재 앱에는 광고를 넣을 화면이 없다.
2. **데스크탑 창이 개발자용 화면이다.** "Phase 1 scope", "Policy guardrails" 패널은 심사·개발용 정보라 사용자 가치가 없다. 광고가 들어가면 "앱 콘텐츠 없이 광고만 있는 창"이 되지 않도록 사용자에게 보여줄 핵심 콘텐츠가 필요하다(광고 정책).
3. **사후 복기 데이터가 불완전하다.** 타임라인은 먼저 들어온 40개만 보관해 후반 사망이 빠질 수 있고, 첫 `matchEnd`에 바로 요약을 보내 이후 사망·순위가 빠질 수 있다. M1 사망 복기와 M2 북마크 모두 이 데이터에 기대므로 먼저 고친다.

## 현재 구조 (as-is)

```
background.js (904줄, 모든 책임)
  ├─ 게임 감지 · GEP 구독/재시도 · 서비스 상태
  ├─ 창 관리 · 핫키 2개 · HUD 위치
  ├─ matchEnd 즉시 → buildSessionSummary → session-queue → POST
  └─ window.bgmsController (구독/명령 API)
gep-state.js     순수 리듀서. 타임라인 40개 선착순, matchEnd 첫 수신에 summaryReady
session-queue.js 순수 재시도 큐
settings.js      opt-in · 닉네임 · 플랫폼
in-game.js       HUD 348x78, 클릭 통과
desktop.js       온보딩 · handoff 설정 · HUD 설정 · 진단 · 개발용 패널 2개
```

장점은 그대로 둔다: 순수 리듀서와 큐는 테스트가 잘 돼 있고, 창은 컨트롤러 스냅샷만 렌더링한다.

## 목표 구조 (to-be)

```
background.js            게임 감지 · GEP · 창 · 핫키 연결만 (얇게)
  ├─ session-queue.js    그대로
  └─ ads.js              [신규] 광고 컨테이너 수명주기 (desktop 창에서 로드)
gep-state.js             타임라인 우선순위 보관 · bookmark 이벤트
desktop.js / .html       화면 재구성 (아래)
in-game.js               그대로 + 북마크 확인 표시 1줄
```

### A. 타임라인 우선순위 보관 (`gep-state.js`)

- `death`, `knockedout`, `revived`, `killer`, `bookmark`는 항상 보관하고, 상한이 차면 가장 오래된 `kill`부터 밀어낸다.
- 상한 40개와 서버 16KB 제한은 유지한다. 시간순 정렬을 보장한다.
- 테스트: 킬 60개 뒤 사망 1개 → 사망이 남는다. 상한 초과 시 길이 40.

결정 결과: 광고만 먼저, 유예 20초, 북마크 `Ctrl+Shift+M`, 데스크탑 기본 1200x720·최소 1000x560.

### B. 매치 마감 (구현: 별도 모듈 대신 `gep-state.js`의 `isSummaryPending`/로비 판정 + `background.js` 타이머)

- 첫 `matchEnd`는 `closing` 상태만 만든다. 요약은 다음 중 먼저 오는 시점에 1회 확정한다.
  1. `phase`가 `lobby`로 돌아옴
  2. 새 `matchStart`(직전 매치를 먼저 확정)
  3. 게임 종료 감지
  4. 유예 타이머 만료(초안 20초, 결정 필요)
- 확정된 요약에는 그 사이 들어온 사망·순위·타임라인이 포함된다. 서버 idempotency(`session_id`)는 그대로다.
- `background.js`는 이 함수의 결과에 따라 `enqueueSessionSummary()`만 호출한다. 판단 로직은 순수 모듈에 두어 node 테스트로 검증한다.

### C. 북마크 핫키 (M2 앱 쪽)

- manifest에 `mark_moment` 핫키 추가(기본키 결정 필요, PUBG 기본키와 충돌 확인).
- 누르면 타임라인에 `{t, kind: "bookmark"}`를 추가하고 HUD에 짧게 "Marked" 표시. 매치당 상한(초안 10개).
- **서버 변경이 필요하다**(BGMS 본체): 타임라인 `kind` 허용 목록에 `bookmark` 추가. 서버가 먼저 배포돼야 422를 피한다.
- 시각은 여전히 로컬 시계 기준이다. 웹은 "대략 이 시점"으로 표시하고 정확한 시점이라고 단정하지 않는다.

### D. 데스크탑 창 재구성 (980x700 기준)

```
┌──────────────────────────────────────────────┬───────────────┐
│ 헤더: BGMS Companion · 게임 상태 · 언어          │               │
├──────────────────────────────────────────────┤   광고 400x300  │
│ [최근 매치 카드] 맵 · 순위 · 헤드샷 · 최장 킬       │  (항상 표시,    │
│   타임라인 요약(사망/기절/북마크 시각)              │  구독 시 숨김)   │
│   [이 매치 복기하기] → bgms.kr 세션 뷰             │               │
├──────────────────────────────────────────────┤               │
│ 탭: 세션 전송 설정 | HUD 설정 | 단축키 | 진단(접힘)   │               │
└──────────────────────────────────────────────┴───────────────┘
```

- "Phase 1 scope", "Policy guardrails" 패널은 삭제한다. 정책 문구는 store listing과 README에 이미 있다.
- 최근 매치 카드는 로컬 상태로 렌더한다(전송 opt-in과 무관하게 표시). 복기 버튼은 opt-in과 공식 `match_id`가 있을 때만 활성화한다.
- 최소 크기 760x520에서도 광고 컨테이너가 400x300 이상 유지되도록 최소 폭을 다시 정한다(약 1000px 예상, 결정 필요).
- 인게임 HUD에는 광고를 넣지 않는다.

### E. 수익화 (`ads.js`)

- 광고 SDK는 `https://content.overwolf.com/libs/ads/latest/owads.min.js`를 async로 불러와 `OwAd`를 desktop 창 컨테이너에 연결한다([OwAd](https://dev.overwolf.com/ow-native/reference/ads/owad)). 로드 실패 시 컨테이너를 비워 두고 앱 기능은 그대로 동작한다.
- 정책 준수: 컨테이너에는 SDK 요소 외 자식 없음, 항상 보이게, 창이 최소화/숨김일 때는 SDK 규칙대로 정지, 영상 광고 컨테이너는 창당 1개.
- 광고 제거 구독(Tebex)은 선택 사항이다. 구독자는 광고만 사라지고 기능 차이는 없다(PUBG API Exclusive Access 금지 준수).
- 빌드: `ads.js`가 스크립트를 JS로 주입하므로 HTML 참조 검사는 바뀌지 않는다. `validate-runtime.js`의 기대 권한 목록에 Ads SDK 권한(`Extensions`, `Streaming`, `Profile`)을 추가했다. Overwolf QA가 광고를 활성화하기 전까지 광고는 나오지 않는다.
- 공식 광고 가이드는 **설정 페이지에 광고를 금지**한다. 그래서 설정을 접힘 영역으로 옮기고 매치 카드를 주 화면으로 했다.

### F. 정리

- `weaponState`는 유지한다. GEP 307 지원 중단 목록의 `inventory`와 달리 공식 PUBG 페이지에 `me` feature 항목으로 남아 있다(2026-11-13 확인).
- 최장 킬 거리 cm→m 수정 커밋.

## 결정 필요

| # | 질문 | 권고 |
|---|---|---|
| 1 | 수익화 방식 | 광고만으로 시작하고, 구독은 출시 후 추가. Tebex 연동 문서·계정 확인 전에는 구현하지 않음 |
| 2 | 매치 마감 유예 시간 | 20초 |
| 3 | 북마크 기본 단축키 | 미정. PUBG 기본키와 겹치지 않는 Ctrl+Shift 조합 |
| 4 | 데스크탑 창 최소 크기 | 1000x560 |
| 5 | 서버 `bookmark` kind 추가 | 앱 C 작업 전에 BGMS 본체에서 먼저 배포 |

## 구현 순서

| 순서 | 작업 | 저장소 | 의존 |
|---|---|---|---|
| 1 | F 정리 + A 타임라인 우선순위 | 앱 | 없음 |
| 2 | B 매치 마감 | 앱 | 1 |
| 3 | D 데스크탑 재구성(광고 자리 포함, 광고 없이) | 앱 | 2 (최근 매치 카드) |
| 4 | E 광고 SDK 연결 | 앱 | 3, 결정 1 |
| 5 | 서버 `bookmark` kind 허용 | BGMS 본체 | 결정 5 |
| 6 | C 북마크 핫키 | 앱 | 2, 5 |
| 7 | M1 사망 복기 | 웹 | 기존 계획 `2026-09-08-death-review.md` |

1~3은 새 권한·feature·payload 키 없이 가능하다. 4는 광고 정책 승인, 6은 payload 값 확장(서버 계약 변경)이 필요하다.

## 검증

- 1~2, 6: `gep-state.test.js`, `background-controller.test.js`(mock으로 matchEnd → 사망 → lobby 순서에서 요약 1회, 사망 포함).
- 3~4: `ui-performance.test.js`에 카드 렌더, 광고 컨테이너 자식 없음, SDK 로드 실패 시 앱 정상 동작. dev-harness에 SDK 목 추가.
- 실게임(Windows): 매치 2판 연속, 사망 뒤 관전·로비 복귀, 게임 강제 종료에서 요약 1회씩 전송되는지. 광고는 Overwolf QA 활성화 전까지 빈 컨테이너가 정상이다.
- 문서: 확인한 Ads SDK·Tebex 사실은 `official-api-notes.md`, 실게임 관측값은 `phase-0-1-validation.md`에 기록한다.
