# Old Man Gus — Grumpy Chatbot

## What's in this project
- `server.js` — a small Express server with one endpoint `/api/chat` that calls the Claude API server-side (so your API key stays private).
- `public/index.html` — the chat interface (Claude-inspired cream/terracotta design).
- `package.json` — dependencies.

## How to deploy for free (Vercel)

This project supports **two AI providers** — pick one:

### Option A: Gemini (Google) — recommended if you have zero budget
Gemini's free tier is generous and needs no credit card.

1. Go to https://aistudio.google.com/apikey
2. Sign in with any Google account, click "Create API key"
3. Copy the key (starts with `AIza...`)

### Option B: Claude (Anthropic)
1. Go to https://console.anthropic.com
2. Create an account, go to "API Keys," generate one
3. New accounts get free trial credit

---

1. **Push this folder to GitHub**
   - Create a new repo on github.com
   - Upload these files (or use `git init`, `git add .`, `git commit`, `git push`)

2. **Deploy on Vercel**
   - Go to https://vercel.com, sign up with GitHub (free)
   - Click "Add New Project," pick your repo
   - Before deploying, add Environment Variables:
     - If using Gemini: `AI_PROVIDER` = `gemini` and `GEMINI_API_KEY` = (your key)
     - If using Claude: `AI_PROVIDER` = `claude` and `ANTHROPIC_API_KEY` = (your key)
   - Click Deploy

4. **Test it**
   - Vercel gives you a URL like `grumpy-bot.vercel.app`
   - Open it and chat with Gus

5. **Connect your domain (chat.videogenerative.com)**
   - In Vercel: Project → Settings → Domains → Add `chat.videogenerative.com`
   - Vercel will show you a CNAME record to add
   - Go to Spaceship → DNS settings for videogenerative.com → add that CNAME record
   - Wait a few minutes for it to propagate, then visit chat.videogenerative.com

## Costs
- Vercel free tier: $0 for a project like this
- Claude API: pay-per-use, but new accounts get free trial credit. A short chat message costs a fraction of a cent — thousands of messages cost just a few dollars.

## Changing Gus's personality
Edit the `SYSTEM_PROMPT` constant at the top of `server.js`. You can also duplicate this pattern later to add new characters (a dropdown to pick a personality, etc.).
