import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY,
);

export const ls = {
  get: (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

export const dbSet = async (key, value) => {
  ls.set(key, value);
  try {
    await fetch(import.meta.env.VITE_EDGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-secret": import.meta.env.VITE_EDGE_SECRET,
      },
      body: JSON.stringify({ key, value }),
    });
  } catch {}
};

const toHex = (arr) => Array.from(arr).map(b => b.toString(16).padStart(2,"0")).join("");

const hashSha256 = async (str) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return toHex(new Uint8Array(buf));
};

export const hashPw = async (str) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(str), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name:"PBKDF2", salt, hash:"SHA-256", iterations:100000 }, key, 256);
  return `pbkdf2:${toHex(salt)}:${toHex(new Uint8Array(bits))}`;
};

export const verifyPw = async (str, stored) => {
  if (!stored) return false;
  if (stored.startsWith("pbkdf2:")) {
    const parts = stored.split(":");
    if (parts.length !== 3) return false;
    const salt = new Uint8Array(parts[1].match(/../g).map(h => parseInt(h, 16)));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(str), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name:"PBKDF2", salt, hash:"SHA-256", iterations:100000 }, key, 256);
    return `pbkdf2:${parts[1]}:${toHex(new Uint8Array(bits))}` === stored;
  }
  return (await hashSha256(str)) === stored;
};

export const isHashed = (s) => typeof s==="string" && (/^[0-9a-f]{64}$/.test(s) || s.startsWith("pbkdf2:"));

// Vaste lijst van vestigingen. Volgorde bepaalt weergave in het keuzescherm.
// Per land gesorteerd van noord naar zuid (op breedtegraad).
export const LOCATIONS = [
  { id:"groningen",   name:"Groningen",   country:"NL" },
  { id:"ruinerwold",  name:"Ruinerwold",  country:"NL" },
  { id:"diemen",      name:"Diemen",      country:"NL" },
  { id:"nieuwegein",  name:"Nieuwegein",  country:"NL" },
  { id:"bleiswijk",   name:"Bleiswijk",   country:"NL" },
  { id:"duiven",      name:"Duiven",      country:"NL" },
  { id:"etten-leur",  name:"Etten-Leur",  country:"NL" },
  { id:"maastricht",  name:"Maastricht",  country:"NL" },
  { id:"antwerpen",   name:"Antwerpen",   country:"BE" },
  { id:"gent",        name:"Gent",        country:"BE" },
  { id:"houthalen",   name:"Houthalen",   country:"BE" },
  { id:"brussel",     name:"Brussel",     country:"BE" },
  { id:"kluisbergen", name:"Kluisbergen", country:"BE" },
  { id:"namen",       name:"Namen",       country:"BE" },
];
export const COUNTRIES = [{ code:"NL", flag:"🇳🇱", label:"Nederland" },{ code:"BE", flag:"🇧🇪", label:"België" }];
export const locName = (locId) => LOCATIONS.find(l=>l.id===locId)?.name || locId;
// Ruinerwold houdt de oorspronkelijke keys (vkast-cfg, …) zodat de bestaande live data behouden blijft.
export const LEGACY_LOC = "ruinerwold";
export const keyFor = (base, locId) => locId===LEGACY_LOC ? base : `${base}:${locId}`;

// HQ-overzicht master-PIN. Standaard "2580".
// Wijzigen? Genereer een nieuwe hash:  node -e "console.log(require('crypto').createHash('sha256').update('XXXX').digest('hex'))"
export const HQ_PIN_HASH = "ed946f65d2c785d90e827c5ffd879ce3b49c68d4c88013074176a7e73bc58bcf";

export const migrateHashes = async (cfg, locId=LEGACY_LOC) => {
  let changed=false;
  const c=JSON.parse(JSON.stringify(cfg));
  for(const acc of c.accounts||[]){
    if(!isHashed(acc.password)){acc.password=await hashPw(acc.password);changed=true;}
  }
  if(c.adminPin&&!isHashed(c.adminPin)){c.adminPin=await hashPw(c.adminPin);changed=true;}
  if(c.appName==="Vloeistoffenkast"){c.appName="Voorraadbeheer";changed=true;}
  if(changed)dbSet(keyFor("vkast-cfg",locId),c);
  return c;
};
