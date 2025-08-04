ALTER TABLE `categories` MODIFY COLUMN `name` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `categories` ADD `parent_id` int DEFAULT null;--> statement-breakpoint
ALTER TABLE `categories` ADD `image` varchar(255) DEFAULT null;--> statement-breakpoint
ALTER TABLE `categories` ADD CONSTRAINT `categories_parent_id_categories_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;