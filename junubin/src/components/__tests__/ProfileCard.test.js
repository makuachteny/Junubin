import React from 'react';
import { render } from '@testing-library/react-native';
import ProfileCard from '../ProfileCard';

// ProfileCard is a static photo card post-pivot — the swipe gesture,
// LIKE/NOPE stamps, SPOTLIGHT badge and dating-intent pill are gone.
// These tests lock both what it still renders and what it must not.
describe('ProfileCard', () => {
  const profile = {
    id: 'test-profile',
    name: 'Test User',
    age: 26,
    distance: 4,
    images: ['https://example.com/p1.jpg', 'https://example.com/p2.jpg'],
    verified: true,
    openTo: ['Mentorship'],
  };

  it('renders profile name and age', () => {
    const { getByText } = render(<ProfileCard profile={profile} />);
    expect(getByText(/Test User, 26/)).toBeTruthy();
  });

  it('renders verified badge when verified', () => {
    const { toJSON } = render(<ProfileCard profile={profile} />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('checkmark-circle');
  });

  it('renders distance text', () => {
    const { getByText } = render(<ProfileCard profile={profile} />);
    expect(getByText('4 mi')).toBeTruthy();
  });

  it('no longer exposes an imperative swipe API', () => {
    const ref = React.createRef();
    render(<ProfileCard ref={ref} profile={profile} />);
    expect(ref.current).toBeNull();
  });

  it('falls back to the first openTo badge, never the dating intention', () => {
    const datingEra = { ...profile, intention: 'long-term', lookingFor: 'Women' };
    const { getByText, queryByText } = render(<ProfileCard profile={datingEra} />);
    expect(getByText('Mentorship')).toBeTruthy();
    expect(queryByText('long-term')).toBeNull();
    expect(queryByText('Women')).toBeNull();
  });

  it('renders no LIKE/NOPE stamps or SPOTLIGHT badge', () => {
    const { toJSON } = render(
      <ProfileCard profile={{ ...profile, spotlight: true }} />
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).not.toContain('LIKE');
    expect(tree).not.toContain('NOPE');
    expect(tree).not.toContain('SPOTLIGHT');
  });

  it('handles profile with no images gracefully', () => {
    const noImgProfile = { ...profile, images: [] };
    const { getByText } = render(<ProfileCard profile={noImgProfile} />);
    expect(getByText('T')).toBeTruthy();
  });
});
