// Wires the tabs, the furniture library, the room list and the Final tab to the drawing board.
(function () {
  var ODD = window.ODD;
  var S = ODD.state;
  var TIERS = ["Basic", "Standard", "Premium"];

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
  function sqm(r) { return ODD.areaOf(r.pts) / 1e6; }
  function download(name, text, mime) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: mime || "text/plain" }));
    a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  function stamp() { return new Date().toISOString().slice(0, 10); }

  // ---------- tabs ----------
  var BOARD_PANES = { plan: "plan", layout: "select", final: "pan" };
  function showPane(name) {
    Array.prototype.forEach.call(document.querySelectorAll("#mainTabs button"), function (x) { x.classList.toggle("on", x.getAttribute("data-pane") === name); });
    Array.prototype.forEach.call(document.querySelectorAll(".tabpane"), function (p) { p.classList.toggle("on", p.id === "pane-" + name); });
    if (name in BOARD_PANES) {
      ODD.attach($("slot-" + name));
      var cur = ODD.getTool();
      if (name === "layout") ODD.setTool("select");
      else if (name === "final") ODD.setTool("pan");
      else if (cur === "select") ODD.setTool("pan");
      ODD.fit();
    }
    ODD.refreshUI();
  }
  Array.prototype.forEach.call(document.querySelectorAll("#mainTabs button"), function (b) {
    b.onclick = function () { showPane(b.getAttribute("data-pane")); };
  });

  // ---------- plan tab ----------
  $("planFile").onchange = function (e) { ODD.loadPlanFile(e.target.files[0]); e.target.value = ""; };
  Array.prototype.forEach.call(document.querySelectorAll("[data-tool]"), function (b) {
    b.onclick = function () { ODD.setTool(b.getAttribute("data-tool")); };
  });
  $("calApply").onclick = ODD.applyScale;
  $("calDist").onkeydown = function (e) { if (e.key === "Enter") ODD.applyScale(); };
  $("fitBtn").onclick = ODD.fit;
  $("fitBtn2").onclick = ODD.fit;
  $("clearAll").onclick = function () {
    if (confirm("Clear the plan, rooms and furniture? This cannot be undone.")) ODD.resetAll();
  };

  // ---------- layout tab ----------
  function buildLibrary() {
    var groups = {};
    window.ODD_FURNITURE.forEach(function (f) { (groups[f.group] = groups[f.group] || []).push(f); });
    $("lib").innerHTML = Object.keys(groups).map(function (g) {
      return '<div class="libgroup"><div class="libtitle">' + esc(g) + "</div>" + groups[g].map(function (f) {
        return '<button class="btn ghost small" data-key="' + f.key + '">' + esc(f.name) + '<span class="dim">' + f.w + "x" + f.d + "</span></button>";
      }).join("") + "</div>";
    }).join("");
    Array.prototype.forEach.call($("lib").querySelectorAll("button"), function (b) {
      b.onclick = function () {
        var it = window.ODD_FURNITURE.filter(function (f) { return f.key === b.getAttribute("data-key"); })[0];
        ODD.addFurniture(it);
      };
    });
  }
  $("customAdd").onclick = function () {
    var n = $("cName").value.trim() || "Custom item", w = parseFloat($("cW").value), d = parseFloat($("cD").value);
    if (!(w > 0 && d > 0)) { ODD.say("Type a width and depth in mm for the custom item."); return; }
    ODD.addFurniture({ key: "custom", name: n, w: w, d: d });
  };
  $("rotBtn").onclick = ODD.rotateSel;
  $("dupBtn").onclick = ODD.dupSel;
  $("delBtn").onclick = ODD.deleteSel;

  // ---------- exports ----------
  function exportDxf() {
    if (!S.walls.length && !S.rooms.length && !S.furniture.length) { ODD.say("Nothing to export yet. Trace a wall or add furniture first."); return; }
    download("ODD-STUDIO-layout-" + stamp() + ".dxf", ODD.toDXF(S), "application/dxf");
    ODD.say("DXF saved. Open it in AutoCAD, check the scale, then Save As DWG. Units are millimetres.");
  }
  ["dxfBtn1", "dxfBtn2", "dxfBtn3"].forEach(function (id) { $(id).onclick = exportDxf; });
  $("projExport").onclick = function () { download("ODD-STUDIO-project-" + stamp() + ".json", JSON.stringify(S), "application/json"); };
  $("projImport").onchange = function (e) {
    var f = e.target.files[0]; if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      try { ODD.replaceState(JSON.parse(fr.result)); } catch (err) { ODD.say("That file is not a valid project export."); }
    };
    fr.readAsText(f);
    e.target.value = "";
  };
  $("printBtn").onclick = function () { window.print(); };

  // ---------- lock ----------
  $("lockBtn").onclick = function () { S.locked = !S.locked; ODD.save(); };

  // ---------- rendering of lists ----------
  function furnitureInRoom(r) { return S.furniture.filter(function (f) { return ODD.inPoly({ x: f.x, y: f.y }, r.pts); }); }
  function counts(list) {
    var m = {}; list.forEach(function (f) { m[f.name] = (m[f.name] || 0) + 1; });
    return Object.keys(m).map(function (k) { return m[k] + " x " + esc(k); }).join(", ") || "no furniture placed";
  }

  function renderRoomList() {
    if (!S.rooms.length) { $("roomList").innerHTML = '<p class="note">No rooms yet. Use "Mark room" and click the corners of each room.</p>'; return; }
    $("roomList").innerHTML = S.rooms.map(function (r, i) {
      var a = sqm(r);
      return '<div class="roomrow"><input data-i="' + i + '" class="rname" value="' + esc(r.name) + '">' +
        '<span class="dim">' + a.toFixed(1) + " sqm / " + (a * ODD.SQFT).toFixed(0) + " sqft</span>" +
        '<button class="rm" data-del="' + i + '" title="Delete room">&times;</button></div>';
    }).join("");
    Array.prototype.forEach.call($("roomList").querySelectorAll(".rname"), function (inp) {
      inp.onchange = function () { S.rooms[Number(inp.getAttribute("data-i"))].name = inp.value || "Room"; ODD.save(); };
    });
    Array.prototype.forEach.call($("roomList").querySelectorAll("[data-del]"), function (b) {
      b.onclick = function () { S.rooms.splice(Number(b.getAttribute("data-del")), 1); ODD.save(); };
    });
  }

  function renderLayoutInfo() {
    var f = ODD.selected();
    $("selInfo").textContent = f ? f.name + ": " + f.w + " x " + f.d + " mm, rotated " + f.rot + " degrees" : "Nothing selected. Click a piece on the plan.";
    ["rotBtn", "dupBtn", "delBtn"].forEach(function (id) { $(id).disabled = !f || S.locked; });
    $("layoutCount").textContent = S.furniture.length ? "On the plan: " + counts(S.furniture) : "No furniture placed yet.";
    $("lockNote").hidden = !S.locked;
  }

  function renderFinal() {
    $("lockBtn").textContent = S.locked ? "Unlock layout" : "Lock final layout";
    $("lockState").textContent = S.locked ? "LOCKED: furniture cannot be changed until you unlock." : "Not locked yet. Lock it once the client agrees the layout.";
    $("lockState").className = "status " + (S.locked ? "ok" : "");
    if (!S.rooms.length) { $("finalRooms").innerHTML = '<p class="note">No rooms yet. Go to the Plan tab and mark the rooms.</p>'; return; }
    var total = 0;
    $("finalRooms").innerHTML = S.rooms.map(function (r, i) {
      var a = sqm(r); total += a;
      var tiers = TIERS.map(function (t, ti) { return '<option value="' + ti + '"' + (ti === r.tier ? " selected" : "") + ">" + t + "</option>"; }).join("");
      var thumbs = (r.images || []).map(function (u, k) {
        return '<span class="thumb"><img src="' + u + '" alt="Mood board image"><button data-rimg="' + i + ':' + k + '" title="Remove">&times;</button></span>';
      }).join("");
      return '<div class="panel finalroom"><h3>' + esc(r.name) + ' <span class="dim">' + a.toFixed(1) + " sqm / " + (a * ODD.SQFT).toFixed(0) + ' sqft</span></h3>' +
        "<p>Furniture: " + counts(furnitureInRoom(r)) + "</p>" +
        '<div class="grid"><div><label>Finish level</label><select data-tier="' + i + '">' + tiers + '</select></div>' +
        '<div class="noprint"><label>Add mood board images</label><input type="file" accept="image/*" multiple data-mood="' + i + '"></div></div>' +
        '<div class="thumbs">' + (thumbs || '<span class="note">No mood board images yet.</span>') + "</div></div>";
    }).join("");
    var loose = S.furniture.filter(function (f) { return !S.rooms.some(function (r) { return ODD.inPoly({ x: f.x, y: f.y }, r.pts); }); });
    $("finalRooms").innerHTML += '<p class="note">Total room area: ' + total.toFixed(1) + " sqm / " + (total * ODD.SQFT).toFixed(0) + " sqft." +
      (loose.length ? " " + loose.length + " furniture piece(s) are outside every room." : "") + "</p>";

    Array.prototype.forEach.call($("finalRooms").querySelectorAll("[data-tier]"), function (s) {
      s.onchange = function () { S.rooms[Number(s.getAttribute("data-tier"))].tier = Number(s.value); ODD.save(); };
    });
    Array.prototype.forEach.call($("finalRooms").querySelectorAll("[data-mood]"), function (inp) {
      inp.onchange = function () {
        var room = S.rooms[Number(inp.getAttribute("data-mood"))], files = Array.prototype.slice.call(inp.files), left = files.length;
        if (!left) return;
        files.forEach(function (f) {
          ODD.readFile(f, function (url) {
            ODD.shrink(url, 1200, 0.8, function (small) { room.images.push(small); if (--left === 0) ODD.save(); });
          });
        });
      };
    });
    Array.prototype.forEach.call($("finalRooms").querySelectorAll("[data-rimg]"), function (b) {
      b.onclick = function () { var p = b.getAttribute("data-rimg").split(":"); S.rooms[Number(p[0])].images.splice(Number(p[1]), 1); ODD.save(); };
    });
  }

  ODD.refreshUI = function () {
    renderRoomList(); renderLayoutInfo(); renderFinal();
    if (S.stripped) $("storeWarn").hidden = false; else $("storeWarn").hidden = true;
  };

  buildLibrary();
  ODD.initBoard();
  showPane("cost");
})();
