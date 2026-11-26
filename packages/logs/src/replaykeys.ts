// Strings that are keys, not only text (backlog after round 13 point 5): the replay's reasons for knowing nothing of a
// logged hit or cast (BuffReplay.landing, statusLanding, castFacts `unknown`) and the one-sided landings' contexts
// (onesided.ts). A log-only hit's context is `no landing: <reason>`, the totals' kinds group by context, and the
// snapshots' share keys and measure's hold-out kind table carry the kinds: changing one of these texts moves every
// snapshot's kinds without a verdict moving (round 12 nearly did, putting the replay's drop reasons into
// "a landing the replay didn't land"). A view adds its detail beside them (BuffReplay.droppedLanding: NOLAND's text),
// never into them; a new reason or context is a new key (snapshots:update shows it).

/** Why the replay has no landing (or no facts) for a logged hit or cast: BuffReplay's `unknown`, a one-sided context's tail. */
export const NO_LANDING = {
  noKit: "no kit to replay",
  afterStop: "after the replay stopped",
  notPlaced: "a hit the placement doesn't place",
  noOrder: "a landing whose order the kit doesn't give",
  notLanded: "a landing the replay didn't land",
  noStatus: "a status the replay didn't deal near the logged hit",
  notMade: "a cast the replay doesn't make",
  couldNotMake: "a cast the replay couldn't make",
  notReached: "a cast the replay didn't reach",
} as const;

/** Where a one-sided landing sits (OneSided.context; a log-only hit without a landing: `no landing: ` + a NO_LANDING reason). */
export const ONE_SIDED = {
  unread: "unread",
  teammate: "landing a teammate's hit's",
  twinLike: "twin like",
  twinOther: "twin other",
  noCast: "no cast",
  castUnlogged: "cast unlogged",
  castTail: "cast tail",
  castHead: "cast head",
  castGap: "cast gap",
  noLandingPrefix: "no landing: ",
} as const;
