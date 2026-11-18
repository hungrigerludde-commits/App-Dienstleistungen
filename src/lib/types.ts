export type Role = 'student' | 'client' | 'parent';

/** Eigenes, privates Profil (Tabelle `profiles`). */
export type Profile = {
  id: string;
  role: Role;
  first_name: string;
  last_name: string;
  birth_date: string;
  phone: string | null;
  city: string;
  postal_code: string;
  home_lat: number | null;
  home_lng: number | null;
  radius_km: number;
  bio: string | null;
  availability_note: string | null;
  language: 'de' | 'en';
  full_time_school: boolean;
  is_listed: boolean;
  parent_id: string | null;
  parent_consent: 'not_required' | 'pending' | 'approved' | 'rejected';
  parent_link_code: string | null;
  verification_status: 'none' | 'pending' | 'verified' | 'rejected';
  is_admin: boolean;
  is_suspended: boolean;
  created_at: string;
};

/** Öffentliche Ansicht (View `public_profiles`). */
export type PublicProfile = {
  id: string;
  role: Role;
  display_name: string;
  age: number;
  city: string;
  radius_km: number;
  bio: string | null;
  availability_note: string | null;
  is_verified: boolean;
  can_participate: boolean;
  avg_rating: number | null;
  review_count: number;
  completed_jobs: number;
  work_min_hour: number | null;
  work_max_hour: number | null;
  work_max_minutes: number | null;
};

export type Offer = {
  id: string;
  student_id: string;
  service: string;
  title: string;
  description: string | null;
  price_min: number;
  price_max: number;
  price_unit: 'stunde' | 'auftrag';
};

export type JobPost = {
  id: string;
  client_id: string;
  service: string;
  title: string;
  description: string;
  price_min: number;
  price_max: number;
  price_unit: 'stunde' | 'auftrag';
  scheduled_start: string;
  duration_minutes: number;
  approx_lat: number;
  approx_lng: number;
  city: string;
  postal_code: string;
  status: 'open' | 'closed';
  created_at: string;
};

export type PostAddress = {
  post_id: string;
  street: string;
  postal_code: string;
  city: string;
  notes: string | null;
  lat: number;
  lng: number;
};

export type JobStatus = 'requested' | 'accepted' | 'declined' | 'cancelled' | 'completed';

export type Job = {
  id: string;
  post_id: string;
  client_id: string;
  student_id: string;
  service: string;
  title: string;
  description: string;
  scheduled_start: string;
  duration_minutes: number;
  agreed_price: number;
  initiated_by: 'client' | 'student';
  status: JobStatus;
  client_done: boolean;
  student_done: boolean;
  cancelled_by: string | null;
  created_at: string;
  completed_at: string | null;
};

export type Payment = {
  id: string;
  job_id: string;
  amount: number;
  method: 'paypal' | 'bank' | 'vivid' | 'visa';
  status: 'held' | 'released' | 'refunded';
};

export type Message = {
  id: string;
  job_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type Review = {
  id: string;
  job_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type Photo = {
  id: string;
  owner_id: string;
  kind: 'post' | 'portfolio';
  post_id: string | null;
  storage_path: string;
  caption: string | null;
};

/** Ergebnis von student_suggestions() */
export type PostSuggestion = {
  post_id: string;
  client_id: string;
  client_name: string;
  client_rating: number | null;
  client_reviews: number;
  service: string;
  title: string;
  description: string;
  price_min: number;
  price_max: number;
  price_unit: 'stunde' | 'auftrag';
  scheduled_start: string;
  duration_minutes: number;
  city: string;
  approx_lat: number;
  approx_lng: number;
  distance_km: number;
  photo_count: number;
  is_favorite: boolean;
};

/** Ergebnis von client_suggestions() */
export type StudentSuggestion = {
  student_id: string;
  display_name: string;
  age: number;
  avg_rating: number | null;
  review_count: number;
  completed_jobs: number;
  bio: string | null;
  offer_id: string;
  offer_title: string;
  service: string;
  price_min: number;
  price_max: number;
  price_unit: 'stunde' | 'auftrag';
  post_id: string;
  post_title: string;
  distance_km: number;
  portfolio_count: number;
  is_favorite: boolean;
};

/** Ergebnis von child_jobs() (nur für Eltern) */
export type ChildJob = {
  job_id: string;
  status: JobStatus;
  service: string;
  title: string;
  scheduled_start: string;
  duration_minutes: number;
  agreed_price: number;
  client_name: string;
  client_phone: string | null;
  client_verified: boolean;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
};
