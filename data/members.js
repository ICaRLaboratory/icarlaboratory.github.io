/* ---------------------------------------------------------------
   Lab members.

   `cv` is optional: a PDF path or URL enables the CV link; omit it for a disabled button.
   `photo` is optional -- leave it out and the card shows a
   generated monogram instead. Drop files in assets/img/.
   `nameEn` / `nameKo` follow the selected language; a missing Korean name falls back to English.
   `scholar` and `orcid` are optional; each prints as a link on the card.
   ORCIDs came from the authors' own records on their papers (via Crossref).
   Emails use " at " instead of "@" to slow down scrapers.
   --------------------------------------------------------------- */

const DEG = {
  phd:    { en: "Ph.D. Candidate", ko: "박사과정" },
  ms:     { en: "M.S. Candidate", ko: "석사과정" },
  msDone: { en: "M.S.", ko: "석사" },
  ug:     { en: "Undergraduate Researcher", ko: "학부연구생" },
};

const TOPIC = {
  robotics: "Robotics",
  control:  "Control Theory",
};

const GRAD_STUDENTS = [
  {
    nameEn: "Jin Woong Lee",
    nameKo: "이진웅",
    scholar: "https://scholar.google.com/citations?user=CdS5ZDsAAAAJ",
    orcid: "0009-0008-5503-241X",
    photo: "assets/img/jinwoong-lee.jpg",
    cv: "https://woongpigy.github.io/jinwoong-lee/index.html",
    degree: DEG.phd,
    role: { en: "Lab Manager", ko: "연구실 매니저" },
    email: "jinwoonggg at sju.ac.kr",
    interests: [TOPIC.robotics, TOPIC.control],
  },
  {
    nameEn: "Jae Min Rho",
    nameKo: "노재민",
    scholar: "https://scholar.google.com/citations?user=XMcAejEAAAAJ",
    orcid: "0009-0002-3284-338X",
    photo: "assets/img/jaemin-rho.jpg",
    degree: DEG.ms,
    role: "",
    email: "rohjamin at sju.ac.kr",
    interests: [TOPIC.robotics, TOPIC.control],
  },
  {
    nameEn: "Sun Gene Park",
    nameKo: "박순진",
    scholar: "https://scholar.google.com/citations?user=fUIa0hIAAAAJ",
    orcid: "0009-0000-5533-0259",
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
    orcid: "0009-0002-3701-7431",
    scholar: "https://scholar.google.com/citations?user=sm2n5yoAAAAJ",
    degree: DEG.msDone,
    graduated: "2025.02",
    interests: [TOPIC.robotics, TOPIC.control],
    now: "",
  },
  {
    nameEn: "Hyuk Mo An",
    nameKo: "안혁모",
    orcid: "0009-0001-3644-9235",
    scholar: "https://scholar.google.com/citations?user=glYKbbUAAAAJ",
    degree: DEG.msDone,
    graduated: "2025.02",
    interests: [TOPIC.robotics, TOPIC.control],
    now: "",
  },
];
