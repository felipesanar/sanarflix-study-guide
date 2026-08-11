UPDATE auth.users
SET raw_user_meta_data = jsonb_set(coalesce(raw_user_meta_data, '{}'::jsonb), '{must_change_password}', 'false'::jsonb, true)
WHERE (raw_user_meta_data->>'must_change_password')::boolean IS TRUE
  AND last_sign_in_at IS NOT NULL
  AND updated_at > last_sign_in_at + interval '1 minute';