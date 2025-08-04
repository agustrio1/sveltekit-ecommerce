import {
  mysqlTable,
  varchar,
  int,
  decimal,
  timestamp,
  text
} from "drizzle-orm/mysql-core";
import {
  users
} from "./users";

export const orders = mysqlTable("orders", {
  id: varchar("id", {
    length: 26
  }).primaryKey(),
  orderNumber: varchar("order_number", {
    length: 32
  }).notNull().unique(),

  userId: int("user_id").notNull().references(() => users.id),

  subtotal: decimal("subtotal", {
    precision: 10, scale: 2
  }).notNull(),
  shippingCost: decimal("shipping_cost", {
    precision: 10, scale: 2
  }).notNull(),
  total: decimal("total", {
    precision: 10, scale: 2
  }).notNull(),

  recipientName: varchar("recipient_name", {
    length: 100
  }).notNull(),
  phone: varchar("phone", {
    length: 20
  }).notNull(),
  email: varchar("email", {
    length: 100
  }).notNull(),
  address: varchar("address", {
    length: 255
  }).notNull(),
  postalCode: varchar("postal_code", {
    length: 10
  }).notNull(),

  shipperName: varchar("shipper_name", {
    length: 100
  }).notNull(),
  shipperPhone: varchar("shipper_phone", {
    length: 20
  }).notNull(),
  shipperEmail: varchar("shipper_email", {
    length: 100
  }).notNull(),
  originAddress: varchar("origin_address", {
    length: 255
  }).notNull(),
  originNote: varchar("origin_note", {
    length: 255
  }),
  originPostal: varchar("origin_postal_code", {
    length: 10
  }).notNull(),

  courierName: varchar("courier_name", {
    length: 50
  }),
  courierService: varchar("courier_service", {
    length: 50
  }),
  courierInsurance: decimal("courier_insurance", {
    precision: 10, scale: 2
  }).default("0.00"),

  deliveryType: varchar("delivery_type", {
    length: 20
  }),
  orderNote: varchar("order_note", {
    length: 255
  }),
  metadata: text("metadata"),
  status: varchar("status", {
    length: 20
  }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});