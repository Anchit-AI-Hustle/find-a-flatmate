-- Hardening pass after an independent review of the workflow RPCs (see docs/THREAT-MODEL.md).
-- Access-model changes in this migration:
--  * Interest: hidden (non-discoverable) profiles can no longer be sent interest by id; a `listing` argument must be an
--    active listing owned by the target and must itself fit the sender; it can no longer be used to skip checks.
--  * Discover: browsing is limited to the caller's own city regardless of the argument supplied.
--  * Reports: a member can report a message in any conversation they belong to, and a person they have matched with,
--    even after a block, pause or suspension has hidden the conversation.
--  * Blocking cancels any open visit between the two people and deletes a shared visit address.
--  * Moderation: support/export requests can be marked handled (was failing); a moderator "expire" now needs a fresh
--    review before the owner can relist; approval gives a full freshness window from the moment of approval.
--  * Onboarding: a profile cannot be activated before the lifestyle step has been saved or skipped.
--  * expire_rooms runs with definer rights so the scheduled server job (service role) can execute it.

create or replace function public.discover_people(city text, candidate uuid default null) returns table(id uuid,display_name text,city_id text,localities text[],budget_min int,budget_max int,move_from date,move_until date,stay_months smallint,intent public.intent,email_verified boolean,answers jsonb) language sql stable security definer set search_path='' as $$
 select p.id,p.display_name,p.city_id,p.localities,p.budget_min,p.budget_max,p.move_from,p.move_until,p.stay_months,p.intent,
 exists(select 1 from public.verification_checks v where v.user_id=p.id and v.kind='email'),private.read_answers(p.id,null)
 from public.profiles p where private.profile_active(auth.uid()) and p.status='active' and p.id<>auth.uid() and private.not_blocked(auth.uid(),p.id)
 and ((candidate is null and p.discoverable and p.city_id=(select me.city_id from public.profiles me where me.id=auth.uid()) and p.move_until>=(now() at time zone 'Asia/Kolkata')::date
 and not exists(select 1 from public.interests i where i.actor_id=auth.uid() and i.target_id=p.id and i.status in ('passed','withdrawn'))
 and not exists(select 1 from public.interests i where i.actor_id=p.id and i.target_id=auth.uid() and i.status='passed'))
 or (candidate=p.id and (p.discoverable or exists(select 1 from public.matches m where (m.member_a,m.member_b)=(least(auth.uid(),p.id),greatest(auth.uid(),p.id)))
 or exists(select 1 from public.interests i where i.actor_id=p.id and i.target_id=auth.uid() and i.status='sent'))))
 order by p.updated_at desc,p.id limit 80;
$$;

create or replace function public.interest_transition(target uuid, action text, listing uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
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
  -- A listing reference only counts when it is a live listing owned by the person being contacted.
  if listing is not null and not exists(select 1 from public.listings l where l.id=listing and l.owner_id=target and l.status='active' and l.expires_at>now())
  then raise exception 'Listing unavailable'; end if;
  if coalesce(opposite='passed',false) or not (coalesce(opposite='sent',false) or listing is not null or exists(select 1 from public.profiles where id=target and discoverable))
  then raise exception 'Candidate unavailable'; end if;
  if opposite is distinct from 'sent' then
   if listing is not null then
    if not exists(select 1 from public.profiles a join public.listings l on l.id=listing where a.id=u
     and a.city_id=l.city_id and l.locality_id=any(a.localities) and l.monthly<=a.budget_max and a.move_from<=l.available_until and l.available_from<=a.move_until and a.stay_months>=l.min_months)
    then raise exception 'This room does not fit your locality, budget, dates or length of stay'; end if;
   elsif not exists(select 1 from public.profiles a join public.profiles b on b.id=target where a.id=u and a.city_id=b.city_id and a.localities && b.localities
    and a.budget_min<=b.budget_max and b.budget_min<=a.budget_max and a.move_from<=b.move_until and b.move_from<=a.move_until)
   then raise exception 'No overlapping location, budget, or move-in dates'; end if;
  end if;
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

create or replace function public.save_privacy(v jsonb) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); s public.profile_state;
begin
 perform private.throttle(u,'privacy',30);
 select status into s from public.profiles where id=u for update;
 if not found then raise exception 'Complete the basics first'; end if;
 if v->>'status' is not null and (v->>'status') not in ('active','paused') then raise exception 'Invalid profile status'; end if;
 if s='draft' and v->>'status' is distinct from 'active' then raise exception 'Finish onboarding first'; end if;
 if s='draft' and not exists(select 1 from public.onboarding_progress where user_id=u and step in ('preferences','complete')) then raise exception 'Answer or skip the lifestyle questions first'; end if;
 update public.profiles set discoverable=coalesce((v->>'discoverable')::boolean,discoverable),status=coalesce((v->>'status')::public.profile_state,status),updated_at=now() where id=u;
 insert into public.notification_preferences values(u,coalesce((v->>'reminders')::boolean,false)) on conflict(user_id) do update set reminders=excluded.reminders;
 insert into public.user_consents(user_id,purpose,granted,revision) values(u,'analytics',coalesce((v->>'analytics')::boolean,false),'2026-11')
 on conflict(user_id,purpose) do update set granted=excluded.granted,updated_at=now();
 if s='draft' then
  update public.onboarding_progress set step='complete',updated_at=now() where user_id=u;
  perform private.event_for(u,'onboarding_completed');
 end if;
end $$;

create or replace function public.send_message(c uuid, body text, request_key uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); content text:=private.clean(body); warning boolean;
begin
 perform private.lock_chat(u,c);
 if exists(select 1 from public.messages m where m.sender_id=u and m.request_key=send_message.request_key) then return; end if;
 perform private.throttle(u,'message',45);
 if (select count(*) from public.messages m where m.conversation_id=c and m.sender_id=u and lower(m.body)=lower(content) and m.created_at>now()-interval '1 hour')>=2 then raise exception 'Please avoid sending repeated messages'; end if;
 -- Whole-word matches only, so ordinary words such as "occupied" are not flagged.
 warning:=content ~* '(\mupi\M|\mpaytm\M|\mphonepe\M|\mgpay\M|\maadhaa?r\M|\motp\M|advance.{0,30}(pay|transfer|deposit)|token.{0,15}(fee|money|amount)|bank details|\mwhatsapp\M)';
 if not exists(select 1 from public.messages where conversation_id=c and sender_id=u) then perform private.event_for(u,'first_message'); end if;
 insert into public.messages(conversation_id,sender_id,body,request_key,suspicious) values(c,u,content,request_key,warning);
end $$;

create or replace function public.block_account(target uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); v record;
begin
 if u=target or not exists(select 1 from public.profiles where id=target) or not exists(select 1 from public.profiles where id=u) then raise exception 'Account unavailable'; end if;
 perform private.lock_pair(u,target);
 perform private.throttle(u,'block',30);
 insert into public.blocks(actor_id,target_id) values(u,target) on conflict do nothing;
 update public.interests set status='blocked',updated_at=now() where (actor_id=u and target_id=target) or (actor_id=target and target_id=u);
 delete from public.saved_items where (user_id=u and (profile_id=target or listing_id in (select id from public.listings where owner_id=target))) or (user_id=target and (profile_id=u or listing_id in (select id from public.listings where owner_id=u)));
 -- An open visit between the two people ends with the block, and any shared address is deleted.
 for v in select x.id from public.visit_requests x join public.conversations c on c.id=x.conversation_id join public.matches m on m.id=c.match_id
  where m.member_a=least(u,target) and m.member_b=greatest(u,target) and x.status in ('requested','confirmed','rescheduled') loop
  delete from private.visit_locations where visit_id=v.id;
  update public.visit_requests set status='cancelled',updated_at=now() where id=v.id;
  insert into public.visit_events(visit_id,actor_id,status) values(v.id,u,'cancelled');
 end loop;
end $$;

create or replace function public.file_report(subject uuid,listing uuid,message uuid,category text,details text,also_block boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); target uuid; result uuid;
begin
 perform private.throttle(u,'report',12,1440);
 if not exists(select 1 from public.profiles where id=u) then raise exception 'Complete the basics first'; end if;
 if num_nonnulls(subject,listing,message)<>1 then raise exception 'Choose exactly one report subject'; end if;
 if listing is not null then
  select owner_id into target from public.listings where id=listing and private.can_read_listing(id);
 elsif message is not null then
  -- Any message in a conversation the reporter belongs to, even if a block or pause has since hidden it.
  select m.sender_id into target from public.messages m join public.conversation_members cm on cm.conversation_id=m.conversation_id and cm.user_id=u where m.id=message;
 else
  select id into target from public.discover_people(null,subject);
  if target is null and exists(select 1 from public.matches m where (m.member_a,m.member_b)=(least(u,subject),greatest(u,subject))) then target:=subject; end if;
 end if;
 if target is null or target=u then raise exception 'Report target unavailable'; end if;
 insert into public.reports(reporter_id,subject_id,listing_id,message_id,category,details) values(u,target,listing,message,category,private.clean(details)) returning id into result;
 if also_block then perform public.block_account(target); end if;
 return result;
end $$;

create or replace function public.moderate(kind text,target uuid,action text,reason text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); x public.listings; r public.report_state; p public.profile_state;
begin
 if not private.is_moderator() then raise exception 'Moderator access required' using errcode='42501'; end if;
 if length(private.clean(reason)) not between 5 and 500 then raise exception 'Enter a reason (5–500 characters)'; end if;
 if kind='listing' then
  select * into x from public.listings where id=target for update;
  if not found or x.owner_id=u then raise exception 'Listing unavailable for independent review'; end if;
  if action='approve' and x.status='pending_review' and x.available_until>=(now() at time zone 'Asia/Kolkata')::date and private.profile_active(x.owner_id) then
   update public.listings set status='active',reviewed_at=now(),expires_at=least(now()+interval '21 days',((available_until+1)::timestamp at time zone 'Asia/Kolkata')),updated_at=now() where id=target;
  elsif action='reject' and x.status='pending_review' then update public.listings set status='draft',updated_at=now() where id=target;
  elsif action='remove' and x.status in ('pending_review','active','paused','expired') then update public.listings set status='removed',expires_at=now(),updated_at=now() where id=target;
  elsif action='expire' and x.status='active' then update public.listings set status='expired',reviewed_at=null,expires_at=now(),updated_at=now() where id=target;
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
  update public.data_subject_requests d set status='fulfilled' where d.id=target and d.status='pending' and d.kind<>'delete';
  if not found then raise exception 'Only export or support requests can be marked handled here'; end if;
 else raise exception 'Invalid moderation target'; end if;
 insert into public.moderation_actions(moderator_id,target_type,target_id,action,reason) values(u,kind,target,action,private.clean(reason));
 insert into public.admin_audit_logs(actor_id,action,target_id) values(u,kind||'.'||action,target);
end $$;

alter function public.expire_rooms() security definer;
