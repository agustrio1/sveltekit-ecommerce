CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`email` varchar(100) NOT NULL,
	`password` varchar(255) NOT NULL,
	`role` enum('admin','customer') DEFAULT 'customer',
	`image` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(100) NOT NULL,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_name_unique` UNIQUE(`name`),
	CONSTRAINT `categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`description` text,
	`price` decimal(10,2) NOT NULL,
	`stock` int DEFAULT 0,
	`category_id` int NOT NULL,
	`height` int,
	`length` int,
	`weight` int,
	`width` int,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `product_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`image` varchar(255) NOT NULL,
	CONSTRAINT `product_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` varchar(26) NOT NULL,
	`order_number` varchar(32) NOT NULL,
	`user_id` int NOT NULL,
	`subtotal` decimal(10,2) NOT NULL,
	`shipping_cost` decimal(10,2) NOT NULL,
	`total` decimal(10,2) NOT NULL,
	`recipient_name` varchar(100) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`email` varchar(100) NOT NULL,
	`address` varchar(255) NOT NULL,
	`postal_code` varchar(10) NOT NULL,
	`shipper_name` varchar(100) NOT NULL,
	`shipper_phone` varchar(20) NOT NULL,
	`shipper_email` varchar(100) NOT NULL,
	`origin_address` varchar(255) NOT NULL,
	`origin_note` varchar(255),
	`origin_postal_code` varchar(10) NOT NULL,
	`courier_name` varchar(50),
	`courier_service` varchar(50),
	`courier_insurance` decimal(10,2) DEFAULT '0.00',
	`delivery_type` varchar(20),
	`order_note` varchar(255),
	`metadata` varchar(255),
	`status` varchar(20) DEFAULT 'pending',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_order_number_unique` UNIQUE(`order_number`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` varchar(26) NOT NULL,
	`product_id` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` varchar(255),
	`category` varchar(100),
	`price` decimal(10,2) NOT NULL,
	`quantity` int NOT NULL,
	`height` int,
	`length` int,
	`weight` int,
	`width` int,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;