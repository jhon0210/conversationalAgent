(() => {
  const $ = (id) => document.getElementById(id);
  const chat = $("chat");
  const form = $("form");
  const entrada = $("entrada");
  const btnEnviar = $("enviar");
  const estado = $("estado");
  const estadoTexto = $("estadoTexto");
  const badge = $("badge");
  const badgeTexto = $("badgeTexto");
  const chips = $("chips");
  const uso = $("uso");
  const composer = $("composer");
  const hero = $("hero");
  const casosEl = $("casos");
  const pasos = [...document.querySelectorAll("#stepper .paso")];

  const PLACEHOLDER = 'Ej.: Procesa el caso "ec-corp-andina". No envíes nada todavía.';
  const MARCADOR = /CONFIRMACI[OÓ]N REQUERIDA:?\s*(.*)/i;
  const PASO_DE = {
    proveedor_leer_solicitud: 0,
    proveedor_mapear_campos: 1,
    proveedor_generar_formulario: 2,
    proveedor_armar_paquete: 3,
    proveedor_simular_envio: 4,
  };

  let sessionId = localStorage.getItem("sessionId");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("sessionId", sessionId);
  }
  let enCurso = false;
  let confirmacionPendiente = false;
  let contenidoTurno = null; // contenedor de la fila del asistente del turno en curso
  let tarjetas = new Map(); // id de tool call -> <details>

  // ---------- utilidades ----------
  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const el = (tag, clase, html) => {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (html !== undefined) n.innerHTML = html;
    return n;
  };
  const bajar = () => chat.scrollTo({ top: chat.scrollHeight, behavior: "smooth" });
  const humanizar = (t) => String(t).replace(/_/g, " ");
  const parsear = (t) => { try { return JSON.parse(t.resultado).data; } catch { return null; } };
  const json = (texto) => { try { return JSON.stringify(JSON.parse(texto), null, 2); } catch { return texto; } };

  const inline = (t) =>
    esc(t).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Markdown mínimo y seguro: se escapa todo el HTML antes de dar formato.
  function markdown(texto) {
    let html = "";
    let lista = null;
    let tabla = [];
    const cerrarLista = () => { if (lista) { html += `</${lista}>`; lista = null; } };
    const cerrarTabla = () => {
      if (!tabla.length) return;
      const filas = tabla.filter((f) => !/^\s*\|?\s*:?-{2,}/.test(f));
      const celdas = (f) => f.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      html += "<table>" + filas.map((f, i) => `<tr>${celdas(f).map((c) => `<${i ? "td" : "th"}>${inline(c)}</${i ? "td" : "th"}>`).join("")}</tr>`).join("") + "</table>";
      tabla = [];
    };
    for (const linea of texto.split("\n")) {
      if (/^\s*\|.*\|\s*$/.test(linea)) { cerrarLista(); tabla.push(linea); continue; }
      cerrarTabla();
      const ul = /^\s*[-*]\s+(.*)/.exec(linea);
      const ol = /^\s*\d+[.)]\s+(.*)/.exec(linea);
      const h = /^#{1,4}\s+(.*)/.exec(linea);
      if (ul || ol) {
        const tipo = ul ? "ul" : "ol";
        if (lista !== tipo) { cerrarLista(); html += `<${tipo}>`; lista = tipo; }
        html += `<li>${inline((ul || ol)[1])}</li>`;
      } else if (h) { cerrarLista(); html += `<h4>${inline(h[1])}</h4>`; }
      else if (!linea.trim()) { cerrarLista(); }
      else { cerrarLista(); html += `<p>${inline(linea)}</p>`; }
    }
    cerrarLista();
    cerrarTabla();
    return html;
  }

  // ---------- tema ----------
  $("tema").addEventListener("click", () => {
    const nuevo = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nuevo);
    localStorage.setItem("tema", nuevo);
  });

  // ---------- stepper ----------
  const marcarPaso = (i, clase) => {
    if (i === undefined || !pasos[i]) return;
    pasos[i].classList.remove("activo", "hecho", "error", "espera");
    if (clase) pasos[i].classList.add(clase);
  };
  const reiniciarStepper = () => pasos.forEach((_, i) => marcarPaso(i, null));

  // ---------- filas ----------
  function filaAsistente() {
    const fila = el("div", "fila asistente");
    fila.appendChild(el("div", "avatar", "✦"));
    const contenido = el("div", "contenido");
    fila.appendChild(contenido);
    chat.appendChild(fila);
    return contenido;
  }

  const turno = () => contenidoTurno || (contenidoTurno = filaAsistente());

  function pintarUsuario(texto) {
    const fila = el("div", "fila usuario");
    const m = el("div", "msg usuario");
    m.textContent = texto;
    fila.appendChild(m);
    chat.appendChild(fila);
    bajar();
  }

  function pintarError(texto) {
    const m = el("div", "msg error");
    m.textContent = texto;
    turno().appendChild(m);
    bajar();
  }

  // ---------- tarjetas de herramientas ----------
  function crearTarjeta(id, nombre, args) {
    const d = el("details", "tool running");
    d.innerHTML =
      `<summary><span class="ico"><span class="spinner"></span></span><span class="nombre">${esc(nombre)}</span>` +
      `<span class="pill">EJECUTANDO</span><span class="ms"></span>` +
      `<span class="tres">${esc(JSON.stringify(args).slice(0, 140))}</span></summary>`;
    grupoHerramientas().appendChild(d);
    tarjetas.set(id, d);
    bajar();
    return d;
  }

  function grupoHerramientas() {
    const c = turno();
    let g = c.querySelector(":scope > .toolcalls");
    if (!g) { g = el("div", "toolcalls"); c.prepend(g); }
    return g;
  }

  function completarTarjeta(d, t) {
    d.className = `tool ${t.ok ? "ok" : "err"}`;
    d.querySelector(".ico").innerHTML = t.ok ? "✓" : "✕";
    d.querySelector(".ico").style.color = t.ok ? "var(--ok)" : "var(--err)";
    d.querySelector(".pill").textContent = t.ok ? "OK" : "ERROR";
    d.querySelector(".ms").textContent = `${t.duracionMs} ms`;
    d.querySelector(".tres").textContent = t.resumen;
    d.querySelector(".detalle")?.remove();
    d.appendChild(
      el("div", "detalle",
        `<div class="etq">Argumentos</div><pre>${esc(JSON.stringify(t.args, null, 2))}</pre>` +
        `<div class="etq">Resultado</div><pre>${esc(json(t.resultado))}</pre>`),
    );
  }

  function pintarHerramientaCompleta(t) {
    const d = crearTarjeta(t.id, t.nombre, t.args);
    completarTarjeta(d, t);
  }

  // ---------- resumen del paquete ----------
  function animarNumero(nodo, destino) {
    if (typeof destino !== "number") { nodo.textContent = String(destino); return; }
    const inicio = performance.now();
    const dur = 650;
    const paso = (ahora) => {
      const p = Math.min(1, (ahora - inicio) / dur);
      nodo.textContent = String(Math.round(destino * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
    // Si la pestaña está oculta, rAF se pausa: garantiza el valor final.
    setTimeout(() => { nodo.textContent = String(destino); }, dur + 150);
  }

  function resumenPaquete(llamadas) {
    const ok = (nombre) => [...llamadas].reverse().find((t) => t.nombre === nombre && t.ok);
    const armar = ok("proveedor_armar_paquete");
    if (!armar) return null;
    const d = parsear(armar);
    if (!d || !d.checklist) return null;
    const gen = ok("proveedor_generar_formulario");
    const map = ok("proveedor_mapear_campos");
    const llenos = gen ? parsear(gen)?.campos_llenos : map ? parsear(map)?.llenos?.length : "–";
    const faltantes = d.checklist.campos_faltantes || [];
    const confirmar = d.checklist.campos_requieren_confirmacion || [];

    const soportes = d.checklist.soportes
      .map((s) => {
        const clase = s.estado === "presente" ? (s.aviso ? "pronto" : "presente") : s.estado;
        const nota = s.estado === "ausente" ? "no existe" : s.estado === "vencido" ? `venció ${s.vigencia_hasta}` : s.vigencia_hasta ? `hasta ${s.vigencia_hasta}` : "sin vencimiento";
        const marca = s.aviso ? " · vence pronto" : "";
        return `<span class="soporte ${clase}"><b>${esc(humanizar(s.tipo))}</b><small>${esc(nota + marca)}</small></span>`;
      })
      .join("");
    const lista = (titulo, items) =>
      items.length ? `<div class="bloque-titulo">${titulo}</div><ul class="lista-mini">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "";

    const card = el("div", "resumen");
    card.innerHTML =
      `<div class="resumen-head"><div><span class="eyebrow">Resumen del paquete</span><h3>${esc(armar.args.caso || "")}</h3></div>` +
      `<span class="sello ${d.listo_para_firma ? "ok" : "no"}">${d.listo_para_firma ? "LISTO PARA FIRMA" : "NO LISTO PARA FIRMA"}</span></div>` +
      `<div class="metricas">` +
      `<div class="metrica ok"><div class="n" data-n="${llenos}">0</div><div class="l">Campos llenos</div></div>` +
      `<div class="metrica ${faltantes.length ? "no" : "ok"}"><div class="n" data-n="${faltantes.length}">0</div><div class="l">Faltantes</div></div>` +
      `<div class="metrica ${confirmar.length ? "aviso" : "ok"}"><div class="n" data-n="${confirmar.length}">0</div><div class="l">Por confirmar</div></div>` +
      `</div>` +
      `<div class="bloque-titulo">Soportes exigidos</div><div class="soportes">${soportes}</div>` +
      lista("Bloquean la firma", d.checklist.bloqueos || []) +
      lista("Campos faltantes", faltantes) +
      lista("Requieren confirmación", confirmar) +
      `<div class="meta"><span>Fecha de ejecución: ${esc(d.fecha_ejecucion)}</span><span>${esc(d.ruta)}</span></div>`;
    card.querySelectorAll(".n").forEach((n) => {
      const v = n.dataset.n;
      animarNumero(n, /^\d+$/.test(v) ? Number(v) : v);
    });
    return card;
  }

  // ---------- respuesta y confirmación ----------
  function pintarConfirmacion(pregunta) {
    const c = el("div", "confirm");
    c.setAttribute("role", "alert");
    c.innerHTML =
      `<div class="titulo"><span class="alerta">!</span><span>Se requiere tu confirmación (humano en el circuito)</span></div>` +
      `<div class="pregunta">${esc(pregunta)}</div>` +
      `<div class="botones"><button type="button" class="si">Sí, confirmar</button><button type="button" class="no">No, cancelar</button></div>`;
    c.querySelector(".si").addEventListener("click", () => enviar("Sí, confirmo."));
    c.querySelector(".no").addEventListener("click", () => enviar("No, cancela."));
    turno().appendChild(c);
    confirmacionPendiente = true;
    composer.classList.add("espera");
    entrada.placeholder = "Responde “sí” para confirmar o “no” para cancelar…";
  }

  function resolverConfirmaciones() {
    document.querySelectorAll(".confirm:not(.resuelta)").forEach((c) => c.classList.add("resuelta"));
    confirmacionPendiente = false;
    composer.classList.remove("espera");
    entrada.placeholder = PLACEHOLDER;
  }

  function pintarRespuesta(texto, llamadas, necesitaConfirmacion, esError) {
    const c = turno();
    const resumen = resumenPaquete(llamadas || []);
    if (resumen) c.appendChild(resumen);
    if (esError) {
      pintarError(texto);
    } else {
      let cuerpo = texto;
      let pregunta = null;
      if (necesitaConfirmacion) {
        const m = MARCADOR.exec(texto);
        pregunta = m ? (m[1] || "¿Confirmas?").trim() : "El asistente espera tu confirmación para continuar.";
        if (m) cuerpo = texto.replace(MARCADOR, "").trim();
      }
      if (cuerpo) c.appendChild(el("div", "msg asistente", markdown(cuerpo)));
      if (necesitaConfirmacion) pintarConfirmacion(pregunta);
    }
    bajar();
  }

  function actualizarUso(u) {
    if (u) uso.textContent = `Tokens de la sesión: ${u.tokens.toLocaleString("es-CO")} / ${u.maximo.toLocaleString("es-CO")}`;
  }

  // ---------- historial ----------
  function pintarEntrada(e) {
    if (e.rol === "user") { contenidoTurno = null; pintarUsuario(e.texto); return; }
    for (const t of e.toolCalls || []) pintarHerramientaCompleta(t);
    pintarRespuesta(e.texto, e.toolCalls, e.needsConfirmation, e.rol === "error");
    contenidoTurno = null;
  }

  function reconstruirStepper(historial) {
    const ultimo = [...historial].reverse().find((e) => e.rol !== "user");
    if (!ultimo) return;
    for (const t of ultimo.toolCalls || []) marcarPaso(PASO_DE[t.nombre], t.ok ? "hecho" : "error");
    if (ultimo.needsConfirmation) marcarPaso(4, "espera");
  }

  // ---------- red (SSE) ----------
  function ocupado(valor) {
    enCurso = valor;
    estado.hidden = !valor;
    btnEnviar.disabled = valor;
    entrada.disabled = valor;
    document.querySelectorAll(".confirm button, .chip, .caso").forEach((b) => (b.disabled = valor));
    if (valor) bajar();
  }

  async function leerSSE(respuesta, alEvento) {
    const lector = respuesta.body.getReader();
    const decodificador = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await lector.read();
      if (done) break;
      buffer += decodificador.decode(value, { stream: true });
      let i;
      while ((i = buffer.indexOf("\n\n")) >= 0) {
        const bloque = buffer.slice(0, i);
        buffer = buffer.slice(i + 2);
        let nombre = "message";
        let datos = "";
        for (const linea of bloque.split("\n")) {
          if (linea.startsWith("event:")) nombre = linea.slice(6).trim();
          else if (linea.startsWith("data:")) datos += linea.slice(5).trim();
        }
        if (datos) alEvento(nombre, JSON.parse(datos));
      }
    }
  }

  function alEvento(nombre, datos) {
    if (nombre === "estado") {
      estadoTexto.textContent = datos.texto;
    } else if (nombre === "herramienta_inicio") {
      crearTarjeta(datos.id, datos.nombre, datos.args);
      marcarPaso(PASO_DE[datos.nombre], "activo");
      estadoTexto.textContent = `Ejecutando ${datos.nombre}…`;
    } else if (nombre === "herramienta") {
      const t = datos.llamada;
      const d = tarjetas.get(t.id) || crearTarjeta(t.id, t.nombre, t.args);
      completarTarjeta(d, t);
      marcarPaso(PASO_DE[t.nombre], t.ok ? "hecho" : "error");
    } else if (nombre === "fin") {
      terminado = true;
      pintarRespuesta(datos.reply, datos.toolCalls, datos.needsConfirmation, datos.esError);
      if (datos.needsConfirmation) marcarPaso(4, "espera");
      actualizarUso(datos.uso);
    } else if (nombre === "fallo") {
      terminado = true;
      pintarError(datos.mensaje);
    }
  }

  let terminado = false;

  async function enviar(texto) {
    const mensaje = (texto ?? entrada.value).trim();
    if (!mensaje || enCurso) return;
    hero.hidden = true;
    if (confirmacionPendiente) {
      resolverConfirmaciones();
      marcarPaso(4, null);
    } else {
      reiniciarStepper();
    }
    contenidoTurno = null;
    tarjetas = new Map();
    terminado = false;
    pintarUsuario(mensaje);
    entrada.value = "";
    autoajustar();
    estadoTexto.textContent = "Enviando tu solicitud…";
    ocupado(true);
    try {
      const r = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: mensaje }),
      });
      if (!r.ok) {
        const datos = await r.json().catch(() => ({}));
        pintarError(datos.error || "No se pudo procesar la solicitud.");
      } else {
        await leerSSE(r, alEvento);
        if (!terminado) pintarError("Se interrumpió la conexión con el servidor. Intenta de nuevo.");
      }
    } catch {
      pintarError("No hay conexión con el servidor. Verifica tu red e intenta de nuevo.");
    } finally {
      ocupado(false);
      entrada.focus();
      bajar();
    }
  }

  // ---------- arranque ----------
  async function cargarEstado() {
    try {
      const h = await (await fetch("/api/health")).json();
      badgeTexto.textContent = `${h.provider} · ${h.model}` + (h.llmConfigurado ? "" : " (sin configurar)");
      badge.className = `badge ${h.llmConfigurado ? "ok" : "warn"}`;
    } catch {
      badgeTexto.textContent = "sin conexión";
      badge.className = "badge warn";
    }
    try {
      const { casos } = await (await fetch("/api/casos")).json();
      for (const c of casos) {
        const prompt = `Procesa el caso "${c.caso}". Dime qué campos quedaron llenos, cuáles faltan, si el paquete está listo para firma y qué soportes debo actualizar. No envíes nada todavía.`;
        const tarjeta = el("button", "caso");
        tarjeta.type = "button";
        tarjeta.innerHTML =
          `<span class="nombre">${esc(c.caso)}</span><span class="cliente">${esc(c.cliente)}</span>` +
          `<span class="etiquetas">${c.pais ? `<span class="tag">${esc(c.pais)}</span>` : ""}${c.formato ? `<span class="tag ${esc(c.formato)}">${esc(c.formato.toUpperCase())}</span>` : ""}</span>`;
        tarjeta.addEventListener("click", () => enviar(prompt));
        casosEl.appendChild(tarjeta);

        const chip = el("button", "chip");
        chip.type = "button";
        chip.textContent = c.caso;
        chip.addEventListener("click", () => enviar(prompt));
        chips.appendChild(chip);
      }
    } catch { /* los atajos son opcionales */ }
  }

  async function cargarHistorial() {
    try {
      const { historial, tokens } = await (await fetch(`/api/sessions/${sessionId}`)).json();
      if (historial && historial.length) {
        hero.hidden = true;
        for (const e of historial) pintarEntrada(e);
        const confirmaciones = chat.querySelectorAll(".confirm");
        confirmaciones.forEach((c, i) => { if (i < confirmaciones.length - 1) c.classList.add("resuelta"); });
        if (!historial[historial.length - 1].needsConfirmation) resolverConfirmaciones();
        reconstruirStepper(historial);
        if (tokens) uso.textContent = `Tokens de la sesión: ${tokens.toLocaleString("es-CO")}`;
        chat.scrollTop = chat.scrollHeight;
        setTimeout(() => { chat.scrollTop = chat.scrollHeight; }, 700);
      }
    } catch { /* sesión nueva */ }
  }

  function autoajustar() {
    entrada.style.height = "auto";
    entrada.style.height = `${Math.min(entrada.scrollHeight, 140)}px`;
  }

  form.addEventListener("submit", (ev) => { ev.preventDefault(); enviar(); });
  entrada.addEventListener("input", autoajustar);
  entrada.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); enviar(); }
  });
  $("nueva").addEventListener("click", () => {
    if (enCurso) return;
    sessionId = crypto.randomUUID();
    localStorage.setItem("sessionId", sessionId);
    [...chat.children].forEach((n) => { if (n !== hero) n.remove(); });
    hero.hidden = false;
    uso.textContent = "";
    contenidoTurno = null;
    reiniciarStepper();
    resolverConfirmaciones();
  });

  cargarEstado();
  cargarHistorial();
})();
