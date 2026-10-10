// Drawing board shared by tabs 1 (Plan), 2 (Layout) and 3 (Final).
// All geometry is stored in millimetres. The canvas converts to pixels with view.zoom (px per mm).
(function () {
  var ODD = window.ODD = window.ODD || {};
  var SQFT = 10.7639;
  ODD.SQFT = SQFT;

  var S = ODD.state = { underlay: null, walls: [], rooms: [], furniture: [], locked: false, nextId: 1, stripped: false };
  var view = { ox: 40, oy: 40, zoom: 0.05 };
  var tool = "pan";
  var draft = [];
  var cursor = null;
  var selId = null;
  var drag = null;
  var spaceDown = false;
  var imgEl = null;
  var canvas, ctx, dpr = 1, statusEl;

  function $(id) { return document.getElementById(id); }
  function uid() { return S.nextId++; }
  function toWorld(px, py) { return { x: (px - view.ox) / view.zoom, y: (py - view.oy) / view.zoom }; }
  function toScreen(p) { return { x: view.ox + p.x * view.zoom, y: view.oy + p.y * view.zoom }; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  // ---------- saving ----------
  function persist() {
    try { localStorage.setItem("odd_project", JSON.stringify(S)); S.stripped = false; return; } catch (e) {}
    try {
      var lite = JSON.parse(JSON.stringify(S));
      if (lite.underlay) lite.underlay.dataUrl = null;
      lite.rooms.forEach(function (r) { r.images = []; });
      lite.stripped = true;
      localStorage.setItem("odd_project", JSON.stringify(lite));
      S.stripped = true;
      say("Images are too big to save in the browser. Your drawing is saved, but use Export project (Final tab) to keep the images.");
    } catch (e2) {}
  }
  function load() {
    try {
      var raw = localStorage.getItem("odd_project");
      if (!raw) return;
      var d = JSON.parse(raw);
      ["underlay", "walls", "rooms", "furniture", "locked", "nextId", "stripped"].forEach(function (k) { if (k in d) S[k] = d[k]; });
      S.rooms.forEach(function (r) { if (!r.images) r.images = []; if (r.tier == null) r.tier = 1; });
      if (S.underlay && S.underlay.dataUrl) setImage(S.underlay.dataUrl);
      else if (S.underlay) { S.underlay = null; say("The plan image was not saved. Please upload it again."); }
    } catch (e) {}
  }

  function say(msg) { if (statusEl) statusEl.textContent = msg; }
  function changed() { persist(); draw(); if (ODD.refreshUI) ODD.refreshUI(); }

  // ---------- plan image ----------
  function setImage(url, cb) {
    var im = new Image();
    im.onload = function () { imgEl = im; draw(); if (cb) cb(im); };
    im.src = url;
  }
  function shrink(url, maxPx, quality, cb) {
    var im = new Image();
    im.onload = function () {
      var k = Math.min(1, maxPx / Math.max(im.width, im.height));
      var c = document.createElement("canvas");
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      var cx = c.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, c.width, c.height);
      cx.drawImage(im, 0, 0, c.width, c.height);
      cb(c.toDataURL("image/jpeg", quality), c.width, c.height);
    };
    im.src = url;
  }
  function readFile(file, cb) { var fr = new FileReader(); fr.onload = function () { cb(fr.result); }; fr.readAsDataURL(file); }

  function useUnderlay(dataUrl) {
    shrink(dataUrl, 2400, 0.9, function (url, w, h) {
      S.underlay = { dataUrl: url, w: w, h: h, scale: 10000 / w };
      setImage(url, function () { fitView(); say("Plan loaded at a guessed size. Next: click 'Set scale', then click two points whose real distance you know."); changed(); });
    });
  }
  ODD.loadPlanFile = function (file) {
    if (!file) return;
    if (/pdf$/i.test(file.type) || /\.pdf$/i.test(file.name)) {
      say("Reading the PDF...");
      loadPdfJs(function (lib) {
        if (!lib) { say("Could not load the PDF reader (needs internet). Export the page as JPG or PNG and upload that instead."); return; }
        var fr = new FileReader();
        fr.onload = function () {
          lib.getDocument({ data: new Uint8Array(fr.result) }).promise.then(function (pdf) { return pdf.getPage(1); }).then(function (page) {
            var vp = page.getViewport({ scale: 2 });
            var c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height;
            return page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise.then(function () { useUnderlay(c.toDataURL("image/png")); });
          }).catch(function () { say("Could not read that PDF. Export the page as JPG or PNG and upload that instead."); });
        };
        fr.readAsArrayBuffer(file);
      });
    } else { readFile(file, useUnderlay); }
  };
  var pdfLib = null;
  function loadPdfJs(cb) {
    if (pdfLib) return cb(pdfLib);
    var s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = function () {
      pdfLib = window.pdfjsLib;
      if (pdfLib) pdfLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      cb(pdfLib);
    };
    s.onerror = function () { cb(null); };
    document.head.appendChild(s);
  }

  // ---------- view ----------
  function fitView() {
    var b = bounds();
    if (!b) { view.zoom = 0.05; view.ox = 40; view.oy = 40; return; }
    var w = canvas.clientWidth, h = canvas.clientHeight;
    var z = Math.min((w - 60) / Math.max(b.w, 1), (h - 60) / Math.max(b.h, 1));
    view.zoom = z; view.ox = 30 - b.x * z; view.oy = 30 - b.y * z;
  }
  function bounds() {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    function add(x, y) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (S.underlay) { add(0, 0); add(S.underlay.w * S.underlay.scale, S.underlay.h * S.underlay.scale); }
    S.walls.forEach(function (w) { w.pts.forEach(function (p) { add(p.x, p.y); }); });
    S.rooms.forEach(function (r) { r.pts.forEach(function (p) { add(p.x, p.y); }); });
    S.furniture.forEach(function (f) { add(f.x - f.w / 2, f.y - f.d / 2); add(f.x + f.w / 2, f.y + f.d / 2); });
    if (x0 === Infinity) return null;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  function resize() {
    if (!canvas) return;
    dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr));
    draw();
  }

  // ---------- drawing ----------
  function draw() {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);

    if (imgEl && S.underlay) {
      ctx.globalAlpha = 0.5;
      ctx.drawImage(imgEl, view.ox, view.oy, S.underlay.w * S.underlay.scale * view.zoom, S.underlay.h * S.underlay.scale * view.zoom);
      ctx.globalAlpha = 1;
    }
    // 1 m grid when zoomed in enough
    if (view.zoom * 1000 > 18) {
      ctx.strokeStyle = "rgba(0,0,0,0.06)"; ctx.lineWidth = 1; ctx.beginPath();
      var a = toWorld(0, 0), b = toWorld(W, H);
      for (var gx = Math.floor(a.x / 1000) * 1000; gx < b.x; gx += 1000) { var sx = view.ox + gx * view.zoom; ctx.moveTo(sx, 0); ctx.lineTo(sx, H); }
      for (var gy = Math.floor(a.y / 1000) * 1000; gy < b.y; gy += 1000) { var sy = view.oy + gy * view.zoom; ctx.moveTo(0, sy); ctx.lineTo(W, sy); }
      ctx.stroke();
    }

    S.rooms.forEach(function (r) {
      ctx.beginPath();
      r.pts.forEach(function (p, i) { var s = toScreen(p); if (i) ctx.lineTo(s.x, s.y); else ctx.moveTo(s.x, s.y); });
      ctx.closePath();
      ctx.fillStyle = "rgba(200,85,61,0.12)"; ctx.fill();
      ctx.strokeStyle = "#c8553d"; ctx.lineWidth = 1.5; ctx.stroke();
      var c = centroid(r.pts), sc = toScreen(c);
      ctx.fillStyle = "#7a2f1f"; ctx.font = "bold 12px Arial"; ctx.textAlign = "center";
      ctx.fillText(r.name, sc.x, sc.y - 2);
      ctx.font = "11px Arial"; ctx.fillText((ODD.areaOf(r.pts) / 1e6 * SQFT).toFixed(0) + " sqft", sc.x, sc.y + 12);
    });

    ctx.strokeStyle = "#1c1b19"; ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.lineCap = "round";
    S.walls.forEach(function (w) {
      ctx.beginPath();
      w.pts.forEach(function (p, i) { var s = toScreen(p); if (i) ctx.lineTo(s.x, s.y); else ctx.moveTo(s.x, s.y); });
      ctx.stroke();
    });

    S.furniture.forEach(function (f) {
      var s = toScreen(f), w = f.w * view.zoom, d = f.d * view.zoom;
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(f.rot * Math.PI / 180);
      ctx.fillStyle = f.id === selId ? "rgba(47,125,79,0.35)" : "rgba(70,90,140,0.22)";
      ctx.strokeStyle = f.id === selId ? "#2f7d4f" : "#3b4a78"; ctx.lineWidth = f.id === selId ? 2.5 : 1.5;
      ctx.fillRect(-w / 2, -d / 2, w, d); ctx.strokeRect(-w / 2, -d / 2, w, d);
      if (w > 46 && d > 14) {
        ctx.fillStyle = "#20284a"; ctx.font = "10px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(f.name, 0, 0);
        ctx.textBaseline = "alphabetic";
      }
      ctx.restore();
    });

    if (draft.length) {
      ctx.strokeStyle = tool === "calibrate" ? "#2f7d4f" : "#c8553d"; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.beginPath();
      draft.forEach(function (p, i) { var s = toScreen(p); if (i) ctx.lineTo(s.x, s.y); else ctx.moveTo(s.x, s.y); });
      if (cursor && tool !== "calibrate") { var cs = toScreen(cursor); ctx.lineTo(cs.x, cs.y); }
      else if (cursor && tool === "calibrate" && draft.length === 1) { var c2 = toScreen(cursor); ctx.lineTo(c2.x, c2.y); }
      ctx.stroke(); ctx.setLineDash([]);
      draft.forEach(function (p) { var s = toScreen(p); ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, 6.3); ctx.fill(); });
    }
  }
  function centroid(pts) { var x = 0, y = 0; pts.forEach(function (p) { x += p.x; y += p.y; }); return { x: x / pts.length, y: y / pts.length }; }

  // ---------- geometry helpers ----------
  function inPoly(pt, pts) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var a = pts[i], b = pts[j];
      if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }
  ODD.inPoly = inPoly;
  function segDist(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    var t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }
  function hitFurniture(w) {
    for (var i = S.furniture.length - 1; i >= 0; i--) {
      var f = S.furniture[i], a = -f.rot * Math.PI / 180;
      var dx = w.x - f.x, dy = w.y - f.y;
      var lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(lx) <= f.w / 2 && Math.abs(ly) <= f.d / 2) return f;
    }
    return null;
  }
  function snapPoint(w, shift) {
    var best = null, bd = 12 / view.zoom;
    function test(p) { var d = dist(p, w); if (d < bd) { bd = d; best = p; } }
    S.walls.forEach(function (x) { x.pts.forEach(test); });
    S.rooms.forEach(function (x) { x.pts.forEach(test); });
    draft.forEach(test);
    if (best) return { x: best.x, y: best.y };
    if (shift && draft.length) {
      var l = draft[draft.length - 1];
      return Math.abs(w.x - l.x) > Math.abs(w.y - l.y) ? { x: w.x, y: l.y } : { x: l.x, y: w.y };
    }
    return w;
  }

  // ---------- tools ----------
  ODD.setTool = function (t) {
    tool = t; draft = []; cursor = null;
    if (t !== "select") selId = null;
    var hints = {
      pan: "Drag to move the plan. Scroll to zoom.",
      calibrate: "Click the two ends of something you know the real length of (a wall, a door).",
      wall: "Click along the wall. Double-click or Enter to finish. Hold Shift for straight lines. Esc cancels.",
      room: "Click the corners of the room. Double-click, Enter, or click the first point to close it.",
      erase: "Click a wall line or inside a room to delete it.",
      select: "Click a piece to select it, drag to move. R rotates 90 degrees. Delete removes it."
    };
    say(hints[t] || "");
    document.querySelectorAll("[data-tool]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-tool") === t); });
    var cp = $("calPanel"); if (cp) cp.hidden = true;
    canvas.style.cursor = t === "pan" ? "grab" : "crosshair";
    draw();
  };
  ODD.getTool = function () { return tool; };
  ODD.getView = function () { return view; };

  function finishPoly() {
    var pts = draft.filter(function (p, i) { return i === 0 || dist(p, draft[i - 1]) > 1; });
    if (tool === "wall" && pts.length >= 2) { S.walls.push({ id: uid(), pts: pts }); }
    else if (tool === "room" && pts.length >= 3) {
      S.rooms.push({ id: uid(), name: "Room " + (S.rooms.length + 1), pts: pts, tier: 1, images: [] });
    }
    draft = []; changed();
  }

  function onDown(e) {
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    var rect = canvas.getBoundingClientRect(), px = e.clientX - rect.left, py = e.clientY - rect.top;
    var w = toWorld(px, py);
    if (e.button === 1 || spaceDown || tool === "pan") { drag = { type: "pan", sx: px, sy: py, ox: view.ox, oy: view.oy }; canvas.style.cursor = "grabbing"; return; }
    if (e.button !== 0) return;

    if (tool === "calibrate") {
      draft.push(w);
      if (draft.length === 2) {
        var px2 = dist(draft[0], draft[1]);
        if (px2 < 1) { draft = []; return; }
        $("calPanel").hidden = false; $("calDist").focus();
        say("Now type the real distance between those two points and press Apply scale.");
      }
      draw(); return;
    }
    if (tool === "wall" || tool === "room") {
      var p = snapPoint(w, e.shiftKey);
      if (tool === "room" && draft.length >= 3 && dist(p, draft[0]) < 14 / view.zoom) { finishPoly(); return; }
      draft.push(p); draw(); return;
    }
    if (tool === "erase") {
      var thr = 8 / view.zoom, done = false;
      for (var i = S.walls.length - 1; i >= 0 && !done; i--) {
        var pts = S.walls[i].pts;
        for (var k = 0; k < pts.length - 1; k++) if (segDist(w, pts[k], pts[k + 1]) < thr) { S.walls.splice(i, 1); done = true; break; }
      }
      if (!done) for (var j = S.rooms.length - 1; j >= 0; j--) if (inPoly(w, S.rooms[j].pts)) { S.rooms.splice(j, 1); done = true; break; }
      if (done) changed();
      return;
    }
    if (tool === "select") {
      if (S.locked) { say("The final layout is locked. Unlock it in the Final tab to change furniture."); return; }
      var f = hitFurniture(w);
      selId = f ? f.id : null;
      if (f) drag = { type: "move", id: f.id, dx: w.x - f.x, dy: w.y - f.y };
      if (ODD.refreshUI) ODD.refreshUI(); draw();
    }
  }
  function onMove(e) {
    var rect = canvas.getBoundingClientRect(), px = e.clientX - rect.left, py = e.clientY - rect.top;
    var w = toWorld(px, py);
    if (drag && drag.type === "pan") { view.ox = drag.ox + (px - drag.sx); view.oy = drag.oy + (py - drag.sy); draw(); return; }
    if (drag && drag.type === "move") {
      var f = byId(drag.id); if (!f) return;
      var nx = w.x - drag.dx, ny = w.y - drag.dy;
      if ($("snapGrid") && $("snapGrid").checked) { nx = Math.round(nx / 50) * 50; ny = Math.round(ny / 50) * 50; }
      f.x = nx; f.y = ny; draw(); return;
    }
    if (tool === "wall" || tool === "room" || tool === "calibrate") { cursor = snapPoint(w, e.shiftKey); if (draft.length) draw(); }
  }
  function onUp() {
    if (drag && drag.type === "move") { changed(); }
    if (drag && drag.type === "pan") canvas.style.cursor = tool === "pan" ? "grab" : "crosshair";
    drag = null;
  }
  function onWheel(e) {
    e.preventDefault();
    var rect = canvas.getBoundingClientRect(), px = e.clientX - rect.left, py = e.clientY - rect.top;
    var before = toWorld(px, py), k = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    view.zoom = Math.max(0.002, Math.min(2, view.zoom * k));
    view.ox = px - before.x * view.zoom; view.oy = py - before.y * view.zoom; draw();
  }
  function byId(id) { for (var i = 0; i < S.furniture.length; i++) if (S.furniture[i].id === id) return S.furniture[i]; return null; }

  // ---------- scale ----------
  ODD.applyScale = function () {
    if (draft.length !== 2) { say("Click two points first."); return; }
    var val = parseFloat($("calDist").value), unit = $("calUnit").value;
    if (!(val > 0)) { say("Type the real distance first."); return; }
    var mm = unit === "m" ? val * 1000 : unit === "ft" ? val * 304.8 : val;
    var k = mm / dist(draft[0], draft[1]);
    if (S.underlay) S.underlay.scale *= k;
    function sc(p) { p.x *= k; p.y *= k; }
    S.walls.forEach(function (x) { x.pts.forEach(sc); });
    S.rooms.forEach(function (x) { x.pts.forEach(sc); });
    S.furniture.forEach(function (f) { f.x *= k; f.y *= k; });
    draft = []; $("calPanel").hidden = true; $("calDist").value = "";
    fitView(); say("Scale set. Now trace the walls and mark the rooms."); ODD.setTool("pan"); changed();
  };

  // ---------- furniture ----------
  ODD.addFurniture = function (item) {
    if (S.locked) { say("The final layout is locked. Unlock it in the Final tab to change furniture."); return; }
    var c = toWorld(canvas.clientWidth / 2, canvas.clientHeight / 2);
    var f = { id: uid(), key: item.key || "custom", name: item.name, w: item.w, d: item.d, x: c.x, y: c.y, rot: 0 };
    S.furniture.push(f); selId = f.id; ODD.setTool("select"); changed();
  };
  ODD.selected = function () { return byId(selId); };
  ODD.rotateSel = function () { var f = byId(selId); if (f && !S.locked) { f.rot = (f.rot + 90) % 360; changed(); } };
  ODD.deleteSel = function () { if (S.locked) return; var f = byId(selId); if (f) { S.furniture.splice(S.furniture.indexOf(f), 1); selId = null; changed(); } };
  ODD.dupSel = function () {
    var f = byId(selId); if (!f || S.locked) return;
    var n = JSON.parse(JSON.stringify(f)); n.id = uid(); n.x += 300; n.y += 300; S.furniture.push(n); selId = n.id; changed();
  };

  // ---------- misc ----------
  ODD.fit = function () { fitView(); draw(); };
  ODD.redraw = function () { resize(); };
  ODD.save = changed;
  ODD.say = say;
  ODD.shrink = shrink;
  ODD.readFile = readFile;
  ODD.attach = function (box) { box.appendChild($("boardBox")); setTimeout(resize, 0); };
  ODD.resetAll = function () {
    S.underlay = null; S.walls = []; S.rooms = []; S.furniture = []; S.locked = false; imgEl = null; draft = []; selId = null;
    changed();
  };
  ODD.replaceState = function (d) {
    ["underlay", "walls", "rooms", "furniture", "locked", "nextId"].forEach(function (k) { if (k in d) S[k] = d[k]; });
    S.rooms.forEach(function (r) { if (!r.images) r.images = []; if (r.tier == null) r.tier = 1; });
    imgEl = null;
    if (S.underlay && S.underlay.dataUrl) setImage(S.underlay.dataUrl, function () { fitView(); draw(); });
    else { S.underlay = null; fitView(); }
    changed();
  };

  ODD.initBoard = function () {
    canvas = $("board"); ctx = canvas.getContext("2d"); statusEl = $("boardStatus");
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("dblclick", function () { if (tool === "wall" || tool === "room") finishPoly(); });
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", function (e) {
      var tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.code === "Space") { spaceDown = true; e.preventDefault(); return; }
      if (e.key === "Enter" && (tool === "wall" || tool === "room")) finishPoly();
      else if (e.key === "Escape") { draft = []; selId = null; draw(); if (ODD.refreshUI) ODD.refreshUI(); }
      else if ((e.key === "Delete" || e.key === "Backspace") && selId) { e.preventDefault(); ODD.deleteSel(); }
      else if ((e.key === "r" || e.key === "R") && selId) ODD.rotateSel();
    });
    window.addEventListener("keyup", function (e) { if (e.code === "Space") spaceDown = false; });
    load();
    ODD.setTool("pan");
    resize();
    if (S.underlay || S.walls.length || S.rooms.length) setTimeout(function () { fitView(); draw(); }, 50);
  };
})();
