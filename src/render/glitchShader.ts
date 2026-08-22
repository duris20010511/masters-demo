// uniform 계약 고정 — 이름/타입 변경 금지 (docs/codex-tasks/01-glitch-shader.md)
export const GLITCH_SHADER = {
  uniforms: {
    tDiffuse: { value: null as unknown },
    uTime: { value: 0 },
    uVignette: { value: 0.25 },
    uGrain: { value: 0.08 },
    uGlitch: { value: 0.0 },
    uRgbShift: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uVignette, uGrain, uGlitch, uRgbShift;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      float frame = floor(uTime * 12.0);
      float tear = 0.0;

      for (int i = 0; i < 6; i++) {
        float index = float(i);
        float blockHeight = mix(0.007, 0.055, hash(vec2(frame + index, 3.1)));
        float blockStart = hash(vec2(frame * 0.37, index + 11.7)) * (1.0 - blockHeight);
        float inBlock = step(blockStart, uv.y) * step(uv.y, blockStart + blockHeight);
        float blockActive = step(1.0 - uGlitch, hash(vec2(frame, index + 29.4)));
        float direction = hash(vec2(frame + index, 47.2)) * 2.0 - 1.0;
        tear += inBlock * blockActive * direction * (0.006 + uGlitch * 0.07);
      }

      uv.x = clamp(uv.x + tear, 0.0, 1.0);
      float rgbOffset = uRgbShift * 0.02;
      vec3 c = vec3(
        texture2D(tDiffuse, clamp(uv + vec2(rgbOffset, 0.0), 0.0, 1.0)).r,
        texture2D(tDiffuse, uv).g,
        texture2D(tDiffuse, clamp(uv - vec2(rgbOffset, 0.0), 0.0, 1.0)).b
      );

      for (int i = 0; i < 4; i++) {
        float index = float(i);
        float blockActive = step(1.0 - uGlitch * 0.6, hash(vec2(frame * 0.71, index + 63.8)));
        vec2 origin = vec2(
          hash(vec2(frame + index, 71.2)),
          hash(vec2(frame * 1.31, index + 83.6))
        );
        vec2 size = vec2(
          mix(0.04, 0.28, hash(vec2(frame, index + 97.4))),
          mix(0.01, 0.12, hash(vec2(frame, index + 109.1)))
        );
        vec2 inside = step(origin, uv) * step(uv, origin + size);
        float rectangle = inside.x * inside.y * blockActive;
        vec3 noiseColor = vec3(
          hash(vec2(frame + index, 127.3)),
          hash(vec2(frame + index, 139.7)),
          hash(vec2(frame + index, 151.9))
        );
        c = mix(c, noiseColor, rectangle * (0.25 + uGlitch * 0.55));
      }

      float tracking = step(0.7, uGlitch) * step(0.72, hash(vec2(frame, 193.6)));
      vec3 trackingNoise = vec3(0.55 + 0.45 * hash(uv * 480.0 + frame));
      c = mix(c, trackingNoise, tracking * (0.3 + (uGlitch - 0.7) * 2.333));

      float d = distance(vUv, vec2(0.5));
      c *= 1.0 - uVignette * smoothstep(0.3, 0.8, d);
      c += (hash(uv * 800.0 + frame) - 0.5) * uGrain;
      gl_FragColor = vec4(c, 1.0);
    }
  `,
}
