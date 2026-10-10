// Cloud saving with Supabase: sign in, save/open projects, sync rates, client share links.
// The page works without this file's features: if Supabase is not configured, everything still saves in the browser.
(function () {
  var ODD = window.ODD;
  var S = ODD.state;
  var cfg = window.ODD_CONFIG || {};
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }

  var sb = null, user = null, currentId = null, projects = [];

  function status(msg, bad) { $("cloudStatus").textContent = msg; $("cloudStatus").className = "cloudstatus" + (bad ? " bad" : ""); }
  function show(signedIn) { $("cloudSignedOut").hidden = signedIn; $("cloudSignedIn").hidden = !signedIn; }
  function shareUrl(token) { return location.origin + "/view.html?t=" + token; }
  function newToken() {
    var a = new Uint8Array(32); crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }
  function errText(e) { return (e && e.message) ? e.message : "Something went wrong."; }

  function projectPayload() {
    var est = window.ODD_EST ? window.ODD_EST.getProject() : {};
    var board = JSON.parse(JSON.stringify(S)); delete board.stripped;
    return { board: board, estimate: est };
  }

  // ---------- auth ----------
  async function signIn() {
    var email = $("cloudEmail").value.trim(), pw = $("cloudPassword").value;
    if (!email || !pw) { status("Type your email and password.", true); return; }
    status("Signing in...");
    var r = await sb.auth.signInWithPassword({ email: email, password: pw });
    if (r.error) { status("Could not sign in: " + r.error.message, true); return; }
    $("cloudPassword").value = "";
  }
  async function signOut() { await sb.auth.signOut(); }

  async function onAuth(session) {
    user = session && session.user ? session.user : null;
    if (!user) { currentId = null; projects = []; show(false); status("Signed out. Your work still saves in this browser."); return; }
    show(true); $("cloudUser").textContent = user.email;
    status("Signed in.");
    await loadRates(true);
    await listProjects();
  }

  // ---------- rates ----------
  async function loadRates(quiet) {
    if (!window.ODD_EST) return;
    var r = await sb.from("rates").select("rates, real").maybeSingle();
    if (r.error) { status("Could not load rates: " + errText(r.error), true); return; }
    if (!r.data) { if (!quiet) status("No saved rates in the cloud yet."); return; }
    if (window.ODD_EST.setRates(r.data.rates, r.data.real)) { if (!quiet) status("Rates loaded from the cloud."); }
    else status("The saved rates did not match this version of the app, so they were not loaded.", true);
  }
  async function saveRates() {
    var cur = window.ODD_EST.getRates();
    var r = await sb.from("rates").upsert({ owner: user.id, rates: cur.rates, real: cur.real }, { onConflict: "owner" });
    status(r.error ? "Could not save rates: " + errText(r.error) : "Rates saved to the cloud.", !!r.error);
  }

  // ---------- projects ----------
  async function listProjects() {
    var r = await sb.from("projects").select("id, name, client, updated_at, share_enabled, share_token").order("updated_at", { ascending: false });
    if (r.error) { status("Could not load projects: " + errText(r.error), true); return; }
    projects = r.data || []; renderList();
  }
  function renderList() {
    if (!projects.length) { $("cloudList").innerHTML = '<p class="note">No saved projects yet. Name this one and press Save.</p>'; return; }
    $("cloudList").innerHTML = projects.map(function (p) {
      var cur = p.id === currentId ? " (open)" : "";
      var link = p.share_enabled && p.share_token
        ? '<div class="sharebox"><input readonly value="' + esc(shareUrl(p.share_token)) + '" aria-label="Share link"><button class="btn ghost small" data-copy="' + p.id + '">Copy link</button><button class="btn ghost small" data-unshare="' + p.id + '">Stop sharing</button></div>'
        : "";
      return '<div class="projrow"><div><b>' + esc(p.name) + "</b>" + cur + '<span class="dim">' + esc(p.client) + " &middot; " + new Date(p.updated_at).toLocaleDateString("en-MY") + "</span></div>" +
        '<div class="projbtns"><button class="btn small" data-open="' + p.id + '">Open</button>' +
        (p.share_enabled ? "" : '<button class="btn ghost small" data-share="' + p.id + '">Share with client</button>') +
        '<button class="btn ghost small" data-del="' + p.id + '">Delete</button></div>' + link + "</div>";
    }).join("");
    var q = function (sel, fn) { Array.prototype.forEach.call($("cloudList").querySelectorAll(sel), function (b) { b.onclick = function () { fn(b); }; }); };
    q("[data-open]", function (b) { openProject(b.getAttribute("data-open")); });
    q("[data-share]", function (b) { setShare(b.getAttribute("data-share"), true); });
    q("[data-unshare]", function (b) { setShare(b.getAttribute("data-unshare"), false); });
    q("[data-del]", function (b) { askDelete(b.getAttribute("data-del")); });
    q("[data-copy]", function (b) {
      var p = projects.filter(function (x) { return x.id === b.getAttribute("data-copy"); })[0];
      var url = shareUrl(p.share_token);
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { status("Link copied."); }, function () { status("Select the link and copy it by hand.", true); });
      else status("Select the link and copy it by hand.", true);
    });
  }

  async function saveProject() {
    var name = $("cloudName").value.trim() || ($("project").value.trim()) || "Untitled project";
    var client = $("client").value.trim();
    var payload = projectPayload();
    if (JSON.stringify(payload).length > 6 * 1024 * 1024) { status("This project is very large (probably big images). Remove some mood board images and try again.", true); return; }
    status("Saving...");
    var r;
    if (currentId) r = await sb.from("projects").update({ name: name, client: client, data: payload }).eq("id", currentId).select("id").maybeSingle();
    else r = await sb.from("projects").insert({ name: name, client: client, data: payload }).select("id").single();
    if (r.error) { status("Could not save: " + errText(r.error), true); return; }
    if (!r.data) { status("Could not save: that project no longer exists.", true); currentId = null; return; }
    currentId = r.data.id; status("Saved \"" + name + "\".");
    await listProjects();
  }
  async function openProject(id) {
    status("Opening...");
    var r = await sb.from("projects").select("id, name, client, data").eq("id", id).maybeSingle();
    if (r.error || !r.data) { status("Could not open that project: " + (r.error ? errText(r.error) : "not found"), true); return; }
    var d = r.data.data || {};
    if (d.board) ODD.replaceState(d.board);
    if (d.estimate && window.ODD_EST) window.ODD_EST.setProject(d.estimate);
    currentId = r.data.id; $("cloudName").value = r.data.name;
    status("Opened \"" + r.data.name + "\".");
    renderList();
  }
  function askDelete(id) {
    var p = projects.filter(function (x) { return x.id === id; })[0];
    var row = $("cloudList").querySelector('[data-del="' + id + '"]').parentNode;
    row.innerHTML = '<span class="note">Delete "' + esc(p.name) + '" for good?</span> <button class="btn small" data-yes>Yes, delete</button> <button class="btn ghost small" data-no>Keep it</button>';
    row.querySelector("[data-no]").onclick = renderList;
    row.querySelector("[data-yes]").onclick = async function () {
      var r = await sb.from("projects").delete().eq("id", id);
      if (r.error) { status("Could not delete: " + errText(r.error), true); return; }
      if (currentId === id) currentId = null;
      status("Deleted."); await listProjects();
    };
  }
  async function setShare(id, on) {
    var upd = on ? { share_enabled: true, share_token: newToken() } : { share_enabled: false, share_token: null };
    var r = await sb.from("projects").update(upd).eq("id", id);
    if (r.error) { status("Could not change sharing: " + errText(r.error), true); return; }
    status(on ? "Sharing is on. Copy the link below and send it to your client. It shows the layout and mood board only, never prices." : "Sharing is off. The old link no longer works.");
    await listProjects();
  }

  // ---------- start ----------
  ODD.cloudInit = function (client) {
    sb = client;
    $("cloudBar").hidden = false;
    $("cloudSignIn").onclick = signIn;
    $("cloudPassword").onkeydown = function (e) { if (e.key === "Enter") signIn(); };
    $("cloudSignOut").onclick = signOut;
    $("cloudSave").onclick = saveProject;
    $("cloudNew").onclick = function () { currentId = null; $("cloudName").value = ""; ODD.resetAll(); if (window.ODD_EST) window.ODD_EST.setProject({}); status("Started a new project."); renderList(); };
    $("cloudSaveRates").onclick = saveRates;
    $("cloudLoadRates").onclick = function () { loadRates(false); };
    sb.auth.getSession().then(function (r) { onAuth(r.data && r.data.session); });
    sb.auth.onAuthStateChange(function (ev, session) { if (ev === "SIGNED_IN" || ev === "SIGNED_OUT") onAuth(session); });
  };

  if (cfg.url && cfg.anonKey && window.supabase) {
    ODD.cloudInit(window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true } }));
  } else {
    $("cloudBar").hidden = false; $("cloudSignedOut").hidden = true; $("cloudSignedIn").hidden = true;
    status("Cloud saving is off because Supabase is not set up yet. Everything still saves in this browser.");
  }
})();
