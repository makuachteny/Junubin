import { updateProfile } from '../services/profileService';

// Configurable supabase mock. State lives on globalThis so the
// jest.mock factory (hoisted above imports) can reach it without
// tripping the "out-of-scope variable" guard.
jest.mock('../../config/supabase', () => {
  const getState = () => globalThis.__SUPA__;
  const makeBuilder = (table) => {
    const builder = {};
    ['select', 'eq', 'order', 'limit', 'in', 'or', 'neq', 'maybeSingle', 'single', 'update']
      .forEach((m) => { builder[m] = () => builder; });
    builder.insert = (payload) => {
      getState().inserts.push({ table, payload });
      return builder;
    };
    // Thenable: resolves to the next queued response for this table.
    builder.then = (resolve, reject) => {
      const q = getState().queues[table] || [];
      const res = q.length ? q.shift() : { data: null, error: null };
      return Promise.resolve(res).then(resolve, reject);
    };
    return builder;
  };
  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: getState().authUser }, error: null }) },
      from: (table) => makeBuilder(table),
    },
    supabaseUrl: 'https://x.supabase.co',
    supabaseAnonKey: 'anon-key',
  };
});

beforeEach(() => {
  globalThis.__SUPA__ = {
    authUser: { id: 'auth-1' },
    inserts: [],
    queues: { User: [], Profile: [] },
  };
});

const seedUserLookup = () => {
  // First from('User') call resolves the app User id.
  globalThis.__SUPA__.queues.User.push({ data: { id: 'u1' }, error: null });
};

const seedReadback = (profile = { bio: 'hi' }) => {
  // Final from('User') readback returns the full nested user.
  globalThis.__SUPA__.queues.User.push({
    data: { id: 'u1', displayName: 'Adau', profile, photos: [] },
    error: null,
  });
};

describe('updateProfile persistence hardening', () => {
  it('does NOT insert when the Profile update affects a row', async () => {
    seedUserLookup();
    globalThis.__SUPA__.queues.Profile.push({ data: [{ id: 'p1' }], error: null }); // update hit a row
    seedReadback({ bio: 'hi' });

    const result = await updateProfile({ bio: 'hi' });

    expect(globalThis.__SUPA__.inserts).toHaveLength(0);
    expect(result.profile.bio).toBe('hi');
  });

  it('self-heals by inserting the Profile row when the update affects 0 rows', async () => {
    seedUserLookup();
    globalThis.__SUPA__.queues.Profile.push({ data: [], error: null }); // 0-row write (missing row / RLS)
    globalThis.__SUPA__.queues.Profile.push({ data: null, error: null }); // insert succeeds
    seedReadback({ bio: 'hi' });

    await updateProfile({ bio: 'hi' });

    expect(globalThis.__SUPA__.inserts).toHaveLength(1);
    expect(globalThis.__SUPA__.inserts[0].table).toBe('Profile');
    expect(globalThis.__SUPA__.inserts[0].payload).toMatchObject({ userId: 'u1', bio: 'hi' });
  });

  it('throws when the Profile update errors (no silent success)', async () => {
    seedUserLookup();
    globalThis.__SUPA__.queues.Profile.push({ data: null, error: { message: 'permission denied' } });

    await expect(updateProfile({ bio: 'hi' })).rejects.toThrow(/Profile update/);
  });

  it('throws when the readback errors instead of returning undefined', async () => {
    seedUserLookup();
    globalThis.__SUPA__.queues.Profile.push({ data: [{ id: 'p1' }], error: null });
    globalThis.__SUPA__.queues.User.push({ data: null, error: { message: 'boom' } }); // readback fails

    await expect(updateProfile({ bio: 'hi' })).rejects.toThrow(/Profile re-fetch/);
  });
});
