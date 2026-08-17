const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET /api/get-history — returns the saved "Serious mode" conversation
// for the logged-in user, so it can be restored when they switch modes.
module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      res.status(401).json({ error: "Sign in required" });
      return;
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      res.status(401).json({ error: "Invalid session" });
      return;
    }

    const { data } = await supabaseAdmin
      .from("conversation_history")
      .select("messages")
      .eq("user_id", userData.user.id)
      .eq("mode", "serious")
      .single();

    res.status(200).json({ messages: data?.messages || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
};
