/* ---------------------------------------------------------------
   Lab-wide information: identity, contact, advisor profile,
   research areas.

   Bilingual values are written as { en: "...", ko: "..." }.
   A plain string is shown as-is in both languages.
   --------------------------------------------------------------- */

const SITE = {
  labShort: "ICaR",
  labName: {
    en: "Intelligent Control and Robotics Laboratory",
    ko: "지능제어 및 로보틱스 연구실",
  },
  tagline: {
    en: "Mathematical control theory, made to move real machines.",
    ko: "수학적 제어 이론으로 실제 기계를 움직입니다.",
  },
  intro: {
    en: "We develop advanced mathematical control theories and apply them to automation systems — networked control systems, multi-agent systems, sampled-data systems, and neural-network-based systems. Our applied work targets industrial robotics, with a strong emphasis on system modeling, robust control, and AI integration.",
    ko: "고도화된 수학적 제어 이론을 개발하고 이를 자동화 시스템 — 네트워크 제어 시스템, 다개체 시스템, 표본데이터 시스템, 신경망 기반 시스템 — 에 적용합니다. 응용 연구는 산업용 로보틱스를 향하며, 시스템 모델링과 강인 제어, AI 융합에 중점을 둡니다.",
  },
  department: {
    en: "Department of Artificial Intelligence and Information Technology",
    ko: "지능정보융합학과",
  },
  university: { en: "Sejong University", ko: "세종대학교" },
  since: 2019,

  contact: {
    office: { en: "Room 515, Daeyang AI Center", ko: "대양AI센터 515호" },
    address: {
      en: "209 Neungdong-ro, Gwangjin-gu, Seoul 05006, Republic of Korea",
      ko: "(05006) 서울시 광진구 능동로 209 세종대학교 대양AI센터 515호",
    },
    addressAlt: {
      ko: "209 Neungdong-ro, Gwangjin-gu, Seoul 05006, Republic of Korea",
      en: "(05006) 서울시 광진구 능동로 209 세종대학교 대양AI센터 515호",
    },
    email: "lsy@sejong.ac.kr",
    mapUrl: "https://maps.google.com/?q=Sejong+University+Daeyang+AI+Center",
  },

  areas: [
    {
      key: "control",
      image: "assets/img/area-control.jpg",
      label: { en: "Control Algorithms", ko: "제어 알고리즘" },
      blurb: {
        en: "Stability analysis and controller synthesis for time-delay, sampled-data, and descriptor systems. We build integral and summation inequalities, looped functionals, and LMI-based conditions that make conservative criteria sharp.",
        ko: "시간지연·표본데이터·특이 시스템에 대한 안정성 해석과 제어기 설계. 적분·합 부등식, 루프드 함수, LMI 기반 조건을 새로 만들어 보수적인 판별 조건을 날카롭게 다듬습니다.",
      },
      keywords: [
        { en: "Time-delay systems",        ko: "시간지연 시스템" },
        { en: "Sampled-data control",      ko: "표본데이터 제어" },
        { en: "Linear matrix inequalities", ko: "선형행렬부등식" },
        { en: "Robust control",            ko: "강인 제어" },
        { en: "Networked control",         ko: "네트워크 제어" },
      ],
    },
    {
      key: "robotics",
      image: "assets/img/area-robotics.jpg",
      label: { en: "Robotics", ko: "로보틱스" },
      blurb: {
        en: "Adaptive sliding mode control for disturbed manipulators, time-delay estimation assisted by neural networks, admittance-based force tracking, and reinforcement learning for mobile robot navigation.",
        ko: "외란이 있는 매니퓰레이터를 위한 적응 슬라이딩 모드 제어, 신경망 기반 시간지연 추정, 어드미턴스 기반 힘 추종, 그리고 이동로봇 주행을 위한 강화학습을 연구합니다.",
      },
      keywords: [
        { en: "Robot manipulators",        ko: "로봇 매니퓰레이터" },
        { en: "Adaptive sliding mode",     ko: "적응 슬라이딩 모드" },
        { en: "Force / admittance control", ko: "힘·어드미턴스 제어" },
        { en: "Reinforcement learning",    ko: "강화학습" },
        { en: "Multi-agent systems",       ko: "다개체 시스템" },
      ],
    },
    {
      key: "embedded",
      image: "assets/img/area-embedded.jpg",
      label: { en: "Embedded Systems", ko: "임베디드 시스템" },
      blurb: {
        en: "Getting theory onto hardware: real-time implementation under quantization, limited bandwidth, and sampling jitter — plus on-device AI for manufacturing platforms.",
        ko: "이론을 하드웨어로 옮기는 일. 양자화와 제한된 대역폭, 샘플링 지터 아래에서의 실시간 구현, 그리고 제조 플랫폼을 위한 온디바이스 AI를 다룹니다.",
      },
      keywords: [
        { en: "Real-time implementation", ko: "실시간 구현" },
        { en: "Input quantization",       ko: "입력 양자화" },
        { en: "On-device AI",             ko: "온디바이스 AI" },
        { en: "Sensor fusion",            ko: "센서 퓨전" },
        { en: "Motor control",            ko: "모터 제어" },
      ],
    },
  ],
};

const ADVISOR = {
  nameEn: "Seok Young Lee",
  nameKo: "이석영",
  title: { en: "Associate Professor", ko: "부교수" },
  affiliation: {
    en: "Department of Artificial Intelligence and Information Technology, Sejong University",
    ko: "세종대학교 지능정보융합학과",
  },
  email: "lsy@sejong.ac.kr",
  office: { en: "Room 515, Daeyang AI Center", ko: "대양AI센터 515호" },
  photo: "assets/img/advisor.jpg",
  orcid: "0000-0002-9071-4837",

  interests: [
    { en: "Control theory",                    ko: "제어 이론" },
    { en: "Robust and networked control systems", ko: "강인·네트워크 제어 시스템" },
    { en: "Applied mathematics via linear matrix inequalities", ko: "선형행렬부등식 기반 응용수학" },
    { en: "Robot manipulators",                ko: "로봇 매니퓰레이터" },
    { en: "Neural-network-based systems",      ko: "신경망 기반 시스템" },
  ],

  career: [
    {
      period: "2026.09 – present",
      role: { en: "Associate Professor", ko: "부교수" },
      org:  { en: "Sejong University", ko: "세종대학교" },
      note: { en: "Dept. of Artificial Intelligence and Information Technology", ko: "지능정보융합학과" },
    },
    {
      period: "2025.03 – 2026.08",
      role: { en: "Assistant Professor", ko: "조교수" },
      org:  { en: "Sejong University", ko: "세종대학교" },
      note: { en: "Dept. of Artificial Intelligence and Information Technology", ko: "지능정보융합학과" },
    },
    {
      period: "2019.09 – 2025.02",
      role: { en: "Assistant Professor", ko: "조교수" },
      org:  { en: "Soonchunhyang University", ko: "순천향대학교" },
      note: "",
    },
    {
      period: "2018.03 – 2019.08",
      role: { en: "Staff Engineer", ko: "책임연구원" },
      org:  { en: "Samsung Electronics", ko: "삼성전자" },
      note: "",
    },
  ],

  education: [
    {
      period: "2011.03 – 2018.02",
      degree: { en: "Ph.D.", ko: "박사" },
      org: { en: "POSTECH", ko: "포항공과대학교" },
      note: {
        en: "Dissertation: “Stability Analysis of Systems with Time-varying Delays via Slack Matrix Based Approaches” · Advisor: Prof. PooGyeon Park",
        ko: "학위논문: 「Stability Analysis of Systems with Time-varying Delays via Slack Matrix Based Approaches」 · 지도교수: 박부견",
      },
    },
    {
      period: "2007.03 – 2011.02",
      degree: { en: "B.S.", ko: "학사" },
      org: { en: "POSTECH", ko: "포항공과대학교" },
      note: { en: "Electrical Engineering", ko: "전자전기공학과" },
    },
  ],
};
