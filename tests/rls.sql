begin;
create temporary table jel_rls_results(test text,passed boolean);
grant all on jel_rls_results to anon,authenticated;
insert into auth.users(id,email,email_confirmed_at) values
 ('11111111-1111-4111-8111-111111111111','approved-test@example.invalid',now()),
 ('22222222-2222-4222-8222-222222222222','other-test@example.invalid',now());
insert into auth.identities(provider_id,user_id,identity_data,provider) values
 ('jel-approved-test','11111111-1111-4111-8111-111111111111','{"email_verified":true}','google');
insert into jel_private.administrators(user_id) values('11111111-1111-4111-8111-111111111111');
insert into public.app_configurations(config_key,config_value,is_public) values('private_probe','{"not_public":true}',false);

set local role anon;
insert into jel_rls_results select 'anon reads only two public records',count(*)=2 from public.app_configurations;
do $$begin
 begin
  insert into public.app_configurations(config_key,config_value) values('denied','{}');
  insert into jel_rls_results values('anon insert denied',false);
 exception when insufficient_privilege then insert into jel_rls_results values('anon insert denied',true);end;
end$$;
reset role;

select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
set local role authenticated;
insert into jel_rls_results select 'nonadmin RPC returns false',not public.is_configuration_admin();
insert into jel_rls_results select 'nonadmin cannot read private records',count(*)=0 from public.app_configurations where config_key='private_probe';
do $$begin
 begin
  insert into public.app_configurations(config_key,config_value) values('denied','{}');
  insert into jel_rls_results values('nonadmin insert denied',false);
 exception when insufficient_privilege then insert into jel_rls_results values('nonadmin insert denied',true);end;
end$$;
with changed as(update public.app_configurations set config_value='{}' where config_key='site' returning *)
insert into jel_rls_results select 'nonadmin update changes zero rows',count(*)=0 from changed;
with changed as(delete from public.app_configurations where config_key='site' returning *)
insert into jel_rls_results select 'nonadmin delete changes zero rows',count(*)=0 from changed;
do $$begin
 begin
  insert into jel_private.administrators(user_id) values('22222222-2222-4222-8222-222222222222');
  insert into jel_rls_results values('nonadmin cannot self-authorize',false);
 exception when insufficient_privilege then insert into jel_rls_results values('nonadmin cannot self-authorize',true);end;
end$$;
reset role;

select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
set local role authenticated;
insert into jel_rls_results select 'approved Google UID authorized',public.is_configuration_admin();
insert into jel_rls_results select 'admin reads private records',count(*)=1 from public.app_configurations where config_key='private_probe';
with changed as(update public.app_configurations set config_value=config_value,version=999 where config_key='site' and version=1 returning version,updated_by)
insert into jel_rls_results select 'admin save increments version and stamps UID',count(*)=1 and bool_and(version=2 and updated_by='11111111-1111-4111-8111-111111111111') from changed;
with changed as(update public.app_configurations set config_value='{}' where config_key='site' and version=1 returning *)
insert into jel_rls_results select 'stale version cannot overwrite',count(*)=0 from changed;
insert into public.app_configurations(config_key,config_value) values('admin_insert_test','{}');
with changed as(delete from public.app_configurations where config_key='admin_insert_test' returning *)
insert into jel_rls_results select 'admin insert and delete permitted',count(*)=1 from changed;
reset role;
select json_agg(json_build_object('test',test,'passed',passed)) as checks from jel_rls_results;
rollback;
