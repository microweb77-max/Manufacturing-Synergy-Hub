# 기능 설계서 (Specs)

Cowork가 설계하고 Claude Code가 구현하는 작업 단위입니다.

## 흐름
1. **Cowork**: 요구사항 정리 → `docs/specs/NNN-기능명.md` 작성(아래 템플릿) → 브랜치 `spec/NNN-기능명`로 push 후 main에 반영(또는 Issue 본문에 직접 기재)
2. **Cowork**: GitHub Issue 생성(템플릿 "기능 설계서"), 본문에 `@claude` 포함 또는 `claude` 라벨 → GitHub Actions에서 Claude Code 자동 실행
3. **Claude Code**: 설계서대로 구현 → typecheck/빌드/검증 → PR 생성 (`Closes #이슈`)
4. **Cowork**: PR 검토·화면 확인, 수정 필요 시 PR에 `@claude ...` 댓글
5. **사용자**: Merge → Replit Pull → Publish

화면을 보며 다듬을 작업은 PC의 Claude Code(데스크톱 앱 Code 탭)에서 같은 설계서로 진행합니다.

## 번호·상태
- 파일명: `001-feature-name.md` (3자리 번호 + 영문 kebab-case)
- 상태: `초안` → `승인` → `개발 중` → `완료` (설계서 상단 표에 기록)

## 템플릿 → `_template.md`
