# 001. 회원사 일괄 수정(업데이트)

| 항목 | 내용 |
|---|---|
| 상태 | 완료 |
| 작성 | Cowork, 2026-11-18 |
| 관련 이슈/PR | #11 |

## 요약
관리자가 `id`로 기존 회원사를 식별해 **값을 입력한 열만** 덮어쓰는 일괄 수정 기능. 설계 전문은 이슈 #11 참고.

## 구현 요약
- API: `POST /api/companies/bulk-update` (platform-admin 전용, 비로그인 401 / 일반 회원 403 — `apiAuthorization.ts`의 fail-closed 정책)
- 수정 가능 열: `name, tax_code, phone, kakaotalk_id, location, contact_email, capability_tags, description, tech_specs`
- 규칙: 빈 셀 = 변경 안 함, `(비움)` = 명시적 비우기(기업명 제외), 없는 id는 생성하지 않고 오류 보고, `capability_tags`는 쉼표 구분 → 배열
- 트랜잭션 정책: 검증 실패 행은 건너뛰고 오류로 보고, **유효한 행은 한 트랜잭션으로 적용**(클라이언트는 500건씩 요청)
- UI: 관리자 `기업` 탭 → `일괄 수정` (내보내기 → 업로드 → 미리보기 → 적용)
