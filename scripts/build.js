// Vercel build step: copies the static site into dist/ and writes dist/config.js from environment variables.
// Set SUPABASE_URL and SUPABASE_ANON_KEY in Vercel -> Project Settings -> Environment Variables.
// The anon key is meant to be public (it ships to the browser). The service_role key must NEVER be used here.
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const COPY = ["index.html", "view.html", "css", "js", "data", "docs"];

function copy(src, dest) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const f of fs.readdirSync(src)) copy(path.join(src, f), path.join(dest, f));
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function jwtRole(token) {
  try {
    const part = token.split(".")[1];
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json).role;
  } catch (e) { return null; }
}

const url = (process.env.SUPABASE_URL || "").trim();
const anonKey = (process.env.SUPABASE_ANON_KEY || "").trim();

if (jwtRole(anonKey) === "service_role" || /^sb_secret_/.test(anonKey)) {
  console.error("\nBUILD STOPPED: SUPABASE_ANON_KEY holds a secret (service_role) key.");
  console.error("That key would be published to every visitor. Use the anon / publishable key instead.\n");
  process.exit(1);
}
if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) {
  console.error("\nBUILD STOPPED: SUPABASE_URL should look like https://xxxxxxxx.supabase.co\n");
  process.exit(1);
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
COPY.forEach((f) => { const p = path.join(root, f); if (fs.existsSync(p)) copy(p, path.join(dist, f)); });

const cfg = { url: url.replace(/\/$/, ""), anonKey };
fs.writeFileSync(path.join(dist, "config.js"), "window.ODD_CONFIG = " + JSON.stringify(cfg) + ";\n");

if (!url || !anonKey) {
  console.warn("\nNOTE: SUPABASE_URL or SUPABASE_ANON_KEY is not set. The site will build, but cloud saving stays off.\n");
} else {
  console.log("Built dist/ with Supabase config for " + cfg.url);
}
