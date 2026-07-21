import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Plugin dev: replica /api/chat in locale (npm run dev non esegue le
// funzioni Vercel). La chiave resta lato server anche qui: viene letta
// dall'env del processo Node, mai esposta al client.
// Legge ANTHROPIC_API_KEY, con fallback al vecchio VITE_ANTHROPIC_API_KEY
// così non serve toccare .env.local durante la transizione.
function devApiChat(env) {
  return {
    name: "dev-api-chat",
    configureServer(server) {
      server.middlewares.use("/api/chat", async (req, res) => {
        if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }
        if (req.method !== "POST")    { res.statusCode = 405; res.end(); return; }

        const apiKey = env.ANTHROPIC_API_KEY || env.VITE_ANTHROPIC_API_KEY;
        const sendJson = (code, obj) => {
          res.statusCode = code;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(obj));
        };
        if (!apiKey) { sendJson(500, { error: { message: "ANTHROPIC_API_KEY non configurata (dev)" } }); return; }

        let raw = "";
        req.on("data", chunk => { raw += chunk; });
        req.on("end", async () => {
          let body = {};
          try { body = JSON.parse(raw || "{}"); } catch { /* ignore */ }
          const { model, max_tokens, system, tools, messages } = body;
          try {
            const upstream = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: model || "claude-sonnet-4-6",
                max_tokens: max_tokens || 2000,
                system, tools, messages,
              }),
            });
            const data = await upstream.json().catch(() => ({}));
            sendJson(upstream.status, data);
          } catch (err) {
            sendJson(502, { error: { message: `Errore proxy Anthropic (dev): ${err.message}` } });
          }
        });
      });
    },
  };
}

// Plugin dev: replica /api/scan in locale (estrazione documenti via Claude).
function devApiScan(env) {
  const PROMPTS = {
    menu: 'Analizza questo MENU di ristorante ed estrai ogni piatto. Rispondi SOLO con JSON valido, nessun altro testo, nel formato: {"items":[{"name":"nome piatto","price":numero,"category":"ANTIPASTO|PRIMO|SECONDO|DOLCE|BEVANDE o vuoto"}]}. Il prezzo è un numero (es. 12.50), senza simbolo €. Se un prezzo non è leggibile usa null.',
    invoice: 'Analizza questa FATTURA o LISTINO fornitore ed estrai ogni ingrediente/prodotto. Rispondi SOLO con JSON valido, nessun altro testo, nel formato: {"items":[{"name":"nome ingrediente","quantity":numero o null,"unit":"kg|g|L|ml|pz o vuoto","price":numero}]}. Il prezzo è un numero per unità (es. 8.50), senza simbolo €. Se un valore non è leggibile usa null.',
  };
  return {
    name: "dev-api-scan",
    configureServer(server) {
      server.middlewares.use("/api/scan", async (req, res) => {
        if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }
        if (req.method !== "POST")    { res.statusCode = 405; res.end(); return; }
        const apiKey = env.ANTHROPIC_API_KEY || env.VITE_ANTHROPIC_API_KEY;
        const sendJson = (code, obj) => { res.statusCode = code; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(obj)); };
        if (!apiKey) { sendJson(500, { error: { message: "ANTHROPIC_API_KEY non configurata (dev)" } }); return; }
        let raw = "";
        req.on("data", c => { raw += c; });
        req.on("end", async () => {
          let body = {};
          try { body = JSON.parse(raw || "{}"); } catch { /* ignore */ }
          const { fileBase64, mediaType, kind } = body;
          if (!fileBase64 || !mediaType) { sendJson(400, { error: { message: "file mancante" } }); return; }
          const isPdf = mediaType === "application/pdf";
          const mediaBlock = isPdf
            ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } }
            : { type: "image", source: { type: "base64", media_type: mediaType, data: fileBase64 } };
          try {
            const upstream = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
              body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 4000, messages: [{ role: "user", content: [mediaBlock, { type: "text", text: PROMPTS[kind] || PROMPTS.menu }] }] }),
            });
            const data = await upstream.json().catch(() => ({}));
            if (!upstream.ok) { sendJson(upstream.status, data); return; }
            const text = (data.content || []).filter(c => c.type === "text").map(c => c.text).join("\n");
            let parsed = null;
            const m = text.match(/\{[\s\S]*\}/);
            if (m) { try { parsed = JSON.parse(m[0]); } catch { /* ignore */ } }
            if (!parsed || !Array.isArray(parsed.items)) { sendJson(422, { error: { message: "Estrazione non riuscita: documento non leggibile." }, raw: text }); return; }
            sendJson(200, { items: parsed.items });
          } catch (err) {
            sendJson(502, { error: { message: `Errore scanner (dev): ${err.message}` } });
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return { plugins: [react(), devApiChat(env), devApiScan(env)] };
});
