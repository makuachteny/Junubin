// One-shot migration that renames every AsyncStorage key prefixed with the
// legacy `@haboba_` brand to `@junubin_`. Runs once at app boot — after the
// first successful pass we set @junubin_keys_migrated_v1 and short-circuit.
//
// Why a runtime migration: the brand rename happened mid-flight; existing test
// builds on devices have data under @haboba_*. Without this, those installs
// would look like fresh users (lose subscription state, onboarding flag, etc.)
// on the first launch after the rename ships.

import AsyncStorage from '@react-native-async-storage/async-storage';

const SENTINEL = '@junubin_keys_migrated_v1';
// Built piecewise so the bulk-rename codemod cannot collapse the legacy prefix
// to match the new one — that would silently neuter the migration.
const LEGACY_PREFIX = '@' + 'haboba' + '_';
const NEW_PREFIX = '@junubin_';

export async function migrateLegacyStorageKeys() {
  try {
    const done = await AsyncStorage.getItem(SENTINEL);
    if (done) return;

    const keys = await AsyncStorage.getAllKeys();
    const legacyKeys = keys.filter((k) => k.startsWith(LEGACY_PREFIX));
    if (legacyKeys.length === 0) {
      await AsyncStorage.setItem(SENTINEL, '1');
      return;
    }

    const entries = await AsyncStorage.multiGet(legacyKeys);
    const renamed = entries
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([oldKey, value]) => [NEW_PREFIX + oldKey.slice(LEGACY_PREFIX.length), value]);

    if (renamed.length > 0) {
      await AsyncStorage.multiSet(renamed);
    }
    await AsyncStorage.multiRemove(legacyKeys);
    await AsyncStorage.setItem(SENTINEL, '1');
  } catch {
    // Migration failures are non-fatal — leave the sentinel unset so we retry
    // next launch. Worst case the user re-onboards, which is recoverable.
  }
}
