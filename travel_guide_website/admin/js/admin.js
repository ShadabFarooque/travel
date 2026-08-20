const state = {
  tours: [],
  blog: [],
  testimonials: [],
  faqs: [],
  settings: {},
  leads: [],
  view: "overview",
  selectedTour: ""
};

const viewEl = document.getElementById("view");
const toast = document.getElementById("toast");

function csrfToken() {
  const cookie = document.cookie.split("; ").find((part) => part.startsWith("wv_csrf="));
  return cookie ? decodeURIComponent(cookie.slice("wv_csrf=".length)) : "";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function showToast(msg) {
  toast.textContent = msg;
  toast.style.display = "block";
  setTimeout(() => { toast.style.display = "none"; }, 2800);
}

async function api(path, options = {}) {
  if (path !== "/api/login") {
    const csrf = await fetch("/api/csrf", { credentials: "same-origin" });
    if (csrf.ok) {
      const data = await csrf.json();
      if (data.token) document.cookie = `wv_csrf=${encodeURIComponent(data.token)}; path=/; SameSite=Lax`;
    }
  }
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken(), ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function slugify(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `item-${Date.now()}`;
}

function emptyTour() {
  return {
    id: `tour-${Date.now()}`,
    name: "New tour",
    flag: "",
    region: "",
    status: "upcoming",
    hero: "",
    description: "",
    sights: [],
    gallery: [],
    video: "",
    priceFrom: "",
    duration: "",
    seoTitle: "",
    seoDescription: "",
    itinerary: []
  };
}

function currentTour() {
  return state.tours.find((t) => t.id === state.selectedTour) || state.tours[0];
}

function renderOverview() {
  const newLeads = state.leads.filter((l) => l.status === "new").length;
  viewEl.innerHTML = `
    <div class="cards">
      <div class="card"><span class="muted">Tours</span><b>${state.tours.length}</b></div>
      <div class="card"><span class="muted">Blog posts</span><b>${state.blog.length}</b></div>
      <div class="card"><span class="muted">Open leads</span><b>${newLeads}</b></div>
      <div class="card"><span class="muted">Testimonials</span><b>${state.testimonials.length}</b></div>
    </div>
    <div class="panel">
      <h3>How to update the live site</h3>
      <p class="muted">Save here to write JSON files on disk. Then commit and push, or copy the <code>travel_guide_website</code> folder to GitHub Pages. Enquiries submitted on this local server appear under Leads.</p>
    </div>
    <div class="panel">
      <h3>Recent leads</h3>
      <table><thead><tr><th>When</th><th>Name</th><th>Tour</th><th>Status</th></tr></thead>
      <tbody>${state.leads.slice(0, 8).map((l) => `<tr><td>${escapeHtml((l.createdAt || "").slice(0, 16).replace("T", " "))}</td><td>${escapeHtml(l.name)}</td><td>${escapeHtml(l.tourName || "-")}</td><td>${escapeHtml(l.status)}</td></tr>`).join("") || `<tr><td colspan="4">No leads yet.</td></tr>`}</tbody></table>
    </div>`;
}

function renderTours() {
  viewEl.innerHTML = `
    <div class="row" style="margin-bottom:12px">
      <button class="btn" id="addTour">Add tour</button>
    </div>
    <div class="panel" style="overflow:auto">
      <table>
        <thead><tr><th>Name</th><th>Region</th><th>Status</th><th>Duration</th><th></th></tr></thead>
        <tbody>
          ${state.tours.map((t, i) => `<tr>
            <td><input data-t="${i}" data-k="name" value="${escapeHtml(t.name)}"></td>
            <td><input data-t="${i}" data-k="region" value="${escapeHtml(t.region)}"></td>
            <td>
              <select data-t="${i}" data-k="status">
                <option value="completed" ${t.status === "completed" ? "selected" : ""}>Completed</option>
                <option value="upcoming" ${t.status === "upcoming" ? "selected" : ""}>Upcoming</option>
              </select>
            </td>
            <td><input data-t="${i}" data-k="duration" value="${escapeHtml(t.duration)}"></td>
            <td><button class="btn ghost" data-edit="${escapeHtml(t.id)}">Edit</button> <button class="btn warn" data-del="${i}">Delete</button></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
    <div class="panel" id="tourEditor"></div>`;
  document.getElementById("addTour").onclick = () => {
    state.tours.unshift(emptyTour());
    state.selectedTour = state.tours[0].id;
    render();
  };
  viewEl.querySelectorAll("[data-t]").forEach((el) => {
    el.onchange = () => { state.tours[+el.dataset.t][el.dataset.k] = el.value; };
  });
  viewEl.querySelectorAll("[data-del]").forEach((el) => {
    el.onclick = () => { state.tours.splice(+el.dataset.del, 1); render(); };
  });
  viewEl.querySelectorAll("[data-edit]").forEach((el) => {
    el.onclick = () => { state.selectedTour = el.dataset.edit; renderTourEditor(); };
  });
  renderTourEditor();
}

function renderTourEditor() {
  const tour = currentTour();
  const box = document.getElementById("tourEditor");
  if (!box || !tour) { if (box) box.innerHTML = "<p>Add a tour to begin.</p>"; return; }
  box.innerHTML = `
    <h3>Edit ${escapeHtml(tour.name)}</h3>
    <div class="grid2">
      <div><label>ID / slug</label><input id="t-id" value="${escapeHtml(tour.id)}"></div>
      <div><label>Flag emoji</label><input id="t-flag" value="${escapeHtml(tour.flag)}"></div>
      <div class="full" style="grid-column:1/-1"><label>Description</label><textarea id="t-desc">${escapeHtml(tour.description)}</textarea></div>
      <div><label>Cover image URL</label><input id="t-hero" value="${escapeHtml(tour.hero)}"></div>
      <div><label>Video URL</label><input id="t-video" value="${escapeHtml(tour.video)}"></div>
      <div><label>Price from</label><input id="t-price" value="${escapeHtml(tour.priceFrom)}"></div>
      <div><label>Highlights (comma separated)</label><input id="t-sights" value="${escapeHtml((tour.sights || []).join(", "))}"></div>
      <div><label>SEO title</label><input id="t-seot" value="${escapeHtml(tour.seoTitle)}"></div>
      <div><label>SEO description</label><input id="t-seod" value="${escapeHtml(tour.seoDescription)}"></div>
    </div>`;
  const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.oninput = () => fn(el.value); };
  bind("t-id", (v) => { tour.id = slugify(v); state.selectedTour = tour.id; });
  bind("t-flag", (v) => { tour.flag = v; });
  bind("t-desc", (v) => { tour.description = v; });
  bind("t-hero", (v) => { tour.hero = v; });
  bind("t-video", (v) => { tour.video = v; });
  bind("t-price", (v) => { tour.priceFrom = v; });
  bind("t-sights", (v) => { tour.sights = v.split(",").map((s) => s.trim()).filter(Boolean); });
  bind("t-seot", (v) => { tour.seoTitle = v; });
  bind("t-seod", (v) => { tour.seoDescription = v; });
}

function tourSelect() {
  if (!state.selectedTour && state.tours[0]) state.selectedTour = state.tours[0].id;
  return `<label>Tour</label><select id="tourPick">${state.tours.map((t) => `<option value="${escapeHtml(t.id)}" ${t.id === state.selectedTour ? "selected" : ""}>${escapeHtml(t.name)}</option>`).join("")}</select>`;
}

function renderPhotos() {
  const tour = currentTour();
  viewEl.innerHTML = `<div class="panel">${tourSelect()}</div>
    <div class="panel">
      <div class="row">
        <input id="photoUrl" placeholder="Image URL">
        <button class="btn" id="addUrl">Add URL</button>
        <input type="file" id="photoFile" accept="image/*,video/mp4,video/webm">
        <button class="btn ghost" id="uploadBtn">Upload file</button>
      </div>
      <p class="muted">Cover image is the first photo, or the dedicated cover field on the Tours tab.</p>
      <div class="photos" id="photoList"></div>
    </div>`;
  document.getElementById("tourPick").onchange = (e) => { state.selectedTour = e.target.value; render(); };
  const photoSrc = (src) => src.startsWith("http") ? src : `../${src}`;
  const draw = () => {
    document.getElementById("photoList").innerHTML = (tour?.gallery || []).map((src, i) => `
      <div class="ph"><img src="${photoSrc(src)}" alt=""><div>
        <small>${escapeHtml(src)}</small><br>
        <button class="btn ghost" data-up="${i}">Up</button>
        <button class="btn ghost" data-dn="${i}">Down</button>
        <button class="btn warn" data-rm="${i}">Remove</button>
      </div></div>`).join("") || "<p class='muted'>No photos yet.</p>";
    document.querySelectorAll("[data-rm]").forEach((b) => b.onclick = () => { tour.gallery.splice(+b.dataset.rm, 1); draw(); });
    document.querySelectorAll("[data-up]").forEach((b) => b.onclick = () => {
      const i = +b.dataset.up; if (i) { [tour.gallery[i - 1], tour.gallery[i]] = [tour.gallery[i], tour.gallery[i - 1]]; draw(); }
    });
    document.querySelectorAll("[data-dn]").forEach((b) => b.onclick = () => {
      const i = +b.dataset.dn; if (i < tour.gallery.length - 1) { [tour.gallery[i + 1], tour.gallery[i]] = [tour.gallery[i], tour.gallery[i + 1]]; draw(); }
    });
  };
  if (tour) {
    tour.gallery = tour.gallery || [];
    draw();
    document.getElementById("addUrl").onclick = () => {
      const url = document.getElementById("photoUrl").value.trim();
      if (url) { tour.gallery.push(url); document.getElementById("photoUrl").value = ""; draw(); }
    };
    document.getElementById("uploadBtn").onclick = async () => {
      const file = document.getElementById("photoFile").files[0];
      if (!file) return showToast("Choose a file first.");
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body, credentials: "same-origin", headers: { "X-CSRF-Token": csrfToken() } });
      const data = await res.json();
      if (!res.ok) return showToast(data.error || "Upload failed");
      tour.gallery.push(data.url);
      if (!tour.hero) tour.hero = data.url;
      draw();
      showToast("Photo uploaded.");
    };
  }
}

function renderItinerary() {
  const tour = currentTour();
  viewEl.innerHTML = `<div class="panel">${tourSelect()}</div>
    <div class="panel">
      <button class="btn" id="addDay">Add day</button>
      <table><thead><tr><th>Day</th><th>City</th><th>Highlights</th><th>Night</th><th></th></tr></thead>
      <tbody id="itinBody"></tbody></table>
    </div>`;
  document.getElementById("tourPick").onchange = (e) => { state.selectedTour = e.target.value; render(); };
  const draw = () => {
    if (!tour) return;
    tour.itinerary = tour.itinerary || [];
    document.getElementById("itinBody").innerHTML = tour.itinerary.map((d, i) => `<tr>
      <td><input data-i="${i}" data-k="day" value="${escapeHtml(d.day || i + 1)}"></td>
      <td><input data-i="${i}" data-k="city" value="${escapeHtml(d.city)}"></td>
      <td><input data-i="${i}" data-k="highlights" value="${escapeHtml(d.highlights)}"></td>
      <td><input data-i="${i}" data-k="night" value="${escapeHtml(d.night)}"></td>
      <td><button class="btn warn" data-rm="${i}">Remove</button></td>
    </tr>`).join("");
    document.querySelectorAll("[data-i]").forEach((el) => {
      el.oninput = () => { tour.itinerary[+el.dataset.i][el.dataset.k] = el.value; };
    });
    document.querySelectorAll("[data-rm]").forEach((el) => {
      el.onclick = () => { tour.itinerary.splice(+el.dataset.rm, 1); draw(); };
    });
  };
  document.getElementById("addDay").onclick = () => {
    tour.itinerary.push({ day: String((tour.itinerary.length || 0) + 1), city: "", highlights: "", night: "" });
    draw();
  };
  draw();
}

function renderLeads() {
  viewEl.innerHTML = `<div class="panel" style="overflow:auto">
    <table>
      <thead><tr><th>Date</th><th>Name</th><th>Phone</th><th>Tour</th><th>Message</th><th>Status</th><th></th></tr></thead>
      <tbody>${state.leads.map((l) => `<tr>
        <td>${escapeHtml((l.createdAt || "").slice(0, 16).replace("T", " "))}</td>
        <td>${escapeHtml(l.name)}<br><small>${escapeHtml(l.email)}</small></td>
        <td><a href="https://wa.me/${String(l.phone || "").replace(/\D/g, "")}" target="_blank" rel="noopener">${escapeHtml(l.phone)}</a></td>
        <td>${escapeHtml(l.tourName || "-")}<br><small>${escapeHtml(l.type || "enquiry")} · ${escapeHtml(l.travellers)} · ${escapeHtml(l.travelDate)}</small></td>
        <td>${escapeHtml(l.message)}</td>
        <td>
          <select data-st="${l.id}">
            <option ${l.status === "new" ? "selected" : ""}>new</option>
            <option ${l.status === "contacted" ? "selected" : ""}>contacted</option>
            <option ${l.status === "booked" ? "selected" : ""}>booked</option>
            <option ${l.status === "closed" ? "selected" : ""}>closed</option>
          </select>
        </td>
        <td><button class="btn warn" data-del="${escapeHtml(l.id)}">Delete</button></td>
      </tr>`).join("") || `<tr><td colspan="7">No leads yet. Use the public enquire form while this server is running.</td></tr>`}</tbody>
    </table>
  </div>`;
  viewEl.querySelectorAll("[data-st]").forEach((el) => {
    el.onchange = async () => {
      await api(`/api/enquiries/${el.dataset.st}`, { method: "PATCH", body: JSON.stringify({ status: el.value }) });
      const lead = state.leads.find((l) => l.id === el.dataset.st);
      if (lead) lead.status = el.value;
      showToast("Lead updated.");
    };
  });
  viewEl.querySelectorAll("[data-del]").forEach((el) => {
    el.onclick = async () => {
      await api(`/api/enquiries/${el.dataset.del}`, { method: "DELETE" });
      state.leads = state.leads.filter((l) => l.id !== el.dataset.del);
      render();
    };
  });
}

function renderBlog() {
  viewEl.innerHTML = `<button class="btn" id="addPost">Add post</button>
    ${state.blog.map((p, i) => `<div class="panel">
      <div class="grid2">
        <div><label>Title</label><input data-b="${i}" data-k="title" value="${escapeHtml(p.title)}"></div>
        <div><label>Date</label><input data-b="${i}" data-k="date" value="${escapeHtml(p.date)}"></div>
        <div><label>Cover URL</label><input data-b="${i}" data-k="cover" value="${escapeHtml(p.cover)}"></div>
        <div><label>SEO title</label><input data-b="${i}" data-k="seoTitle" value="${escapeHtml(p.seoTitle)}"></div>
        <div style="grid-column:1/-1"><label>Excerpt</label><input data-b="${i}" data-k="excerpt" value="${escapeHtml(p.excerpt)}"></div>
        <div style="grid-column:1/-1"><label>Body HTML</label><textarea data-b="${i}" data-k="body">${escapeHtml(p.body)}</textarea></div>
      </div>
      <label><input type="checkbox" data-pub="${i}" ${p.published !== false ? "checked" : ""}> Published</label>
      <button class="btn warn" data-del="${i}">Delete post</button>
    </div>`).join("")}`;
  document.getElementById("addPost").onclick = () => {
    state.blog.unshift({ id: `post-${Date.now()}`, title: "New post", slug: "", excerpt: "", cover: "", date: new Date().toISOString().slice(0, 10), author: "WanderVista", body: "<p></p>", published: true, seoTitle: "", seoDescription: "" });
    render();
  };
  viewEl.querySelectorAll("[data-b]").forEach((el) => {
    el.oninput = () => {
      state.blog[+el.dataset.b][el.dataset.k] = el.value;
      if (el.dataset.k === "title") state.blog[+el.dataset.b].slug = slugify(el.value);
    };
  });
  viewEl.querySelectorAll("[data-pub]").forEach((el) => {
    el.onchange = () => { state.blog[+el.dataset.pub].published = el.checked; };
  });
  viewEl.querySelectorAll("[data-del]").forEach((el) => {
    el.onclick = () => { state.blog.splice(+el.dataset.del, 1); render(); };
  });
}

function renderTestimonials() {
  viewEl.innerHTML = `<button class="btn" id="addT">Add testimonial</button>
    ${state.testimonials.map((t, i) => `<div class="panel grid2">
      <div><label>Name</label><input data-x="${i}" data-k="name" value="${escapeHtml(t.name)}"></div>
      <div><label>Role</label><input data-x="${i}" data-k="role" value="${escapeHtml(t.role)}"></div>
      <div style="grid-column:1/-1"><label>Quote</label><textarea data-x="${i}" data-k="quote">${escapeHtml(t.quote)}</textarea></div>
      <button class="btn warn" data-del="${i}">Delete</button>
    </div>`).join("")}`;
  document.getElementById("addT").onclick = () => {
    state.testimonials.push({ id: `t-${Date.now()}`, name: "", role: "", quote: "", rating: 5, published: true });
    render();
  };
  viewEl.querySelectorAll("[data-x]").forEach((el) => el.oninput = () => { state.testimonials[+el.dataset.x][el.dataset.k] = el.value; });
  viewEl.querySelectorAll("[data-del]").forEach((el) => el.onclick = () => { state.testimonials.splice(+el.dataset.del, 1); render(); });
}

function renderFaqs() {
  viewEl.innerHTML = `<button class="btn" id="addF">Add FAQ</button>
    ${state.faqs.map((f, i) => `<div class="panel">
      <label>Question</label><input data-f="${i}" data-k="q" value="${escapeHtml(f.q)}">
      <label>Answer</label><textarea data-f="${i}" data-k="a">${escapeHtml(f.a)}</textarea>
      <button class="btn warn" data-del="${i}">Delete</button>
    </div>`).join("")}`;
  document.getElementById("addF").onclick = () => { state.faqs.push({ q: "", a: "" }); render(); };
  viewEl.querySelectorAll("[data-f]").forEach((el) => el.oninput = () => { state.faqs[+el.dataset.f][el.dataset.k] = el.value; });
  viewEl.querySelectorAll("[data-del]").forEach((el) => el.onclick = () => { state.faqs.splice(+el.dataset.del, 1); render(); });
}

function renderSeo() {
  const s = state.settings;
  s.seo = s.seo || {};
  s.hero = s.hero || {};
  viewEl.innerHTML = `<div class="panel">
    <h3>Google Analytics (GA4)</h3>
    <label>Measurement ID</label>
    <input id="gaId" value="${escapeHtml(s.gaMeasurementId)}" placeholder="G-XXXXXXXX">
    <p class="muted">Paste your GA4 ID. It is injected on every public page after you save.</p>
  </div>
  <div class="panel">
    <h3>Default SEO</h3>
    <label>Site title</label><input id="seoTitle" value="${escapeHtml(s.seo.title)}">
    <label>Meta description</label><textarea id="seoDesc">${escapeHtml(s.seo.description)}</textarea>
    <label>Keywords</label><input id="seoKeys" value="${escapeHtml(s.seo.keywords)}">
    <label>Share image URL</label><input id="seoOg" value="${escapeHtml(s.seo.ogImage)}">
  </div>
  <div class="panel">
    <h3>Homepage hero</h3>
    <label>Eyebrow</label><input id="heroEy" value="${escapeHtml(s.hero.eyebrow)}">
    <label>Heading</label><input id="heroH" value="${escapeHtml(s.hero.heading)}">
    <label>Emphasis line</label><input id="heroE" value="${escapeHtml(s.hero.headingEm)}">
    <label>Intro text</label><textarea id="heroT">${escapeHtml(s.hero.text)}</textarea>
    <label>Hero image URL</label><input id="heroI" value="${escapeHtml(s.hero.image)}">
  </div>`;
  const map = [
    ["gaId", (v) => { s.gaMeasurementId = v; }],
    ["seoTitle", (v) => { s.seo.title = v; }],
    ["seoDesc", (v) => { s.seo.description = v; }],
    ["seoKeys", (v) => { s.seo.keywords = v; }],
    ["seoOg", (v) => { s.seo.ogImage = v; }],
    ["heroEy", (v) => { s.hero.eyebrow = v; }],
    ["heroH", (v) => { s.hero.heading = v; }],
    ["heroE", (v) => { s.hero.headingEm = v; }],
    ["heroT", (v) => { s.hero.text = v; }],
    ["heroI", (v) => { s.hero.image = v; }]
  ];
  map.forEach(([id, fn]) => document.getElementById(id).oninput = (e) => fn(e.target.value));
}

function renderSettings() {
  const s = state.settings;
  viewEl.innerHTML = `<div class="panel">
    <label>Brand</label><input id="brand" value="${escapeHtml(s.brand)}">
    <label>Phone</label><input id="phone" value="${escapeHtml(s.phone)}">
    <label>WhatsApp number with country code</label><input id="phoneIntl" value="${escapeHtml(s.phoneIntl)}">
    <label>Email</label><input id="email" value="${escapeHtml(s.email)}">
    <label>Default WhatsApp message</label><textarea id="wa">${escapeHtml(s.whatsappMessage)}</textarea>
  </div>
  <div class="panel">
    <h3>Change admin password</h3>
    <label>Current password</label><input id="curPass" type="password">
    <label>New password</label><input id="newPass" type="password">
    <button class="btn" id="passBtn" type="button">Update password</button>
  </div>`;
  ["brand", "phone", "phoneIntl", "email"].forEach((k) => {
    document.getElementById(k).oninput = (e) => { s[k] = e.target.value; };
  });
  document.getElementById("wa").oninput = (e) => { s.whatsappMessage = e.target.value; };
  document.getElementById("passBtn").onclick = async () => {
    try {
      await api("/api/password", { method: "POST", body: JSON.stringify({ currentPassword: document.getElementById("curPass").value, newPassword: document.getElementById("newPass").value }) });
      showToast("Password updated.");
    } catch (err) {
      showToast(err.message);
    }
  };
}

const titles = {
  overview: ["Overview", "Snapshot of tours and incoming leads"],
  tours: ["Tours", "Add, edit or delete destinations"],
  photos: ["Photo management", "Upload or paste image URLs per tour"],
  itinerary: ["Itinerary management", "Day-by-day plan for each tour"],
  leads: ["Enquiry / lead management", "Forms submitted while the admin server is running"],
  blog: ["Blog", "Publish travel notes without editing HTML"],
  testimonials: ["Testimonials", "Quotes shown on the homepage"],
  faqs: ["FAQ", "Answers shown on the homepage"],
  seo: ["SEO & Analytics", "Titles, descriptions and Google Analytics"],
  settings: ["Settings", "Phone, email and WhatsApp"]
};

function render() {
  const [title, hint] = titles[state.view];
  document.getElementById("viewTitle").textContent = title;
  document.getElementById("viewHint").textContent = hint;
  document.querySelectorAll(".side button[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === state.view));
  ({ overview: renderOverview, tours: renderTours, photos: renderPhotos, itinerary: renderItinerary, leads: renderLeads, blog: renderBlog, testimonials: renderTestimonials, faqs: renderFaqs, seo: renderSeo, settings: renderSettings })[state.view]();
}

async function saveAll() {
  await api("/api/tours", { method: "PUT", body: JSON.stringify(state.tours) });
  await api("/api/blog", { method: "PUT", body: JSON.stringify(state.blog) });
  await api("/api/testimonials", { method: "PUT", body: JSON.stringify(state.testimonials) });
  await api("/api/faqs", { method: "PUT", body: JSON.stringify(state.faqs) });
  await api("/api/settings", { method: "PUT", body: JSON.stringify(state.settings) });
  showToast("Saved to data files. Refresh the public site to see changes.");
}

async function bootApp() {
  const [tours, blog, testimonials, faqs, settings, leads] = await Promise.all([
    api("/api/tours"), api("/api/blog"), api("/api/testimonials"), api("/api/faqs"), api("/api/settings"), api("/api/enquiries")
  ]);
  Object.assign(state, { tours, blog, testimonials, faqs, settings, leads });
  document.getElementById("loginView").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  render();
}

document.querySelectorAll(".side button[data-view]").forEach((b) => {
  b.onclick = () => { state.view = b.dataset.view; render(); };
});
document.getElementById("saveBtn").onclick = () => saveAll().catch((e) => showToast(e.message));
document.getElementById("logout").onclick = async () => {
  await api("/api/logout", { method: "POST" });
  location.reload();
};
document.getElementById("loginForm").onsubmit = async (e) => {
  e.preventDefault();
  try {
    await api("/api/login", { method: "POST", body: JSON.stringify({ password: document.getElementById("password").value }) });
    await bootApp();
  } catch (err) {
    document.getElementById("loginError").textContent = err.message + " Start the site with npm start if this page was opened as a file.";
  }
};

api("/api/session").then((s) => { if (s.authenticated) bootApp(); }).catch(() => {});
