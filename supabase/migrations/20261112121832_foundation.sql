-- Public API tables are RLS protected; writes are restricted to transition RPCs.
create schema private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.intent as enum ('looking_for_room','have_room','find_together');
create type public.profile_state as enum ('draft','active','paused','closed','suspended');
create type public.listing_state as enum ('draft','pending_review','active','paused','expired','filled','removed');
create type public.interest_state as enum ('sent','mutual','passed','withdrawn','blocked');
create type public.visit_state as enum ('requested','confirmed','declined','rescheduled','cancelled','completed','no_show');
create type public.report_state as enum ('open','investigating','resolved','dismissed','escalated');
create table public.cities (id text primary key, name text not null);
create table public.localities (id text not null, city_id text references public.cities, name text not null, primary key(city_id,id));
insert into public.cities values ('gurugram','Gurugram'),('noida','Noida');
insert into public.localities values ('dlf-phase-3','gurugram','DLF Phase 3'),('sector-56','gurugram','Sector 56'),('sector-62','noida','Sector 62'),('sector-137','noida','Sector 137');

create table public.profiles (
 id uuid primary key references auth.users on delete cascade, display_name text not null check(length(display_name) between 2 and 60),
 age_confirmed boolean not null check(age_confirmed), city_id text not null references public.cities, localities text[] not null check(cardinality(localities) between 1 and 4),
 budget_min integer not null check(budget_min >= 0), budget_max integer not null check(budget_max between budget_min and 50000000),
 move_from date not null, move_until date not null check(move_until between move_from and move_from+180),
 stay_months smallint not null check(stay_months between 1 and 36), intent public.intent not null,
 status public.profile_state not null default 'draft', discoverable boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_preference_answers (user_id uuid references public.profiles on delete cascade, dimension text, habit text, expectation text, strength text not null check(strength in ('flexible','preference','dealbreaker')), primary key(user_id,dimension));
create table public.onboarding_progress (user_id uuid primary key references public.profiles on delete cascade, step text not null check(step in ('lifestyle','preferences','complete')), updated_at timestamptz not null default now());
create table public.user_consents (user_id uuid references auth.users on delete cascade, purpose text check(purpose in ('terms','analytics')), granted boolean not null, revision text not null, updated_at timestamptz not null default now(), primary key(user_id,purpose));
create table public.notification_preferences (user_id uuid primary key references public.profiles on delete cascade, reminders boolean not null default false);
create table public.verification_checks (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade, kind text not null check(kind='email'), verified_at timestamptz not null, unique(user_id,kind));
create table private.moderators (user_id uuid primary key references auth.users on delete cascade);

create table public.listings (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles on delete cascade,
 title text not null check(length(title) between 8 and 90), description text not null check(length(description) between 10 and 1200),
 city_id text not null, locality_id text not null, foreign key(city_id,locality_id) references public.localities(city_id,id),
 room_type text not null check(room_type in ('private_room','shared_room','entire_flat','other')),
 building text not null check(building in ('Society apartment','Independent floor','Standalone building','Other')),
 furnishing text not null check(furnishing in ('Unfurnished','Semi-furnished','Furnished')),
 bath_sharing text not null check(bath_sharing in ('Private','Shared')),
 rooms smallint not null check(rooms between 1 and 20), bathrooms smallint not null check(bathrooms between 1 and 20),
 occupants smallint not null check(occupants between 0 and 20), capacity smallint not null check(capacity between occupants+1 and 20),
 poster_type text not null check(poster_type in ('Occupant','Owner')), attested boolean not null check(attested),
 transport text not null default '' check(length(transport)<=300), restrictions text not null default '' check(length(restrictions)<=300),
 rent integer not null check(rent between 100 and 50000000), maintenance integer not null check(maintenance between 0 and 50000000),
 utilities integer check(utilities between 0 and 50000000), recurring integer not null check(recurring between 0 and 50000000),
 deposit integer not null check(deposit between 0 and 50000000), brokerage integer not null check(brokerage between 0 and 50000000),
 fees integer not null check(fees between 0 and 50000000),
 monthly integer generated always as (rent+maintenance+coalesce(utilities,0)+recurring) stored,
 available_from date not null, available_until date not null check(available_until between available_from and available_from+180),
 min_months smallint not null check(min_months between 1 and 36), status public.listing_state not null default 'draft',
 confirmed_at timestamptz, expires_at timestamptz, reviewed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.listing_amenities (listing_id uuid references public.listings on delete cascade, amenity text, primary key(listing_id,amenity),check(amenity in ('Lift','AC','Parking','Power backup','Wi-Fi','Step-free access','Reliable water')));
create table public.household_preferences (listing_id uuid references public.listings on delete cascade, dimension text, habit text, expectation text, strength text not null check(strength in ('flexible','preference','dealbreaker')), primary key(listing_id,dimension));
create table public.listing_images (id uuid primary key default gen_random_uuid(), listing_id uuid not null references public.listings on delete cascade, path text not null unique, digest text not null, created_at timestamptz not null default now(), unique(listing_id,digest));
create table public.listing_reconfirmations (id uuid primary key default gen_random_uuid(), listing_id uuid not null references public.listings on delete cascade, created_at timestamptz not null default now());

create table public.interests (actor_id uuid references public.profiles on delete cascade, target_id uuid references public.profiles on delete cascade, status public.interest_state not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key(actor_id,target_id), check(actor_id<>target_id));
create table public.matches (id uuid primary key default gen_random_uuid(), member_a uuid not null references public.profiles on delete cascade, member_b uuid not null references public.profiles on delete cascade, created_at timestamptz not null default now(), unique(member_a,member_b),check(member_a<member_b));
create table public.conversations (id uuid primary key default gen_random_uuid(), match_id uuid not null unique references public.matches on delete cascade, created_at timestamptz not null default now());
create table public.conversation_members (conversation_id uuid references public.conversations on delete cascade,user_id uuid references public.profiles on delete cascade,primary key(conversation_id,user_id));
create table public.messages (id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations on delete cascade,sender_id uuid not null references public.profiles on delete cascade, body text not null check(length(body) between 1 and 1500), request_key uuid not null, suspicious boolean not null default false, created_at timestamptz not null default now(), unique(sender_id,request_key));
create table public.message_read_states (conversation_id uuid references public.conversations on delete cascade,user_id uuid references public.profiles on delete cascade,read_at timestamptz not null default now(),primary key(conversation_id,user_id));
create table public.saved_items (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade, profile_id uuid references public.profiles on delete cascade, listing_id uuid references public.listings on delete cascade,created_at timestamptz not null default now(),check(num_nonnulls(profile_id,listing_id)=1),unique nulls not distinct(user_id,profile_id,listing_id));

create table public.visit_requests (id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.conversations on delete cascade,requester_id uuid not null references public.profiles on delete cascade, proposer_id uuid not null references public.profiles on delete cascade,starts_at timestamptz not null, status public.visit_state not null default 'requested', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.visit_events (id uuid primary key default gen_random_uuid(), visit_id uuid not null references public.visit_requests on delete cascade, actor_id uuid references public.profiles on delete set null, status public.visit_state not null, created_at timestamptz not null default now());
create table private.visit_locations (visit_id uuid primary key references public.visit_requests on delete cascade, shared_by uuid not null references public.profiles on delete cascade, details text not null check(length(details) between 4 and 300));
create table public.blocks (actor_id uuid references public.profiles on delete cascade, target_id uuid references public.profiles on delete cascade, created_at timestamptz not null default now(),primary key(actor_id,target_id),check(actor_id<>target_id));
create table public.reports (
 id uuid primary key default gen_random_uuid(), reporter_id uuid references public.profiles on delete set null, subject_id uuid references public.profiles on delete set null, listing_id uuid references public.listings on delete set null, message_id uuid references public.messages on delete set null, category text not null check(category in ('scam','harassment','underage','stale','privacy','appeal','other')),
 details text not null check(length(details) between 5 and 1200), status public.report_state not null default 'open', created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.moderation_actions (id uuid primary key default gen_random_uuid(), moderator_id uuid references auth.users on delete set null, target_type text not null, target_id uuid not null, action text not null, reason text not null, created_at timestamptz not null default now());
create table public.admin_audit_logs (id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users on delete set null, action text not null, target_id uuid not null, created_at timestamptz not null default now());
create table public.data_subject_requests (id uuid primary key default gen_random_uuid(),user_id uuid references auth.users on delete set null, kind text not null check(kind in ('export','delete','support')), details text check(length(details)<=1200),status text not null default 'pending' check(status in ('pending','fulfilled')),created_at timestamptz not null default now());
create unique index outstanding_request on public.data_subject_requests(user_id,kind) where status='pending' and kind<>'support';
create table public.product_events (id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles on delete cascade, event text not null, city_id text references public.cities, intent public.intent, created_at timestamptz not null default now());
create table public.feature_flags (id text primary key, enabled boolean not null default false);
insert into public.feature_flags(id) values ('household_groups'),('ai_assistance'),('billing');
create table public.availability_waitlist (user_id uuid references public.profiles on delete cascade, city_id text references public.cities, created_at timestamptz not null default now(), primary key(user_id,city_id));
create table public.ranking_feedback (id uuid primary key default gen_random_uuid(),user_id uuid references public.profiles on delete cascade,useful boolean not null,created_at timestamptz not null default now());
create table private.rate_buckets (actor uuid, kind text, window_start timestamptz, used integer not null, primary key(actor,kind,window_start));

create index listings_search on public.listings(city_id,locality_id,monthly,available_from) where status='active';
create index listings_expiry on public.listings(expires_at) where status='active';
create index profiles_search on public.profiles(city_id,budget_max,move_until) where status='active' and discoverable;
create index interests_target on public.interests(target_id,updated_at desc);
create index conversations_user on public.conversation_members(user_id);
create index messages_thread on public.messages(conversation_id,created_at desc);
create index visits_thread on public.visit_requests(conversation_id,starts_at);
create unique index one_open_visit on public.visit_requests(conversation_id) where status in ('requested','confirmed','rescheduled');
create index blocks_target on public.blocks(target_id,actor_id);
create index reports_queue on public.reports(status,created_at);
create index events_window on public.product_events(created_at,event);

create function private.is_moderator() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.moderators where user_id=(select auth.uid()));
$$;
create function private.not_blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.blocks where (actor_id=a and target_id=b) or (actor_id=b and target_id=a));
$$;
create function private.profile_active(a uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=a and status='active');
$$;
create function private.can_chat(c uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.conversations cv join public.matches m on m.id=cv.match_id
  where cv.id=c and (select auth.uid()) in (m.member_a,m.member_b)
  and private.profile_active(m.member_a) and private.profile_active(m.member_b) and private.not_blocked(m.member_a,m.member_b));
$$;
create function private.can_read_listing(l uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.listings x where id=l and (x.owner_id=(select auth.uid()) or private.is_moderator()
  or (x.status='active' and x.expires_at>now() and private.profile_active(x.owner_id) and private.profile_active((select auth.uid())) and private.not_blocked((select auth.uid()),x.owner_id))));
$$;
revoke execute on all functions in schema private from public;
grant execute on function private.is_moderator(),private.not_blocked(uuid,uuid),private.profile_active(uuid),private.can_chat(uuid),private.can_read_listing(uuid) to authenticated;

do $$
declare t text;
begin
 foreach t in array array['cities','localities','profiles','user_preference_answers','onboarding_progress','user_consents','notification_preferences','verification_checks','listings','listing_amenities','household_preferences','listing_images','listing_reconfirmations','interests','matches','conversations','conversation_members','messages','message_read_states','saved_items','visit_requests','visit_events','blocks','reports','moderation_actions','admin_audit_logs','data_subject_requests','product_events','feature_flags','availability_waitlist','ranking_feedback']
 loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
grant select on public.cities,public.localities to anon;
create policy cities_catalog on public.cities for select to anon,authenticated using(true);
create policy locality_catalog on public.localities for select to anon,authenticated using(true);
create policy profile_owner on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy answers_owner on public.user_preference_answers for select to authenticated using(user_id=(select auth.uid()));
create policy progress_owner on public.onboarding_progress for select to authenticated using(user_id=(select auth.uid()));
create policy consent_owner on public.user_consents for select to authenticated using(user_id=(select auth.uid()));
create policy notifications_owner on public.notification_preferences for select to authenticated using(user_id=(select auth.uid()));
create policy verification_owner on public.verification_checks for select to authenticated using(user_id=(select auth.uid()));
create policy listing_read on public.listings for select to authenticated using(owner_id=(select auth.uid()) or private.is_moderator() or (status='active' and expires_at>now() and private.profile_active(owner_id) and private.profile_active((select auth.uid())) and private.not_blocked((select auth.uid()),owner_id)));
create policy amenities_read on public.listing_amenities for select to authenticated using(private.can_read_listing(listing_id));
create policy rules_read on public.household_preferences for select to authenticated using(private.can_read_listing(listing_id));
create policy listing_media_read on public.listing_images for select to authenticated using(private.can_read_listing(listing_id));
create policy listing_freshness_read on public.listing_reconfirmations for select to authenticated using(private.can_read_listing(listing_id));
create policy interest_participant on public.interests for select to authenticated using((select auth.uid()) in (actor_id,target_id) and private.not_blocked(actor_id,target_id) and (actor_id=(select auth.uid()) or status in ('sent','mutual')));
create policy matches_participant on public.matches for select to authenticated using((select auth.uid()) in (member_a,member_b) and private.profile_active(member_a) and private.profile_active(member_b) and private.not_blocked(member_a,member_b));
create policy conversation_participant on public.conversations for select to authenticated using(private.can_chat(id));
create policy member_participant on public.conversation_members for select to authenticated using(private.can_chat(conversation_id));
create policy message_participant on public.messages for select to authenticated using(private.can_chat(conversation_id));
create policy read_state_owner on public.message_read_states for select to authenticated using(user_id=(select auth.uid()) and private.can_chat(conversation_id));
create policy saved_owner on public.saved_items for select to authenticated using(user_id=(select auth.uid()) and (profile_id is null or private.not_blocked(user_id,profile_id)) and (listing_id is null or private.can_read_listing(listing_id)));
create policy visit_participant on public.visit_requests for select to authenticated using(private.can_chat(conversation_id));
create policy visit_event_participant on public.visit_events for select to authenticated using(exists(select 1 from public.visit_requests where id=visit_id));
create policy block_owner on public.blocks for select to authenticated using(actor_id=(select auth.uid()));
create policy report_read on public.reports for select to authenticated using(reporter_id=(select auth.uid()) or private.is_moderator());
create policy moderation_read on public.moderation_actions for select to authenticated using(private.is_moderator());
create policy audit_read on public.admin_audit_logs for select to authenticated using(private.is_moderator());
create policy requests_read on public.data_subject_requests for select to authenticated using(user_id=(select auth.uid()) or private.is_moderator());
create policy events_admin on public.product_events for select to authenticated using(private.is_moderator());
create policy waitlist_owner on public.availability_waitlist for select to authenticated using(user_id=(select auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('room-photos','room-photos',false,750000,array['image/webp']);
-- Only server-side sanitization may write objects. Browser reads go through an authenticated, no-store media handler.
