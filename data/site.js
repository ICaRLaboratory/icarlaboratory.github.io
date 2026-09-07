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
    en: "Control algorithms built to be implemented — on embedded hardware and on robot manipulators.",
    ko: "구현 가능한 제어 알고리즘. 임베디드 하드웨어와 로봇 매니퓰레이터 위에서 검증합니다.",
  },
  intro: {
    en: "Our goal is control algorithms that can actually be implemented, not only proved. We develop stability analysis and controller synthesis for time-delay, sampled-data, networked and descriptor systems, and we target two applications: embedded platforms and robot manipulators. From there the work is extending from control into signal processing and AI.",
    ko: "실용 가능한 제어 알고리즘 연구를 목표로 합니다. 시간지연·표본데이터·네트워크·특이 시스템의 안정성 해석과 제어기 설계 이론을 개발하고, 이를 임베디드 시스템과 로봇 매니퓰레이터라는 두 응용에 적용합니다. 최근에는 제어에서 신호처리와 AI 쪽으로 영역을 넓히고 있습니다.",
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

  /* `role` is "core" | "app" | "next" -- it prints as the badge on the card.
     Keywords stay in English in both languages: they are search terms. */
  areas: [
    {
      key: "control",
      role: "core",
      label: { en: "Control Algorithms", ko: "제어 알고리즘" },
      blurb: {
        en: "The centre of the lab. Stability analysis and controller synthesis for time-delay, sampled-data, networked and descriptor systems — integral and summation inequalities, looped functionals, LMI conditions. We hold the results to a practical bar: the condition has to stay solvable and the gain has to survive a real board.",
        ko: "연구실의 중심입니다. 시간지연·표본데이터·네트워크·특이 시스템의 안정성 해석과 제어기 설계 — 적분·합 부등식, 루프드 함수, LMI 조건을 다룹니다. 결과는 실용성 기준으로 봅니다. 조건이 실제로 풀려야 하고, 이득이 실제 보드 위에서 버텨야 합니다.",
      },
      keywords: [
        "Time-delay systems",
        "Sampled-data control",
        "Linear matrix inequalities",
        "Robust control",
        "Networked control",
      ],
    },
    {
      key: "robotics",
      role: "app",
      label: { en: "Robot Manipulators", ko: "로봇 매니퓰레이터" },
      blurb: {
        en: "One of the two application targets. Adaptive sliding mode control for disturbed manipulators, time-delay estimation assisted by neural networks, and admittance-based force tracking — tested on real arms rather than in simulation alone.",
        ko: "두 응용 대상 중 하나입니다. 외란이 있는 매니퓰레이터를 위한 적응 슬라이딩 모드 제어, 신경망 기반 시간지연 추정, 어드미턴스 기반 힘 추종을 다루며, 시뮬레이션에 그치지 않고 실제 로봇에서 검증합니다.",
      },
      keywords: [
        "Adaptive sliding mode",
        "Time-delay estimation",
        "Force / admittance control",
        "Trajectory tracking",
        "Multi-agent systems",
      ],
    },
    {
      key: "embedded",
      role: "app",
      label: { en: "Embedded Systems", ko: "임베디드 시스템" },
      blurb: {
        en: "The other target, and the reason the theory has to stay implementable. Real-time execution under quantization, limited bandwidth and sampling jitter, plus on-device AI for manufacturing platforms.",
        ko: "또 하나의 응용 대상이자, 이론이 구현 가능해야 하는 이유입니다. 양자화와 제한된 대역폭, 샘플링 지터 아래에서의 실시간 구동, 그리고 제조 플랫폼을 위한 온디바이스 AI를 다룹니다.",
      },
      keywords: [
        "Real-time implementation",
        "Input quantization",
        "On-device AI",
        "Motor control",
        "Sensor interfacing",
      ],
    },
    {
      key: "spai",
      role: "next",
      label: { en: "Signal Processing & AI", ko: "신호처리 · AI" },
      blurb: {
        en: "Where the lab is heading. Learning-based estimation and classification placed alongside classical control — LSTM models on low-resolution sensors, reinforcement learning for mobile robot navigation, neural networks inside the loop rather than bolted onto it.",
        ko: "확장하고 있는 방향입니다. 고전 제어 위에 학습 기반 추정·분류를 얹습니다. 저해상도 센서 기반 LSTM 분류, 이동로봇 주행을 위한 강화학습, 그리고 루프 바깥이 아니라 루프 안에 들어가는 신경망을 봅니다.",
      },
      keywords: [
        "Neural network control",
        "Reinforcement learning",
        "Sensor fusion",
        "LSTM / sequence models",
        "Data-driven estimation",
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
    "Control theory",
    "Robust and networked control",
    "Linear matrix inequalities",
    "Robot manipulators",
    "Neural-network-based systems",
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
      role: "Staff Engineer",
      org:  { en: "Samsung Electronics", ko: "삼성전자" },
      note: "",
    },
  ],

  education: [
    {
      period: "2011.03 – 2018.02",
      degree: { en: "Ph.D.", ko: "박사" },
      org: "POSTECH",
      note: {
        en: "Dissertation: “Stability Analysis of Systems with Time-varying Delays via Slack Matrix Based Approaches” · Advisor: Prof. PooGyeon Park",
        ko: "학위논문: 「Stability Analysis of Systems with Time-varying Delays via Slack Matrix Based Approaches」 · 지도교수: 박부견",
      },
    },
    {
      period: "2007.03 – 2011.02",
      degree: { en: "B.S.", ko: "학사" },
      org: "POSTECH",
      note: { en: "Electrical Engineering", ko: "전자전기공학과" },
    },
  ],
};
