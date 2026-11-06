import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useFollow } from '../hooks/useFollow';

const mockIsFollowing = jest.fn();
const mockGetFollowCounts = jest.fn();
const mockAreFriends = jest.fn();
const mockFollowUser = jest.fn();
const mockUnfollowUser = jest.fn();

jest.mock('../api/services/followService', () => ({
  isFollowing: (...args) => mockIsFollowing(...args),
  getFollowCounts: (...args) => mockGetFollowCounts(...args),
  areFriends: (...args) => mockAreFriends(...args),
  followUser: (...args) => mockFollowUser(...args),
  unfollowUser: (...args) => mockUnfollowUser(...args),
}));

const mockUseAuth = jest.fn();
jest.mock('../auth', () => ({
  useAuth: () => mockUseAuth(),
  useRequireAuth: () => (() => !!mockUseAuth().session),
}));

describe('useFollow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsFollowing.mockResolvedValue(false);
    mockGetFollowCounts.mockResolvedValue({ followers: 2, following: 3 });
    mockAreFriends.mockResolvedValue(false);
    mockFollowUser.mockResolvedValue({ id: 'f1' });
    mockUnfollowUser.mockResolvedValue({ success: true });
  });

  it('loads initial follow state and counts when authenticated', async () => {
    mockUseAuth.mockReturnValue({ session: { user: { id: 'u1' } } });

    const { result } = renderHook(() => useFollow('target-1'));

    await waitFor(() => {
      expect(mockIsFollowing).toHaveBeenCalledWith('target-1');
      expect(mockGetFollowCounts).toHaveBeenCalledWith('target-1');
      expect(mockAreFriends).toHaveBeenCalledWith('target-1');
    });
    await waitFor(() => {
      expect(result.current.counts.followers).toBe(2);
      expect(result.current.counts.following).toBe(3);
    });
  });

  it('does not fetch isFollowing or areFriends when signed out', async () => {
    mockUseAuth.mockReturnValue({ session: null });

    renderHook(() => useFollow('target-1'));

    // getFollowCounts is called regardless (no session check), but isFollowing and areFriends require session
    await waitFor(() => {
      expect(mockGetFollowCounts).toHaveBeenCalledWith('target-1');
    });
    expect(mockIsFollowing).not.toHaveBeenCalled();
    expect(mockAreFriends).not.toHaveBeenCalled();
  });

  it('follows then unfollows with optimistic state', async () => {
    mockUseAuth.mockReturnValue({ session: { user: { id: 'u1' } } });

    const { result } = renderHook(() => useFollow('target-1', false));

    const realNow = Date.now;
    Date.now = jest.fn()
      .mockReturnValueOnce(300)
      .mockReturnValueOnce(700);

    await act(async () => {
      await result.current.toggleFollow();
    });
    expect(mockFollowUser).toHaveBeenCalledWith('target-1');

    await act(async () => {
      await result.current.toggleFollow();
    });
    expect(mockUnfollowUser).toHaveBeenCalledWith('target-1');
    Date.now = realNow;
  });
});
