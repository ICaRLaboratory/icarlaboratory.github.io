/* ===============================================================
   Language.

   Anywhere a value can differ between languages, write it as
       { en: "...", ko: "..." }
   A plain string is used as-is in both languages, which is what
   you want for names, journal titles and citations.

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
    ko: "세종대학교 인공지능·정보기술학과 지능제어 및 로보틱스 연구실.",
  },

  /* ---- home ---- */
  "hero.eyebrow": { en: "Intelligent Control &amp; Robotics Lab", ko: "지능제어 및 로보틱스 연구실" },
  "hero.title":   { en: "Control theory that <em>converges</em>.", ko: "제어 이론은 결국 <em>수렴</em>한다." },
  "hero.caption": { en: "One damped system &mdash; three views of the same loop",
                    ko: "하나의 감쇠 시스템 — 같은 루프를 보는 세 가지 시선" },
  "hero.cta1":    { en: "Explore the research", ko: "연구 살펴보기" },
  "hero.cta2":    { en: "Meet the lab",         ko: "구성원 보기" },
  "hero.city":    { en: "Seoul, Korea",         ko: "서울" },

  /* labels drawn inside the hero figure (assets/hero.js) */
  "fig.control":  { en: "CONTROL ALGORITHMS", ko: "제어 알고리즘" },
  "fig.robotics": { en: "ROBOTICS",           ko: "로보틱스" },
  "fig.embedded": { en: "EMBEDDED SYSTEMS",   ko: "임베디드 시스템" },

  "lab.eyebrow": { en: "The laboratory", ko: "연구실 소개" },
  "lab.title":   { en: "A theory group<br>that ships to hardware.",
                   ko: "이론을 하드웨어까지<br>끌고 가는 연구실." },

  "stat.journal":    { en: "Journal articles",   ko: "저널 논문" },
  "stat.conference": { en: "Conference papers",  ko: "학회 논문" },
  "stat.projects":   { en: "Funded projects",    ko: "연구 과제" },
  "stat.members":    { en: "Lab members",        ko: "연구실 인원" },

  "areas.eyebrow": { en: "Research", ko: "연구 분야" },
  "areas.title":   { en: "Three pillars,<br>one loop.", ko: "세 개의 축,<br>하나의 루프." },
  "areas.lede": {
    en: "Theory sharpens the stability criterion; the criterion becomes a controller; the controller runs on a real manipulator. Whatever breaks there sets up the next theorem.",
    ko: "이론이 안정성 판별 조건을 다듬고, 그 조건은 제어기가 되고, 제어기는 실제 매니퓰레이터 위에서 돕니다. 거기서 드러난 한계가 다음 정리의 출발점이 됩니다.",
  },

  "recent.eyebrow": { en: "Selected work",       ko: "최근 성과" },
  "recent.title":   { en: "Recent publications", ko: "최근 논문" },
  "recent.all":     { en: "See all",             ko: "전체 보기" },

  "join.eyebrow": { en: "Join the lab", ko: "연구실 지원" },
  "join.title":   { en: "Comfortable with proofs<br>and with a screwdriver?",
                    ko: "증명도, 드라이버도<br>익숙하신가요?" },
  "join.lede": {
    en: "We host graduate and undergraduate researchers working on control theory, robot manipulators, and embedded implementation. Send a short note about what you would like to work on — prior coursework in linear systems or a track record of building things both count.",
    ko: "제어 이론, 로봇 매니퓰레이터, 임베디드 구현을 함께할 대학원생과 학부 연구생을 모집합니다. 어떤 주제를 해보고 싶은지 짧게 적어 메일 주세요. 선형시스템 수강 경험도, 직접 만들어 본 이력도 모두 좋습니다.",
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
    ko: "종이 위의 부등식에서<br>흔들리지 않는 매니퓰레이터까지.",
  },
  "research.lede": {
    en: "Our work develops mathematical control theories and applies them to automation systems — robotics, networked control systems, and AI-based systems — with a strong emphasis on system modeling and control for industrial robots.",
    ko: "수학적 제어 이론을 개발하고 이를 자동화 시스템 — 로보틱스, 네트워크 제어 시스템, AI 기반 시스템 — 에 적용합니다. 특히 산업용 로봇의 시스템 모델링과 제어에 중점을 둡니다.",
  },
  "projects.eyebrow":   { en: "Funded projects",       ko: "연구 과제" },
  "projects.title":     { en: "Where the funding goes.", ko: "수행 중인 과제." },
  "projects.ongoing":   { en: "Ongoing",   ko: "진행 중" },
  "projects.completed": { en: "Completed", ko: "완료" },

  /* ---- members ---- */
  "members.eyebrow":   { en: "Members", ko: "구성원" },
  "members.title":     { en: "The people running the loop.", ko: "루프를 돌리는 사람들." },
  "members.grad":      { en: "Graduate students",         ko: "대학원생" },
  "members.undergrad": { en: "Undergraduate researchers", ko: "학부 연구생" },
  "members.alumni":    { en: "Alumni",                    ko: "졸업생" },
  "members.appointments": { en: "Appointments", ko: "재직 이력" },
  "members.education":    { en: "Education",    ko: "학력" },
  "members.graduated":    { en: "Graduated",    ko: "졸업" },

  /* ---- publications ---- */
  "pubs.eyebrow": { en: "Publications", ko: "논문" },
  "pubs.title":   { en: "Peer-reviewed work,<br>newest first.",
                    ko: "동료 심사를 거친 논문,<br>최신순." },
  "pubs.journal":    { en: "Journal",    ko: "저널" },
  "pubs.conference": { en: "Conference", ko: "학회" },
  "pubs.all":        { en: "All",        ko: "전체" },

  /* ---- lecture ---- */
  "lecture.eyebrow": { en: "Lecture",        ko: "강의" },
  "lecture.title":   { en: "Courses taught.", ko: "담당 강의." },
  "lecture.spring":  { en: "Spring semester", ko: "1학기" },
  "lecture.fall":    { en: "Fall semester",   ko: "2학기" },
  "lecture.past":    { en: "Previously taught &middot; 2019&ndash;2024",
                       ko: "이전 강의 &middot; 2019&ndash;2024" },
};
