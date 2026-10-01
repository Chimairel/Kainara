/** Application schedule presentation is independent of the server time zone. */
export function formatApplicationTime(value: string | Date) {
  return (
    new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(value)) + ' Philippine time (UTC+8)'
  );
}
