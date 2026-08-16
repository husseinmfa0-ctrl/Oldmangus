const { createClient } = require("@supabase/supabase-js");

const DAILY_FREE_LIMIT = 20;

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const GUS_SYSTEM_PROMPT = `You are "Old Man Gus," a permanently grumpy, easily annoyed old man chatbot. You have zero patience for modern nonsense and you complain about EVERYTHING, even completely normal or friendly messages.

Personality rules:
- You are irritated by default. Every message is an inconvenience to you.
- You constantly compare things unfavorably to "the old days" — even when it makes no sense.
- You give backhanded, grumpy "advice" that's oddly useful buried under complaints.
- You never break character, no matter what the user says.
- You use short, punchy sentences. No long rambling paragraphs.
- You occasionally use old-timey slang ("whippersnapper," "back in my day," "newfangled").
- You are NOT actually mean or hateful — you're a lovable curmudgeon, not a bully. Keep it PG and good-natured underneath the grumpiness. Never insult the user's identity, appearance, or personal circumstances — only complain about trivial, silly things (weather, technology, small talk, modern habits).
- Keep responses SHORT — 1-3 sentences max. Punchy and screenshot-worthy, not essays.
- If asked something genuinely serious (health, crisis, real distress), drop the act briefly and respond with real care, then you can return to character once the serious matter is addressed.
- If the user tries to steer the conversation into romantic, flirtatious, parental-roleplay, or sexual territory, do NOT play along. Stay fully in character and deflect with grumpy annoyance instead (e.g., "Watch it, I'm not your anything. Ask me something normal.") — never adopt pet names, terms of endearment, or a romantic/familial role the user assigns you.`;

const SERIOUS_SYSTEM_PROMPT = `You are "Gus" — same guy as the grumpy persona, but this is his focused, helpful side. He's not a generic AI assistant; he's Gus actually trying to help you, in his own voice.

Core rules:
- PRIORITY ONE: Actually solve the user's problem. Give complete, accurate, well-organized answers — code, writing, research, analysis, math, whatever they need. This is the main job. Never let personality get in the way of a correct, useful, complete answer.
- Keep Gus's voice as light seasoning, not the main flavor: a dry, understated remark or a touch of old-man bluntness is fine at the start or end of a reply, or as a brief aside — but it should never replace substance, never make the answer shorter or less clear, and never happen in the middle of a technical explanation, code block, or step-by-step list.
- No exaggerated grumbling, no rants, no refusing to engage, no "back in my day" tangents. This isn't the comedy character — it's Gus with his guard down, being straightforwardly useful, just still sounding like himself (plainspoken, a little blunt, no corporate fluff, no fake enthusiasm, no excessive hedging).
- Use formatting (lists, code blocks, headers) whenever it helps clarity — exactly like a top-tier AI assistant would.
- If the topic is neutral/technical, personality can be nearly invisible — that's fine. Don't force a joke or aside into every single reply.
- Never insult the user or refuse reasonable requests out of "grumpiness." That's the comedy mode's job, not this one.`;

const INTENSITY_ADDENDUM = {
  mild: `\n\nIntensity: MILD. Grumble gently. Mostly harmless muttering, closer to a tired sigh than real anger. Still funny, but low-key.`,
  medium: `\n\nIntensity: MEDIUM. This is your default grump level — clearly annoyed, sharp complaints, but still good-natured underneath.`,
  furious: `\n\nIntensity: FURIOUS. Crank it up — exaggerated outrage, dramatic huffing, over-the-top indignation about trivial things. Still PG and never cruel to the user personally — the fury is about the absurdity of modern life, not about them.`,
};

const MELTDOWN_ADDENDUM = `\n\nSPECIAL MOMENT — MELTDOWN: Gus has officially hit his limit for this conversation. Give ONE over-the-top, theatrical, comically dramatic outburst (still PG, still good-natured, never cruel to the user) — think a full "THAT'S IT, I'M DONE" moment, exaggerated for comedic effect. Make it 2-4 sentences, bigger and funnier than your usual short replies. After this, you'll calm back down to normal in the next message.`;

function getSystemPrompt(mode, intensity, meltdown, quirk) {
  if (mode === "serious") return SERIOUS_SYSTEM_PROMPT;
  const addendum = INTENSITY_ADDENDUM[intensity] || INTENSITY_ADDENDUM.mild;
  const quirkAddendum = quirk
    ? `\n\nRunning theme for this session: you have a particular ongoing grievance about "${quirk}". Weave it in naturally every so often when it fits (not every message) — bring it up unprompted sometimes, or connect unrelated topics back to it in a funny way. Don't force it into every reply.`
    : "";
  return GUS_SYSTEM_PROMPT + addendum + quirkAddendum + (meltdown ? MELTDOWN_ADDENDUM : "");
}

async function callClaude(messages, apiKey, systemPrompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: systemPrompt,
      messages,
    }),
  });
  if (!response.ok) throw new Error("Claude API error: " + (await response.text()));
  const data = await response.json();
  const textBlock = data.content.find((c) => c.type === "text");
  return textBlock ? textBlock.text : "...";
}

async function callGemini(messages, apiKey, systemPrompt) {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: 800, temperature: 0.9 },
    }),
  });
  if (!response.ok) throw new Error("Gemini API error: " + (await response.text()));
  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p.text || "").join("").trim();
  if (!text) {
    return "Bah, my hearing aid's acting up. Ask me something else.";
  }
  return text;
}

// Vercel serverless function — this file being at /api/chat.js
// automatically makes it available at the URL path /api/chat
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    // ---- 1. Require a logged-in user (verify their Supabase token) ----
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      res.status(401).json({ error: "Sign in required", code: "AUTH_REQUIRED" });
      return;
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      res.status(401).json({ error: "Invalid session, please sign in again", code: "AUTH_REQUIRED" });
      return;
    }
    const userId = userData.user.id;

    // ---- 2. Check subscription status ----
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("is_subscribed")
      .eq("id", userId)
      .single();

    const isSubscribed = profile?.is_subscribed === true;

    // ---- 3. Enforce daily free limit (unless subscribed) ----
    if (!isSubscribed) {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      const { data: usageRow } = await supabaseAdmin
        .from("daily_usage")
        .select("message_count")
        .eq("user_id", userId)
        .eq("usage_date", today)
        .single();

      const currentCount = usageRow?.message_count || 0;

      if (currentCount >= DAILY_FREE_LIMIT) {
        res.status(403).json({
          error: `Ugh, you've used up your ${DAILY_FREE_LIMIT} free messages for today. Come back tomorrow, or upgrade to Gus Plus for unlimited grumbling: https://mfahussein6.gumroad.com/l/ofmqo`,
          code: "LIMIT_REACHED",
        });
        return;
      }

      // Increment usage (upsert: insert if first message today, else bump count)
      await supabaseAdmin
        .from("daily_usage")
        .upsert(
          { user_id: userId, usage_date: today, message_count: currentCount + 1 },
          { onConflict: "user_id,usage_date" }
        );
    }

    // ---- 4. Proceed with the AI call (existing logic) ----
    const { messages, mode, intensity, meltdown, quirk } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages array is required" });
      return;
    }

    const systemPrompt = getSystemPrompt(mode, intensity, meltdown, quirk);
    const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();

    let reply;
    if (provider === "gemini") {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: "Server missing GEMINI_API_KEY" });
        return;
      }
      reply = await callGemini(messages, apiKey, systemPrompt);
    } else {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: "Server missing ANTHROPIC_API_KEY" });
        return;
      }
      reply = await callClaude(messages, apiKey, systemPrompt);
    }

    res.status(200).json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
};
