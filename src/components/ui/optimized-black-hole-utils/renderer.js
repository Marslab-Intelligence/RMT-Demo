// Minimal, dependency-free WebGL renderer for the animated black-hole background.
// Single fullscreen fragment shader: procedural starfield warped by a lensing
// function, a rotating accretion disk with turbulence + doppler shading, a
// photon-ring glow, and a solid event-horizon core.
//
// Renderer setup is fully defensive: any failure (no WebGL, shader compile
// error on a particular GPU/driver, context loss, ...) falls back to a plain
// static background instead of throwing, so a broken shader can never crash
// the page that hosts it.

const VERTEX_SRC = `
precision highp float;
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SRC = `
precision highp float;
uniform vec2 uResolution;
uniform float uTime;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
  float r = length(uv);

  // Gravitational lensing: warp coordinates inward near the core so the
  // starfield and disk both appear to bend around the black hole.
  float lens = 0.16 / (r * r + 0.025);
  vec2 warped = uv * (1.0 + lens * 0.06);
  float rw = length(warped);
  float angw = atan(warped.y, warped.x);

  vec3 col = vec3(0.0);

  // Procedural starfield, sampled through the lensed coordinates.
  vec2 starUv = warped * 3.0;
  float star = pow(noise(starUv * 42.0), 42.0) * 2.2;
  float twinkle = 0.6 + 0.4 * sin(uTime * 3.0 + hash(floor(starUv * 42.0)) * 20.0);
  col += vec3(star * twinkle);

  // Accretion disk: a turbulent, rotating ring with doppler-shifted color.
  float diskR = 0.55;
  float diskWidth = 0.30;
  float diskMask = 1.0 - smoothstep(0.0, diskWidth, abs(rw - diskR));
  float swirl = angw * 3.0 - uTime * 1.15 + rw * 8.0;
  float turbulence = noise(vec2(swirl * 1.5, rw * 10.0 - uTime * 0.5));
  float diskBrightness = diskMask * (0.55 + 0.45 * turbulence);
  float doppler = 0.5 + 0.5 * sin(angw + uTime * 1.1);
  vec3 diskColor = mix(vec3(1.0, 0.32, 0.05), vec3(1.0, 0.85, 0.55), doppler);
  col += diskColor * diskBrightness * 1.5;

  // Photon ring glow, just outside the event horizon.
  float horizon = 0.22;
  float ringOuter = 1.0 - smoothstep(horizon - 0.01, horizon + 0.05, rw);
  float ringInner = smoothstep(horizon - 0.06, horizon - 0.03, rw);
  float ringGlow = ringOuter * ringInner;
  col += vec3(1.0, 0.8, 0.6) * ringGlow * 1.6;

  // Solid event-horizon core.
  float core = 1.0 - smoothstep(horizon - 0.02, horizon, rw);
  col *= (1.0 - core);

  // Soft vignette toward the frame edges.
  col *= 1.0 - smoothstep(0.2, 1.5, r);

  gl_FragColor = vec4(col, 1.0);
}
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('createShader returned null (context unavailable or lost)');
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || '(no compiler log available)';
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

function createProgram(gl) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || '(no linker log available)';
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${info}`);
  }
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  return program;
}

function noop() {}

/** Fallback handle used whenever WebGL setup fails for any reason. */
function fallbackHandle() {
  return {
    ok: false,
    ready: Promise.resolve(),
    dispose: noop,
  };
}

export function createRenderer({ canvas }) {
  let gl;
  try {
    gl = canvas.getContext('webgl', { antialias: true, alpha: false })
      || canvas.getContext('experimental-webgl', { antialias: true, alpha: false });
  } catch (err) {
    gl = null;
  }

  if (!gl) {
    console.warn('[optimized-black-hole] WebGL is not available in this browser, using CSS fallback.');
    return fallbackHandle();
  }

  if (gl.isContextLost && gl.isContextLost()) {
    console.warn('[optimized-black-hole] WebGL context is lost (GPU process disabled/crashed?), using CSS fallback.');
    return fallbackHandle();
  }

  let program;
  let buffer;
  try {
    program = createProgram(gl);
    buffer = gl.createBuffer();
    const quad = new Float32Array([-1, -1, 3, -1, -1, 3]);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
  } catch (err) {
    // Shader compile/link failed on this GPU/driver — fail quietly rather
    // than crashing the page that hosts this background.
    console.warn('[optimized-black-hole] WebGL setup failed, using CSS fallback:', err);
    return fallbackHandle();
  }

  let disposed = false;
  let rafId = null;
  let resizeObserver = null;

  const aPosition = gl.getAttribLocation(program, 'aPosition');
  const uResolution = gl.getUniformLocation(program, 'uResolution');
  const uTime = gl.getUniformLocation(program, 'uTime');

  const maxDpr = 1.75; // cap device pixel ratio for performance ("optimized")

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  resize();
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
  } else {
    window.addEventListener('resize', resize);
  }

  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  const start = performance.now();

  function frame(now) {
    if (disposed) return;
    try {
      const t = (now - start) / 1000;
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } catch (err) {
      console.warn('[optimized-black-hole] Render frame failed, stopping animation:', err);
      disposed = true;
      return;
    }
    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);

  return {
    ok: true,
    ready: Promise.resolve(),
    dispose() {
      disposed = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener('resize', resize);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    },
  };
}
