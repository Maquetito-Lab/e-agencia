// Fondo de la opción E (v2): el degradé "líquido" de C con la paleta de "colores marca.jpeg"
// (rojo, rosa pálido, oliva, lima), compuesto como el degradé de referencia y en movimiento constante.
// Corre en WebGL. Si el navegador no puede, queda el degradé CSS de respaldo.
//
// Para ajustar:  SPEED = velocidad del movimiento en reposo
//                SPOT_SIZE = tamaño de la mancha del mouse (más alto = más chica)
//                SPOT_PUSH = cuánto aparta la mancha a los colores de alrededor
//                Los colores están en "paleta de marca", más abajo (0..1 = 0..255).

(() => {
  const SPEED = 0.11;         // más alto = fluye más rápido (la v2 pide movimiento constante)
  const SPOT_SIZE = 16.0;    // más alto = mancha más chica
  const SPOT_PUSH = 0.20;    // 0 = no aparta nada
  const PIXEL_SCALE = 0.5;   // resolución interna (0.5 = mitad, sobra para algo tan difuso)

  // paletas (0..1 = 0..255). Las manchas conservan su lugar; cambia solo el color de cada una.
  // "marca": el degradé de referencia, vivo. "crema": cremas y rosados, minimal. "rojo": base crema con manchas rojas y coral (sin lima ni oliva).
  // Se elige con <body data-bg="crema">; sin el atributo queda "marca".
  const PALETAS = {
    marca: `
      vec3 rosaCl = vec3(0.930, 0.790, 0.800);   // rosa pálido #E8BFC5 aclarado
      vec3 claro  = vec3(0.965, 0.935, 0.925);   // casi blanco
      vec3 rosa   = vec3(0.910, 0.620, 0.660);   // rosa
      vec3 lima   = vec3(0.760, 0.905, 0.000);   // lima #C1E700
      vec3 rojo   = vec3(0.880, 0.040, 0.070);   // rojo #E00A12
      vec3 oliva  = vec3(0.353, 0.357, 0.184);   // oliva #5A5B2F
      vec3 vino   = vec3(0.600, 0.000, 0.110);   // rojo oscuro, esquina inferior derecha
      float wRosa = 0.8, wLima = 0.9, wRojo = 0.9, wOliva = 0.6, wVino = 0.6, wClaro = 0.75; // fuerza de cada mancha`,
    crema: `
      vec3 rosaCl = vec3(0.953, 0.867, 0.855);   // rosa empolvado #F3DDDA
      vec3 claro  = vec3(0.984, 0.957, 0.933);   // crema casi blanco #FBF4EE
      vec3 rosa   = vec3(0.922, 0.765, 0.780);   // rosa #EBC3C7 (donde iba el rosa)
      vec3 lima   = vec3(0.961, 0.890, 0.812);   // durazno claro #F5E3CF (donde iba la lima)
      vec3 rojo   = vec3(0.902, 0.686, 0.710);   // rosa viejo #E6AFB5 (donde iba el rojo)
      vec3 oliva  = vec3(0.894, 0.827, 0.769);   // beige tostado #E4D3C4 (donde iba el oliva)
      vec3 vino   = vec3(0.875, 0.639, 0.675);   // rosa profundo #DFA3AC (donde iba el vino)
      float wRosa = 0.8, wLima = 0.9, wRojo = 0.9, wOliva = 0.6, wVino = 0.6, wClaro = 0.75;`,
    rojo: `
      vec3 rosaCl = vec3(0.965, 0.914, 0.890);   // crema rosado #F6E9E3 (base)
      vec3 claro  = vec3(0.984, 0.957, 0.933);   // crema casi blanco #FBF4EE
      vec3 rosa   = vec3(0.950, 0.720, 0.690);   // rosa cálido #F2B8B0
      vec3 lima   = vec3(0.910, 0.310, 0.240);   // rojo coral #E84F3D (donde iba la lima)
      vec3 rojo   = vec3(0.890, 0.024, 0.075);   // rojo del logo #E30613
      vec3 oliva  = vec3(0.720, 0.050, 0.120);   // rojo profundo #B80D1E (donde iba el oliva)
      vec3 vino   = vec3(0.540, 0.040, 0.110);   // vino #8A0A1C
      float wRosa = 0.55, wLima = 0.6, wRojo = 0.7, wOliva = 0.35, wVino = 0.4, wClaro = 0.9; // más suaves: que se vea el crema`,
  };
  const PAL = PALETAS[document.body.dataset.bg] || PALETAS.marca;

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
      vec2 q = p + 0.30 * vec2(n1, n2);

      // paleta de "colores marca.jpeg": rojo, rosa pálido, oliva y lima, compuestos como el degradé de referencia
      // (rosa arriba a la izquierda, lima a la izquierda, rojo a la derecha, oliva abajo a la izquierda, claro abajo al centro)
      ${PAL}

      // base: rosa pálido a la izquierda → claro a la derecha
      vec3 col = mix(rosaCl, claro, smoothstep(0.20, 1.10, q.x / aspect));

      // rosa arriba a la izquierda
      vec2 dp = (q - vec2(0.10 * aspect, 0.90)) * vec2(1.0, 1.3);
      col = mix(col, rosa, clamp(exp(-dot(dp, dp) * 3.0), 0.0, 1.0) * wRosa);

      // lima a la izquierda, ondulando
      vec2 dl = (q - vec2(0.22 * aspect + 0.08 * n2, 0.55 + 0.1 * n1)) * vec2(1.3, 1.1);
      col = mix(col, lima, clamp(exp(-dot(dl, dl) * 3.2), 0.0, 1.0) * wLima);

      // rojo a la derecha, grande
      vec2 dr = (q - vec2(0.78 * aspect + 0.06 * n1, 0.55 + 0.1 * n2)) * vec2(0.9, 1.0);
      col = mix(col, rojo, clamp(exp(-dot(dr, dr) * 2.2), 0.0, 1.0) * wRojo);

      // oliva abajo a la izquierda (a media fuerza, para que el texto oscuro siga leyéndose)
      vec2 dq = (q - vec2(0.05 * aspect, -0.05)) * vec2(1.2, 1.6);
      col = mix(col, oliva, clamp(exp(-dot(dq, dq) * 2.6), 0.0, 1.0) * wOliva);

      // vino abajo a la derecha
      vec2 dv = (q - vec2(1.0 * aspect, -0.05)) * vec2(1.2, 1.6);
      col = mix(col, vino, clamp(exp(-dot(dv, dv) * 2.6), 0.0, 1.0) * wVino);

      // claro abajo al centro
      vec2 dc = (q - vec2(0.55 * aspect, 0.0)) * vec2(1.6, 2.2);
      col = mix(col, claro, clamp(exp(-dot(dc, dc) * 3.0), 0.0, 1.0) * wClaro);

      // la mancha del mouse: rosa, con los bordes deformados por el mismo líquido
      vec2 ds = q - m;
      float sp = exp(-dot(ds, ds) * ${SPOT_SIZE.toFixed(1)});
      col = mix(col, rosa, sp * 0.8 * u_mstr);

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
    window.addEventListener('pointermove', (e) => { // en window: el contenido tapa al hero y si no, no llegan los eventos
      const r = hero.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width; ty = 1 - (e.clientY - r.top) / r.height; tstr = 1;
    });
    document.addEventListener('pointerleave', () => { tstr = 0; });
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
  window.addEventListener('pointermove', kick, { passive: true });
  kick();
})();
