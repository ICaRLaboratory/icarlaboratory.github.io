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
    title: "The 6th Engineering in Biomedical and Rehabilitation & Home Conference",
    date: "June 2024",
    place: "Hotel Mystays Ochanomizu Conference Center, Tokyo, Japan",
    photos: [
      {
        src: "assets/img/gallery/ebrc-home-2024-1.jpg",
        alt: "Lab members holding the EBRC&HOME 2024 banner in Tokyo",
      },
      {
        src: "assets/img/gallery/ebrc-home-2024-2.jpg",
        alt: "A lab member outside Shimbashi Station in Tokyo during the conference",
      },
    ],
  },
  {
    title: "The 7th International Conference on ICT for Smart Health & Home",
    date: "December 2023",
    place: "Grand Tourane Hotel, Da Nang, Vietnam",
    photos: [
      {
        src: "assets/img/gallery/ict4shealth-2023-1.jpg",
        alt: "Lab members outside the ICT4sHealth&Home 2023 venue in Da Nang",
      },
      {
        src: "assets/img/gallery/ict4shealth-2023-2.jpg",
        alt: "Lab members at a night market in Da Nang during the conference",
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
      {
        src: "assets/img/gallery/cics-2022-2.jpg",
        alt: "Award recipients at the Information and Control Section general meeting",
      },
      {
        src: "assets/img/gallery/cics-2022-3.jpg",
        alt: "The Young Researcher Award certificate from the Information and Control Section",
      },
    ],
  },
];
