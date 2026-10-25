create schema jel_private;
revoke all on schema jel_private from public;
grant usage on schema jel_private to anon, authenticated;

create table jel_private.administrators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  approved_at timestamptz not null default now()
);
alter table jel_private.administrators enable row level security;
revoke all on jel_private.administrators from public, anon, authenticated;

-- Membership is provisioned by trusted administration only after verifying Google identity.
create function jel_private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from jel_private.administrators a
    join auth.users u on u.id = a.user_id
    where a.user_id = (select auth.uid()) and u.email_confirmed_at is not null
    and exists (select 1 from auth.identities i where i.user_id = u.id
      and i.provider = 'google' and i.identity_data ->> 'email_verified' = 'true')
  );
$$;
revoke all on function jel_private.is_admin() from public;
grant execute on function jel_private.is_admin() to anon, authenticated;

create function public.is_configuration_admin() returns boolean
language sql stable security invoker set search_path = ''
as $$ select jel_private.is_admin(); $$;
revoke all on function public.is_configuration_admin() from public, anon;
grant execute on function public.is_configuration_admin() to authenticated;

create table public.app_configurations (
  id uuid primary key default gen_random_uuid(),
  config_key text not null unique check (length(config_key) between 1 and 80),
  config_value jsonb not null check (jsonb_typeof(config_value) in ('object', 'array') and octet_length(config_value::text) <= 262144),
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  is_public boolean not null default false,
  constraint public_keys_only check (not is_public or config_key in ('site', 'audio_catalog'))
);
alter table public.app_configurations enable row level security;
revoke all on public.app_configurations from public, anon, authenticated;
grant select on public.app_configurations to anon;
grant select, insert, update, delete on public.app_configurations to authenticated;

create policy configuration_read on public.app_configurations for select
to anon, authenticated using (
  (is_public and config_key in ('site', 'audio_catalog')) or (select jel_private.is_admin())
);
create policy configuration_insert on public.app_configurations for insert
to authenticated with check ((select jel_private.is_admin()));
create policy configuration_update on public.app_configurations for update
to authenticated using ((select jel_private.is_admin())) with check ((select jel_private.is_admin()));
create policy configuration_delete on public.app_configurations for delete
to authenticated using ((select jel_private.is_admin()));

create function jel_private.configuration_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.config_key := old.config_key;
    new.version := old.version + 1;
  else
    new.version := 1;
  end if;
  new.updated_at := clock_timestamp();
  new.updated_by := auth.uid();
  return new;
end;
$$;
revoke all on function jel_private.configuration_revision() from public, anon, authenticated;
create trigger configuration_revision before insert or update on public.app_configurations
for each row execute function jel_private.configuration_revision();

comment on table public.app_configurations is 'Only site and audio_catalog are intended for public data. Never store secrets in these records.';

insert into public.app_configurations(config_key,config_value,is_public) values ('site','{"curtain":{"folds":8,"depth":0.32,"warp":0.003,"naturalAmplitude":0.0015,"naturalSpeed":0.6,"mouseStrength":0.0025,"mouseRadius":0.3,"light":1,"scale":1,"positionX":50,"positionY":50,"enabled":true,"naturalEnabled":true,"cursorEnabled":true,"quality":1.5,"touchImpulse":0.35},"page":{"background":"#000000","padding":20},"title":{"text":"Hello World!","color":"#333333","size":48,"duration":1.5,"animate":true},"paragraphs":{"first":"Estou aprendendo HTML, CSS e JavaScript.","second":"Movimente o cursor para interagir com a cortina.","color":"#ffffff","size":18},"button":{"text":"Clique aqui","color1":"#007bff","color2":"#7b2ff7","radius":12,"fontSize":16,"paddingY":15,"paddingX":35,"shake":1,"explosion":2.5,"fadeDuration":1.5,"animate":true},"model3d":{"rotationX":-9,"rotationY":-12,"rotationZ":0,"zoom":1,"light":2.1,"metalness":0.72,"roughness":0.42,"cloudScale":1,"ropeSwing":0.35,"open":0,"autoRotate":false},"scroll":{"ropeAmplitude":1,"ropeFrequency":1.4,"ropeDamping":0.65,"ropeImpulse":3,"ropeMouse":true,"raggedEdges":true,"ropeGravity":1000,"ropeStiffness":0.9,"ropeLength":62,"tasselLength":29,"tasselSpread":1},"characters":{"enabled":true,"hoverColor":"#8d1521","delay":0.8,"closeDuration":1.8,"cardDuration":0.7,"cardWidth":520,"cardRadius":22,"cardOpacity":0.97},"pain":{"enabled":true,"effectIntensity":0.8,"entryDuration":1.5,"exitDuration":1.8,"glow":0.65,"particles":18,"eyeOpacity":0.5,"eyeTracking":0.45,"blinkInterval":4,"eyeScale":1,"eyeShine":0.8,"fireHeight":0.55},"konan":{"enabled":true,"effectIntensity":0.8,"entryDuration":1.5,"exitDuration":1.8,"glow":0.65,"particles":18,"eyeOpacity":0.5,"eyeTracking":0.45,"blinkInterval":4,"eyeScale":1,"eyeShine":0.8,"fireHeight":0.55},"itachi":{"enabled":true,"effectIntensity":0.8,"entryDuration":1.5,"exitDuration":1.8,"glow":0.65,"particles":18,"eyeOpacity":0.5,"eyeTracking":0.45,"blinkInterval":4,"eyeScale":1,"eyeShine":0.8,"fireHeight":0.55,"focusDelay":0.4,"mangekyoDuration":0.5,"bloodDelay":0.3,"bloodDuration":1.8,"dramaticPause":0.4,"amaterasuDuration":1.6,"eyeHold":0.5,"eyeFade":0.5,"bloodEnabled":true,"bloodAmount":0.7,"amaterasuEnabled":true,"mangekyoEnabled":true,"bloodReach":45,"bloodWidth":9,"bloodViscosity":0.65,"fireIntensity":0.9,"fireTurbulence":0.65,"firePurple":0.3,"fireRed":0.16,"fireGradient":0.5,"fireSmoke":0.55,"fireChar":0.7,"fireParticles":35,"eyeFollowDelay":0.65,"eyeMicroMotion":0.55,"bloodEmergence":0.8,"bloodInitialSpeed":35,"bloodAcceleration":180,"bloodMaxSpeed":340,"bloodAfterEye":1.4,"bloodFade":1.6},"kisame":{"enabled":true,"effectIntensity":0.8,"entryDuration":1.5,"exitDuration":1.8,"glow":0.65,"particles":18,"eyeOpacity":0.5,"eyeTracking":0.45,"blinkInterval":4,"eyeScale":1,"eyeShine":0.8,"fireHeight":0.55},"deidara":{"enabled":true,"effectIntensity":0.8,"entryDuration":1.5,"exitDuration":1.8,"glow":0.65,"particles":18,"eyeOpacity":0.5,"eyeTracking":0.45,"blinkInterval":4,"eyeScale":1,"eyeShine":0.8,"fireHeight":0.55},"sasori":{"enabled":true,"effectIntensity":0.8,"entryDuration":1.5,"exitDuration":1.8,"glow":0.65,"particles":18,"eyeOpacity":0.5,"eyeTracking":0.45,"blinkInterval":4,"eyeScale":1,"eyeShine":0.8,"fireHeight":0.55},"hidan":{"enabled":true,"effectIntensity":0.8,"entryDuration":1.5,"exitDuration":1.8,"glow":0.65,"particles":18,"eyeOpacity":0.5,"eyeTracking":0.45,"blinkInterval":4,"eyeScale":1,"eyeShine":0.8,"fireHeight":0.55},"kakuzu":{"enabled":true,"effectIntensity":0.8,"entryDuration":1.5,"exitDuration":1.8,"glow":0.65,"particles":18,"eyeOpacity":0.5,"eyeTracking":0.45,"blinkInterval":4,"eyeScale":1,"eyeShine":0.8,"fireHeight":0.55},"zetsu":{"enabled":true,"effectIntensity":0.8,"entryDuration":1.5,"exitDuration":1.8,"glow":0.65,"particles":18,"eyeOpacity":0.5,"eyeTracking":0.45,"blinkInterval":4,"eyeScale":1,"eyeShine":0.8,"fireHeight":0.55},"obito":{"enabled":true,"effectIntensity":0.8,"entryDuration":1.5,"exitDuration":1.8,"glow":0.65,"particles":18,"eyeOpacity":0.5,"eyeTracking":0.45,"blinkInterval":4,"eyeScale":1,"eyeShine":0.8,"fireHeight":0.55},"audio":{"enabled":true,"masterVolume":0.7,"ambientVolume":0.35,"messageVolume":0.85,"fadeSeconds":0.7,"avoidRepeat":true,"dailyMode":false,"autoplayAfterGesture":true}}'::jsonb,true) on conflict(config_key) do nothing;

insert into public.app_configurations(config_key,config_value,is_public) values ('audio_catalog','[{"id":"itachi-mensagem-1","dest":"itachi","cat":"mensagens","name":"Mensagem 1 — Itachi","url":"audio/itachi/mensagem-1.mp3"}]'::jsonb,true) on conflict(config_key) do nothing;
