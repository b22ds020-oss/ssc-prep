/* srs.js
Simple spaced repetition scheduler for SSC Prep v2.0
Focuses on review counts and mastery rules.
*/

function addDays(dateStr, days) {
const d = new Date(dateStr + "T00:00:00");
d.setDate(d.getDate() + days);
return d.toISOString().slice(0, 10);
}

function freshSRS() {
return {
status: "new",      // new | learning | review | mastered
interval: 0,
ease: 2.5,
reps: 0,
lapses: 0,
reviewCount: 0,
dueDate: DB.todayStr(),
lastReviewed: null,
lastResult: null
};
}

function getStatusFromReviewCount(reviewCount, currentStatus = "new") {
if (reviewCount >= 4) return "mastered";
if (reviewCount >= 1) return "review";
return currentStatus || "new";
}

function schedule(srs, rating) {
const today = DB.todayStr();

let interval = srs?.interval || 0;
let ease = srs?.ease || 2.5;
let reps = srs?.reps || 0;
let lapses = srs?.lapses || 0;
let reviewCount = srs?.reviewCount || 0;

switch (rating) {
case "again":
lapses += 1;
reps = 0;
interval = 1;
ease = Math.max(1.3, ease - 0.2);
break;

```
case "hard":
  reps += 1;
  interval = Math.max(1, Math.round((interval || 1) * 1.2));
  ease = Math.max(1.3, ease - 0.15);
  reviewCount += 1;
  break;

case "good":
  reps += 1;
  interval = reps === 1 ? 2 : Math.max(1, Math.round(interval * ease));
  reviewCount += 1;
  break;

case "easy":
  reps += 1;
  interval = Math.round((interval || 1) * ease * 1.3) + 1;
  ease = ease + 0.15;
  reviewCount += 1;
  break;

default:
  break;
```

}

let status = "learning";
if (rating === "again") {
status = "learning";
} else if (reviewCount >= 4) {
status = "mastered";
} else if (reviewCount >= 1) {
status = "review";
}

return {
status,
interval,
ease: Math.round(ease * 100) / 100,
reps,
lapses,
reviewCount,
dueDate: addDays(today, Math.max(1, interval || 1)),
lastReviewed: today,
lastResult: rating
};
}

function isDue(srs) {
if (!srs) return true;
if (!srs.dueDate) return true;
return srs.dueDate <= DB.todayStr();
}

function markMasteredIfNeeded(srs) {
if (!srs) return srs;
if ((srs.reviewCount || 0) >= 4) {
srs.status = "mastered";
}
return srs;
}

window.SRS = {
addDays,
freshSRS,
schedule,
isDue,
getStatusFromReviewCount,
markMasteredIfNeeded
};
