CREATE TABLE `gyazo_media` (
	`gyazoHash` text PRIMARY KEY NOT NULL,
	`r2Key` text NOT NULL,
	`contentType` text NOT NULL,
	`bytes` integer NOT NULL,
	`created` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
