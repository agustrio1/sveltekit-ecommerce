import {
  mysqlTable,
  int,
  varchar,
  decimal
} from "drizzle-orm/mysql-core";
import {
  orders
} from "./orders";
import {
  products
} from "./products";

export const orderItems = mysqlTable("order_items", {
  id: int("id").primaryKey().autoincrement(),

  orderId: varchar("order_id", {
    length: 26
  }).notNull().references(() => orders.id),
  productId: int("product_id").notNull().references(() => products.id),

  name: varchar("name", {
    length: 100
  }).notNull(),
  description: varchar("description", {
    length: 255
  }),
  category: varchar("category", {
    length: 100
  }),

  price: decimal("price", {
    precision: 10, scale: 2
  }).notNull(),
  quantity: int("quantity").notNull(),

  // Dimensi disimpan juga biar bisa track
  height: int("height"),
  length: int("length"),
  weight: int("weight"),
  width: int("width"),
});