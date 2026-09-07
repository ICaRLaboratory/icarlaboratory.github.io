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
    en: "Control algorithms built to be implemented — worked through in robotics and on embedded hardware.",
    ko: "구현 가능한 제어 알고리즘. 로보틱스와 임베디드 시스템에서 끝까지 밀어붙입니다.",
  },
  intro: {
    en: "Our goal is control algorithms that can actually be implemented, not only proved. We develop stability analysis and controller synthesis for time-delay, sampled-data, networked and descriptor systems, and we carry that work through in robotics and embedded systems — manipulators, mobile and multi-agent robots, and the real-time platforms they run on. From there it is extending from control into signal processing and AI.",
    ko: "실용 가능한 제어 알고리즘 연구를 목표로 합니다. 시간지연·표본데이터·네트워크·특이 시스템의 안정성 해석과 제어기 설계 이론을 개발하고, 이를 로보틱스와 임베디드 시스템에서 끝까지 밀어붙입니다. 로봇 매니퓰레이터, 이동·다개체 로봇, 그리고 그것들이 실제로 돌아가는 실시간 플랫폼이 대상입니다. 여기서 제어를 넘어 신호처리와 AI로 영역을 넓히고 있습니다.",
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

  /* Three areas, matching the three blocks of the hero figure.
     The core / application split lives in the prose, not in extra cards.
     Keywords stay in English on both sides: they are search terms. */
  areas: [
    {
      key: "control",
      image: "assets/img/area-control.jpg",
      label: { en: "Control Algorithms", ko: "제어 알고리즘" },
      blurb: {
        en: "The core of the lab. Stability analysis and controller synthesis for time-delay, sampled-data, networked and descriptor systems — integral and summation inequalities, looped functionals, LMI conditions. Held to a practical bar throughout: the condition has to stay solvable and the gain has to survive a real board.",
        ko: "연구실의 핵심입니다. 시간지연·표본데이터·네트워크·특이 시스템의 안정성 해석과 제어기 설계 — 적분·합 부등식, 루프드 함수, LMI 조건을 다룹니다. 기준은 일관되게 실용성입니다. 조건이 실제로 풀려야 하고, 이득이 실제 보드 위에서 버텨야 합니다.",
      },
      keywords: [
        "Time-delay systems",
        "Sampled-data control",
        "Linear matrix inequalities",
        "Robust control",
        "Networked control",
        "Neural-network-based systems",
      ],
    },
    {
      key: "robotics",
      image: "assets/img/area-robotics.jpg",
      label: { en: "Robotics", ko: "로보틱스" },
      blurb: {
        en: "Manipulators first, but not only. Adaptive sliding mode control for disturbed arms, time-delay estimation assisted by neural networks, admittance-based force tracking for contact tasks, and trajectory tracking under uncertainty. Mobile robots and reinforcement-learning navigation sit here too, as do multi-agent and networked robot systems — several arms, or several vehicles, coordinating over a link that is not perfect.",
        ko: "매니퓰레이터가 중심이지만 거기에 그치지 않습니다. 외란이 있는 로봇의 적응 슬라이딩 모드 제어, 신경망 기반 시간지연 추정, 접촉 작업을 위한 어드미턴스 힘 추종, 불확실성 하에서의 궤적 추종을 다룹니다. 이동로봇과 강화학습 기반 주행, 그리고 완전하지 않은 통신 위에서 여러 대의 로봇이나 차량이 협조하는 다개체·네트워크 로봇 시스템도 이 영역입니다.",
      },
      keywords: [
        "Robot manipulators",
        "Adaptive sliding mode",
        "Force / admittance control",
        "Mobile robots",
        "Reinforcement learning",
        "Multi-agent systems",
      ],
    },
    {
      key: "embedded",
      image: "assets/img/area-embedded.jpg",
      label: { en: "Embedded Systems", ko: "임베디드 시스템" },
      blurb: {
        en: "Everything between the algorithm and the machine. Real-time execution under quantization, limited bandwidth and sampling jitter; motor drives and sensor interfacing; networked and V2X platforms. Signal processing and AI increasingly run on the same device — on-device inference for manufacturing, and learning-based estimation and classification from low-resolution sensors.",
        ko: "알고리즘과 기계 사이의 모든 것입니다. 양자화·제한된 대역폭·샘플링 지터 아래에서의 실시간 구동, 모터 구동과 센서 인터페이싱, 네트워크 및 V2X 플랫폼을 다룹니다. 신호처리와 AI도 점차 같은 장치 위에서 돌아갑니다. 제조 현장을 위한 온디바이스 추론, 저해상도 센서 기반 학습 추정·분류가 그 예입니다.",
      },
      keywords: [
        "Real-time implementation",
        "Input quantization",
        "Motor control",
        "Sensor systems",
        "On-device AI",
        "Signal processing",
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
