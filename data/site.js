/* ---------------------------------------------------------------
   Lab-wide information: identity, contact, advisor profile,
   research areas.

   Descriptive prose carries a { en, ko } pair and follows the language
   toggle. Everything else — headings, technical terms, keywords, the
   hero figure — stays English in both languages, so a plain string here
   is shown as-is on both sides.
   --------------------------------------------------------------- */

const SITE = {
  labShort: "ICaR",
  labName: "Intelligent Control and Robotics Laboratory",
  tagline: {
    en: "Control theory for time-delay, sampled-data and networked systems — applied in robotics and on embedded hardware.",
    ko: "시간지연·표본데이터·네트워크 제어 시스템의 이론을 연구하고, 이를 로봇과 임베디드 하드웨어에서 구현합니다.",
  },
  intro: {
    en: "We judge a control algorithm by whether it can be implemented, not only proved. We develop stability analysis and controller synthesis for time-delay, sampled-data, networked and descriptor systems, and we carry that work through in robotics and embedded systems — manipulators, mobile and multi-agent robots, and the real-time platforms they run on. From there it is extending from control into signal processing and AI.",
    ko: "본 연구실은 실용 가능한 제어 알고리즘 연구를 목표로 합니다. 시간지연 시스템, 표본데이터 시스템, 네트워크 제어 시스템, 특이 시스템의 안정도 해석과 제어기 설계를 연구하고, 그 결과를 로봇과 임베디드 시스템에서 검증합니다. 로봇 매니퓰레이터, 이동 로봇과 다개체 로봇, 그리고 이들을 구동하는 실시간 플랫폼이 주요 대상입니다. 최근에는 제어를 넘어 신호처리와 AI로 연구 영역을 넓히고 있습니다.",
  },
  department: "Department of Artificial Intelligence and Information Technology",
  university: "Sejong University",
  since: 2019,

  /* Prose that used to sit in the HTML; here so it can follow the toggle. */
  homeNote: {
    en: "Control algorithms are the core; robotics and embedded systems are where that work is tested, and the problems found there set the next questions. All three are extending from control into signal processing and AI.",
    ko: "제어 알고리즘이 연구의 중심입니다. 로봇과 임베디드 시스템에서 그 결과를 검증하고, 이 과정에서 드러난 문제가 다음 연구 주제가 됩니다. 세 분야 모두 제어에서 신호처리와 AI로 확장되고 있습니다.",
  },
  researchLede: {
    en: "We develop stability analysis and controller synthesis for time-delay, sampled-data, networked and descriptor systems, and we hold the results to a practical requirement: the conditions have to be numerically solvable, and the controller has to run on the target hardware. Robotics and embedded systems are where that gets tested.",
    ko: "시간지연 시스템, 표본데이터 시스템, 네트워크 제어 시스템, 특이 시스템의 안정도 해석과 제어기 설계를 연구합니다. 결과는 실용성을 기준으로 판단합니다. 조건이 수치적으로 풀려야 하고, 제어기가 목표 하드웨어에서 실제로 동작해야 합니다. 검증은 로봇과 임베디드 시스템에서 이루어집니다.",
  },
  notFound: {
    en: "The address may have changed, or it may never have been here. Everything on the site is reachable from the menu above.",
    ko: "주소가 바뀌었거나, 처음부터 없던 페이지일 수 있습니다. 위 메뉴에서 사이트의 모든 페이지로 이동할 수 있습니다.",
  },

  contact: {
    office: "Room 515, Daeyang AI Center",
    address: "209 Neungdong-ro, Gwangjin-gu, Seoul 05006, Republic of Korea",
    addressKo: "05006 서울특별시 광진구 능동로 209 (군자동) 세종대학교 대양 AI센터 515호",
    email: "lsy@sejong.ac.kr",
    /* the pin the old site used */
    coords: "37.551049,127.075719",
    mapUrl: "https://www.google.com/maps?q=37.551049,127.075719&z=17",
    mapEmbed: "https://www.google.com/maps?q=37.551049,127.075719&z=17&output=embed",
  },

  /* Three areas, matching the three blocks of the hero figure. */
  areas: [
    {
      key: "control",
      image: "assets/img/area-control.jpg",
      label: "Control Algorithms",
      blurb: {
        en: "The core of the lab. Stability analysis and controller synthesis for time-delay, sampled-data, networked and descriptor systems, built on integral and summation inequalities, looped functionals and LMI conditions. The test we apply is practical: the conditions have to stay numerically solvable, and the resulting gains have to work on the target hardware.",
        ko: "연구실의 중심 분야입니다. 시간지연 시스템, 표본데이터 시스템, 네트워크 제어 시스템, 특이 시스템의 안정도 해석과 제어기 설계를 다루며, 적분 부등식과 합 부등식, looped functional, LMI 조건을 주로 사용합니다. 판단 기준은 실용성입니다. 조건이 수치적으로 풀려야 하고, 그렇게 얻은 제어 이득이 목표 하드웨어에서 동작해야 합니다.",
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
      label: "Robotics",
      blurb: {
        en: "Robot manipulators are the main platform: adaptive sliding mode control for disturbed arms, time-delay estimation assisted by neural networks, admittance-based force tracking for contact tasks, and trajectory tracking under uncertainty. The area also covers mobile robots and reinforcement-learning navigation, and multi-agent systems where several arms or vehicles coordinate over an unreliable communication link.",
        ko: "로봇 매니퓰레이터가 주된 플랫폼입니다. 외란이 존재하는 매니퓰레이터를 위한 적응 슬라이딩 모드 제어, 신경망을 결합한 시간지연 추정, 접촉 작업을 위한 어드미턴스 기반 힘 추종, 불확실성 하에서의 궤적 추종을 연구합니다. 이동 로봇과 강화학습 기반 주행, 그리고 통신이 불안정한 환경에서 여러 대의 매니퓰레이터나 이동체가 협조하는 다개체 시스템도 함께 다룹니다.",
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
      label: "Embedded Systems",
      blurb: {
        en: "Where the controller actually runs. Real-time execution under quantization, limited bandwidth and sampling jitter; motor drives and sensor interfacing; networked and V2X platforms. Signal processing and AI increasingly run on the same device — on-device inference for manufacturing, and learning-based estimation and classification from low-resolution sensors.",
        ko: "제어기가 실제로 동작하는 환경입니다. 양자화, 제한된 대역폭, 샘플링 지터를 고려한 실시간 구현과 모터 구동, 센서 인터페이스, 네트워크 및 V2X 플랫폼을 다룹니다. 최근에는 신호처리와 AI도 같은 장치에서 함께 수행합니다. 제조 현장을 위한 온디바이스 추론, 저해상도 센서 기반의 학습형 추정 및 분류가 여기에 해당합니다.",
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
  title: "Associate Professor",
  affiliation:
    "Department of Artificial Intelligence and Information Technology, Sejong University",
  email: "lsy@sejong.ac.kr",
  office: "Room 515, Daeyang AI Center",
  photo: "assets/img/advisor.jpg",
  orcid: "0000-0002-9071-4837",
  scholar: "https://scholar.google.com/citations?user=ME5-sE0AAAAJ",

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
      role: "Associate Professor",
      org: "Sejong University",
      note: "Dept. of Artificial Intelligence and Information Technology",
    },
    {
      period: "2025.03 – 2026.08",
      role: "Assistant Professor",
      org: "Sejong University",
      note: "Dept. of Artificial Intelligence and Information Technology",
    },
    {
      period: "2019.09 – 2025.02",
      role: "Assistant Professor",
      org: "Soonchunhyang University",
      note: "Dept. of Electronic Engineering",
    },
    {
      period: "2018.03 – 2019.08",
      role: "Staff Engineer",
      org: "Samsung Electronics",
      note: "",
    },
  ],

  education: [
    {
      period: "2011.03 – 2018.02",
      degree: "Ph.D.",
      org: "POSTECH",
      dept: "Division of IT Convergence Engineering (ITCE)",
      note:
        "Dissertation: “Stability Analysis of Systems with Time-varying Delays via Slack Matrix Based Approaches” · Advisor: Prof. PooGyeon Park",
    },
    {
      period: "2007.03 – 2011.02",
      degree: "B.S.",
      org: "POSTECH",
      dept: "Electrical Engineering",
      note: "",
    },
  ],
};
