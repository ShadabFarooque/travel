const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const multer = require("multer");

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "travel_guide_website");
const DATA = path.join(PUBLIC, "data");
const PRIVATE = path.join(ROOT, "data");
const UPLOADS = path.join(PUBLIC, "assets", "uploads");
const SECRET_FILE = path.join(PRIVATE, "admin-secret.json");
const ENQUIRIES_FILE = path.join(PRIVATE, "enquiries.json");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const MAX_ENQUIRIES = 1000;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 32).toString("hex");
}

function loadSecret() {
  ensureDir(path.dirname(SECRET_FILE));
  let secret = readJson(SECRET_FILE, null);
  if (!secret || !secret.cookieSecret || !secret.passwordSalt || !secret.passwordHash) {
    if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
      throw new Error("Set ADMIN_PASSWORD to a password of at least 12 characters before starting the server.");
    }
    const passwordSalt = crypto.randomBytes(16).toString("hex");
    secret = {
      cookieSecret: crypto.randomBytes(32).toString("hex"),
      passwordSalt,
      passwordHash: hashPassword(ADMIN_PASSWORD, passwordSalt)
    };
    writeJson(SECRET_FILE, secret);
  }
  return secret;
}

const secret = loadSecret();
ensureDir(DATA);
ensureDir(PRIVATE);
ensureDir(UPLOADS);
if (!fs.existsSync(ENQUIRIES_FILE)) writeJson(ENQUIRIES_FILE, []);

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));
app.use(cookieParser(secret.cookieSecret));
app.use((_req, res, next) => {
  res.set({
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'; img-src 'self' data: https:; media-src 'self' https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' https://www.googletagmanager.com https://www.google-analytics.com; connect-src 'self' https://www.google-analytics.com",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY"
  });
  next();
});
app.use("/assets/uploads", express.static(UPLOADS));
app.use(express.static(PUBLIC));

const requestCounts = new Map();
function rateLimit(windowMs, max, keyFn = (req) => req.ip) {
  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    const entry = requestCounts.get(key);
    if (!entry || now - entry.startedAt >= windowMs) {
      requestCounts.set(key, { startedAt: now, count: 1 });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) return res.status(429).json({ error: "Too many requests. Try again later." });
    return next();
  };
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase().replace(/[^.a-z0-9]/g, "");
    const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".mp4", ".webm"].includes(ext) ? ext : ".jpg";
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${safeExt}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^(image\/(jpeg|png|webp|gif|avif)|video\/(mp4|webm))$/.test(file.mimetype);
    cb(ok ? null : new Error("Only images and mp4/webm videos are allowed."), ok);
  }
});

function signToken() {
  const payload = `${Date.now()}.${crypto.randomBytes(12).toString("hex")}`;
  const sig = crypto.createHmac("sha256", secret.cookieSecret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function validToken(token) {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [ts, rnd, sig] = parts;
  const expected = crypto.createHmac("sha256", secret.cookieSecret).update(`${ts}.${rnd}`).digest("hex");
  if (!/^[a-f0-9]{64}$/.test(sig)) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const age = Date.now() - Number(ts);
  return age >= 0 && age < 1000 * 60 * 60 * 12;
}

function requireAuth(req, res, next) {
  if (validToken(req.signedCookies.wv_admin)) return next();
  return res.status(401).json({ error: "Please sign in to the admin dashboard." });
}

function requireCsrf(req, res, next) {
  const token = req.get("X-CSRF-Token");
  if (!token || token !== req.cookies.wv_csrf) return res.status(403).json({ error: "Invalid CSRF token." });
  return next();
}

function dataPath(name) {
  return path.join(DATA, name);
}

app.post("/api/login", rateLimit(15 * 60 * 1000, 10), (req, res) => {
  const password = String(req.body?.password || "");
  const incoming = hashPassword(password, secret.passwordSalt);
  const ok = incoming.length === secret.passwordHash.length
    && crypto.timingSafeEqual(Buffer.from(incoming), Buffer.from(secret.passwordHash));
  if (!ok) return res.status(401).json({ error: "Incorrect password." });
  res.cookie("wv_admin", signToken(), {
    httpOnly: true,
    signed: true,
    sameSite: "lax",
    secure: IS_PRODUCTION,
    maxAge: 1000 * 60 * 60 * 12
  });
  res.cookie("wv_csrf", crypto.randomBytes(24).toString("hex"), {
    httpOnly: false,
    signed: false,
    sameSite: "lax",
    secure: IS_PRODUCTION,
    maxAge: 1000 * 60 * 60 * 12
  });
  res.json({ ok: true });
});

app.post("/api/logout", requireAuth, requireCsrf, (_req, res) => {
  res.clearCookie("wv_admin");
  res.clearCookie("wv_csrf");
  res.json({ ok: true });
});

app.get("/api/session", (req, res) => {
  res.json({ authenticated: validToken(req.signedCookies.wv_admin) });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, mode: "admin-server" });
});

["tours.json", "blog.json", "testimonials.json", "settings.json", "faqs.json"].forEach((file) => {
  app.get(`/api/${file.replace(".json", "")}`, (_req, res) => {
    res.json(readJson(dataPath(file), file === "settings.json" ? {} : []));
  });
});

app.put("/api/tours", requireAuth, requireCsrf, (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: "Tours must be an array." });
  writeJson(dataPath("tours.json"), req.body);
  res.json({ ok: true, count: req.body.length });
});

app.put("/api/blog", requireAuth, requireCsrf, (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: "Posts must be an array." });
  writeJson(dataPath("blog.json"), req.body);
  res.json({ ok: true, count: req.body.length });
});

app.put("/api/testimonials", requireAuth, requireCsrf, (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: "Testimonials must be an array." });
  writeJson(dataPath("testimonials.json"), req.body);
  res.json({ ok: true, count: req.body.length });
});

app.put("/api/faqs", requireAuth, requireCsrf, (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: "FAQs must be an array." });
  writeJson(dataPath("faqs.json"), req.body);
  res.json({ ok: true, count: req.body.length });
});

app.put("/api/settings", requireAuth, requireCsrf, (req, res) => {
  if (!req.body || typeof req.body !== "object") return res.status(400).json({ error: "Invalid settings." });
  writeJson(dataPath("settings.json"), req.body);
  res.json({ ok: true });
});

app.post("/api/password", requireAuth, requireCsrf, (req, res) => {
  const current = String(req.body?.currentPassword || "");
  const next = String(req.body?.newPassword || "");
  if (next.length < 8) return res.status(400).json({ error: "New password must be at least 8 characters." });
  const incoming = hashPassword(current, secret.passwordSalt);
  const ok = incoming.length === secret.passwordHash.length
    && crypto.timingSafeEqual(Buffer.from(incoming), Buffer.from(secret.passwordHash));
  if (!ok) return res.status(401).json({ error: "Current password is incorrect." });
  secret.passwordSalt = crypto.randomBytes(16).toString("hex");
  secret.passwordHash = hashPassword(next, secret.passwordSalt);
  writeJson(SECRET_FILE, secret);
  res.json({ ok: true });
});

app.get("/api/enquiries", requireAuth, (_req, res) => {
  res.json(readJson(ENQUIRIES_FILE, []));
});

app.post("/api/enquiries", rateLimit(15 * 60 * 1000, 20), (req, res) => {
  const body = req.body || {};
  const enquiry = {
    id: `enq-${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: "new",
    name: String(body.name || "").slice(0, 120),
    email: String(body.email || "").slice(0, 160),
    phone: String(body.phone || "").slice(0, 40),
    tourId: String(body.tourId || "").slice(0, 80),
    tourName: String(body.tourName || "").slice(0, 120),
    travellers: String(body.travellers || "").slice(0, 20),
    travelDate: String(body.travelDate || "").slice(0, 40),
    message: String(body.message || "").slice(0, 2000),
    type: body.type === "booking" ? "booking" : "enquiry"
  };
  if (!enquiry.name || !enquiry.phone) {
    return res.status(400).json({ error: "Name and phone are required." });
  }
  const list = readJson(ENQUIRIES_FILE, []);
  list.unshift(enquiry);
  if (list.length > MAX_ENQUIRIES) list.length = MAX_ENQUIRIES;
  writeJson(ENQUIRIES_FILE, list);
  res.json({ ok: true, id: enquiry.id });
});

app.patch("/api/enquiries/:id", requireAuth, requireCsrf, (req, res) => {
  const list = readJson(ENQUIRIES_FILE, []);
  const item = list.find((e) => e.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Lead not found." });
  if (req.body.status) item.status = String(req.body.status);
  if (req.body.notes != null) item.notes = String(req.body.notes).slice(0, 2000);
  writeJson(ENQUIRIES_FILE, list);
  res.json({ ok: true, item });
});

app.delete("/api/enquiries/:id", requireAuth, requireCsrf, (req, res) => {
  const list = readJson(ENQUIRIES_FILE, []).filter((e) => e.id !== req.params.id);
  writeJson(ENQUIRIES_FILE, list);
  res.json({ ok: true });
});

app.post("/api/upload", requireAuth, requireCsrf, (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || "Upload failed." });
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });
    res.json({ ok: true, url: `assets/uploads/${req.file.filename}` });
  });
});

app.get("/admin", (_req, res) => {
  res.redirect("/admin/");
});

app.listen(PORT, () => {
  console.log(`WanderVista running at http://localhost:${PORT}`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin`);
});
