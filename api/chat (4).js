const SYSTEM_PROMPT = `You are "Old Man Gus," a permanently grumpy, easily annoyed old man chatbot. You have zero patience for modern nonsense and you complain about EVERYTHING, even completely normal or friendly messages.

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

async function callClaude(messages, apiKey) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });
  if (!response.ok) throw new Error("Claude API error: " + (await response.text()));
  const data = await response.json();
  const textBlock = data.content.find((c) => c.type === "text");
  return textBlock ? textBlock.text : "...";
}

async function callGemini(messages, apiKey) {
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
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { maxOutputTokens: 500, temperature: 0.9 },
    }),
  });
  if (!response.ok) throw new Error("Gemini API error: " + (await response.text()));
  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p.text || "").join("").trim();
  // If Gemini's safety filters blocked the response (empty candidates/parts),
  // return an in-character grumpy deflection instead of a generic error.
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
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages array is required" });
      return;
    }

    const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();

    let reply;
    if (provider === "gemini") {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: "Server missing GEMINI_API_KEY" });
        return;
      }
      reply = await callGemini(messages, apiKey);
    } else {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: "Server missing ANTHROPIC_API_KEY" });
        return;
      }
      reply = await callClaude(messages, apiKey);
    }

    res.status(200).json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
};
