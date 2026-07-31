# BGMS Companion 공식 API 기준 노트

이 문서는 Overwolf PUBG GEP 테스트 중 헷갈리지 않도록 공식 문서에서 확인한 API 호출, feature, payload 기준을 정리한다. 구현 지시가 아니라 기준표이며, 실제 구현 전에는 링크된 공식 문서를 다시 확인한다.

**최근 확인일: 2026-07-31**

## 기준 문서

- Overwolf Real-time Game Events intro: https://dev.overwolf.com/ow-native/live-game-data-gep/live-game-data-gep-intro/
- Overwolf `overwolf.games.events` API: https://dev.overwolf.com/ow-native/reference/games/events/
- PUBG Game Events: https://dev.overwolf.com/ow-native/live-game-data-gep/supported-games/playerunknowns-battlegrounds/
- Verifying events for your app (status 엔드포인트): https://dev.overwolf.com/ow-native/live-game-data-gep/verifying-events-for-your-app
- Games IDs (game id vs instance id): https://dev.overwolf.com/ow-native/guides/dev-tools/games-ids
- Manifest file: https://dev.overwolf.com/ow-native/reference/manifest/manifest-json
- Language API: https://dev.overwolf.com/ow-native/reference/settings/language-api
- Windows API: https://dev.overwolf.com/ow-native/reference/windows/ow-windows/

## 코드 구조 기준

- `gep-state.js`: GEP payload -> 세션 상태 리듀서. Overwolf API를 호출하지 않는 순수 모듈이므로 macOS/node에서 단위 테스트한다.
- `background.js`: Overwolf API 호출(창, 게임 감지, GEP 구독, 네트워크)만 담당하고 payload 해석은 `gep-state.js`에 위임한다.
- `session-queue.js`: 세션 요약 전송 큐. 백오프와 재시도 판정만 담당하는 순수 모듈이다.
- `settings.js`: 핸드오프 동의, BGMS 닉네임, 플랫폼 저장. 여기에는 어떤 키나 비밀값도 담지 않는다.
- 테스트: `npm test` (`node --test --test-force-exit overwolf-app/tests/*.test.js`). 실게임/Overwolf 클라이언트 의존성이 없다. `--test-force-exit`는 컨트롤러가 큐 flush interval을 유지하기 때문에 필요하다.
- payload 파서를 수정할 때는 `overwolf-app/tests/gep-state.test.js`에 공식 예시 payload 기준 케이스를 함께 추가한다.

## Game ID 기준 (2026-07-30 확인)

공식 문서 기준으로 PUBG의 game id는 `10906`이고, `overwolf.games.getRunningGameInfo()` / `onGameInfoUpdated`가 주는 `id`는 instance digit이 붙은 값이다.

- manifest의 `game_targeting.game_ids`, `game_events`, `launch_events.game_ids`에는 **base game id `10906`만** 넣는다.
- 런타임 비교는 `Math.floor(gameInfo.id / 10)` 또는 `RunningGameInfo.classId`로 한다.
- 로컬 테스트에서 관측된 `109061`은 instance id이므로 manifest에 넣지 않는다. (이전 manifest에 두 값을 모두 넣었던 것은 오류였고 2026-07-30에 수정)

## GEP 호출 순서

공식 문서 기준으로 GEP는 기본 상태에서 게임 변화를 듣지 않는다. 앱이 사용할 feature를 `overwolf.games.events.setRequiredFeatures(features, callback)`로 등록해야 한다.

우리 앱의 Phase 1 허용 feature (`gep-state.js`의 `REQUIRED_FEATURES`와 동일):

- `match`
- `match_info`
- `phase`
- `kill`
- `death`
- `revived`
- `killer`
- `roster`
- `me`

공식 문서상 권장 흐름:

1. PUBG 실행 감지
2. background/controller에서 `setRequiredFeatures()` 호출
3. `success === true` 이고 `supportedFeatures.length > 0` 일 때까지 제한된 횟수로 재시도 (공식 예시는 3초 간격)
4. `onInfoUpdates2`로 Game Info update 수신
5. `onNewEvents`로 one-shot event 수신
6. `onError`로 GEP 오류 수신
7. 필요 시 `getInfo()`로 현재 Game Info snapshot 조회

중요한 공식 주의점:

- `setRequiredFeatures()`는 background controller에서 호출하는 것이 권장된다.
- `setRequiredFeatures()`는 실패할 수 있으므로 재시도가 필요하다. 성공 판정은 `success` 플래그 + `supportedFeatures` 존재로 한다.
- `onInfoUpdates2` / `onNewEvents`는 **remove 후 add**가 공식 best practice다(중복 리스너 방지).
- 게임 중간에 앱이 시작되면 missing event 또는 unreliable data가 발생할 수 있다.
- GEP data를 log file에 기록하는 것은 피해야 한다.
- 오류/경고는 사용자에게 알리는 것이 공식 권장 사항이다.

### `onError` (2026-07-30 확인)

- `overwolf.games.events.onError`는 `{reason: string}` 형태의 ErrorEvent를 준다.
- 현재 구현은 이 이벤트를 받으면 `gepStatus = "error"`, `gepErrorReason`을 채우고 오버레이/데스크탑에 표시한다.

### `getInfo()` 응답 형태

- 공식 `GetInfoResult`는 `{success, error, res}`이고 현재 info snapshot은 `res`에 담긴다.
- 클라이언트 버전에 따라 `info` 키로 오는 사례가 있어 구현에서는 `res`와 `info`를 모두 파싱한다.

## Game events status 엔드포인트 (2026-07-30 확인)

공식 문서가 앱에서 직접 조회하도록 안내하는 상태 엔드포인트가 있다.

- 전체 게임: `https://game-events-status.overwolf.com/gamestatus_prod.json`
- 특정 게임: `https://game-events-status.overwolf.com/10906_prod.json`

state 코드:

| state | 의미 |
| --- | --- |
| 0 | unsupported |
| 1 | green (정상) |
| 2 | yellow (일부 이벤트 사용 불가) |
| 3 | red (이벤트 사용 불가) |

- 서버 상태 반영에 10분 정도 지연이 있을 수 있다.
- 현재 구현은 PUBG 감지 시 이 엔드포인트를 1회 조회하고, 데스크탑 창의 `Refresh diagnostics`로 재조회한다. 실패하면 조용히 무시한다(진단 보조).
- manifest `externally_connectable.matches`에 `https://game-events-status.overwolf.com`을 넣어야 CORS가 허용된다.

### 2026-07-30 status 조회 관측값 (`10906_prod.json`)

전체 state는 `1`(green)이었고, Phase 1 사용 feature 모두 state 1로 확인됐다.

- `phase`: `phase`(game_info)
- `me`: `health`(me), `weaponState`(inventory), `name`/`stance`/`view`/`movement`/`aiming`/`bodyPosition`/`inVehicle`/`freeView`(me), `jump`(event)
- `roster`: `roster`(match_info)
- `match`: `match_id`, `mode`(match_info), `matchStart`, `matchEnd`(event)
- `match_info`: `pseudo_match_id`(match_info)
- `kill`: `kills`, `headshots`, `total_damage_dealt`, `max_kill_distance`(match_info), `kill`, `headshot`, `damage_dealt`, `fire`(event)
- `death`: `death`, `damageTaken`, **`knockedout`**(event)
- `killer`, `revived`, `rank`, `map`, `counters`, `location`, `team`: 모두 state 1

공식 문서와 다른 관측:

- `death` feature에 **`knockedout` 이벤트**가 status 목록에 있으나 PUBG 문서 표에는 없다. 구현에서는 수신 시 기절 카운터로만 쓰고, 신뢰도 높은 근거로 취급하지 않는다.
- status 목록에 **`victimName`** feature가 state 0(unsupported)으로 존재한다. 문서화되지 않은 feature이므로 구독하지 않는다.
- `roster` feature의 status key 이름은 `roster`이지만 실제 info update key는 `roster_XX`다.

## PUBG Phase 1 사용 feature

### `phase`

- feature `phase`, category `game_info`, key `phase`
- 공식 값: `lobby`, `loading_screen`, `airfield`, `aircraft`, `freefly`, `landed`
- 테스트 관측값: `starting`이 실제 overlay/desktop 진단에서 관측됐다. 2026-07-08 실게임에서 같은 매치 중 `starting` 유지 화면도 관측됐다.

처리 기준:

- 공식값 외 phase가 들어와도 UI에는 그대로 표시하고, `phaseIsOfficial` 플래그로 공식 목록 여부를 구분해 세션 요약에 남긴다.
- `matchStart` 직전에 phase update가 먼저 들어올 수 있으므로, matchStart 세션 초기화 시 최신 phase를 보존한다.

### `me`

- category `me`, key `health` / category `inventory`, key `weaponState`
- 공식 health 예시: `{"health":"{\"health\":100,\"ko_health\":100}"}`
- 공식 weaponState 필드: `name`(string), `equipped`(bool), `count`(int)

처리 기준:

- `health` 값은 문자열 JSON 또는 객체일 수 있으므로 `safeParse()` 후 `health`, `value`를 보수적으로 읽는다.
- `ko_health`를 함께 저장하고 `health === 0 && ko_health > 0`이면 기절(KO)로 표시한다. 데미지 수치는 표시하지 않는다.
- `health`가 한 번도 수신되지 않았다면 HUD에서 HP 항목을 숨긴다.
- `name`, `stance`, `view`, `movement` 등 나머지 `me` key는 Phase 1 표시 범위 밖이므로 무시한다.
- 2026-07-08 실게임 테스트에서 `Supported features`에는 `me`가 보였지만 `Seen features`는 `game_info | gep_internal`에 머문 화면이 관측됐다. 2026-07-30 status 조회에서 `me` feature는 green이므로, 이 관측은 서비스 장애가 아니라 시점/세션 문제로 본다.

### `roster`

- feature `roster`, category `match_info`, key `roster_XX`
- 공식 예시: `{"info":{"match_info":{"roster_0":"{\"player\":\"Dr4ex\",\"kills\":\"0\",\"out\":false}"}},"feature":"roster"}`
- `out: false`는 alive, `out: true`는 died 또는 quit. player가 airfield phase에 join할 때 roster item이 report된다.

처리 기준:

- `roster_XX` value는 문자열 JSON 또는 객체일 수 있으므로 `safeParse()`한다.
- `out`이 확실할 때만 alive count를 갱신한다. 판독 불가면 이전 alive count를 유지한다.

### `kill`

- info key `kills`(category `match_info`), event `kill`
- 공식 known issue: 팀원이 knock하고 local player가 finish한 경우 kill event가 발생하지 않는다.

처리 기준:

- `kills` info는 절대값으로 덮어쓰고, `kill` event는 +1 증분으로 처리한다.
- `headshots`, `max_kill_distance`는 Phase 1.5 후보로 두고 현재는 무시한다.

금지 항목:

- `damage_dealt`(event), `total_damage_dealt`(info)는 실시간 사용 금지. 공식 PUBG 문서에 post-match 용도로만 사용 가능하다고 명시되어 있다.
- 리듀서의 `BLOCKED_INFO_KEYS` / `BLOCKED_EVENT_NAMES`가 이 값을 상태에 반영하지 않고 진단의 `Ignored updates`에만 남긴다.

### `match`

- info key `mode`, `match_id`(category `match_info`), event `matchStart`, `matchEnd`
- 공식 주의점: `matchEnd`는 플레이어가 죽을 때와 로비로 나갈 때 각각 발생해 중복 수신될 수 있다.

처리 기준:

- `matchEnd`는 세션 단위로 idempotent 처리한다. 첫 수신에서만 요약 전송 대상이 되고 이후에는 `matchEndCount`만 증가한다.
- `matchStart` 시 기존 `matchId`, `pseudoMatchId`, `effectiveMatchId`, `matchMode`와 GEP 진단값을 보존하고 카운터만 초기화한다.
- `matchStart` 시 `session_id`는 새로 발급한다. 서버 idempotency 키가 매치 간 충돌하지 않게 하기 위함이다.
- 2026-07-31: 서버 수신 경로가 구현되어 `matchEnd` 첫 수신 시 요약이 로컬 큐에 적재되고 BGMS 엔드포인트로 1회 전송된다. 클라이언트 중복 방지와 별개로 서버도 `session_id` PK 기준 idempotent 처리한다.

### `match_info`

- info key `pseudo_match_id`(category `match_info`)
- `match_id`와 `pseudo_match_id`를 모두 보존하고 `match_id || pseudo_match_id`를 `effectiveMatchId`로 사용한다.

### match_id 와 공식 API 연결 가능성 (2026-08-01 공식 문서 재확인)

공식 PUBG GEP 문서의 `match` feature 표 기준이다.

- `match_id` 예시값: `match.bro.official.pc-2018-03.steam.solo.eu.2019.05.07.08.ce8d1a14-b2af-41c8-8bf4-d2a504326630`. 문서는 이 값을 "Can be compared and checked at this link"라고 설명한다. 즉 **공식 PUBG API match id 와 같은 체계다.**
- `pseudo_match_id` 예시값: `0c0ea3df-97ea-4d3a-b1f6-f8e34042251f`. 문서가 "Overwolf-generated code which is unrelated to the match ID given above"라고 명시한다. **공식 API 조회 키로 쓸 수 없다.**

따라서 사후 분석 연결은 `match_id`가 있을 때만 성립하고, `pseudo_match_id`는 세션 식별용 대체값으로만 쓴다. `effectiveMatchId`가 `pseudo_match_id`로 채워진 경우를 공식 API 조회에 넘기지 않도록 구분이 필요하다.

실게임에서 확인할 것: 현재 PUBG 세션에서 `match_id`가 실제로 emit 되는지, 그리고 그 값이 공식 API `matches/{id}` 응답과 일치하는지. 문서상 `match_id`는 GEP 120.0부터이고 `pseudo_match_id`는 130.0.15부터다.

### `gep_internal` (구독하지 않음)

- 공식 payload: `{"info":{"gep_internal":{"version_info":"{\"local_version\":\"157.0.1\",\"public_version\":\"157.0.1\",\"is_updated\":true}"}},"feature":"gep_internal"}`
- 실게임 테스트에서 구독하지 않아도 `gep_internal`이 `Seen features`에 나타났다. `REQUIRED_FEATURES`에 추가하지 않고, 수신되면 진단용 GEP 버전 표시에만 사용한다.

### Phase 1에서 무시하는 feature

`rank`, `map`, `team`, `counters`, `location`은 구독하지 않는다. 구독하지 않아도 payload가 들어올 수 있으므로 리듀서에서 feature 기준으로 분기해 상태에 반영하지 않는다.

특히 `rank`의 info key는 `match_info.me`이고 `me` feature와 key 이름이 겹친다. key만 보고 분기하면 rank 값이 `me.health`를 오염시키므로 **feature를 먼저 신뢰**해야 한다. (2026-07-30 리듀서 분리 시 수정, 회귀 테스트 존재)

## Manifest 기준 (2026-07-30 확인)

- `meta.minimum-gep-version`: GEP 데이터를 쓰는 앱만 설정. Phase 1 사용 key 중 가장 늦게 추가된 것은 `me.health`(GEP 135.0)이므로 `"135.0"`으로 설정했다. (`weaponState` 130.0.9, `pseudo_match_id` 130.0.15, `roster_XX` 119.1)
- `meta.dock_button_title`: Appstore 제출 시 요구되는 dock 표시 이름.
- in-game 창 속성:
  - `clickthrough: true` (0.80): 창이 클릭을 게임으로 통과시킨다. 패시브 HUD에 적합하다.
  - `ignore_keyboard_events: true` (0.83): 키 입력을 게임으로 통과시킨다.
  - `keep_window_location: true` (0.101): 게임 포커스 변화 시 창이 이동하지 않는다.
- `externally_connectable.matches`: 외부 도메인 CORS 허용 목록. 후행 슬래시를 넣지 않는다.

## 언어 API 기준 (2026-07-30 확인)

- 공식 호출은 `overwolf.settings.language.get(callback)`이고 결과는 `{success, language}`(두 자리 ISO)다. `onLanguageChanged` 이벤트도 있다.
- 현재 구현은 사용자가 앱에서 언어를 고른 적이 없을 때만 Overwolf 언어가 `ko*`이면 한국어를 적용한다. 기본값은 영어이며 한국어는 optional localization이다.

## 현재 테스트 판정 기준

desktop 진단을 기준으로 판단한다.

- `Event service status`가 yellow/red다: Overwolf 측 GEP 장애다. 앱 수정 대상이 아니고 사용자에게 알리면 된다.
- `Supported features`에 `me`/`roster`가 없다: `setRequiredFeatures()` 결과에서 현재 GEP가 해당 feature를 지원하지 않은 상태다.
- `Supported features`에는 있지만 `Seen features`에 없다: 구독은 됐지만 현재 세션/시점에서 info update가 아직 오지 않은 상태다.
- `Missing updates`에 표시된다: 구독 결과에는 포함됐지만 `onInfoUpdates2`/`getInfo()`에서 아직 보지 못한 상태다.
- `Ignored updates`에 `blocked:*`가 있다: 금지 payload가 들어왔고 정상적으로 차단됐다.
- `Ignored updates`에 `unused:*`가 있다: Phase 1 미사용 feature가 들어왔고 상태에 반영되지 않았다.
- `GEP error`에 사유가 있다: `onError` 수신 상태다.
- `phase`는 category가 `game_info`이므로 `game_info` 수신을 phase 수신으로 간주한다.
- `me`가 있는데 HP가 안 뜬다: `health` payload 구조 보정 필요. 먼저 `npm test`에 실패 케이스를 추가한다.
- `roster`가 있는데 Alive가 안 뜬다: `roster_XX` payload 구조 보정 필요. 동일하게 테스트 먼저 추가한다.
- `phase`도 없다: `setRequiredFeatures`, game id, launch timing, GEP availability 문제를 먼저 확인.

## 현재 구현과 공식 기준 차이

- 공식 phase 목록에는 `starting`이 없지만 실제 테스트에서 관측됐다.
- 공식 PUBG feature 표에는 `knockedout` 이벤트가 없지만 status 엔드포인트에는 있다.
- status 엔드포인트에만 존재하는 `victimName` feature는 unsupported(0)이며 문서화되어 있지 않다.
- Desktop window는 Overwolf 앱 창이라 PUBG 실행 중 독립 desktop app처럼 동작하지 않을 수 있다. 장기적으로 서브모니터용 companion은 별도 BGMS web/dashboard 쪽이 더 적합하다.

## Phase 0~1 금지 유지

다음 항목은 여전히 구현하지 않는다.

- 실시간 `damage_dealt`, `total_damage_dealt`, `damageTaken`
- 실시간 DPS/데미지 미터
- `location`, `team_location`
- 미니맵
- PUBG API 직접 호출
- Supabase service role 또는 secret 포함
- 분석 파이프라인 자동 트리거 (세션 요약 저장은 허용되지만, 저장된 요약으로 `AnalysisEngine`이나 PUBG API 호출을 자동 시작하지 않는다. Phase 2 항목이다.)

## 세션 핸드오프 기준 (2026-07-31 구현)

- 엔드포인트: `POST https://bgms.kr/api/overwolf/session` (BGMS 본체 `app/api/overwolf/session/route.ts`)
- 클라이언트는 이 엔드포인트 외에 BGMS 도메인으로 어떤 요청도 보내지 않는다. Supabase에 직접 접근하지 않는다.
- 전송 조건: 사용자가 데스크탑 창에서 전송을 켜고 BGMS 닉네임을 입력한 경우에만. 기본값은 꺼짐이다.
- 전송 payload 키: `session_id`, `match_id`, `pseudo_match_id`, `player_id`, `platform`, `gep_summary`, `client_environment`. 서버가 화이트리스트 밖의 키를 버리므로 클라이언트에서 임의 키를 추가해도 저장되지 않는다.
- 재시도: 5s, 15s, 60s, 5m, 15m 백오프로 최대 5회. `429`와 `5xx`, 네트워크 오류만 재시도하고 그 외 `4xx`는 영구 거부로 간주해 큐에서 제거한다.
- 큐는 localStorage(`bgms_companion_session_queue`)에 보존되므로 앱 재시작 후에도 이어서 전송된다.
- `player_id`는 GEP 닉네임이 아니라 사용자가 직접 입력한 값이다. GEP 닉네임을 identity로 신뢰하지 않는다는 원칙을 유지한다.
- Overwolf 앱 창의 origin은 `overwolf-extension://`이므로 서버 라우트에 CORS(`OPTIONS` + `Access-Control-Allow-*`)를 명시했다.
- 로컬 검증용으로 `window.bgmsDevEndpoint`가 있으면 그 값을 사용한다. Overwolf 런타임에는 이 값이 없으므로 패키지된 앱은 항상 운영 엔드포인트로 전송한다.

### 2026-07-31 실 DB 검증 결과

- 마이그레이션 적용 완료. `overwolf_session_events`, `overwolf_session_quota` 모두 실제 DB에 존재한다.
- 중복 `session_id` 적재는 `false`를 반환하고 기존 `gep_summary`를 덮어쓰지 않는다. 서버 라우트는 이를 `duplicate: true` 200으로 응답한다.
- `anon` 키로는 테이블 조회와 RPC 실행이 모두 `42501`로 차단된다.
- 저장 시 허용 키 밖의 값(`unknown_key`, `secret`)은 버려지고 `player_id`는 소문자로 정규화된다.
- 하네스를 로컬 서버에 붙인 종단 테스트에서 실제 HTTP 전송, 단일 행 적재, 큐 비움까지 확인했다.
- 네트워크 단절 후 앱 재시작 시나리오에서 큐가 보존되고 복구 후 DB에 도달했다.
- **주의**: Supabase `service_role`은 `BYPASSRLS` 속성을 가진다. RLS만으로는 이 롤을 막을 수 없고, 실제 방어선은 `anon`/`authenticated`의 테이블 권한과 함수 `EXECUTE` 회수다. 일회용 검증 DB에서 롤을 만들 때 `bypassrls`를 빼면 운영과 다르게 동작해 오탐이 난다.

### 2026-07-31 운영 도메인 스모크 결과

`https://bgms.kr/api/overwolf/session`은 배포되어 응답한다. 로컬 서버가 아니라 운영 도메인에 직접 요청해 확인한 값이다.

- `OPTIONS` 204 + CORS 헤더, `GET` 405(핸들러 없음)
- 정식 payload `POST` 200 `stored:true`, 같은 `session_id` 재전송 200 `duplicate:true`
- `damage_dealt` 포함 payload 422, 빈 body 400
- 적재된 행의 `source_host`는 `bgms.kr`, `is_internal`은 `false`
- 스모크로 만든 행과 쿼터 키는 모두 삭제했고 두 테이블은 다시 0행이다.

따라서 클라이언트 큐가 배포 대기 때문에 쌓이는 상황은 더 이상 없다. 아직 남은 것은 적재된 요약을 BGMS 웹에서 읽는 경로이며, 이는 Phase 2 항목으로 승인 전 구현하지 않는다.

## 오버레이 창 크기 조절 (2026-08-01 확인)

`overwolf.windows.changeSize`로 표시 상태에 따라 인게임 창 높이를 바꾼다. manifest의 `in_game.size`는 초기값일 뿐이고 런타임에서 조정한다.

- mini 기본 78px, 경고 라인 노출 시 100px, debug 236px. 폭은 항상 348px로 manifest와 일치시킨다.
- `in_game` 창은 `resizable: false` + `.overlay-shell { overflow: hidden }`이므로 콘텐츠가 창보다 크면 사용자가 볼 방법이 없다. 표시 항목을 늘릴 때 높이를 함께 조정해야 한다.
- 경고 표시 판정은 `gepState.isServiceDegraded(state)` 한 곳에서만 한다. 공식 status code 2(yellow)/3(red) 또는 `gepStatus`가 `error`/`unavailable`일 때 true다. code 0(unsupported)과 1(green)은 경고가 아니다.
- `setState`에서 경고 상태가 전환될 때만 `changeSize`를 호출한다. 같은 상태가 반복 수신되면 창 크기를 다시 건드리지 않는다.

### CSS 선택자 제약

manifest의 `minimum-overwolf-version`이 `0.170.0`이므로 그 클라이언트의 CEF에서 동작이 보장되지 않는 최신 선택자는 쓰지 않는다. 진단 패널에서 `:has()`를 쓰려다 명시적 클래스(`.diagnostic-span`)로 바꿨다.

## 데스크탑 창을 서브모니터로 옮기기 (2026-08-01)

이전 manifest에서 `desktop` 창에 `desktop_only`가 없었다. 공식 Manifest 문서 기준으로 `in_game_only`와 `desktop_only`가 모두 없으면 그 창은 두 컨텍스트에 걸쳐 쓰이고, 게임 실행 중에는 오버레이 컨텍스트로 주입되어 게임 화면에 묶인다. 그래서 보조 모니터로 빼기 어려웠다.

공식 Second Screen 가이드가 요구하는 플래그를 `desktop` 창에 적용했다.

| 플래그 | 값 | 근거 |
| --- | --- | --- |
| `desktop_only` | `true` | Second Screen 가이드 2번 항목. `native_window: true`의 전제 조건이기도 하다 |
| `native_window` | `true` | Second Screen 가이드 3번 항목. 창을 OS 네이티브 창으로 만들어 모니터 간 이동을 자유롭게 한다 |
| `use_os_windowing` | `true` | OS 최대화(전체화면)와 작업표시줄 최소화를 켠다. `desktop_only: true`일 때만 유효하다 (0.102+) |
| `disable_hardware_acceleration` | `true` | Second Screen 가이드 4번 항목. 게임과 같이 돌 때 GPU 사용을 줄여 게임 성능을 보호한다 (0.159+) |
| `keep_window_location` | `true` | Second Screen 가이드 1번 항목. 사용자가 옮긴 모니터/위치를 기억한다 |

자동으로 "게임이 없는 모니터"에 창을 배치하는 것은 `getMonitorsList`가 필요하고 이는 별도 권한을 요구한다. 심사 시 권한 설명 부담이 늘어나므로 지금은 구현하지 않았다. 대신 `native_window` + `keep_window_location` 조합으로 사용자가 직접 옮긴 위치가 유지되게 했다.

검증 상태: manifest 플래그 적용과 여러 해상도에서의 레이아웃(760x520 ~ 2560x1440, 세로 모니터)은 확인했다. 실제 Overwolf 클라이언트에서 창이 보조 모니터로 분리되는지는 Windows 실환경 확인이 필요하다.

## Phase 1.5 / 2 / 3 구현 반영 (2026-08-01)

### 구독 feature 확장

`rank`와 `map`을 구독 목록에 추가했다. 총 11종이다.

- `rank`: 공식 문서상 info key는 `match_info.me`(순위)와 `match_info.total`(총원)이며 **값이 문자열로 온다**(예: `"38"`, `"98"`). key 이름 `me`가 `me` feature와 겹치므로 반드시 feature 기준으로 분기한다. `gep-state.js`의 `applyRank`가 이를 담당한다.
- `map`: 맵 이름만 사용한다. GEP는 `Erangel_Main` 같은 내부 코드로 준다. 좌표나 미니맵으로 연결하지 않는다.
- `kill` feature에서 `headshots`와 `max_kill_distance`를 추가로 수집한다. 둘 다 누적값이다. `total_damage_dealt`와 `damage_dealt`는 계속 차단한다.

`map`은 매치 간 유지하고 `rank`는 초기화한다. 맵은 로비/로딩 단계에서 먼저 도착할 수 있고 순위는 매치 종료 시점 값이기 때문이다.

### 오버레이 표시 항목 재편

배그 기본 HUD와 킬피드가 이미 보여주는 항목(킬 수, 생존자 수, 체력, 무기 상태)을 HUD에서 제거하고, 게임이 매치 중 보여주지 않는 항목으로 교체했다.

- 표시: 헤드샷 수, 최장 킬 거리, 최종 순위(종료 시에만), KO 플래그, 페이즈
- 리듀서는 제거한 값도 계속 수집한다. 세션 요약과 사후 분석에는 필요하다.
- 실측: 최악 케이스(순위 + KO + 3자리 거리 + Loading 페이즈)에서 334px/334px로 넘침 없음.

데스크탑 진단 패널은 `<details>` 기반 기본 접힘으로 바꿨다. `isServiceDegraded`가 true가 되면 한 번 자동으로 펼치고, 사용자가 접은 뒤에는 강제로 다시 펼치지 않는다.

### 사후 리뷰 타임라인 (Phase 3)

`death`, `killer`, `knockedout`, `revived`, `kill` 발생 시점을 세션 요약에 담는다.

- 항목 구조는 `{ t: 경과초, kind: 종류, detail?: 상대닉네임 }`이다. **좌표와 데미지는 담지 않는다.**
- 경과 초는 `matchStart` 기준이다. 시작 시각을 모르면 `null`로 남겨 웹이 위치를 추정하지 않게 한다.
- 최대 40건으로 제한한다. 서버 16KB 제한 대비 여유를 두기 위한 값이며 클라이언트와 서버 상한이 같아야 한다.
- `gep_summary` 안이 아니라 payload 최상위 `event_timeline` 키로 보낸다. `gep_summary`는 서버에서 스칼라만 허용하는 화이트리스트를 통과하므로 배열을 담을 수 없다.

### 서버 조회 경로 (Phase 2)

`app/api/overwolf/sessions/route.ts`(GET)를 추가했다. 적재 경로와 분리된 읽기 전용 라우트다.

- `list_overwolf_sessions(player_id, platform, limit)`와 `get_overwolf_session(session_id)` RPC를 쓴다. 둘 다 `SECURITY DEFINER`이고 EXECUTE는 `service_role`만 갖는다.
- RPC가 `source_host`와 `is_internal`을 반환 컬럼에서 제외한다. 목록은 `is_internal = false`만 노출한다.
- `player_id`는 사용자가 앱에 직접 입력한 값이며 인증된 identity가 아니다. 따라서 이 경로는 비공개 데이터를 다루지 않는다는 전제로만 성립한다. 적재되는 값이 GEP 카운터와 이벤트 시점뿐이고 위치/데미지/개인정보가 없어 성립한다. 열거를 어렵게 하려고 닉네임 최소 3자와 조회 상한 50건을 둔다.

### 앱에서 웹으로 나가는 경로

`overwolf.utils.openUrlInDefaultBrowser`를 사용한다. 이 API는 별도 permission을 요구하지 않아 manifest 권한이 늘지 않았다. 데스크탑 창의 "내 세션 기록 열기" 버튼이 `https://bgms.kr/overwolf/sessions?player=...&platform=...`을 기본 브라우저로 연다. 앱 안에서 웹을 렌더링하지 않는다.

### 실 DB 검증 결과 (2026-08-01)

마이그레이션 `20260801080000_overwolf_gep_session_timeline.sql`을 운영 DB에 적용하고 확인했다.

- `event_timeline jsonb NOT NULL DEFAULT '[]'` 컬럼 추가 확인
- 함수 5종 모두 ACL이 `postgres=X`, `service_role=X`뿐이다. 옛 9인자 `record_overwolf_session_event`는 제거됐다
- 첫 적재 `true`, 같은 `session_id` 재적재 `false`(기존 요약 보존)
- 배열이 아닌 타임라인(`"not-an-array"`)은 빈 배열로 방어됨
- `list_overwolf_sessions('PHASE3PLAYER', ...)`가 대문자 입력을 소문자로 정규화해 조회함
- 전체 3행 중 `is_internal = true` 1행이 목록에서 제외됨(2행 노출), 잘못된 플랫폼 조회는 0행
- 로컬 서버 종단: `GET /api/overwolf/sessions`가 정규화된 뷰를 반환하고 `durationSeconds` 1470, `canOpenAnalysis` 계산 확인
- 검증 데이터는 모두 삭제해 두 테이블 0행 복구

### 운영 배포 후 스모크 (2026-08-01, BGMS PR #128 머지)

조회 라우트와 웹 화면이 배포됐고 운영 도메인에서 확인했다.

- 타임라인 포함 payload `POST` 200 `stored:true`, 재전송 200 `duplicate:true`
- 타임라인 항목 안의 `damage_dealt` → 422. 금지 필드 탐색이 배열 원소까지 들어간다
- 타임라인 항목 중 `kind: "location"`은 조용히 버려진다. 저장된 세션에는 `knockedout`, `kill`, `killer`만 남는다
- `GET /api/overwolf/sessions`가 정규화된 뷰 반환: `canOpenAnalysis` true, `durationSeconds` 1470, 순위 7/96, `maxKillDistance` 212.75, 타임라인 `1:30 knockedout` / `7:00 kill` / `24:30 killer` 정렬
- 응답에 `source_host`, `is_internal`, `location` 키 없음
- `pseudo_match_id`만 있는 세션은 `canOpenAnalysis: false`이고 화면에 "공식 매치 ID 미수신"으로 표시되며 분석 링크가 없다
- 2자 닉네임 조회 400, 없는 `sessionId` 404
- 1280px과 390px에서 가로 넘침 없음, 분석 링크는 공식 match id가 있는 세션 1건에만 노출

스모크 행과 쿼터 키는 모두 삭제해 두 테이블 0행이다.

## GEP match_id 와 BGMS 텔레메트리 id 관계 (2026-08-01 확인)

**핵심 사실**: GEP `match_id` 문자열 끝의 UUID 구간이 BGMS 텔레메트리 `match_id` 와 동일하다.

- GEP: `match.bro.official.pc-2018-03.steam.solo.eu.2019.05.07.08.ce8d1a14-b2af-41c8-8bf4-d2a504326630`
- BGMS `match_master_telemetry.match_id`: `3462da2c-8f01-468d-96df-cb00cb5cd713` (UUID 단독)

즉 BGMS 는 같은 매치를 뒤쪽 UUID 만으로 저장한다. 따라서 GEP 값에서 UUID 를 추출하면 기존 `/replay/3d` 화면에 그대로 넘길 수 있다. `lib/overwolf/session-view.ts` 의 `extractTelemetryMatchId` 가 이 변환을 담당한다.

주의할 점:

- UUID 형식을 만족하지 못하면 `null` 을 반환해 잘못된 id 로 리플레이를 열지 않는다.
- `pseudo_match_id` 는 UUID 형태지만 Overwolf 생성값이므로 이 경로에 넣지 않는다. `official_match_id` 에서만 추출한다.
- 리플레이는 `matchId` 와 `nickname` 이 모두 있어야 열린다. BGMS 텔레메트리가 플레이어 단위로 저장되기 때문이다.

### 리플레이 진입 시점 (`t` 파라미터)

`/replay/3d?matchId=...&nickname=...&platform=...&t=420` 형태로 교전 시점(초)을 넘긴다. `parseReplayStartMs` 가 파싱하고 `resolveReplaySeekMs` 가 재생 위치를 정한다. 텔레메트리 로드가 끝나 재생 구간과 플레이어가 채워진 뒤에만 적용한다.

`t` 는 GEP `matchStart` 기준 경과 초이고 텔레메트리 타임라인 기준과 완전히 같지 않다. 정확한 프레임이 아니라 "그 무렵" 으로 데려가는 용도다.

검증 제약: 로컬(`localhost:3100`)에서는 R2 CORS 가 허용되지 않아 텔레메트리 페치가 `ERR_FAILED` 로 막힌다. 따라서 리플레이 화면의 실제 시점 이동은 로컬 브라우저로 확인할 수 없고, 순수 함수 단위 테스트와 배포 환경 확인으로 나눠 검증한다. 텔레메트리 API 자체는 로컬에서 200 을 반환한다.
