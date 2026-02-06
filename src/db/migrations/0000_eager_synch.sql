CREATE TYPE "public"."max_views_action" AS ENUM('make_private', 'delete');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'user');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_key_secrets" (
	"key_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"encrypted_key" text NOT NULL,
	"iv" text NOT NULL,
	"tag" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apikey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"start" text,
	"prefix" text,
	"key" text NOT NULL,
	"user_id" text NOT NULL,
	"refill_interval" integer,
	"refill_amount" integer,
	"last_refill_at" timestamp,
	"enabled" boolean DEFAULT true,
	"rate_limit_enabled" boolean DEFAULT true,
	"rate_limit_time_window" integer DEFAULT 86400000,
	"rate_limit_max" integer DEFAULT 10,
	"request_count" integer DEFAULT 0,
	"remaining" integer,
	"last_request" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"permissions" text,
	"metadata" text
);
--> statement-breakpoint
CREATE TABLE "device_auth" (
	"id" text PRIMARY KEY NOT NULL,
	"device_code_hash" text NOT NULL,
	"user_code" text NOT NULL,
	"extension_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"user_id" text,
	"expires_at" timestamp NOT NULL,
	"interval" integer DEFAULT 5,
	"last_polled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp,
	"aaguid" text
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"username" text,
	"display_username" text,
	"is_anonymous" boolean DEFAULT false,
	"two_factor_enabled" boolean DEFAULT false,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text,
	"job" text NOT NULL,
	"status" text NOT NULL,
	"result" json,
	"error" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "anilist_link" (
	"user_id" text PRIMARY KEY NOT NULL,
	"access_token" text NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audio_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"title" text,
	"artist" text,
	"album" text,
	"picture_data_url" text,
	"gradient" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" uuid,
	"seq" integer,
	"actor_id" text,
	"actor_role" varchar(32),
	"action" varchar(64) NOT NULL,
	"target_type" varchar(64) NOT NULL,
	"target_id" text NOT NULL,
	"ip" varchar(64),
	"user_agent" varchar(512),
	"status_code" varchar(3),
	"meta" json DEFAULT '{}'::json,
	"previous_hash" text,
	"hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "export_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"file_name" text,
	"stored_name" text,
	"storage_driver" text,
	"size" integer,
	"error" text,
	"options" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"folder_id" uuid,
	"original_name" text NOT NULL,
	"stored_name" text NOT NULL,
	"storage_driver" text DEFAULT 'local' NOT NULL,
	"slug" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"description" text,
	"password" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"content_hash" text,
	"is_public" boolean DEFAULT false,
	"anonymous_share_enabled" boolean DEFAULT false NOT NULL,
	"views" integer DEFAULT 0,
	"max_views" integer,
	"max_views_action" "max_views_action",
	"max_views_triggered_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "files_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "files_to_tags" (
	"file_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "files_to_tags_file_id_tag_id_pk" PRIMARY KEY("file_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"share_enabled" boolean DEFAULT false NOT NULL,
	"share_password" text,
	"share_slug" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "folders_share_slug_unique" UNIQUE("share_slug")
);
--> statement-breakpoint
CREATE TABLE "import_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"user_id" text,
	"items_total" integer DEFAULT 0 NOT NULL,
	"items_ok" integer DEFAULT 0 NOT NULL,
	"items_fail" integer DEFAULT 0 NOT NULL,
	"result" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"secret" text,
	"format" varchar(32) DEFAULT 'json' NOT NULL,
	"events" json DEFAULT '[]'::json,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_status" integer,
	"last_error" text,
	"last_delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"note" text,
	"expires_at" timestamp with time zone NOT NULL,
	"max_uses" integer,
	"uses_count" integer DEFAULT 0 NOT NULL,
	"is_disabled" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invite_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "media_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"file_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"kind" text NOT NULL,
	"quality" integer NOT NULL,
	"output_mime_type" text,
	"output_size" integer,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"message" text,
	"type" text DEFAULT 'system' NOT NULL,
	"data" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "preview_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"file_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"output_mime_type" text,
	"output_size" integer,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remote_upload_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"url" text NOT NULL,
	"name" text,
	"status" text NOT NULL,
	"percent" integer NOT NULL,
	"file_id" text,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_name" text,
	"support_name" text,
	"support_email" text,
	"max_upload_mb" integer DEFAULT 1024 NOT NULL,
	"max_files_per_upload" integer DEFAULT 25 NOT NULL,
	"allow_public_registration" boolean DEFAULT true NOT NULL,
	"password_policy_min_length" integer DEFAULT 10 NOT NULL,
	"preserved_usernames" text[] DEFAULT '{}',
	"user_max_storage_mb" integer DEFAULT 5120 NOT NULL,
	"admin_max_storage_mb" integer DEFAULT 10240 NOT NULL,
	"user_daily_quota_mb" integer DEFAULT 1024 NOT NULL,
	"admin_daily_quota_mb" integer DEFAULT 2048 NOT NULL,
	"short_links_limit_user" integer DEFAULT 50 NOT NULL,
	"short_links_limit_admin" integer DEFAULT 100 NOT NULL,
	"files_limit_user" integer DEFAULT 250 NOT NULL,
	"files_limit_admin" integer DEFAULT 500 NOT NULL,
	"allowed_mime_prefixes" text[],
	"disallowed_extensions" text[],
	"setup_completed" boolean DEFAULT false NOT NULL,
	"allow_remote_upload" boolean DEFAULT false,
	"sponsor_banner_enabled" boolean DEFAULT true NOT NULL,
	"disable_api_tokens" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "short_link_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "short_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"original_url" text NOT NULL,
	"slug" text NOT NULL,
	"is_public" boolean DEFAULT false,
	"is_favorite" boolean DEFAULT false,
	"anonymous_share_enabled" boolean DEFAULT false NOT NULL,
	"description" text,
	"password" text,
	"max_clicks" integer,
	"click_count" integer DEFAULT 0,
	"max_views_action" "max_views_action",
	"max_views_triggered_at" timestamp,
	"tags" text[],
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "short_links_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "steam_link" (
	"user_id" text PRIMARY KEY NOT NULL,
	"steam_id_64" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storage_cleanup_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"stored_name" text NOT NULL,
	"storage_driver" text DEFAULT 'local' NOT NULL,
	"is_prefix" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stream_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"file_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"quality" integer,
	"output_mime_type" text,
	"output_size" integer,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "upload_request_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"upload_request_id" uuid NOT NULL,
	"file_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp,
	"decided_by" text
);
--> statement-breakpoint
CREATE TABLE "upload_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"slug" text NOT NULL,
	"folder_name" text,
	"brand_color" text,
	"brand_logo_url" text,
	"max_uploads" integer DEFAULT 0,
	"uploads_count" integer DEFAULT 0 NOT NULL,
	"views_count" integer DEFAULT 0 NOT NULL,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"password_hash" text,
	"per_user_upload_limit" integer DEFAULT 0 NOT NULL,
	"per_user_window_hours" integer DEFAULT 24 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "upload_requests_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_embed_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"title" text,
	"description" text,
	"site_name" text,
	"color" text,
	"image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_info" (
	"user_id" text PRIMARY KEY NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"bio" text,
	"max_storage_mb" integer,
	"max_upload_mb" integer,
	"files_limit" integer,
	"short_links_limit" integer,
	"allow_remote_upload" boolean,
	"disable_api_tokens" boolean DEFAULT false NOT NULL,
	"allow_files" boolean,
	"allow_shortlinks" boolean,
	"allow_watchlist" boolean,
	"verified" boolean DEFAULT false NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"reveal_spoilers" boolean DEFAULT false NOT NULL,
	"hide_previews" boolean DEFAULT false NOT NULL,
	"vault_view" text DEFAULT 'list' NOT NULL,
	"vault_sort" text DEFAULT 'newest' NOT NULL,
	"remember_last_folder" boolean DEFAULT false NOT NULL,
	"last_folder" text,
	"autoplay_media" boolean DEFAULT false NOT NULL,
	"open_shared_in_new_tab" boolean DEFAULT false NOT NULL,
	"hide_public_share_confirmations" boolean DEFAULT false NOT NULL,
	"public_profile_enabled" boolean DEFAULT true NOT NULL,
	"show_socials_on_share" boolean DEFAULT false NOT NULL,
	"social_instagram" text,
	"social_x" text,
	"social_github" text,
	"social_website" text,
	"social_other" text,
	"default_upload_visibility" text DEFAULT 'private' NOT NULL,
	"default_upload_folder" text,
	"default_upload_tags" text[] DEFAULT '{}',
	"default_shortlink_visibility" text DEFAULT 'private' NOT NULL,
	"default_shortlink_tags" text[] DEFAULT '{}',
	"default_shortlink_max_clicks" integer,
	"default_shortlink_expire_days" integer,
	"default_shortlink_slug_prefix" text DEFAULT '' NOT NULL,
	"remember_settings_tab" boolean DEFAULT true NOT NULL,
	"last_settings_tab" text DEFAULT 'display' NOT NULL,
	"size_format" text DEFAULT 'auto' NOT NULL,
	"feature_files_enabled" boolean DEFAULT true NOT NULL,
	"feature_shortlinks_enabled" boolean DEFAULT true NOT NULL,
	"feature_watchlist_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_upload_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"name_convention" text DEFAULT 'original' NOT NULL,
	"slug_convention" text DEFAULT 'funny' NOT NULL,
	"image_compression_enabled" boolean DEFAULT true NOT NULL,
	"image_compression_quality" integer DEFAULT 85 NOT NULL,
	"media_transcode_enabled" boolean DEFAULT false NOT NULL,
	"media_transcode_quality" integer DEFAULT 70 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watch_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"season" integer DEFAULT 0 NOT NULL,
	"episode" integer NOT NULL,
	"watched_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "watchlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"provider" varchar(20) DEFAULT 'tmdb' NOT NULL,
	"media_type" varchar(20) NOT NULL,
	"provider_id" varchar(64) NOT NULL,
	"title" text NOT NULL,
	"poster_path" text,
	"overview" text,
	"year" integer,
	"status" varchar(20) DEFAULT 'planned' NOT NULL,
	"rating" integer,
	"notes" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key_secrets" ADD CONSTRAINT "api_key_secrets_key_id_apikey_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."apikey"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key_secrets" ADD CONSTRAINT "api_key_secrets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apikey" ADD CONSTRAINT "apikey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_auth" ADD CONSTRAINT "device_auth_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_job_runs" ADD CONSTRAINT "admin_job_runs_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anilist_link" ADD CONSTRAINT "anilist_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_metadata" ADD CONSTRAINT "audio_metadata_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files_to_tags" ADD CONSTRAINT "files_to_tags_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files_to_tags" ADD CONSTRAINT "files_to_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_webhooks" ADD CONSTRAINT "integration_webhooks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_jobs" ADD CONSTRAINT "media_jobs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_jobs" ADD CONSTRAINT "media_jobs_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preview_jobs" ADD CONSTRAINT "preview_jobs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preview_jobs" ADD CONSTRAINT "preview_jobs_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_link_tags" ADD CONSTRAINT "short_link_tags_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_links" ADD CONSTRAINT "short_links_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steam_link" ADD CONSTRAINT "steam_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_cleanup_jobs" ADD CONSTRAINT "storage_cleanup_jobs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_jobs" ADD CONSTRAINT "stream_jobs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_jobs" ADD CONSTRAINT "stream_jobs_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_request_items" ADD CONSTRAINT "upload_request_items_upload_request_id_upload_requests_id_fk" FOREIGN KEY ("upload_request_id") REFERENCES "public"."upload_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_request_items" ADD CONSTRAINT "upload_request_items_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_request_items" ADD CONSTRAINT "upload_request_items_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_requests" ADD CONSTRAINT "upload_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_embed_settings" ADD CONSTRAINT "user_embed_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_info" ADD CONSTRAINT "user_info_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_upload_settings" ADD CONSTRAINT "user_upload_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_item_id_watchlist_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."watchlist_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_key_secrets_user_id_idx" ON "api_key_secrets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "apikey_key_idx" ON "apikey" USING btree ("key");--> statement-breakpoint
CREATE INDEX "apikey_userId_idx" ON "apikey" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "device_auth_device_code_hash_idx" ON "device_auth" USING btree ("device_code_hash");--> statement-breakpoint
CREATE INDEX "device_auth_user_code_idx" ON "device_auth" USING btree ("user_code");--> statement-breakpoint
CREATE INDEX "device_auth_user_id_idx" ON "device_auth" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_userId_idx" ON "passkey" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_credentialID_idx" ON "passkey" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "twoFactor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "twoFactor_userId_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "admin_job_runs_created_idx" ON "admin_job_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "anilist_link_user_idx" ON "anilist_link" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "audio_metadata_file_id_idx" ON "audio_metadata" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "audio_metadata_created_idx" ON "audio_metadata" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_chain_idx" ON "audit_log" USING btree ("chain_id","seq");--> statement-breakpoint
CREATE INDEX "export_jobs_user_idx" ON "export_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "export_jobs_status_idx" ON "export_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "export_jobs_created_idx" ON "export_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "files_user_id_idx" ON "files" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "files_folder_id_idx" ON "files" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "files_created_at_idx" ON "files" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "files_content_hash_idx" ON "files" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "files_user_created_idx" ON "files" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "files_user_public_idx" ON "files" USING btree ("user_id","is_public");--> statement-breakpoint
CREATE INDEX "files_user_favorite_idx" ON "files" USING btree ("user_id","is_favorite");--> statement-breakpoint
CREATE INDEX "files_user_mime_idx" ON "files" USING btree ("user_id","mime_type");--> statement-breakpoint
CREATE INDEX "files_user_folder_idx" ON "files" USING btree ("user_id","folder_id");--> statement-breakpoint
CREATE INDEX "files_to_tags_file_id_idx" ON "files_to_tags" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "files_to_tags_tag_id_idx" ON "files_to_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "files_to_tags_tag_file_idx" ON "files_to_tags" USING btree ("tag_id","file_id");--> statement-breakpoint
CREATE INDEX "folders_user_id_idx" ON "folders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "import_runs_user_idx" ON "import_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "import_runs_created_idx" ON "import_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "integration_webhooks_user_idx" ON "integration_webhooks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "media_jobs_user_idx" ON "media_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "media_jobs_file_idx" ON "media_jobs" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "media_jobs_status_idx" ON "media_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "media_jobs_created_idx" ON "media_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_read_idx" ON "notifications" USING btree ("read_at");--> statement-breakpoint
CREATE INDEX "notifications_created_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "preview_jobs_user_idx" ON "preview_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "preview_jobs_file_idx" ON "preview_jobs" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "preview_jobs_status_idx" ON "preview_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "preview_jobs_created_idx" ON "preview_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "short_link_tags_user_name_idx" ON "short_link_tags" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "short_links_user_id_idx" ON "short_links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "short_links_created_at_idx" ON "short_links" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "short_links_expires_at_idx" ON "short_links" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "steam_link_steam_id_idx" ON "steam_link" USING btree ("steam_id_64");--> statement-breakpoint
CREATE INDEX "storage_cleanup_jobs_user_idx" ON "storage_cleanup_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "storage_cleanup_jobs_status_idx" ON "storage_cleanup_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "storage_cleanup_jobs_created_idx" ON "storage_cleanup_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "stream_jobs_user_idx" ON "stream_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stream_jobs_file_idx" ON "stream_jobs" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "stream_jobs_status_idx" ON "stream_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stream_jobs_created_idx" ON "stream_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tags_user_name_idx" ON "tags" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "upload_request_items_request_idx" ON "upload_request_items" USING btree ("upload_request_id");--> statement-breakpoint
CREATE INDEX "upload_request_items_status_idx" ON "upload_request_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "upload_requests_user_id_idx" ON "upload_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "upload_requests_slug_idx" ON "upload_requests" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "user_embed_settings_user_id_idx" ON "user_embed_settings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_info_role_idx" ON "user_info" USING btree ("role");--> statement-breakpoint
CREATE INDEX "user_preferences_user_id_idx" ON "user_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_upload_settings_user_idx" ON "user_upload_settings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "progress_item_idx" ON "watch_progress" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "watch_user_idx" ON "watchlist_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "watch_public_idx" ON "watchlist_items" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "watch_updated_idx" ON "watchlist_items" USING btree ("updated_at");