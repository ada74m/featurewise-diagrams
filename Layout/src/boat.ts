// A feature drawn as a toy boat seen from below: a slim hull with a rounded point at the bow and a square,
// round-cornered stern, and the feature's name along it, reading from stern to bow. Links leave from the
// bow and arrive at the stern. The shape is Adam's toy-boat drawing, with its proportions kept: the bow
// curve and the stern's corners scale with the beam, and the straight sides stretch to fit the name.

export const BEAM = 34;
export const FONT_SIZE = BEAM * 0.36;

// Room left in the hull beyond the name: behind it at the stern, and ahead of it into the bow.
const STERN_ROOM = 0.35 * BEAM;
const BOW_ROOM = 0.8 * BEAM;

// The width of a name in bold Helvetica at the given size, estimated from rough character widths, so that
// the browser and the command line lay out the same boats.
export function textWidth(text: string, fontSize = FONT_SIZE): number {
  let em = 0;
  for (const ch of text) {
    if ("iljt.,'!|".includes(ch)) em += 0.3;
    else if ("frI".includes(ch)) em += 0.4;
    else if ("mwMW".includes(ch)) em += 0.9;
    else if (ch >= "A" && ch <= "Z") em += 0.72;
    else em += 0.6;
  }
  return em * fontSize;
}

export function boatLength(name: string): number {
  return Math.max(textWidth(name) + STERN_ROOM + BOW_ROOM, 3 * BEAM);
}

// Where the name's centre sits along the hull, from the hull's centre, towards the bow.
export function textOffset(boatLength_: number, name: string): number {
  const start = -boatLength_ / 2 + STERN_ROOM;
  return start + textWidth(name) / 2;
}

// The hull's outline, with its centre at the origin and its bow pointing along the positive x axis.
export function hullPath(length: number, beam = BEAM): string {
  const h = beam / 2;
  const bow = length / 2;
  const stern = -length / 2;
  const shoulder = bow - 1.2 * beam;
  const quarter = stern + 0.18 * beam;
  const f = (n: number) => n.toFixed(2);
  return [
    `M ${f(bow)} 0`,
    `C ${f(bow)} ${f(0.19 * h)}, ${f(bow - 0.47 * beam)} ${f(h)}, ${f(shoulder)} ${f(h)}`,
    `L ${f(quarter)} ${f(0.84 * h)}`,
    `C ${f(stern + 0.07 * beam)} ${f(0.82 * h)}, ${f(stern)} ${f(0.52 * h)}, ${f(stern)} 0`,
    `C ${f(stern)} ${f(-0.52 * h)}, ${f(stern + 0.07 * beam)} ${f(-0.82 * h)}, ${f(quarter)} ${f(-0.84 * h)}`,
    `L ${f(shoulder)} ${f(-h)}`,
    `C ${f(bow - 0.47 * beam)} ${f(-h)}, ${f(bow)} ${f(-0.19 * h)}, ${f(bow)} 0`,
    "Z"
  ].join(" ");
}
