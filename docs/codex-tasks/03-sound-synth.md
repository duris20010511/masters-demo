# Codex 작업 #3 — 프로시저럴 사운드 신시사이저

**확인 질문 없이 바로 구현할 것. 완료 후 `npm run build`를 실행해 결과를 보여줄 것.**

## 맡기는 것
새 파일 1개 생성: `src/audio/soundSynth.ts`
다른 파일은 절대 수정하지 말 것. 오디오 파일 추가 금지 — 전부 Web Audio 합성.

## 고정 인터페이스 (변경 금지 — 이대로 export)

```ts
export type OneShot = 'footstep' | 'glitch' | 'beep_error' | 'beep_ok' | 'knock' | 'whisper'
export type Loop = 'hum' | 'heartbeat'

export class SoundSynth {
  constructor(ctx: AudioContext)
  start(name: Loop, volume?: number): void   // 이미 켜져 있으면 무시. volume 기본 0.3
  stop(name: Loop): void
  play(name: OneShot, volume?: number): void // 원샷. volume 기본 0.5
  setHeartRate(v: number): void              // 0~1 → 50~140 BPM (heartbeat 루프 속도)
  dispose(): void                            // 모든 노드 정리
}
```

## 사운드 사양 (전부 OscillatorNode / 화이트노이즈 AudioBufferSource / BiquadFilter / GainNode 조합)

- **hum** (루프): 60Hz 사인 험 + lowpass 걸린 화이트노이즈를 아주 작게 — 형광등 소리. 미세한 볼륨 흔들림(LFO) 포함
- **heartbeat** (루프): 저역(55Hz 근처) 사인 더블탭 "쿵-쿵" 반복. setHeartRate로 BPM 50~140 보간. 강도는 start의 volume
- **footstep**: 80ms 저역 노이즈 버스트 (lowpass 250Hz), 어택 즉시·빠른 감쇠
- **glitch**: 120ms 하이패스 노이즈 스퍼트 + 사각파 스윕 — 치지직
- **beep_error**: 하강(880→440Hz) 사각파 2연타, 각 120ms
- **beep_ok**: 660→990Hz 상승 사인 단일음 180ms
- **knock**: 중저역(180Hz) 임펄스 "톡" 3연타, 간격 350ms (폐기물통)
- **whisper**: 1.2초 대역 협소(bandpass 1~2kHz) 노이즈, 느린 페이드 인/아웃 — 목소리 비슷하되 말로 안 들리게

## 구현 제약
- 외부 라이브러리 금지. `Math.random`은 노이즈 버퍼 생성에만 허용
- 노이즈 버퍼(1~2초)는 생성자에서 1회 만들어 재사용
- 각 play/start는 새 소스 노드를 만들되, dispose에서 전부 stop·disconnect
- TypeScript strict 통과 (`npm run build`의 tsc 단계)

## 검증
`npm run build` 통과. 브라우저 콘솔 검증 방법을 마지막 메시지에 한 줄로 안내할 것
(예: dev 콘솔에서 new AudioContext로 인스턴스 만들어 각 사운드 재생).
