import { defineConfig } from "drizzle-kit";
import { loadEnvFile } from "node:process";
import fs from "node:fs";
import path from "path";

const envPath = path.join(__dirname, "../../.env");
if (fs.existsSync(envPath)) {
  loadEnvFile(envPath);
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    `DATABASE_URL is missing. Create ${envPath} from .env.example and set it to your MySQL connection string.`,
  );
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
