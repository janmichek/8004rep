export function ActivityGridLegend() {
  return (
    <div className="legend muted" aria-hidden="true">
      <span>Less</span>
      {['l0', 'l1', 'l2', 'l3', 'l4'].map((level) => (
        <span key={level} className={`cell ${level}`} />
      ))}
      <span>More</span>
    </div>
  );
}
