# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

작업 범위, 금지 사항, 약관 체크리스트는 `AGENTS.md`가 기준이다(로컬 전용, gitignore 대상).

@AGENTS.md

## 명령어

의존성 설치가 없다. Node 24 내장 기능만 쓴다.

- `npm test`: 전체 테스트 실행(`node --test --test-force-exit overwolf-app/tests/*.test.js`)
- `node --test --test-force-exit overwolf-app/tests/gep-state.test.js`: 파일 하나만 실행
- `node --test --test-force-exit --test-name-pattern="max_kill_distance" overwolf-app/tests/*.test.js`: 이름으로 골라 실행
- `npm run verify:runtime`: manifest와 런타임 참조 검증
- `npm run build`: 런타임 검증 후 `dist/bgms-companion`에 unpacked 앱을 만든다. 서명된 OPK가 아니다.
- `npm run verify`: test + build. CI(`.github/workflows/verify.yml`, ubuntu/windows)가 돌리는 명령과 같다.
- 브라우저에서 미리보기: `open overwolf-app/dev-harness/mock.html`. mock Overwolf API와 공식 문서 형태를 본뜬 GEP 시나리오가 들어 있고, `/api/overwolf/session` 요청을 가로채서 운영 서버로 트래픽이 나가지 않는다.

`--test-force-exit`는 VM 픽스처에 남는 타이머 때문에 필요하다. 빼지 않는다.

## 구조

이 저장소에는 Overwolf 클라이언트(`overwolf-app/`)만 있다. 수신 서버(`app/api/overwolf/session`, `lib/overwolf/session-payload.ts`), Supabase 마이그레이션, `npm run verify:overwolf`는 BGMS 본체 저장소에 있다. AGENTS.md에 나오는 그 경로들은 여기서 찾지 않는다.

빌드 도구 없이 평범한 `<script>` 태그로 로드한다. 공유 모듈(`gep-state.js`, `session-queue.js`, `settings.js`, `i18n.js`)은 UMD 형태다. `ads.js`는 데스크탑 창 전용 광고 로더다. 브라우저에서는 `window.bgms*` 전역으로, 테스트에서는 `require`로 같은 파일을 쓴다. 새 런타임 파일은 `scripts/build.js`의 `RUNTIME_FILES` 허용 목록에 추가해야 빌드 결과물에 들어간다.

데이터 흐름:

1. `background.js`(메인 창)만 Overwolf API를 다룬다. 게임 감지, `setRequiredFeatures`, `onInfoUpdates2`/`onNewEvents`/`onError` 리스너, 창 관리, 네트워크가 여기 있다. 리스너는 중복 등록을 막으려고 지운 뒤 다시 붙인다. 실행 중 게임 id(`109061`)는 `classId`나 `Math.floor(id / 10)`으로 기본 id `10906`으로 바꿔 비교한다.
2. GEP payload는 `gep-state.js`의 순수 리듀서(`reduceInfoUpdatesEvent`, `reduceGameEvent`, `reduceNewEventsEvent` 등)를 거쳐 하나의 상태 객체가 된다. 라우팅은 GEP `feature` 필드가 먼저다. `rank`의 `match_info.me`가 `me` feature와 key가 겹치기 때문이다. 금지 필드(`damage_dealt`, `total_damage_dealt`, `location`, `team_location` 등)는 여기서 버린다. 단위 변환도 여기서 한다(예: `max_kill_distance`는 cm이므로 미터로 바꾼다).
3. `background.js`는 `window.bgmsController`를 노출한다. `in-game.js`(HUD)와 `desktop.js`(설정·진단)는 `overwolf.windows.getMainWindow()`로 이 컨트롤러를 받아 상태 스냅샷을 구독하고 렌더링만 한다.
4. 매치 요약은 첫 `matchEnd` 뒤 로비 복귀, 다음 `matchStart`, 게임 종료, 20초 경과 중 먼저 오는 시점에 한 번 확정된다. `buildSessionSummary`가 요약을 만들고 `session-queue.js`가 localStorage 큐에 넣은 뒤 `POST https://bgms.kr/api/overwolf/session`으로 보낸다. 지수 백오프로 재시도하고, `429`/`5xx`/네트워크 오류만 다시 보낸다. 전송은 `settings.js`의 opt-in과 닉네임이 있을 때만 한다.

`matchEnd`는 한 매치에 두 번 올 수 있다. 첫 번째만 요약을 준비 상태로 만들고, `session_id`는 `matchStart`마다 새로 발급한다.

## 테스트 구조

- `gep-state.test.js`, `session-queue.test.js`, `settings.test.js`: 순수 모듈을 `require`로 직접 테스트한다.
- `background-controller.test.js`, `ui-performance.test.js`: `vm` 컨텍스트에 `dev-harness/mock-overwolf.js`와 실제 HTML/JS를 올려 컨트롤러 배선과 렌더링을 검증한다.
- 실제 GEP 수신은 자동 테스트로 확인할 수 없다. 실게임이나 시뮬레이터에서 관측한 값은 `overwolf-app/docs/phase-0-1-validation.md`에 기록한다.

## 문서

- `overwolf-app/docs/official-api-notes.md`: GEP와 Overwolf API에 대해 공식 문서로 확인한 사실. payload 파서를 고치면 같은 턴에 갱신한다.
- `overwolf-app/docs/extension-roadmap.md`: feature 허용/보류/금지 판정과 "사용자 가치 기준". 표시 항목을 추가하기 전에 확인한다.
- `overwolf-app/docs/release-readiness.md`, `windows-test-guide.md`, `store-listing.md`: 릴리스와 심사 준비 문서
- `docs/superpowers/`: 진행 중인 기능의 설계와 계획(예: death review)

사용자와 심사자에게 보이는 문구(manifest, HUD, store listing, README)는 영어가 기본이고, 한국어는 `i18n.js`의 선택 옵션이다. 코드 주석은 한국어로 쓴다.
