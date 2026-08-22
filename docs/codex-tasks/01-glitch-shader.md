# Codex 작업 #1 — 글리치 프래그먼트 셰이더

## 맡기는 것
`src/render/glitchShader.ts`의 `fragmentShader` GLSL 문자열 **본체만** 교체 구현.
파일의 다른 부분(uniforms 정의, vertexShader, export 이름)은 절대 수정하지 말 것.

## 고정 인터페이스 (변경 금지)
- `sampler2D tDiffuse` — 렌더된 씬
- `float uTime` — 초 단위 경과 시간
- `float uVignette` (0~1) — 화면 가장자리 어두움 강도
- `float uGrain` (0~1) — 필름 그레인 강도
- `float uGlitch` (0~1) — 글리치 강도 (아래 상세)
- `float uRgbShift` (0~1) — RGB 채널 분리 강도 (0.02 UV 오프셋 상한)
- `varying vec2 vUv`

## uGlitch 동작 상세 (0→1로 갈수록)
1. 수평 스캔라인 블록이 무작위로 좌우로 찢어진다 (블록 높이 5~40px 상당, 개수는 강도 비례)
2. 화면 일부에 블록 노이즈(사각형 색면)가 깜빡인다
3. 0.7 이상에서는 프레임 전체가 간헐적으로 밝은 노이즈로 덮인다 (VHS 트래킹 실패 느낌)
4. uTime 기반 의사난수 사용 (hash/fract-sin). 텍스처 추가 금지, 외부 함수 추가 금지.

## 품질 기준
- WebGL1/WebGL2 겸용 GLSL (three ShaderPass 기본). 컴파일 오류 없이 동작.
- uGlitch=0, uRgbShift=0이면 비네트+그레인만 남고 원본 화면이 또렷해야 함.
- 분기 최소화, 루프 상한 고정 (모바일 아님, 내장 GPU 60fps 기준).

## 검증 방법
`npm run dev` → 브라우저 콘솔에서 `window.__fx.set({ glitch: 0.8, rgbShift: 0.5 })` 실행 시
화면이 위 설명대로 무너지는지 확인. (main.ts가 `window.__fx`를 노출함)
