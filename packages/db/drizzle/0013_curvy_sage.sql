CREATE TABLE `shared_image` (
	`id` text PRIMARY KEY NOT NULL,
	`ext` text NOT NULL,
	`source_url` text,
	`src_url` text,
	`source_title` text,
	`width` integer,
	`height` integer,
	`bytes` integer NOT NULL,
	`created` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
