-- Explicit actor-scoped transitions. No client can write to business tables directly.
create function private.actor() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid();
begin
 if u is null or not exists(select 1 from auth.users where id=u and email_confirmed_at is not null)
 or exists(select 1 from public.profiles where id=u and status in ('closed','suspended')) then
   raise exception 'Sign in with a confirmed email to continue' using errcode='42501';
 end if;
 return u;
end $$;

create function private.throttle(u uuid,k text,cap integer,minutes integer default 60) returns void language plpgsql set search_path='' as $$
declare counter integer;
begin
 insert into private.rate_buckets values(u,k,date_bin(make_interval(mins=>minutes),now(),'2020-01-01'::timestamptz),1)
 on conflict(actor,kind,window_start) do update set used=private.rate_buckets.used+1 returning used into counter;
 if counter>cap then raise exception 'Too many requests. Try again later.' using errcode='P0001'; end if;
end $$;
create function private.event_for(u uuid,e text) returns void language sql set search_path='' as $$
 insert into public.product_events(user_id,event,city_id,intent)
 select p.id,e,p.city_id,p.intent from public.profiles p join public.user_consents c on c.user_id=p.id
 where p.id=u and c.purpose='analytics' and c.granted;
$$;
create function private.clean(s text) returns text language sql immutable set search_path='' as $$
 select trim(regexp_replace(coalesce(s,''),'[[:cntrl:]]',' ','g'));
$$;
create function private.public_text(s text) returns text language plpgsql immutable set search_path='' as $$
begin
 s:=private.clean(s);
 if s ~* '(https?://|www\.|[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}|([0-9][ .()+-]*){10}|<[^>]*>)'
 then raise exception 'Keep links, contact details and markup out of public content'; end if;
 return s;
end $$;
create function private.answers_valid(answers jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare a record; options jsonb; catalog constant jsonb := '{
"sleep":["Early nights","Late nights","Varies"],"noise":["Usually quiet","Some background noise","Lively home"],"cleanliness":["Tidy daily","Weekly clean","Flexible routine"],
"cooking":["Cook most days","Cook occasionally","Rarely cook"],"kitchen":["Vegetarian kitchen","Mixed kitchen","Separate utensils"],"guests":["Occasional daytime guests","Overnight guests","Rare guests"],
"smoking":["No shared-space smoking","Smoking outdoors only","Shared-space smoking"],"alcohol":["No alcohol in shared spaces","Occasional alcohol","Flexible"],"pets":["No pets","Pets welcome","Ask first"],
"wfh":["Mostly office","Hybrid","Mostly home"],"privacy":["Mostly private","Some time together","Social household"],"chores":["Weekly rota","Clean as you go","Shared cleaner"],
"expenses":["Equal shares","Split by use","Agree case by case"],"utilities":["Limit AC use","AC as needed","Agree case by case"]}';
begin
 if answers is null or jsonb_typeof(answers)<>'object' then return false; end if;
 for a in select * from jsonb_each(answers) loop
  options:=catalog->a.key;
  if options is null or jsonb_typeof(a.value)<>'object'
   or not coalesce((a.value->>'strength') in ('flexible','preference','dealbreaker'),false)
   or (a.value->>'habit' is not null and not (options ? (a.value->>'habit')))
   or (a.value->>'want' is not null and not (options ? (a.value->>'want')))
  then return false; end if;
 end loop;
 return true;
end $$;
create function private.read_answers(p uuid,l uuid) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_object_agg(dimension,jsonb_strip_nulls(jsonb_build_object('habit',habit,'want',expectation,'strength',strength))),'{}'::jsonb)
 from (select dimension,habit,expectation,strength from public.user_preference_answers where user_id=p
 union all select dimension,habit,expectation,strength from public.household_preferences where listing_id=l) a;
$$;
create function public.save_basics(v jsonb) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); areas text[]; consent_revision constant text:='2026-11';
begin
 perform private.throttle(u,'basics',30);
 if v->>'adult' is distinct from 'true' or v->>'terms' is distinct from 'true' then raise exception 'Confirm age and accept the terms'; end if;
 areas:=array(select distinct jsonb_array_elements_text(v->'areas'));
 if exists(select 1 from unnest(areas) a where not exists(select 1 from public.localities l where l.city_id=v->>'city' and l.id=a))
 then raise exception 'Choose localities in the selected city'; end if;
 if (v->>'until')::date < (now() at time zone 'Asia/Kolkata')::date then raise exception 'Choose a current move-in window'; end if;
 insert into public.profiles(id,display_name,age_confirmed,city_id,localities,budget_min,budget_max,move_from,move_until,stay_months,intent)
 values(u,private.public_text(v->>'name'),true,v->>'city',areas,(v->>'min')::int,(v->>'max')::int,(v->>'from')::date,(v->>'until')::date,(v->>'months')::smallint,(v->>'intent')::public.intent)
 on conflict(id) do update set display_name=excluded.display_name,city_id=excluded.city_id,localities=excluded.localities,budget_min=excluded.budget_min,budget_max=excluded.budget_max,
 move_from=excluded.move_from,move_until=excluded.move_until,stay_months=excluded.stay_months,intent=excluded.intent,updated_at=now();
 insert into public.user_consents(user_id,purpose,granted,revision) values(u,'terms',true,consent_revision)
 on conflict(user_id,purpose) do update set revision=excluded.revision,updated_at=now();
 insert into public.verification_checks(user_id,kind,verified_at) select id,'email',email_confirmed_at from auth.users where id=u on conflict do nothing;
 insert into public.onboarding_progress(user_id,step) values(u,'lifestyle') on conflict do nothing;
end $$;
create function public.save_lifestyle(answers jsonb) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor();
begin
 perform private.throttle(u,'lifestyle',30);
 perform 1 from public.profiles where id=u for update;
 if not found or not private.answers_valid(answers) then raise exception 'Invalid lifestyle answers'; end if;
 delete from public.user_preference_answers where user_id=u;
 insert into public.user_preference_answers select u,key,value->>'habit',value->>'want',value->>'strength' from jsonb_each(answers);
 update public.onboarding_progress set step='preferences',updated_at=now() where user_id=u and step='lifestyle';
end $$;
create function public.save_privacy(v jsonb) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); s public.profile_state;
begin
 perform private.throttle(u,'privacy',30);
 select status into s from public.profiles where id=u for update;
 if not found then raise exception 'Complete the basics first'; end if;
 if v->>'status' is not null and (v->>'status') not in ('active','paused') then raise exception 'Invalid profile status'; end if;
 if s='draft' and v->>'status' is distinct from 'active' then raise exception 'Finish onboarding first'; end if;
 update public.profiles set discoverable=coalesce((v->>'discoverable')::boolean,discoverable),status=coalesce((v->>'status')::public.profile_state,status),updated_at=now() where id=u;
 insert into public.notification_preferences values(u,coalesce((v->>'reminders')::boolean,false)) on conflict(user_id) do update set reminders=excluded.reminders;
 insert into public.user_consents(user_id,purpose,granted,revision) values(u,'analytics',coalesce((v->>'analytics')::boolean,false),'2026-11')
 on conflict(user_id,purpose) do update set granted=excluded.granted,updated_at=now();
 if s='draft' then
  update public.onboarding_progress set step='complete',updated_at=now() where user_id=u;
  perform private.event_for(u,'onboarding_completed');
 end if;
end $$;
create function public.own_answers() returns jsonb language sql stable security definer set search_path='' as $$
 select private.read_answers(auth.uid(),null);
$$;

create function public.save_listing(l uuid,v jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); current_row public.listings; answers jsonb:=v->'rules'; result uuid; a text;
begin
 perform private.throttle(u,'listing_edit',35);
 perform 1 from public.profiles where id=u and status='active' for update;
 if not found then raise exception 'Activate your profile first'; end if;
 if not private.answers_valid(answers) or v->>'attested' is distinct from 'true' then raise exception 'Confirm permission and enter valid house rules'; end if;
 if (v->>'available_until')::date < (now() at time zone 'Asia/Kolkata')::date then raise exception 'Choose a current availability window'; end if;
 if l is not null then
  select * into current_row from public.listings where id=l and owner_id=u for update;
  if not found or current_row.status in ('filled','removed') then raise exception 'This listing cannot be edited'; end if;
  -- Existing content loses approval whenever it changes.
  update public.listings set status='draft',reviewed_at=null,confirmed_at=null,expires_at=null where id=l;
 else
  perform private.throttle(u,'listing_create',5,1440);
  if (select count(*) from public.listings where owner_id=u and status not in ('filled','removed'))>=8 then raise exception 'Close an existing listing first'; end if;
 end if;
 if exists(select 1 from public.listings x where x.owner_id=u and x.id is distinct from l and x.status not in ('filled','removed') and x.city_id=v->>'city_id' and x.locality_id=v->>'locality_id' and lower(regexp_replace(x.title,'[^[:alnum:]]','','g'))=lower(regexp_replace(v->>'title','[^[:alnum:]]','','g'))) then
  raise exception 'A similar listing already exists. Edit it instead.';
 end if;
 insert into public.listings(id,owner_id,title,description,city_id,locality_id,room_type,building,furnishing,bath_sharing,rooms,bathrooms,occupants,capacity,poster_type,attested,transport,restrictions,
 rent,maintenance,utilities,recurring,deposit,brokerage,fees,available_from,available_until,min_months)
 values(coalesce(l,gen_random_uuid()),u,private.public_text(v->>'title'),private.public_text(v->>'description'),v->>'city_id',v->>'locality_id',v->>'room_type',v->>'building',v->>'furnishing',v->>'bath_sharing',
 (v->>'rooms')::smallint,(v->>'bathrooms')::smallint,(v->>'occupants')::smallint,(v->>'capacity')::smallint,v->>'poster_type',true,private.public_text(v->>'transport'),private.public_text(v->>'restrictions'),
 (v->>'rent')::int,(v->>'maintenance')::int,(v->>'utilities')::int,(v->>'recurring')::int,(v->>'deposit')::int,(v->>'brokerage')::int,(v->>'fees')::int,(v->>'available_from')::date,(v->>'available_until')::date,(v->>'min_months')::smallint)
 on conflict(id) do update set title=excluded.title,description=excluded.description,city_id=excluded.city_id,locality_id=excluded.locality_id,room_type=excluded.room_type,building=excluded.building,furnishing=excluded.furnishing,bath_sharing=excluded.bath_sharing,rooms=excluded.rooms,bathrooms=excluded.bathrooms,occupants=excluded.occupants,capacity=excluded.capacity,poster_type=excluded.poster_type,transport=excluded.transport,restrictions=excluded.restrictions,
 rent=excluded.rent,maintenance=excluded.maintenance,utilities=excluded.utilities,recurring=excluded.recurring,deposit=excluded.deposit,brokerage=excluded.brokerage,fees=excluded.fees,available_from=excluded.available_from,available_until=excluded.available_until,min_months=excluded.min_months,updated_at=now()
 returning id into result;
 delete from public.listing_amenities where listing_id=result;
 insert into public.listing_amenities select result, item from jsonb_array_elements_text(v->'amenities') item on conflict do nothing;
 delete from public.household_preferences where listing_id=result;
 insert into public.household_preferences select result,key,value->>'habit',value->>'want',value->>'strength' from jsonb_each(answers);
 return result;
end $$;
create function public.listing_transition(l uuid,action text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); x public.listings; fresh interval:=interval '21 days'; d date:=(now() at time zone 'Asia/Kolkata')::date;
begin
 perform private.throttle(u,'listing_status',25);
 select * into x from public.listings where id=l and owner_id=u for update;
 if not found or not private.profile_active(u) then raise exception 'Listing unavailable'; end if;
 if action='submit' and x.status='draft' and x.available_until>=d and exists(select 1 from public.listing_images where listing_id=l) then
  update public.listings set status='pending_review',confirmed_at=now(),updated_at=now() where id=l;
 elsif action='pause' and x.status='active' then
  update public.listings set status='paused',updated_at=now() where id=l;
 elsif action='renew' and x.status in ('active','paused','expired') and x.reviewed_at is not null and x.available_until>=d then
  update public.listings set status='active',confirmed_at=now(),expires_at=least(now()+fresh,((available_until+1)::timestamp at time zone 'Asia/Kolkata')),updated_at=now() where id=l;
  insert into public.listing_reconfirmations(listing_id) values(l);
 elsif action='fill' and x.status in ('draft','active','paused','expired','pending_review') then
  update public.listings set status='filled',expires_at=now(),updated_at=now() where id=l;
  perform private.event_for(u,'home_found_self_reported');
 else raise exception 'That change is not available. Submission needs a photo and current dates.'; end if;
end $$;
-- Called only by the media route after a verified user upload has been decoded and re-encoded.
create function public.attach_sanitized_photo(u uuid,l uuid,p text,d text) returns uuid language plpgsql security definer set search_path='' as $$
declare i uuid;
begin
 perform private.throttle(u,'photos',15);
 perform 1 from public.listings where id=l and owner_id=u and status='draft' for update;
 if not found or not private.profile_active(u) or p !~ ('^'||u::text||'/'||l::text||'/[0-9a-f-]{36}\.webp$') or d !~ '^[0-9a-f]{64}$'
 or not exists(select 1 from storage.objects where bucket_id='room-photos' and name=p) then raise exception 'Invalid photo'; end if;
 if (select count(*) from public.listing_images where listing_id=l)>=6 then raise exception 'Use at most six photos'; end if;
 insert into public.listing_images(listing_id,path,digest) values(l,p,d) returning id into i;
 return i;
end $$;
create function public.detach_sanitized_photo(u uuid,i uuid) returns text language plpgsql security definer set search_path='' as $$
declare p text;
begin
 perform 1 from public.listings where id=(select listing_id from public.listing_images where id=i) and owner_id=u and status='draft' for update;
 if not found then raise exception 'Only draft photos can be removed'; end if;
 delete from public.listing_images where id=i returning path into p;
 return p;
end $$;

create function public.public_inventory() returns table(city_id text, live_rooms bigint) language sql stable security definer set search_path='' as $$
 select c.id,count(l.id) from public.cities c left join public.listings l on l.city_id=c.id and l.status='active' and l.expires_at>now() and private.profile_active(l.owner_id) group by c.id;
$$;
create function public.public_rooms(city text default null, locality text default null, room_id uuid default null) returns table(id uuid,title text,city_id text,locality_id text,room_type text,rent int,maintenance int,utilities int,recurring int,deposit int,brokerage int,fees int,available_from date,available_until date,reviewed_at timestamptz,confirmed_at timestamptz) language sql stable security definer set search_path='' as $$
 select l.id,l.title,l.city_id,l.locality_id,l.room_type,l.rent,l.maintenance,l.utilities,l.recurring,l.deposit,l.brokerage,l.fees,l.available_from,l.available_until,l.reviewed_at,l.confirmed_at
 from public.listings l where l.status='active' and l.expires_at>now() and private.profile_active(l.owner_id)
 and (auth.uid() is null or private.not_blocked(auth.uid(),l.owner_id))
 and (city is null or l.city_id=city) and (locality is null or l.locality_id=locality) and (room_id is null or l.id=room_id)
 order by l.available_from,l.id limit 50;
$$;
create function public.discover_people(city text, candidate uuid default null) returns table(id uuid,display_name text,city_id text,localities text[],budget_min int,budget_max int,move_from date,move_until date,stay_months smallint,intent public.intent,email_verified boolean,answers jsonb) language sql stable security definer set search_path='' as $$
 select p.id,p.display_name,p.city_id,p.localities,p.budget_min,p.budget_max,p.move_from,p.move_until,p.stay_months,p.intent,
 exists(select 1 from public.verification_checks v where v.user_id=p.id and v.kind='email'),private.read_answers(p.id,null)
 from public.profiles p where private.profile_active(auth.uid()) and p.status='active' and p.id<>auth.uid() and private.not_blocked(auth.uid(),p.id)
 and ((candidate is null and p.discoverable and p.city_id=city and p.move_until>=(now() at time zone 'Asia/Kolkata')::date
 and not exists(select 1 from public.interests i where i.actor_id=auth.uid() and i.target_id=p.id and i.status in ('passed','withdrawn'))
 and not exists(select 1 from public.interests i where i.actor_id=p.id and i.target_id=auth.uid() and i.status='passed'))
 or (candidate=p.id and (p.discoverable or exists(select 1 from public.matches m where (m.member_a,m.member_b)=(least(auth.uid(),p.id),greatest(auth.uid(),p.id)))
 or exists(select 1 from public.interests i where i.actor_id=p.id and i.target_id=auth.uid() and i.status='sent'))))
 order by p.updated_at desc,p.id limit 80;
$$;

create function private.lock_pair(a uuid,b uuid) returns void language sql set search_path='' as $$
 select pg_advisory_xact_lock(hashtextextended(least(a,b)::text||':'||greatest(a,b)::text,0));
$$;
create function public.interest_transition(target uuid, action text, listing uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); cur public.interest_state; opposite public.interest_state; mid uuid; cid uuid; wants public.interest_state;
begin
 if target=u or target is null then raise exception 'Candidate unavailable'; end if;
 perform private.lock_pair(u,target);
 if not private.profile_active(u) or not private.profile_active(target) or not private.not_blocked(u,target) then raise exception 'Candidate unavailable'; end if;
 perform private.throttle(u,'interest',35);
 select status into cur from public.interests where actor_id=u and target_id=target;
 select status into opposite from public.interests where actor_id=target and target_id=u;
 if cur='mutual' then
  if action<>'like' then raise exception 'Use block to end an existing connection'; end if;
  return (select c.id from public.conversations c join public.matches m on m.id=c.match_id where m.member_a=least(u,target) and m.member_b=greatest(u,target));
 end if;
 if action='like' then
  if opposite='passed' or not (opposite='sent' or exists(select 1 from public.profiles where id=target and discoverable)
  or exists(select 1 from public.listings where id=listing and owner_id=target and status='active' and expires_at>now()))
  then raise exception 'Candidate unavailable'; end if;
  if opposite is distinct from 'sent' and not exists(
   select 1 from public.profiles a join public.profiles b on b.id=target where a.id=u and a.city_id=b.city_id and a.localities && b.localities
   and a.budget_min<=b.budget_max and b.budget_min<=a.budget_max and a.move_from<=b.move_until and b.move_from<=a.move_until
  ) and not exists(
   select 1 from public.profiles a join public.listings l on l.id=listing where a.id=u and l.owner_id=target and l.status='active' and l.expires_at>now()
   and a.city_id=l.city_id and l.locality_id=any(a.localities) and l.monthly<=a.budget_max and a.move_from<=l.available_until and l.available_from<=a.move_until and a.stay_months>=l.min_months
  ) then raise exception 'No overlapping location, budget, or move-in dates'; end if;
  if listing is not null and exists(select 1 from public.user_preference_answers p join public.household_preferences h on h.listing_id=listing and h.dimension=p.dimension where p.user_id=u and ((p.strength='dealbreaker' and p.expectation<>h.habit) or (h.strength='dealbreaker' and h.expectation<>p.habit)))
  then raise exception 'A household rule conflicts with a dealbreaker'; end if;
  if listing is null and exists(select 1 from public.user_preference_answers a join public.user_preference_answers b using(dimension) where a.user_id=u and b.user_id=target and ((a.strength='dealbreaker' and a.expectation<>b.habit) or (b.strength='dealbreaker' and b.expectation<>a.habit)))
  then raise exception 'A lifestyle dealbreaker conflicts'; end if;
  wants:='sent';
 elsif action='pass' then wants:='passed';
 elsif action='withdraw' and cur='sent' then wants:='withdrawn';
 elsif action='reset' and cur in ('passed','withdrawn') then delete from public.interests where actor_id=u and target_id=target; return null;
 else raise exception 'Interest change unavailable'; end if;
 insert into public.interests(actor_id,target_id,status) values(u,target,wants)
 on conflict(actor_id,target_id) do update set status=excluded.status,updated_at=now();
 if wants='sent' and cur is distinct from 'sent' then perform private.event_for(u,'interest_sent'); end if;
 if wants='sent' and opposite='sent' then
  insert into public.matches(member_a,member_b) values(least(u,target),greatest(u,target)) returning id into mid;
  insert into public.conversations(match_id) values(mid) returning id into cid;
  insert into public.conversation_members values(cid,u),(cid,target);
  update public.interests set status='mutual',updated_at=now() where (actor_id=u and target_id=target) or (actor_id=target and target_id=u);
  perform private.event_for(u,'mutual_match');
 end if;
 return cid;
end $$;

create function private.lock_chat(u uuid,c uuid) returns uuid language plpgsql set search_path='' as $$
declare other_user uuid;
begin
 select case when m.member_a=u then m.member_b else m.member_a end into other_user
 from public.conversations cv join public.matches m on m.id=cv.match_id where cv.id=c and u in(m.member_a,m.member_b);
 if not found then raise exception 'Conversation unavailable' using errcode='42501'; end if;
 perform private.lock_pair(u,other_user);
 if not private.can_chat(c) then raise exception 'Conversation unavailable' using errcode='42501'; end if;
 return other_user;
end $$;
create function public.send_message(c uuid, body text, request_key uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); content text:=private.clean(body); warning boolean;
begin
 perform private.lock_chat(u,c);
 if exists(select 1 from public.messages m where m.sender_id=u and m.request_key=send_message.request_key) then return; end if;
 perform private.throttle(u,'message',45);
 if (select count(*) from public.messages m where m.conversation_id=c and m.sender_id=u and lower(m.body)=lower(content) and m.created_at>now()-interval '1 hour')>=2 then raise exception 'Please avoid sending repeated messages'; end if;
 warning:=content ~* '(upi|paytm|phonepe|gpay|aadhaar|aadhar|otp|advance.{0,30}(pay|transfer|deposit)|token.{0,15}(fee|money|amount)|bank details|whatsapp)';
 if not exists(select 1 from public.messages where conversation_id=c and sender_id=u) then perform private.event_for(u,'first_message'); end if;
 insert into public.messages(conversation_id,sender_id,body,request_key,suspicious) values(c,u,content,request_key,warning);
end $$;
create function public.mark_read(c uuid, last_seen uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); t timestamptz;
begin
 perform private.lock_chat(u,c);
 select created_at into t from public.messages where id=last_seen and conversation_id=c;
 if not found then return; end if;
 insert into public.message_read_states values(c,u,t)
 on conflict(conversation_id,user_id) do update set read_at=greatest(public.message_read_states.read_at,excluded.read_at);
end $$;
create function public.inbox() returns table(id uuid,other_id uuid,display_name text,unread bigint,activity timestamptz) language sql stable security definer set search_path='' as $$
 select c.id,p.id,p.display_name,(select count(*) from public.messages m left join public.message_read_states r on r.conversation_id=c.id and r.user_id=auth.uid()
 where m.conversation_id=c.id and m.sender_id<>auth.uid() and (r.read_at is null or m.created_at>r.read_at)),
 coalesce((select max(m.created_at) from public.messages m where m.conversation_id=c.id),c.created_at)
 from public.conversation_members cm join public.conversations c on c.id=cm.conversation_id join public.matches mt on mt.id=c.match_id
 join public.profiles p on p.id=case when mt.member_a=auth.uid() then mt.member_b else mt.member_a end
 where cm.user_id=auth.uid() and private.can_chat(c.id)
 order by 5 desc,c.id limit 100;
$$;

create function public.visit_transition(c uuid,v uuid,action text,at_time timestamptz default null) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); x public.visit_requests; next_status public.visit_state; result uuid;
begin
 perform private.lock_chat(u,c);
 perform private.throttle(u,'visit',20);
 if action in ('request','reschedule') and (at_time is null or at_time<now()+interval '10 minutes' or at_time>now()+interval '90 days') then raise exception 'Choose a future time within 90 days'; end if;
 if action='request' and v is null then
  if exists(select 1 from public.visit_requests where conversation_id=c and status in ('requested','confirmed','rescheduled')) then raise exception 'A visit is already open'; end if;
  insert into public.visit_requests(conversation_id,requester_id,proposer_id,starts_at) values(c,u,u,at_time) returning id into result;
  next_status:='requested';
  perform private.event_for(u,'visit_requested');
 else
  select * into x from public.visit_requests where id=v and conversation_id=c for update;
  if not found then raise exception 'Visit unavailable'; end if;
  result:=x.id;
  if action='confirm' and x.status in ('requested','rescheduled') and x.proposer_id<>u and x.starts_at>now() then next_status:='confirmed';
  elsif action='decline' and x.status in ('requested','rescheduled') and x.proposer_id<>u then next_status:='declined';
  elsif action='reschedule' and x.status in ('requested','rescheduled','confirmed') then next_status:='rescheduled';
  elsif action='cancel' and x.status in ('requested','rescheduled','confirmed') then next_status:='cancelled';
  elsif action in ('completed','no_show') and x.status='confirmed' and x.starts_at<=now() then next_status:=action::public.visit_state;
  else raise exception 'That visit change is unavailable'; end if;
  update public.visit_requests set status=next_status,proposer_id=case when next_status='rescheduled' then u else proposer_id end,
  starts_at=case when next_status='rescheduled' then at_time else starts_at end,updated_at=now() where id=v;
  if next_status<>'confirmed' then delete from private.visit_locations where visit_id=v; end if;
  if next_status in ('confirmed','completed') then perform private.event_for(u,'visit_'||next_status::text); end if;
 end if;
 insert into public.visit_events(visit_id,actor_id,status) values(result,u,next_status);
 return result;
end $$;
create function public.visit_location(c uuid,v uuid,location text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); x public.visit_requests;
begin
 perform private.lock_chat(u,c);
 perform private.throttle(u,'visit_location',15);
 select * into x from public.visit_requests where id=v and conversation_id=c for update;
 if not found or x.status<>'confirmed' or x.starts_at<=now() then raise exception 'A future confirmed visit is required'; end if;
 if location is null then delete from private.visit_locations where visit_id=v and shared_by=u;
 else
  insert into private.visit_locations values(v,u,private.clean(location))
  on conflict(visit_id) do update set details=excluded.details where private.visit_locations.shared_by=u;
  if not found then raise exception 'Only the person who shared the location can change it'; end if;
 end if;
end $$;
create function public.read_visit_location(v uuid) returns text language sql stable security definer set search_path='' as $$
 select a.details from private.visit_locations a join public.visit_requests x on x.id=a.visit_id
 where a.visit_id=v and x.status='confirmed' and x.starts_at between now()-interval '2 hours' and now()+interval '24 hours'
 and private.can_chat(x.conversation_id);
$$;

create function public.save_item(kind text,target uuid,enabled boolean) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor();
begin
 perform private.throttle(u,'save',80);
 if not private.profile_active(u) then raise exception 'Activate your profile first'; end if;
 if kind='profile' then
  if enabled then
   if not exists(select 1 from public.discover_people(null,target)) then raise exception 'Profile unavailable'; end if;
   insert into public.saved_items(user_id,profile_id) values(u,target) on conflict do nothing;
  else delete from public.saved_items where user_id=u and profile_id=target; end if;
 elsif kind='listing' then
  if enabled then
   if not private.can_read_listing(target) then raise exception 'Listing unavailable'; end if;
   insert into public.saved_items(user_id,listing_id) values(u,target) on conflict do nothing;
  else delete from public.saved_items where user_id=u and listing_id=target; end if;
 else raise exception 'Unknown item'; end if;
end $$;
create function public.block_account(target uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor();
begin
 if u=target or not exists(select 1 from public.profiles where id=target) or not exists(select 1 from public.profiles where id=u) then raise exception 'Account unavailable'; end if;
 perform private.lock_pair(u,target);
 perform private.throttle(u,'block',30);
 insert into public.blocks(actor_id,target_id) values(u,target) on conflict do nothing;
 update public.interests set status='blocked',updated_at=now() where (actor_id=u and target_id=target) or (actor_id=target and target_id=u);
 delete from public.saved_items where (user_id=u and (profile_id=target or listing_id in (select id from public.listings where owner_id=target))) or (user_id=target and (profile_id=u or listing_id in (select id from public.listings where owner_id=u)));
end $$;
create function public.file_report(subject uuid,listing uuid,message uuid,category text,details text,also_block boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); target uuid; result uuid;
begin
 perform private.throttle(u,'report',12,1440);
 if not exists(select 1 from public.profiles where id=u) then raise exception 'Complete the basics first'; end if;
 if num_nonnulls(subject,listing,message)<>1 then raise exception 'Choose exactly one report subject'; end if;
 if listing is not null then
  select owner_id into target from public.listings where id=listing and private.can_read_listing(id);
 elsif message is not null then
  select sender_id into target from public.messages where id=message and private.can_chat(conversation_id);
 else
  select id into target from public.discover_people(null,subject);
  if target is null and subject=u and category='appeal' then target:=u; end if;
 end if;
 if target is null or (target=u and category<>'appeal') then raise exception 'Report target unavailable'; end if;
 insert into public.reports(reporter_id,subject_id,listing_id,message_id,category,details) values(u,target,listing,message,category,private.clean(details)) returning id into result;
 if also_block then perform public.block_account(target); end if;
 return result;
end $$;
create function public.data_request(kind text,details text default null) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 -- Suspended and closed users can still request data or appeal.
 if u is null or not exists(select 1 from auth.users where id=u and email_confirmed_at is not null) then raise exception 'Sign in first' using errcode='42501'; end if;
 perform private.throttle(u,'data_request',8,1440);
 insert into public.data_subject_requests(user_id,kind,details) values(u,kind,private.clean(details)) on conflict do nothing;
 if kind='delete' then
  update public.profiles set status='closed',discoverable=false,updated_at=now() where id=u;
  update public.listings set status='removed',expires_at=now(),updated_at=now() where owner_id=u and status not in ('filled','removed');
  delete from private.visit_locations where shared_by=u;
  delete from public.product_events where user_id=u;
  update public.user_consents set granted=false,updated_at=now() where user_id=u and purpose='analytics';
 end if;
end $$;
create function public.join_waitlist() returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor();
begin
 perform private.throttle(u,'waitlist',8);
 insert into public.availability_waitlist(user_id,city_id) select id,city_id from public.profiles where id=u and status='active' on conflict do nothing;
end $$;
create function public.match_feedback(useful boolean) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor();
begin
 perform private.throttle(u,'feedback',8);
 insert into public.ranking_feedback(user_id,useful) values(u,useful);
end $$;
create function public.track_product_event(event_name text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor();
begin
 if event_name not in ('discover_view','compatible_profile_opened','home_found_self_reported') then raise exception 'Invalid event'; end if;
 perform private.throttle(u,'event',40);
 perform private.event_for(u,event_name);
end $$;

create function public.is_moderator() returns boolean language sql stable security definer set search_path='' as $$ select private.is_moderator(); $$;
create function public.moderate(kind text,target uuid,action text,reason text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); x public.listings; r public.report_state; p public.profile_state;
begin
 if not private.is_moderator() then raise exception 'Moderator access required' using errcode='42501'; end if;
 if length(private.clean(reason)) not between 5 and 500 then raise exception 'Enter a reason (5–500 characters)'; end if;
 if kind='listing' then
  select * into x from public.listings where id=target for update;
  if not found or x.owner_id=u then raise exception 'Listing unavailable for independent review'; end if;
  if action='approve' and x.status='pending_review' and x.available_until>=(now() at time zone 'Asia/Kolkata')::date and private.profile_active(x.owner_id) then
   update public.listings set status='active',reviewed_at=now(),expires_at=least(x.confirmed_at+interval '21 days',((available_until+1)::timestamp at time zone 'Asia/Kolkata')),updated_at=now() where id=target;
  elsif action='reject' and x.status='pending_review' then update public.listings set status='draft',updated_at=now() where id=target;
  elsif action='remove' and x.status in ('pending_review','active','paused','expired') then update public.listings set status='removed',expires_at=now(),updated_at=now() where id=target;
  elsif action='expire' and x.status='active' then update public.listings set status='expired',expires_at=now(),updated_at=now() where id=target;
  else raise exception 'Invalid listing transition'; end if;
 elsif kind='report' then
  select status into r from public.reports where id=target for update;
  if not found or not ((r='open' and action='investigating') or (r='investigating' and action in ('resolved','dismissed','escalated')) or (r='escalated' and action in ('resolved','dismissed'))) then raise exception 'Invalid report transition'; end if;
  update public.reports set status=action::public.report_state,updated_at=now() where id=target;
 elsif kind='profile' then
  if target=u or exists(select 1 from private.moderators where user_id=target) then raise exception 'Moderator cannot change a moderator account'; end if;
  select status into p from public.profiles where id=target for update;
  if p in ('active','paused','draft') and action='suspend' then update public.profiles set status='suspended',updated_at=now() where id=target;
  elsif p='suspended' and action='restore' then
   update public.profiles set status=case when exists(select 1 from public.onboarding_progress where user_id=target and step='complete') then 'paused'::public.profile_state else 'draft'::public.profile_state end,updated_at=now() where id=target;
  else raise exception 'Invalid profile transition'; end if;
 elsif kind='request' then
  if action<>'fulfill' then raise exception 'Invalid request action'; end if;
  update public.data_subject_requests set status='fulfilled' where id=target and status='pending' and kind<>'delete';
  if not found then raise exception 'Only external export or support fulfilment can be recorded here'; end if;
 else raise exception 'Invalid moderation target'; end if;
 insert into public.moderation_actions(moderator_id,target_type,target_id,action,reason) values(u,kind,target,action,private.clean(reason));
 insert into public.admin_audit_logs(actor_id,action,target_id) values(u,kind||'.'||action,target);
end $$;
create function public.review_reported_message(report_id uuid, justification text) returns text language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); content text;
begin
 if not private.is_moderator() or length(private.clean(justification)) not between 10 and 500 then raise exception 'Moderator access and a case justification required' using errcode='42501'; end if;
 select m.body into content from public.reports r join public.messages m on m.id=r.message_id where r.id=report_id and r.status in ('investigating','escalated');
 if not found then raise exception 'No message evidence in this open investigation'; end if;
 insert into public.moderation_actions(moderator_id,target_type,target_id,action,reason) values(u,'report',report_id,'read_reported_message',private.clean(justification));
 insert into public.admin_audit_logs(actor_id,action,target_id) values(u,'report.read_reported_message',report_id);
 return content;
end $$;
create function public.moderation_profiles() returns table(id uuid,display_name text,status public.profile_state,created_at timestamptz) language sql stable security definer set search_path='' as $$
 select id,display_name,status,created_at from public.profiles where private.is_moderator() order by updated_at desc limit 60;
$$;
create function public.expire_rooms() returns integer language plpgsql set search_path='' as $$
declare n integer;
begin
 update public.listings set status='expired',updated_at=now() where status='active' and expires_at<=now();
 get diagnostics n=row_count;
 return n;
end $$;

revoke execute on all functions in schema private from public;
-- Explicit signatures document the intentionally exposed API.
do $$
declare f record;
begin
 for f in select p.oid::regprocedure as signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array[
 'save_basics','save_lifestyle','save_privacy','own_answers','save_listing','listing_transition','attach_sanitized_photo','detach_sanitized_photo','public_inventory','public_rooms','discover_people','interest_transition','send_message','mark_read','inbox','visit_transition','visit_location','read_visit_location','save_item','block_account','file_report','data_request','join_waitlist','match_feedback','track_product_event','is_moderator','moderate','review_reported_message','moderation_profiles','expire_rooms'])
 loop
  execute format('revoke execute on function %s from public, anon, authenticated',f.signature);
  if f.proname in ('attach_sanitized_photo','detach_sanitized_photo','expire_rooms') then
   execute format('grant execute on function %s to service_role',f.signature);
  else
   execute format('grant execute on function %s to authenticated',f.signature);
   if f.proname in ('public_inventory','public_rooms') then execute format('grant execute on function %s to anon',f.signature); end if;
  end if;
 end loop;
end $$;
