# 001. 테스트 자동화 + PR 자동 검사(CI)

| 항목 | 내용 |
|---|---|
| 상태 | 완료 |
| 작성 | Cowork, 2026-11-16 |
| 관련 | 개선 백로그 P2-8, Issue #4 |

## 1. 배경·목적
현재 테스트 코드가 없어, 변경(특히 Claude Code 자동 개발 PR)이 기존 기능을 깨뜨려도 Merge 전에 알 수 없다. 핵심 로직과 API 접근 정책을 자동 테스트로 보호하고, 모든 PR에서 자동 검사가 돌게 한다.

## 2. 범위
- 포함: 테스트 프레임워크 도입, 단위 테스트, API 통합 테스트, PR CI 워크플로, 실행 문서화
- 제외: 프론트엔드 E2E(브라우저) 테스트, 커버리지 목표치 강제, 기존 기능 변경

## 3. 사용자 시나리오
1. 개발자(또는 Claude Code)가 PR을 올리면 → GitHub Actions에서 typecheck·빌드·테스트가 자동 실행되고 PR에 ✅/❌ 상태가 표시된다.
2. 로컬에서 `pnpm test` 한 번으로 전체 테스트를 실행한다.

## 4. 화면
없음 (UI 변경 없음).

## 5. 구현 요구사항
### 5.1 테스트 도구
- **Vitest** 사용. API 통합 테스트는 **supertest**로 `app`(artifacts/api-server/src/app.ts)을 직접 호출 (서버 포트 불필요).
- 루트 `package.json`에 `"test"` 스크립트: 전체 워크스페이스 테스트 실행.
- `pnpm-workspace.yaml`의 `minimumReleaseAge` 정책은 유지(우회 금지).

### 5.2 단위 테스트 (DB 불필요)
- `lib/synergy.ts`: 점수 계산(태그 60/신뢰 25/실적 15, 0~100 범위, 대소문자 무시 매칭), `buildReason` 문구(태그 없음/있음, 타입별 라벨)
- `lib/auth.ts`: 세션 토큰 발급·검증(정상/위조 서명/만료/ADMIN_PASSWORD 미설정), `accessPolicy`(GET 공개, `ADMIN_READS` 401, `PUBLIC_WRITES` 통과, 그 외 쓰기 401), `rateLimit`(한도 초과 시 429)
- `lib/media.ts`: `rewriteMediaUrls`(company/banner/solution 판별, 중첩 객체, data URL 아닌 값 유지), `isMediaUrl`
- `routes/companies.ts`의 `validateLogoUrl`, `routes/resumeSubmissions.ts`의 `validateResumeData` — 필요하면 export 또는 `lib/validation.ts`로 분리(동작 변경 금지)

### 5.3 API 통합 테스트 (Postgres 필요, `DATABASE_URL` 있을 때만 실행 — 없으면 skip)
- 비로그인: `GET /api/companies` 200, `GET /api/resume-submissions` 401, `DELETE /api/companies/1` 401, `POST /api/news/collect` 401
- 로그인: `POST /api/auth/login` 틀린 비번 401 / 맞는 비번 200+쿠키, 이후 `GET /api/resume-submissions` 200
- 공개 제출: `POST /api/companies` 201, `POST /api/project-applications` 후 비로그인 목록에서 `contactName`·`contactInfo` 빈 문자열, 관리자 목록에선 값 존재
- 미디어: 로고(data URL) 저장 후 목록 `logoUrl`이 `/api/media/company/{id}?v=` 형태, 해당 URL이 `image/png` 반환
- 이력서: 목록의 `resumeFileData`가 다운로드 경로, 비로그인 다운로드 401
- 존재하지 않는 경로 `/api/nope` → 404 JSON
- 테스트 간 격리: 테스트 시작 시 관련 테이블 정리(TRUNCATE ... RESTART IDENTITY CASCADE) — **테스트 전용 DB에서만** 실행되도록 `DATABASE_URL`에 `test` 또는 CI 환경(`CI=true`)일 때만 정리 수행하는 안전장치

### 5.4 CI 워크플로
- `.github/workflows/ci.yml`: `pull_request`(main 대상) + `push`(main)
- 단계: checkout → pnpm 10 → Node 24(pnpm 캐시) → `pnpm install --frozen-lockfile` → Postgres 16 서비스 + `pnpm --filter @workspace/db run push` → `pnpm run typecheck` → `pnpm run build` → `pnpm test`
- 실패 시 PR에 ❌ 표시. `concurrency`로 같은 PR 중복 실행 취소.

### 5.5 문서
- `CLAUDE.md` Commands에 `pnpm test` 추가, 검증 단계(5번)에 "테스트 통과" 추가
- `replit.md`에 테스트 구조 한 단락

## 6. 완료 조건 (Acceptance Criteria)
- [x] 로컬/CI에서 `pnpm test` 실행 시 단위 + 통합 테스트 전부 통과
- [x] `DATABASE_URL` 없으면 통합 테스트는 skip되고 단위 테스트는 통과
- [x] PR 생성 시 CI가 자동 실행되어 상태가 표시됨 (이 PR 자체로 확인) — `ci.yml`은 GitHub App 권한상 Claude가 push할 수 없어 Cowork가 `.github/workflows/ci.yml`로 추가
- [x] 기존 동작·API 응답 변경 없음 (리팩터링은 export/분리 수준)
- [x] typecheck·빌드 통과, Replit 배포 설정(`.replit`, artifact.toml) 변경 없음

## 7. 비고
- 이후 기능 PR은 해당 기능 테스트를 함께 추가하는 것을 기본 규칙으로 한다(CLAUDE.md에 명시).
- 프론트 E2E(Playwright)는 후속 설계서로 분리.
