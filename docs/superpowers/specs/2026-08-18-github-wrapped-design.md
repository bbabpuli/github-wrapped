# GitHub Wrapped — 설계 스펙

- 날짜: 2026-08-18
- 상태: 사용자 승인 완료 (설계안 채팅 승인 2026-08-18)
- 레포: `bbabpuli/github-wrapped` (public, 개인 토이 프로젝트 — weknew 무관)
- 로컬: `~/Documents/toy-project/github-wrapped`

## 1. 개요

스포티파이 연말 결산의 개발자 버전. GitHub 유저명을 입력하면 올해 활동
(커밋·PR·언어·잔디·streak)을 분석해 **공유하고 싶게 생긴 카드**로 렌더링하는
웹 서비스. 링크를 X/카카오톡에 붙이면 OG 이미지로 카드가 미리보기되는 구조라
"결과물을 자랑한다 → 남도 해본다"는 바이럴 루프가 핵심.

목표는 GitHub에 올렸을 때 반응 좋은 완성형 토이프로젝트. 승부처는 카드 디자인.

## 2. 확정 결정

| 항목 | 결정 | 근거 |
|---|---|---|
| 형태 | 웹 서비스형 | 링크 공유만으로 카드가 퍼지는 구조, 바이럴 최적 |
| 스택 | Next.js(App Router) + TypeScript + Tailwind | @vercel/og와 한 몸, Vercel 배포 표준 |
| 카드 렌더 | `@vercel/og` (satori) 서버 렌더 | OG 미리보기 = 카드 공유, 클라이언트 canvas 불필요 |
| 배포 | Vercel 무료 (`*.vercel.app`) | 서버 관리 제로, 커스텀 도메인은 나중에 |
| GitHub 인증 | 서버 환경변수 `GITHUB_TOKEN` (개인 PAT) | 공개 데이터만 조회, OAuth 불필요. rate limit 5,000/hr |
| AI 총평 | v1은 통계 기반 템플릿 문구 폴백, `ANTHROPIC_API_KEY` 설정 시 Haiku 실총평 | tinyou map-avatar 폴백 패턴 재사용. 키 활성화는 v2 |
| 언어 | 한국어/영어 토글 | 차별화 포인트 (기존 유사 서비스는 영어만) |

## 3. 아키텍처 (3개 유닛)

### 3.1 데이터 수집 — `lib/github.ts`

- GitHub GraphQL API `contributionsCollection` 중심으로 1~2회 호출:
  - 연간 커밋/PR/이슈/리뷰 수, contribution calendar(잔디 일 단위),
    기여 repo 목록(+ 각 repo의 언어 바이트), 프로필(이름·아바타)
- 인증: 서버 전용 `GITHUB_TOKEN` (클라이언트 노출 금지)
- 캐시: 유저별 결과 1시간 (Next.js `unstable_cache` 또는 fetch revalidate)
  → rate limit 방어 + 반복 조회 응답속도
- 반환: 원시 GraphQL 응답을 얇은 타입(`RawContributions`)으로 정규화만 수행,
  계산은 하지 않음

### 3.2 통계 계산 — `lib/stats.ts`

순수 함수 모음 (입력: RawContributions, 출력: `WrappedStats`). 부수효과 없음 → 단위 테스트 대상.

- 연간 총계: 커밋/PR/이슈/리뷰 수
- 언어 TOP 5: 기여 repo 언어 바이트 합산, 비율 %
- 최장 연속 기여 streak (일 단위)
- 가장 뜨거웠던 달 (월별 기여 합산 최대)
- 요일별 패턴 (가장 활발한 요일)
- 가장 많이 기여한 repo TOP 5
- 총평 문구 선택: 통계 조합 → 템플릿 문구 (예: "3월에 불타올랐던 TypeScript 장인")

제외(v1): 시간대별 분석 — GraphQL이 일 단위 데이터만 제공, REST 커밋 샘플링은 YAGNI.

### 3.3 렌더링 — `app/`

- `/` — 유저명 입력 폼. 입력 → `/{username}` 이동
- `/{username}` — 결과 페이지: 통계 카드 + 잔디 히트맵 + [이미지 저장]·[X에 공유] 버튼.
  OG 메타태그가 `/api/og/{username}`을 가리킴 → 링크 공유 = 카드 공유
- `/api/og/{username}` — @vercel/og로 카드 PNG 렌더 (결과 페이지와 동일 디자인 축약판)
- 한국어/영어 토글: 쿼리 파라미터(`?lang=en`) + 클라이언트 토글, 문구 사전 분리

## 4. 데이터 흐름

```
유저명 입력 → /{username} (서버 컴포넌트)
  → lib/github.ts (GraphQL, 1h 캐시)
  → lib/stats.ts (순수 계산)
  → 페이지 렌더 + OG 메타 → /api/og/{username} (동일 파이프라인 재사용)
```

## 5. 에러 처리

- 존재하지 않는 유저 → 안내 페이지 (404 아닌 친절한 재입력 유도)
- rate limit 초과 → 캐시된 값 반환, 없으면 재시도 안내
- GraphQL 부분 실패 → 있는 통계만 렌더 (없는 항목은 카드에서 생략)
- OG 렌더 실패 → 기본 대체 카드

## 6. 테스트 전략

- `lib/stats.ts`: vitest 단위 테스트, TDD (streak 경계·빈 데이터·단일 언어 등 엣지 포함)
- `lib/github.ts`: GraphQL 응답 fixture 기반 정규화 테스트
- 페이지·OG 카드: 로컬 실기 확인 (`npm run dev` + 실제 유저명) → Vercel 배포 후 재검증

## 7. v1 제외 (YAGNI)

- OAuth 로그인 (private 기여 포함) — 공개 데이터만
- 시간대별 분석
- 연도 선택 (올해 고정)
- 커스텀 도메인
- AI 실총평 활성화 (폴백 슬롯만 준비, v2에서 키 설정)

## 8. 운영 메모

- 개인 프로젝트: weknew 규칙(이슈 자동등록·worklog) 미적용, 이슈 단위 이력 관리는
  pay-pos/tinyou 패턴으로 개인 레포에서 수행
- gh 푸시: 활성 계정이 `dongeun0303`으로 바뀌는 경우 있음 → push 전
  `gh auth switch --user bbabpuli` 확인 (tinyou 학습)
- Vercel 환경변수: `GITHUB_TOKEN` (필수), `ANTHROPIC_API_KEY` (선택, v2)
