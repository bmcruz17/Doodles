// Hand-maintained types mirroring supabase/migrations/0001_init.sql.
// Regenerate a fuller version with:
//   supabase gen types typescript --project-id <ref> > src/lib/types.ts

export type MembershipTier = 'basic' | 'premium'
export type Sex = 'male' | 'female' | 'unknown'

export type HealthRecordType =
  | 'vet_visit'
  | 'medication'
  | 'allergy'
  | 'weight_log'
  | 'lab_result'
  | 'note'

export type VendorCategory =
  | 'grooming'
  | 'mobile_vet'
  | 'vet'
  | 'food'
  | 'supplies'
  | 'insurance'
  | 'sitter'
  | 'walking'
  | 'boarding'
  | 'daycare'
  | 'training'
  | 'waste_removal'
  | 'specialist'
  | 'travel'
  | 'other'

export type VendorStatus = 'active' | 'pending' | 'paused'
export type Fulfillment = 'affiliate' | 'in_house'
export type ServiceInterval = 'once' | 'week' | 'month' | 'year'
export type BookingStatus = 'requested' | 'confirmed' | 'completed' | 'cancelled'
export type TravelType = 'flight' | 'rental' | 'car' | 'ground' | 'other'

export type SubscriptionStatus =
  | 'incomplete'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[]

export type UserProfile = {
  id: string
  email: string
  name: string | null
  phone: string | null
  membership_tier: MembershipTier | null
  stripe_customer_id: string | null
  created_at: string
  updated_at: string
}

export type Pet = {
  id: string
  owner_id: string
  name: string
  breed: string | null
  birthdate: string | null
  weight_lbs: number | null
  coat_type: string | null
  sex: Sex | null
  photo_url: string | null
  ai_profile: Json
  notes: string | null
  created_at: string
  updated_at: string
}

// health_records.data holds the displayable payload, e.g. { title, notes }.
export type HealthRecordData = {
  title?: string
  notes?: string
  [key: string]: Json | undefined
}

export type HealthRecord = {
  id: string
  pet_id: string
  record_type: HealthRecordType
  data: HealthRecordData
  document_url: string | null
  recorded_at: string
  created_at: string
  updated_at: string
}

export type Vaccination = {
  id: string
  pet_id: string
  vaccine: string
  administered_at: string
  expires_at: string | null
  veterinarian: string | null
  certificate_url: string | null
  created_at: string
  updated_at: string
}

export type Vendor = {
  id: string
  owner_id: string | null
  name: string
  category: VendorCategory
  description: string | null
  location: string | null
  verified: boolean
  fulfillment: Fulfillment
  rating: number | null
  status: VendorStatus
  stripe_connect_id: string | null
  created_at: string
  updated_at: string
}

export type Service = {
  id: string
  vendor_id: string
  title: string
  description: string | null
  price: number
  currency: string
  recurring: boolean
  interval: ServiceInterval | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Booking = {
  id: string
  user_id: string
  pet_id: string | null
  service_id: string | null
  vendor_id: string | null
  scheduled_for: string | null
  status: BookingStatus
  amount: number
  commission: number
  currency: string
  stripe_payment_intent_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type Subscription = {
  id: string
  user_id: string
  pet_id: string | null
  tier: MembershipTier
  status: SubscriptionStatus
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  price_id: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  started_at: string
  created_at: string
  updated_at: string
}

export type TravelBooking = {
  id: string
  user_id: string
  pet_id: string | null
  type: TravelType
  partner_id: string | null
  destination: string | null
  details: Json
  amount: number
  commission: number
  currency: string
  status: BookingStatus
  created_at: string
  updated_at: string
}

export type BackgroundCheckStatus =
  | 'not_started'
  | 'consent_given'
  | 'submitted'
  | 'in_review'
  | 'approved'
  | 'rejected'

export type SitterProfile = {
  id: string
  user_id: string
  display_name: string
  bio: string
  location: string | null
  photo_url: string | null
  hourly_rate: number | null
  years_experience: number | null
  services: string[]
  background_check_status: BackgroundCheckStatus
  background_check_consent_at: string | null
  id_document_url: string | null
  verified: boolean
  listed: boolean
  rating: number | null
  created_at: string
  updated_at: string
}

export type FriendshipStatus = 'pending' | 'accepted'

export type Friendship = {
  id: string
  requester_id: string
  addressee_id: string
  requester_name: string
  addressee_name: string
  status: FriendshipStatus
  created_at: string
  updated_at: string
}

export type Post = {
  id: string
  author_id: string
  author_name: string
  pet_id: string | null
  pet_name: string | null
  caption: string
  image_url: string | null
  location: string | null
  hashtags: string[]
  created_at: string
}

export type PostComment = {
  id: string
  post_id: string
  author_id: string
  author_name: string
  body: string
  created_at: string
}

export type PostLike = {
  post_id: string
  user_id: string
  created_at: string
}

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  ts?: string
}

export type AiConversation = {
  id: string
  pet_id: string
  messages: ChatMessage[]
  created_at: string
  updated_at: string
}

// Minimal Database shape for the typed Supabase client.
type Generated = 'id' | 'created_at' | 'updated_at'

export type Database = {
  public: {
    Tables: {
      users: {
        Row: UserProfile
        Insert: Partial<UserProfile> & { id: string; email: string }
        Update: Partial<UserProfile>
        Relationships: []
      }
      pets: {
        Row: Pet
        Insert: Omit<Pet, Generated | 'ai_profile'> & {
          owner_id: string
          ai_profile?: Json
        }
        Update: Partial<Pet>
        Relationships: []
      }
      health_records: {
        Row: HealthRecord
        Insert: Omit<HealthRecord, Generated | 'recorded_at'> & {
          recorded_at?: string
        }
        Update: Partial<HealthRecord>
        Relationships: []
      }
      vaccinations: {
        Row: Vaccination
        Insert: Omit<Vaccination, Generated>
        Update: Partial<Vaccination>
        Relationships: []
      }
      vendors: {
        Row: Vendor
        Insert: Partial<Vendor> & { name: string; category: VendorCategory }
        Update: Partial<Vendor>
        Relationships: []
      }
      services: {
        Row: Service
        Insert: Partial<Service> & { vendor_id: string; title: string }
        Update: Partial<Service>
        Relationships: []
      }
      bookings: {
        Row: Booking
        Insert: Partial<Booking> & { user_id: string }
        Update: Partial<Booking>
        Relationships: []
      }
      subscriptions: {
        Row: Subscription
        Insert: Partial<Subscription> & { user_id: string }
        Update: Partial<Subscription>
        Relationships: []
      }
      travel_bookings: {
        Row: TravelBooking
        Insert: Omit<TravelBooking, Generated> & { user_id: string }
        Update: Partial<TravelBooking>
        Relationships: []
      }
      ai_conversations: {
        Row: AiConversation
        Insert: Partial<AiConversation> & { pet_id: string }
        Update: Partial<AiConversation>
        Relationships: []
      }
      posts: {
        Row: Post
        Insert: Omit<Post, 'id' | 'created_at'> & {
          id?: string
          hashtags?: string[]
        }
        Update: Partial<Post>
        Relationships: []
      }
      post_comments: {
        Row: PostComment
        Insert: Omit<PostComment, 'id' | 'created_at'> & { id?: string }
        Update: Partial<PostComment>
        Relationships: []
      }
      post_likes: {
        Row: PostLike
        Insert: Omit<PostLike, 'created_at'> & { created_at?: string }
        Update: Partial<PostLike>
        Relationships: []
      }
      sitter_profiles: {
        Row: SitterProfile
        Insert: Partial<SitterProfile> & { user_id: string }
        Update: Partial<SitterProfile>
        Relationships: []
      }
      friendships: {
        Row: Friendship
        Insert: Partial<Friendship> & {
          requester_id: string
          addressee_id: string
        }
        Update: Partial<Friendship>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
