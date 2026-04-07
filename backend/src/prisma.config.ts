import path from "path";
import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

// Load env from backend root, where .env is kept.
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

export default defineConfig({
  schema: "src/prisma/schema.prisma",
  migrations: {
    path: "src/prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
