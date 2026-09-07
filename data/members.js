/* ---------------------------------------------------------------
   Lab members.

   `photo` is optional -- leave it out and the card shows a
   generated monogram instead. Drop files in assets/img/.
   Emails use " at " instead of "@" to slow down scrapers.
   --------------------------------------------------------------- */

const DEG = {
  phd:   { en: "Ph.D. Candidate", ko: "박사과정" },
  ms:    { en: "M.S. Candidate",  ko: "석사과정" },
  msDone:{ en: "M.S.",            ko: "석사" },
  ug:    { en: "Undergraduate Researcher", ko: "학부 연구생" },
};

/* kept in English in both languages -- these read as keywords, not prose */
const TOPIC = {
  robotics: "Robotics",
  control:  "Control Theory",
};

const GRAD_STUDENTS = [
  {
    nameEn: "Jin Woong Lee",
    nameKo: "이진웅",
    photo: "assets/img/jinwoong-lee.jpg",
    degree: DEG.phd,
    role: { en: "Lab Manager", ko: "연구실장" },
    email: "jinwoonggg at sju.ac.kr",
    interests: [TOPIC.robotics, TOPIC.control],
  },
  {
    nameEn: "Jae Min Rho",
    nameKo: "노재민",
    photo: "assets/img/jaemin-rho.jpg",
    degree: DEG.ms,
    role: "",
    email: "rohjamin at sju.ac.kr",
    interests: [TOPIC.robotics, TOPIC.control],
  },
  {
    nameEn: "Soon Jin Park",
    nameKo: "박순진",
    photo: "assets/img/soonjin-park.jpg",
    degree: DEG.ms,
    role: "",
    email: "parksungene at sju.ac.kr",
    interests: [TOPIC.robotics, TOPIC.control],
  },
];

const UNDERGRAD_STUDENTS = [
  /* Add undergraduate researchers here, same shape as above:
     { nameEn: "Gil Dong Hong", nameKo: "홍길동", degree: DEG.ug, interests: [TOPIC.control] },
  */
];

const ALUMNI = [
  {
    nameEn: "Dong Hee Seo",
    nameKo: "서동희",
    degree: DEG.msDone,
    graduated: "2025.02",
    interests: [TOPIC.robotics, TOPIC.control],
    now: "",
  },
  {
    nameEn: "Hyuk Mo An",
    nameKo: "안혁모",
    degree: DEG.msDone,
    graduated: "2025.02",
    interests: [TOPIC.robotics, TOPIC.control],
    now: "",
  },
];
