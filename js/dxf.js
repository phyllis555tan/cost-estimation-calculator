// DXF writer (R12 style, widely compatible). Units: millimetres.
// Layers: WALLS, ROOMS, FURNITURE, TEXT. Canvas Y points down, DXF Y points up, so Y is flipped.
(function () {
  var ODD = window.ODD = window.ODD || {};

  function ascii(s) { return String(s).replace(/[^\x20-\x7E]/g, "?"); }

  function toDXF(S) {
    var out = [];
    function g(code, val) { out.push(String(code)); out.push(String(val)); }

    var layers = [["WALLS", 7], ["ROOMS", 3], ["FURNITURE", 5], ["TEXT", 2]];

    g(0, "SECTION"); g(2, "HEADER"); g(9, "$ACADVER"); g(1, "AC1009"); g(0, "ENDSEC");

    g(0, "SECTION"); g(2, "TABLES");
    g(0, "TABLE"); g(2, "LAYER"); g(70, layers.length);
    layers.forEach(function (l) { g(0, "LAYER"); g(2, l[0]); g(70, 0); g(62, l[1]); g(6, "CONTINUOUS"); });
    g(0, "ENDTAB"); g(0, "ENDSEC");

    g(0, "SECTION"); g(2, "ENTITIES");

    function polyline(pts, layer, closed) {
      if (pts.length < 2) return;
      g(0, "POLYLINE"); g(8, layer); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, closed ? 1 : 0);
      pts.forEach(function (p) { g(0, "VERTEX"); g(8, layer); g(10, p.x.toFixed(2)); g(20, (-p.y).toFixed(2)); g(30, 0); });
      g(0, "SEQEND"); g(8, layer);
    }
    function text(x, y, h, str) {
      g(0, "TEXT"); g(8, "TEXT"); g(10, x.toFixed(2)); g(20, (-y).toFixed(2)); g(30, 0); g(40, h); g(1, ascii(str));
    }
    function centroid(pts) {
      var cx = 0, cy = 0; pts.forEach(function (p) { cx += p.x; cy += p.y; });
      return { x: cx / pts.length, y: cy / pts.length };
    }

    (S.walls || []).forEach(function (w) { polyline(w.pts, "WALLS", false); });

    (S.rooms || []).forEach(function (r) {
      polyline(r.pts, "ROOMS", true);
      var c = centroid(r.pts);
      text(c.x, c.y, 150, r.name + "  " + (ODD.areaOf(r.pts) / 1e6).toFixed(1) + " sqm");
    });

    (S.furniture || []).forEach(function (f) {
      var a = f.rot * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
      var hw = f.w / 2, hd = f.d / 2;
      var corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(function (c) {
        return { x: f.x + c[0] * cs - c[1] * sn, y: f.y + c[0] * sn + c[1] * cs };
      });
      polyline(corners, "FURNITURE", true);
      text(f.x - hw * 0.8, f.y, 80, f.name + " " + f.w + "x" + f.d);
    });

    g(0, "ENDSEC"); g(0, "EOF");
    return out.join("\r\n") + "\r\n";
  }

  ODD.areaOf = function (pts) {
    var a = 0;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], q = pts[(i + 1) % pts.length];
      a += p.x * q.y - q.x * p.y;
    }
    return Math.abs(a) / 2;
  };
  ODD.toDXF = toDXF;
})();
