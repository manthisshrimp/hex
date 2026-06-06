export function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
}

export function deadlineLabel(nextDeadline) {
  const diff = daysBetween(getTodayStr(), nextDeadline);
  const abs = Math.abs(diff);
  if (diff < 0) return `Overdue: ${abs} day${abs !== 1 ? 's' : ''} ago`;
  if (diff === 0) return 'Due: Today';
  if (diff === 1) return 'Due: Tomorrow';
  return `Due: in ${diff} days`;
}

export function isOverdue(nextDeadline) {
  return daysBetween(getTodayStr(), nextDeadline) < 0;
}
