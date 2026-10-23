// A deliberately small login service for the HorizontalPodAutoscaler lab.
//
// The only expensive thing it does is verify an Argon2id password hash. That is
// intentional: a login attempt costs a predictable amount of CPU (roughly
// 150-350 ms of one core with the parameters below, depending on the node),
// which gives the HPA a clean, controllable signal to scale on. There is no
// database, no session store and no cookie: this is a load target, not an
// authentication service.

import { Hono } from "hono";
import { renderLoginPage, renderWelcomePage } from "./ui";

const PORT = Number(process.env.PORT ?? 3000);

// Demo credentials: username "student", password "testpassword".
//
// The hash below was generated with Argon2id, m=65536 KiB (64 MiB), t=3, p=1.
// Regenerate it with:
//   bun -e 'console.log(await Bun.password.hash("testpassword", { algorithm: "argon2id", memoryCost: 65536, timeCost: 3, parallelism: 1 }))'
//
// In a real service the hash belongs in a database, never in source control.
const PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=1$fpYL9LFs9GuQUbf7Tu34ZhBOKNfku5r1cEPzp9G+zoY$IYUzQe4l8urCLixCxqiLlLJ5pVqrS402e4NMB4vi/qQ";

// A verification is performed even for an unknown username, so a failed login
// costs the same as a successful one. Without this, an attacker could enumerate
// usernames by timing the response (and the load generator would see a very
// different CPU profile).
const DUMMY_HASH =
  "$argon2id$v=19$m=65536,t=3,p=1$ljGuUDHnRGN5mSCHqo/I3dy3edUeIh+iuRXRIEeKuTA$ZUf0Bh/yhGTevp/wuRRO2rJWTcaC65+NFvmAX4TZ/tw";

const USERNAME = "student";

let loginsTotal = 0;
let loginFailuresTotal = 0;
let inFlight = 0;

const app = new Hono();

// Coarse in-flight gauge, exported on /metrics for the curious. It is not used
// by the HPA - the HPA reads CPU from metrics-server - but it makes it obvious
// that the load generator is actually reaching the server.
app.use("*", async (c, next) => {
  inFlight += 1;
  try {
    await next();
  } finally {
    inFlight -= 1;
  }
});

app.get("/", (c) => c.html(renderLoginPage()));

app.get("/healthz", (c) => c.text("ok"));
app.get("/readyz", (c) => c.text("ok"));

app.get("/metrics", (c) => {
  const lines = [
    "# HELP lab05_logins_total Successful Argon2id logins.",
    "# TYPE lab05_logins_total counter",
    `lab05_logins_total ${loginsTotal}`,
    "# HELP lab05_login_failures_total Rejected login attempts.",
    "# TYPE lab05_login_failures_total counter",
    `lab05_login_failures_total ${loginFailuresTotal}`,
    "# HELP lab05_in_flight_requests Requests currently being handled.",
    "# TYPE lab05_in_flight_requests gauge",
    `lab05_in_flight_requests ${inFlight}`,
  ];
  return c.text(`${lines.join("\n")}\n`, 200, {
    "content-type": "text/plain; version=0.0.4; charset=utf-8",
  });
});

app.post("/login", async (c) => {
  const wantsJson =
    c.req.query("format") === "json" ||
    (c.req.header("accept") ?? "").includes("application/json") ||
    (c.req.header("accept") ?? "") === "*/*";

  let username = "";
  let password = "";

  try {
    if ((c.req.header("content-type") ?? "").includes("application/json")) {
      const body = (await c.req.json()) as Record<string, unknown>;
      username = typeof body.username === "string" ? body.username : "";
      password = typeof body.password === "string" ? body.password : "";
    } else {
      const body = await c.req.parseBody();
      username = typeof body.username === "string" ? body.username : "";
      password = typeof body.password === "string" ? body.password : "";
    }
  } catch {
    // A malformed body is still a login attempt: fall through and burn the same
    // Argon2 verification below.
  }

  const knownUser = username === USERNAME;
  const valid = await Bun.password.verify(
    password,
    knownUser ? PASSWORD_HASH : DUMMY_HASH,
  );

  if (knownUser && valid) {
    loginsTotal += 1;
    if (wantsJson) {
      return c.json({ ok: true, username: USERNAME });
    }
    return c.html(renderWelcomePage(USERNAME));
  }

  loginFailuresTotal += 1;
  if (wantsJson) {
    return c.json({ ok: false, error: "Invalid username or password" }, 401);
  }
  return c.html(
    renderLoginPage({ error: "Invalid username or password", username }),
    401,
  );
});

app.notFound((c) => c.text("not found", 404));

export default {
  port: PORT,
  fetch: app.fetch,
  idleTimeout: 30,
};
