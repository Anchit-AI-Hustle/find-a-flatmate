-- Give a signed-in sender access to their own words through the export RPC,
-- even after a conversation is closed or blocked. Chat visibility is unchanged.
create function public.export_sent_messages()
returns table(id uuid, conversation_id uuid, body text, created_at timestamptz)
language sql stable security definer set search_path='' as $$
  select m.id, m.conversation_id, m.body, m.created_at
  from public.messages m where m.sender_id=(select auth.uid())
  order by m.created_at, m.id
$$;
revoke all on function public.export_sent_messages() from public,anon;
grant execute on function public.export_sent_messages() to authenticated;
