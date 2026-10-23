/**
 * Server-rendered HTML for the Lab 05 login demo.
 * No client-side JavaScript, no external assets — every document is self-contained.
 */

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

const BASE_CSS = `
:root{
  color-scheme:light;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Times New Roman",serif;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;
  --paper:#f2f1ec;
  --surface:#fdfdfb;
  --inset:#faf9f5;
  --inset-focus:#ffffff;
  --ink:#161a19;
  --ink-soft:#565f5c;
  --ink-faint:#68706c;
  --line:#e0dfd7;
  --line-strong:#cfcec4;
  --line-hover:#b8b7ac;
  --grid:rgba(22,26,25,.055);
  --wash:rgba(17,94,77,.06);
  --accent:#115e4d;
  --accent-wash:#e6efeb;
  --ring:rgba(17,94,77,.20);
  --danger:#8e2b1f;
  --danger-ink:#7a241a;
  --danger-wash:#fbece8;
  --danger-line:#f0d3cc;
  --danger-ring:rgba(142,43,31,.18);
  --btn-bg:#115e4d;
  --btn-bg-hover:#0c4c3e;
  --btn-ink:#f7fcfa;
  --shadow:0 1px 1px rgba(22,26,25,.04),0 8px 20px -14px rgba(22,26,25,.20),0 32px 56px -40px rgba(22,26,25,.28);
}
@media (prefers-color-scheme:dark){
  :root{
    color-scheme:dark;
    --paper:#0b0d0d;
    --surface:#131616;
    --inset:#0f1211;
    --inset-focus:#101413;
    --ink:#e9ece8;
    --ink-soft:#a2a9a5;
    --ink-faint:#848c88;
    --line:#242927;
    --line-strong:#343a37;
    --line-hover:#4a514d;
    --grid:rgba(233,236,232,.05);
    --wash:rgba(121,201,177,.07);
    --accent:#79c9b1;
    --accent-wash:#16302a;
    --ring:rgba(121,201,177,.24);
    --danger:#f0a294;
    --danger-ink:#f4b7ab;
    --danger-wash:#2a1613;
    --danger-line:#43241e;
    --danger-ring:rgba(240,162,148,.22);
    --btn-bg:#79c9b1;
    --btn-bg-hover:#8fd8c2;
    --btn-ink:#0a1512;
    --shadow:0 1px 1px rgba(0,0,0,.4),0 12px 28px -18px rgba(0,0,0,.7),0 40px 70px -50px rgba(0,0,0,.9);
  }
}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0;
  min-height:100vh;
  min-height:100dvh;
  display:grid;
  place-items:center;
  padding:clamp(18px,5vw,48px);
  background-color:var(--paper);
  background-image:
    radial-gradient(120% 65% at 50% -10%,var(--wash),transparent 62%),
    linear-gradient(var(--grid) 1px,transparent 1px),
    linear-gradient(90deg,var(--grid) 1px,transparent 1px);
  background-size:auto,72px 72px,72px 72px;
  background-position:center top,center top,center top;
  background-attachment:fixed,fixed,fixed;
  color:var(--ink);
  font-family:var(--sans);
  font-size:16px;
  line-height:1.55;
  -webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale;
}
::selection{background:var(--accent);color:var(--btn-ink)}
.card{
  position:relative;
  width:100%;
  max-width:420px;
  padding:clamp(22px,5.6vw,34px);
  background:var(--surface);
  border:1px solid var(--line);
  border-radius:14px;
  box-shadow:var(--shadow);
  animation:card-in .55s cubic-bezier(.16,.84,.44,1) both;
}
.card::before{
  content:"";
  position:absolute;
  top:-1px;
  left:clamp(22px,5.6vw,34px);
  width:38px;
  height:2px;
  border-radius:0 0 2px 2px;
  background:var(--accent);
  opacity:.9;
}
.brand{display:flex;align-items:center;gap:9px;min-width:0}
.mark{flex:none;display:grid;place-items:center;width:14px;height:14px;border:1.5px solid var(--accent);border-radius:3px}
.mark::after{content:"";width:4px;height:4px;border-radius:1px;background:var(--accent)}
.brand-name{
  font-family:var(--mono);
  font-size:10.5px;
  letter-spacing:.13em;
  text-transform:uppercase;
  color:var(--ink-soft);
  white-space:nowrap;
}
.badge{
  margin-left:auto;
  display:inline-flex;
  align-items:center;
  gap:6px;
  padding:3px 8px 3px 7px;
  border:1px solid var(--line);
  border-radius:999px;
  font-family:var(--mono);
  font-size:9.5px;
  letter-spacing:.16em;
  text-transform:uppercase;
  color:var(--ink-faint);
}
.dot{flex:none;width:5px;height:5px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 3px var(--accent-wash)}
.title{
  margin:22px 0 0;
  font-family:var(--serif);
  font-size:clamp(28px,7vw,34px);
  font-weight:600;
  line-height:1.1;
  letter-spacing:-.015em;
  color:var(--ink);
}
.title--session{font-size:clamp(23px,6vw,29px);line-height:1.18;letter-spacing:-.012em;text-wrap:balance}
.who{color:var(--accent);overflow-wrap:anywhere}
.subtitle{margin:8px 0 0;font-family:var(--mono);font-size:11.5px;letter-spacing:.015em;color:var(--ink-soft)}
.alert{
  display:flex;
  gap:9px;
  align-items:flex-start;
  margin:20px 0 0;
  padding:10px 12px;
  border:1px solid var(--danger-line);
  border-left:3px solid var(--danger);
  border-radius:6px;
  background:var(--danger-wash);
  animation:alert-in .28s ease-out both;
}
.alert-glyph{
  flex:none;
  display:grid;
  place-items:center;
  width:16px;
  height:16px;
  margin-top:1px;
  border:1px solid currentColor;
  border-radius:50%;
  font-family:var(--mono);
  font-size:10px;
  font-weight:700;
  line-height:1;
  color:var(--danger);
}
.alert p{margin:0;font-size:12.5px;line-height:1.55;color:var(--danger-ink);overflow-wrap:anywhere}
form{display:flex;flex-direction:column;gap:15px;margin:24px 0 0}
.field{display:flex;flex-direction:column;gap:6px}
label{
  display:flex;
  justify-content:space-between;
  align-items:baseline;
  font-family:var(--mono);
  font-size:10px;
  letter-spacing:.15em;
  text-transform:uppercase;
  color:var(--ink-soft);
}
.idx{color:var(--ink-faint);letter-spacing:.06em}
input{
  width:100%;
  height:46px;
  padding:0 12px;
  font-family:inherit;
  font-size:16px;
  color:var(--ink);
  background:var(--inset);
  border:1px solid var(--line-strong);
  border-radius:8px;
  transition:border-color .16s ease,box-shadow .16s ease,background-color .16s ease;
}
input:hover{border-color:var(--line-hover)}
input:focus-visible{outline:none;border-color:var(--accent);background:var(--inset-focus);box-shadow:0 0 0 3px var(--ring)}
input[aria-invalid="true"]{border-color:var(--danger)}
input[aria-invalid="true"]:focus-visible{border-color:var(--danger);box-shadow:0 0 0 3px var(--danger-ring)}
.submit{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  width:100%;
  height:48px;
  margin-top:6px;
  padding:0 16px;
  font-family:inherit;
  font-size:14.5px;
  font-weight:600;
  letter-spacing:.01em;
  color:var(--btn-ink);
  background:var(--btn-bg);
  border:1px solid transparent;
  border-radius:8px;
  cursor:pointer;
  -webkit-tap-highlight-color:transparent;
  transition:background-color .16s ease,box-shadow .16s ease,transform .16s ease;
}
.submit:hover{background:var(--btn-bg-hover)}
.submit:active{transform:translateY(1px)}
.submit:focus-visible{outline:none;box-shadow:0 0 0 2px var(--surface),0 0 0 4px var(--accent)}
.arrow{font-family:var(--mono);font-size:15px;opacity:.65;transition:transform .18s ease,opacity .18s ease}
.submit:hover .arrow{transform:translateX(3px);opacity:1}
.foot{
  margin:20px 0 0;
  padding-top:14px;
  border-top:1px solid var(--line);
  font-size:12px;
  line-height:1.5;
  color:var(--ink-faint);
}
.note{
  margin:12px 0 0;
  max-width:36ch;
  font-size:13.5px;
  line-height:1.6;
  color:var(--ink-soft);
  text-wrap:pretty;
}
.meta{
  display:grid;
  grid-template-columns:1fr 1fr;
  margin:22px 0 0;
  border-top:1px solid var(--line);
  border-bottom:1px solid var(--line);
}
.meta > div{padding:12px 0}
.meta > div + div{padding-left:16px;border-left:1px solid var(--line)}
.meta dt{
  margin:0 0 5px;
  font-family:var(--mono);
  font-size:10px;
  letter-spacing:.14em;
  text-transform:uppercase;
  color:var(--ink-faint);
}
.meta dd{display:flex;align-items:center;gap:7px;margin:0;font-size:13px;color:var(--ink)}
.back{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  height:46px;
  margin:22px 0 0;
  border:1px solid var(--line-strong);
  border-radius:8px;
  background:transparent;
  color:var(--ink);
  text-decoration:none;
  font-size:14px;
  font-weight:600;
  letter-spacing:.005em;
  -webkit-tap-highlight-color:transparent;
  transition:color .16s ease,border-color .16s ease,background-color .16s ease;
}
.back:hover{color:var(--accent);border-color:var(--accent);background:var(--accent-wash)}
.back:focus-visible{outline:none;box-shadow:0 0 0 2px var(--surface),0 0 0 4px var(--accent)}
.back:hover .arrow{transform:translateX(-3px);opacity:1}
@keyframes card-in{
  from{opacity:0;transform:translateY(10px) scale(.995)}
  to{opacity:1;transform:none}
}
@keyframes alert-in{
  from{opacity:0;transform:translateY(-3px)}
  to{opacity:1;transform:none}
}
@media (max-width:380px){
  .card{padding:20px}
  .card::before{left:20px;width:32px}
  .badge{display:none}
  .brand-name{font-size:10px}
}
@media (prefers-reduced-motion:reduce){
  .card,.alert{animation:none}
  *,*::before,*::after{
    animation-duration:.01ms !important;
    animation-iteration-count:1 !important;
    transition-duration:.01ms !important;
  }
}
`;

function documentTemplate(title: string, main: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#f2f1ec" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0b0d0d" media="(prefers-color-scheme: dark)">
<meta name="robots" content="noindex">
<title>${title}</title>
<style>${BASE_CSS}</style>
</head>
<body>
${main}
</body>
</html>`;
}

const BRAND = `<div class="brand">
  <span class="mark" aria-hidden="true"></span>
  <span class="brand-name">Kubernetes Lab 05</span>
  <span class="badge"><span class="dot" aria-hidden="true"></span>demo</span>
</div>`;

export function renderLoginPage(opts?: { error?: string; username?: string }): string {
  const error = opts?.error?.trim() ?? "";
  const username = opts?.username ?? "";
  const hasError = error.length > 0;

  const alertMarkup = hasError
    ? `<div class="alert" role="alert" id="login-error">
  <span class="alert-glyph" aria-hidden="true">!</span>
  <p>${escapeHtml(error)}</p>
</div>`
    : "";

  const usernameHints = hasError
    ? ` aria-invalid="true" aria-describedby="login-error" autofocus`
    : "";
  const passwordHints = hasError
    ? ` aria-invalid="true" aria-describedby="login-error"`
    : "";

  const main = `<main class="card" aria-labelledby="page-title">
  ${BRAND}

  <h1 class="title" id="page-title">Sign in</h1>
  <p class="subtitle">Argon2id login · CPU-bound demo</p>

  ${alertMarkup}

  <form method="post" action="/login">
    <div class="field">
      <label for="username"><span>Username</span><span class="idx" aria-hidden="true">01</span></label>
      <input id="username" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required value="${escapeHtml(username)}"${usernameHints}>
    </div>
    <div class="field">
      <label for="password"><span>Password</span><span class="idx" aria-hidden="true">02</span></label>
      <input id="password" name="password" type="password" autocomplete="current-password" required${passwordHints}>
    </div>
    <button class="submit" type="submit">
      <span>Sign in</span>
      <span class="arrow" aria-hidden="true">→</span>
    </button>
  </form>

  <p class="foot">Course demo — not a real account.</p>
</main>`;

  return documentTemplate("Sign in · Kubernetes Lab 05", main);
}

export function renderWelcomePage(username: string): string {
  const safeUsername = escapeHtml(username);

  const main = `<main class="card" aria-labelledby="page-title">
  ${BRAND}

  <h1 class="title title--session" id="page-title">Signed in as <span class="who">${safeUsername}</span></h1>
  <p class="note">This is a demo login for the autoscaling lab. Each sign-in runs one Argon2id verification&nbsp;— the CPU load the autoscaler reacts to.</p>

  <dl class="meta">
    <div>
      <dt>Method</dt>
      <dd>Argon2id</dd>
    </div>
    <div>
      <dt>Result</dt>
      <dd><span class="dot" aria-hidden="true"></span>Password verified</dd>
    </div>
  </dl>

  <a class="back" href="/"><span class="arrow" aria-hidden="true">←</span><span>Return to sign in</span></a>
</main>`;

  return documentTemplate("Signed in · Kubernetes Lab 05", main);
}
