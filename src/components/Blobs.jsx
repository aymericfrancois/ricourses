export default function Blobs() {
  const cfg = [
    { c: 'oklch(0.85 0.14 270 / 0.55)', x: '78%', y: '10%', s: 340 },
    { c: 'oklch(0.88 0.12 210 / 0.55)', x: '8%', y: '30%', s: 280 },
    { c: 'oklch(0.9 0.1 180 / 0.45)', x: '45%', y: '85%', s: 320 },
  ];
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {cfg.map((b, i) => (
        <div key={i} className="blob"
          style={{ background: b.c, left: b.x, top: b.y, width: b.s, height: b.s, animationDelay: `${i * -6}s` }} />
      ))}
    </div>
  );
}
