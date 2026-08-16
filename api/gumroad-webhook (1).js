const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// The product name exactly as it appears on Gumroad — used to make sure
// we only react to pings about the "Gus Plus" subscription product.
const EXPECTED_PRODUCT_NAME = "Gus Plus";

// Gumroad "Ping" sends a POST request to this URL every time something
// happens on a sale (new purchase, cancellation, refund, etc).
// This file being at /api/gumroad-webhook.js makes it live at
// https://<your-domain>/api/gumroad-webhook — that's the URL you paste
// into Gumroad's Ping settings.
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  try {
    const body = req.body || {};
    const productName = body.product_name || "";
    const email = (body.email || "").toLowerCase().trim();
    const resourceName = (body.resource_name || "sale").toLowerCase();
    const refunded = body.refunded === "true";
    const disputed = body.disputed === "true";

    if (!email) {
      res.status(200).send("No email in payload, ignoring");
      return;
    }

    if (productName && productName !== EXPECTED_PRODUCT_NAME) {
      // Ping about some other Gumroad product — ignore it.
      res.status(200).send("Different product, ignoring");
      return;
    }

    const REVOKE_EVENTS = ["cancellation", "subscription_ended"];
    const shouldRevoke = REVOKE_EVENTS.includes(resourceName) || refunded || disputed;
    const isSubscribed = !shouldRevoke;

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_subscribed: isSubscribed })
      .eq("email", email);

    if (error) {
      console.error("Failed to update subscription status:", error);
      res.status(500).send("Database update failed");
      return;
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong");
  }
};
