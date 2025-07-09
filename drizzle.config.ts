import { type Config } from "drizzle-kit";
import { env } from "./src/env";

export default {
  schema: "./src/server/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  // https://orm.drizzle.team/docs/goodies#multi-project-schema
  tablesFilter: [`${env.DRIZZLE_PREFIX}_*`],
} satisfies Config;
