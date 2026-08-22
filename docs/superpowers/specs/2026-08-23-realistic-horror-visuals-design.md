# Realistic Horror Visuals Design

## Goal

Replace the toy-like character presentation with a grounded, low-light horror presentation: PBR character surfaces, constrained practical lighting, and a partially concealed chaser.

## Reference target

The supplied references use realistic human proportions and textured surfaces rather than cartoon geometry. Their tension comes from a narrow readable area, dirty red/green practical lights, strong contrast, grain, and motion blur; they do not expose every character detail under uniform room lighting.

## Asset policy

- Add only self-contained `.glb` files with embedded textures under `public/assets/models/`.
- Retain the existing primitives as load-failure fallbacks.
- Record source URL, creator, and license in `public/assets/models/ATTRIBUTION.md` for any CC-BY asset.
- Require a maximum 100k triangles for an animated chaser and 75k triangles per background human. Larger assets must be reduced offline before inclusion.
- Do not use assets that require a login, a paid license, or attribution terms that cannot be met in the repository.

## Selected source asset

Use the self-contained `human.glb` from `kunalkushwaha/vsim`. It is a 36,972-triangle MakeHuman/MPFB 2 adult with embedded skin texture and `idle`, `run`, `walk`, and `wave` clips. Its bundled credits document the MakeHuman output and its skin/clothing assets as CC0.

## Chaser

Use one humanoid horror model with PBR material maps. Its full body is never brightly lit: a dark non-metallic material retains the source normal/roughness maps, while a subtle red emissive accent appears only on the badge. Walk/run locomotion continues to use available clips; a model without clips receives root motion and a restrained procedural torso sway rather than an unanimated static pose.

## Laboratory people

Use realistic adult-proportion human GLBs at desk-adjacent positions. They are background silhouettes, so idle animation is optional. Preserve base-color, normal, and roughness maps instead of replacing each mesh with a solid tint; a cold rim light and slow head turn make them legible without presenting them like collectibles.

## Rendering and lighting

- Configure Three.js for sRGB output and ACES filmic tone mapping.
- Enable a capped PCF soft shadow map; only the chaser, people, desks, and key room props cast or receive shadows.
- Replace uniform ambient-heavy lighting with dim cool fill plus limited practical fixtures. The lab keeps clinical white/cyan light; the chase corridor uses two weak red emergency fixtures and a narrow player-facing fill.
- Keep the existing glitch/grain pass. Increase vignette and grain only during chase proximity; do not add a new rendering dependency.

## Acceptance criteria

1. The project still builds and all tests pass.
2. Missing model files still show a readable primitive fallback.
3. The chaser is identifiable as a textured humanoid at close range but remains silhouette-first at corridor distance.
4. Lab characters retain their source textures and are visibly separated from the room through light/shadow, not flat tint.
5. Every shipped third-party model has a compatible license and recorded attribution where required.
