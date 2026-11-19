# 003. 사업공고 메뉴 (정부 입찰 · 한국 지원사업 · 대형 발주처 RFQ)

| 항목 | 내용 |
|---|---|
| 상태 | 완료 |
| 작성 | Cowork, 2026-11-19 |
| 선행 | 002 완료(PR #16 Merge됨) — `user_bookmarks`·`user_alert_preferences`·`/me/*`·주간 알림·`sendDigestMail` **재사용** |
| 관련 이슈/PR | #17 |

## 1. 배경·목적
회원사가 수주 기회를 놓치지 않도록 베트남 정부기관 입찰, 한국 기관의 베트남 진출 지원사업, 대형 발주처의 공개 구매·협력사 모집 공고를 한곳에 모으고, 마감 임박 여부와 관심 분야 알림을 제공한다. 비회원에게는 요약만 보여 회원가입을 유도한다.

## 2. 범위
- 포함: 공고 목록/상세, 필터, 마감 임박 표시, AI 자동수집 + 관리자 등록, 관심등록·알림(002 공통 기능), 비로그인 요약 공개
- 제외: 입찰 서류 대행·제출, 유료 정보 서비스 연동, 원문 전문 복제(저작권 — 요약+원문 링크만)

## 3. 공고 유형
| 유형(`sourceType`) | 예 |
|---|---|
| `gov_vn` 베트남 정부 입찰 | 국가전자조달망(muasamcong) 등 공공조달 중 제조·설비·자동화·IT 관련 |
| `kr_support` 한국 지원사업 | KOTRA, KOCHAM, 중소벤처기업진흥공단 등 베트남 진출·바이어 상담·전시 지원 |
| `buyer_rfq` 대형 발주처 RFQ | 대기업·공기업의 **공개된** 협력사 모집·구매 공고 |

## 4. 사용자 시나리오
1. 누구나 `사업공고` 메뉴에서 유형·분야(설비/자동화/IT·소프트웨어/부품·소재/건설·인프라/서비스/기타)·지역·마감(7일 이내/30일 이내/전체)으로 거르고, 마감 임박순으로 본다. 마감 지난 공고는 기본 숨김.
2. **비로그인**: 제목·발주처·유형·분야·마감일·한 줄 요약만 표시, 상세 요약·예산·자격요건·원문 링크는 "로그인 후 확인" (기존 오퍼 가격 가림과 같은 방식).
3. **로그인 회원**: 전체 요약, 예산(있으면), 참가 자격, 제출 방법, 원문 링크, 관심등록, 알림 설정.
4. 관리자: `/admin` `사업공고` 탭에서 CRUD·숨김, "공고 자동 수집" 버튼.

## 5. 화면 (한국어, 모바일 대응, 002 행사 화면과 일관된 디자인)
- 사이드바 `사업공고` (아이콘 Megaphone 또는 FileSearch), `/tenders`, nav key `tenders`(navItems + 서버 `VALID_NAV_KEYS`, 메뉴 관리 연동)
- 카드: 유형 배지, 제목, 발주처, 분야 태그, 마감일·D-day(7일 이내 강조), 예산(회원만)
- 탭: `전체` / `내 관심`, 알림 설정(유형+분야 선택, 주간 메일 — 002의 인증 이메일 선택 UI 재사용)
- 목록 하단 고지: "공고 정보는 원문 기준이며 참고용입니다."

## 6. 데이터·API
### 6.1 DB (추가만, 기존 테이블 변경 없음)
- `tenders`: id, title(한국어), originalTitle, summary(한국어), sourceType, category, buyer(발주처), country/city, budget(text, nullable), eligibility(text), submission(text), publishedDate, deadline(date), sourceUrl, source(`auto`|`manual`), status(`published`|`hidden`), createdAt, updatedAt
- 북마크·알림: 002의 `user_bookmarks`(itemType=`tender`), `user_alert_preferences`(itemType=`tender`) 재사용
- (구현 시 추가) `tender_deadline_reminders`: 마감 3일 전 안내를 회원·공고당 1회만 보내기 위한 기록
### 6.2 API (OpenAPI 먼저 → codegen)
| 메서드·경로 | 권한 |
|---|---|
| GET `/tenders` (sourceType, category, deadlineWithin, includeClosed) | 공개 — 비로그인 응답은 `summary`(첫 문장만)·`budget`·`eligibility`·`submission`·`sourceUrl`을 **서버에서 제거**, `restricted: true` |
| GET `/tenders/:id` | 공개(동일 가림 규칙) |
| GET `/admin/tenders` (숨김 포함) | 플랫폼 관리자 |
| POST/PATCH/DELETE `/tenders` | 플랫폼 관리자 |
| POST `/tenders/collect` (optional sourceType) | 플랫폼 관리자 |
| POST `/api/scheduled/tenders-collect` | 스케줄 토큰(002와 동일 방식) |
- 가림 처리는 `offerPriceVisibility` 미들웨어 방식(서버 검증 Clerk 세션 기준, `Cache-Control: private, no-store`, `Vary`) — 클라이언트 숨김만으로 처리 금지
- `/me/bookmarks`의 itemType `tender` 허용, 존재하지 않거나 숨김 공고 북마크는 404/400
### 6.3 자동 수집
- 002 행사 수집과 같은 2단계 Gemini 패턴(grounding 검색 → JSON 구조화+한국어 요약), 유형별 검색 프롬프트 3종, 최근 30일 공고·마감 미도래 우선, `sourceUrl` grounding 허용 목록 검증
- 중복 제거: 정규화한 `title + buyer + deadline`. 단일 실행 잠금 + 쿨다운
- 원문 전문 저장 금지(요약·핵심 항목만), 출처 표시 필수
### 6.4 알림
- 002 주간 알림 작업(`/api/scheduled/weekly-alerts`)이 `tender`도 처리하도록 확장: 관심 유형·분야의 새 공고 + 관심등록 공고의 **마감 3일 전** 안내(한 공고당 1회만). 0건이면 미발송, 실패 시 재시도 없음

## 7. 완료 조건
- [x] 비로그인 응답에서 제한 필드가 **서버에서** 제거됨(테스트로 확인), 로그인 시 전체 필드
- [x] 로그인 회원 상세·원문 링크·관심등록·알림 설정 동작
- [x] 관리자 CRUD·숨김·자동 수집(중복 제거, 출처 검증)
- [x] 마감 임박(7일) 강조, 마감 지난 공고 기본 숨김
- [x] 메뉴 관리 연동, 권한 테스트(401/403), 마감 3일 전 알림 1회 테스트
- [x] `pnpm test`·typecheck·build·CI 통과
- [x] `replit.md` 갱신, 설계서 `docs/specs/003-tenders.md` 저장

## 8. 비고
- 대형 발주처 비공개 RFQ는 수집 대상 아님. 회원사 직접 등록(관리자 승인)은 후속 설계서
- 배포 후 cron: 주 1회 `POST /api/scheduled/tenders-collect` (PR의 배포 시 주의에 명시)
