# 기여 가이드

AI for Cut에 기여할 때는 행사장 운영 안정성과 개인정보 보호를 최우선으로 둡니다.

## 작업 흐름

1. 최신 `main`을 받습니다.
2. 작업 브랜치를 만듭니다.
   - 예: `feature/email-ui`, `fix/chromakey-mask`
3. 변경을 작게 나누어 커밋합니다.
4. 아래 검증 명령을 실행합니다.
5. GitHub Pull Request를 엽니다.
6. 코드 오너 승인을 받은 뒤 머지합니다.

```bash
npm install
npm run typecheck
npm run build
```

## 로컬 실행

```bash
npm install
npm run dev
```

Windows PowerShell에서는 아래 명령으로 `.env`를 만듭니다.

```powershell
Copy-Item .env.example .env
```

macOS/Linux에서는 아래 명령을 씁니다.

```bash
cp .env.example .env
```

브라우저에서 `http://localhost:3000`을 엽니다.

OpenAI, Brevo 기능을 실제로 테스트하려면 `.env`에 각 API 키를 넣어야 합니다. 키가 없어도 UI 작업과 대부분의 로컬 개발은 가능합니다.

## 브랜치와 PR 규칙

- `main`에는 직접 푸시하지 않습니다.
- PR 제목은 변경 내용을 짧게 설명합니다.
  - 예: `Fix email domain selector contrast`
- PR 본문에는 변경 이유, 주요 수정 사항, 테스트 결과를 적습니다.
- UI를 바꿨다면 `UI-스크린샷/`의 관련 화면 PNG도 갱신합니다.
- 대형 리팩터링은 먼저 Issue나 Discussion으로 방향을 맞춥니다.

## 코드 스타일

- TypeScript와 React 컴포넌트는 기존 파일의 패턴을 따릅니다.
- 키오스크 UI 문구는 한국어를 기본으로 합니다.
- 화면당 주요 행동은 하나만 강하게 보이게 합니다.
- 터치 버튼은 충분히 크게 만들고, 흰색 강한 테두리는 선택/현재 상태에만 씁니다.
- 개인정보, 비용, 세션 처리 코드는 실패 케이스를 명확히 다룹니다.

## 개인정보와 보안

아래 항목은 절대 커밋하지 않습니다.

- `.env`, API 키, PIN, 토큰
- 실제 참가자 사진
- 이메일 주소가 들어간 데이터
- `temp/`, 운영 로그, 세션 파일
- Brevo/OpenAI 응답 원문 중 개인정보가 포함된 내용

테스트 이미지가 필요하면 실제 인물이 없는 더미 이미지나 익명화된 샘플을 사용합니다.

## PR 체크리스트

- [ ] `npm run typecheck` 통과
- [ ] `npm run build` 통과
- [ ] UI 변경 시 관련 스크린샷 갱신
- [ ] 개인정보가 포함된 파일이 커밋되지 않음
- [ ] 환경 변수 추가 시 `.env.example`과 README 갱신
- [ ] 운영 플로우 변경 시 관리자/헬스 체크 영향 확인
