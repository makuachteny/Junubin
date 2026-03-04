import { supabase } from '../../config/supabase';

export async function getMe() {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data, error } = await supabase
    .from('User')
    .select('*, profile:Profile(*), photos:Photo(*)')
    .eq('auth_id', authUser.id)
    .single();

  if (error) throw error;
  return { user: data };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
