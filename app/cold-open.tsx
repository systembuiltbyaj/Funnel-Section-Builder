/**
 * Cold-open title sequence.
 *
 * A server component holding markup only — every movement is CSS (see the
 * `.co` block in app/globals.css). Zero JavaScript is deliberate: the sequence
 * renders server-side and always ends via animation-fill-mode: forwards, so a
 * hydration failure can never strand someone behind a black screen.
 *
 * It lives in the root layout, which the App Router keeps mounted across
 * client-side navigation. That is what makes this play on full page load only
 * and never replay on a route change — no sessionStorage needed.
 */
export function ColdOpen() {
  return (
    <div className="co" aria-hidden="true">
      <div className="co__wire co__wire--1" />
      <div className="co__wire co__wire--2" />
      <div className="co__wire co__wire--3" />
      <div className="co__hair" />

      <div className="co__stack">
        <p className="co__kicker">SYSTEM BUILD</p>

        {/* The two children below share one grid cell. Do not reorder or
            restructure them without reading the re-centring comment in
            globals.css — the obvious simplification breaks the effect. */}
        <span className="co__name">
          <span className="co__ghost">ALLEN BACTAD</span>
          <span className="co__clip">
            <span className="co__text">ALLEN BACTAD</span>
            <span className="co__caret" />
          </span>
        </span>
      </div>
    </div>
  );
}
