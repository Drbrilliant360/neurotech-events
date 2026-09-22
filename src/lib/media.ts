/**
 * Remote Unsplash imagery for the Neurotech Events prototype.
 *
 * Every photo is African-themed and was reviewed visually before being added: Tanzanian
 * cityscapes and landscapes, African conference and lab scenes, and portraits of African
 * professionals matched to the demo speakers' names. Images are hotlinked from the Unsplash
 * CDN under the Unsplash License (free to use, attribution appreciated, not required).
 * Only the `images.unsplash.com` host is used; see `unsplash()` below.
 */
const unsplash = (photoId: string, width = 1200, height?: number, crop?: "faces") => {
  const params = new URLSearchParams({
    auto: "format",
    fit: "crop",
    w: String(width),
    q: "80",
  });
  if (height) params.set("h", String(height));
  if (crop) params.set("crop", crop);
  return `https://images.unsplash.com/${photoId}?${params.toString()}`;
};

export const MEDIA = {
  /** Keynote speaker on stage before a seated audience. */
  cover: unsplash("photo-1679579664878-2c025e3f87b0", 1600, 1000),
  /** Dar es Salaam skyline and harbour. */
  venue: unsplash("photo-1674334264912-704cb2a24b37", 1200, 800),
  /** Performer with a microphone against a wax-print backdrop. */
  poster: unsplash("photo-1612295673708-6faf3b14f0eb", 900, 1200),
  /** Mount Kilimanjaro above the Tanzanian savanna. */
  certificate: unsplash("photo-1489392191049-fc10c97e64b6", 1400, 1000),
  events: [
    /** Summit: delegates seated in a conference hall. */
    unsplash("photo-1644174547761-de211415598e", 1200, 800),
    /** Workshop: engineers reviewing code together at a monitor. */
    unsplash("photo-1531482615713-2afd69097998", 1200, 800),
    /** Healthcare conference: clinician presenting X-rays to an audience. */
    unsplash("photo-1631563019701-efcf403bc5fe", 1200, 800),
    /** Clinical forum: professionals around a boardroom table. */
    unsplash("photo-1573164574572-cb89e39749b4", 1200, 800),
    /** Bootcamp: students with laptops on outdoor steps. */
    unsplash("photo-1655720348590-c739c860beed", 1200, 800),
    /** Zanzibar: aerial view of the Indian Ocean coastline. */
    unsplash("photo-1601635494462-029deeeadcd7", 1200, 800),
  ],
  scenes: [
    /** Keynote stage: speaker addressing the room from a podium (face-aware crop). */
    unsplash("photo-1744973149714-46786187c6aa", 1000, 800, "faces"),
    /** Research showcase: scientist running a bench experiment. */
    unsplash("photo-1569830904560-2afd7062213c", 1000, 800),
    /** Networking lounge: attendees talking over a laptop. */
    unsplash("photo-1655720357872-ce227e4164ba", 1000, 800),
    /** BCI workshop: pair programming at a laptop. */
    unsplash("photo-1637856794303-d864ce316444", 1000, 800),
  ],
  /** Portraits ordered to match the demo speaker roster (woman, man, woman, man, ...). */
  speakers: [
    unsplash("photo-1573497491207-618cc224f243", 800, 1000),
    unsplash("photo-1614023342667-6f060e9d1e04", 800, 1000),
    unsplash("photo-1573496527892-904f897eb744", 800, 1000),
    unsplash("photo-1660742533971-eb413acbfb47", 800, 1000),
    unsplash("photo-1531123897727-8f129e1688ce", 800, 1000),
    unsplash("photo-1642257859842-c95f9fa8121d", 800, 1000),
    unsplash("photo-1573497160825-0d94a2724d40", 800, 1000),
    unsplash("photo-1595211877493-41a4e5f236b3", 800, 1000),
  ],
  /** Backdrops for the demo sponsor tiles: Dar es Salaam, education, business, tech, textiles, health. */
  sponsors: [
    unsplash("photo-1589177900326-900782f88a55", 800, 400),
    unsplash("photo-1632215861513-130b66fe97f4", 800, 400),
    unsplash("photo-1588445052169-0efa7a478788", 800, 400),
    unsplash("photo-1573164713988-8665fc963095", 800, 400),
    unsplash("photo-1768212565424-efa3a3852b81", 800, 400),
    unsplash("photo-1650295894392-7fea9aa5a5a1", 800, 400),
  ],
} as const;

export function eventImage(index: number) {
  return MEDIA.events[index % MEDIA.events.length];
}

export function sceneImage(index: number) {
  return MEDIA.scenes[index % MEDIA.scenes.length];
}

export function speakerImage(index: number) {
  return MEDIA.speakers[index % MEDIA.speakers.length];
}

export function speakerImageById(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash + id.charCodeAt(i) * (i + 1)) % MEDIA.speakers.length;
  return MEDIA.speakers[hash];
}
