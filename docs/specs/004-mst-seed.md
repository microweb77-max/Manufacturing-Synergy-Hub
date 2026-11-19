# 004. MST(사업자번호) 일회성 시드

| 항목 | 내용 |
|---|---|
| 상태 | 완료 |
| 작성 | Cowork, 2026-11-19 (이슈 #19) |
| 관련 이슈/PR | #11, #12 (관리자 UI — 별개 경로) |

저장소 CSV(`attached_assets/kovima_mst_1421_v2_1791278203983.csv`, 1,421행)의 MST를 `companies.tax_code`에만 채우는 **수동 1회** 스크립트.

## 실행 (머지 후, Replit 셸)
```bash
pnpm --filter @workspace/api-server db:seed:tax-codes            # dry-run (기본, 쓰지 않음)
pnpm --filter @workspace/api-server db:seed:tax-codes -- --apply # 실제 적용 (단일 트랜잭션)
```
`--file=<경로>`로 다른 CSV 지정 가능.

## 규칙
- `검수필요=Y`(140건) 제외 → 대상 1,281건
- `id`로 직결, DB·CSV 회사명이 서로 포함 관계가 아니면 건너뜀
- MST 숫자 10자리 아니면 건너뜀
- 이미 `tax_code`가 있으면 덮어쓰지 않음(값이 다르면 경고)
- `tax_code` 외 컬럼 불변, 멱등, 실패 시 전체 롤백
- 서버 시작·빌드·배포 경로에서 호출하지 않음

구현: `artifacts/api-server/scripts/seed-tax-codes(.mjs|-lib.mjs)`, 테스트: `artifacts/api-server/tests/seedTaxCodes.test.ts`
