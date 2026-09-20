/** Remote Unsplash imagery for the Neurotech Events prototype. */
const unsplash = (photoId: string, width = 1200, height?: number) => {
  const params = new URLSearchParams({
    auto: "format",
    fit: "crop",
    w: String(width),
    q: "80",
  });
  if (height) params.set("h", String(height));
  return `https://images.unsplash.com/${photoId}?${params.toString()}`;
};

export const MEDIA = {
  cover: unsplash("photo-1540575467063-178a50c2df87", 1600, 1000),
  venue: unsplash("photo-1497366216548-37526070297c", 1200, 800),
  poster: unsplash("photo-1505373877841-8d25f7d46678", 900, 1200),
  certificate: unsplash("photo-1586281380349-632531db7ed4", 1400, 1000),
  events: [
    unsplash("photo-1540575467063-178a50c2df87", 1200, 800),
    unsplash("photo-1505373877841-8d25f7d46678", 1200, 800),
    unsplash("photo-1475721027785-f74eccf877e2", 1200, 800),
    unsplash("photo-1511578314322-379afb476865", 1200, 800),
    unsplash("photo-1591115765373-5207764f72e7", 1200, 800),
    unsplash("photo-1556761175-5973dc0f32e7", 1200, 800),
  ],
  scenes: [
    unsplash("photo-1544531586-fde5298cdd40", 1000, 800),
    unsplash("photo-1532094349884-543bc11b234d", 1000, 800),
    unsplash("photo-1528605105345-5344ea20e269", 1000, 800),
    unsplash("photo-1581091226825-a6a2a5aee158", 1000, 800),
  ],
  speakers: [
    unsplash("photo-1573496359142-b8d87734a5a2", 800, 1000),
    unsplash("photo-1560250097-0b93528c311a", 800, 1000),
    unsplash("photo-1580489944761-15a19d654956", 800, 1000),
    unsplash("photo-1507003211169-0a1dd7228f2d", 800, 1000),
    unsplash("photo-1573497019940-1c28c88b4f3e", 800, 1000),
    unsplash("photo-1472099645785-5658abf4ff4e", 800, 1000),
    unsplash("photo-1438761681033-6461ffad8d80", 800, 1000),
    unsplash("photo-1500648767791-00dcc994a43e", 800, 1000),
  ],
  sponsors: [
    unsplash("photo-1451187580459-43490279c0fa", 800, 400),
    unsplash("photo-1486406146926-c627a92ad1ab", 800, 400),
    unsplash("photo-1497366754035-f200968a6e72", 800, 400),
    unsplash("photo-1460925895917-afdab827c52f", 800, 400),
    unsplash("photo-1557804506-669a67965ba0", 800, 400),
    unsplash("photo-1559136555-9303baea8ebd", 800, 400),
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
