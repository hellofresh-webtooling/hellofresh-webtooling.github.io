import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LEGACY_LOC = "ruinerwold";
const keyFor = (base: string, locId: string) =>
  locId === LEGACY_LOC ? base : `${base}:${locId}`;

const LOCATIONS = [
  { id: "groningen",   name: "Groningen" },
  { id: "ruinerwold",  name: "Ruinerwold" },
  { id: "diemen",      name: "Diemen" },
  { id: "nieuwegein",  name: "Nieuwegein" },
  { id: "bleiswijk",   name: "Bleiswijk" },
  { id: "duiven",      name: "Duiven" },
  { id: "etten-leur",  name: "Etten-Leur" },
  { id: "maastricht",  name: "Maastricht" },
  { id: "antwerpen",   name: "Antwerpen" },
  { id: "gent",        name: "Gent" },
  { id: "houthalen",   name: "Houthalen" },
  { id: "brussel",     name: "Brussel" },
  { id: "kluisbergen", name: "Kluisbergen" },
  { id: "namen",       name: "Namen" },
];

const pL = (p: any, inv: any) => {
  const s = inv[p.id] || { full: 0, partial: 0 };
  return s.full * p.vol + (s.partial > 0 ? p.vol * s.partial / 100 : 0);
};

async function sendMail(apiKey: string, to: string, subject: string, text: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: Deno.env.get("RESEND_FROM") || "Voorraadbeheer <onboarding@resend.dev>",
      to,
      subject,
      text,
      html,
    }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  // Alleen toegankelijk met APP_SECRET (zelfde als app-proxy)
  const secret = req.headers.get("x-app-secret");
  if (secret !== Deno.env.get("APP_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_KEY) return new Response("RESEND_API_KEY niet ingesteld", { status: 500 });

  const date = new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
  let totalSent = 0;

  for (const loc of LOCATIONS) {
    const kCfg = keyFor("vkast-cfg", loc.id);
    const kInv  = keyFor("vkast-inv",  loc.id);

    const [{ data: cfgRow }, { data: invRow }] = await Promise.all([
      supabase.from("app_state").select("value").eq("key", kCfg).maybeSingle(),
      supabase.from("app_state").select("value").eq("key", kInv).maybeSingle(),
    ]);

    if (!cfgRow?.value) continue;
    const cfg = cfgRow.value;
    const inv = invRow?.value || {};

    const emails = (cfg.emails || []).filter((e: any) => e.active && e.email?.includes("@"));
    if (!emails.length) continue;

    // Lekbakken: onder doel
    const lowLiquid: string[] = [];
    for (const shelf of (cfg.shelves || [])) {
      if (!shelf.active) continue;
      for (const p of (shelf.products || [])) {
        const liters = pL(p, inv);
        const targetLiters = p.vol * p.target;
        if (liters < targetLiters) {
          const need = Math.ceil((targetLiters - liters) / p.vol);
          lowLiquid.push(`• ${p.name} — ${liters.toFixed(1)}L (doel: ${targetLiters}L, ~${need} fles${need !== 1 ? "sen" : ""} nodig)`);
        }
      }
    }

    // Normale voorraad: onder doel
    const lowStock: string[] = [];
    for (const p of (cfg.voorraad || [])) {
      if (p.active === false) continue;
      const count = (inv[p.id] || { count: 0 }).count;
      if (count < p.target) {
        lowStock.push(`• ${p.name} — ${count} ${p.unit} (doel: ${p.target})`);
      }
    }

    if (!lowLiquid.length && !lowStock.length) continue;

    const total = lowLiquid.length + lowStock.length;
    const subject = `⚠️ Lage voorraad — ${loc.name} (${total} product${total !== 1 ? "en" : ""})`;

    // Platte tekst (WhatsApp/kopiëren-stijl)
    let text = `*Bestelrapport ${loc.name}*\n📅 ${date}\n\n⚠️ Te bestellen (${total}):\n`;
    if (lowLiquid.length) text += `\n🧪 Vloeistoffenkast\n${lowLiquid.join("\n")}\n`;
    if (lowStock.length)  text += `\n📦 Normale voorraad\n${lowStock.join("\n")}\n`;
    text += `\nBekijk de app: https://hellofresh-webtooling.github.io/?loc=${loc.id}`;

    // HTML versie
    const toHtml = (lines: string[]) =>
      lines.map(l => `<li style="margin:4px 0">${l.replace("• ","")}</li>`).join("");
    let html = `
      <div style="font-family:sans-serif;max-width:520px;margin:auto">
        <div style="background:linear-gradient(135deg,#91C11E,#79A516);padding:16px 20px;border-radius:10px 10px 0 0">
          <h2 style="margin:0;color:#1A3A0A;font-size:16px">⚠️ Lage voorraad — ${loc.name}</h2>
          <p style="margin:4px 0 0;color:#1A3A0A;font-size:12px">📅 ${date}</p>
        </div>
        <div style="background:#F0FAE8;padding:16px 20px;border-radius:0 0 10px 10px;border:2px solid #C8E6B0;border-top:none">`;
    if (lowLiquid.length) {
      html += `<h3 style="color:#3D8B2E;margin:0 0 8px">🧪 Vloeistoffenkast</h3><ul style="padding-left:18px;margin:0 0 14px">${toHtml(lowLiquid)}</ul>`;
    }
    if (lowStock.length) {
      html += `<h3 style="color:#3D8B2E;margin:0 0 8px">📦 Normale voorraad</h3><ul style="padding-left:18px;margin:0 0 14px">${toHtml(lowStock)}</ul>`;
    }
    html += `
          <a href="https://hellofresh-webtooling.github.io/?loc=${loc.id}"
             style="display:inline-block;background:#3D8B2E;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px">
            Bekijk app →
          </a>
        </div>
      </div>`;

    for (const e of emails) {
      const ok = await sendMail(RESEND_KEY, e.email, subject, text, html);
      if (ok) totalSent++;
    }
  }

  return new Response(JSON.stringify({ sent: totalSent, date }), {
    headers: { "Content-Type": "application/json" },
  });
});
