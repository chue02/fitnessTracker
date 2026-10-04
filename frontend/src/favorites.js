// The user's favorite exercises: up to MAX_FAVORITES entries whose PRs the
// home screen tracks. A lift may be narrowed to a resistance, a cardio
// exercise to a minimum distance. They live on the profile, so they arrive
// with the signed-in user and are saved with a profile PATCH.

import { api } from './api.js'

// Mirrors FavoriteExercise.MAX_PER_USER on the server.
export const MAX_FAVORITES = 5

// A favorite's minimum distance as a number, or null for "any distance". The
// API sends decimals as strings ("5.00").
export function minDistanceOf(fav) {
  const n = Number(fav.min_distance)
  return fav.min_distance == null || fav.min_distance === '' || !(n > 0) ? null : n
}

// "5 km+", or '' when the favorite has no minimum.
export function minDistanceLabel(fav) {
  const n = minDistanceOf(fav)
  return n == null ? '' : `${n} ${fav.min_distance_unit}+`
}

// Replace the favorites with `list` (order matters) and push the saved profile
// into the auth context so every screen sees the change.
export async function saveFavorites(list, setProfile) {
  const profile = await api.patch('/profile/', {
    favorites: list.map((f) => ({
      exercise: f.exercise,
      equipment: f.equipment || '',
      min_distance: minDistanceOf(f),
      min_distance_unit: f.min_distance_unit || 'mi',
    })),
  })
  setProfile(profile)
  return profile
}

// Identifies a favorite's variant, for React keys and spotting duplicates.
export function favoriteKey(fav) {
  const min = minDistanceOf(fav)
  return `${fav.exercise}::${fav.equipment || ''}::${min == null ? '' : `${min}${fav.min_distance_unit}`}`
}
