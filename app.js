// Citesc Singur / Egyedül Olvasok — platforma do kit de alfabetização (motor comum RO + HU).
// App estático de uma página: router por hash, progresso no navegador. Cada caderno reproduz um PDF do kit,
// página por página; as páginas são desenhadas em HTML e impressas em A4 (uma a uma ou o caderno inteiro).

(function () {
  "use strict";

  const K = window.KIT;
  const U = K.ui;
  const MOD = K.modules;
  const MOD0 = window.KIT.modules.map(m => m.id);
  const CAD = (window.CAIETE || []).slice().sort((a, b) => MOD0.indexOf(a.m) - MOD0.indexOf(b.m));
  // ?imgs=s usa figuras menores (só para gerar os PDFs sem pesar o site).
  const IMG = new URLSearchParams(location.search).get("imgs") === "s" ? "img/s/" : "img/b/";

  // ---------- Estado salvo (comum aos dois idiomas) ----------
  const KEY = "alfa-area:v2";
  const state = Object.assign({ done: [], plan: [], child: "", kit: "" }, load());
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* navegação privada */ } }
  const has = (arr, v) => arr.indexOf(v) !== -1;
  function toggle(arr, v) { const i = arr.indexOf(v); if (i === -1) arr.push(v); else arr.splice(i, 1); save(); return i === -1; }

  // ?kit=complet|teljes libera os módulos 7–10 neste aparelho.
  const qs = new URLSearchParams(location.search);
  if (qs.get("kit")) { state.kit = qs.get("kit"); save(); }
  if (!state.kit && window.ALFA_KIT) state.kit = window.ALFA_KIT;
  const full = () => state.kit === K.kitParam || state.kit === "complet" || state.kit === "teljes";
  const lockedMod = m => m && m.full && !full();
  // Extras da escada (Continuare, Pachetul de salvare, Ghidul părintelui): cada um só aparece (menu, home, busca)
  // em quem abriu o link com ?up=<chave>[,<chave>]; o aparelho lembra e os acessos se somam.
  const ups = () => String(state.up || "").split(",").filter(Boolean);
  if (qs.get("up")) { state.up = Array.from(new Set(ups().concat(qs.get("up").split(",").filter(Boolean)))).join(","); save(); }
  const hasUp = k => ups().indexOf(k) !== -1;
  for (let i = CAD.length - 1; i >= 0; i--) { const mu = (MOD.find(m => m.id === CAD[i].m) || {}).up; if (mu && !hasUp(mu)) CAD.splice(i, 1); }
  for (let i = MOD.length - 1; i >= 0; i--) if (MOD[i].up && !hasUp(MOD[i].up)) MOD.splice(i, 1);

  // ---------- Utilidades ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/·/g, "");
  const view = $("#view");
  const modOf = id => MOD.find(m => m.id === id);
  const cadOf = id => CAD.find(c => c.id === id);
  const cadsOf = mid => CAD.filter(c => c.m === mid);
  const totalPages = () => CAD.filter(c => !lockedMod(modOf(c.m))).reduce((s, c) => s + c.pages.length, 0);
  const pk = (c, n) => `${c.id}:${n}`;
  // Rótulo com número: «Modulul 1» em romeno, «1. modul» em húngaro.
  const lbl = (w, n) => U.numFirst ? `${n}. ${w.toLowerCase()}` : `${w} ${n}`;
  const modL = m => m.tag ? m.tag : lbl(U.nbOf, m.id.slice(1)) + " · " + (m.grp === "basic" ? U.grpB : m.grp === "upsell" ? U.grpU : U.grpC).replace(/ · .*/, "").replace("⭐ ", "");
  let toastT;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2200);
  }
  // PDFs prontos (gerados do próprio app): pdf/<idioma>/<caderno>/NN.pdf e pdf/<idioma>/<caderno>.pdf
  const fname = (...p) => p.join("-").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".pdf";
  const dlPage = (c, n) => `<a class="btn dl-btn" href="pdf/${K.lang}/${c.id}/${String(n).padStart(2, "0")}.pdf" download="${fname(K.name, c.t, n)}">${U.dlPage}</a>`;
  const dlAll = c => `<a class="btn ghost dl-btn" href="pdf/${K.lang}/${c.id}.pdf" download="${fname(K.name, c.t)}">${U.dlAll}</a>`;
  const dots = s => esc(s).replace(/·/g, '<i class="dot">·</i>');
  // «PI__ICĂ» + resposta «S» → lacuna com a resposta escondida até «mostrar respostas»
  const gapw = (w, a) => esc(w).replace("__", `<b class="gap"><em class="ans">${esc(a)}</em></b>`);
  // A figura reserva o espaço (aspect-ratio) antes de carregar: sem isso, a largura «auto» começa em 0
  // e o carregamento preguiçoso nunca dispara (cartões vazios na primeira visita).
  const arOf = k => /^s\d\d$/.test(k) ? "16/9" : /^(f\d\d|c\d{3}|cover_.*)$/.test(k) ? "4/3" : "1/1";
  const pic = (k, cls = "") => k ? `<img class="pic ${cls}" style="aspect-ratio:${arOf(k)}" src="${IMG}${k}.jpg" alt="" loading="lazy">` : "";

  // ---------- Menu lateral e barra de abas ----------
  function navHTML(r) {
    const is = (...p) => p.some(x => r === x || r.startsWith(x + "/")) ? " active" : "";
    const link = (h, e, t, c, a) => `<a href="${h}" class="nav-link${a}"><span class="ne">${e}</span><span class="nt">${t}</span>${c != null ? `<span class="nc">${c}</span>` : ""}</a>`;
    return `
      <div class="nav-group">${link("#/", "🏠", U.menu.home, null, r === "" ? " active" : "")}
        ${link("#/plan", "📅", U.menu.plan, `${state.plan.length}/30`, is("plan"))}</div>
      <div class="nav-head">${U.notebooks}</div>
      <div class="nav-group">${CAD.map(c => link(`#/c/${c.id}`, c.e, esc(c.t), lockedMod(modOf(c.m)) ? "🔒" : c.pages.length, is(`c/${c.id}`) || is(`tipar/${c.id}`))).join("")}</div>
      <div class="nav-head">${U.menu.modules}</div>
      <div class="nav-group">${MOD.map(m => link(`#/modul/${m.id}`, m.e, `${m.id.slice(1)}. ${esc(m.t)}`, m.full && !full() ? "🔒" : null, is(`modul/${m.id}`))).join("")}</div>
      <div class="nav-group">${link("#/cadouri", "🎁", U.menu.gifts, K.gifts.length, is("cadouri", "cadou"))}
        ${link("#/ghid", "🧭", U.menu.guide, null, is("ghid"))}
        ${link("#/cauta", "🔎", U.menu.search, null, is("cauta"))}
        ${link("#/ajutor", "💬", U.menu.help, null, is("ajutor"))}</div>`;
  }
  function tabbarHTML(r) {
    const r0 = r.split("/")[0];
    const t = (h, e, l, a) => `<a href="${h}" class="tab${a ? " active" : ""}"><span>${e}</span>${l}</a>`;
    return t("#/", "🏠", U.tabs[0], r === "") + t("#/module", "🧩", U.tabs[1], r0 === "module" || r0 === "modul") +
      t("#/caiete", "📚", U.tabs[2], r0 === "caiete" || r0 === "c" || r0 === "tipar") + t("#/plan", "📅", U.tabs[3], r0 === "plan") +
      t("#/cadouri", "🎁", U.tabs[4], r0 === "cadouri" || r0 === "cadou");
  }

  // ---------- Plano de 30 dias: alterna sílabas e história, depois leitura ----------
  function planList() {
    const L = [], s = cadOf("silabe"), p = cadOf("poveste"), l = cadOf("lectura");
    for (let i = 0; i < 16; i++) {
      if (s) L.push([s, 3 + i * 2]);
      if (p && i < 9) L.push([p, 2 + i]);
    }
    for (let i = 0; l && L.length < 30; i++) L.push([l, 2 + i]);
    return L.slice(0, 30);
  }
  function todayItem() {
    const P = planList(); return P.find(([c, n]) => !has(state.plan, pk(c, n))) || P[0];
  }

  // ---------- Páginas do app ----------
  function renderHome() {
    const ti = todayItem();
    const today = ti ? (() => {
      const [c, n] = ti, pg = c.pages[n - 1], d = planList().findIndex(([c2, n2]) => pk(c2, n2) === pk(c, n)) + 1;
      return `<h2 class="eyebrow">${U.today} · ${lbl(U.day, d)}</h2>
        <a class="card today" href="#/c/${c.id}/${n}"><div class="today-thumb">${thumb(c, n)}</div>
        <div><div class="tag">${c.e} ${esc(c.t)}</div><h3>${esc(pageTitle(c, pg, n))}</h3>
        <p class="muted">${lbl(U.page, n)} / ${c.pages.length}</p><span class="btn">${U.openSheet}</span></div></a>`;
    })() : "";
    return `<div class="wrap">
      <section class="card hero">
        <span class="pill ok">● ${U.active}</span>
        <h1>${U.hello}</h1>
        <p class="lead">${U.helloP}</p>
        <div class="stats">
          <a class="stat" href="#/caiete"><b>${CAD.filter(c => !lockedMod(modOf(c.m))).length}</b><span>${U.stats[0]}</span></a>
          <a class="stat" href="#/caiete"><b>${totalPages()}</b><span>${U.stats[1]}</span></a>
          <a class="stat" href="#/plan"><b>30</b><span>${U.stats[2]}</span></a>
          <a class="stat" href="#/cadouri"><b>${K.gifts.filter(g => !g.soon).length}</b><span>${U.stats[3]}</span></a>
        </div>
      </section>
      ${today}
      <h2 class="eyebrow">${U.notebooks}</h2>
      <div class="grid nbs">${CAD.map(nbCard).join("")}</div>
      ${groups()}
      <h2 class="eyebrow">${U.menu.gifts}</h2>
      <div class="grid grid-2">${K.gifts.map(giftCard).join("")}</div>
      <p class="foot muted">${U.helpP} <a href="mailto:${K.supportEmail}">${K.supportEmail}</a></p>
    </div>`;
  }
  function nbCard(c) {
    const dn = c.pages.filter((p, i) => has(state.done, pk(c, i + 1))).length, m = modOf(c.m);
    return `<a class="card nb-card" href="#/c/${c.id}"><div class="nb-cover">${thumb(c, 1)}</div>
      <div class="nb-b"><div class="tag">${m.e} ${modL(m)}</div><h3>${esc(c.t)}</h3><p class="muted">${esc(c.sub)}</p>
      <div class="bar"><i style="width:${Math.round(100 * dn / c.pages.length)}%"></i></div><small class="muted">${dn}/${c.pages.length} ${U.progress}</small></div></a>`;
  }
  function modCard(m) {
    const cs = cadsOf(m.id), lock = m.full && !full(), n = cs.reduce((s, c) => s + c.pages.length, 0);
    return `<a class="card mod-card${lock ? " lock" : ""}" href="${cs.length === 1 && !lock ? "#/c/" + cs[0].id : "#/modul/" + m.id}">
      <span class="mod-e">${m.e}</span>
      <div class="mod-b"><div class="tag">${modL(m)} · ${m.lv}</div><h3>${esc(m.t)}</h3><p class="muted">${esc(m.d)}</p>
      <small class="muted">${lock ? "🔒 " + U.locked : cs.length ? `${cs.length} ${U.nb} · ${n} ${U.pages}` : "⏳ " + U.inPrep}</small></div>
    </a>`;
  }
  function giftCard(g) {
    return `<a class="card gift" href="#/cadou/${g.id}"><span class="mod-e">${g.e}</span><div><h3>${esc(g.t)}</h3><p class="muted">${esc(g.d)}</p></div></a>`;
  }
  function groups() {
    return [["basic", U.grpB], ["complet", U.grpC], ["upsell", U.grpU]].filter(([g]) => MOD.some(m => m.grp === g)).map(([g, t]) => `<h2 class="eyebrow">${t}</h2><div class="grid mods">${MOD.filter(m => m.grp === g).map(modCard).join("")}</div>`).join("");
  }
  function renderModules() {
    return `<div class="wrap"><h1 class="page-h">${U.menu.modules}</h1>${groups()}</div>`;
  }
  function renderNotebooks() {
    return `<div class="wrap"><h1 class="page-h">${U.allNotebooks}</h1><div class="grid nbs">${CAD.map(nbCard).join("")}</div></div>`;
  }
  function renderModule(id) {
    const m = modOf(id); if (!m) return notFound();
    const cs = cadsOf(id), lock = m.full && !full();
    let body;
    if (lock) body = `<div class="card empty"><p class="big-e">🔒</p><h2>${U.locked}</h2><p class="muted">${U.lockedP}</p></div>`;
    else if (!cs.length) body = `<div class="card empty"><p class="big-e">${m.e}</p><h2>${U.inPrep}</h2><p class="muted">${U.inPrepP}</p></div>`;
    else body = `<div class="grid nbs">${cs.map(nbCard).join("")}</div>`;
    return `<div class="wrap"><a class="back" href="#/module">${U.back}</a>
      <header class="mod-head"><span class="mod-e xl">${m.e}</span><div><div class="tag">${modL(m)} · ${m.lv}</div>
      <h1 class="page-h">${esc(m.t)}</h1><p class="lead">${esc(m.d)}</p></div></header>${body}</div>`;
  }
  function pageTitle(c, p, n) {
    if (p.t && p.type !== "silabe") return p.t;
    if (p.type === "lectura" || p.type === "fatiat") return p.title;
    if (p.type === "cover" || p.type === "end") return p.t;
    if (p.type === "silabe") return `${c.t}${p.bw ? " · " + U.bw : ""}`;
    return `${c.t} · ${n - 1}`;
  }
  function renderNotebook(id) {
    const c = cadOf(id); if (!c) return notFound();
    if (lockedMod(modOf(c.m))) return renderModule(c.m);
    const m = modOf(c.m), dn = c.pages.filter((p, i) => has(state.done, pk(c, i + 1))).length;
    return `<div class="wrap wide"><a class="back" href="#/caiete">${U.back}</a>
      <header class="nb-head"><div class="nb-cover big">${thumb(c, 1)}</div><div>
        <div class="tag">${m.e} ${modL(m)} · ${esc(m.t)}</div><h1 class="page-h">${esc(c.t)}</h1>
        <p class="lead">${esc(c.sub)} · ${c.pages.length} ${U.pages}</p>
        <div class="bar"><i style="width:${Math.round(100 * dn / c.pages.length)}%"></i></div><small class="muted">${dn}/${c.pages.length} ${U.progress}</small>
        <div class="sheet-tools" style="margin-top:14px"><a class="btn" href="#/c/${c.id}/1">${U.firstPage}</a><a class="btn ghost" href="#/tipar/${c.id}">${U.printAll}</a>${dlAll(c)}</div>
      </div></header>
      <div class="grid pages">${c.pages.map((p, i) => `<a class="card page-card" href="#/c/${c.id}/${i + 1}">${thumb(c, i + 1)}
        <span class="pn">${i + 1}</span><span class="check ${has(state.done, pk(c, i + 1)) ? "on" : ""}">✓</span></a>`).join("")}</div>
    </div>`;
  }
  function renderPlan() {
    const P = planList();
    let rows = "";
    for (let d = 1; d <= 30; d++) {
      const it = P[d - 1];
      if (!it) { rows += `<div class="day soon"><span class="dchk">${d}</span><span><b>${lbl(U.day, d)}</b> · <span class="muted">${U.inPrep}</span></span></div>`; continue; }
      const [c, n] = it, key = pk(c, n), dn = has(state.plan, key);
      rows += `<div class="day${dn ? " on" : ""}"><button class="dchk" data-plan="${key}" aria-label="✓">${dn ? "✓" : d}</button>
        <a href="#/c/${c.id}/${n}"><b>${lbl(U.day, d)}</b> · ${c.e} ${esc(pageTitle(c, c.pages[n - 1], n))} <span class="muted">· ${lbl(U.page, n)}</span></a></div>`;
    }
    return `<div class="wrap"><h1 class="page-h">${U.menu.plan}</h1><p class="lead">${U.planP}</p><div class="card plan">${rows}</div></div>`;
  }
  function renderGifts() {
    return `<div class="wrap"><h1 class="page-h">${U.menu.gifts}</h1><p class="lead">${U.giftsP}</p><div class="grid grid-2">${K.gifts.map(giftCard).join("")}</div></div>`;
  }
  function renderGuide() {
    return `<div class="wrap"><a class="back" href="#/">${U.back}</a><h1 class="page-h">${U.menu.guide}</h1>
      <div class="guide">${K.guide.map((g, i) => `<div class="card g"><span class="gn">${i + 1}</span><div><h3>${esc(g[0])}</h3><p>${esc(g[1])}</p></div></div>`).join("")}</div></div>`;
  }
  function renderHelp() {
    return `<div class="wrap"><h1 class="page-h">${U.menu.help}</h1><div class="card"><p class="lead">${U.helpP}</p>
      <p><a class="btn" href="mailto:${K.supportEmail}">✉️ ${K.supportEmail}</a></p></div></div>`;
  }
  function searchResults(q) {
    const n = norm(q || ""); if (n.length < 2) return "";
    const res = [];
    CAD.forEach(c => c.pages.forEach((p, i) => { if (norm(JSON.stringify(p) + " " + c.t).includes(n)) res.push([c, i + 1, p]); }));
    if (!res.length) return `<p class="muted">${U.searchNone}</p>`;
    return res.slice(0, 60).map(([c, i, p]) => `<a class="card res-row" href="#/c/${c.id}/${i}"><span class="mod-e">${c.e}</span><div><b>${esc(pageTitle(c, p, i))}</b><br><small class="muted">${esc(c.t)} · ${lbl(U.page, i)}</small></div></a>`).join("");
  }
  function renderSearch(q) {
    return `<div class="wrap"><h1 class="page-h">${U.menu.search}</h1>
      <input id="q" class="search" type="search" placeholder="${U.searchPh}" value="${esc(q || "")}" autocomplete="off">
      <div id="res" class="grid" style="margin-top:16px">${searchResults(q)}</div></div>`;
  }
  function notFound() {
    return `<div class="wrap"><div class="card empty"><p class="big-e">📖</p><h2>${U.notFound}</h2><p><a class="btn" href="#/">${U.home}</a></p></div></div>`;
  }

  // ---------- Uma página do caderno ----------
  function renderPage(id, n) {
    const c = cadOf(id); if (!c) return notFound();
    if (lockedMod(modOf(c.m))) return renderModule(c.m);
    n = Math.max(1, Math.min(c.pages.length, +n || 1));
    const key = pk(c, n), dn = has(state.done, key), hasAns = ["silabe", "fatiat", "continuare", "litera", "grup", "completa", "cacap", "frases", "texto", "compune"].includes(c.pages[n - 1].type);
    return `<div class="wrap wide"><a class="back no-print" href="#/c/${c.id}">${U.back} · ${c.e} ${esc(c.t)}</a>
      <div class="pg-head no-print"><b>${lbl(U.page, n)}</b> / ${c.pages.length}</div>
      <div class="sheet-tools no-print">
        <button class="btn" data-print>${U.print}</button>
        <button class="btn ghost${dn ? " on" : ""}" data-done="${key}">${dn ? U.isDone : U.done}</button>
        ${hasAns ? `<button class="btn ghost" data-ans>${U.showAns}</button>` : ""}
      </div>
      <div class="sheet-fit">${sheet(c, n)}</div>
      <div class="dl no-print">${dlPage(c, n)}${dlAll(c)}</div>
      <div class="pager no-print">${n > 1 ? `<a class="btn ghost" href="#/c/${c.id}/${n - 1}">${U.prev}</a>` : "<span></span>"}${n < c.pages.length ? `<a class="btn ghost" href="#/c/${c.id}/${n + 1}">${U.next}</a>` : ""}</div>
    </div>`;
  }
  function renderPrintAll(id) {
    const c = cadOf(id); if (!c) return notFound();
    if (lockedMod(modOf(c.m))) return renderModule(c.m);
    return `<div class="wrap wide"><a class="back no-print" href="#/c/${c.id}">${U.back} · ${c.e} ${esc(c.t)}</a>
      <div class="card tip no-print">${U.printing}</div>
      <div class="sheet-tools no-print"><button class="btn" data-print>${U.printAll}</button>${dlAll(c)}</div>
      <div class="print-all">${c.pages.map((p, i) => `<div class="sheet-fit">${sheet(c, i + 1)}</div>`).join("")}</div></div>`;
  }

  // ---------- Desenho das folhas (A4 794×1123 em pé, 1123×794 deitada) ----------
  // Modelos novos: o miolo vai num bloco que encolhe sozinho se passar da folha (fitSheets).
  const FIT = ["litera", "grup", "cmp", "cacap", "frs", "txt", "wr", "gd", "lst", "wk", "tl", "tc"];
  function frame(c, n, inner, cls = "", head = true) {
    return `<article class="sheet ${cls}">
      ${head ? `<div class="s-namebar"><span>${U.name}: <i></i></span><span>${U.date}: <i class="short"></i></span></div>` : ""}
      ${FIT.includes(cls) ? `<div class="s-body">${inner}</div>` : inner}
      <div class="s-foot"><span>${esc(K.name)} · ${esc(c.t)}</span><span>${n}</span></div>
    </article>`;
  }
  // Títulos dos exercícios no idioma (iguais em todas as fichas, como no original).
  const EXT = {
    hu: { mc: "Jelöld a helyes választ!", fill: "Pótold a hiányzó szótagot!", split: "Bontsd szótagokra!", open: "Válaszolj!", rewrite: "Írd le a mondatot!", search: "Keresd meg a szavakat!" },
    bg: { mc: "Отбележи верния отговор.", fill: "Допиши сричката, която липсва.", split: "Раздели на срички.", open: "Отговори.", rewrite: "Препиши изречението.", search: "Намери думите." },
    cs: { mc: "Označ správnou odpověď.", fill: "Doplň chybějící slabiku.", split: "Rozděl na slabiky.", open: "Odpověz.", rewrite: "Opiš větu.", search: "Najdi slova." },
    lv: { mc: "Atzīmē pareizo atbildi.", fill: "Ieraksti trūkstošo zilbi.", split: "Sadali vārdus zilbēs.", open: "Atbildi.", rewrite: "Pārraksti teikumu.", search: "Atrodi vārdus." },
    lt: { mc: "Pažymėk teisingą atsakymą.", fill: "Įrašyk trūkstamą skiemenį.", split: "Suskirstyk skiemenimis.", open: "Atsakyk.", rewrite: "Perrašyk sakinį.", search: "Rask žodžius." },
    sk: { mc: "Označ správnu odpoveď.", fill: "Doplň chýbajúcu slabiku.", split: "Rozdeľ na slabiky.", open: "Odpovedz.", rewrite: "Prepíš vetu.", search: "Nájdi slová." },
    sr: { mc: "Označi tačan odgovor.", fill: "Dopiši slog koji nedostaje.", split: "Podeli na slogove.", open: "Odgovori.", rewrite: "Prepiši rečenicu.", search: "Pronađi reči." },
    ro: { mc: "Marchează răspunsul corect.", fill: "Completează silaba care lipsește.", split: "Desparte în silabe.", open: "Răspunde.", rewrite: "Copiază propoziția.", search: "Găsește cuvintele." }
  }[K.lang] || {};
  // Textos curtos das ferramentas e do diploma por idioma (o resto vem de data/<idioma>*.js).
  const LX = {
    hu: { abc: "AÁBCDEÉFGHIÍJKLMNOÓÖŐPRSTUÚÜŰVZ", games: "6 játék a kártyákkal", cls: "Osztály", yr: "Tanév", dip: "egyedül elolvasta az első meséjét." },
    bg: { abc: "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЮЯ", games: "6 игри с картите", cls: "Клас", yr: "Учебна година", dip: "прочете сам(а) първата си приказка." },
    cs: { abc: "AÁBCČDĎEÉĚFGHIÍJKLMNŇOÓPRŘSŠTŤUÚŮVYÝZŽ", games: "6 her s kartičkami", cls: "Třída", yr: "Školní rok", dip: "přečetl(a) sám/sama svou první pohádku." },
    lv: { abc: "AĀBCČDEĒFGĢHIĪJKĶLĻMNŅOPRSŠTUŪVZŽ", games: "6 spēles ar kartītēm", cls: "Klase", yr: "Mācību gads", dip: "pats (pati) izlasīja savu pirmo stāstu." },
    lt: { abc: "AĄBCČDEĘĖFGHIĮYJKLMNOPRSŠTUŲŪVZŽ", games: "6 žaidimai su kortelėmis", cls: "Klasė", yr: "Mokslo metai", dip: "pats (pati) perskaitė savo pirmąją pasakėlę." },
    sk: { abc: "AÁÄBCČDĎEÉFGHIÍJKLĽMNŇOÓÔPRSŠTŤUÚVYÝZŽ", games: "6 hier s kartičkami", cls: "Trieda", yr: "Školský rok", dip: "prečítal(a) sám/sama svoju prvú rozprávku." },
    sr: { abc: "ABCČĆDĐEFGHIJKLMNOPRSŠTUVZŽ", games: "6 igara sa karticama", cls: "Razred", yr: "Školska godina", dip: "samostalno je pročitao/la svoju prvu priču." },
    ro: { abc: "AĂÂBCDEFGHIÎJLMNOPRSȘTȚUVZ", games: "6 jocuri cu cartonașele", cls: "Clasa", yr: "An școlar", dip: "a citit singur prima poveste." }
  }[K.lang] || {};
  const R = {
    cover(c, n, p) {
      return frame(c, n, `<div class="cv-in"><div class="cv-kit">${esc(K.name)}</div>
        <h1 class="cv-t">${esc(p.t)}</h1><p class="cv-sub">${esc(p.sub)}</p>
        <div class="cv-img">${pic(p.img, p.land ? "wide" : "")}</div>
        <div class="cv-name">${U.name}: <i></i></div></div>`, `cover${p.land ? " land" : ""}`, false);
    },
    intro(c, n, p) {
      return frame(c, n, `<div class="in-box"><h2 class="s-title">${esc(p.t)}</h2><p class="in-text">${esc(p.text)}</p></div>
        <div class="in-img">${pic(p.img)}</div>`, "intro", false);
    },
    end(c, n, p) {
      return frame(c, n, `<div class="end-in"><div class="end-star">☆</div><h2>${esc(p.t)}</h2><p>${esc(p.text)}</p>
        <div class="end-img">${pic(p.img, p.land ? "wide" : "")}</div></div>`, `end${p.land ? " land" : ""}`, false);
    },
    silabe(c, n, p) {
      return frame(c, n, `<h2 class="s-title deco">${esc(c.t)}</h2><p class="s-task center">${esc(p.task)}</p>
        <div class="sil-rows">${p.rows.map(r => `<div class="sil-row">${pic(r.img, p.bw ? "bw" : "")}
          <div class="boxes">${r.syl.map(s => `<span class="box"><em class="ans">${esc(s.toUpperCase())}</em></span>`).join("")}</div>
          <div class="bubble">${r.mix.map(s => `<span>${esc(s.toUpperCase())}</span>`).join("")}</div></div>`).join("")}</div>`, p.bw ? "bwpage" : "");
    },
    slide(c, n, p) {
      const line = l => l.split(" ").map(w => `<span class="w">${w.split("·").map(s => `<b>${esc(s)}</b>`).join("")}</span>`).join("");
      return frame(c, n, `<div class="sl-in"><div class="sl-text">${p.lines.map(l => `<div class="sl-line">${line(l)}</div>`).join("")}</div>
        <div class="sl-img">${pic(p.img, "wide")}</div></div>`, "land slide", false);
    },
    lectura(c, n, p) {
      return frame(c, n, `<div class="lec-img">${pic(p.img)}</div><h2 class="lec-t">${esc(p.title)}</h2>
        <div class="lec-lines">${p.lines.map(l => `<p>${esc(l)}</p>`).join("")}</div>`, "ruled", false);
    },
    litera(c, n, p) {
      return frame(c, n, `<div class="lit-top"><div class="lit-big">${esc(p.big)}</div><p class="s-task">${esc(p.task)}</p></div>
        <div class="lit-grid">${p.items.map(it => `<div class="lit-it${it.yes ? " yes" : ""}">${pic(it.img, "bw")}<span class="lw">${esc(it.word)}</span></div>`).join("")}</div>
        <p class="s-task">${U.traceT}</p>
        <div class="trace">${p.trace.map(l => `<svg viewBox="0 0 700 120" class="tr-row">${[0, 1, 2, 3, 4, 5].map(k => `<text x="${30 + k * 112}" y="98" class="${k ? "dash" : "solid"}">${esc(l)}</text>`).join("")}<line x1="0" y1="100" x2="700" y2="100"/><line x1="0" y1="52" x2="700" y2="52" class="mid"/></svg>`).join("")}</div>`, "litera");
    },
    grup(c, n, p) {
      return frame(c, n, `<h2 class="s-title cmp-t">${esc(p.t)}</h2><div class="grp-fam">${p.groups.map(g => `<span>${esc(g)}</span>`).join("")}</div>
        <p class="grp-rule">${esc(p.rule)}</p><p class="s-task">${esc(p.task1)}</p>
        <div class="grp-words"><div class="gw-col">${p.words.map(x => `<span>${dots(x)}</span>`).join("")}</div></div>
        <p class="s-task">${esc(p.task2)}</p>
        <div class="grp-fill">${p.fill.map(x => `<span>${gapw(x.w, x.a)}</span>`).join("")}</div>
        <div class="grp-sent">📖 ${esc(p.sentence)}</div>`, "grup");
    },
    completa(c, n, p) {
      return frame(c, n, `<h2 class="s-title cmp-t">${esc(p.t)}</h2><p class="s-task">${esc(p.task)}</p>
        ${p.chips && p.chips.length ? `<div class="cmp-chips">${p.chips.map(x => `<span>${esc(x)}</span>`).join("")}</div>` : ""}
        <div class="cmp-grid">${p.items.map(it => `<div class="cmp-it">${pic(it.img)}<div class="cmp-w" style="font-size:${it.w.length > 22 ? 22 : it.w.length > 16 ? 26 : it.w.length > 11 ? 31 : 38}px">${gapw(it.w, it.a)}</div></div>`).join("")}</div>`, "cmp");
    },
    cacap(c, n, p) {
      return frame(c, n, `<h2 class="s-title cmp-t">${esc(p.t)}</h2><p class="s-task">${esc(p.task)}</p>
        ${wordSearch(p.words, `${c.id}${n}`, 10, true)}
        <div class="cac-pics">${p.imgs.map((k, i) => `<div class="cac-p">${pic(k)}<span class="cw"><em class="ans">${esc(p.words[i])}</em></span></div>`).join("")}</div>`, "cacap");
    },
    frases(c, n, p) {
      return frame(c, n, `<h2 class="s-title cmp-t">${esc(p.t)}</h2><p class="s-task">${esc(p.task1)}</p>
        <div class="frs-list">${p.sentences.map(s => `<p>${esc(s)}</p>`).join("")}</div>
        <p class="s-task">${esc(p.task2)}</p>
        <div class="frs-fix">${p.fix.map(x => `<div class="fx"><span class="w">${esc(x.w)}</span><span class="line"><em class="ans">${esc(x.a)}</em></span></div>`).join("")}</div>
        <p class="s-task">${esc(p.task3)}</p>
        <div class="frs-ord">${p.order.map(x => `<div class="od"><div class="chips">${x.w.map(w => `<span>${esc(w)}</span>`).join("")}</div><span class="line"><em class="ans">${esc(x.a)}</em></span></div>`).join("")}</div>`, "frs");
    },
    texto(c, n, p) {
      return frame(c, n, `<h2 class="s-title cmp-t">${esc(p.t)}</h2>
        <div class="txt-info">${p.info.map(x => `<div class="ti"><b>${esc(x.h)}</b><p>${esc(x.p)}</p></div>`).join("")}</div>
        <div class="txt-model"><div class="tm-h">${esc(p.model.t)}</div>${p.model.lines.map(l => `<p>${esc(l)}</p>`).join("")}</div>
        <div class="txt-q">${p.q.map((x, j) => `<p class="q">${j + 1}) ${esc(x.q)}</p><p class="line"><em class="ans">${esc(x.a)}</em></p>`).join("")}</div>
        <div class="txt-write"><div class="tw-h">${esc(p.write.task)}</div>${'<p class="line"></p>'.repeat(p.write.n)}</div>`, "txt");
    },
    compune(c, n, p) {
      let body;
      if (p.kind === "completa") {
        let k = 0;
        const text = esc(p.text).replace(/___/g, () => `<b class="gap long"><em class="ans">${esc(p.answers[k++])}</em></b>`);
        body = `<div class="cmp-text">${text}</div><div class="cmp-bank">${p.bank.map(w => `<span>${esc(w)}</span>`).join("")}</div><div class="wr-lines">${'<p class="line"></p>'.repeat(4)}</div>`;
      } else if (p.kind === "imagem") {
        body = `<div class="cmp-pic">${pic(p.img, "wide")}</div><p class="cmp-prompt">${esc(p.prompt)}</p><div class="wr-lines">${'<p class="line"></p>'.repeat(p.n)}</div>`;
      } else {
        body = `<div class="rot-grid">${p.fields.map(f => `<div class="rf"><b>${esc(f.l)}</b><p class="line"></p><p class="line"></p></div>`).join("")}</div><div class="wr-lines">${'<p class="line"></p>'.repeat(p.n)}</div>`;
      }
      return frame(c, n, `<h2 class="s-title cmp-t">${esc(p.t)}</h2><p class="s-task">${esc(p.task)}</p>${body}`, "wr");
    },
    continuare(c, n, p) {
      const line = l => esc(l).replace(/·/g, '<i class="dot">·</i>');
      return frame(c, n, `<h2 class="s-title cont-t">${esc(p.title)}</h2>
        <div class="cont-img">${pic(p.img, "wide")}</div>
        <div class="cont-lines">${p.lines.map(l => `<p>${line(l)}</p>`).join("")}</div>
        <div class="cont-q"><div class="cq-h">${EXT.open}</div>${p.q.map((x, j) => `<p class="q">${"abc"[j]}) ${esc(x.q)}</p><p class="line"><em class="ans">${esc(x.a)}</em></p>`).join("")}</div>`, "cont");
    },
    ghid(c, n, p) {
      return frame(c, n, `<div class="gd-k">${esc(p.kicker)}</div><h2 class="s-title cmp-t">${esc(p.t)}</h2>
        <div class="gd-blocks">${p.blocks.map(b => `<div class="gd-b"><b>${esc(b.h)}</b><p>${esc(b.p)}</p></div>`).join("")}</div>
        <div class="gd-steps">${p.steps.map((x, i) => `<div class="gd-s"><span>${i + 1}</span><p>${esc(x)}</p></div>`).join("")}</div>
        <div class="gd-pr"><div class="gd-prh">${esc(p.practice.h)}</div><div class="gd-chips">${p.practice.items.map(x => `<span>${esc(x)}</span>`).join("")}</div></div>
        <div class="gd-sign">✅ ${esc(p.sign)}</div>`, "gd");
    },
    lista(c, n, p) {
      return frame(c, n, `<h2 class="s-title cmp-t">${esc(p.t)}</h2><p class="lst-in">${esc(p.intro)}</p>
        <div class="lst-items">${p.items.map((x, i) => `<div class="lst-it"><span class="lst-n">${i + 1}</span><div><b>${esc(x.h)}</b><p>${esc(x.p)}</p></div><i class="lst-box"></i></div>`).join("")}</div>`, "lst");
    },
    semana(c, n, p) {
      return frame(c, n, `<h2 class="s-title cmp-t">${esc(p.t)}</h2><p class="lst-in">${esc(p.intro)}</p>
        <div class="wk-rows">${p.rows.map(x => `<div class="wk-r"><span class="wk-d">${esc(x.d)}</span><p>${esc(x.a)}</p><i class="lst-box"></i></div>`).join("")}</div>
        <div class="wk-tip">💡 ${esc(p.tip)}</div>`, "wk");
    },
    fatiat(c, n, p) {
      const opts = e => e.o.map((o, j) => `<p class="opt">(<b class="ob"><em class="ans">${j === e.a ? "X" : ""}</em></b>) ${esc(o)}</p>`).join("");
      const ex = p.ex.map((e, i) => {
        let b = "";
        if (e.k === "mc") b = e.img ? `<div class="ex-row">${pic(e.img, "sm")}<div><p class="q">${esc(e.q)}</p>${opts(e)}</div></div>` : `<p class="q">${esc(e.q)}</p>${opts(e)}`;
        if (e.k === "fill") b = `<div class="ex-row">${pic(e.img, "sm")}<div><p class="w">${e.syl.map((s, j) => j === e.gap ? `<span class="gapw"><em class="ans">${esc(s.toUpperCase())}</em></span>` : esc(s.toUpperCase())).join(" ")}</p>${opts(e)}</div></div>`;
        if (e.k === "split") b = e.w.map(w => `<div class="split">${pic(w.img, "xs")}<span class="sw">${esc(w.word.toUpperCase())}</span><span class="sb">${w.syl.map(s => `<i class="box s"><em class="ans">${esc(s)}</em></i>`).join("+")}</span></div>`).join("");
        if (e.k === "open") b = e.q.map((q, j) => `<p class="q">${"abc"[j]}) ${esc(q)}</p><p class="line"></p>`).join("");
        if (e.k === "rewrite") b = `<p class="q">${esc(e.s)}</p><p class="line"></p><p class="line"></p>`;
        if (e.k === "search") b = wordSearch(e.words, `${c.id}${n}`);
        return `<div class="ex"><div class="ex-h"><span class="ex-n">${i + 1}</span>${esc(EXT[e.k] || "")}</div>${b}</div>`;
      }).join("");
      const tiles = p.sentences.map(s => s.split(" ").map(w => `<span class="tile">${w.split("·").map(esc).join('<i class="bar-s">|</i>')}</span>`).join("")).join("");
      return frame(c, n, `<h2 class="s-title fat-t">${esc(p.title)}</h2>
        <div class="fat-top"><div class="fat-img">${pic(p.img)}</div><div><p class="s-task">📖 ${esc(p.task)}</p><div class="tiles">${tiles}</div></div></div>
        <div class="ex-grid">${ex}</div>`, "dense");
    }
  };
  // Caça-palavras 8×8 determinístico (horizontal e vertical), letras de enchimento do próprio idioma.
  function wordSearch(words, seed, N = 8, big = false) {
    let h = 0; for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => (h = (Math.imul(h, 1103515245) + 12345) >>> 0) / 4294967296;
    const G = Array.from({ length: N }, () => Array(N).fill(""));
    for (const w of words.map(x => [...x]).filter(x => x.length <= N)) {
      for (let t = 0; t < 300; t++) {
        const v = rnd() < 0.5, r = Math.floor(rnd() * (v ? N - w.length + 1 : N)), c0 = Math.floor(rnd() * (v ? N : N - w.length + 1));
        if (w.every((ch, i) => { const x = G[v ? r + i : r][v ? c0 : c0 + i]; return !x || x === ch; })) { w.forEach((ch, i) => { G[v ? r + i : r][v ? c0 : c0 + i] = ch; }); break; }
      }
    }
    const fill = LX.abc;
    const cells = G.map(row => row.map(x => `<span>${x || fill[Math.floor(rnd() * fill.length)]}</span>`).join("")).join("");
    if (big) return `<div class="ws big" style="grid-template-columns:repeat(${N},1fr)">${cells}</div>`;
    return `<div class="ws">${cells}</div>
      <p class="ws-w">${words.map(esc).join(" · ")}</p>`;
  }
  function sheet(c, n) { const p = c.pages[n - 1]; return R[p.type](c, n, p); }
  function thumb(c, n) { return `<div class="mini">${sheet(c, n)}</div>`; }


  // ---------- Ferramentas imprimíveis: cartonașe de silabe e fișa clasei ----------
  const TL = window.TOOLS || {};
  const toolDl = id => `<a class="btn ghost dl-btn" href="pdf/${K.lang}/${id}.pdf" download="${fname(K.name, id === "carti" ? K.gifts.find(g => g.id === "carti").t : K.gifts.find(g => g.id === "clasa").t)}">${U.dlAll}</a>`;
  function tsheet(g, n, inner, cls) {
    return `<article class="sheet ${cls}"><div class="s-body">${inner}</div><div class="s-foot"><span>${esc(K.name)} · ${esc(g.t)}</span><span>${n}</span></div></article>`;
  }
  function renderCarti(g, head) {
    const T = TL.carti; if (!T) return notFound();
    const sh = [];
    sh.push(tsheet(g, 1, `<h2 class="s-title cmp-t">${esc(T.how.t)}</h2><p class="lst-in">${esc(T.how.text)}</p>
      <div class="gd-steps">${T.how.steps.map((x, i) => `<div class="gd-s"><span>${i + 1}</span><p>${esc(x)}</p></div>`).join("")}</div>
      <h3 class="tl-h3">🎲 ${esc(T.gamesT || LX.games)}</h3>
      <div class="tl-games">${T.games.map(x => `<div class="tl-g"><b>${esc(x.h)}</b><p>${esc(x.p)}</p></div>`).join("")}</div>`, "tl"));
    T.pages.forEach((p, i) => sh.push(tsheet(g, i + 2, `<div class="tc-t">✂️ ${esc(p.t)}</div>
      <div class="tc-grid">${p.rows.map(r => r.syl.map(x => `<div class="tc-c">${esc(x)}</div>`).join("")).join("")}</div>`, "tc")));
    sh.push(tsheet(g, T.pages.length + 2, `<h2 class="s-title cmp-t">${esc(T.words.t)}</h2><p class="lst-in">${esc(T.words.intro)}</p>
      <div class="tl-words">${T.words.items.map(x => `<span>${dots(x)}</span>`).join("")}</div>`, "tl"));
    return `<div class="wrap wide">${head}<div class="sheet-tools no-print"><button class="btn" data-print>${U.printAll}</button>${toolDl("carti")}</div>
      <div class="card tip no-print">${U.printing}</div>
      <div class="print-all">${sh.map(x => `<div class="sheet-fit">${x}</div>`).join("")}</div></div>`;
  }
  function renderClasa(g, head) {
    const T = TL.clasa; if (!T) return notFound();
    const hu = K.lang === "hu", S = T.sheet, G = T.groups;
    const rows = Array.from({ length: 20 }, (_, i) => `<tr><td class="n">${i + 1}</td><td></td>${S.cols.map(() => "<td></td>").join("")}<td></td><td></td></tr>`).join("");
    const one = `<div class="tc-top"><h2 class="s-title cmp-t">${esc(S.t)}</h2><span class="tc-sub">${esc(S.sub)}</span>
        <span class="tc-meta">${LX.cls}: <i></i> &nbsp; ${LX.yr}: <i class="short"></i></span></div>
      <table class="tc-tab"><thead><tr><th class="n">#</th><th class="nm">${U.name}</th>${S.cols.map(c => `<th class="sk"><span>${esc(c)}</span></th>`).join("")}<th class="gr">${esc(S.group)}</th><th class="obs">${esc(S.notes)}</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="tc-leg">${esc(S.legend)}</p>`;
    const two = `<h2 class="s-title cmp-t">${esc(G.t)}</h2><p class="lst-in">${esc(G.intro)}</p>
      <table class="tg-tab"><tbody>${G.rows.map(r => `<tr><th>${esc(r.g)}</th><td><b>${esc(r.who)}</b></td><td>${esc(r.nb)}</td><td>${esc(r.routine)}</td></tr>`).join("")}</tbody></table>
      <div class="tg-week">${G.week.map(d => `<div><b>${esc(d.d)}</b><p>${esc(d.a)}</p></div>`).join("")}</div>
      <div class="wk-tip">💡 ${esc(G.tip)}</div>`;
    const sh = [tsheet(g, 1, one, "tc land tcl"), tsheet(g, 2, two, "tc land tcg")];
    return `<div class="wrap wide">${head}<div class="sheet-tools no-print"><button class="btn" data-print>${U.printAll}</button>${toolDl("clasa")}</div>
      <div class="card tip no-print">${U.printing}</div>
      <div class="print-all">${sh.map(x => `<div class="sheet-fit">${x}</div>`).join("")}</div></div>`;
  }

  // ---------- Presentes ----------
  function renderGift(id) {
    const g = K.gifts.find(x => x.id === id); if (!g) return notFound();
    if (g.soon) return `<div class="wrap"><a class="back" href="#/cadouri">${U.back}</a><div class="card empty"><p class="big-e">${g.e}</p><h2>${esc(g.t)}</h2><p class="muted">${U.inPrep} · ${U.inPrepP}</p></div></div>`;
    if (id === "plan") { location.hash = "#/plan"; return ""; }
    if (id === "ghid") { location.hash = "#/ghid"; return ""; }
    const head = `<a class="back no-print" href="#/cadouri">${U.back}</a>`;
    const foot = `<div class="s-foot"><span>${esc(K.name)}</span><span>${esc(g.t)}</span></div>`;
    if (id === "test") {
      const T = K.test;
      const page = `<article class="sheet"><div class="s-namebar"><span>${U.name}: <i></i></span><span>${U.date}: <i class="short"></i></span></div>
        <h2 class="s-title" style="margin-top:18px">${esc(g.t)}</h2><p class="s-task">${esc(T.intro)}</p>
        ${T.steps.map(s => `<div class="test-step"><h3>${esc(s.t)}</h3><div class="test-items">${s.items.map(x => `<span>${esc(x)}</span>`).join("")}</div></div>`).join("")}${foot}</article>`;
      return `<div class="wrap wide">${head}<div class="sheet-tools no-print"><button class="btn" data-print>${U.print}</button></div>
        <div class="card tip no-print"><p><b>${U.testWhere}</b></p><div class="test-pick">
        ${T.steps.map(s => `<button class="btn ghost" data-go="${s.go}">${esc(s.t)}</button>`).join("")}<button class="btn ghost" data-go="${T.allGo}">✓ ${U.testAll}</button></div>
        <p id="testRes" class="lead"></p></div><div class="sheet-fit">${page}</div></div>`;
    }
    if (id === "carti") return renderCarti(g, head);
    if (id === "clasa") return renderClasa(g, head);
    if (id === "diploma") {
      return `<div class="wrap wide">${head}<div class="sheet-tools no-print"><input id="child" class="search" placeholder="${U.diplomaName}" value="${esc(state.child)}"><button class="btn" data-print>${U.print}</button></div>
        <div class="sheet-fit"><article class="sheet diploma"><div class="dip-in"><div class="dip-e">🏅</div><h2>${esc(g.t)}</h2>
        <p class="dip-name" id="dipName">${esc(state.child) || "&nbsp;"}</p><p class="dip-p">${LX.dip}</p>
        <div class="dip-sign"><span>${U.date}: ______________</span><span>${esc(K.name)}</span></div></div></article></div></div>`;
    }
    return notFound();
  }

  // ---------- Escala da folha na tela ----------
  function fitSheets() {
    document.querySelectorAll(".sheet-fit, .mini").forEach(box => {
      const s = box.querySelector(".sheet"); if (!s) return;
      const body = s.querySelector(".s-body");
      if (body) { body.style.zoom = ""; if (body.scrollHeight > body.clientHeight + 1) body.style.zoom = Math.max(0.6, (body.clientHeight - 2) / body.scrollHeight); }
      const land = s.classList.contains("land"), W = land ? 1123 : 794, H = land ? 794 : 1123;
      const sc = box.clientWidth / W;
      s.style.transform = `scale(${sc})`;
      box.style.height = (H * sc) + "px";
    });
  }

  // ---------- Router ----------
  function route() {
    const r = location.hash.replace(/^#\/?/, "");
    const [a, b, c] = r.split("/");
    let html;
    if (!a) html = renderHome();
    else if (a === "module") html = renderModules();
    else if (a === "modul") html = renderModule(b);
    else if (a === "caiete") html = renderNotebooks();
    else if (a === "c") html = c ? renderPage(b, c) : renderNotebook(b);
    else if (a === "tipar") html = renderPrintAll(b);
    else if (a === "plan") html = renderPlan();
    else if (a === "cadouri") html = renderGifts();
    else if (a === "cadou") html = renderGift(b);
    else if (a === "ghid") html = renderGuide();
    else if (a === "ajutor") html = renderHelp();
    else if (a === "cauta") html = renderSearch(decodeURIComponent(b || ""));
    else html = notFound();
    if (html === "") return;
    view.innerHTML = html;
    $("#sidebar").innerHTML = navHTML(r);
    $("#tabbar").innerHTML = tabbarHTML(r);
    document.body.classList.remove("menu-open");
    const nb = (a === "c" || a === "tipar") && cadOf(b);
    document.title = nb ? `${nb.t} — ${K.name}` : U.title;
    window.scrollTo(0, 0);
    // Tamanho do papel conforme a folha na tela: a história em sílabas é deitada, o resto em pé.
    $("#pageSize").textContent = view.querySelector(".sheet-fit .sheet.land") ? "@page { size: A4 landscape; margin: 0; }" : "@page { size: A4; margin: 0; }";
    requestAnimationFrame(fitSheets);
    // A fonte do texto carrega depois e muda as alturas: refaz o ajuste quando ela chegar.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => requestAnimationFrame(fitSheets));
    const q = $("#q");
    if (q) {
      q.focus(); q.setSelectionRange(q.value.length, q.value.length);
      q.addEventListener("input", () => { history.replaceState(null, "", "#/cauta/" + encodeURIComponent(q.value)); $("#res").innerHTML = searchResults(q.value); });
    }
    const ch = $("#child");
    if (ch) ch.addEventListener("input", () => { state.child = ch.value; save(); $("#dipName").textContent = ch.value || " "; });
  }

  // Imprime só depois que as imagens carregaram (o caderno inteiro tem dezenas).
  function printWhenReady() {
    // Na prévia publicada como artifact o navegador bloqueia a impressão: avisa em vez de não fazer nada.
    if (window.ALFA_PREVIEW) { toast(window.ALFA_PREVIEW); return; }
    const imgs = [...document.querySelectorAll("#view .sheet-fit img")];
    imgs.forEach(i => { i.loading = "eager"; });
    fitSheets();
    Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))).then(() => window.print());
  }

  document.addEventListener("click", e => {
    const t = e.target.closest("[data-print],[data-done],[data-ans],[data-plan],[data-go],#menuBtn,#scrim");
    if (!t) return;
    if (t.id === "menuBtn" || t.id === "scrim") { document.body.classList.toggle("menu-open"); return; }
    if (t.hasAttribute("data-print")) { printWhenReady(); return; }
    if (t.dataset.done) {
      const on = toggle(state.done, t.dataset.done);
      if (on && !has(state.plan, t.dataset.done) && planList().some(([c, n]) => pk(c, n) === t.dataset.done)) { state.plan.push(t.dataset.done); save(); }
      t.textContent = on ? U.isDone : U.done; t.classList.toggle("on", on); toast(U.copied); return;
    }
    if (t.hasAttribute("data-ans")) {
      const on = document.body.classList.toggle("show-ans");
      t.textContent = on ? U.hideAns : U.showAns; return;
    }
    if (t.dataset.plan) {
      const on = toggle(state.plan, t.dataset.plan);
      if (on && !has(state.done, t.dataset.plan)) { state.done.push(t.dataset.plan); save(); }
      route(); return;
    }
    if (t.dataset.go) {
      const c = cadOf(t.dataset.go) || CAD[0];
      $("#testRes").innerHTML = `${U.recommend} <a href="#/c/${c.id}"><b>${c.e} ${esc(c.t)}</b> →</a>`;
    }
  });
  window.addEventListener("hashchange", () => { document.body.classList.remove("show-ans"); route(); });
  window.addEventListener("resize", fitSheets);
  route();
})();
