# Realistic Horror Visuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the toy-like cast with textured digital humans and a silhouette-first distorted chaser.

**Architecture:** A CC0 MakeHuman GLB is the common base. `person.ts` creates laboratory instances from its PBR materials and a bone-distorted chaser instance. `main.ts` owns filmic renderer settings; scenes own their lights.

**Tech Stack:** TypeScript, Three.js r170, GLTFLoader, Vitest, Vite.

**Spec:** `docs/superpowers/specs/2026-08-23-realistic-horror-visuals-design.md`

## Global Constraints

- Ship self-contained GLB assets only under `public/assets/models/`.
- Use the CC0 `human.glb` asset from `kunalkushwaha/vsim`.
- Keep primitive load-failure fallbacks and add no runtime dependency.
- Record third-party provenance in `public/assets/models/ATTRIBUTION.md`.

---

### Task 1: Import and document the CC0 digital-human GLB

**Files:**

- Create: `public/assets/models/makehuman.glb`
- Create: `public/assets/models/ATTRIBUTION.md`

- [ ] Download the public source with `git clone --depth 1 https://github.com/kunalkushwaha/vsim.git` into a temporary directory.
- [ ] Copy only `packages/assets/library/human.glb` after confirming it has embedded textures and is below the configured triangle limit.
- [ ] Write attribution containing the source URL, `human.glb` filename, CC0 1.0 license, and its use as the laboratory/chaser base.
- [ ] Run `git status --short` and commit with `git commit -m "assets: add CC0 digital human"`.

### Task 2: Keep PBR maps while creating a distorted chaser

**Files:**

- Modify: `src/world/models.ts`
- Modify: `src/world/person.ts`
- Create: `tests/person.test.ts`

**Interfaces:**

- Add `tintMaterial(material: THREE.Material, color: number): THREE.Material`.
- Add `distortChaser(root: THREE.Object3D): void`.

- [ ] Write a failing test that asserts `tintMaterial` retains a `MeshStandardMaterial.map`, and a Mixamo fixture test that asserts the two forearm bones have local-Y scale `1.35` after `distortChaser`.
- [ ] Run `npm test -- tests/person.test.ts`; expect the missing helper imports to fail.
- [ ] Implement `tintMaterial` by cloning `MeshStandardMaterial` and changing color/roughness/emissive only; never clear map, normalMap, roughnessMap, or metalnessMap.
- [ ] Implement `distortChaser` by scaling `mixamorigLeftForeArm`, `mixamorigRightForeArm`, `mixamorigLeftLeg`, and `mixamorigRightLeg` to `1.35` when present.
- [ ] Point person and chaser loading to `./assets/models/vitruvian_body.glb`, keep the primitive fallback, and use `Idle`, `Sway`, and `Walk` clips if present.
- [ ] Re-run `npm test -- tests/person.test.ts`; expect pass, then commit with `git commit -m "feat: use textured digital humans"`.

### Task 3: Configure a filmic PBR renderer

**Files:**

- Modify: `src/main.ts`
- Create: `tests/rendererConfig.test.ts`

- [ ] Write a failing test for exported `configureRenderer(renderer)` that expects `SRGBColorSpace`, `ACESFilmicToneMapping`, enabled shadow map, and `PCFSoftShadowMap`.
- [ ] Run `npm test -- tests/rendererConfig.test.ts`; expect failure because the helper does not exist.
- [ ] Export and call `configureRenderer`, setting `outputColorSpace = THREE.SRGBColorSpace`, `toneMapping = THREE.ACESFilmicToneMapping`, `toneMappingExposure = 0.9`, `shadowMap.enabled = true`, and `shadowMap.type = THREE.PCFSoftShadowMap`.
- [ ] Re-run the focused test; expect pass, then commit with `git commit -m "feat: configure filmic renderer"`.

### Task 4: Re-light the laboratory and chase scenes

**Files:**

- Modify: `src/scenes/lab.ts`
- Modify: `src/scenes/chase.ts`

- [ ] Enable cast/receive shadows only for people, chaser, desks, and chairs.
- [ ] Set lab lighting to cool hemisphere `0.45`, ambient `0.18`, and two white/cyan points at intensity `18`.
- [ ] Set chase lighting to ambient `0.12`, blue hemisphere `0.25`, two red points at intensity `8`, plus a camera-attached spotlight with intensity `5`, distance `8`, and angle `0.42`.
- [ ] Retain the chaser texture maps and keep its badge emissive intensity at or below `0.35`.
- [ ] Run `npm run build`; expect exit code 0, then commit with `git commit -m "feat: light scenes for realistic horror"`.

### Task 5: Full verification

**Files:**

- Verify: `tests/`, `public/assets/models/ATTRIBUTION.md`

- [ ] Run `npm test`; expect all tests to pass.
- [ ] Run `npm run build`; expect TypeScript and Vite build success.
- [ ] Run `git diff --check`; expect no output.
