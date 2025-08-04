import {
  mysqlTable,
  int,
  varchar
} from "drizzle-orm/mysql-core";
import {
  products
} from "./products";

export const productImages = mysqlTable("product_images", {
  id: int("id").primaryKey().autoincrement(),
  productId: int("product_id").notNull().references(() => products.id),
  image: varchar("image", {
    length: 255
  }).notNull(),
});