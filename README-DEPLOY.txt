OIVET Student Verification - Cloudflare Workers + D1

Features in this build:
- Admin login protected by Worker secret ADMIN_PASSWORD
- Main/Header Logo change from Admin
- Top Banner change from Admin
- Verification Stamp change from Admin
- Footer Logo change from Admin
- Facebook, Twitter/X, Instagram, LinkedIn links
- WhatsApp number + floating WhatsApp button
- Website title
- Student records Add / Edit / Delete / Search
- Student photo upload/change
- Public verification using D1

Deploy:
1. Use Cloudflare Workers Git/Wrangler deployment for this project; do NOT use the old static-only upload screen because the API needs a Worker.
2. Bind D1 database `oivet-student` to the Worker with variable name `DB`.
3. Add Worker secret `ADMIN_PASSWORD`.
4. Run schema.sql in D1 if the tables are not already present.
5. Open /admin.html and log in.
6. Save Website Settings first, then add student records
