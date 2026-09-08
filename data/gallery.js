/* ---------------------------------------------------------------
   Photo albums, newest first.

   Drop web-sized JPEGs in assets/img/gallery/ and list them here.
   Keep them under about 300 KB each and strip the camera metadata
   first -- phone photos carry GPS coordinates.

   `titleKo` is optional; it prints under the English title for
   events whose official name is Korean.
   --------------------------------------------------------------- */

const GALLERY = [
  {
    title: "The 23rd IFAC World Congress",
    date: "August 2026",
    place: "Busan, Republic of Korea",
    photos: [
      {
        src: "assets/img/gallery/ifac-2026-1.jpg",
        alt: "Lab members at the IFAC 2026 World Congress sign in Busan",
      },
      {
        src: "assets/img/gallery/ifac-2026-2.jpg",
        alt: "Lab members at the IFAC 2026 photo wall",
      },
    ],
  },
  {
    title: "Conference on Information and Control Systems",
    titleKo: "2022년도 정보 및 제어 학술대회",
    date: "October 2022",
    place: "Alpensia Convention Center, Pyeongchang",
    photos: [
      {
        src: "assets/img/gallery/cics-2022-1.jpg",
        alt: "Lab members outside the conference venue in Pyeongchang",
      },
    ],
  },
];
