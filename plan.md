

````md
# AI 네컷 포토부스 구현 계획 (Gyeongnam Science High School Math & Science Festival)

## 1. 프로젝트 개요

### 1-1. 목표
경남과학고등학교 수학과학페스티벌 행사에서 외부 방문객이 사용할 수 있는 **AI 네컷 포토부스**를 구현한다.  
사용자는 포즈를 취하고, 시스템은 **OpenAI GPT-5.4 mini**로 포즈/분위기를 분석하여 배경 키워드를 추천한다.  
사용자는 추천 키워드 중 일부를 선택하고, **OpenAI gpt-image-2 (medium)** 으로 배경을 생성한다.  
이후 4컷 사진을 촬영하고, 인물과 배경을 합성하여 네컷 이미지를 완성한 뒤 **Brevo API**를 통해 이메일로 전송한다.

### 1-2. 핵심 컨셉
- **2-3 하이브리드 UX**
  - 2번: 사용자 행동/포즈를 분석
  - 3번: 분석 결과를 바탕으로 키워드 추천
  - 사용자는 추천된 키워드를 선택하여 최종 배경을 결정
- 독특하지만 복잡하지 않은 체험형 부스
- 행사장 운영에 적합한 빠른 흐름
- 사진과 이메일을 다루므로 **개인정보 최소 수집 및 자동 삭제** 설계 필수

### 1-3. MVP 범위
이번 구현의 최소 기능(MVP)은 아래를 반드시 포함한다.
1. 시작 화면
2. 촬영 전 프리뷰 화면
3. 포즈 분석용 1장 촬영
4. GPT-5.4 mini를 통한 포즈/분위기 분석 및 키워드 추천
5. 사용자의 키워드 선택 UI
6. gpt-image-2 medium으로 배경 생성
7. 4컷 촬영
8. 인물 분리 + 생성 배경 합성
9. 네컷 템플릿 완성
10. 이메일 입력 및 Brevo API 발송
11. 전송 후 파일 자동 삭제

### 1-4. 비범위(이번 구현에서 제외)
- 현장 인쇄 기능
- 회원가입/로그인
- 관리자용 복잡한 통계 대시보드
- 여러 언어 지원
- 다중 테마팩 다운로드 시스템
- 과도한 자유 프롬프트 입력 기능
- 영상 저장 기능

---

## 2. 기술 선택

### 2-1. 권장 스택
에이전트는 아래 스택을 기본안으로 구현한다.

- **Frontend / Fullstack**
  - Next.js (App Router)
  - TypeScript
  - Tailwind CSS
- **Backend**
  - Next.js Route Handlers 기반 API
- **AI**
  - OpenAI API
    - 포즈 분석 + 키워드 추천: `gpt-5.4-mini`
    - 배경 생성: `gpt-image-2` (`medium`)
- **이메일**
  - Brevo Transactional Email API
- **이미지 처리**
  - `sharp` (네컷 템플릿 합성, 리사이즈, 프레임 구성)
- **인물 분리**
  - 1순위: 로컬/브라우저 기반 인물 세그멘테이션 (MediaPipe Selfie Segmentation 또는 동급)
  - 2순위 fallback: 서버 측 Python `rembg` 또는 동급 도구
- **임시 저장**
  - 로컬 파일 시스템 기반 temp 디렉터리
  - 세션 단위로 TTL 관리
- **배포**
  - Docker 지원 필수
  - `.env` 기반 설정

### 2-2. 선택 이유
- Next.js 하나로 프론트/백엔드 일원화 가능
- OpenAI API와 Brevo API 연결이 단순
- 행사형 서비스는 복잡한 분산 구조보다 단일 앱 구조가 운영에 유리
- 인물 분리는 OpenAI가 아니라 **로컬에서 처리**하여 개인정보 외부 전송을 최소화

---

## 3. 사용자 흐름 (UX Flow)

### 3-1. 전체 흐름
1. 시작 화면
2. 개인정보/이메일 발송/자동삭제 안내 확인
3. 포즈 가이드 확인
4. 포즈 분석용 사진 1장 촬영
5. GPT-5.4 mini가 포즈/분위기 분석
6. 추천 키워드 표시
7. 사용자가 키워드 선택
8. 배경 생성
9. 4컷 촬영
10. 인물 분리 및 배경 합성
11. 네컷 최종 이미지 미리보기
12. 이메일 입력
13. Brevo로 이미지 발송
14. 완료 화면
15. 세션 데이터 자동 삭제

### 3-2. 화면 단위 설계
#### 화면 A. 시작 화면
- 제목: “AI가 포즈를 보고 배경을 추천해주는 네컷 부스”
- 버튼:
  - 시작하기
- 문구:
  - “포즈를 취하면 AI가 어울리는 배경 키워드를 추천해드려요.”
  - “완성된 사진은 이메일로 보내드립니다.”

#### 화면 B. 안내 및 동의
- 표시 내용:
  - 사진과 이메일은 네컷 이미지 생성 및 발송 목적에만 사용
  - 발송 후 자동 삭제
  - 오류 대응을 위해 최대 24시간 이내 임시 보관 가능
- 체크박스:
  - 안내 내용을 확인했습니다
- 버튼:
  - 다음

#### 화면 C. 포즈 가이드
- 예시 포즈:
  - 브이
  - 손하트
  - 양손 번쩍
  - 생각하는 포즈
  - 신나는 포즈
- 문구:
  - “포즈를 취하면 AI가 어울리는 배경 키워드를 추천해드려요.”
- 버튼:
  - 분석용 촬영 시작

#### 화면 D. 포즈 분석용 촬영
- 라이브 카메라 프리뷰
- 3초 카운트다운
- 사진 촬영
- 로딩 문구:
  - “AI가 포즈와 분위기를 분석 중입니다...”

#### 화면 E. 추천 키워드 선택
- 카테고리별 추천 표시:
  - 주제(theme)
  - 분위기(mood)
  - 색감(color)
  - 효과/effect
- 각 카테고리에서 1개 선택
- 버튼:
  - 배경 생성하기
  - 다시 분석하기
- fallback:
  - 분석 실패 시 인기 키워드 세트 제공

#### 화면 F. 배경 생성 로딩
- 문구:
  - “AI가 배경을 만들고 있어요...”
  - “잠시만 기다려 주세요.”

#### 화면 G. 네컷 촬영
- 4회 촬영
- 각 촬영 간 3초 카운트다운
- 촬영 진행 표시:
  - 1/4, 2/4, 3/4, 4/4
- 촬영 후 로딩:
  - “사진을 합성하고 있습니다...”

#### 화면 H. 결과 미리보기
- 완성된 네컷 이미지 표시
- 버튼:
  - 이메일로 받기
  - 처음부터 다시하기
- 선택적으로:
  - 배경 1회 재생성 허용 여부 설정 가능 (기본은 미허용 또는 1회 제한)

#### 화면 I. 이메일 입력
- 이메일 입력 필드
- 유효성 검사
- 버튼:
  - 발송하기
- 발송 중 문구:
  - “이메일을 보내는 중입니다...”

#### 화면 J. 완료 화면
- 문구:
  - “전송이 완료되었습니다.”
  - “즐거운 관람 되세요!”
- 자동 초기화 카운트다운:
  - 10초 후 시작 화면으로 복귀

---

## 4. 시스템 아키텍처

### 4-1. 고수준 구조
```text
브라우저(사용자)
  ├─ 웹캠 프리뷰
  ├─ 포즈 분석용 사진 촬영
  ├─ 4컷 촬영
  └─ UI 상호작용

Next.js 서버
  ├─ 세션 관리
  ├─ OpenAI 호출
  │   ├─ GPT-5.4 mini (포즈 분석 + 키워드 추천)
  │   └─ gpt-image-2 medium (배경 생성)
  ├─ 이미지 처리
  │   ├─ 인물 분리
  │   ├─ 배경 합성
  │   └─ 네컷 템플릿 렌더링
  ├─ Brevo 이메일 발송
  └─ 임시 파일 저장/삭제
````

### 4-2. 개인정보 최소화 원칙

* GPT-5.4 mini로 보내는 포즈 분석용 이미지는 **저해상도(예: 512px)** 로 축소한 사본 사용
* 최종 4컷 원본은 OpenAI에 보내지 않음
* 배경 생성은 사용자 선택 키워드만 사용
* 사진과 결과물은 temp 디렉터리에 세션 단위 저장
* 발송 후 즉시 삭제, 실패 시 TTL 삭제

---

## 5. 핵심 기능 설계

### 5-1. 세션 관리

세션 단위로 아래를 관리한다.

* `sessionId`
* 생성 시각
* 포즈 분석용 사진 경로
* 추천 키워드
* 선택 키워드
* 생성된 배경 이미지 경로
* 4컷 원본 사진 경로
* 최종 네컷 이미지 경로
* 이메일 발송 여부
* 상태(state)

세션 상태 예시:

* `created`
* `analysis_captured`
* `keywords_ready`
* `background_ready`
* `photos_captured`
* `composited`
* `emailed`
* `expired`

### 5-2. 포즈 분석 + 키워드 추천

#### 입력

* 포즈 분석용 사진 1장 (저해상도 사본)

#### 사용 모델

* `gpt-5.4-mini`

#### 출력 요구 형식

반드시 JSON으로 받는다.

예시:

```json
{
  "people_count": 2,
  "pose_summary": "energetic group pose with raised hands",
  "recommended_keywords": {
    "theme": ["우주", "로켓", "미래도시"],
    "mood": ["역동적인", "반짝이는", "웅장한"],
    "color": ["파랑", "보라", "네온"],
    "effect": ["별빛", "빛줄기", "홀로그램"]
  },
  "ui_caption": "활기찬 포즈에 어울리는 키워드를 추천했어요!"
}
```

#### 키워드 제한 규칙

* 카테고리당 정확히 3개 추천
* 미리 정의한 허용 키워드 집합 안에서만 추천하도록 유도
* 부적절하거나 행사와 무관한 키워드는 제외

### 5-3. 허용 키워드 집합

에이전트는 아래 기본 세트를 상수로 정의하고 사용한다.

#### 주제(theme)

* 우주
* 로켓
* 수학
* AI
* 로봇
* 실험실
* 미래도시
* 천체관측
* 화학
* DNA
* 공학
* 과학축제

#### 분위기(mood)

* 신비로운
* 웅장한
* 귀여운
* 반짝이는
* 사이버
* 차분한
* 발랄한
* 미래적인
* 지적인
* 역동적인

#### 색감(color)

* 파랑
* 보라
* 핑크
* 네온
* 은색
* 금색
* 초록
* 무지개
* 남색
* 파스텔

#### 효과(effect)

* 별빛
* 로켓
* 수식
* DNA
* 홀로그램
* 기어
* 빛줄기
* 전기 스파크
* 행성
* 칠판
* 글리터

### 5-4. 배경 생성

#### 사용 모델

* `gpt-image-2`
* 품질: `medium`

#### 생성 방향

* 세로형 배경
* 포토부스용
* 배경만 생성
* 사람/얼굴/텍스트 없음
* 중앙 또는 인물 배치 공간 고려
* 과도하게 복잡하지 않게

#### 기본 프롬프트 템플릿

```text
Create a vertical photobooth background for a science festival.

Theme: {theme}
Mood: {mood}
Color palette: {color}
Effects / objects: {effect}

Requirements:
- Background only
- No people
- No faces
- No readable text
- Suitable for compositing people in front
- Visually appealing for a four-cut photo booth
- Science festival style
- Keep the center area relatively clean for subject placement
```

#### 크기

* 세로형 권장
* 예: `1024x1536` 또는 이에 준하는 세로 비율

### 5-5. 4컷 촬영

* 총 4장 촬영
* 각 컷은 PNG/JPEG 저장
* 사용자는 촬영 사이에 포즈를 바꿀 수 있음
* 각 컷별 미리보기를 너무 자세히 넣기보다는 빠르게 진행
* 재촬영 기능은 MVP에서 생략 가능, 필요 시 전체 4컷 재촬영만 제공

### 5-6. 인물 분리 및 배경 합성

#### 목표

* 각 촬영 사진에서 사람을 분리
* 생성된 AI 배경과 합성
* 네컷 템플릿에 배치

#### 우선 구현

* 1순위: 로컬 세그멘테이션 기반 마스크 생성
* 2순위: fallback 구현 가능

#### 합성 규칙

* 배경은 4컷 전체에 동일하게 사용
* 각 컷의 인물 비율이 과도하게 작거나 크게 나오지 않도록 자동 스케일 조정
* 최종 네컷 프레임은 상단에 행사명 혹은 기본 장식이 있을 수 있으나, MVP에서는 텍스트 없는 기본 프레임도 허용

### 5-7. 네컷 템플릿 렌더링

* 4개의 합성 이미지를 세로형 4분할 배치
* 여백과 테두리 제공
* 최종 결과는 1장의 이미지 파일로 저장
* 이미지 품질은 이메일 첨부에 적절한 수준 유지

### 5-8. 이메일 발송

#### 사용 서비스

* Brevo Transactional Email API

#### 발송 내용

* 제목 예시:

  * `[경남과학고 수학과학페스티벌] AI 네컷사진이 도착했습니다`
* 본문 예시:

  * 행사 안내 및 간단한 감사 문구
  * 첨부 이미지 또는 다운로드 링크

#### 권장 방식

* 우선순위 1: 이미지 첨부
* 우선순위 2: 서버 임시 다운로드 링크

#### 발송 후 처리

* 성공 시 세션 파일 즉시 삭제
* 실패 시 재시도 가능 상태 유지
* 일정 시간 후 강제 삭제

---

## 6. OpenAI 프롬프트 설계

### 6-1. 포즈 분석 프롬프트

#### system

```text
You are an assistant for an AI photo booth at a science festival.
Analyze the user's pose and overall mood from the given image.
Return only valid JSON.
Use only the allowed keyword sets provided by the developer.
Recommend exactly 3 keywords for each category: theme, mood, color, effect.
Keep the result family-friendly, science-festival-appropriate, and visually useful for background generation.
```

#### developer / user payload 구성 예시

* 허용 키워드 목록 전달
* 출력 JSON schema 설명
* 분석 대상 이미지 전달

#### 출력 스키마

```json
{
  "people_count": 1,
  "pose_summary": "string",
  "recommended_keywords": {
    "theme": ["string", "string", "string"],
    "mood": ["string", "string", "string"],
    "color": ["string", "string", "string"],
    "effect": ["string", "string", "string"]
  },
  "ui_caption": "string"
}
```

### 6-2. 프롬프트 후처리

* 결과 JSON 파싱 실패 시 1회 재시도
* 재시도 실패 시 기본 인기 키워드 세트 사용

기본 fallback 예시:

```json
{
  "theme": ["우주", "AI", "미래도시"],
  "mood": ["반짝이는", "미래적인", "신비로운"],
  "color": ["파랑", "보라", "네온"],
  "effect": ["별빛", "홀로그램", "빛줄기"]
}
```

---

## 7. API 설계

### 7-1. 엔드포인트 목록

#### `POST /api/session/start`

* 새 세션 생성
* 응답: `sessionId`

#### `POST /api/analyze-pose`

* 입력:

  * `sessionId`
  * 포즈 분석용 이미지
* 처리:

  * 이미지 저장
  * 저해상도 사본 생성
  * GPT-5.4 mini 호출
* 응답:

  * 추천 키워드 JSON

#### `POST /api/generate-background`

* 입력:

  * `sessionId`
  * 사용자 선택 키워드
* 처리:

  * gpt-image-2 호출
  * 배경 저장
* 응답:

  * background image URL 또는 session reference

#### `POST /api/upload-shot`

* 입력:

  * `sessionId`
  * shot index (1~4)
  * 촬영 이미지
* 처리:

  * 파일 저장
* 응답:

  * 업로드 성공 여부

#### `POST /api/compose`

* 입력:

  * `sessionId`
* 처리:

  * 인물 분리
  * 배경 합성
  * 네컷 템플릿 렌더링
* 응답:

  * 최종 네컷 이미지 URL

#### `POST /api/send-email`

* 입력:

  * `sessionId`
  * email
* 처리:

  * Brevo 발송
  * 성공 시 정리 작업 큐 등록/즉시 실행
* 응답:

  * 발송 성공 여부

#### `POST /api/reset-session`

* 세션 초기화 및 파일 삭제

#### `POST /api/cleanup-expired`

* 만료 세션 정리용 내부 엔드포인트 또는 cron job

---

## 8. 디렉터리 구조 제안

```text
project-root/
  app/
    page.tsx
    booth/
      page.tsx
    result/
      page.tsx
    api/
      session/
        start/route.ts
        reset/route.ts
      analyze-pose/route.ts
      generate-background/route.ts
      upload-shot/route.ts
      compose/route.ts
      send-email/route.ts
      cleanup-expired/route.ts

  components/
    CameraPreview.tsx
    Countdown.tsx
    KeywordSelector.tsx
    ShotCapture.tsx
    ResultPreview.tsx
    EmailForm.tsx
    ConsentPanel.tsx
    LoadingScreen.tsx

  lib/
    openai.ts
    brevo.ts
    session-store.ts
    storage.ts
    prompts.ts
    keywords.ts
    image-compose.ts
    segmentation.ts
    validators.ts
    types.ts

  public/
    pose-guides/
    templates/

  temp/
    sessions/

  scripts/
    cleanup-temp.ts

  .env.example
  README.md
  plan.md
```

---

## 9. 환경변수 설계

`.env.example` 에 아래 항목을 포함한다.

```env
OPENAI_API_KEY=
OPENAI_ANALYSIS_MODEL=gpt-5.4-mini
OPENAI_IMAGE_MODEL=gpt-image-2

BREVO_API_KEY=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=

APP_BASE_URL=http://localhost:3000
SESSION_TTL_MINUTES=1440
TEMP_STORAGE_DIR=./temp/sessions
MAX_BACKGROUND_REGEN=1
```

---

## 10. 데이터 보관 및 삭제 정책

### 10-1. 원칙

* 사진/이메일은 행사 서비스 제공 목적으로만 사용
* 임시 저장만 허용
* 발송 완료 시 가능한 즉시 삭제
* 예외 상황 대비 최대 24시간 이내 자동 삭제

### 10-2. 구현 요구

* 세션별 temp 폴더 생성
* 완료/실패/만료 시 세션 폴더 삭제
* 주기적 cleanup 스크립트 제공
* 로그에는 이메일 전체를 그대로 남기지 않고 마스킹 가능하면 적용

---

## 11. 실패 대응 / fallback

### 11-1. 포즈 분석 실패

* 기본 인기 키워드 세트 표시

### 11-2. 배경 생성 실패

* 1회 자동 재시도
* 그래도 실패 시 “기본 테마 배경” 제공

### 11-3. 세그멘테이션 실패

* 단순 크롭 + 배경 겹치기 fallback 가능 여부 검토
* 최소한 서비스 전체가 중단되지 않도록 설계

### 11-4. 이메일 발송 실패

* 발송 실패 문구 표시
* 같은 세션에서 재전송 허용
* 세션 데이터는 바로 삭제하지 않음

### 11-5. 네트워크 지연

* 로딩 상태를 명확하게 표시
* 사용자가 중복 클릭하지 않도록 버튼 비활성화

---

## 12. 구현 단계 (에이전트 작업 순서)

### Phase 1. 프로젝트 초기화

* Next.js + TypeScript + Tailwind 프로젝트 생성
* 기본 디렉터리 구조 구성
* `.env.example` 작성
* README 초안 작성

### Phase 2. 세션/스토리지 기반 마련

* session store 구현
* temp 디렉터리 생성/삭제 유틸 작성
* TTL cleanup 로직 구현

### Phase 3. 기본 UI 흐름 구현

* 시작/동의/포즈가이드/촬영/선택/결과/이메일 화면 뼈대 구성
* 화면 전환 상태 관리

### Phase 4. 카메라 및 촬영 기능 구현

* 웹캠 프리뷰
* 분석용 촬영 1장
* 4컷 촬영
* 카운트다운 및 저장

### Phase 5. OpenAI 포즈 분석 연동

* `/api/analyze-pose` 구현
* GPT-5.4 mini 프롬프트 작성
* JSON 파싱 및 fallback 처리
* 추천 키워드 UI 연결

### Phase 6. 키워드 선택 및 배경 생성

* 카테고리별 선택 UI 구현
* `/api/generate-background` 구현
* gpt-image-2 medium 호출
* 생성 배경 저장 및 미리보기 연결

### Phase 7. 인물 분리 및 합성

* 세그멘테이션 구현
* 배경 합성 구현
* 4컷 템플릿 렌더링 구현
* `/api/compose` 연결

### Phase 8. Brevo 이메일 발송

* `/api/send-email` 구현
* 이메일 유효성 검사
* 첨부 발송 또는 링크 발송 구현
* 성공/실패 UX 처리

### Phase 9. 정리/안정화

* cleanup 스크립트
* 오류 처리
* 로딩 UX 정리
* 로그 정리
* 민감정보 최소 기록 확인

### Phase 10. 테스트 및 최종 정리

* E2E 흐름 테스트
* 성능 점검
* README 정리
* 운영 체크리스트 문서화

---

## 13. 테스트 계획

### 13-1. 기능 테스트

* 시작부터 이메일 발송까지 전체 흐름 성공 여부
* 추천 키워드 정상 표시 여부
* 배경 생성 성공 여부
* 4컷 템플릿 렌더링 성공 여부
* Brevo 이메일 발송 성공 여부

### 13-2. 예외 테스트

* OpenAI 응답 JSON 오류
* 배경 생성 실패
* 이메일 발송 실패
* 사용자가 도중에 이탈한 세션 만료 처리
* 카메라 접근 거부

### 13-3. UX 테스트

* 행사장에서 1인당 평균 소요 시간 목표: 60~120초
* 버튼 문구 이해 가능성
* 키워드 선택이 너무 복잡하지 않은지 확인

### 13-4. 성능 목표

* 포즈 분석: 5초 이내
* 배경 생성: 15초 내외 목표
* 합성: 10초 이내 목표
* 전체 흐름: 2분 내외 목표

---

## 14. 완료 기준 (Definition of Done)

아래 조건을 모두 만족하면 완료로 본다.

1. 사용자가 웹에서 시작 버튼을 누르고 전체 체험을 진행할 수 있다.
2. 포즈 분석용 촬영 1장으로 추천 키워드가 표시된다.
3. 사용자가 카테고리별 키워드를 선택할 수 있다.
4. 선택한 키워드로 AI 배경이 생성된다.
5. 4컷 촬영이 가능하다.
6. 생성 배경과 4컷 사진이 합성되어 최종 네컷 이미지가 생성된다.
7. 사용자가 이메일을 입력하면 Brevo를 통해 이미지가 전송된다.
8. 세션 파일이 발송 후 정리되거나 TTL 기준으로 삭제된다.
9. 주요 실패 상황에서 fallback이 동작한다.
10. `.env.example`, `README.md`, 실행 방법 문서가 포함된다.

---

## 15. README에 반드시 포함할 내용

* 프로젝트 소개
* 실행 방법
* 환경변수 설정
* OpenAI/Brevo 설정 방법
* 로컬 개발 방법
* temp 파일 정리 방법
* 운영 시 주의사항
* 개인정보 처리 관련 주의사항

---

## 16. 최종 구현 지침

1. **우선 MVP 완성**을 목표로 한다.
2. OpenAI는 반드시 아래 모델 사용:

   * 포즈 분석 + 키워드 추천: `gpt-5.4-mini`
   * 배경 생성: `gpt-image-2` with `medium`
3. 이메일 발송은 반드시 **Brevo API** 사용
4. 최종 사진 원본을 OpenAI에 보내지 말고, 포즈 분석용 축소 이미지 1장만 사용
5. 배경 생성은 텍스트/사람 없는 세로형 배경으로 제한
6. 코드 구조는 유지보수 가능하게 모듈화
7. 실패 대응과 cleanup 로직을 반드시 포함
8. 결과물은 행사장에서 바로 시연 가능한 수준으로 완성


