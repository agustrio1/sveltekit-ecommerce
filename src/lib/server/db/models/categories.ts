import {
  mysqlTable,
  int,
  varchar,
  foreignKey
} from "drizzle-orm/mysql-core";

export const categories = mysqlTable("categories", {
  id: int("id").primaryKey().autoincrement(),

  name: varchar("name", {
    length: 255
  }).notNull().unique(),

  slug: varchar("slug", {
    length: 100
  }).notNull().unique(),

  parentId: int("parent_id").references(() => categories.id).default(null),

  image: varchar("image", {
    length: 255
  }).default(null),
});