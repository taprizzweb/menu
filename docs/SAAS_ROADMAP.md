# Premium menu + growth platform: audit and roadmap

Written when the owner asked to grow GoToMenu from a table-ordering app into a full restaurant menu SaaS. Status column is honest: "done" means built, tested and live on staging.

## Already built (do not rebuild)
| Area | Status |
|---|---|
| Multi-tenant base: restaurants, roles (platform admin, owner, manager, waiter, kitchen), RLS on every table, server-side role checks, audit log | done |
| Public menu `/{slug}`: categories with sticky tabs, search, veg/jain/bestseller filters, dish cards with photo, diet mark, spice, badges, sold-out | done |
| Table QR (per-table tokens, rotate, print layouts), table ordering, live staff screen, bill / waiter calls | done |
| Owner dashboard: menu manager (photos, reorder, bulk price, CSV import/export), tables, staff, settings (name, accent colour, Google review link), report, activity log | done |
| Platform admin: create / suspend restaurants, plan + paid-until, logins (add, reset password, change email), export, delete | done |
| Security: strict CSP, origin checks, rate limits, threat model | done |

## Added in this step (Phase 1, slice 1)
Public profile: tagline, about, logo, banner, phone, WhatsApp, address, opening hours text, Instagram. The public menu shows a hero (banner, logo, name) and buttons only for what the owner filled in: Call, WhatsApp (pre-filled, correctly encoded message), Directions (Google Maps search), Instagram, "Review us on Google" (with a note that the review is written on Google). Migration `0017_restaurant_profile.sql`.

## Not built yet (recommended order)
1. **Phase 1 slice 2: look and feel.** Several design templates (minimal, dark, warm, elegant, bright), dish detail view, featured section, category images, image fallbacks and loading skeletons. Needs real food photos from restaurants to look premium.
2. **Phase 1 slice 3: measured analytics.** Event table (menu opened, QR landing, category, item, search, WhatsApp click, Google click), daily sessions with de-duplication, 90-day retention, dashboard overview with date filter, CSV export. Metrics will be labelled "measured" and explained.
3. **Phase 2:** NFC / QR card manager (`/r/{id}` redirect with an allow-list so it cannot become an open redirect, scan counts), feedback module (rating, categories, comment, export, kept separate from Google), promotions with start / end dates, item variants and add-ons, plan entitlements and limits editable by the platform admin.
4. **Phase 3:** payments and subscriptions (needs a provider account; Razorpay is the usual choice in India), AI description helper (needs an API key and a monthly budget), multi-location, additional languages (Hindi fields already exist in the database; owner-supplied text only).

## Needs a decision or an account before it can be built
- **Payment provider** for subscriptions (and for guest payments, if ever): choose one, create the account, give test keys. Until then billing stays "plan + paid until" set by the platform admin.
- **AI provider key** and a monthly spending cap, for the description assistant.
- **Plan names, limits and prices** (Starter / Pro / Growth): owner decision.
- **WhatsApp Business Platform** (official API) is optional and has per-conversation fees; plain wa.me links need nothing.
- **Real photos and logos** for the demo restaurant.

## Known limitations of what exists today
- One language in the guest UI (English); templates and analytics do not exist yet.
- Ordering is tied to a table QR (guests without a table QR can only browse). Online payment is not implemented; the bill is settled at the table.
