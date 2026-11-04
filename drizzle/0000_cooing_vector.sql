CREATE TABLE `applications` (
	`user_id` text NOT NULL,
	`campaign_id` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `campaign_id`)
);
--> statement-breakpoint
CREATE TABLE `bookmarks` (
	`user_id` text NOT NULL,
	`campaign_id` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `campaign_id`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` text NOT NULL,
	`source_key` text NOT NULL,
	`title` text NOT NULL,
	`brand` text NOT NULL,
	`official_url` text NOT NULL,
	`source_url` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'その他' NOT NULL,
	`methods` text DEFAULT '[]' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`deadline` text,
	`starts_at` text,
	`winners` integer,
	`purchase_free` integer,
	`no_registration` integer,
	`daily` integer,
	`instant` integer,
	`age_restricted` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`first_seen` text NOT NULL,
	`last_seen` text NOT NULL,
	`checked_at` text NOT NULL,
	`evidence` text DEFAULT '{}' NOT NULL,
	`clicks` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campaign_source_key` ON `campaigns` (`source_key`);--> statement-breakpoint
CREATE TABLE `leases` (
	`name` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`campaign_id` integer NOT NULL,
	`wish_id` text NOT NULL,
	`term` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` text NOT NULL,
	`read_at` text,
	`push_status` text DEFAULT 'pending' NOT NULL,
	`push_attempts` integer DEFAULT 0 NOT NULL,
	`push_attempt_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notice_once` ON `notifications` (`user_id`,`campaign_id`,`wish_id`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`endpoint` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`subscription` text NOT NULL,
	`created_at` text NOT NULL,
	`last_success` text
);
--> statement-breakpoint
CREATE TABLE `sync_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text NOT NULL,
	`status` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `wishes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`term` text NOT NULL,
	`normalized` text NOT NULL,
	`notify` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wish_user_term` ON `wishes` (`user_id`,`normalized`);