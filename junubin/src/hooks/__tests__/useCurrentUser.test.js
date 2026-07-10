import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import { useCurrentUser } from '../useCurrentUser';

const mockUseAuth = jest.fn();
jest.mock('../../auth', () => ({ useAuth: () => mockUseAuth() }));

function Probe() {
  const { currentUser } = useCurrentUser();
  return (
    <>
      <Text testID="name">{currentUser.name || 'EMPTY'}</Text>
      <Text testID="bio">{currentUser.bio || 'EMPTY'}</Text>
      <Text testID="interests">{(currentUser.interests || []).join(',') || 'EMPTY'}</Text>
    </>
  );
}

describe('useCurrentUser first-render hydration', () => {
  it('returns the real user on the FIRST render (no demo/empty flash)', () => {
    // Regression: EditProfile seeds its form from currentUser at mount.
    // If the hook returned the demo/empty placeholder for the first
    // render, the editor opened with the wrong data and chips unselected.
    mockUseAuth.mockReturnValue({
      session: { user: { id: 'auth-1' } },
      user: {
        id: 'u1',
        displayName: 'Real Name',
        gender: 'woman',
        photos: [],
        profile: { bio: 'My real bio', interests: ['Music', 'Travel'] },
      },
      refreshUser: jest.fn(),
    });

    const { getByTestId } = render(<Probe />);

    expect(getByTestId('name').props.children).toBe('Real Name');
    expect(getByTestId('bio').props.children).toBe('My real bio');
    expect(getByTestId('interests').props.children).toBe('Music,Travel');
  });

  it('falls back to a placeholder only when there is no auth user', () => {
    mockUseAuth.mockReturnValue({ session: null, user: null, refreshUser: jest.fn() });
    const { getByTestId } = render(<Probe />);
    // No real profile → name resolves to the placeholder/demo (not the
    // real user). We only assert it doesn't surface a real name.
    expect(getByTestId('name').props.children).not.toBe('Real Name');
  });
});
