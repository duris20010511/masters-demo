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
  // 폴백: 비네트+그레인+단순 글리치. 본 구현은 Codex 작업 #1 결과로 교체.
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uVignette, uGrain, uGlitch, uRgbShift;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float d = distance(vUv, vec2(0.5));
      c *= 1.0 - uVignette * smoothstep(0.3, 0.8, d);
      c += (hash(vUv * (uTime + 1.0)) - 0.5) * uGrain;
      c = mix(c, vec3(hash(vUv + uTime)), uGlitch * 0.5);
      gl_FragColor = vec4(c, 1.0);
    }
  `,
}
