CREATE TABLE `campaign_sources` (
	`source_id` text NOT NULL,
	`source_key` text NOT NULL,
	`campaign_id` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`last_seen` text NOT NULL,
	PRIMARY KEY(`source_id`, `source_key`)
);
--> statement-breakpoint
CREATE INDEX `campaign_sources_active` ON `campaign_sources` (`campaign_id`,`active`);--> statement-breakpoint
ALTER TABLE `campaigns` ADD `canonical_key` text;--> statement-breakpoint
CREATE INDEX `campaign_canonical_key` ON `campaigns` (`canonical_key`);
--> statement-breakpoint
INSERT OR IGNORE INTO campaign_sources(source_id,source_key,campaign_id,active,last_seen) SELECT source_id,source_key,id,active,last_seen FROM campaigns;
