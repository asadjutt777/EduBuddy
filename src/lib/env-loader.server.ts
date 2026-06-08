import fs from "node:fs";
import path from "node:path";
import process from "node:process";

/**
 * Reads the .env file from the project root and loads ALL key=value pairs
 * into process.env, overwriting any existing values.
 * Call this at the top of any server-side function that needs secrets
 * (SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, etc.) because Vite's dev server
 * only exposes VITE_-prefixed vars to import.meta.env, not to process.env.
 */
export function loadDotEnv(): void {
  if (typeof process === "undefined" || !process.env) return;

  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (!fs.existsSync(envPath)) return;

    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      // Skip comments and blank lines
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 1) continue;

      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();

      // Strip surrounding quotes
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }

      if (key) {
        // Always overwrite so secrets defined in .env take precedence over
        // any placeholder values Vite may have injected.
        process.env[key] = val;
      }
    }
  } catch {
    // Silent — don't crash the server if .env can't be read
  }
}

// Also run immediately so that importing this file works as a side-effect too
loadDotEnv();
