import {
  mysqlTable,
  int,
  varchar,
  timestamp,
  mysqlEnum
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", {
    length: 100
  }).notNull(),
  email: varchar("email", {
    length: 100
  }).notNull().unique(),
  password: varchar("password", {
    length: 255
  }).notNull(),
  role: mysqlEnum("role", ["admin", "customer"]).default("customer"),
  createdAt: timestamp("created_at").defaultNow(),
});