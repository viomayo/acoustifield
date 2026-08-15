begin;
select plan(10);

select has_schema('private', 'private helper schema exists');
select has_function('private', 'is_supervisor', array[]::text[], 'private supervisor helper exists');
select has_function('public', 'current_user_is_supervisor', array[]::text[], 'safe supervisor check exists');
select has_function('public', 'sync_fiche_snapshot', array['jsonb', 'bigint', 'boolean'], 'snapshot RPC exists');
select has_table('public', 'fiches', 'fiches exists');
select has_table('public', 'photos', 'photos exists');
select ok(row_security_active('public.fiches'), 'fiches RLS is active');
select ok(row_security_active('public.photos'), 'photos RLS is active');
select policies_are('public', 'fiches', array['fiche_delete', 'fiche_insert', 'fiche_select', 'fiche_update']);
select policies_are('public', 'photos', array['photo_delete', 'photo_insert', 'photo_select', 'photo_update']);

select * from finish();
rollback;
