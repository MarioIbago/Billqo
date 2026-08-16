import { useEffect, useRef } from 'react';
import './Ferrofluid.css';

export interface FerrofluidProps {
  className?: string;
  dpr?: number;
  paused?: boolean;
  colors?: string[];
  speed?: number;
  scale?: number;
  turbulence?: number;
  fluidity?: number;
  rimWidth?: number;
  sharpness?: number;
  shimmer?: number;
  glow?: number;
  flowDirection?: 'up' | 'down' | 'left' | 'right';
  opacity?: number;
  mouseInteraction?: boolean;
  mouseStrength?: number;
  mouseRadius?: number;
  mouseDampening?: number;
  mixBlendMode?: React.CSSProperties['mixBlendMode'];
}

type RGB = [number, number, number];

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;
varying vec2 v_uv;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform vec2 u_flow;
uniform float u_time;
uniform float u_scale;
uniform float u_turbulence;
uniform float u_fluidity;
uniform float u_rim;
uniform float u_sharpness;
uniform float u_shimmer;
uniform float u_glow;
uniform float u_opacity;
uniform float u_mouseStrength;
uniform float u_mouseRadius;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform vec3 u_colorC;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.52;
  mat2 rot = mat2(0.82, -0.57, 0.57, 0.82);
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise2(p);
    p = rot * p * 2.02 + 11.7;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec2 resolution = max(u_resolution, vec2(1.0));
  vec2 uv = v_uv;
  vec2 p = (uv - 0.5) * vec2(resolution.x / resolution.y, 1.0);
  p *= max(u_scale, 0.2) * 2.25;

  vec2 mouseUv = u_mouse / resolution;
  vec2 mouseP = (mouseUv - 0.5) * vec2(resolution.x / resolution.y, 1.0);
  mouseP *= max(u_scale, 0.2) * 2.25;
  float mouseDistance = length(p - mouseP);
  float mouseFalloff = exp(-mouseDistance * mouseDistance / max(u_mouseRadius * u_mouseRadius, 0.002));

  float t = u_time;
  vec2 flow = u_flow * t * 0.24;
  vec2 warp = vec2(
    fbm(p * 0.82 + flow + vec2(0.0, t * 0.05)),
    fbm(p * 0.82 - flow + vec2(7.1, -t * 0.04))
  ) - 0.5;
  warp *= (0.85 + u_turbulence * 0.9);
  warp += normalize(p - mouseP + vec2(0.0001)) * mouseFalloff * u_mouseStrength * 0.22;

  float fieldA = fbm(p + warp * (1.15 + u_fluidity * 2.0) + flow);
  float fieldB = fbm(p * 1.18 - warp * (0.82 + u_fluidity) - flow * 0.78 + 19.3);
  float liquid = mix(fieldA, 1.0 - fieldB, 0.46);
  liquid += sin((p.x + p.y) * 3.1 + t * 0.55) * 0.018 * u_shimmer;

  float threshold = 0.5;
  float distanceToEdge = abs(liquid - threshold);
  float rim = 1.0 - smoothstep(u_rim, u_rim + 0.055, distanceToEdge);
  rim = pow(clamp(rim, 0.0, 1.0), max(u_sharpness, 0.4));

  float body = smoothstep(0.42, 0.60, liquid) * 0.18;
  float mouseLight = mouseFalloff * 0.16;
  float light = clamp(rim * u_glow + body + mouseLight, 0.0, 1.35);

  float palette = clamp(liquid * 1.25 - 0.1, 0.0, 1.0);
  vec3 color = palette < 0.5
    ? mix(u_colorA, u_colorB, palette * 2.0)
    : mix(u_colorB, u_colorC, (palette - 0.5) * 2.0);

  float alpha = clamp((rim * 0.88 + body * 0.48 + mouseLight) * u_opacity, 0.0, 0.94);
  gl_FragColor = vec4(color * light, alpha);
}
`;

function hexToRgb(value: string): RGB {
  const normalized = value.replace('#', '').trim();
  const hex = normalized.length === 3
    ? normalized.split('').map((character) => character + character).join('')
    : normalized.padEnd(6, '0').slice(0, 6);
  const number = Number.parseInt(hex, 16);
  if (!Number.isFinite(number)) return [1, 1, 1];
  return [
    ((number >> 16) & 255) / 255,
    ((number >> 8) & 255) / 255,
    (number & 255) / 255,
  ];
}

function flowVector(direction: FerrofluidProps['flowDirection']): [number, number] {
  if (direction === 'up') return [0, 1];
  if (direction === 'left') return [-1, 0];
  if (direction === 'right') return [1, 0];
  return [0, -1];
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('[billqo:ferrofluid] shader unavailable');
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export default function Ferrofluid({
  className = '',
  dpr,
  paused = false,
  colors = ['#f8fafc', '#a1a1aa', '#52525b'],
  speed = 0.22,
  scale = 1.35,
  turbulence = 0.78,
  fluidity = 0.18,
  rimWidth = 0.07,
  sharpness = 1.75,
  shimmer = 0.72,
  glow = 1.15,
  flowDirection = 'down',
  opacity = 0.72,
  mouseInteraction = true,
  mouseStrength = 0.9,
  mouseRadius = 0.42,
  mouseDampening = 0.16,
  mixBlendMode = 'screen',
}: FerrofluidProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const colorKey = colors.join('|');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    container.replaceChildren(canvas);

    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    if (!gl) {
      canvas.remove();
      return;
    }

    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertex || !fragment) {
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
      canvas.remove();
      return;
    }

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const uniforms = {
      resolution: uniform('u_resolution'),
      mouse: uniform('u_mouse'),
      flow: uniform('u_flow'),
      time: uniform('u_time'),
      scale: uniform('u_scale'),
      turbulence: uniform('u_turbulence'),
      fluidity: uniform('u_fluidity'),
      rim: uniform('u_rim'),
      sharpness: uniform('u_sharpness'),
      shimmer: uniform('u_shimmer'),
      glow: uniform('u_glow'),
      opacity: uniform('u_opacity'),
      mouseStrength: uniform('u_mouseStrength'),
      mouseRadius: uniform('u_mouseRadius'),
      colorA: uniform('u_colorA'),
      colorB: uniform('u_colorB'),
      colorC: uniform('u_colorC'),
    };

    const parsedColors = colorKey.split('|').filter(Boolean).map(hexToRgb);
    const a = parsedColors[0] ?? [1, 1, 1];
    const b = parsedColors[1] ?? a;
    const c = parsedColors[2] ?? b;
    const flow = flowVector(flowDirection);
    gl.uniform2f(uniforms.flow, flow[0], flow[1]);
    gl.uniform1f(uniforms.scale, scale);
    gl.uniform1f(uniforms.turbulence, turbulence);
    gl.uniform1f(uniforms.fluidity, fluidity);
    gl.uniform1f(uniforms.rim, Math.max(0.015, rimWidth));
    gl.uniform1f(uniforms.sharpness, sharpness);
    gl.uniform1f(uniforms.shimmer, shimmer);
    gl.uniform1f(uniforms.glow, glow);
    gl.uniform1f(uniforms.opacity, opacity);
    gl.uniform1f(uniforms.mouseStrength, mouseInteraction ? mouseStrength : 0);
    gl.uniform1f(uniforms.mouseRadius, Math.max(0.04, mouseRadius));
    gl.uniform3fv(uniforms.colorA, a);
    gl.uniform3fv(uniforms.colorB, b);
    gl.uniform3fv(uniforms.colorC, c);

    const targetMouse = { x: -10_000, y: -10_000 };
    const currentMouse = { x: -10_000, y: -10_000 };
    let cssWidth = 1;
    let cssHeight = 1;
    let raf = 0;
    let last = performance.now();
    let elapsed = 0;
    let pageVisible = !document.hidden;
    const reduceMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    const pixelRatio = Math.min(1.5, Math.max(0.75, dpr ?? window.devicePixelRatio ?? 1));

    const resize = () => {
      const rect = container.getBoundingClientRect();
      cssWidth = Math.max(1, rect.width);
      cssHeight = Math.max(1, rect.height);
      const width = Math.max(1, Math.round(cssWidth * pixelRatio));
      const height = Math.max(1, Math.round(cssHeight * pixelRatio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;
        gl.viewport(0, 0, width, height);
      }
      gl.uniform2f(uniforms.resolution, width, height);
    };

    const pointerMove = (event: PointerEvent) => {
      if (!mouseInteraction) return;
      const rect = container.getBoundingClientRect();
      targetMouse.x = (event.clientX - rect.left) * pixelRatio;
      targetMouse.y = (rect.height - (event.clientY - rect.top)) * pixelRatio;
    };

    const visibilityChange = () => {
      pageVisible = !document.hidden;
      last = performance.now();
    };

    const render = (now: number) => {
      const delta = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (pageVisible && !paused && !reduceMotion) elapsed += delta * speed;

      const damp = mouseDampening <= 0 ? 1 : 1 - Math.exp(-delta / Math.max(mouseDampening, 0.001));
      currentMouse.x += (targetMouse.x - currentMouse.x) * damp;
      currentMouse.y += (targetMouse.y - currentMouse.y) * damp;

      gl.uniform2f(uniforms.mouse, currentMouse.x, currentMouse.y);
      gl.uniform1f(uniforms.time, elapsed);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (!reduceMotion) raf = requestAnimationFrame(render);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    window.addEventListener('pointermove', pointerMove, { passive: true });
    document.addEventListener('visibilitychange', visibilityChange);
    render(performance.now());

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('pointermove', pointerMove);
      document.removeEventListener('visibilitychange', visibilityChange);
      if (buffer) gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    };
  }, [
    colorKey,
    dpr,
    flowDirection,
    fluidity,
    glow,
    mouseDampening,
    mouseInteraction,
    mouseRadius,
    mouseStrength,
    opacity,
    paused,
    rimWidth,
    scale,
    sharpness,
    shimmer,
    speed,
    turbulence,
  ]);

  return (
    <div
      ref={containerRef}
      className={`ferrofluid-container ${className}`.trim()}
      style={{ mixBlendMode }}
      aria-hidden="true"
    />
  );
}
