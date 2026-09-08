# BGMS Death Review Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task in the current session. Steps use checkbox (`- [ ]`) syntax for tracking. 작업은 이번 준비 문서에 대한 후속 구현 지시 이후 시작한다.

**Goal:** 완료된 경기의 공식 사망 시각을 기준으로 직전 최대 30초를 기존 지도에서 복기한다.

**Architecture:** 기존 세션 링크와 웹 리플레이를 확장한다. 공식 사망 시각으로 순수 함수가 구간을 계산하고 기존 재생 루프가 종료 시각에 멈춘다. GEP 시각 보정이나 앱 전송 스키마 변경 없이 시작한다.

**Tech Stack:** 기존 Overwolf JavaScript/Node 24 검증, BGMS 웹 Next.js/React/TypeScript/Three.js/Vitest. 새 의존성 없음.

**Spec:** `docs/superpowers/specs/2026-09-08-death-review-design.md`

## Global Constraints

- Overwolf 앱은 영어 기본, 한국어 명시적 선택을 유지한다. 웹은 기존 한국어 UI를 따른다. 새 코드 주석은 한국어로 쓴다.
- M1은 `lib/pubg-analysis/*`, `app/api/pubg/*`, 분석 버전과 AI 코칭 API를 수정하지 않는다. 기존 함수를 읽고 호출하는 것은 허용한다.
- M1은 새 GEP feature, 권한, DB 테이블, 세션 payload 키, 의존성, 자동 분석·자동 조회 스케줄러를 추가하지 않는다.
- GEP 사망/`matchEnd`/로비 복귀/순위는 경기 전체 종료의 증거로 사용하지 않는다.
- 전체 경기 종료와 공식 데이터 준비가 기존 서버 경로에서 확인된 경우에만 새 복기 모드를 활성화한다. 클라이언트 쿼리나 사용자 입력으로 이 조건을 만족시킬 수 없어야 한다.
- 종료 근거가 기존 경로에서 입증되지 않으면 M1 배포를 보류하고 별도 서버 계약 변경안을 작성한다. 금지된 파이프라인을 임의로 수정하지 않는다.

## 저장소와 작업 방식

아래 구현 파일 경로는 모두 **웹 저장소 `pubg-map-app-local` 기준**이다. 이 계획만 Overwolf 저장소에 보관한다.

- 앱 기준 커밋 `2bee92e`, 웹 원격 기준 `9884f5b`.
- 웹 로컬 main은 원격과 갈라져 있다. 실행 시작 시 `git fetch origin`, `git status --short`, 최신 원격 커밋 확인 후 새 worktree를 `origin/main`에서 만든다. 기존 main을 reset/pull merge하지 않는다.
- 예시: `git worktree add ../bgms-web-death-review -b codex/death-review origin/main`. 같은 이름이 있으면 기존 작업을 확인하고 새 이름을 쓴다.
- 웹의 최신 AGENTS/프로젝트 규칙과 기존 lockfile 설치 절차를 다시 확인한다. 현재 원격이 바뀌었다면 이 계획의 연결 지점을 대조한다.
- 각 작업의 테스트가 통과한 변경만 별도 커밋한다. 이번 준비 작업은 운영 코드나 운영 DB를 변경하지 않았다.

## Task 1: 완료된 경기와 공식 사망 데이터 계약 검증

**Read:** `app/api/pubg/telemetry/route.ts`, `lib/pubg-analysis/fetchTelemetryPayload.ts`, `lib/pubg-analysis/telemetryPayload.ts`, `lib/pubg-analysis/handlers/MapReplayHandler.ts`, `app/replay/3d/page.tsx`.

**Create:** `tests/fixtures/replay/death-review-normalized.json`, `docs/validation/death-review-contract.md`.

**Produces:** 실제 응답에서 가져온 최소 비식별 검증 표본, 경기 종료를 보장하는 기존 서버 경로의 파일·함수·조건, 변환된 본인 사망 데이터 형태. 종료 근거를 찾지 못하면 상태는 `출시 보류`다.

- [ ] 기존 서버 요청 → 공식 데이터/캐시 → 변환 payload를 읽고, 완료 경기만 반환하는 근거가 있는지 파일과 함수 단위로 기록한다.
- [ ] 사용자 요청으로 열린 완료 경기 표본에서 변환된 본인 사망 시각과 최종 재생 범위를 대조한다. API 키·전체 원문 텔레메트리를 fixture에 넣지 않는다. 예제 값을 실제 관측값으로 기록하지 않는다.
- [ ] 사망이 없는 경기, 복귀 후 복수 사망, 준비되지 않은 경기의 처리 경로를 각각 기록한다. GEP death와 공식 사망 수가 다를 수 있음을 포함한다.
- [ ] 종료 근거가 빠졌다면 서버 계약 변경 필요 사항과 영향 경로를 설계에 추가한다. 가짜 `isComplete=true`나 URL flag로 통과시키지 않는다.
- [ ] 현재 기준 회귀 검증을 실행한다: `npm run verify:overwolf`와 아래 리플레이 테스트. 실패가 기존 문제인지 기록한 뒤 관련 실패를 해소해야 기능 통합으로 진행한다.

```bash
npx vitest run tests/telemetry-replay-request.test.ts tests/replay-3d-helpers.test.ts tests/replay-event-order.test.ts tests/replay-map-capabilities.test.ts
```

## Task 2: 사망 선택과 구간 종료 순수 함수

**Create:** `lib/replay/deathReview.ts`, `tests/replay-death-review.test.ts`.

**Consumes:** 기존 `PlayerTrajectory[]`, 정확한 대상 닉네임, 공식 재생 종료 시각. 아래 함수는 종료 여부를 판정하는 보안 경계가 아니며 Task 1의 조건을 통과한 데이터에만 적용한다.

**Produces:**

```ts
type DeathReviewWindow = {
  deathIndex: number;
  deathCount: number;
  startMs: number;
  endMs: number;
};
type DeathReviewResult =
  | { status: "ready"; window: DeathReviewWindow; playerName: string }
  | { status: "player-unavailable" | "no-death" | "invalid-range" };

resolveDeathReview(input: {
  players: readonly PlayerTrajectory[];
  nickname: string;
  maxTimeMs: number;
  deathIndex?: number;
}): DeathReviewResult;

advanceDeathReview(nextTimeMs: number, window: DeathReviewWindow): {
  timeMs: number;
  shouldPause: boolean;
};
```

- [ ] 아래 테스트 형태로 조기 사망과 복수 사망 기본 선택을 검증하는 테스트를 먼저 추가한다.

```ts
import { expect, it } from "vitest";
import { resolveDeathReview, advanceDeathReview } from "../lib/replay/deathReview";
const player = { name: "Player", color: "#fff", waypoints: [], deathTimes: [20_000, 120_000] };
it("마지막 공식 사망의 직전 30초를 선택한다", () => {
  expect(resolveDeathReview({ players: [player], nickname: " player ", maxTimeMs: 180_000 }))
    .toEqual({ status: "ready", playerName: "Player", window: {
      deathIndex: 1, deathCount: 2, startMs: 90_000, endMs: 120_000,
    }});
});
it("조기 사망은 0초부터 시작한다", () => {
  const result = resolveDeathReview({ players: [player], nickname: "Player", maxTimeMs: 180_000, deathIndex: 0 });
  expect(result.status === "ready" && result.window.startMs).toBe(0);
});
it("프레임이 사망 시각을 넘으면 정확히 끝에서 멈춘다", () => {
  expect(advanceDeathReview(121_500, { deathIndex: 0, deathCount: 1, startMs: 90_000, endMs: 120_000 }))
    .toEqual({ timeMs: 120_000, shouldPause: true });
});
```

- [ ] `npx vitest run tests/replay-death-review.test.ts`로 함수 부재에 따른 실패를 확인한다.
- [ ] 최소 구현: trim/lowercase한 이름이 정확히 한 명과 일치할 때만 선택한다. `deathTimes`가 있으면 이를 사용하고, 없을 때만 기존 `deathTimeMs`를 호환 입력으로 사용한다. 유한하고 0 이상이며 `maxTimeMs` 이하인 값만 정렬·중복 제거한다. 명시한 index가 범위 밖이면 `invalid-range`, 생략하면 마지막 index를 선택한다. 구간은 `Math.max(0, death - 30_000)`부터 사망까지다.
- [ ] 음수·NaN·Infinity·중복·뒤섞인 시각, 일치하지 않는 이름, 대소문자만 다른 중복 플레이어, 빈 목록, 잘못된 index, 마지막 사망 후 복귀 케이스를 추가한다. 재배치는 과거 사망을 목록에서 지우지 않는다.
- [ ] 위 테스트를 통과시키고 이 모듈과 테스트만 커밋한다.

## Task 3: 세션 카드에서 복기 링크 생성

**Modify:** `lib/overwolf/session-view.ts`, `tests/overwolf-session-view.test.ts`, `components/overwolf/OverwolfSessionList.tsx`.

**Produces:** `buildDeathReviewPath(view: SessionSummaryView): string | null`. 기존 `buildReplayPath(view)`가 null이면 null, 아니면 `review=death`만 추가한다. GEP `t`를 붙이지 않는다.

- [ ] 기존 fixture 생성 방식을 재사용해 경로 테스트를 추가한다. 공식 ID 없음 → null, 닉네임 없음 → null, 정상 → `review=death`, `t` 없음, 기존 일반 경로 변경 없음, GEP 사망 기록이 없어도 공식 ID가 있으면 연결 가능을 검증한다.
- [ ] `npm run verify:overwolf`로 실패를 확인한 뒤 아래 계약대로 헬퍼를 추가한다.

```ts
export function buildDeathReviewPath(view: SessionSummaryView): string | null {
  const replayPath = buildReplayPath(view);
  return replayPath ? `${replayPath}&review=death` : null;
}
```

- [ ] 카드에 `사망 장면 복기` 링크를 연결한다. 사망 장면의 존재는 공식 데이터 로드 후 확인됨을 보조 문구로 안내한다. 기존 일반 리플레이와 분석 링크를 유지한다.
- [ ] 조회되지 않은 각 카드에 텔레메트리를 미리 fetch하지 않는다. 기존 링크 prefetch가 서버 데이터 조회를 유발하는지 브라우저 네트워크로 확인하고, 새 무거운 복기 링크는 `prefetch={false}`로 둔다.
- [ ] `npm run verify:overwolf` 통과 후 커밋한다. 새 링크는 Task 4 통합 전 배포하지 않는다.

## Task 4: 기존 재생 루프에 복기 모드 연결

**Create:** `components/replay/DeathReviewControls.tsx`.
**Modify:** `app/replay/3d/page.tsx`.

**Consumes:** Task 1의 완료 경기 조건, Task 2 결과, `review=death` 쿼리.

**Produces:** 일시정지 진입, 사망 선택, 1배속 구간 재생, 종료 정지, 재시작, 전체 보기.

```ts
type DeathReviewControlsProps = {
  window: DeathReviewWindow;
  isPlaying: boolean;
  onSelectDeath(index: number): void;
  onPlay(): void;
  onRestart(): void;
  onExit(): void;
};
```

- [ ] Task 1 종료 근거가 검증됐는지 확인한다. 준비 미확인이면 위치 데이터를 렌더하거나 자동 재생하지 않는다. 새 서버 필드가 필요한 경우 별도 범위 결정을 먼저 진행한다.
- [ ] 기존 `isCurrent(request)` 요청 생명주기 안에서만 공식 데이터와 구간을 설정한다. match/nickname/platform 변경 시 구간·선택·추적을 초기화한다.
- [ ] 기존 `t` effect가 `review=death`의 위치를 다시 덮지 않게 분기한다. 동일 요청+사망 index의 시작 seek는 1회만 적용한다.
- [ ] 진입 때 `setIsPlaying(false)`, `setPlaybackSpeed(1)`, 공식 이름으로 추적, `currentTimeRef`와 UI 시각을 함께 구간 시작으로 맞춘다. 데이터 준비 뒤 지도 준비 중이어도 중복 seek하지 않는다.
- [ ] 새 interval/RAF를 만들지 않는다. 기존 재생 프레임의 계산값을 `advanceDeathReview`에 전달하고, 종료 시각에 `isPlayingRef`와 UI를 모두 멈춘다. React state 갱신은 기존 주기를 재사용한다.
- [ ] 이름이 있는 버튼과 select로 순번·재생·다시 보기·전체 보기를 구현한다. 전체 보기와 구간 밖 수동 탐색은 복기 제한을 해제한다.
- [ ] 사망 없음·플레이어 미확인·지원 맵 아님·네트워크 실패·준비 미확인의 문구와 재시도/일반 보기 동작을 설계 표대로 연결한다.
- [ ] 기존 리플레이 테스트와 새 순수 함수 테스트를 실행한다. 브라우저에서 실제 상호작용과 요청 교체를 검증한 뒤 커밋한다.

## Task 5: 통합 검증과 출시 준비 기록

**Create:** 웹 `docs/validation/death-review-validation.md`.
**Modify:** 앱 `overwolf-app/docs/phase-0-1-validation.md`, `overwolf-app/docs/extension-roadmap.md`는 앱 작업 브랜치에서 별도 커밋.

- [ ] 웹 `npm run verify:overwolf`, `npx vitest run tests/replay-death-review.test.ts tests/telemetry-replay-request.test.ts tests/replay-3d-helpers.test.ts tests/replay-event-order.test.ts tests/replay-map-capabilities.test.ts`를 실행한다.
- [ ] 변경 파일 ESLint, `npx tsc --noEmit --pretty false`, `npm run build`와 저장소 필수 CI를 실행한다. 기존 실패가 있으면 파일·원인·영향을 기록하며 전체 통과라고 보고하지 않는다.
- [ ] PC 980×700 및 넓은 창, 웹 모바일 390px에서 버튼·순번 선택·오류 안내를 확인한다. 모바일 검증은 웹 변경 범위 때문에 필요하다.
- [ ] 정상/조기 사망/복수 사망/사망 없음/이름 불일치/준비 미확인/빠른 URL 변경/일반 `t=420` 링크를 브라우저로 확인한다. 종료 뒤 재생 상태와 슬라이더가 일치해야 한다.
- [ ] 같은 경기의 일반 재생 대비 반복 네트워크 요청, WebGL 컨텍스트, FPS·메모리를 기록한다. 로컬 R2 CORS가 막히면 허용된 preview에서 검증하고 보안 설정을 임의로 완화하지 않는다.
- [ ] Windows 실제 세션에서 공식 ID·플레이어·사망 장면을 대조한다. 수집 시각 오차는 관측값으로 기록하고 M1 공식 시각 선택과 구분한다.
- [ ] 리뷰와 CI를 통과한 웹 PR부터 배포한다. M1은 앱 스키마 변경이 없으므로 앱 강제 업데이트나 마이그레이션이 필요하지 않다. 회귀 시 웹 PR revert로 새 모드와 진입 링크를 함께 되돌린다.

## 이번 준비 작업의 결과

- 앱 `npm run verify`: 85개 통과, 21개 실행 파일 빌드 성공.
- 웹은 최신 원격 소스 조사만 수행했다. 웹 작업 디렉터리·실행 코드·운영 데이터 변경 및 웹 테스트 실행은 하지 않았다.
- M1 설계와 변경 경로는 구체화했다. 종료 보장 계약과 실제 Windows 경로는 Task 1/5에서 입증해야 하며 아직 완료로 표시하지 않는다.
