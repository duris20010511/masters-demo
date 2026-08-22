# Codex 활용 로그

| 날짜 | 작업 | 프롬프트 요지 | 결과 | 사람이 결정·수정한 부분 |
|---|---|---|---|---|
| 2026-08-22 | 추적자 AI 상태머신 구현 (`src/chase/chaserAI.ts` + `tests/chaserAI.test.ts`) | 지시서 `docs/codex-tasks/02-chaser-ai.md` — ChaserConfig/Input/Output 인터페이스·상태 전이 규칙(patrol/investigate/chase/search/return)·테스트 시나리오 5종 고정, 경로탐색·Math.random·외부 import 금지 | 187줄 순수 로직 + 테스트 5개 전부 통과. 계약 완전 준수 (export 시그니처 일치, Math.random 0회, import 0회) | 사람이 상태 전이 규칙·감지 판정 공식·"보임" 정의·결정적 배회 패턴 요구를 지시서에 사전 확정. 게임 통합(복도 씬·occlusion 레이캐스트·완화 규칙)은 별도 수행 |
| 2026-08-22 | 글리치 포스트프로세싱 셰이더 구현 (`src/render/glitchShader.ts` fragmentShader 본체) | 지시서 `docs/codex-tasks/01-glitch-shader.md` — uniform 계약(tDiffuse·uTime·uVignette·uGrain·uGlitch·uRgbShift) 고정, 스캔라인 찢김·블록 노이즈·0.7↑ VHS 트래킹·RGB 분리 0.02 상한, 고정 루프·의사난수만 사용 | 고정 루프(찢김 6블록+사각 노이즈 4블록) + 12fps 프레임 양자화 글리치 완성. WebGL 예약어 충돌을 스스로 발견·수정. npm run build 통과 | 사람(Claude와 협업)이 uniform 인터페이스·강도 의미론·성능 제약(고정 루프, 텍스처 금지)을 사전 확정. 검증(uGlitch 0.85 시각 확인, 0 복원 확인, 기존 17개 테스트 유지)은 수령 후 별도 수행. 첫 세션이 승인 대기에서 멈춰 "확인 질문 없이 진행" 지시로 재개한 운영 교훈 기록 |
