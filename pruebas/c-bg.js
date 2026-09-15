// Fondo del hero: degradé "líquido" (tipo aurora) con la paleta de Canva.
// Corre en WebGL. Si el navegador no puede, queda el degradé CSS de respaldo.
//
// Para ajustar:  SPEED = velocidad del movimiento en reposo
//                SPOT_SIZE = tamaño de la mancha rosa del mouse (más alto = más chica)
//                SPOT_PUSH = cuánto aparta la mancha a los colores de alrededor

(() => {
  const SPEED = 0.048;        // más alto = fluye más rápido
  const SPOT_SIZE = 16.0;    // más alto = mancha más chica
  const SPOT_PUSH = 0.20;    // 0 = no aparta nada
  const PIXEL_SCALE = 0.5;   // resolución interna (0.5 = mitad, sobra para algo tan difuso)

  const hero = document.querySelector('.hero');
  const canvas = document.querySelector('.hero__gl');
  if (!hero || !canvas) return;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return;

  const vert = `
    attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

  const frag = `
    precision highp float;
    uniform vec2 u_res; uniform float u_time; uniform vec2 u_mouse; uniform float u_mstr;

    // ruido simplex 2D (Ian McEwan / Ashima Arts, MIT)
    vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
    vec2 mod289(vec2 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
    vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i = floor(v + dot(v, C.yy)); vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0); m = m*m; m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    void main(){
      float aspect = u_res.x / u_res.y;
      vec2 uv = gl_FragCoord.xy / u_res;          // 0..1, y hacia arriba
      vec2 p = vec2(uv.x * aspect, uv.y);
      float t = u_time;

      // mancha del mouse: se mece sola y, cerca de ella, el líquido se aparta
      vec2 m = vec2(u_mouse.x * aspect, u_mouse.y);
      m += 0.045 * vec2(snoise(vec2(t * 2.2, 1.7)), snoise(vec2(-1.3, t * 2.6)));
      vec2 dm = p - m;
      p += dm * exp(-dot(dm, dm) * ${(SPOT_SIZE * 0.45).toFixed(1)}) * ${SPOT_PUSH.toFixed(2)} * u_mstr;

      // deformación líquida: dos capas de ruido que se arrastran una a la otra
      float n1 = snoise(p * 0.85 + vec2(t * 0.9, -t * 0.6));
      float n2 = snoise(p * 1.3 - vec2(t * 0.7, t * 0.5) + n1 * 0.5);
      vec2 q = p + 0.24 * vec2(n1, n2);

      // paleta Canva
      vec3 pink   = vec3(0.80, 0.42, 0.62);
      vec3 lime   = vec3(0.62, 0.72, 0.18);
      vec3 olive  = vec3(0.10, 0.15, 0.07);
      vec3 fucsia = vec3(0.55, 0.20, 0.45);
      vec3 mauve  = vec3(0.16, 0.09, 0.15);

      // composición como en Canva: malva a la izquierda → oliva a la derecha
      vec3 col = mix(mauve, olive, smoothstep(0.30, 1.05, q.x / aspect));

      // rosa arriba a la izquierda
      vec2 dp = (q - vec2(0.12 * aspect, 0.85)) * vec2(1.0, 1.3);
      col = mix(col, pink, clamp(exp(-dot(dp, dp) * 3.2), 0.0, 1.0) * 0.7);

      // banda lima al centro-izquierda, ondulando
      float bx = (q.x - (0.42 * aspect + 0.10 * n2)) * 3.0;
      float lm = exp(-bx * bx) * smoothstep(-0.25, 0.55, q.y + 0.25 * n1);
      col = mix(col, lime, lm * 0.55);

      // fucsia abajo a la izquierda
      vec2 df = (q - vec2(0.28 * aspect, -0.02)) * vec2(1.1, 1.7);
      col = mix(col, fucsia, clamp(exp(-dot(df, df) * 2.8), 0.0, 1.0) * 0.85);

      // la mancha rosa en sí, con los bordes deformados por el mismo líquido
      vec2 ds = q - m;
      float sp = exp(-dot(ds, ds) * ${SPOT_SIZE.toFixed(1)});
      vec3 rosado = vec3(0.90, 0.45, 0.70);
      col = mix(col, rosado, sp * 0.92 * u_mstr);

      gl_FragColor = vec4(col, 1.0);
    }`;

  const compile = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  };
  const vs = compile(gl.VERTEX_SHADER, vert), fs = compile(gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return;
  const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aLoc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(aLoc); gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, 'u_res'), uTime = gl.getUniformLocation(prog, 'u_time');
  const uMouse = gl.getUniformLocation(prog, 'u_mouse'), uMstr = gl.getUniformLocation(prog, 'u_mstr');

  hero.classList.add('has-gl');

  // tamaño
  const resize = () => {
    const w = Math.max(1, Math.round(hero.clientWidth * PIXEL_SCALE));
    const h = Math.max(1, Math.round(hero.clientHeight * PIXEL_SCALE));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  };
  resize(); window.addEventListener('resize', resize);

  // mouse (solo puntero fino; en celu no hay)
  let mx = 0.42, my = 0.5, tx = mx, ty = my, mstr = 0, tstr = 0;
  if (matchMedia('(pointer: fine)').matches) {
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width; ty = 1 - (e.clientY - r.top) / r.height; tstr = 1;
    });
    hero.addEventListener('pointerleave', () => { tstr = 0; });
  }

  // loop, solo mientras el hero está a la vista y la pestaña activa
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let visible = true, raf = null, start = performance.now();
  const frame = (now) => {
    raf = null;
    if (!visible || document.hidden) return;
    mx += (tx - mx) * 0.12; my += (ty - my) * 0.12; mstr += (tstr - mstr) * 0.05; // sigue con peso, como líquido
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, reduced ? 0 : (now - start) / 1000 * SPEED);
    gl.uniform2f(uMouse, mx, my); gl.uniform1f(uMstr, mstr);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduced || mstr > 0.001 || tstr > 0) raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  new IntersectionObserver((en) => { visible = en[0].isIntersecting; kick(); }).observe(hero);
  document.addEventListener('visibilitychange', kick);
  hero.addEventListener('pointermove', kick);
  kick();
})();
