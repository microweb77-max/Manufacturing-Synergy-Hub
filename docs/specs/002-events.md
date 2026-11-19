# 002. 행사·전시회·세미나 메뉴 (베트남 제조 / AI)

| 항목 | 내용 |
|---|---|
| 상태 | 개발 중 |
| 작성 | Cowork, 2026-11-19 |
| 선행 | 없음 (이 설계서에서 **관심등록·알림 공통 기능**을 만든다 → 003이 재사용) |
| 관련 이슈/PR | #15 |

## 1. 배경·목적
회원사(공급사·고객사)가 베트남 제조·자동화·AI 관련 전시회, 컨퍼런스, 세미나, 상담회를 한곳에서 확인하고, 관심 행사를 저장하고, 새 행사 알림을 받게 한다. 행사는 공동 영업·네트워킹의 출발점이다.

## 2. 범위
- 포함: 행사 목록/상세, 필터, AI 자동수집(관리자 실행 + 스케줄), 관리자 등록·수정·삭제, **관심등록(북마크)**, **관심 분야 알림 이메일(주간 요약)**, 메뉴 관리 연동
- 제외: 행사 참가 신청·결제, 캘린더 파일(ics) 내보내기(후속)

## 3. 사용자 시나리오
1. 누구나 `행사·세미나` 메뉴에서 다가오는 행사를 날짜순으로 보고 분야(제조/자동화/AI/전자·반도체/물류/기타)·지역(하노이/호치민/다낭/기타·온라인)·기간(이번 달/3개월/전체)으로 거른다.
2. 카드를 누르면 상세(일정, 장소, 주최, 요약, 원문 링크)를 본다. 지난 행사는 기본 숨김("지난 행사 보기" 토글).
3. 로그인 회원은 ☆로 관심등록하고 `내 관심` 탭에서 모아 본다.
4. 로그인 회원은 알림 설정에서 관심 분야를 고르면 매주 새 행사 요약 메일을 받는다(해지 가능).
5. 관리자는 `/admin`의 `행사` 탭에서 등록·수정·삭제·숨김, "행사 자동 수집" 버튼으로 수집한다.

## 4. 화면 (UI, 한국어, 모바일 대응)
- 사이드바 메뉴: `행사·세미나` (아이콘 CalendarDays), `/events`, `navItems.ts` 및 서버 `VALID_NAV_KEYS`에 `events` 추가 → 메뉴 관리에서 표시/숨김 가능
- 목록: 카드(날짜 배지, 제목, 분야 태그, 장소·도시, 주최, D-day). 상단 필터 칩 + 탭(`전체` / `내 관심`)
- 상세: 다이얼로그 또는 `/events/:id`
- 알림 설정: 페이지 상단 "알림 설정" 버튼(로그인 시) → 분야 체크박스 + 주간 메일 on/off
- 관리자: 기존 `AdminSection` 패턴으로 `행사` 탭 + 자동 수집 버튼(뉴스 수집 UI 패턴)

## 5. 데이터·API
### 5.1 DB (추가만, 기존 테이블 변경 없음)
- `events`: id, title(한국어), originalTitle, summary(한국어), category(enum 텍스트), city, venue, organizer, startDate(date), endDate(date, nullable), isOnline(bool), sourceUrl, source(`auto`|`manual`), status(`published`|`hidden`), createdAt, updatedAt
- **공통** `user_bookmarks`: id, clerkUserId, itemType(`event`|`tender`), itemId, createdAt, unique(clerkUserId,itemType,itemId)
- **공통** `user_alert_preferences`: clerkUserId(PK 일부), itemType, categories(text[]), weeklyEmail(bool), email, lastSentAt, unsubscribeToken
### 5.2 API (OpenAPI 먼저 수정 → codegen)
| 메서드·경로 | 권한 |
|---|---|
| GET `/events` (category, city, period, includePast) | 공개 |
| GET `/events/:id` | 공개 |
| POST/PATCH/DELETE `/events` | 플랫폼 관리자 |
| POST `/events/collect` (optional topic) | 플랫폼 관리자 |
| GET/POST/DELETE `/me/bookmarks` (itemType, itemId) | 로그인 회원(본인 것만) |
| GET/PUT `/me/alert-preferences` (itemType) | 로그인 회원(본인 것만) |
| GET `/alerts/unsubscribe?token=` | 공개(토큰) |
| POST `/api/scheduled/events-collect`, `/api/scheduled/weekly-alerts` | 스케줄 토큰(기존 `NEWS_SCHEDULER_TOKEN` 방식 재사용) |
### 5.3 자동 수집
- `routes/news.ts`의 2단계 Gemini 패턴 재사용: (1) Google Search grounding으로 베트남 제조·자동화·AI 행사(향후 6개월) 검색 → (2) JSON 구조화+한국어 요약. `sourceUrl`은 grounding 출처 허용 목록 검증(환각 링크 차단)
- 중복 제거: 정규화한 `title + startDate`. 단일 실행 잠금 + 쿨다운(뉴스와 동일)
- 참고 출처 예: 전시회 일정 사이트, MTA Vietnam, NEPCON Vietnam, Vietnam Manufacturing Expo, 베트남 AI 컨퍼런스, KOTRA·KOCHAM 행사
### 5.4 알림 메일
- 기존 `lib/membershipMail.ts`의 Gmail 커넥터 방식으로 `sendDigestMail()` 추가(일반 텍스트, 해지 링크 포함). 지난 발송 이후 새로 등록된 관심 분야 행사만, 0건이면 미발송
- 발송 실패 시 재시도하지 않음(중복 발송 방지), 로그 기록

## 6. 완료 조건
- [ ] 비로그인으로 `/events` 목록·필터·상세 이용 가능, 관심·알림 버튼은 로그인 유도
- [ ] 로그인 회원: 관심등록/해제, `내 관심` 탭, 알림 설정 저장
- [ ] 관리자: 행사 CRUD, 자동 수집(중복 제거, 출처 링크 검증)
- [ ] 쓰기 API 비로그인 401, 일반 회원의 관리자 API 403, 남의 북마크 접근 불가
- [ ] 메뉴 관리에서 `행사·세미나` 표시/숨김
- [ ] `artifacts/api-server/tests/`에 권한·북마크·중복제거·해지토큰 테스트 추가, `pnpm test`·typecheck·build·CI 통과
- [ ] `replit.md` 갱신(기능·스케줄 엔드포인트·새 테이블)

## 7. 비고
- 배포 후 Replit에서 스케줄 연결 필요: 주 1회 수집 + 주 1회 알림(PR의 배포 시 주의에 명시)
- 003(사업공고)은 `user_bookmarks`·`user_alert_preferences`·`sendDigestMail`을 재사용
