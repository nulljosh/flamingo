// Where am I in the story? Pure, so tests/story.test.mjs and the Swift port agree.
// A 100% save counts far more than the story. Rockstar hasn't published GTA VI's weights, so this assumes the story
// missions carry STORY_SHARE of the total, as they roughly do in GTA V, spread evenly across the 91 missions.
export const STORY_SHARE = 60

// percent: the completion % shown on the save. Returns how many missions are probably done (0 to total).
export function missionsDone(percent, total, share = STORY_SHARE) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0))
  return Math.min(total, Math.round(total * Math.min(1, p / share)))
}

// The mission you're probably on next, or null when the story is done.
export function estimate(percent, missions, share = STORY_SHARE) {
  const n = missionsDone(percent, missions.length, share)
  return { done: n, next: missions[n] || null, finished: n >= missions.length }
}
