// The user's favorite lifts: up to MAX_FAVORITES (exercise, resistance) pairs
// whose PRs the home screen tracks. They live on the profile, so they arrive
// with the signed-in user and are saved with a profile PATCH.

import { api } from './api.js'

// Mirrors FavoriteExercise.MAX_PER_USER on the server.
export const MAX_FAVORITES = 5

// Replace the favorites with `list` (order matters) and push the saved profile
// into the auth context so every screen sees the change.
export async function saveFavorites(list, setProfile) {
  const profile = await api.patch('/profile/', {
    favorites: list.map(({ exercise, equipment }) => ({ exercise, equipment })),
  })
  setProfile(profile)
  return profile
}
