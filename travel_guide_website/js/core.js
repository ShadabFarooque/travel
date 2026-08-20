const DATA_BASE = new URL("../data/", import.meta.url).href;

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

export function safeUrl(value) {
  const url = String(value || "").trim();
  if (/['"<>`\\\r\n]/.test(url)) return "";
  if (/^(https?:\/\/|\/|assets\/|\.\.\/)/i.test(url)) return url;
  return "";
}

export function sanitizeHtml(value) {
  const template = document.createElement("template");
  template.innerHTML = String(value || "");
  template.content.querySelectorAll("script,style,iframe,object,embed,form").forEach((node) => node.remove());
  template.content.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      if (/^on/i.test(attribute.name)) node.removeAttribute(attribute.name);
      if (["href", "src", "action"].includes(attribute.name) && !/^(https?:\/\/|\/|assets\/|\.\.\/|#)/i.test(attribute.value.trim())) node.removeAttribute(attribute.name);
    });
  });
  return template.innerHTML;
}

export async function loadJson(name, fallback) {
  try {
    const res = await fetch(`${DATA_BASE}${name}?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

export async function loadSite() {
  const [settings, tours, blog, testimonials, faqs] = await Promise.all([
    loadJson("settings.json", {}),
    loadJson("tours.json", []),
    loadJson("blog.json", []),
    loadJson("testimonials.json", []),
    loadJson("faqs.json", [])
  ]);
  return { settings, tours, blog, testimonials, faqs };
}

export function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

export function waLink(settings, extra = "") {
  const phone = (settings.phoneIntl || settings.phone || "").replace(/\D/g, "");
  const text = encodeURIComponent([settings.whatsappMessage || "Hi WanderVista,", extra].filter(Boolean).join(" "));
  return `https://wa.me/${phone}?text=${text}`;
}

export function applySeo(settings, override = {}) {
  const seo = { ...(settings.seo || {}), ...override };
  document.title = seo.title || "WanderVista Group Tours";
  const set = (attr, key, value) => {
    if (!value) return;
    let el = document.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute("content", value);
  };
  set("name", "description", seo.description);
  set("name", "keywords", seo.keywords);
  set("property", "og:title", seo.title);
  set("property", "og:description", seo.description);
  set("property", "og:image", seo.ogImage);
  set("name", "twitter:card", "summary_large_image");
}

export function injectAnalytics(id) {
  if (!id || document.getElementById("ga-src")) return;
  const s = document.createElement("script");
  s.id = "ga-src";
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(){ window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", id);
}

export function renderLayout(settings) {
  const brand = escapeHtml(settings.brand || "Wander");
  const whatsapp = escapeHtml(waLink(settings));
  const nav = document.getElementById("nav");
  if (nav) {
    nav.innerHTML = `<div class="container nav-inner">
      <a class="logo" href="index.html">${brand}<span>Vista</span></a>
      <button class="nav-toggle" id="navToggle" aria-label="Menu">☰</button>
      <div class="nav-links" id="navLinks">
        <a href="tours.html">Tours</a>
        <a href="blog.html">Blog</a>
        <a href="enquire.html">Enquire</a>
        <a href="index.html#faq">FAQ</a>
        <a href="${whatsapp}" target="_blank" rel="noopener">WhatsApp</a>
      </div>
      <a class="cta" href="enquire.html">Book / Enquire</a>
    </div>`;
    document.getElementById("navToggle")?.addEventListener("click", () => {
      document.getElementById("navLinks")?.classList.toggle("open");
    });
  }
  const footer = document.getElementById("site-footer");
  if (footer) {
    footer.innerHTML = `<div class="container">© ${new Date().getFullYear()} ${escapeHtml(settings.brand || "WanderVista")} Group Tours · International group travel</div>`;
  }
  if (!document.getElementById("org-ld")) {
    const ld = document.createElement("script");
    ld.id = "org-ld";
    ld.type = "application/ld+json";
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "TravelAgency",
      name: `${settings.brand || "WanderVista"} Group Tours`,
      telephone: settings.phone,
      email: settings.email,
      url: location.href.split("#")[0]
    });
    document.head.appendChild(ld);
  }
  if (!document.querySelector(".wa-float")) {
    const a = document.createElement("a");
    a.className = "wa-float";
    a.href = waLink(settings);
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "WhatsApp";
    document.body.appendChild(a);
  }
  window.addEventListener("scroll", () => nav?.classList.toggle("scrolled", scrollY > 30));
}

export function tourCard(tour) {
  const gallery = (tour.gallery && tour.gallery.length) ? tour.gallery : [tour.hero].filter(Boolean);
  const rows = (tour.itinerary || []).map((it) => `<tr><td>Day ${escapeHtml(it.day)}</td><td>${escapeHtml(it.city)}</td><td>${escapeHtml(it.highlights)}</td><td>${escapeHtml(it.night)}</td></tr>`).join("");
  const itineraryHTML = rows ? `<div class="itinerary"><h4>Itinerary</h4><table class="itinerary-table"><tbody>${rows}</tbody></table></div>` : "";
  const video = safeUrl(tour.video);
  const hero = escapeHtml(safeUrl(tour.hero));
  const videoHTML = video ? `<div class="video-preview" data-video-src="${escapeHtml(video)}"><video muted playsinline preload="metadata"><source src="${escapeHtml(video)}" type="video/mp4"></video></div>` : "";
  return `<article class="destination" data-tour-id="${escapeHtml(tour.id)}">
    <a href="tour.html?id=${encodeURIComponent(tour.id)}">
      <div class="dest-cover" style="background-image:url('${hero}')">
        <img class="cover-img" src="${hero}" alt="${escapeHtml(tour.name)}">
        <span class="badge">${tour.status === "upcoming" ? "UPCOMING" : "GROUP TOURED"}</span>
        <div class="dest-title"><h3>${escapeHtml(tour.flag || "")} ${escapeHtml(tour.name)}</h3><span>${escapeHtml(tour.region || "")}</span></div>
      </div>
    </a>
    <div class="dest-body">
      <p>${escapeHtml(tour.description)}</p>
      <div class="explore"><a href="tour.html?id=${encodeURIComponent(tour.id)}">View ${escapeHtml(tour.name)}</a><button class="toggle" type="button">＋</button></div>
      <div class="details">
        ${videoHTML}
        <div class="gallery">${gallery.map((src) => `<img loading="lazy" src="${escapeHtml(safeUrl(src))}" alt="${escapeHtml(tour.name)}">`).join("")}</div>
        <div class="attractions">${(tour.sights || []).map((s) => `<span class="chip">${escapeHtml(s)}</span>`).join("")}</div>
        ${itineraryHTML}
      </div>
    </div>
  </article>`;
}

export function bindFaq() {
  document.querySelectorAll(".faq-item").forEach((item) => {
    item.querySelector(".faq-question")?.addEventListener("click", () => item.classList.toggle("open"));
  });
}

export function bindGallery() {
  const modal = document.getElementById("galleryModal");
  if (!modal) return;
  const mainImg = document.getElementById("galleryMainImg");
  const mainVid = document.getElementById("galleryMainVid");
  const thumbs = document.getElementById("galleryThumbs");
  let list = [];
  let index = 0;

  function show(i) {
    const item = list[i];
    if (!item) return;
    index = i;
    if (item.type === "video") {
      mainImg.style.display = "none";
      mainVid.style.display = "block";
      mainVid.src = item.src;
      mainVid.play?.();
    } else {
      mainVid.pause?.();
      mainVid.src = "";
      mainVid.style.display = "none";
      mainImg.style.display = "block";
      mainImg.src = item.src;
    }
    [...thumbs.children].forEach((t, idx) => t.classList.toggle("active", idx === i));
  }

  document.addEventListener("click", (e) => {
    const preview = e.target.closest(".video-preview");
    if (preview?.dataset.videoSrc) {
      list = [{ type: "video", src: preview.dataset.videoSrc }];
      thumbs.innerHTML = "";
      modal.classList.add("open");
      show(0);
      return;
    }
    const toggle = e.target.closest(".toggle");
    if (!toggle) return;
    const card = toggle.closest(".destination");
    const imgs = [...(card?.querySelectorAll(".gallery img") || [])].map((img) => ({ type: "image", src: img.src }));
    if (!imgs.length) return;
    list = imgs;
    thumbs.innerHTML = "";
    list.forEach((it, idx) => {
      const t = document.createElement("img");
      t.src = it.src;
      t.addEventListener("click", () => show(idx));
      thumbs.appendChild(t);
    });
    modal.classList.add("open");
    show(0);
  });

  document.getElementById("galleryClose")?.addEventListener("click", () => {
    modal.classList.remove("open");
    mainVid.pause?.();
  });
  document.getElementById("galleryPrev")?.addEventListener("click", () => show((index - 1 + list.length) % list.length));
  document.getElementById("galleryNext")?.addEventListener("click", () => show((index + 1) % list.length));
}

export function galleryMarkup() {
  return `<div id="galleryModal" class="gallery-modal" aria-hidden="true">
    <div class="frame">
      <div class="viewer">
        <img id="galleryMainImg" alt="">
        <video id="galleryMainVid" controls style="display:none;width:100%"></video>
        <div class="thumbs" id="galleryThumbs"></div>
      </div>
      <div class="controls">
        <button class="close-btn" id="galleryClose" type="button">✕</button>
        <div style="display:flex;gap:8px">
          <button class="nav-btn" id="galleryPrev" type="button">◀</button>
          <button class="nav-btn" id="galleryNext" type="button">▶</button>
        </div>
      </div>
    </div>
  </div>`;
}
