/* srs.js — lightweight SM-2 style spaced repetition scheduler */

function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// rating: 'again' | 'hard' | 'good' | 'easy'
function schedule(srs, rating) {
  const today = DB.todayStr();
  let { interval, ease, reps, lapses } = srs;
  ease = ease || 2.5;
  interval = interval || 0;
  reps = reps || 0;
  lapses = lapses || 0;

  switch (rating) {
    case "again":
      lapses += 1;
      reps = 0;
      interval = 1;
      ease = Math.max(1.3, ease - 0.2);
      break;
    case "hard":
      interval = Math.max(1, Math.round((interval || 1) * 1.2));
      ease = Math.max(1.3, ease - 0.15);
      reps += 1;
      break;
    case "good":
      interval = reps === 0 ? 3 : Math.round(interval * ease);
      reps += 1;
      break;
    case "easy":
      interval = Math.round((interval || 1) * ease * 1.3) + 1;
      ease = ease + 0.15;
      reps += 1;
      break;
  }

  let status = "review";
  if (rating === "again") status = "relearning";
  else if (interval >= 21) status = "mastered";
  else if (reps === 0) status = "new";

  return {
    status,
    interval,
    ease: Math.round(ease * 100) / 100,
    reps,
    lapses,
    dueDate: addDays(today, interval),
    lastResult: rating,
    lastReviewed: today,
  };
}

function isDue(srs) {
  return !srs.dueDate || srs.dueDate <= DB.todayStr();
}

window.SRS = { schedule, isDue, addDays };
