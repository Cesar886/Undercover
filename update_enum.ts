import "dotenv/config";
import { query } from "./lib/db";

async function main() {
  try {
    await query("ALTER TYPE post_category ADD VALUE IF NOT EXISTS 'stickers';");
    console.log("Enum updated successfully");
  } catch(e) {
    console.error("Error updating enum:", e);
  } finally {
    process.exit();
  }
}

main();
