# BGMS Companion 확장 로드맵

이 문서는 BGMS Overwolf 앱이 Phase 1 MVP 이후 어디까지 확장될 수 있는지 정리한다. 현재 구현 범위는 여전히 Phase 0~1이며, 아래 항목은 구현 지시가 아니라 향후 검토 지도다.

## 문서 기준과 범위

- 기준 확인일: 2026-08-01 (경쟁 앱 조사 및 사용자 가치 기준 추가), 공식 API 기준 확인일 2026-07-31
- 기준 문서: Overwolf API Overview, Manifest file, Games IDs, Sample App Components, Real-time Game Events, Verifying events for your app, PUBG Game Events, Media/Replays, Notifications, Hotkeys, Language, Windows, OBS, OIDC, Subscriptions 공식 문서
- 이 문서는 공식 문서의 API 카테고리와 PUBG GEP feature를 빠짐없이 훑기 위한 작업 지도다.
- API 가능성과 별개로 사용자 가치 판단 기준을 함께 둔다. Overwolf appstore PUBG 카테고리와 PUBG 개발자 포털 featured apps 조사 결과를 근거로 한다.
- 실제 구현 전에는 해당 API의 최신 문서를 다시 확인한다. Overwolf 기능, permission, 지원 게임, unpacked app 제한은 바뀔 수 있다.
- 공식 문서와 이 문서가 충돌하면 공식 문서를 먼저 확인하고, AGENTS.md와 이 문서를 함께 갱신한다.

## 기준 원칙

- 영어 기본 경험, 한국어 선택형 로컬라이제이션 원칙을 유지한다.
- GEP는 실시간 보조 신호로만 사용하고, 최종 분석 근거는 BGMS의 사후 분석 파이프라인으로 유지한다.
- `damage_dealt`, `location`, `team_location`, 실시간 미니맵, 실시간 DPS, PUBG API 즉시 호출은 별도 승인 전까지 금지한다.
- PUBG 데이터 기반 핵심 기능은 구독자 전용으로 잠그지 않는다.
- Overwolf 클라이언트에 Supabase Service Role Key나 서버 비밀키를 포함하지 않는다.
- 영상, 스크린샷, 계정, 알림, 구독, 외부 서비스 연동은 각각 별도 권한, 사용자 동의, 저장 정책, 심사 리스크를 먼저 검토한다.
- **게임이 이미 화면에 보여주는 정보를 오버레이에 중복 표시하지 않는다.** 아래 "사용자 가치 기준" 절을 따른다.

## 사용자 가치 기준 (2026-08-01 추가)

기술 실현 가능성과 별개로, 기능을 추가하기 전에 사용자 관점에서 아래를 통과해야 한다. 경쟁 앱 조사(같은 날짜) 결과 현재 오버레이 구성이 이 기준을 통과하지 못한다는 점이 확인됐다.

1. **배그 기본 HUD가 이미 보여주는 정보인가?** 그렇다면 오버레이에 넣지 않는다. 킬 수, 생존자 수, 체력, 무기 상태, 킬 로그는 모두 게임 내장 HUD와 킬피드에 이미 있다.
2. **앱 내부 상태가 아니라 플레이어에게 의미 있는 정보인가?** 전송 대기 건수, GEP 진단, 서비스 상태는 앱 상태이며 사용자 가치가 아니다. 문제가 있을 때만 노출한다.
3. **BGMS만 할 수 있는 일인가?** 단순 카운터와 매치 히스토리는 경쟁 앱이 이미 무료로 제공한다. BGMS의 고유 자산은 텔레메트리 기반 맵/동선 분석이다.
4. **실시간이어야 하는 이유가 있는가?** 없으면 사후 분석으로 옮긴다. 실시간 정책 리스크를 피하면서 BGMS 강점에 붙는다.

### 경쟁 앱 조사 결과 (2026-08-01)

출처: Overwolf appstore PUBG 카테고리, PUBG 개발자 포털 featured apps.

| 앱 | 제공 내용 | BGMS와의 관계 |
| --- | --- | --- |
| Statsly | 매치 히스토리, 사후 분석(킬/어시스트/로드아웃/생존 시간/타임라인), 무료 광고형 | 사실상 대표 경쟁자. 숫자·타임라인 중심이며 맵 분석은 없다 |
| Match Bar (PUBG featured) | 세션을 따라가며 라이브 게임 데이터를 기록해 사후 분석에 사용 | **아키텍처가 우리와 거의 동일하다.** 단순 세션 기록만으로는 차별화가 안 된다 |
| Outplayed | 킬/데스 자동 클립 녹화 | Phase 3 `media.replays` 후보와 겹친다 |
| Ouch | 플레이 중 사망 장면 리뷰 | 프레이밍이 BGMS에 가장 잘 맞는다. 아래 참고 항목 |
| RazerShot | 에임 훈련(리코일/트래킹/플릭) | 영역이 다르다 |
| PUBGUmbra | 최근 14일 기준 마주친 상대 정보 | 영역이 다르다 |

Overwolf PUBG 카테고리에는 18개가 걸려 있지만 Hone(FPS 최적화), BUFF(보상), Insights Capture, Mobalytics 등은 크로스게임이거나 배그 전용이 아니다.

### 차별화 포지션

경쟁 앱 전부가 다루지 않는 영역은 맵 기반 위치·동선 분석이다. Statsly는 숫자, Outplayed는 영상, Ouch는 사망 클립이다.

따라서 BGMS의 차별화는 실시간이 아니라 **사후**에 둔다. 매치가 끝나면 GEP 요약이 넘어가고, BGMS 웹에서 공식 API 텔레메트리로 동선·자기장·교전 지점을 맵 위에 보여주는 흐름이다. 이 구조에서 GEP는 트리거 역할만 하고 분석 근거는 공식 API가 되므로, 실시간 위치 금지 원칙을 지키면서 경쟁 앱이 못 하는 영역을 차지한다.

### 참고할 경쟁 앱 패턴

- **Ouch의 사망 리뷰 프레이밍**: GEP가 `death`와 `killer`를 실시간으로 주므로 그 순간을 북마크해 두고, 사후에 텔레메트리로 해당 지점의 맵 상황을 보여준다. 현재 구독 중인 feature만으로 가능하다.
- **Statsly의 무료 광고형 모델**: PUBG API 약관 Exclusive Access 금지 조항 때문에 데이터 기능을 유료로 잠글 수 없다. 광고 제거만 유료로 두는 구조가 정책과 자연스럽게 맞는다. Phase 7 방향과 일치한다.
- **Outplayed의 자동 하이라이트**: Phase 3 `media.replays` 항목과 동일하다. `VideoCaptureSettings` 권한, 저장 용량, 사용자 동의 검증이 선행 조건이다.

### 공식 Best Practices 재점검 (2026-08-01)

공식 문서 `guides/general-product/best-practices` 의 목차를 항목별로 대조했다. API 카테고리 지도와 달리 이 문서는 제품 관점 요구사항이라 별도 점검이 필요했다.

| 항목 | 현재 상태 | 판단 |
| --- | --- | --- |
| Hotkeys ("앱 설정에서 조합을 확인/변경할 수 있게") | **미충족이었다 → 2026-08-01 구현** | 데스크탑 창에 실제 할당된 조합을 표시하고 Overwolf 설정으로 보내는 버튼을 추가했다 |
| Tooltips | 충족 | 닫기 버튼, 아이콘 버튼, 미수신 라벨에 `title` 이 있다 |
| Window controls | 충족 | 드래그 이동, 닫기, 위치/크기 기억 |
| In and Out-of-game behavior | 충족 | 데스크탑 창과 인게임 오버레이가 분리되어 있고 각각 다른 역할을 한다 |
| Error notifications | 충족 | `isServiceDegraded` 기반 경고 라인과 진단 자동 펼침 |
| App look'n'feel | 충족 | BGMS 웹과 같은 다크 테마, 일관된 컴포넌트 |
| Analytics | 미도입 | 사용자 동의와 개인정보 범위를 먼저 정해야 한다. Phase 4 검토 |
| Ad container placeholder | 미도입 | Phase 7 수익화 항목. 광고 도입 결정 전에는 자리만 비워둔다 |
| App's size | 충족 | 패키지 76KB |
| FTUE (첫 사용자 경험) | **미충족** | 아래 참조 |
| App support page | 부분 충족 | 커뮤니티로 나가는 링크는 생겼지만 FAQ/트러블슈팅 페이지 자체는 없다 |
| Ask for feedback | **2026-08-01 구현** | 데스크탑 창 하단에 커뮤니티/Discord 링크 추가 |
| Discord server | **2026-08-01 구현** | 앱에서 BGMS Discord 로 바로 나갈 수 있다 |

#### 2026-08-01 구현: 핫키 안내

공식 문서가 "앱 설정 패널에서 핫키 조합을 확인하고 바꿀 수 있게 하라" 고 명시한다. 기존에는 `Ctrl+Shift+B` 를 사용자가 알 방법이 앱 안에 전혀 없었다.

- `overwolf.settings.hotkeys.get` 으로 **실제 할당된 조합**을 읽어 표시한다. manifest 의 `default` 를 그대로 쓰면 사용자가 Overwolf 설정에서 바꿨을 때 잘못된 안내를 하게 된다
- 응답의 `games` 는 class id 별 배열이므로 PUBG(10906) 항목을 우선 보고, 없으면 전체를 훑는다
- 조합 변경은 앱 안에서 직접 할 수 없다. `overwolf://settings/hotkeys` 로 Overwolf 설정 화면을 여는 것이 공식 경로다
- `Hotkeys` 권한으로 이미 가능해 manifest 권한이 늘지 않았다

#### 2026-08-01 구현: 피드백 경로

공식 문서가 in-app 피드백 링크를 권하고, 그것을 넣은 뒤 리뷰와 피드백이 늘어난 사례를 든다. 데스크탑 창 하단에 BGMS 커뮤니티와 Discord 링크를 추가했다.

- 링크는 `EXTERNAL_LINKS` 화이트리스트 키로만 열린다. 임의 URL 을 넘겨도 아무것도 열리지 않는다
- `overwolf.utils.openUrlInDefaultBrowser` 로 기본 브라우저에서 연다. 앱 안에서 웹을 렌더링하지 않는다
- 새 permission 이 필요하지 않았다

#### 남은 미충족 항목 (Phase 4 후보)

- **FTUE**: 설치 직후 첫 화면이 설정 패널이다. 공식 문서는 "앱이 무엇을 하고 다음에 무엇을 해야 하는지" 안내하는 화면을 권한다. 현재는 전송을 켜고 닉네임을 넣어야 가치가 생기는데 그 안내가 없다
- **지원 페이지**: 앱에서 커뮤니티로 나가는 링크는 생겼지만, FAQ 와 트러블슈팅과 변경 이력을 담은 페이지 자체는 아직 없다. `bgms.kr` 아래에 만드는 것이 자연스럽다

### Statsly 재관찰: 세션 단위 집계 (2026-08-01 구현)

Statsly 가 매치 히스토리를 세션 단위로 묶어 보여준다. 매치를 하나씩만 나열하면 "오늘 어땠는지" 를 알 수 없다는 점이 우리 화면에도 그대로 있었다.

`groupByPlaySession` 을 추가해 매치 사이 간격이 90분을 넘으면 다른 플레이 세션으로 끊고, 묶음마다 시간 범위, 판수, 누적 처치/헤드샷, 최고 순위, 평균 순위를 머리글에 표시한다. 순위를 받지 못한 매치는 평균에서 제외한다.

### 권고 방향과 근거 (2026-08-01)

**핵심 근거**: 공식 GEP 문서 확인 결과 `match_id`가 공식 PUBG API match id 와 같은 체계다(`match.bro.official.pc-...` 형식, 문서에 "Can be compared and checked at this link"). 즉 GEP 세션을 공식 API 매치와 연결할 수 있다. 반면 `pseudo_match_id`는 Overwolf 생성값이라 조회 키로 쓸 수 없다. 자세한 내용은 `official-api-notes.md` 참조.

이 사실이 방향을 결정한다. BGMS는 이미 공식 API 텔레메트리 기반 맵 분석 자산을 갖고 있고, GEP는 그 분석을 **어느 매치에 대해 언제 시작할지 알려주는 트리거**로서 가치가 있다. 실시간 표시 경쟁에 뛰어들 필요가 없다.

권고하는 우선순위:

1. **Phase 1.5 오버레이 재편** — 새 권한 없이 가능하고, 스토어 제출 전에 끝내야 한다(표시 항목이 listing 문구와 스크린샷을 결정한다). 배그 HUD 중복을 덜어내고 `headshots`/`max_kill_distance` 같은 게임이 안 보여주는 값으로 채운다.
2. **Phase 2 웹 연결 화면** — 출시 가치의 최소 조건. `match_id`로 공식 API 매치와 연결해 BGMS 맵 분석으로 진입하는 경로를 만든다. 이 경로가 경쟁 앱과의 유일한 실질 차별점이다.
3. **Phase 3 사후 사망 리뷰** — `death`/`killer` 타임스탬프를 요약에 남기고 사후에 맵 위에서 보여준다. 권한 불필요.

피해야 할 방향:

- 실시간 표시 항목을 늘려 경쟁하는 것. 배그 HUD와 중복되거나 정책 금지 영역에 접근한다.
- 세션 요약을 숫자 나열로만 보여주는 것. Statsly와 Match Bar가 이미 하는 일이며 차별점이 없다.
- 웹 연결 없이 스토어에 제출하는 것. "보냈는데 볼 곳이 없는" 상태로는 앱을 켤 이유를 설명할 수 없다.

## 공식 문서 기준 기능 지도

아래 기능 지도는 Overwolf 공식 API Reference의 전체 카테고리를 기준으로 BGMS 적합도를 분류한 것이다.

| 영역 | 공식 기능 | BGMS 활용 가능성 | 우선순위 | 주의 |
| --- | --- | --- | --- | --- |
| `version` | 클라이언트 버전 확인 | 특정 Overwolf 버전 이하에서 기능 비활성 | 낮음 | 호환성 방어용 |
| `benchmarking` | 하드웨어/FPS 정보 | 성능 진단 보조 | 보류 | 공식 문서상 deprecated |
| `campaigns` / cross-app campaign | 캠페인/교차 홍보 | BGMS 웹서비스 홍보, 파트너 앱 연결 | 낮음 | 심사/광고 정책 검토 필요 |
| `cryptography` | 로컬 데이터 암복호화 | OAuth 토큰, 로컬 설정 보호 | 중간 | 민감정보 저장 최소화 우선 |
| `extensions` | 앱 상태, manifest, 다른 앱 실행 | 자기 상태 점검, Companion 내 진단 | 낮음 | 다른 앱 의존은 최소화 |
| `games` | 실행 게임 ID, 해상도, 실행/종료 감지 | 현재 구현 핵심 | 높음 | PUBG game id 검증 필요 |
| `games.events` | GEP live events/info | 현재 구현 핵심 | 높음 | `setRequiredFeatures()` 재시도, `onError` 처리, payload 검증 필수 |
| game events status (REST) | `https://game-events-status.overwolf.com/10906_prod.json` | GEP 장애를 사용자에게 알림 | 높음 | 구현 완료. `externally_connectable`에 도메인 등록 필요, 상태 반영 10분 지연 |
| `games.tracked` | unsupported game 추적 | PUBG 외 확장 후보 | 보류 | 현재 PUBG 전용 정책 유지 |
| `io` | 파일 존재 확인/쓰기 | 로컬 로그, payload export, 설정 백업 | 낮음 | 파일 권한과 개인정보 주의 |
| `logitech` | Logitech LED/ARX | 이벤트 기반 키보드 LED 피드백 | 낮음 | 부가 기능, 핵심 경험 아님 |
| `media` | 스크린샷, 미디어 이벤트 | 킬/데스/리바이브 순간 캡처 | 중간 | `Media` 권한, 저장소, 사용자 동의 필요 |
| `media.replays` | 짧은 리플레이, 자동 하이라이트 | 핵심 확장 후보 | 높음 | `VideoCaptureSettings`, 용량/성능/지원 이벤트 확인 필요 |
| `media.videos` | 영상 파일 정보/삭제/합성 | 하이라이트 관리, 세션 리뷰 클립 정리 | 중간 | 파일 보관/삭제 UX 필요 |
| `notifications` | Windows toast | 매치 종료, 분석 준비 알림 | 중간 | unpacked app에서는 toast가 동작하지 않는다고 문서에 명시됨 |
| `os` | OS 관련 기능 | 트레이, 환경 점검 | 낮음 | 필요 시에만 |
| `profile` | Overwolf 계정 정보 | 사용자 식별 보조 | 중간 | BGMS 계정과 혼동 금지 |
| `profile.subscriptions` / Subscriptions API | 구독 상태 관리 | 광고 제거 같은 비핵심 유료 옵션 | 낮음 | PUBG 데이터 기반 핵심 기능 게이팅 금지 |
| `settings` | 핫키, 언어, 캡처 설정 | 현재 및 확장 핵심 | 높음 | `Hotkeys`, language, video folder/settings 연동 가능 |
| `settings.hotkeys` | 핫키 조회/등록/변경 이벤트 | HUD 토글, 디버그 토글, 북마크, 클립 저장 | 높음 | 중복/충돌/사용자 재설정 UX 필요 |
| `settings.language` | Overwolf 언어 조회/변경 이벤트 | 기본 언어 자동 선택 | 중간 | 영어 기본값은 유지 |
| `social` | YouTube, Discord, Reddit | 하이라이트 공유 | 낮음 | 사용자 명시 동의와 심사 검토 필요 |
| `streaming` | 게임 캡처/스트리밍 | 방송/녹화 특화 기능 | 보류 | `media.replays`보다 복잡하고 권한 리스크 큼 |
| `utils` | 시스템 정보, URL 열기, 키 입력 | BGMS 웹 분석 열기, 시스템 진단 | 중간 | `sendKeyStroke`는 GameControl 권한과 정책 검토 필요 |
| `web` | 로컬 HTTP 서버 | 로컬 디버그/브릿지 | 보류 | 보안/방화벽/심사 리스크 큼 |
| `windows` | 창 생성/위치/크기/메시지/상태 | 현재 구현 핵심 | 높음 | background controller + window 통신 구조 유지 |
| `OBS` | OBS 연동 | 스트리머용 장면/표시 제어 | 장기 | OBS 사용자를 위한 별도 모드로 검토 |
| `OIDC` | Overwolf OpenID Connect | BGMS 계정 연결 후보 | 장기 | BGMS Auth 설계와 별도 검토 |
| `ads` | 광고 | 무료 앱 수익화 | 장기 | 사용자 경험과 정책 검토 필요 |

## PUBG GEP feature 전체 점검표

아래 표는 PUBG 공식 GEP 문서의 Available Features 기준이다. Phase 1은 허용 feature만 사용한다.

| Feature | 공식 제공 내용 | BGMS 판단 | 단계 | 주의 |
| --- | --- | --- | --- | --- |
| `gep_internal` | GEP local/public version 정보 | 진단용으로 이미 사용 | Phase 1 | 구독하지 않아도 수신됨. 디버그 패널에만 표시 |
| `kill` | kills, headshots, total_damage_dealt, max_kill_distance, kill/headshot/damage_dealt/fire 이벤트 | `kill` 이벤트와 kills 카운터 허용. `headshots`/`max_kill_distance` 추가 검토 | Phase 1 / 1.5 | `damage_dealt`, `total_damage_dealt`, 실시간 DPS 금지. kills 카운터는 게임 HUD와 중복이라 Phase 1.5에서 축소 검토. `headshots`/`max_kill_distance`는 게임이 매치 중 표시하지 않으므로 추가 우선순위가 높다 |
| `revived` | 로컬 플레이어 revive 이벤트 | 허용 | Phase 1 | 표시용 카운터만 사용 |
| `death` | death, damageTaken 이벤트 (+ status 엔드포인트에만 있는 `knockedout`) | `death`, `knockedout` 허용 | Phase 1 | `damageTaken`은 실시간 피해성 신호라 차단. `knockedout`은 문서 미기재라 보조 표시로만 사용 |
| `killer` | 로컬 플레이어를 죽인 killer nickname | 허용 | Phase 1 | 신뢰도 높은 분석 근거로 사용하지 않음 |
| `match` | mode, match_id, matchStart, matchEnd | 허용 | Phase 1 | matchEnd 중복 수신 idempotent 필요 |
| `match_info` | pseudo_match_id | 허용 | Phase 1 | `match_id`와 `pseudo_match_id` 모두 안전 처리 |
| `rank` | 종료 시 순위(`me`)와 총원(`total`), 둘 다 category `match_info`, 문자열 값 (예: `"38"`, `"98"`) | 후보 (우선순위 상향) | Phase 2 | info key가 `match_info.me`로 `me` feature와 겹치므로 feature 기준 분기 필수. 사후 요약의 핵심 지표이며 게임 결과 화면을 놓친 경우 가치가 있다. 값이 문자열이므로 숫자 변환 필요 |
| `counters` | ping 등 성능 카운터 | 후보 | Phase 4 | 성능 HUD 후보, 핵심 분석과 분리 |
| `location` | 로컬 좌표 | 금지 | Phase 3+ 별도 승인 | Phase 0~1에서 실시간 미니맵/좌표 처리 금지 |
| `me` | health, weaponState, stance, view, movement 등 로컬 상태 | health(ko_health 포함)/weaponState만 허용 | Phase 1 | 추가 상태 표시 확대는 HUD 복잡도와 심사 리스크 검토. health/weaponState는 게임 HUD와 중복이므로 Phase 1.5에서 표시 축소 검토. `ko_health` 기반 KO 표시는 게임 표현과 달라 판단 보류 |
| `team` | nicknames, team_location, team_index | 대부분 보류/금지 | Phase 3+ 별도 승인 | `team_location` 금지, nicknames/team_index도 개인정보/표시 목적 검토 필요 |
| `phase` | lobby/loading_screen/airfield/aircraft/freefly/landed | 허용 | Phase 1 | overlay 상태 표시 핵심. 관측값 `starting` 별도 기록 |
| `map` | 현재 맵 이름 | 후보 | Phase 2 | 위치 없이 맵 이름만 표시하는 것은 후보, 미니맵으로 연결 금지. 사후 요약에서 BGMS 맵 분석과 연결하는 키로는 가치가 있다 |
| `roster` | 전체 플레이어 roster와 out 상태 | 보수적 허용 | Phase 1 | status key는 `roster`, 실제 info key는 `roster_XX`. 생존자 수는 게임 HUD와 중복이라 Phase 1.5에서 표시 축소 검토 |
| `victimName` | 문서 미기재. status 엔드포인트에서 state 0(unsupported) | 사용 안 함 | 보류 | 지원 상태가 되면 재검토 |

## 심사와 패키징 체크포인트

- `manifest.json`은 앱 루트에 있어야 하며, 패키징 시 압축 파일 최상위에 `manifest.json`이 보여야 한다.
- Appstore 제출용 manifest는 기본 필드 외에 `dock_button_title`, `icon_gray`, `launcher_icon`, `window_icon` 같은 제출 요구 필드를 확인한다.
- GEP를 쓰는 앱은 `game_events` 대상 게임과 `minimum-gep-version` 필요 여부를 확인한다.
- 자동 시작은 `launch_events`에서 PUBG `GameLaunch` 흐름을 확인한다.
- 새 permission을 추가할 때는 사용자 승인 영향, 심사 문구, store listing 설명을 함께 갱신한다.
- unpacked extension에서 안 되는 기능은 실제 패키지 상태에서 별도 검증한다. notifications가 대표 사례다.

## 단계별 확장 로드맵

### Phase 1 안정화

목표는 심사 가능한 오버레이 MVP다.

완료 (2026-07-31 기준):

- Overwolf 로드, manifest, launch_events, background controller 안정화
- base game id `10906` 기준 targeting, 런타임 instance id 환산
- GEP payload 파서를 `gep-state.js` 순수 모듈로 분리하고 `npm test`로 회귀 방어
- `onError`, game events status 엔드포인트, GEP 버전 진단 노출
- 리스너 remove-then-add, `setRequiredFeatures` 성공 판정 강화
- 금지 payload(`damage_dealt`, `total_damage_dealt`, `damageTaken`, `location`)를 리듀서에서 차단하고 진단에만 기록
- compact HUD + click-through, 영어 기본 UI, 한국어 optional, Overwolf 언어 기반 초기 선택
- 오버레이 표시 설정(모드/투명도/위치)과 데스크탑 진단 패널
- 세션 핸드오프 실동작화: opt-in 동의, BGMS 닉네임/플랫폼 입력, 로컬 큐 + 백오프 재시도, 오버레이 대기 표시
- BGMS 서버 수신 경로 구현: `app/api/overwolf/session`, `overwolf_session_events` 테이블, session_id 기준 idempotency, 세션 쿼터, 90일 보존 정리

남은 항목:

- GEP Simulator/실게임에서 `me`, `roster`, `knockedout` 실제 수신 재확인
- Developer Console 제출용 store listing/아이콘/스크린샷 정리
- `.opk` 패키징 후 unpacked 제한 기능 재확인

### Phase 1.5 오버레이 재구성 (2026-08-01 구현 완료)

목표는 오버레이를 "게임 HUD 복제"에서 "게임이 안 보여주는 것"으로 바꾸는 것이다. 위 사용자 가치 기준 1번을 통과하지 못하는 현재 구성을 정리한다.

HUD 에서 제거 완료 (배그 기본 HUD와 중복). 리듀서는 계속 수집하며 세션 요약과 사후 분석에 사용한다:

- 킬 수: 게임 내장 HUD에 이미 있어 제거
- 생존자 수: 게임 화면 상단에 이미 있어 제거
- 체력: 게임 하단 체력바에 이미 있어 제거. `ko_health` 기반 KO 플래그는 게임 표현과 달라 유지
- 무기 상태: 게임 하단 무기 슬롯에 이미 있음. 화면에는 노출하지 않고 스크린리더용으로만 유지
- 최근 이벤트: 상태 줄에 유지. 팀원 기절 후 본인 마무리처럼 킬피드가 놓치는 경우를 다룬다

추가 완료 (게임이 매치 중 보여주지 않는 정보):

- `headshots`, `max_kill_distance` (`kill` feature). HUD 에 표시한다
- `rank` (종료 시 순위/총원). 값이 있을 때만 HUD 에 노출한다. feature 기준 분기로 `me` 와 분리했다
- `map` (맵 이름). HUD 에는 넣지 않고 세션 요약과 웹 화면에서 사용한다

진단 패널 처리 (완료):

- 데스크탑 진단 14항목을 `<details>` 기반 기본 접힘으로 바꿨다. `isServiceDegraded` 가 true 가 되면 한 번 자동으로 펼치고, 사용자가 접은 뒤에는 강제로 다시 펼치지 않는다
- 오버레이 debug 모드는 유지한다. 실게임 검증에 필요하다

새 permission 이나 금지 데이터를 쓰지 않았다. 실측 결과 최악 케이스(순위 + KO + 3자리 거리 + Loading 페이즈)에서 334px/334px 로 넘침이 없다. store listing 문구와 스크린샷은 이 구성 기준으로 다시 준비해야 한다.

### Phase 2 세션 handoff (전송 경로 완료, 분석 연계 미착수)

목표는 매치 종료 후 BGMS 웹 분석으로 자연스럽게 이어지는 것이다.

완료 (2026-07-31):

- `matchEnd` 이후 세션 요약 1회 전송, 중복 `matchEnd` idempotent 처리(클라이언트 + 서버 양쪽)
- `session_id`, `match_id`, `pseudo_match_id`, `player_id`, `platform`, `client_environment`, `gep_summary` 스키마 확정
- BGMS 서버 신규 네임스페이스만 사용: `app/api/overwolf/session/route.ts`
- 전송 실패 시 로컬 큐 보존과 지수 백오프 재시도, 영구 거부(4xx) 구분

남은 항목:

**최우선 항목 완료 (2026-08-01)**: 저장된 세션 요약을 BGMS 웹에서 볼 수 있는 화면을 구현했다.

- `app/overwolf/sessions` 화면과 `components/overwolf/OverwolfSessionList.tsx`. 닉네임/플랫폼으로 조회하고 세션 카드에 순위, 처치, 헤드샷, 최장 킬, 사망/기절/부활을 보여준다
- `app/api/overwolf/sessions/route.ts`(GET) + `list_overwolf_sessions` / `get_overwolf_session` RPC. 읽기도 `service_role` 전용이며 `source_host`/`is_internal` 은 반환하지 않는다
- 데스크탑 창의 "내 세션 기록 열기" 버튼이 `overwolf.utils.openUrlInDefaultBrowser` 로 이 화면을 연다. 이 API 는 별도 permission 을 요구하지 않아 manifest 권한이 늘지 않았다
- 공식 API 조회 가능 여부를 `gep_summary.official_match_id` 로 분리해 담고, 화면은 `canOpenAnalysis` 가 true 인 세션만 `/stats/{platform}/{nickname}` 분석 경로로 연결한다. `pseudo_match_id` 만 있는 세션은 "공식 매치 ID 미수신" 으로 표기하고 링크를 만들지 않는다
- 2026-08-01 운영 배포 완료(BGMS PR #128). `https://bgms.kr/overwolf/sessions` 와 `https://bgms.kr/api/overwolf/sessions` 가 동작한다

그다음:

- 실게임에서 `match_id` 실제 emit 여부 확인. `pseudo_match_id` 만 온다면 분석 연결이 성립하지 않으므로 이 방향의 전제가 흔들린다
- 세션 상세를 특정 매치의 텔레메트리 맵 분석으로 직접 연결. 현재는 플레이어 전적 화면까지만 연결한다
- 세션 요약을 근거로 사후 분석을 자동 트리거하는 흐름. PUBG API 직접 호출 금지와 기존 레이트리밋 경로 준수가 전제이며 별도 승인이 필요하다

차별화 연결점: 이 화면이 단순 숫자 요약이면 Statsly, Match Bar와 구분되지 않는다. BGMS 텔레메트리 맵 분석으로 이어지는 진입점이 되어야 한다. 위 "차별화 포지션" 절을 따른다.

### Phase 3 하이라이트와 캡처

목표는 숫자 분석에 영상/이미지 복기 경험을 붙이는 것이다.

- `media.takeScreenshot()` 기반 수동/이벤트 기반 스크린샷
- `media.replays.turnOn()` 후 `capture()` 또는 자동 하이라이트 후보 검토
- kill, death, revived, matchEnd 이벤트에 북마크 또는 클립 연결
- `getHighlightsFeatures(gameId)`로 PUBG 자동 하이라이트 지원 여부 확인
- 캡처 저장 위치, 용량 제한, 사용자 opt-in 설정 필수
- 캡처 시작/중지/실패 이벤트와 파일 삭제 UX를 같이 설계
- 캡처 기능은 Phase 1 오버레이보다 권한과 성능 리스크가 크므로 별도 승인 후 구현

영상 없이 먼저 할 수 있는 것 (권한 불필요, 우선 검토):

영상 없는 사후 리뷰 1단계 완료 (2026-08-01):

- `death`, `killer`, `knockedout`, `revived`, `kill` 수신 시점을 세션 요약의 `event_timeline` 에 담는다. 항목은 `{ t: 경과초, kind, detail? }` 이며 좌표와 데미지는 담지 않는다
- 경과 초는 `matchStart` 기준이고 시작 시각을 모르면 `null` 이다. 최대 40건으로 제한한다
- 웹 세션 카드에서 "교전 시점" 을 펼치면 `1:30 기절`, `7:00 처치`, `24:30 가해자 Ace_Tullis` 형태로 시각순 정렬해 보여준다
- 새 permission 없이 현재 구독 feature 만 사용했다

남은 항목:

2026-08-01 추가 완료 — 저장된 시점에서 맵 리플레이로 직접 진입:

- GEP `match_id` 문자열 끝의 UUID 가 BGMS 텔레메트리 `match_id` 와 동일하다는 것을 확인했다. `extractTelemetryMatchId` 로 추출해 기존 `/replay/3d` 화면에 그대로 넘긴다
- 세션 카드의 "맵 리플레이 열기" 가 주된 행동이 됐고, 타임라인 각 항목에 "이 시점" 버튼이 붙어 `t=420` 형태로 그 순간으로 진입한다
- `/replay/3d` 가 `t` 를 읽어 텔레메트리 로드 후 해당 시점으로 이동한다. `parseReplayStartMs` + `resolveReplaySeekMs` 순수 함수로 분리해 테스트로 고정했다
- 이것이 Ouch 프레이밍을 BGMS 맵 분석 강점에 붙이는 지점이다. 경쟁 앱은 숫자(Statsly), 영상(Outplayed), 클립(Ouch)이고 맵 기반 시점 복기는 다루지 않는다

남은 항목:

- 실게임에서 `match_id` 가 실제로 emit 되는지 확인. `pseudo_match_id` 만 오면 UUID 추출이 성립하지 않아 리플레이 연결이 끊긴다
- 영상/스크린샷 캡처는 `media` 권한 검증 후 별도 승인 대상이다

### Phase 4 개인화와 설정

목표는 사용자가 방해받지 않는 HUD를 직접 조정하는 것이다.

- HUD 위치 프리셋, compact/expanded 모드, 디버그 표시 토글
- Overwolf hotkey settings deep link 제공
- Overwolf client language 기반 기본 언어 자동 선택
- ping 같은 성능성 counter 표시 여부를 optional HUD로 검토
- 로컬 설정 export/import는 필요할 때만 `io` 또는 localStorage 기반으로 검토

### Phase 5 BGMS 계정 연동

목표는 Overwolf Companion과 BGMS 웹 계정을 연결하는 것이다.

- OIDC 또는 BGMS 자체 Auth 흐름 검토
- Overwolf profile 정보는 보조 신호로만 사용
- BGMS 계정 식별과 PUBG player identity를 혼동하지 않음
- 토큰 저장이 필요하면 cryptography 사용 가능성을 검토하되, 민감정보 저장 최소화를 우선

### Phase 6 크리에이터/공유 기능

목표는 하이라이트와 분석 결과를 공유 가능한 자산으로 만드는 것이다.

- Discord, YouTube, Reddit 공유는 사용자가 명시적으로 선택할 때만 제공
- OBS/streaming 연동은 스트리머용 별도 모드로 분리
- broadcast-safe HUD와 streamer-only control panel 분리 검토

### Phase 7 수익화와 운영

목표는 정책을 지키는 지속 가능한 운영 모델을 만드는 것이다.

- 광고 제거, 편의 설정, 저장공간 관리 같은 비핵심 기능만 유료 후보로 둔다.
- PUBG 데이터 기반 분석 핵심 기능을 구독자 전용으로 잠그지 않는다.
- ads, subscriptions, cross-app campaign은 Overwolf 심사와 PUBG API 약관을 함께 검토한 뒤 결정한다.

## 기능별 결정 기준

- `사용자가 켤 이유가 되는가?`: 위 "사용자 가치 기준" 4개 질문을 먼저 통과해야 한다. 기술적으로 가능하다는 것만으로는 부족하다.
- `Phase 1에 넣을 수 있는가?`: 허용 Feature만 쓰고, 실시간 표시만 하며, 기존 BGMS 본체를 건드리지 않으면 가능하다.
- `Phase 2 승인 대상인가?`: 서버 저장, 세션 handoff, 분석 트리거와 연결되면 Phase 2 승인 대상이다.
- `Phase 3 이상인가?`: 위치, 영상, 스크린샷, 계정, 공유, 구독, OBS, 스트리밍은 별도 승인과 정책 검토가 필요하다.
- `즉시 금지인가?`: 실시간 데미지 미터, 실시간 DPS, location/team_location 미니맵, PUBG API 즉시 호출, 클라이언트 비밀키 포함은 금지다.

## 테스트와 검증 기준

- 새 Overwolf API를 쓰기 전 공식 문서에서 permission, manifest field, unsupported/deprecated 여부를 확인한다.
- API 사용 전 GEP Simulator 또는 Overwolf sample app으로 payload와 상태 변화를 확인한다.
- media/replays는 저장 위치, 용량, 사용자가 켠 상태, 캡처 실패 이벤트를 반드시 테스트한다.
- notifications는 unpacked app에서 동작하지 않는다는 문서 조건을 감안해 패키지 상태에서 검증한다.
- windows 변경은 실제 게임 해상도, DPI, fullscreen/borderless/windowed 모드에서 확인한다.

## 참고 공식 문서

- Overwolf API Overview: https://dev.overwolf.com/ow-native/reference/ow-api-overview/
- Manifest file: https://dev.overwolf.com/ow-native/reference/manifest/manifest-json/
- Sample app components: https://dev.overwolf.com/ow-native/getting-started/onboarding-resources/sample-app-components/
- Real-time Game Events: https://dev.overwolf.com/ow-native/live-game-data-gep/live-game-data-gep-intro/
- PUBG Game Events: https://dev.overwolf.com/ow-native/live-game-data-gep/supported-games/playerunknowns-battlegrounds/
- Hotkeys API: https://dev.overwolf.com/ow-native/reference/settings/hotkeys-api/
- Language API: https://dev.overwolf.com/ow-native/reference/settings/language-api/
- Media API: https://dev.overwolf.com/ow-native/reference/media/ow-media/
- Replays API: https://dev.overwolf.com/ow-native/reference/media/replays/
- Notifications API: https://dev.overwolf.com/ow-native/reference/notifications/overwolf-notifications/
- Windows API: https://dev.overwolf.com/ow-native/reference/windows/ow-windows/
- OBS API: https://dev.overwolf.com/ow-native/reference/obs/
- OIDC API: https://dev.overwolf.com/ow-native/reference/overwolf-oidc/ow-oidc/
- App Subscriptions API: https://dev.overwolf.com/ow-native/reference/subscriptions-api/
