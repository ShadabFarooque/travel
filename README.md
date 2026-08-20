# WanderVista Group Tours

Professional group-tour website with a local admin dashboard. Public pages read JSON files — you no longer edit one large `index.html` to change tours, photos, itineraries, blog posts or SEO.

## Daily workflow

Install [Node.js LTS](https://nodejs.org) first, then in this folder run:

```
npm install
npm start
```

2. Open [http://localhost:3000](http://localhost:3000) for the public site.
3. Open [http://localhost:3000/admin](http://localhost:3000/admin) for the dashboard.

Set `ADMIN_PASSWORD` to a unique password of at least 12 characters before the first start.

4. Click **Save changes** after editing. Files update under `travel_guide_website/data/`.
5. Refresh the public site. When you are ready to publish, commit and push (GitHub Pages still deploys `travel_guide_website`).

## Admin dashboard

| Section | What it does |
| --- | --- |
| Tours | Add / edit / delete destinations, cover, price, SEO, highlights |
| Photos | Reorder, remove, paste URLs, or upload into `assets/uploads/` |
| Itinerary | Day-by-day city, highlights and overnight |
| Leads | Enquiry and booking form submissions (stored privately in `data/enquiries.json`) |
| Blog | Posts shown on `/blog.html` |
| Testimonials | Homepage quotes |
| FAQ | Homepage accordion |
| SEO & Analytics | Meta tags, share image, homepage hero, Google Analytics GA4 ID (`G-XXXXXXXX`) |
| Settings | Phone, email, WhatsApp number and default message |

## Public pages

- `index.html` — home
- `tours.html` — all tours
- `tour.html?id=japan` — itinerary, gallery, enquiry form
- `blog.html` / `post.html?id=...`
- `enquire.html` — booking / enquiry form + WhatsApp

WhatsApp uses the international number in Settings (`phoneIntl`, e.g. `919986008726`).

## Google Analytics

Paste your GA4 Measurement ID in **SEO & Analytics** and save. The public site loads `gtag.js` automatically.

## GitHub Pages

The workflow still publishes `travel_guide_website`. The admin API only runs on your computer (`npm start`). Leads are captured when visitors use the form against that server, or when they tap WhatsApp on the live site.

Set `ADMIN_PASSWORD` in the environment before the first start. The server refuses to start without it when creating the admin secret.
