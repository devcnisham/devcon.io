-- Keeps public.users in sync with auth.users. GoTrue writes auth.users on
-- signup; this trigger mirrors new rows into public.users so membership FKs
-- resolve. Function is SECURITY DEFINER so it can read auth.users.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name, email_verified_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    new.email_confirmed_at
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    email_verified_at = excluded.email_verified_at;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
