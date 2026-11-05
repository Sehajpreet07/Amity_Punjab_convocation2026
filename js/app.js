(() => {
  "use strict";

  const C = window.CONVOCATION_CONFIG || {};
  const STUDENTS = window.CONVOCATION_STUDENTS || [];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const norm = (v) => String(v ?? "").toUpperCase().replace(/[\s\-_/]/g, "");
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ordinal = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

  const byEnrollment = new Map(STUDENTS.map((s) => [norm(s.enrollment), s]));

  // config text
  $$("[data-cfg]").forEach((el) => { if (C[el.dataset.cfg] != null) el.textContent = C[el.dataset.cfg]; });
  $$("[data-cfg-src]").forEach((el) => { if (C[el.dataset.cfgSrc]) el.src = C[el.dataset.cfgSrc]; });
  if (C.eventTitle) document.title = `${C.eventTitle} · Seat Finder`;
  if (C.exampleEnrollment) $("#enr").placeholder = `e.g. ${C.exampleEnrollment}`;
  if (C.demo) {
    $("#demoBadge").hidden = false;
    const demo = byEnrollment.get(norm(C.exampleEnrollment)) || STUDENTS[0];
    if (demo) {
      const t = $("#tryDemo");
      t.hidden = false;
      $("b", t).textContent = demo.enrollment;
      t.addEventListener("click", () => { $("#enr").value = demo.enrollment; lookup(demo.enrollment); });
    }
  }

  // hall layout
  const hall = buildHall();

  function buildHall() {
    const cfg = C.hall || {};
    const blocks = (cfg.blocks || []).map((b) => ({ ...b, id: String(b.id).toUpperCase() }));
    // grow blocks if the data has more rows/seats than the config
    for (const s of STUDENTS) {
      const id = String(s.block).toUpperCase();
      let b = blocks.find((x) => x.id === id);
      if (!b) { b = { id, rows: 0, seats: 0 }; blocks.push(b); }
      b.rows = Math.max(b.rows || 0, +s.row || 0);
      b.seats = Math.max(b.seats || 0, +s.seat || 0);
    }
    const gates = (cfg.gates && cfg.gates.length ? cfg.gates : [{ name: "Gate 1", position: "left" }, { name: "Gate 2", position: "right" }]);

    const P = { seatW: 10, seatH: 10, px: 14, py: 16, aisle: 44, side: 60 };
    let x = P.side;
    for (const b of blocks) { b.x = x; b.w = b.seats * P.px - (P.px - P.seatW); x += b.w + P.aisle; }
    const W = x - P.aisle + P.side;
    const maxRows = Math.max(1, ...blocks.map((b) => b.rows));
    const stage = { w: Math.min(560, W * 0.56), h: 70, y: 34 };
    stage.x = (W - stage.w) / 2;
    const labelY = stage.y + stage.h + 44;
    const rowsY = labelY + 16;
    const seatsBottom = rowsY + maxRows * P.py - (P.py - P.seatH);
    const crossY = seatsBottom + 30;
    const H = crossY + 64;

    blocks.forEach((b, i) => {
      b.leftAisle = i === 0 ? P.side / 2 : (blocks[i - 1].x + blocks[i - 1].w + b.x) / 2;
      b.rightAisle = i === blocks.length - 1 ? W - P.side / 2 : (b.x + b.w + blocks[i + 1].x) / 2;
    });
    const gatePos = (g) => ({ left: P.side / 2, right: W - P.side / 2, center: W / 2 }[g.position] ?? P.side / 2);
    gates.forEach((g) => { g.x = gatePos(g); });

    return { P, blocks, gates, W, H, stage, labelY, rowsY, crossY };
  }

  const seatX = (b, n) => b.x + (n - 1) * hall.P.px;
  const rowY = (r) => hall.rowsY + (r - 1) * hall.P.py;

  function gateFor(student, block) {
    const name = student.gate || (block && block.gate);
    return hall.gates.find((g) => norm(g.name) === norm(name)) ||
      hall.gates.slice().sort((a, b) => Math.abs(a.x - (block.x + block.w / 2)) - Math.abs(b.x - (block.x + block.w / 2)))[0];
  }

  // views & routing
  function switchView(id) {
    const next = $("#" + id);
    const cur = $(".view.is-active");
    if (cur === next) return;
    if (cur && !reduceMotion) {
      cur.classList.add("is-leaving");
      cur.classList.remove("is-active");
      setTimeout(() => { cur.classList.remove("is-leaving"); next.classList.add("is-active"); window.scrollTo(0, 0); }, 330);
    } else {
      cur && cur.classList.remove("is-active");
      next.classList.add("is-active");
      window.scrollTo(0, 0);
    }
  }

  function setUrl(enr) {
    try {
      const url = new URL(location.href);
      if (enr) url.searchParams.set("enr", enr); else url.searchParams.delete("enr");
      history.pushState({ enr }, "", url);
    } catch (_) { }
  }

  function route() {
    const enr = new URLSearchParams(location.search).get("enr");
    const s = enr && byEnrollment.get(norm(enr));
    if (s) showResult(s);
    else { switchView("welcome"); }
  }
  window.addEventListener("popstate", route);

  // search
  const form = $("#finder"), input = $("#enr"), msg = $("#finderMsg"), findBtn = $("#findBtn");

  input.addEventListener("input", () => {
    const pos = input.selectionStart;
    input.value = input.value.toUpperCase();
    try { input.setSelectionRange(pos, pos); } catch (_) {}
    form.classList.remove("has-error");
    msg.textContent = "";
  });
  form.addEventListener("submit", (e) => { e.preventDefault(); lookup(input.value); });

  function showError(text) {
    msg.textContent = text;
    form.classList.add("has-error");
    form.classList.remove("shake");
    void form.offsetWidth;
    form.classList.add("shake");
    input.focus();
  }

  function lookup(raw) {
    const enr = norm(raw);
    if (!enr) return showError("Please enter your enrollment number.");
    const s = byEnrollment.get(enr);
    if (!s) return showError(`We couldn't find "${raw.trim()}". Please check the number and try again.`);
    findBtn.classList.add("is-loading");
    findBtn.disabled = true;
    setTimeout(() => {
      findBtn.classList.remove("is-loading");
      findBtn.disabled = false;
      setUrl(s.enrollment);
      showResult(s);
    }, reduceMotion ? 0 : 700);
  }

  const goBack = () => { setUrl(null); switchView("welcome"); setTimeout(() => input.focus({ preventScroll: true }), 400); };
  $("#backBtn").addEventListener("click", goBack);
  $("#againBtn").addEventListener("click", () => { input.value = ""; goBack(); });

  // result
  let current = null;

  function showResult(s) {
    current = s;
    const block = hall.blocks.find((b) => b.id === String(s.block).toUpperCase());
    const gate = gateFor(s, block);
    const [first, ...rest] = String(s.name || "Graduate").trim().split(/\s+/);

    $("#rName").innerHTML = `<span class="first">${esc(first)}</span> ${esc(rest.join(" "))}`;
    $("#rEnr").textContent = s.enrollment;
    $("#rProgram").textContent = s.program || "";
    $("#rProgram").hidden = !s.program;
    $("#rCode").textContent = `${block.id}-${String(s.row).padStart(2, "0")}-${String(s.seat).padStart(2, "0")}`;
    $("#rBlock").textContent = block.id;
    $("#rRow").textContent = s.row;
    $("#rSeat").textContent = s.seat;
    $("#rGate").textContent = gate.name;

    switchView("result");

    setTimeout(() => {
      $$(".tval").forEach((el, i) => { el.classList.remove("pop"); void el.offsetWidth; el.style.animationDelay = i * 110 + "ms"; el.classList.add("pop"); });
      countUp($("#rRow"), +s.row);
      countUp($("#rSeat"), +s.seat);
      confetti();
    }, reduceMotion ? 0 : 380);

    renderSteps(s, block, gate);
    renderNotes();
    drawMap(s, block, gate);
  }

  function countUp(el, to) {
    if (reduceMotion || !to) { el.textContent = to; return; }
    const t0 = performance.now(), dur = 900;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = Math.max(1, Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function aisleSide(block, seat) { return seat <= Math.ceil(block.seats / 2) ? "left" : "right"; }

  function renderSteps(s, block, gate) {
    const side = aisleSide(block, s.seat);
    const fromSide = side === "left" ? s.seat : block.seats - s.seat + 1;
    const gateSide = { left: "left side", right: "right side", center: "centre" }[gate.position] || "back";
    const steps = [
      [`Enter through ${gate.name}`, `${gate.name} is at the back of the hall, on the ${gateSide}.`],
      [`Walk to Block ${block.id}`, `Take the aisle on the ${side} of Block ${block.id} and walk towards the stage.`],
      [`Stop at Row ${s.row}`, `Row ${s.row} is the ${ordinal(+s.row)} row from the stage.`],
      [`Take Seat ${s.seat}`, `Enter Row ${s.row} from the ${side} aisle. Your seat is the ${ordinal(fromSide)} seat from the ${side}.`],
      ["Settle in & celebrate", "You've earned this moment. Congratulations, graduate!"]
    ];
    $("#rSteps").innerHTML = steps.map(([t, d], i) => `<li style="--i:${i}"><div><b>${esc(t)}</b><span>${esc(d)}</span></div></li>`).join("");
  }

  function renderNotes() {
    $("#rNotes").innerHTML = (C.instructions || []).map((t) => `<li>${esc(t)}</li>`).join("");
  }

  // map
  const svg = $("#hallMap");
  let fullBox, seatFocus, viewAnim = null, zoomTimer = null, walkerAnim = null;

  function drawMap(s, block, gate) {
    const { P, blocks, W, H, stage, labelY, crossY } = hall;
    const myRow = +s.row, mySeat = +s.seat;
    const out = [];

    out.push(`<defs>
      <linearGradient id="stageGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#d9a521"/></linearGradient>
      <radialGradient id="seatGlow"><stop offset="0" stop-color="#ffe08a" stop-opacity=".9"/><stop offset="1" stop-color="#ffe08a" stop-opacity="0"/></radialGradient>
    </defs>`);
    out.push(`<rect class="m-hall" x="6" y="6" width="${W - 12}" height="${H - 12}" rx="22"/>`);

    // stage
    const sx = stage.x, sy = stage.y, sw = stage.w, sh = stage.h;
    out.push(`<path class="m-stage" d="M${sx + 24} ${sy} H${sx + sw - 24} Q${sx + sw} ${sy} ${sx + sw} ${sy + 24} V${sy + sh - 18} Q${W / 2} ${sy + sh + 16} ${sx} ${sy + sh - 18} V${sy + 24} Q${sx} ${sy} ${sx + 24} ${sy} Z"/>`);
    out.push(`<text class="m-stage-text" x="${W / 2 + 4}" y="${sy + sh / 2 + 4}" text-anchor="middle">STAGE</text>`);
    out.push(`<text class="m-stage-sub" x="${W / 2}" y="${sy + sh / 2 + 22}" text-anchor="middle">CONVOCATION</text>`);

    // blocks & seats
    for (const b of blocks) {
      const isMine = b === block;
      out.push(`<text class="m-block-label" x="${b.x + b.w / 2}" y="${labelY}" text-anchor="middle">BLOCK ${esc(b.id)}</text>`);
      for (let r = 1; r <= b.rows; r++) {
        const y = rowY(r);
        for (let n = 1; n <= b.seats; n++) {
          let cls = "m-seat";
          if (isMine && r === myRow) cls += n === mySeat ? " is-me" : " is-row";
          out.push(`<rect class="${cls}" x="${seatX(b, n)}" y="${y}" width="${P.seatW}" height="${P.seatH}" rx="2.5"/>`);
        }
      }
    }
    // row numbers
    const first = blocks[0], last = blocks[blocks.length - 1];
    const maxRows = Math.max(...blocks.map((b) => b.rows));
    for (let r = 1; r <= maxRows; r++) {
      const y = rowY(r) + P.seatH - 1.5, hot = r === myRow ? " is-row" : "";
      out.push(`<text class="m-row-label${hot}" x="${first.x - 8}" y="${y}" text-anchor="end">${r}</text>`);
      out.push(`<text class="m-row-label${hot}" x="${last.x + last.w + 8}" y="${y}">${r}</text>`);
      if (block !== first && block !== last && r === myRow) {
        out.push(`<text class="m-row-label is-row" x="${block.x - 6}" y="${y}" text-anchor="end">${r}</text>`);
        out.push(`<text class="m-row-label is-row" x="${block.x + block.w + 6}" y="${y}">${r}</text>`);
      }
    }

    // gates
    for (const g of hall.gates) {
      const mine = g === gate;
      out.push(`<rect class="m-gate" x="${g.x - 24}" y="${H - 10}" width="48" height="8" rx="3" opacity="${mine ? 1 : .55}"/>`);
      out.push(`<text class="m-gate-text" x="${g.x}" y="${H - 30}" text-anchor="middle" opacity="${mine ? 1 : .6}">${esc(g.name.toUpperCase())}</text>`);
      out.push(`<text class="m-gate-sub" x="${g.x}" y="${H - 18}" text-anchor="middle" opacity="${mine ? 1 : .6}">ENTRY</text>`);
    }

    // route
    const side = aisleSide(block, mySeat);
    const ax = side === "left" ? block.leftAisle : block.rightAisle;
    const cy = rowY(myRow) + P.seatH / 2;
    const cx = seatX(block, mySeat) + P.seatW / 2;
    const tx = side === "left" ? cx - P.seatW / 2 - 2 : cx + P.seatW / 2 + 2;
    const d = `M${gate.x} ${H - 12} V${crossY} H${ax} V${cy} H${tx}`;
    out.push(`<path class="m-route-glow" d="${d}"/>`);
    out.push(`<path class="m-route" id="route" d="${d}"/>`);
    out.push(`<circle class="m-walker" id="walker" r="4" cx="${gate.x}" cy="${H - 12}"/>`);

    // my seat highlight
    out.push(`<circle cx="${cx}" cy="${cy}" r="22" fill="url(#seatGlow)"/>`);
    out.push(`<circle class="m-pulse" cx="${cx}" cy="${cy}" r="10"/>`);
    out.push(`<circle class="m-pulse p2" cx="${cx}" cy="${cy}" r="10"/>`);
    out.push(`<rect class="m-seat is-me" x="${cx - P.seatW / 2}" y="${cy - P.seatH / 2}" width="${P.seatW}" height="${P.seatH}" rx="2.5"/>`);
    out.push(`<g class="m-pin"><path class="m-pin-body" d="M${cx} ${cy - 8} l-7 -9 a10 10 0 1 1 14 0 Z"/><text class="m-pin-text" x="${cx}" y="${cy - 21}" text-anchor="middle">${mySeat}</text></g>`);

    svg.innerHTML = out.join("");

    fullBox = [0, 0, W, H];
    seatFocus = { cx, cy, zw: Math.min(W, Math.max(block.w + P.aisle * 2 + 60, W * 0.36)) };
    $("#mapWrap").style.setProperty("--map-ar", (W / H).toFixed(3));
    svg.setAttribute("viewBox", fullBox.join(" "));
    setSeg("full");

    animateRoute();
    clearTimeout(zoomTimer);
    zoomTimer = setTimeout(() => zoomTo("seat"), reduceMotion ? 0 : 2600);
  }

  function animateRoute() {
    const path = $("#route"), walker = $("#walker");
    const len = path.getTotalLength();
    cancelAnimationFrame(walkerAnim);
    if (reduceMotion) { walker.remove(); return; }
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
    const t0 = performance.now() + 600, dur = 1900;
    const tick = (t) => {
      const p = Math.max(0, Math.min(1, (t - t0) / dur));
      const e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      path.style.strokeDashoffset = len * (1 - e);
      const pt = path.getPointAtLength(len * e);
      walker.setAttribute("cx", pt.x);
      walker.setAttribute("cy", pt.y);
      if (p < 1) walkerAnim = requestAnimationFrame(tick);
      else { path.style.strokeDasharray = "6 7"; path.style.strokeDashoffset = 0; path.style.animation = "dash 1.2s linear infinite"; walker.style.opacity = 0; }
    };
    walkerAnim = requestAnimationFrame(tick);
  }
  const dashStyle = document.createElement("style");
  dashStyle.textContent = "@keyframes dash{to{stroke-dashoffset:-13}}";
  document.head.appendChild(dashStyle);

  function seatBoxFor() {
    const { W, H } = hall, wrap = $("#mapWrap");
    const ar = wrap.clientWidth / wrap.clientHeight || W / H;
    const zw = seatFocus.zw, zh = Math.min(H, zw / ar);
    return [
      Math.max(0, Math.min(W - zw, seatFocus.cx - zw / 2)),
      Math.max(0, Math.min(H - zh, seatFocus.cy - zh * 0.58)),
      zw, zh
    ];
  }

  function setSeg(which) { $$(".seg-btn").forEach((b) => b.classList.toggle("is-on", b.dataset.zoom === which)); }

  function zoomTo(which) {
    clearTimeout(zoomTimer);
    setSeg(which);
    const to = which === "seat" ? seatBoxFor() : fullBox;
    const from = (svg.getAttribute("viewBox") || "").split(/\s+/).map(Number);
    cancelAnimationFrame(viewAnim);
    if (reduceMotion || from.length !== 4) { svg.setAttribute("viewBox", to.join(" ")); return; }
    const t0 = performance.now(), dur = 1100;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      svg.setAttribute("viewBox", from.map((v, i) => v + (to[i] - v) * e).join(" "));
      if (p < 1) viewAnim = requestAnimationFrame(tick);
    };
    viewAnim = requestAnimationFrame(tick);
  }
  $$(".seg-btn").forEach((b) => b.addEventListener("click", () => zoomTo(b.dataset.zoom)));

  // share
  function toast(text) {
    const t = $("#toast");
    t.textContent = text;
    t.classList.add("is-on");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("is-on"), 2200);
  }
  $("#shareBtn").addEventListener("click", async () => {
    if (!current) return;
    const s = current;
    const text = `${s.name} (${s.enrollment}) · ${C.eventTitle || "Convocation"}\nBlock ${s.block}, Row ${s.row}, Seat ${s.seat}`;
    const url = location.href;
    try {
      if (navigator.share) { await navigator.share({ title: C.eventTitle, text, url }); return; }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast("Seat details copied");
    } catch (e) {
      if (e && e.name !== "AbortError") toast("Couldn't share. Please take a screenshot instead.");
    }
  });

  // sparkles background
  (function sparkles() {
    const cv = $("#sparkles"), ctx = cv.getContext("2d");
    let w, h, dpr, parts = [];
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = cv.width = innerWidth * dpr; h = cv.height = innerHeight * dpr;
      const n = Math.round(Math.min(90, (innerWidth * innerHeight) / 14000));
      parts = Array.from({ length: n }, () => spawn(true));
    };
    const spawn = (anyY) => ({
      x: Math.random() * w, y: anyY ? Math.random() * h : h + 10,
      r: (Math.random() * 1.6 + .4) * dpr, vy: (Math.random() * .25 + .08) * dpr,
      vx: (Math.random() - .5) * .12 * dpr, tw: Math.random() * Math.PI * 2, ts: Math.random() * .03 + .01
    });
    resize();
    addEventListener("resize", resize);
    if (reduceMotion) {
      parts.forEach((p) => { ctx.fillStyle = "rgba(255,224,138,.5)"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); });
      return;
    }
    (function loop() {
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.y -= p.vy; p.x += p.vx; p.tw += p.ts;
        if (p.y < -10) Object.assign(p, spawn(false));
        const a = .25 + .55 * (0.5 + 0.5 * Math.sin(p.tw));
        ctx.fillStyle = `rgba(255,224,138,${a})`;
        ctx.shadowColor = "rgba(242,193,78,.8)"; ctx.shadowBlur = 6 * dpr;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      requestAnimationFrame(loop);
    })();
  })();

  // confetti
  function confetti() {
    if (reduceMotion) return;
    const cv = $("#confetti"), ctx = cv.getContext("2d");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.width = innerWidth * dpr, h = cv.height = innerHeight * dpr;
    const colors = ["#ffe08a", "#f2c14e", "#d9a521", "#ffffff", "#9ab8ff", "#fff3cc"];
    const pieces = [];
    const burst = (x, angle, n) => {
      for (let i = 0; i < n; i++) {
        const a = angle + (Math.random() - .5) * 1.1, sp = (Math.random() * 9 + 7) * dpr;
        pieces.push({ x, y: h * .9, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, s: (Math.random() * 6 + 5) * dpr,
          rot: Math.random() * 6, vr: (Math.random() - .5) * .35, c: colors[(Math.random() * colors.length) | 0],
          shape: Math.random() < .3 ? "circle" : "rect", flip: Math.random() * 6 });
      }
    };
    burst(w * .08, -Math.PI / 2 + .55, 90);
    burst(w * .92, -Math.PI / 2 - .55, 90);
    const t0 = performance.now();
    (function loop(t) {
      ctx.clearRect(0, 0, w, h);
      let alive = 0;
      for (const p of pieces) {
        p.vy += .22 * dpr; p.vx *= .99; p.vy *= .99;
        p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.flip += .12;
        if (p.y > h + 20) continue;
        alive++;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.cos(p.flip));
        ctx.fillStyle = p.c;
        if (p.shape === "circle") { ctx.beginPath(); ctx.arc(0, 0, p.s / 2.4, 0, 7); ctx.fill(); }
        else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (alive && t - t0 < 6000) requestAnimationFrame(loop); else ctx.clearRect(0, 0, w, h);
    })(t0);
  }

  // start
  route();
  if ($("#welcome").classList.contains("is-active")) setTimeout(() => input.focus({ preventScroll: true }), 900);
})();
