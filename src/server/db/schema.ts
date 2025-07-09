import {
  index,
  integer,
  pgTableCreator,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { env } from "@/env";

// https://orm.drizzle.team/docs/goodies#multi-project-schema;

export const createTable = pgTableCreator(
  (name) => `${env.DRIZZLE_PREFIX}_${name}`
);

function indexName(baseName: string): string {
  return `${env.DRIZZLE_PREFIX}_${baseName}_idx`;
}

export const example_posts = createTable(
  "post",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    name: varchar("name", { length: 256 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date()
    ),
  },
  (example) => [index(indexName("post_name")).on(example.name)]
);
