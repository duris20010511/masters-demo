# Codex 작업 #4 — 샘플 분류 미니게임 (사이클 ②)

**확인 질문 없이 바로 구현할 것. 완료 후 `npm test`와 `npm run build`를 실행해 결과를 보여줄 것.**

## 맡기는 것
- 생성: `src/ui/minigame2.ts`, `tests/minigame2.test.ts`
- 수정 허용: `src/content/strings.ts`에 **`sample` 섹션 추가만** (기존 키 수정 금지)
- 그 외 파일은 절대 수정하지 말 것.

## 먼저 읽을 것 (패턴 참고)
- `src/ui/minigame1.ts` — 같은 구조·스타일로 만들 것 (DOM 오버레이, Overlay 사용법, 스탯·일지 반영)
- `src/ui/overlay.ts` — showChoices / showSubtitle의 공개 API
- `src/core/state.ts`, `src/core/journal.ts`

## 고정 인터페이스 (변경 금지)

```ts
export function resolveSampleGame(errors: number): {
  trust: number
  aptitude: number
  journal: 'cycle2_good' | 'cycle2_bad'
}
// 오류 0~1개: { trust: +5, aptitude: +15, journal: 'cycle2_good' }
// 오류 2~3개: { trust: 0,  aptitude: 0,   journal: 'cycle2_bad' }   ← 의도적 적당함도 탈출 전략
// 오류 4개 이상: { trust: -15, aptitude: 0, journal: 'cycle2_bad' }

export function runSampleMinigame(
  state: GameState,
  overlay: Overlay,
  rand?: () => number, // 기본 Math.random — 들킴 판정에만 사용
): Promise<void>
```

## 게임 내용 (스펙 §6-2)

냉동고 앞 샘플 분류. 어두운 금속 패널 스타일의 전체 화면 DOM (미니게임 ①의 밝은 종이 시트와 대비되게 — 배경 `#2b2e33`, 텍스트 밝게).

1. **샘플 튜브 6개**가 표시된다. 각 튜브: 라벨(지시: "보관" 또는 "폐기")과 내용 설명 (예: "조직 샘플 03 — 정상", "배양 실패 07 — 폐기 대상").
2. 튜브 클릭 → "보관 / 폐기" 버튼 2개 → 선택하면 그 튜브는 판정 완료로 표시.
3. 라벨 지시와 다르게 분류하면 오류 1 누적. **오류 카운트는 화면에 절대 표시하지 않는다.**
4. **치아 튜브**: 6개 중 하나는 내용이 "조직 샘플 12 — 검은 점"이고 [자세히 본다] 버튼이 따로 있다. 누르면 확대 설명("점이 아니다. 작은 치아다.")과 함께 `applyStat(state, 'sanity', -10)` (1회만). 라벨 지시는 "보관".
5. 6개 모두 판정 후 `resolveSampleGame(오류수)` 적용 → applyStat 2회 + addJournal.
6. **폐기물통 비트** (분류 끝난 뒤): 자막 "폐기물통 안쪽에서 — 톡, 톡, 톡." → 선택지 [뚜껑에 귀를 댄다 / 그냥 봉인한다].
   - 귀를 댄다: 자막 "…선배님." → `applyStat(state, 'sanity', -10)`, `state.flags.heardVoice = true`
   - 봉인한다: 자막 "테이프로 한 번 더 감았다."
7. 부가 선택지 (폐기물통 비트 후): [기록을 몰래 검색한다 / 그만둔다]. 검색하면 자막 "폐기 대상: 실패 개체 04 — 주의: 이름을 부르지 말 것." + `state.flags.searchedRecords = true`, 이때 `rand() < 0.3`이면 들킴 — 자막 "…뭐 찾아?" + `applyStat(state, 'trust', -10)`.
8. 함수는 여기서 resolve. (다음 단계 연결은 호출측이 함)

## 테스트에 반드시 포함
- resolveSampleGame 경계값: 0, 1, 2, 3, 4 각각의 반환값 정확성 (위 표 그대로)
- journal 매핑 (0→good, 2→bad, 4→bad)

## 제약
- 새 라이브러리 금지. 미니게임 ①과 같은 순수 DOM 방식.
- 텍스트는 `strings.ts`의 새 `sample` 섹션에 모을 것.
- 기존 테스트 22개를 깨뜨리지 말 것.
