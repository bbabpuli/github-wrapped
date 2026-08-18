# 🎁 GitHub Wrapped

올해 당신의 GitHub 활동을 카드 한 장으로 — 스포티파이 연말 결산의 개발자 버전.

유저명을 입력하면 커밋·PR·언어·잔디·streak을 분석해 공유용 카드를 만들어 줍니다.
링크를 X/카카오톡에 붙이면 카드 이미지가 미리보기로 뜹니다.

## 기능

- 연간 커밋 / PR / 이슈 / 리뷰 통계
- 언어 TOP 5 (repo별 바이트 합산)
- 잔디 히트맵, 최장 연속 기여 streak, 가장 뜨거웠던 달, 가장 활발한 요일
- 한 줄 총평 (템플릿 기반, `ANTHROPIC_API_KEY` 설정 시 AI 총평)
- 한국어 / English
- OG 카드 이미지 (`/api/og/{username}`) — 링크 공유 = 카드 공유

## 실행

```bash
cp .env.example .env.local   # GITHUB_TOKEN에 PAT 입력 (scope 불필요)
npm install
npm run dev                  # http://localhost:3000
npm test                     # vitest
```

## 스택

Next.js 16 (App Router) · TypeScript · Tailwind · next/og · vitest
