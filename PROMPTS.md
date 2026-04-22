# AI Prompts Used

This file documents all AI prompts used during development of cf_ai_standup, as required by the Cloudflare assignment.

## Prompt 1 — Initial Project Setup

Create a new project called cf_ai_standup. This is an AI-powered daily standup bot built on Cloudflare.

The app has two parts:

BACKEND - Cloudflare Worker + Durable Object:
- Create a Cloudflare Worker as the API
- Use a Durable Object called StandupMemory to store standup history per user (keyed by a simple userId stored in localStorage)
- The Durable Object stores an array of standup entries, each with: date, raw input, and formatted summary
- Create these API endpoints:
  POST /api/standup — accepts { userId, message }, calls Llama 3.3 via Workers AI to format it into standup format (Yesterday: X, Today: X, Blockers: X), saves to Durable Object, returns formatted standup
  GET /api/history/:userId — returns last 7 standups from Durable Object
  POST /api/weekly/:userId — calls Llama 3.3 to generate a weekly summary from the last 7 standups

FRONTEND - Simple HTML/CSS/JS page (no framework needed):
- Clean minimal UI with dark theme
- Text area where user types what they worked on in plain English
- "Generate Standup" button that hits POST /api/standup
- Shows the AI-formatted standup result below
- Shows history of past standups in a sidebar
- "Weekly Summary" button that generates a summary of the week
- Store userId as a random UUID in localStorage so history persists per browser

Use wrangler.toml to configure the Worker and Durable Object binding.

Create a README.md with:
- Project name and description
- Features list
- Tech stack (Cloudflare Workers, Durable Objects, Workers AI, Llama 3.3)
- Local setup instructions
- Deployment instructions
- A placeholder for the live deployed URL

Create a PROMPTS.md file with this exact content:

# AI Prompts Used

This file documents all AI prompts used during development of cf_ai_standup, as required by the Cloudflare assignment.

## Prompt 1 — Initial Project Setup

[paste this entire prompt verbatim here]

---

Note: Additional prompts will be appended as development continues.

Do not add any co-authored-by trailers to git commits. Commit with only my name and email.

---

## Prompt 2 — Polish

Add these polish features to cf_ai_standup:
- Copy to clipboard button on the formatted standup output
- Date header showing today's date on the standup
- If the user hasn't done a standup today show "No standup yet today" in the history
- Weekly summary appears in a modal overlay
- Make the UI fully mobile responsive
- Add a loading spinner while AI is generating
- Add a character counter on the input textarea
- If the input is empty and user clicks Generate show an inline error message

Then append this prompt to PROMPTS.md as Prompt 2.
Do not add any co-authored-by trailers to git commits.

---

## Prompt 3 — Deployment

Deploy cf_ai_standup to Cloudflare:

1. Run `wrangler deploy` to deploy the Worker and Durable Object to `https://cf-ai-standup.skim8705.workers.dev`
2. Update `API_URL` in `public/index.html` from `http://localhost:8787` to `https://cf-ai-standup.skim8705.workers.dev`
3. Update README.md with the live Worker URL and a placeholder for the Cloudflare Pages URL
4. Deploy the frontend (`public/`) to Cloudflare Pages via GitHub integration
5. Update README.md with the live Pages URL once available
6. Append this prompt to PROMPTS.md as Prompt 3 and commit all changes
Do not add any co-authored-by trailers to git commits.

---

## Prompt 4 — Final Cleanup

Verify the deployed project is complete:
1. Confirm both live URLs are working: https://cf-ai-standup.pages.dev and https://cf-ai-standup.skim8705.workers.dev
2. Update README.md with the confirmed live Pages URL
3. Ensure the repo is clean with no secrets, no debug code, and no placeholder text
4. Append this prompt to PROMPTS.md as Prompt 4 and commit
Do not add any co-authored-by trailers to git commits.
