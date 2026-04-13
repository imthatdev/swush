CREATE TABLE "bookmark_archive_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"bookmark_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"next_run_at" timestamp DEFAULT now() NOT NULL,
	"dead_letter_at" timestamp,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookmark_rss_feeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"feed_url" text NOT NULL,
	"feed_title" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"interval_minutes" integer DEFAULT 60 NOT NULL,
	"max_items_per_fetch" integer DEFAULT 10 NOT NULL,
	"default_tags" text[],
	"snapshot_mode" text DEFAULT 'none' NOT NULL,
	"last_fetched_at" timestamp,
	"next_fetch_at" timestamp DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookmark_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"description" text,
	"image_url" text,
	"slug" text,
	"tags" text[],
	"archive_title" text,
	"archive_excerpt" text,
	"archive_byline" text,
	"archive_site_name" text,
	"archive_lang" text,
	"archive_text" text,
	"archive_html" text,
	"archived_at" timestamp,
	"password_hash" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT false,
	"anonymous_share_enabled" boolean DEFAULT false NOT NULL,
	"views" integer DEFAULT 0,
	"max_views" integer,
	"max_views_action" "max_views_action",
	"max_views_triggered_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "bookmarks_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "short_link_visit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"short_link_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"slug" text NOT NULL,
	"browser_name" text,
	"os_name" text,
	"referrer_host" text,
	"referrer_url" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_term" text,
	"utm_content" text,
	"country_code" text,
	"country_name" text,
	"city_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "apikey" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "server_settings" ALTER COLUMN "preserved_usernames" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "config_id" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "reference_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "two_factor" ADD COLUMN "verified" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "media_jobs" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "media_jobs" ADD COLUMN "max_attempts" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "media_jobs" ADD COLUMN "next_run_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "media_jobs" ADD COLUMN "dead_letter_at" timestamp;--> statement-breakpoint
ALTER TABLE "preview_jobs" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "preview_jobs" ADD COLUMN "max_attempts" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "preview_jobs" ADD COLUMN "next_run_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "preview_jobs" ADD COLUMN "dead_letter_at" timestamp;--> statement-breakpoint
ALTER TABLE "remote_upload_jobs" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "remote_upload_jobs" ADD COLUMN "max_attempts" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "remote_upload_jobs" ADD COLUMN "next_run_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "remote_upload_jobs" ADD COLUMN "dead_letter_at" timestamp;--> statement-breakpoint
ALTER TABLE "server_settings" ADD COLUMN "sharing_domain" text;--> statement-breakpoint
ALTER TABLE "server_settings" ADD COLUMN "bookmarks_limit_user" integer DEFAULT 250 NOT NULL;--> statement-breakpoint
ALTER TABLE "server_settings" ADD COLUMN "bookmarks_limit_admin" integer DEFAULT 500 NOT NULL;--> statement-breakpoint
ALTER TABLE "stream_jobs" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "stream_jobs" ADD COLUMN "max_attempts" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "stream_jobs" ADD COLUMN "next_run_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "stream_jobs" ADD COLUMN "dead_letter_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_info" ADD COLUMN "bookmarks_limit" integer;--> statement-breakpoint
ALTER TABLE "user_info" ADD COLUMN "allow_bookmarks" boolean;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "default_bookmark_visibility" text DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "default_bookmark_tags" text[];--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "feature_bookmarks_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "bookmark_archive_jobs" ADD CONSTRAINT "bookmark_archive_jobs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmark_archive_jobs" ADD CONSTRAINT "bookmark_archive_jobs_bookmark_id_bookmarks_id_fk" FOREIGN KEY ("bookmark_id") REFERENCES "public"."bookmarks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmark_rss_feeds" ADD CONSTRAINT "bookmark_rss_feeds_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmark_tags" ADD CONSTRAINT "bookmark_tags_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_link_visit_events" ADD CONSTRAINT "short_link_visit_events_short_link_id_short_links_id_fk" FOREIGN KEY ("short_link_id") REFERENCES "public"."short_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_link_visit_events" ADD CONSTRAINT "short_link_visit_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookmark_archive_jobs_user_idx" ON "bookmark_archive_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bookmark_archive_jobs_bookmark_idx" ON "bookmark_archive_jobs" USING btree ("bookmark_id");--> statement-breakpoint
CREATE INDEX "bookmark_archive_jobs_status_idx" ON "bookmark_archive_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bookmark_archive_jobs_next_run_idx" ON "bookmark_archive_jobs" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "bookmark_archive_jobs_created_idx" ON "bookmark_archive_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bookmark_rss_feeds_user_url_idx" ON "bookmark_rss_feeds" USING btree ("user_id","feed_url");--> statement-breakpoint
CREATE INDEX "bookmark_rss_feeds_user_idx" ON "bookmark_rss_feeds" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bookmark_rss_feeds_next_fetch_idx" ON "bookmark_rss_feeds" USING btree ("next_fetch_at");--> statement-breakpoint
CREATE INDEX "bookmark_rss_feeds_enabled_idx" ON "bookmark_rss_feeds" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "bookmark_rss_feeds_created_idx" ON "bookmark_rss_feeds" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "bookmark_tags_user_name_idx" ON "bookmark_tags" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "bookmarks_user_id_idx" ON "bookmarks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bookmarks_created_at_idx" ON "bookmarks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "bookmarks_url_idx" ON "bookmarks" USING btree ("url");--> statement-breakpoint
CREATE INDEX "short_link_visit_events_link_idx" ON "short_link_visit_events" USING btree ("short_link_id");--> statement-breakpoint
CREATE INDEX "short_link_visit_events_user_idx" ON "short_link_visit_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "short_link_visit_events_slug_idx" ON "short_link_visit_events" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "short_link_visit_events_created_idx" ON "short_link_visit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "short_link_visit_events_browser_idx" ON "short_link_visit_events" USING btree ("browser_name");--> statement-breakpoint
CREATE INDEX "short_link_visit_events_os_idx" ON "short_link_visit_events" USING btree ("os_name");--> statement-breakpoint
CREATE INDEX "short_link_visit_events_referrer_idx" ON "short_link_visit_events" USING btree ("referrer_host");--> statement-breakpoint
CREATE INDEX "short_link_visit_events_utm_source_idx" ON "short_link_visit_events" USING btree ("utm_source");--> statement-breakpoint
CREATE INDEX "short_link_visit_events_country_idx" ON "short_link_visit_events" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "short_link_visit_events_city_idx" ON "short_link_visit_events" USING btree ("city_name");--> statement-breakpoint
CREATE INDEX "apikey_configId_idx" ON "apikey" USING btree ("config_id");--> statement-breakpoint
CREATE INDEX "apikey_referenceId_idx" ON "apikey" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "media_jobs_next_run_idx" ON "media_jobs" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "preview_jobs_next_run_idx" ON "preview_jobs" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "remote_upload_jobs_user_idx" ON "remote_upload_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "remote_upload_jobs_status_idx" ON "remote_upload_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "remote_upload_jobs_next_run_idx" ON "remote_upload_jobs" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "remote_upload_jobs_created_idx" ON "remote_upload_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "stream_jobs_next_run_idx" ON "stream_jobs" USING btree ("next_run_at");--> statement-breakpoint
ALTER TABLE "session" DROP COLUMN "impersonated_by";