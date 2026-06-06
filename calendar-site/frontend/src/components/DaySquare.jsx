import './DaySquare.css';

function DaySquare({
  date,
  dayOfMonth,
  monthName,
  dayName,
  isWeekend,
  isMonthBoundary,
  isToday,
  isSelected,
  events = [],
  categories = [],
  onClick
}) {
  const handleClick = () => {
    if (onClick) onClick(date);
  };

  return (
    <div
      data-date={date}
      className={`day-square ${isWeekend ? 'weekend' : ''} ${isMonthBoundary ? 'month-boundary' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${events.length > 0 ? 'has-events' : ''}`}
      onClick={handleClick}
    >
      <div className="day-header">
        <span className="day-header-name">{dayName}</span>
        <span className="day-header-num">{dayOfMonth}</span>
        <span className="day-header-month">{monthName}</span>
      </div>
      {events.length > 0 && (
        <div className="day-events">
          {events.slice(0, 3).map(ev => {
            const cat = categories.find(c => c.id === ev.categoryId);
            const color = cat?.color || ev.color || '#6b7280';
            return (
              <div key={ev.id} className="day-event-row">
                <span className="day-event-dot" style={{ backgroundColor: color }} />
                <span className="day-event-title">{ev.title}</span>
              </div>
            );
          })}
          {events.length > 3 && (
            <div className="day-event-more">+{events.length - 3} more</div>
          )}
        </div>
      )}
    </div>
  );
}

export default DaySquare;
