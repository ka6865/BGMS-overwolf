# BGMS Companion 확장 로드맵

이 문서는 BGMS Overwolf 앱이 Phase 1 MVP 이후 어디까지 확장될 수 있는지 정리한다. 현재 구현 범위는 여전히 Phase 0~1이며, 아래 항목은 구현 지시가 아니라 향후 검토 지도다.

## 문서 기준과 범위

- 기준 확인일: 2026-07-30
- 기준 문서: Overwolf API Overview, Manifest file, Games IDs, Sample App Components, Real-time Game Events, Verifying events for your app, PUBG Game Events, Media/Replays, Notifications, Hotkeys, Language, Windows, OBS, OIDC, Subscriptions 공식 문서
- 이 문서는 공식 문서의 API 카테고리와 PUBG GEP feature를 빠짐없이 훑기 위한 작업 지도다.
- 실제 구현 전에는 해당 API의 최신 문서를 다시 확인한다. Overwolf 기능, permission, 지원 게임, unpacked app 제한은 바뀔 수 있다.
- 공식 문서와 이 문서가 충돌하면 공식 문서를 먼저 확인하고, AGENTS.md와 이 문서를 함께 갱신한다.

## 기준 원칙

- 영어 기본 경험, 한국어 선택형 로컬라이제이션 원칙을 유지한다.
- GEP는 실시간 보조 신호로만 사용하고, 최종 분석 근거는 BGMS의 사후 분석 파이프라인으로 유지한다.
- `damage_dealt`, `location`, `team_location`, 실시간 미니맵, 실시간 DPS, PUBG API 즉시 호출은 별도 승인 전까지 금지한다.
- PUBG 데이터 기반 핵심 기능은 구독자 전용으로 잠그지 않는다.
- Overwolf 클라이언트에 Supabase Service Role Key나 서버 비밀키를 포함하지 않는다.
- 영상, 스크린샷, 계정, 알림, 구독, 외부 서비스 연동은 각각 별도 권한, 사용자 동의, 저장 정책, 심사 리스크를 먼저 검토한다.

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
| `kill` | kills, headshots, total_damage_dealt, max_kill_distance, kill/headshot/damage_dealt/fire 이벤트 | `kill` 이벤트와 kills 카운터만 허용 | Phase 1 | `damage_dealt`, `total_damage_dealt`, 실시간 DPS 금지. `headshots`/`max_kill_distance`는 Phase 1.5 후보 |
| `revived` | 로컬 플레이어 revive 이벤트 | 허용 | Phase 1 | 표시용 카운터만 사용 |
| `death` | death, damageTaken 이벤트 (+ status 엔드포인트에만 있는 `knockedout`) | `death`, `knockedout` 허용 | Phase 1 | `damageTaken`은 실시간 피해성 신호라 차단. `knockedout`은 문서 미기재라 보조 표시로만 사용 |
| `killer` | 로컬 플레이어를 죽인 killer nickname | 허용 | Phase 1 | 신뢰도 높은 분석 근거로 사용하지 않음 |
| `match` | mode, match_id, matchStart, matchEnd | 허용 | Phase 1 | matchEnd 중복 수신 idempotent 필요 |
| `match_info` | pseudo_match_id | 허용 | Phase 1 | `match_id`와 `pseudo_match_id` 모두 안전 처리 |
| `rank` | 종료 시 순위/총원 | 후보 | Phase 2 | info key가 `match_info.me`로 `me` feature와 겹치므로 feature 기준 분기 필수 |
| `counters` | ping 등 성능 카운터 | 후보 | Phase 4 | 성능 HUD 후보, 핵심 분석과 분리 |
| `location` | 로컬 좌표 | 금지 | Phase 3+ 별도 승인 | Phase 0~1에서 실시간 미니맵/좌표 처리 금지 |
| `me` | health, weaponState, stance, view, movement 등 로컬 상태 | health(ko_health 포함)/weaponState만 허용 | Phase 1 | 추가 상태 표시 확대는 HUD 복잡도와 심사 리스크 검토 |
| `team` | nicknames, team_location, team_index | 대부분 보류/금지 | Phase 3+ 별도 승인 | `team_location` 금지, nicknames/team_index도 개인정보/표시 목적 검토 필요 |
| `phase` | lobby/loading_screen/airfield/aircraft/freefly/landed | 허용 | Phase 1 | overlay 상태 표시 핵심. 관측값 `starting` 별도 기록 |
| `map` | 현재 맵 이름 | 후보 | Phase 2 | 위치 없이 맵 이름만 표시하는 것은 후보, 미니맵으로 연결 금지 |
| `roster` | 전체 플레이어 roster와 out 상태 | 보수적 허용 | Phase 1 | status key는 `roster`, 실제 info key는 `roster_XX` |
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

완료 (2026-07-30 기준):

- Overwolf 로드, manifest, launch_events, background controller 안정화
- base game id `10906` 기준 targeting, 런타임 instance id 환산
- GEP payload 파서를 `gep-state.js` 순수 모듈로 분리하고 `npm test`로 회귀 방어
- `onError`, game events status 엔드포인트, GEP 버전 진단 노출
- 리스너 remove-then-add, `setRequiredFeatures` 성공 판정 강화
- 금지 payload(`damage_dealt`, `total_damage_dealt`, `damageTaken`, `location`)를 리듀서에서 차단하고 진단에만 기록
- compact HUD + click-through, 영어 기본 UI, 한국어 optional, Overwolf 언어 기반 초기 선택

남은 항목:

- GEP Simulator/실게임에서 `me`, `roster`, `knockedout` 실제 수신 재확인
- Developer Console 제출용 store listing/아이콘/스크린샷 정리
- `.opk` 패키징 후 unpacked 제한 기능 재확인
- `headshots`, `max_kill_distance`, `rank`, `map` 표시 여부 결정 (Phase 1.5/2)

### Phase 2 세션 handoff

목표는 매치 종료 후 BGMS 웹 분석으로 자연스럽게 이어지는 것이다.

- `matchEnd` 이후 세션 요약 1회 전송
- 중복 `matchEnd` idempotent 처리
- `session_id`, `match_id`, `pseudo_match_id`, `client_environment`, `gep_summary` 스키마 확정
- rank, map, gep_internal version 같은 사후 요약 보조 필드 검토
- BGMS 서버 신규 네임스페이스만 사용: `app/api/overwolf/session/route.ts`
- PUBG API 직접 호출 금지, 기존 BGMS 레이트리밋 경로만 사용

### Phase 3 하이라이트와 캡처

목표는 숫자 분석에 영상/이미지 복기 경험을 붙이는 것이다.

- `media.takeScreenshot()` 기반 수동/이벤트 기반 스크린샷
- `media.replays.turnOn()` 후 `capture()` 또는 자동 하이라이트 후보 검토
- kill, death, revived, matchEnd 이벤트에 북마크 또는 클립 연결
- `getHighlightsFeatures(gameId)`로 PUBG 자동 하이라이트 지원 여부 확인
- 캡처 저장 위치, 용량 제한, 사용자 opt-in 설정 필수
- 캡처 시작/중지/실패 이벤트와 파일 삭제 UX를 같이 설계
- 캡처 기능은 Phase 1 오버레이보다 권한과 성능 리스크가 크므로 별도 승인 후 구현

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
