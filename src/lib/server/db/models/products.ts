import {
  mysqlTable,
  int,
  varchar,
  decimal,
  text
} from "drizzle-orm/mysql-core";
import {
  categories
} from "./categories";

export const products = mysqlTable("products", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", {
    length: 100
  }).notNull(),
  slug: varchar("slug", {
    length: 100
  }).notNull().unique(),
  description: text("description"),
  price: decimal("price", {
    precision: 10, scale: 2
  }).notNull(),
  stock: int("stock").default(0),
  categoryId: int("category_id").notNull().references(() => categories.id),

  // Dimensi opsional buat Biteship
  height: int("height"),
  length: int("length"),
  weight: int("weight"),
  width: int("width"),
});