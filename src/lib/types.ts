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
  bio: string | null;
  radius_km: number;
  availability_note: string | null;
  full_time_school: boolean;
  is_listed: boolean;
  parent_id: string | null;
  parent_consent: 'not_required' | 'pending' | 'approved' | 'rejected';
  parent_link_code: string | null;
  verification_status: 'none' | 'requested' | 'verified' | 'rejected';
  is_admin: boolean;
  is_suspended: boolean;
  created_at: string;
};

/** Öffentliche Ansicht (View `public_profiles`) – ohne Nachnamen, Geburtsdatum, Telefon. */
export type PublicProfile = {
  id: string;
  role: Role;
  display_name: string;
  age: number;
  city: string;
  postal_code: string;
  radius_km: number;
  bio: string | null;
  availability_note: string | null;
  is_verified: boolean;
  has_parent_consent: boolean;
  avg_rating: number | null;
  review_count: number;
  completed_jobs: number;
  work_min_hour: number | null;
  work_max_hour: number | null;
  work_max_minutes: number | null;
  created_at: string;
};

export type Offer = {
  id: string;
  student_id: string;
  category: string;
  title: string;
  description: string | null;
  price_min: number;
  price_max: number;
  price_unit: 'stunde' | 'auftrag';
};

export type JobStatus = 'requested' | 'accepted' | 'declined' | 'cancelled' | 'completed';

export type Job = {
  id: string;
  client_id: string;
  student_id: string;
  offer_id: string | null;
  category: string;
  description: string;
  scheduled_start: string;
  duration_minutes: number;
  agreed_price: number | null;
  payment_method: 'bar' | 'paypal' | 'ueberweisung';
  status: JobStatus;
  cancelled_by: string | null;
  created_at: string;
  completed_at: string | null;
};

export type JobAddress = {
  job_id: string;
  street: string;
  postal_code: string;
  city: string;
  notes: string | null;
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
