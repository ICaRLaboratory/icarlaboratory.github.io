/* ===============================================================
   Language.

   Anywhere a value can differ between languages, write it as
       { en: "...", ko: "..." }
   A plain string is used as-is in both languages -- which is what
   we want for names, journal titles, citations, and the technical
   keywords, since those are read in English either way.

   COPY holds the fixed page text; the HTML pulls it in through
   data-t="key" attributes.
   =============================================================== */

const LANGS = ["en", "ko"];

const COPY = {
  /* ---- navigation & chrome ---- */
  "nav.home":         { en: "Home",         ko: "홈" },
  "nav.research":     { en: "Research",     ko: "연구" },
  "nav.members":      { en: "Members",      ko: "구성원" },
  "nav.publications": { en: "Publications", ko: "논문" },
  "nav.lecture":      { en: "Lecture",      ko: "강의" },

  "footer.navigate": { en: "Navigate",     ko: "바로가기" },
  "footer.find":     { en: "Find us",      ko: "찾아오는 길" },
  "footer.maps":     { en: "Open in Maps", ko: "지도에서 보기" },
  "footer.est":      { en: "Est.",         ko: "설립" },
  "footer.blurb": {
    en: "Intelligent Control and Robotics Laboratory, Department of Artificial Intelligence and Information Technology, Sejong University.",
    ko: "세종대학교 지능정보융합학과 지능제어 및 로보틱스 연구실.",
  },

  /* ---- home ---- */
  "hero.eyebrow": { en: "Sejong University &middot; est. 2019", ko: "세종대학교 &middot; 2019년 설립" },
  "hero.title":   { en: "Intelligent Control<br>and Robotics<br>Laboratory",
                    ko: "지능제어 및<br>로보틱스 연구실" },
  "hero.caption": { en: "One damped system, three views of the same loop",
                    ko: "하나의 감쇠 시스템, 세 가지 관점" },
  "hero.cta1":    { en: "Explore the research", ko: "연구 살펴보기" },
  "hero.cta2":    { en: "Meet the lab",         ko: "구성원 보기" },
  "hero.city":    { en: "Seoul, Korea",         ko: "서울" },

  /* drawn inside the hero figure by assets/hero.js */
  "fig.control":  { en: "CONTROL ALGORITHMS", ko: "제어 알고리즘" },
  "fig.robotics": { en: "ROBOTICS",           ko: "로보틱스" },
  "fig.embedded": { en: "EMBEDDED SYSTEMS",   ko: "임베디드 시스템" },

  "lab.eyebrow": { en: "The laboratory", ko: "연구실 소개" },
  "lab.title":   { en: "Control algorithms,<br>built to be implemented.",
                   ko: "구현 가능한<br>제어 알고리즘." },

  "stat.journal":    { en: "Journal articles",   ko: "학술지 논문" },
  "stat.conference": { en: "Conference papers",  ko: "학술대회 논문" },
  "stat.projects":   { en: "Funded projects",    ko: "연구 과제" },
  "stat.members":    { en: "Lab members",        ko: "연구실 인원" },

  "areas.eyebrow": { en: "Research", ko: "연구 분야" },
  "areas.title":   { en: "Three fields,<br>one loop.",
                     ko: "세 개의 분야,<br>하나의 루프." },
  "areas.lede": {
    en: "Control algorithms are the centre of gravity, and the standard we hold them to is that they can be implemented, not only proved. Robotics and embedded systems are where that work lands — and where the hard problems come back from. All three are extending from control into signal processing and AI.",
    ko: "제어 알고리즘이 무게중심이고, 증명에 그치지 않고 구현까지 되는지를 기준으로 삼습니다. 로보틱스와 임베디드 시스템은 그 결과가 도달하는 곳이자, 어려운 문제가 되돌아오는 곳입니다. 세 분야 모두 제어에서 신호처리와 AI로 영역을 넓히고 있습니다.",
  },

  "recent.eyebrow": { en: "Selected work",       ko: "최근 성과" },
  "recent.title":   { en: "Recent publications", ko: "최근 논문" },
  "recent.all":     { en: "See all",             ko: "전체 보기" },

  "join.eyebrow": { en: "Join the lab", ko: "연구실 지원" },
  "join.title":   { en: "Comfortable with proofs<br>and with a screwdriver?",
                    ko: "함께 연구할<br>학생을 찾습니다." },
  "join.lede": {
    en: "We host graduate and undergraduate researchers working on control theory, robot manipulators, and embedded implementation. Send a short note about what you would like to work on — prior coursework in linear systems or a track record of building things both count.",
    ko: "제어 이론, 로봇 매니퓰레이터, 임베디드 구현에 관심 있는 대학원생과 학부 연구생을 모집합니다. 어떤 주제를 해보고 싶은지 간단히 적어 메일 주시면 됩니다. 선형시스템·제어공학 수강 경험, 또는 직접 무언가 만들어 본 경험이 있으면 좋습니다.",
  },
  "join.cta1": { en: "Email the advisor", ko: "지도교수에게 메일" },
  "join.cta2": { en: "Find the office",   ko: "연구실 위치" },

  "label.office":  { en: "Office",  ko: "연구실" },
  "label.address": { en: "Address", ko: "주소" },
  "label.email":   { en: "Email",   ko: "이메일" },

  /* ---- research ---- */
  "research.eyebrow": { en: "Research", ko: "연구" },
  "research.title": {
    en: "From an inequality on paper<br>to a manipulator that holds its line.",
    ko: "이론에서 구현까지.",
  },
  "research.lede": {
    en: "We develop stability analysis and controller synthesis for time-delay, sampled-data, networked and descriptor systems, and we hold that work to a practical bar: the condition has to be solvable and the controller has to run on the target board. Robotics and embedded systems are where it gets tested and where the next problem usually comes from.",
    ko: "시간지연·표본데이터·네트워크·특이 시스템의 안정성 해석과 제어기 설계를 연구하되, 실용성을 기준으로 잡습니다. 조건이 실제로 풀려야 하고, 제어기가 목표 보드 위에서 돌아가야 합니다. 로보틱스와 임베디드 시스템은 그것이 검증되는 자리이자, 다음 문제가 나오는 자리입니다.",
  },
  "projects.eyebrow":   { en: "Funded projects", ko: "연구 과제" },
  "projects.title":     { en: "Where the funding goes.", ko: "수행 과제." },
  "projects.ongoing":   { en: "Ongoing",   ko: "진행 중" },
  "projects.completed": { en: "Completed", ko: "완료" },

  /* ---- members ---- */
  "members.eyebrow":   { en: "Members", ko: "구성원" },
  "members.title":     { en: "The people running the loop.", ko: "연구실 구성원." },
  "members.grad":      { en: "Graduate students",         ko: "대학원생" },
  "members.undergrad": { en: "Undergraduate researchers", ko: "학부 연구생" },
  "members.alumni":    { en: "Alumni",                    ko: "졸업생" },
  "members.appointments": { en: "Appointments", ko: "경력" },
  "members.education":    { en: "Education",    ko: "학력" },
  "members.graduated":    { en: "Graduated",    ko: "졸업" },

  /* ---- publications ---- */
  "pubs.eyebrow": { en: "Publications", ko: "논문" },
  "pubs.title":   { en: "Peer-reviewed work,<br>newest first.", ko: "발표 논문, 최신순." },
  "pubs.journal":    { en: "Journal",    ko: "학술지" },
  "pubs.conference": { en: "Conference", ko: "학술대회" },
  "pubs.all":        { en: "All",        ko: "전체" },

  /* ---- lecture ---- */
  "lecture.eyebrow": { en: "Lecture",        ko: "강의" },
  "lecture.title":   { en: "Courses taught.", ko: "담당 강의." },
  "lecture.spring":  { en: "Spring semester", ko: "1학기" },
  "lecture.fall":    { en: "Fall semester",   ko: "2학기" },
  "lecture.past":    { en: "Previously taught &middot; 2019&ndash;2024",
                       ko: "이전 강의 &middot; 2019&ndash;2024" },
};
