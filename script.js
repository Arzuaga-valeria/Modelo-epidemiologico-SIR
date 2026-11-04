/* ============================================================
   SIMULADOR SIR — script.js  (Rediseño Médico Universitario)
   Autores: Valeria Cespedes Arzuaga · David Andrés Silva Sánchez
            · Jaime Andres Castro Vergara
   Curso:   Ecuaciones Diferenciales - Grupo 5
   Docente: Camilo Esteban Soto Saray
   ─────────────────────────────────────────────────────────────
   Contenido:
     1. Parámetros y estado global
     2. Solver Runge-Kutta 4 para el sistema SIR
     3. Gráfica con Chart.js (tema claro médico)
     4. Simulación de agentes / partículas
     5. Actualización de indicadores R₀ y KPIs
     6. Eventos de sliders
     7. Reinicio
     8. Arranque (DOMContentLoaded)
============================================================ */

'use strict';

/* ══════════════════════════════════════════════
   1. PARÁMETROS GLOBALES
══════════════════════════════════════════════ */

/**
 * Parámetros actuales del modelo SIR.
 * Se actualizan al mover cualquier slider.
 */
const PARAMS = {
  beta:  0.035,   // β: tasa de contagio (contactos efectivos/día)
  gamma: 0.25,   // γ: tasa de recuperación (fracción/día)
  N:     100,    // Población total (constante)
  I0:    1,
  alpha: 0.00,  // α: tasa de reinfección (0 = modelo SIR)
  _:     0,  // Infectados iniciales
};

const T_MAX = 60;   // Días de simulación
const DT    = 0.1;  // Paso de integración (días)

/* ══════════════════════════════════════════════
   2. SOLVER RUNGE-KUTTA 4
══════════════════════════════════════════════ */

/**
 * Derivadas del sistema SIR:
 *   dS/dt = -β·S·I/N
 *   dI/dt =  β·S·I/N - γ·I
 *   dR/dt =  γ·I
 */
function sirDerivatives(S, I, R, beta, gamma, N) {
  const newInfections = beta * S * I;
  return {
    dS: -newInfections + PARAMS.alpha * R,
    dI:  newInfections - gamma * I,
    dR:  gamma * I - PARAMS.alpha * R,
  };
}

/**
 * Un paso Runge-Kutta 4.
 * Combina cuatro estimaciones de pendiente para mayor precisión.
 */
function rk4Step(S, I, R, dt, beta, gamma, N) {
  const k1 = sirDerivatives(S, I, R, beta, gamma, N);
  const k2 = sirDerivatives(S + k1.dS*dt/2, I + k1.dI*dt/2, R + k1.dR*dt/2, beta, gamma, N);
  const k3 = sirDerivatives(S + k2.dS*dt/2, I + k2.dI*dt/2, R + k2.dR*dt/2, beta, gamma, N);
  const k4 = sirDerivatives(S + k3.dS*dt,   I + k3.dI*dt,   R + k3.dR*dt,   beta, gamma, N);

  return {
    S: S + dt * (k1.dS + 2*k2.dS + 2*k3.dS + k4.dS) / 6,
    I: I + dt * (k1.dI + 2*k2.dI + 2*k3.dI + k4.dI) / 6,
    R: R + dt * (k1.dR + 2*k2.dR + 2*k3.dR + k4.dR) / 6,
  };
}

/**
 * Resuelve el modelo SIR completo de t=0 a T_MAX.
 * @returns {{ times, S, I, R }}
 */
function solveSIR() {
  const times = [], Sarr = [], Iarr = [], Rarr = [];

  let S = PARAMS.N - PARAMS.I0;
  let I = PARAMS.I0;
  let R = 0;

  for (let t = 0; t <= T_MAX; t += DT) {
    times.push(parseFloat(t.toFixed(2)));
    Sarr.push(S);
    Iarr.push(I);
    Rarr.push(R);

    // Sub-pasos para mantener RK4 estable cuando β·N es grande
    const sub = Math.max(1, Math.ceil(DT * (PARAMS.beta * PARAMS.N + PARAMS.gamma + PARAMS.alpha) / 0.5));
    for (let s = 0; s < sub; s++) {
      const next = rk4Step(S, I, R, DT / sub, PARAMS.beta, PARAMS.gamma, PARAMS.N);
      S = Math.max(0, next.S);
      I = Math.max(0, next.I);
      R = Math.max(0, next.R);
    }
  }

  return { times, S: Sarr, I: Iarr, R: Rarr };
}

/* ══════════════════════════════════════════════
   3. GRÁFICA CHART.JS — TEMA CLARO MÉDICO
══════════════════════════════════════════════ */

let sirChart = null;

/**
 * Opciones comunes de la gráfica para el tema claro médico.
 */
function chartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 350, easing: 'easeInOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#fff',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        titleColor: '#64748b',
        bodyColor: '#0f172a',
        titleFont:  { family: 'DM Mono, monospace', size: 11 },
        bodyFont:   { family: 'DM Mono, monospace', size: 11 },
        padding: 10,
        boxPadding: 4,
        callbacks: {
          label: ctx => `  ${ctx.dataset.label}: ${Math.round(ctx.raw).toLocaleString()}`,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#94a3b8',
          font: { family: 'DM Mono, monospace', size: 10 },
          maxTicksLimit: 12,
        },
        grid: { color: '#f1f5f9' },
        border: { color: '#e2e8f0' },
        title: {
          display: true, text: 'Días (t)',
          color: '#94a3b8', font: { family: 'DM Mono, monospace', size: 11 },
        },
      },
      y: {
        ticks: {
          color: '#94a3b8',
          font: { family: 'DM Mono, monospace', size: 10 },
          callback: v => Math.round(v).toLocaleString(),
        },
        grid: { color: '#f1f5f9' },
        border: { color: '#e2e8f0' },
        title: {
          display: true, text: 'Individuos',
          color: '#94a3b8', font: { family: 'DM Mono, monospace', size: 11 },
        },
        min: 0,
      },
    },
  };
}

/**
 * Inicializa la gráfica SIR con Chart.js.
 */
function initChart(data) {
  const ctx = document.getElementById('sirChart').getContext('2d');

  sirChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.times,
      datasets: [
        {
          label: 'Susceptibles S(t)',
          data: data.S,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37,99,235,0.05)',
          borderWidth: 2.5,
          pointRadius: 0,
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Infectados I(t)',
          data: data.I,
          borderColor: '#dc2626',
          backgroundColor: 'rgba(220,38,38,0.06)',
          borderWidth: 2.5,
          pointRadius: 0,
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Recuperados R(t)',
          data: data.R,
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22,163,74,0.05)',
          borderWidth: 2.5,
          pointRadius: 0,
          fill: true,
          tension: 0.4,
        },
      ],
    },
    options: chartOptions(),
  });
}

/** Actualiza los datos sin recrear el chart. */
function updateChart(data) {
  if (!sirChart) return;
  sirChart.data.labels           = data.times;
  sirChart.data.datasets[0].data = data.S;
  sirChart.data.datasets[1].data = data.I;
  sirChart.data.datasets[2].data = data.R;
  sirChart.update();
}

/* ══════════════════════════════════════════════
   4. SIMULACIÓN DE AGENTES (PARTÍCULAS)
══════════════════════════════════════════════ */

const SIM = {
  canvas: null,
  ctx: null,
  particles: [],
  animId: null,
  data: null,
  step: 0,
  COUNT: 110,        // Número de agentes visuales
  frameSkip: 0,
  FRAMES_PER_STEP: 2,
};

/**
 * Crea los agentes con posiciones y velocidades aleatorias.
 * La proporción inicial S/I se escala de PARAMS.
 */
function createParticles() {
  const c   = SIM.COUNT;
  const nI  = Math.max(1, Math.round(PARAMS.I0 / PARAMS.N * c));
  SIM.particles = Array.from({ length: c }, (_, i) => ({
    x:  Math.random() * SIM.canvas.width,
    y:  Math.random() * SIM.canvas.height,
    vx: (Math.random() - 0.5) * 1.1,
    vy: (Math.random() - 0.5) * 1.1,
    r:  3.5,
    state: i < nI ? 'I' : 'S',
  }));
}

/**
 * Actualiza los estados de las partículas según las proporciones
 * S/I/R calculadas por el solver para el paso de tiempo actual.
 */
function updateParticles() {
  const { data, step, COUNT } = SIM;
  if (!data || step >= data.times.length) return;

  const tR = Math.round(data.R[step] / PARAMS.N * COUNT);
  const tI = Math.round(data.I[step] / PARAMS.N * COUNT);
  SIM.particles.forEach((p, i) => { p.state = i < tR ? 'R' : (i < tR + tI ? 'I' : 'S'); });

  // Mover y rebotar
  const w = SIM.canvas.width, h = SIM.canvas.height;
  for (const p of SIM.particles) {
    p.x += p.vx;  p.y += p.vy;
    if (p.x < p.r || p.x > w - p.r) p.vx *= -1;
    if (p.y < p.r || p.y > h - p.r) p.vy *= -1;
  }

  // Actualizar contadores en el DOM
  document.getElementById('statS').textContent = Math.round(data.S[step]).toLocaleString();
  document.getElementById('statI').textContent = Math.round(data.I[step]).toLocaleString();
  document.getElementById('statR').textContent = Math.round(data.R[step]).toLocaleString();

  // KPIs de la banda superior
  document.getElementById('kpiS').textContent = Math.round(data.S[step]).toLocaleString();
  document.getElementById('kpiI').textContent = Math.round(data.I[step]).toLocaleString();
  document.getElementById('kpiR').textContent = Math.round(data.R[step]).toLocaleString();

  // Barra de progreso
  const pct = step / (data.times.length - 1) * 100;
  document.getElementById('timeBar').style.width   = pct + '%';
  document.getElementById('timeLabel').textContent = `t = ${Math.round(data.times[step])} días`;
}

/**
 * Dibuja las partículas sobre el canvas con colores médicos limpios.
 * Fondo claro, puntos sólidos pequeños con halo suave.
 */
function drawParticles() {
  const { canvas, ctx, particles } = SIM;

  // Efecto de estela muy sutil sobre fondo claro
  ctx.fillStyle = 'rgba(248, 250, 252, 0.4)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const colors = { S: '#2563eb', I: '#dc2626', R: '#16a34a' };
  const glows  = { S: 'rgba(37,99,235,0.18)', I: 'rgba(220,38,38,0.18)', R: 'rgba(22,163,74,0.18)' };

  for (const p of particles) {
    // Halo
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 2.8, 0, Math.PI * 2);
    ctx.fillStyle = glows[p.state];
    ctx.fill();
    // Punto sólido
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = colors[p.state];
    ctx.fill();
  }
}

/** Bucle de animación principal. */
function animLoop() {
  SIM.frameSkip++;
  if (SIM.frameSkip >= SIM.FRAMES_PER_STEP) {
    SIM.frameSkip = 0;
    SIM.step = (SIM.step < SIM.data.times.length - 1) ? SIM.step + 1 : 0;
    updateParticles();
  }
  drawParticles();
  SIM.animId = requestAnimationFrame(animLoop);
}

/** Inicializa el canvas y arranca la simulación. */
function initParticleSim(data) {
  SIM.canvas = document.getElementById('particleCanvas');
  SIM.ctx    = SIM.canvas.getContext('2d');
  SIM.data   = data;
  SIM.step   = 0;
  resizeCanvas();
  createParticles();
  animLoop();
}

/** Reinicia la simulación de agentes con nuevos datos. */
function resetParticleSim(data) {
  if (SIM.animId) { cancelAnimationFrame(SIM.animId); SIM.animId = null; }
  SIM.data  = data;
  SIM.step  = 0;
  resizeCanvas();
  createParticles();
  animLoop();
}

/** Ajusta las dimensiones internas del canvas al tamaño CSS. */
function resizeCanvas() {
  if (!SIM.canvas) return;
  const rect = SIM.canvas.getBoundingClientRect();
  SIM.canvas.width  = rect.width  || 600;
  SIM.canvas.height = rect.height || 200;
}

/* ══════════════════════════════════════════════
   5. INDICADORES R₀ Y KPIs
══════════════════════════════════════════════ */

/**
 * Recalcula R₀ = β/γ y actualiza todos los elementos del DOM
 * relacionados: valor numérico, badge de estado, panel lateral.
 */
function updateR0() {
  const r0 = PARAMS.beta * PARAMS.N / PARAMS.gamma;
  const r0Str = r0.toFixed(2);

  // Panel y KPI superior
  document.getElementById('kpiR0').textContent     = r0Str;
  document.getElementById('r0NumPanel').textContent = r0Str;

  let cls, label;
  if      (r0 < 1)   { cls = 'r0-controlled'; label = 'Controlado'; }
  else if (r0 < 1.5) { cls = 'r0-endemic';    label = 'Persistente';    }
  else               { cls = 'r0-epidemic';    label = 'Brote';   }

  const badgeKPI   = document.getElementById('kpiBadge');
  const badgePanel = document.getElementById('r0BadgePanel');

  [badgeKPI, badgePanel].forEach(el => {
    el.textContent = label;
    el.className   = 'r0-badge ' + cls;
  });
}

/* ══════════════════════════════════════════════
   6. SLIDERS — LECTURA Y EVENTOS
══════════════════════════════════════════════ */

/** Lee los valores actuales de todos los sliders y actualiza PARAMS. */
function readSliders() {
  PARAMS.beta  = parseFloat(document.getElementById('betaSlider').value);
  PARAMS.gamma = parseFloat(document.getElementById('gammaSlider').value);
  PARAMS.N     = parseInt(document.getElementById('popSlider').value, 10);
  PARAMS.I0    = parseInt(document.getElementById('infSlider').value, 10);
  PARAMS.alpha = parseFloat(document.getElementById('alphaSlider').value);
  if (PARAMS.I0 >= PARAMS.N) PARAMS.I0 = Math.max(1, PARAMS.N - 1);
}

/** Actualiza los badges de valor junto a cada slider. */
function updateDisplays() {
  document.getElementById('betaVal').textContent  = PARAMS.beta.toFixed(3);
  document.getElementById('gammaVal').textContent = PARAMS.gamma.toFixed(2);
  document.getElementById('popVal').textContent   = PARAMS.N.toLocaleString();
  document.getElementById('infVal').textContent   = PARAMS.I0;
  document.getElementById('alphaVal').textContent = PARAMS.alpha.toFixed(2);
}

/**
 * Función principal de actualización.
 * Lee sliders → actualiza displays → recalcula SIR → actualiza todo.
 */
function onParamChange() {
  readSliders();
  updateDisplays();
  updateR0();
  const data = solveSIR();
  updateChart(data);
  renderAnalysis(data);
  resetParticleSim(data);
}

/** Conecta el evento 'input' a cada slider. */
function bindSliders() {
  ['betaSlider', 'gammaSlider', 'popSlider', 'infSlider', 'alphaSlider'].forEach(id => {
    document.getElementById(id).addEventListener('input', onParamChange);
  });
}

/* ══════════════════════════════════════════════
   7. REINICIO
══════════════════════════════════════════════ */

/** Restaura todos los sliders a sus valores por defecto y recalcula. */
function resetSimulation() {
  document.getElementById('betaSlider').value  = '0.035';
  document.getElementById('gammaSlider').value = '0.25';
  document.getElementById('popSlider').value   = '100';
  document.getElementById('infSlider').value   = '1';
  document.getElementById('alphaSlider').value = '0.00';
  onParamChange();
}

/* ══════════════════════════════════════════════
   8. ARRANQUE
══════════════════════════════════════════════ */

/* ══════════════════════════════════════════════
   5b. ANÁLISIS DEL MODELO (se actualiza con los deslizadores)
══════════════════════════════════════════════ */

function inflections(arr, times) {
  const out = []; let prev = 0, pd = 0, pt = 0;
  for (let i = 1; i < arr.length - 1; i++) {
    const d2 = arr[i + 1] - 2 * arr[i] + arr[i - 1];
    if (Math.abs(d2) < 1e-6) continue;
    const s = Math.sign(d2);
    if (prev !== 0 && s !== prev) out.push(pt + (0 - pd) * (times[i] - pt) / (d2 - pd));
    prev = s; pd = d2; pt = times[i];
  }
  return out;
}

/** Tamaño final del SIR: raíz de I₀ + S₀ − S + (γ/β)·ln(S/S₀) = 0 */
function finalS(S0, I0, c) {
  const f = S => (I0 + S0) - S + c * Math.log(S / S0);
  let lo = 1e-12, hi = Math.min(S0, c);
  for (let k = 0; k < 200; k++) { const mid = (lo + hi) / 2; if (f(mid) < 0) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

function renderAnalysis(data) {
  const { beta, gamma, alpha, N, I0 } = PARAMS;
  const S0 = N - I0, c = gamma / beta, R0 = beta * N / gamma;
  const f2 = x => Number(x).toFixed(2).replace('-', '−'), f1 = x => Number(x).toFixed(1).replace('-', '−'), pct = x => (100 * x / N).toFixed(1) + ' %';
  const iMax = Math.max(...data.I), kPk = data.I.indexOf(iMax), tPk = data.times[kPk];
  const lst = a => a.length ? a.map(t => f1(t)).join(' y ') : 'no hay';
  const cS = inflections(data.S, data.times), cI = inflections(data.I, data.times), cR = inflections(data.R, data.times);
  const sirs = alpha > 0;
  const blocks = [];
  let peakTxt, eqTxt, endTxt, interp;

  if (!sirs) {
    const Imx = S0 > c ? I0 + S0 - c + c * Math.log(c / S0) : I0;
    const Sinf = finalS(S0, I0, c);
    peakTxt = S0 > c
      ? `I<sub>máx</sub> = I₀ + S₀ − γ/β + (γ/β)·ln(γ/(βS₀)) = <b>${f2(Imx)}</b><br>Ocurre cuando S = γ/β = ${f2(c)} (RK4: t ≈ ${f1(tPk)})`
      : `S₀ ≤ γ/β = ${f2(c)}: I solo decrece. I<sub>máx</sub> = I₀ = <b>${f2(I0)}</b>`;
    eqTxt = `Equilibrios (S*, 0, R*), con I = 0.<br>dI/dt = I·(βS − γ): estable si S* &lt; γ/β = ${f2(c)}, inestable si S* &gt; ${f2(c)}.<br>Estado final: S<sub>∞</sub> = ${Sinf < 0.01 ? Sinf.toExponential(1) : f2(Sinf)} → <b>${Sinf < c ? 'estable' : 'inestable'}</b>`;
    endTxt = `Se infectan en total ${f1(N - Sinf)} de ${N} equipos (${pct(N - Sinf)}). S → ${Sinf < 0.01 ? '≈ 0' : f2(Sinf)}, I → 0, R → ${f1(N - Sinf)}.`;
    interp = R0 > 1
      ? `Cada equipo infectado contagia a ${f1(R0)} más. El pico llega a ${f1(iMax)} de ${N} equipos (${pct(iMax)}) en t ≈ ${f1(tPk)}, y al final se infectan ${pct(N - Sinf)} de la red.`
      : `Con R₀ ≤ 1 el virus no se propaga: los infectados disminuyen desde el inicio.`;
  } else {
    const lam2 = beta * N - gamma;
    const dfe = `Libre de infección (N, 0, 0): autovalores −α = ${f2(-alpha)} y βN − γ = ${f2(lam2)} → <b>${lam2 < 0 ? 'estable' : 'inestable (punto silla)'}</b>`;
    if (R0 > 1) {
      const Is = (N - c) / (1 + gamma / alpha), Rs = gamma * Is / alpha;
      const tr = -(beta * Is + alpha), det = beta * Is * (gamma + alpha), disc = tr * tr - 4 * det;
      const ev = disc >= 0 ? `${f2((tr + Math.sqrt(disc)) / 2)} y ${f2((tr - Math.sqrt(disc)) / 2)}` : `${f2(tr / 2)} ± ${f2(Math.sqrt(-disc) / 2)}i`;
      peakTxt = `Pico numérico (RK4): I = <b>${f2(iMax)}</b> en t ≈ ${f1(tPk)}`;
      eqTxt = `${dfe}<br>Endémico (${f2(c)}, ${f2(Is)}, ${f2(Rs)}): autovalores ${ev} → <b>${disc >= 0 ? 'nodo' : 'espiral'} estable</b> (tr J = ${f2(tr)} &lt; 0, det J = ${f2(det)} &gt; 0)`;
      endTxt = `Las curvas convergen al equilibrio endémico: S* = γ/β = ${f2(c)}, I* = (N − γ/β)/(1 + γ/α) = ${f2(Is)}, R* = γI*/α = ${f2(Rs)}. La infección persiste.`;
      interp = `Cada equipo infectado contagia a ${f1(R0)} más. Con reinfección el virus no se extingue: unos ${f1(Is)} equipos (${pct(Is)}) quedan infectados de forma permanente y ${f1(Rs)} protegidos.`;
    } else {
      peakTxt = `Pico numérico (RK4): I = <b>${f2(iMax)}</b> en t ≈ ${f1(tPk)}`;
      eqTxt = `${dfe}<br>No existe equilibrio endémico: exige R₀ &gt; 1.`;
      endTxt = `Con R₀ ≤ 1 todas las curvas tienden al estado libre de infección (N, 0, 0).`;
      interp = `Con R₀ ≤ 1 la infección se extingue aunque haya reinfección.`;
    }
  }
  const cont = R0 > 1
    ? `R₀ = ${f2(R0)} &gt; 1. Para R₀ &lt; 1 se necesita <b>γ &gt; βN = ${f2(beta * N)}</b> (hoy ${f2(gamma)}) o <b>β &lt; γ/N = ${(gamma / N).toFixed(4)}</b> (hoy ${beta.toFixed(3)}), o proteger al <b>${(100 * (1 - 1 / R0)).toFixed(1)} %</b> de la red (1 − 1/R₀).`
    : `R₀ = ${f2(R0)} ≤ 1: el brote se extingue solo, sin medidas adicionales.`;
  const conc = `Susceptibles (S): ${lst(cS)}<br>Infectados (I): ${lst(cI)}<br>Recuperados (R): ${lst(cR)}<br><span style="color:var(--text-light)">Valores de t donde cambia la concavidad</span>`;
  const items = [['Pico de infectados', peakTxt], ['Equilibrio y estabilidad', eqTxt], ['Comportamiento final', endTxt], ['Cambios de concavidad', conc], ['Cómo contener el brote', cont], ['Interpretación', interp]];
  document.getElementById('anBadge').textContent = sirs ? 'SIRS (con reinfección)' : 'SIR (sin reinfección)';
  document.getElementById('analysisBody').innerHTML = items.map(([t, b]) =>
    `<div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:var(--radius);padding:14px 16px"><div style="font-size:11px;font-weight:600;letter-spacing:0.07em;text-transform:uppercase;color:var(--text-light);margin-bottom:6px">${t}</div><div style="font-size:13px;color:var(--gray-700);line-height:1.6">${b}</div></div>`).join('');

  const rows = [0, 1, 2, 3, 5, 10, 20, 40, 60].filter(t => t <= T_MAX).map(t => {
    const k = Math.round(t / DT);
    return `<tr><td>${t}</td><td>${f2(data.S[k])}</td><td>${f2(data.I[k])}</td><td>${f2(data.R[k])}</td></tr>`;
  }).join('');
  document.getElementById('tableBody').innerHTML =
    `<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:13px;text-align:center"><thead><tr style="color:var(--text-light);border-bottom:1px solid var(--gray-200)"><th style="padding:6px">t</th><th style="color:var(--s-color)">S</th><th style="color:var(--i-color)">I</th><th style="color:var(--r-color)">R</th></tr></thead><tbody>${rows}</tbody></table>`;
}

document.addEventListener('DOMContentLoaded', () => {

  // Leer estado inicial de los sliders
  readSliders();
  updateDisplays();
  updateR0();

  // Resolver el modelo por primera vez
  const data = solveSIR();

  // Inicializar gráfica
  initChart(data);
  renderAnalysis(data);

  // Inicializar simulación de agentes (delay para que el canvas tenga dimensiones CSS)
  setTimeout(() => initParticleSim(data), 120);

  // Conectar sliders
  bindSliders();

  // Botón de reinicio
  document.getElementById('resetBtn').addEventListener('click', resetSimulation);

  // Redimensionar canvas al cambiar tamaño de ventana
  window.addEventListener('resize', () => {
    resizeCanvas();
  });

  console.log('%c🛡️ Simulador SIR · Virus informáticos · Cargado correctamente', 'color:#1d6fce;font-family:DM Mono,monospace;font-size:13px;');
  console.log('%cEcuaciones Diferenciales Grupo 5 · Camilo Esteban Soto Saray', 'color:#94a3b8;font-family:DM Mono,monospace;font-size:11px;');
});
