GEF & JINI - SHARED GALLERY (HTML + CSS + JavaScript + Supabase)

SET UP (once)
1. Supabase > SQL Editor > New query: paste supabase/setup.sql and Run. (Safe to run again.)
2. Open config.js and paste your Project URL and your PUBLISHABLE key
   (the same two values as NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local).
   NEVER paste the secret / service_role key here.
3. Accounts: use the ones you made with "npm run admins" (gef and jini, with the passwords you chose).
   If you haven't made them: Supabase > Authentication > Users > Add user,
   email gef@gefandjini.app and jini@gefandjini.app, tick "Auto confirm", choose passwords.
   Also keep "Allow new users to sign up" turned OFF.

RUN
VS Code > Open Folder > this folder > Live Server > Go Live. Sign in as Gef or Jini.

PUT IT ONLINE SO YOU BOTH CAN USE IT
Upload this folder to a PRIVATE GitHub repository, add your partner as a collaborator,
then connect the repo to Vercel, Netlify or Cloudflare Pages (static site, no build command).
config.js only holds the public key, so it is safe to commit. Never commit the secret key.

FILE SIZE LIMITS (set by Supabase, not by this app)
Free plan: 1 GB total, 50 MB per file. Bigger files need a paid Supabase plan; then raise the limit in
Supabase > Storage > Settings. Files over 6 MB upload in resumable pieces.

FILES
index.html, styles.css, app.js (screens), store.js (Supabase), config.js (your keys), assets/ (pictures)
