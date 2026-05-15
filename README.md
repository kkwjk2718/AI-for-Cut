# AI와 함께하는 수과정페 네컷

경남과학고 수학, 과학, 정보 페스티벌용 AI 네컷 포토부스입니다. 수과정페는 수학과학정보페스티벌의 줄임말입니다. 카메라로 포즈를 분석하고, 추천 키워드를 선택해 배경을 생성한 뒤 네 장의 사진을 합성해 이메일로 전송합니다.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 팀 기여

이 저장소는 공개 저장소입니다. 팀원은 기능 브랜치를 만들고 Pull Request를 열어 변경 사항을 제안합니다.

- `main` 브랜치는 보호됩니다. 직접 푸시하지 말고 PR로 변경하세요.
- PR은 코드 오너 승인 후 머지됩니다.
- 기여 절차는 [CONTRIBUTING.md](CONTRIBUTING.md)를 따릅니다.
- 개인정보 처리 기준은 [PRIVACY.md](PRIVACY.md)를 따릅니다.
- 버그 제보와 기능 제안은 GitHub Issues 템플릿을 사용합니다.
- 실제 참가자 사진, 이메일 주소, `.env`, 운영 로그, 임시 세션 파일은 커밋하지 않습니다.

기본 확인 명령은 아래 두 가지입니다.

```bash
npm run typecheck
npm run build
```

## 환경 변수

`.env.example`을 참고해 `.env`를 만듭니다.

- `OPENAI_API_KEY`: OpenAI API 키
- `OPENAI_ANALYSIS_MODEL`: 기본값 `gpt-5.4-mini`
- `OPENAI_IMAGE_MODEL`: 기본값 `gpt-image-2`
- `OPENAI_ANALYSIS_TIMEOUT_MS`, `OPENAI_IMAGE_TIMEOUT_MS`, `OPENAI_IMAGE_DOWNLOAD_TIMEOUT_MS`: OpenAI 요청 타임아웃
- `BREVO_API_KEY`: Brevo Transactional Email API 키
- `BREVO_SENDER_EMAIL`: 발신 이메일
- `BREVO_SENDER_NAME`: 발신자 이름
- `ADMIN_PIN`: 관리자 페이지 접속 PIN
- `ADMIN_ARCHIVE_ENABLED`: 관리자 아카이브 opt-in. 기본값은 `false`
- `ADMIN_ARCHIVE_STORE_IMAGES`: 완성 사진 이미지 저장 여부. 기본값은 `false`
- `ADMIN_ARCHIVE_TTL_HOURS`: 관리자 기록 보관 시간. 기본값은 `24`
- `CRON_SECRET`: `POST /api/cleanup-expired` 호출 보호용 Bearer 토큰
- `EVENT_LOG_DIR`: 개인정보를 제외한 운영 이벤트/에러 로그 디렉터리
- `TEMP_STORAGE_DIR`: 세션 임시 파일 디렉터리
- `ADMIN_ARCHIVE_DIR`: 관리자 기록 및 선택 저장 이미지 디렉터리
- `SESSION_TTL_MINUTES`: 실패 또는 미완료 세션 보관 시간
- `OPENAI_ANALYSIS_INPUT_USD_PER_1M`, `OPENAI_ANALYSIS_CACHED_INPUT_USD_PER_1M`, `OPENAI_ANALYSIS_OUTPUT_USD_PER_1M`: 포즈 분석 모델 비용 계산 단가
- `OPENAI_IMAGE_TEXT_INPUT_USD_PER_1M`, `OPENAI_IMAGE_TEXT_CACHED_INPUT_USD_PER_1M`, `OPENAI_IMAGE_OUTPUT_USD_PER_1M`: 배경 생성 모델 비용 계산 단가
- `OPENAI_IMAGE_FIXED_COST_USD_1024x1536_MEDIUM`: 이미지 생성 usage가 없을 때 쓰는 고정 비용. 기본값은 `0.041`

개발 모드에서는 OpenAI 키가 없을 때만 기본 과학축제 배경을 생성합니다. OpenAI 키가 설정된 상태에서 이미지 생성이 실패하면 재시도가 필요한 오류로 처리합니다.

## 관리자 페이지

`http://localhost:3000/admin`에서 완성 시간, 선택 키워드, AI 비용, 메일 상태를 확인할 수 있습니다. 운영 환경에서는 `.env`에 `ADMIN_PIN`을 반드시 설정하세요. 개발 환경에서 `ADMIN_PIN`이 없으면 기본 PIN은 `0000`입니다.

- `http://localhost:3000/admin/health`에서 OpenAI 연결, Brevo 연결, temp 저장소, 디스크 여유 공간, MediaPipe asset, 브랜드 asset, CRON_SECRET, 사진 아카이브 설정을 운영 전에 확인합니다.
- 기본 관리자 기록에는 얼굴 사진 원본, 완성 사진 이미지, 이메일 주소를 저장하지 않습니다.
- 완성 사진 이미지는 `ADMIN_ARCHIVE_ENABLED=true`, `ADMIN_ARCHIVE_STORE_IMAGES=true`, 사용자의 선택 저장 동의가 모두 충족될 때만 저장합니다.
- 관리자 기록에는 완성 시간, 선택 키워드, AI 사용량, 메일 전송 상태를 저장하고 `ADMIN_ARCHIVE_TTL_HOURS` 이후 정리합니다.
- 비용은 OpenAI API가 반환한 usage token과 환경 변수의 USD/1M token 단가로 계산합니다.
- 이미지 생성 usage가 없으면 `OPENAI_IMAGE_FIXED_COST_USD_1024x1536_MEDIUM` 고정 비용으로 기록합니다.
- 이미지 생성이 `OPENAI_IMAGE_TIMEOUT_MS` 안에 끝나지 않으면 자동 대체 배경으로 진행하지 않고 재시도가 필요한 오류로 처리합니다.
- 카메라, Sharp 이미지 합성, Brevo 메일 비용은 포함하지 않습니다.

## 주요 흐름

1. 개인정보 수집 및 이용 동의
2. 분석용 사진 1장 촬영
3. OpenAI 포즈 분석 및 키워드 추천
4. 키워드 선택 후 배경 생성 시작
5. 배경 생성과 병렬로 최종 사진 6장 촬영
6. 최종 사진 4장 선택, 얼굴 보정 미리보기, 브라우저 인물 분리
7. 서버에서 배경과 네컷 템플릿 합성
8. 이메일 주소 확인 후 Brevo 이메일 전송 또는 메일 건너뛰기
9. 전송 성공 후 세션 파일 삭제

## 임시 파일 정리

만료 세션은 API 또는 스크립트로 정리할 수 있습니다.

```bash
npm run cleanup-temp
```

또는 운영 환경에서 `POST /api/cleanup-expired`를 주기적으로 호출합니다. 요청에는 `Authorization: Bearer ${CRON_SECRET}` 헤더가 필요합니다.

## 운영 주의사항

- 최종 네컷 원본은 OpenAI로 보내지 않습니다.
- 포즈 분석에는 512px 이하로 축소한 이미지 한 장만 사용합니다.
- 사진과 결과물은 `temp/sessions` 아래 세션 단위로 저장됩니다.
- 이메일 전송 성공 후 세션 디렉터리는 즉시 삭제됩니다.
- 오류 또는 미완료 세션은 `SESSION_TTL_MINUTES` 기준으로 최대 24시간 보관한 뒤 정리하는 운영을 권장합니다.
- 업로드 이미지는 최대 8MB, 최대 20MP로 제한합니다.
- 주요 API에는 IP 기반 메모리 rate limit을 적용합니다.
- 세션 상태 업데이트는 세션별 lock으로 순차 처리합니다.
- 초록 크로마키 배경을 우선 제거하고, 크로마키가 충분히 감지되지 않을 때만 MediaPipe 인물 분리로 fallback합니다.
- MediaPipe 런타임 파일은 `public/vendor/mediapipe/selfie_segmentation`에서 로컬로 제공합니다.
- 인물 분리에 실패하거나 alpha가 없는 사진 업로드가 들어오면 합성을 진행하지 않고 재촬영을 요구합니다.
- 이메일 첨부는 `gshs-ai-4cut-hq.jpg` JPEG quality 97, 4:4:4 색상 샘플링으로 전송합니다.
- 운영 이벤트와 에러는 `EVENT_LOG_DIR`에 JSONL로 남기며, 이메일과 원본 사진은 로그에 저장하지 않습니다.
- Linux/Docker 운영 시 최종 프레임의 한글 렌더링과 폰트 설치를 별도로 확인하세요.
- 외부 손님 운영 시 만 14세 미만 참가자는 보호자 또는 인솔자 동의가 필요합니다.
- 카메라 권한이 거부되면 촬영 흐름을 진행할 수 없습니다.
