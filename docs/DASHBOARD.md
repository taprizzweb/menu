# Owner / manager dashboard (Phase 4)

Open `/dash` after signing in as an owner or manager (the staff screen has an "Open dashboard" button in its Account menu).
Waiters and kitchen staff are sent back to the live screen.

| Page | What it does | Who can change things |
|---|---|---|
| Menu | Categories, dishes, photos, prices, veg / non-veg / egg / Jain, spice, badges, sold out. Reorder with ↑/↓ buttons or by dragging (desktop). Select several dishes for bulk sold-out / bulk price change. Duplicate a dish. Import and export CSV. | Owner, manager |
| Tables & QR | Create tables 1…N, rename, switch off, make a new QR (old printed code stops working), print an A4 QR sheet or table tents. | Owner, manager |
| Staff | Add a person (temporary password shown once), change name/role, deactivate, reset password. | Owner (manager can only view) |
| Settings | Restaurant name, Google review link, accent colour, amber/red waiting minutes. Plan and paid-until are shown read-only. | Owner (manager can only view) |
| Report | Today / 7 days / 30 days: orders, average order, total sales, top 10 dishes, busiest hours, review-button taps (India time). | Owner, manager (read) |
| Activity log | Who changed what, newest first. Cannot be edited. | Owner, manager (read) |

## CSV format
Columns: `category,name,description,price,diet,spice,bestseller,chef_pick,available`. Price is in rupees. `diet` is veg, nonveg, egg or jain.
`bestseller`, `chef_pick`, `available` are yes/no. A dish with the same category and name is updated; others are added. Download the sample from the import dialog.

## How it is protected
- Every action is one JSON call to `/api/dash/<action>` (origin check, JSON only, 16 KB limit, zod validation) that runs a SQL function as the signed-in user; the database re-checks the role and the restaurant.
- Staff-account actions use the Auth admin API on the server, only after the owner is verified twice. Temporary passwords are random, shown once and never logged.
- A person with a temporary password can do nothing except choose their own password (`/account/password`).
