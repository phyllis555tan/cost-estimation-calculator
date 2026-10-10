// Read-only client view. Gets one shared project through the get_shared_project function (layout only, never prices).
(function () {
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
  function msg(t, bad) { $("msg").hidden = false; $("msg").textContent = t; $("msg").className = "vmsg" + (bad ? " bad" : ""); $("content").hidden = true; }

  var SQFT = 10.7639, TIERS = ["Basic", "Standard", "Premium"];
  function area(pts) { var a = 0; for (var i = 0; i < pts.length; i++) { var p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; } return Math.abs(a) / 2; }
  function inPoly(pt, pts) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var a = pts[i], b = pts[j];
      if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }

  function draw(board) {
    var cv = $("vcanvas"), dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    var ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    var x0 = 1e12, y0 = 1e12, x1 = -1e12, y1 = -1e12;
    function ext(x, y) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    (board.walls || []).forEach(function (w) { w.pts.forEach(function (p) { ext(p.x, p.y); }); });
    (board.rooms || []).forEach(function (r) { r.pts.forEach(function (p) { ext(p.x, p.y); }); });
    (board.furniture || []).forEach(function (f) { ext(f.x - f.w / 2, f.y - f.d / 2); ext(f.x + f.w / 2, f.y + f.d / 2); });
    if (x0 > x1) { return; }
    var z = Math.min((W - 40) / (x1 - x0), (H - 40) / (y1 - y0)), ox = (W - (x1 - x0) * z) / 2 - x0 * z, oy = (H - (y1 - y0) * z) / 2 - y0 * z;
    function sx(p) { return { x: ox + p.x * z, y: oy + p.y * z }; }
    (board.rooms || []).forEach(function (r) {
      ctx.beginPath(); r.pts.forEach(function (p, i) { var s = sx(p); if (i) ctx.lineTo(s.x, s.y); else ctx.moveTo(s.x, s.y); }); ctx.closePath();
      ctx.fillStyle = "rgba(200,85,61,0.10)"; ctx.fill();
      var cx = 0, cy = 0; r.pts.forEach(function (p) { cx += p.x; cy += p.y; }); var c = sx({ x: cx / r.pts.length, y: cy / r.pts.length });
      ctx.fillStyle = "#7a2f1f"; ctx.font = "bold 12px Arial"; ctx.textAlign = "center"; ctx.fillText(r.name, c.x, c.y - 2);
      ctx.font = "11px Arial"; ctx.fillText((area(r.pts) / 1e6 * SQFT).toFixed(0) + " sqft", c.x, c.y + 12);
    });
    ctx.strokeStyle = "#1c1b19"; ctx.lineWidth = 3; ctx.lineJoin = "round";
    (board.walls || []).forEach(function (w) { ctx.beginPath(); w.pts.forEach(function (p, i) { var s = sx(p); if (i) ctx.lineTo(s.x, s.y); else ctx.moveTo(s.x, s.y); }); ctx.stroke(); });
    (board.furniture || []).forEach(function (f) {
      var s = sx(f), w = f.w * z, d = f.d * z;
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(f.rot * Math.PI / 180);
      ctx.fillStyle = "rgba(70,90,140,0.22)"; ctx.strokeStyle = "#3b4a78"; ctx.lineWidth = 1.5; ctx.fillRect(-w / 2, -d / 2, w, d); ctx.strokeRect(-w / 2, -d / 2, w, d);
      if (w > 46 && d > 14) { ctx.fillStyle = "#20284a"; ctx.font = "10px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(f.name, 0, 0); }
      ctx.restore();
    });
  }

  function rooms(board) {
    var list = board.rooms || [];
    if (!list.length) { $("vRooms").innerHTML = ""; return; }
    $("vRooms").innerHTML = list.map(function (r) {
      var inside = (board.furniture || []).filter(function (f) { return inPoly({ x: f.x, y: f.y }, r.pts); });
      var counts = {}; inside.forEach(function (f) { counts[f.name] = (counts[f.name] || 0) + 1; });
      var furn = Object.keys(counts).map(function (k) { return counts[k] + " x " + esc(k); }).join(", ") || "No furniture placed";
      var imgs = (r.images || []).filter(function (u) { return /^data:image\/(jpeg|png|webp);base64,/.test(u); })
        .map(function (u) { return '<img src="' + u + '" alt="Mood board for ' + esc(r.name) + '">'; }).join("");
      return '<div class="panel vroom"><h3>' + esc(r.name) + "</h3><p>" + (area(r.pts) / 1e6).toFixed(1) + " sqm / " + (area(r.pts) / 1e6 * SQFT).toFixed(0) + " sqft &middot; Finish: " + esc(TIERS[r.tier] || "Standard") + "</p><p>" + furn + "</p>" +
        (imgs ? '<div class="vthumbs">' + imgs + "</div>" : "") + "</div>";
    }).join("");
  }

  function render(data) {
    var board = data.board || {};
    $("msg").hidden = true; $("content").hidden = false;
    $("vTitle").textContent = data.name || "Design layout";
    $("vSub").textContent = "Last updated " + new Date(data.updated_at).toLocaleDateString("en-MY");
    draw(board); rooms(board);
    window.addEventListener("resize", function () { draw(board); });
  }

  var token = new URLSearchParams(location.search).get("t") || "";
  var cfg = window.ODD_CONFIG || {};
  window.ODD_viewerRender = render;
  if (!/^[a-f0-9]{32,128}$/.test(token)) { msg("This link is not valid. Please ask ODD STUDIO for a new one.", true); return; }
  if (!cfg.url || !cfg.anonKey || !window.supabase) { msg("This page is not connected yet. Please contact ODD STUDIO.", true); return; }
  window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false } }).rpc("get_shared_project", { t: token }).then(function (r) {
    if (r.error) { msg("Could not load this layout. Please try again later.", true); return; }
    if (!r.data) { msg("This link is no longer active. Please ask ODD STUDIO for a new one.", true); return; }
    render(r.data);
  });
})();
