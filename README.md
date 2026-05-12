# AI 네컷 포토부스

경남과학고 수학과학페스티벌용 AI 네컷 포토부스 MVP입니다. 카메라로 포즈를 분석하고, 추천 키워드를 선택해 배경을 생성한 뒤 네 장의 사진을 합성해 이메일로 전송합니다.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 환경 변수

`.env.example`을 참고해 `.env`를 만듭니다.

- `OPENAI_API_KEY`: OpenAI API 키
- `OPENAI_ANALYSIS_MODEL`: 기본값 `gpt-5.4-mini`
- `OPENAI_IMAGE_MODEL`: 기본값 `gpt-image-2`
- `BREVO_API_KEY`: Brevo Transactional Email API 키
- `BREVO_SENDER_EMAIL`: 발신 이메일
- `BREVO_SENDER_NAME`: 발신자 이름
- `ADMIN_PIN`: 관리자 페이지 접속 PIN
- `TEMP_STORAGE_DIR`: 세션 임시 파일 디렉터리
- `ADMIN_ARCHIVE_DIR`: 관리자 페이지용 완성본 아카이브 디렉터리
- `SESSION_TTL_MINUTES`: 실패 또는 미완료 세션 보관 시간
- `OPENAI_ANALYSIS_INPUT_USD_PER_1M`, `OPENAI_ANALYSIS_CACHED_INPUT_USD_PER_1M`, `OPENAI_ANALYSIS_OUTPUT_USD_PER_1M`: 포즈 분석 모델 비용 계산 단가
- `OPENAI_IMAGE_TEXT_INPUT_USD_PER_1M`, `OPENAI_IMAGE_TEXT_CACHED_INPUT_USD_PER_1M`, `OPENAI_IMAGE_OUTPUT_USD_PER_1M`: 배경 생성 모델 비용 계산 단가

OpenAI 키가 없거나 이미지 생성에 실패하면 기본 과학축제 배경을 생성합니다. Brevo 설정이 없으면 개발 모드로 전송을 건너뛰고 세션 파일을 삭제합니다.

## 관리자 페이지

`http://localhost:3000/admin`에서 완성된 네컷 이미지와 AI 비용을 확인할 수 있습니다. 운영 환경에서는 `.env`에 `ADMIN_PIN`을 반드시 설정하세요. 개발 환경에서 `ADMIN_PIN`이 없으면 기본 PIN은 `0000`입니다.

- 관리자 기록에는 완성된 네컷 이미지와 AI 사용량만 저장합니다.
- 원본 4장과 이메일 주소는 관리자 기록에 저장하지 않습니다.
- 비용은 OpenAI API가 반환한 usage token과 환경 변수의 USD/1M token 단가로 계산합니다.
- 카메라, Sharp 이미지 합성, Brevo 메일 비용은 포함하지 않습니다.

## 주요 흐름

1. 세션 생성 및 개인정보 안내 확인
2. 분석용 사진 1장 촬영
3. OpenAI 포즈 분석 및 키워드 추천
4. 키워드 선택 후 배경 생성
5. 네 장 촬영 및 브라우저 인물 분리
6. 서버에서 배경과 네컷 템플릿 합성
7. Brevo 이메일 전송
8. 전송 성공 후 세션 파일 삭제

## 임시 파일 정리

만료 세션은 API 또는 스크립트로 정리할 수 있습니다.

```bash
npm run cleanup-temp
```

또는 운영 환경에서 `POST /api/cleanup-expired`를 주기적으로 호출합니다.

## 운영 주의사항

- 최종 네컷 원본은 OpenAI로 보내지 않습니다.
- 포즈 분석에는 512px 이하로 축소한 이미지 한 장만 사용합니다.
- 사진과 결과물은 `temp/sessions` 아래 세션 단위로 저장됩니다.
- 이메일 전송 성공 후 세션 디렉터리는 즉시 삭제됩니다.
- 카메라 권한이 거부되면 촬영 흐름을 진행할 수 없습니다.
