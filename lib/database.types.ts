// Hand-written types mirroring supabase/migrations/0001_init.sql.
// If the schema changes, update this alongside the migration
// (or generate with `supabase gen types typescript` once the project is linked).

export type UserRole = "viewer" | "creator" | "admin";
export type ContentType = "quote" | "scripture" | "video";
export type ContentTag = "QUOTE" | "SCRIPTURE" | "SPEECH";
export type ContentStatus = "pending" | "approved" | "rejected";
export type MaturityRating = "general" | "mature";

export interface Profile {
  id: string;
  display_name: string;
  email: string;
  role: UserRole;
  birthdate: string | null;
  bio: string | null;
  avatar_color: string | null;
  interests: ContentTag[];
  onboarded: boolean;
  created_at: string;
}

export interface ContentItem {
  id: string;
  type: ContentType;
  tag: ContentTag;
  text: string;
  attributed_to: string;
  source: string | null;
  video_platform: "youtube" | "other" | null;
  video_id: string | null;
  audio_track_id: string | null;
  person_id: string | null;
  maturity_rating: MaturityRating;
  status: ContentStatus;
  submitted_by: string;
  reviewed_by: string | null;
  view_count: number;
  created_at: string;
  // joined convenience field, populated by the moderation query
  submitted_by_profile?: { display_name: string } | null;
}

export interface UserContentInteraction {
  user_id: string;
  content_id: string;
  liked: boolean;
  saved: boolean;
  collection_label: string | null;
  viewed_at: string | null;
}

export interface UsageSession {
  user_id: string;
  date: string;
  ms_spent: number;
}
