import {
  loadSite, qs, waLink, applySeo, injectAnalytics, renderLayout,
  tourCard, bindFaq, bindGallery, galleryMarkup
} from "./core.js";

const page = document.body.dataset.page;

function formHtml(tours, selectedId = "") {
  const options = tours.map((t) => `<option value="${t.id}" ${t.id === selectedId ? "selected" : ""}>${t.flag || ""} ${t.name}</option>`).join("");
  return `<form class="form-card" id="enquiryForm">
    <div class="form-grid">
      <div><label>Name</label><input name="name" required></div>
      <div><label>Phone</label><input name="phone" required></div>
      <div><label>Email</label><input name="email" type="email"></div>
      <div><label>Travellers</label><input name="travellers" placeholder="e.g. 4"></div>
      <div><label>Preferred tour</label><select name="tourId"><option value="">Any / not sure</option>${options}</select></div>
      <div><label>I want to</label><select name="type"><option value="enquiry">Enquire</option><option value="booking">Request a booking</option></select></div>
      <div><label>Travel date</label><input name="travelDate" type="month"></div>
      <div class="full"><label>Message</label><textarea name="message" placeholder="Tell us about your group"></textarea></div>
    </div>
    <div class="form-actions">
      <button class="btn solid" type="submit">Send enquiry</button>
      <button class="btn ghost" type="submit" name="via" value="whatsapp">Send on WhatsApp</button>
    </div>
    <p id="formStatus" class="lead"></p>
  </form>`;
}

function bindEnquiry(settings, tours) {
  const form = document.getElementById("enquiryForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const tour = tours.find((t) => t.id === data.tourId);
    data.tourName = tour ? tour.name : "";
    data.type = data.type === "booking" ? "booking" : "enquiry";
    const status = document.getElementById("formStatus");
    const viaWhatsApp = e.submitter?.value === "whatsapp";
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (res.ok) status.textContent = "Enquiry saved. We will contact you shortly.";
      else status.textContent = "Form received locally — continuing via WhatsApp or email.";
    } catch {
      status.textContent = "Server offline — opening WhatsApp so the enquiry still reaches us.";
    }
    if (viaWhatsApp) {
      const extra = `Name: ${data.name}. Phone: ${data.phone}. Tour: ${data.tourName || "any"}. Travellers: ${data.travellers || "-"}. Date: ${data.travelDate || "-"}. ${data.message || ""}`;
      window.open(waLink(settings, extra), "_blank");
    }
  });
}

const { settings, tours, blog, testimonials, faqs } = await loadSite();
applySeo(settings);
injectAnalytics(settings.gaMeasurementId);
renderLayout(settings);
if (!document.getElementById("galleryModal")) {
  document.body.insertAdjacentHTML("beforeend", galleryMarkup());
}
bindGallery();

if (page === "home") {
  const hero = settings.hero || {};
  const heroEl = document.querySelector(".hero");
  if (heroEl && hero.image) heroEl.style.setProperty("--hero-image", `url("${hero.image}")`);
  document.getElementById("heroEyebrow").textContent = `✦ ${hero.eyebrow || ""}`;
  document.getElementById("heroHeading").innerHTML = `${hero.heading || ""}<br><em>${hero.headingEm || ""}</em>`;
  document.getElementById("heroText").textContent = hero.text || "";
  document.getElementById("stats").innerHTML = (settings.stats || []).map((s) => `<div class="stat"><strong>${s.value}</strong><span>${s.label}</span></div>`).join("");
  const up = settings.upcoming || {};
  document.getElementById("upcomingBlock").innerHTML = `
    <div>
      <div class="tag">${up.tag || ""}</div>
      <h3>${up.title || ""}</h3>
      <p>${up.text || ""}</p>
      <div class="upcoming-list">${(up.pills || []).map((p) => `<div class="pill">${p}</div>`).join("")}</div>
    </div>
    <div style="display:flex;align-items:center;justify-content:center;position:relative;z-index:2">
      <a class="btn primary" href="tour.html?id=${encodeURIComponent(up.ctaTourId || "japan")}">View itinerary</a>
    </div>`;
  document.getElementById("destinationGrid").innerHTML = tours.map(tourCard).join("");
  document.getElementById("videoGrid").innerHTML = (settings.videos || []).map((v) => `
    <article class="video-card">
      <div class="video-frame"><video class="preview-video" muted playsinline autoplay loop src="${v.src}"></video></div>
      <div class="video-copy"><h3>${v.title}</h3><p>${v.text}</p></div>
    </article>`).join("");
  const about = settings.about || {};
  document.querySelector(".why-image")?.style.setProperty("background-image", `url("${about.image}")`);
  document.getElementById("aboutCopy").innerHTML = `
    <div class="kicker">${about.kicker || ""}</div>
    <h2>${about.heading || ""}</h2>
    <p class="lead">${about.text || ""}</p>
    <div class="feature-list">${(about.features || []).map((f) => `<div class="feature"><div class="icon">${f.icon}</div><div><h4>${f.title}</h4><p>${f.text}</p></div></div>`).join("")}</div>`;
  document.getElementById("testimonialGrid").innerHTML = testimonials.filter((t) => t.published !== false).map((t) => `
    <article class="quote"><p>“${t.quote}”</p><b>${t.name}</b><span>${t.role || ""}</span></article>`).join("");
  document.getElementById("blogPreview").innerHTML = blog.filter((p) => p.published !== false).slice(0, 3).map((p) => `
    <article class="card"><a href="post.html?id=${encodeURIComponent(p.id)}"><div class="dest-cover" style="background-image:url('${p.cover}')"></div></a>
    <div class="card-body"><h3>${p.title}</h3><p>${p.excerpt}</p><a href="post.html?id=${encodeURIComponent(p.id)}">Read more</a></div></article>`).join("");
  document.getElementById("faqList").innerHTML = faqs.map((f) => `<div class="faq-item"><div class="faq-question">${f.q} <span>▼</span></div><div class="faq-answer">${f.a}</div></div>`).join("");
  bindFaq();
  document.getElementById("contactBlock").innerHTML = `
    <div>
      <div class="kicker" style="color:#ffd18d">Let's plan your next journey</div>
      <h2>Ready to see the world?</h2>
      <p>Ask about upcoming group tours, custom departures, family groups or corporate travel.</p>
    </div>
    <div class="contact-card">
      <div class="contact-row"><span>📞</span><div><b>${settings.phone}</b><span>Call / WhatsApp</span></div></div>
      <div class="contact-row"><span>✉️</span><div><b>${settings.email}</b><span>Email for itineraries & enquiries</span></div></div>
      <a class="btn primary" href="enquire.html">Send an enquiry →</a>
      <a class="btn secondary" href="${waLink(settings)}" target="_blank" rel="noopener">Chat on WhatsApp</a>
    </div>`;
}

if (page === "tours") {
  document.getElementById("destinationGrid").innerHTML = tours.map(tourCard).join("");
}

if (page === "tour") {
  const tour = tours.find((t) => t.id === qs("id")) || tours[0];
  if (tour) {
    applySeo(settings, { title: tour.seoTitle || `${tour.name} | WanderVista`, description: tour.seoDescription || tour.description, ogImage: tour.hero });
    document.getElementById("tourMain").innerHTML = `
      <div class="tour-hero-img" style="background-image:url('${tour.hero}')"></div>
      <div class="kicker">${tour.region}</div>
      <h1>${tour.flag || ""} ${tour.name}</h1>
      <p class="lead">${tour.description}</p>
      <p>${tour.duration ? `<b>Duration:</b> ${tour.duration}` : ""} ${tour.priceFrom ? ` · <b>From:</b> ${tour.priceFrom}` : ""}</p>
      <div class="attractions" style="margin:18px 0">${(tour.sights || []).map((s) => `<span class="chip">${s}</span>`).join("")}</div>
      <div class="gallery">${(tour.gallery?.length ? tour.gallery : [tour.hero]).map((src) => `<img src="${src}" alt="${tour.name}">`).join("")}</div>
      ${tour.itinerary?.length ? `<div class="itinerary"><h2>Itinerary</h2><table class="itinerary-table"><thead><tr><td>Day</td><td>City</td><td>Highlights</td><td>Night</td></tr></thead><tbody>${tour.itinerary.map((it) => `<tr><td>Day ${it.day}</td><td>${it.city}</td><td>${it.highlights}</td><td>${it.night}</td></tr>`).join("")}</tbody></table></div>` : ""}
      <div style="margin-top:28px">${formHtml(tours, tour.id)}</div>`;
    bindEnquiry(settings, tours);
  }
}

if (page === "blog") {
  document.getElementById("blogGrid").innerHTML = blog.filter((p) => p.published !== false).map((p) => `
    <article class="card"><a href="post.html?id=${encodeURIComponent(p.id)}"><div class="dest-cover" style="background-image:url('${p.cover}')"></div></a>
    <div class="card-body"><div class="kicker">${p.date || ""}</div><h3>${p.title}</h3><p>${p.excerpt}</p></div></article>`).join("");
}

if (page === "post") {
  const post = blog.find((p) => p.id === qs("id")) || blog[0];
  if (post) {
    applySeo(settings, { title: post.seoTitle || post.title, description: post.seoDescription || post.excerpt, ogImage: post.cover });
    document.getElementById("postMain").innerHTML = `
      <div class="kicker">${post.date || ""} · ${post.author || ""}</div>
      <h1>${post.title}</h1>
      ${post.cover ? `<div class="tour-hero-img" style="background-image:url('${post.cover}')"></div>` : ""}
      <div class="prose">${post.body || ""}</div>`;
  }
}

if (page === "enquire") {
  document.getElementById("enquireFormWrap").innerHTML = formHtml(tours, qs("tour") || "");
  bindEnquiry(settings, tours);
}
