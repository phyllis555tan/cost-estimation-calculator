# Deploy to Vercel + Supabase

About 20 minutes. You need a GitHub account (this repo), a Supabase account and a Vercel account. All three have free plans.

Dashboard menus change from time to time. If a label below does not match exactly, look for the closest one.

## What you get

- The estimator and drawing board on a Vercel web address.
- **Only you can log in.** Your projects and rates are saved online and open on any device.
- A **private share link** per project. Your client sees the plan, furniture and mood board. They never see prices, budget or rates.

## Part 1: Supabase (the database and login)

1. Go to supabase.com and create a **New project**. Pick the region closest to you (Singapore is the nearest for Penang). Choose a strong database password and keep it in a password manager. You will not need it again for this app.
2. Open **SQL Editor**, choose **New query**, paste the whole of `supabase/migrations/001_init.sql`, and press **Run**. It should finish with "Success". This creates the tables and the rule that only the signed-in owner can read them.
3. Turn off public sign-ups so nobody else can create an account. Go to **Authentication**, then the sign-in / providers settings, and switch off **Allow new users to sign up**. (If you skip this, a stranger could register their own account. They still could not see your data, but turn it off anyway.)
4. Create your own login. Go to **Authentication**, then **Users**, then **Add user**. Enter your email and a strong password, and tick the option that confirms the email automatically.
5. Copy two values from **Project Settings**, then **API** (or **API Keys**):
   - **Project URL**, which looks like `https://abcdxyz.supabase.co`
   - the **anon** key (also called the **publishable** key)

   **Never use the `service_role` or `secret` key.** The build stops with an error if you paste one by mistake.

## Part 2: Vercel (the website)

1. Make sure this repo is on GitHub (https://github.com/phyllis555tan/cost-estimation-calculator).
2. In Vercel choose **Add New**, then **Project**, and import the repo.
3. Leave the framework as **Other**. The settings come from `vercel.json` (build command `node scripts/build.js`, output folder `dist`).
4. Open **Environment Variables** and add these for Production and Preview:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | the Project URL from Part 1 |
   | `SUPABASE_ANON_KEY` | the anon / publishable key from Part 1 |

5. Press **Deploy**.
6. Back in Supabase, go to **Authentication**, then **URL Configuration**, and set the **Site URL** to your Vercel address (for example `https://your-project.vercel.app`).

Every push to GitHub redeploys the site automatically. If you change the environment variables later, redeploy once so the new values are built in.

## Part 3: Check that it works

1. Open your Vercel address. At the top you should see a sign-in box, not "Cloud saving is off".
2. Sign in with the login from step 4. Trace a room, name the project, press **Save project**.
3. Refresh the page, sign in again, and open the project from the list. Your work should come back.
4. Press **Share with client**, copy the link, and open it in a **private / incognito window**. You should see the plan and furniture and no prices.
5. Press **Stop sharing**. Reload the link in the private window. It should say the link is no longer active.

## Things to know

- **A share link works for anyone who has it.** Treat it like a key. Stopping sharing turns that link off for good, and sharing again makes a new one.
- **Images are saved inside the project.** Mood board photos are shrunk to about 1200 px, but many images make a project heavy. The app warns you above about 6 MB. Moving images to Supabase Storage is a possible next step.
- **Free Supabase projects pause after a week with no activity.** Open the dashboard and press Restore if that happens. Projects are not deleted.
- **Backups:** use **Export project (JSON)** on the Final tab for jobs you care about, in addition to the cloud copy.
- **Rates:** enter your real rates, press **Save my rates**, then tick "I have entered my real rates" on the Cost tab.
- **Forgotten password:** reset it from Supabase, **Authentication**, **Users**.

## Run it on your own computer (optional)

```
node scripts/build.js
```

Then open `dist/index.html` through any local web server. Without the two environment variables, the app still works and saves in the browser only.

## What has and has not been tested

Tested: the build script (it refuses secret keys and wrong URLs), the page under the same security headers Vercel will send, and the sign-in, save, re-save, share, unshare, open, delete and rates logic against an in-memory stand-in for Supabase.

**Not tested:** the SQL against a real Supabase project, real sign-in, and a real Vercel deploy. Run Part 3 after deploying, and tell me about anything that does not behave as described.
