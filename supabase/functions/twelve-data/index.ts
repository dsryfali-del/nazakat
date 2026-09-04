import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Twelve Data time_series proxy. The API key is read from the server-side
// TWELVE_DATA_API_KEY secret and never exposed to the browser. On any error
// we return a 502 with an error body so the client can fall back to mock data.

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const symbol = url.searchParams.get("symbol");
    const interval = url.searchParams.get("interval");
    const outputsize = url.searchParams.get("outputsize") || "5000";

    if (!symbol || !interval) {
      return new Response(
        JSON.stringify({ error: "Missing 'symbol' or 'interval' query parameter." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("TWELVE_DATA_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "TWELVE_DATA_API_KEY secret is not configured." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tdUrl = new URL("https://api.twelvedata.com/time_series");
    tdUrl.searchParams.set("symbol", symbol);
    tdUrl.searchParams.set("interval", interval);
    tdUrl.searchParams.set("outputsize", outputsize);
    tdUrl.searchParams.set("format", "JSON");
    tdUrl.searchParams.set("apikey", apiKey);

    const resp = await fetch(tdUrl.toString(), {
      headers: { Accept: "application/json" },
    });

    if (!resp.ok) {
      return new Response(
        JSON.stringify({ error: `Twelve Data responded with status ${resp.status}.` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await resp.json();

    // Twelve Data returns { status: "error", message: ... } on failures
    // (rate limit, invalid symbol, etc.) with HTTP 200. Surface those.
    if (data.status === "error" || data.code) {
      return new Response(
        JSON.stringify({ error: data.message || "Twelve Data API error." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
