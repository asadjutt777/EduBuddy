import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

// Manually load env variables just like env-loader.server.ts does
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) {
      process.env[key] = value;
    }
  }
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("SUPABASE_URL:", url);
console.log("SUPABASE_SERVICE_ROLE_KEY configured:", !!serviceKey);

if (!url || !serviceKey) {
  console.error("Missing environment variables.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function runTest() {
  // 1. Get a document from the database
  const { data: docs, error: docErr } = await supabase
    .from("documents")
    .select("*")
    .limit(5);

  if (docErr) {
    console.error("Failed to query documents table:", docErr);
    return;
  }

  console.log(`Found ${docs.length} documents in database:`);
  for (const doc of docs) {
    console.log(`- ID: ${doc.id}, Name: ${doc.name}, Type: ${doc.file_type}`);
  }

  if (docs.length === 0) {
    console.log("No documents found. Please upload a file in the UI first.");
    return;
  }

  // Now dynamically import indexDocument function and try to run it
  const { indexDocument } = await import("./src/lib/rag.ts");

  for (const doc of docs) {
    console.log(`\nIndexing: ${doc.name} (${doc.id})`);
    try {
      const result = await indexDocument(doc.id);
      console.log("✅ Result:", result);
    } catch (err) {
      console.error("❌ Indexing failed:", err);
    }
  }
  console.log("\n🎉 All documents indexed!");
}

runTest();
