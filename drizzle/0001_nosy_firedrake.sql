CREATE TABLE `push_deliveries` (
	`notification_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`sent_at` text NOT NULL,
	PRIMARY KEY(`notification_id`, `endpoint`)
);
