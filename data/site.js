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
    en: "We study control algorithms, robotics and embedded systems, pursuing fundamental questions and practical advances in each field.",
    ko: "제어 알고리즘, 로보틱스, 임베디드 시스템을 연구하며 각 분야의 이론적 깊이와 기술적 가능성을 탐구합니다.",
  },
  intro: {
    en: "ICaR Lab at Sejong University conducts research in control algorithms, robotics and embedded systems. Our work addresses stability analysis and controller synthesis, robot motion and interaction, and real-time computing and on-device intelligence. Each field has its own research questions, with opportunities for joint work across them. We combine mathematical analysis, algorithm design and system experiments according to the problem at hand.",
    ko: "세종대학교 ICaR 연구실은 제어 알고리즘, 로보틱스, 임베디드 시스템을 주요 연구 분야로 삼고 있습니다. 시스템의 안정도 해석과 제어기 설계, 로봇의 운동과 상호작용, 실시간 연산과 온디바이스 지능을 다룹니다. 각 분야 고유의 연구 문제를 탐구하는 동시에, 분야 간 협력을 통해 새로운 문제에 접근합니다. 연구 주제에 따라 수학적 분석, 알고리즘 설계, 시스템 실험을 결합합니다.",
  },
  department: "Department of Artificial Intelligence and Information Technology",
  university: "Sejong University",
  since: 2019,

  /* Prose that used to sit in the HTML; here so it can follow the toggle. */
  homeNote: {
    en: "Our three research areas address distinct questions: how to analyze and control dynamic systems, how robots move and interact, and how embedded devices sense and compute. Signal processing and AI also form part of this work.",
    ko: "동적 시스템의 해석과 제어, 로봇의 동작과 상호작용, 임베디드 장치의 센싱과 연산을 각각의 연구 주제로 다룹니다. 신호처리와 AI를 포함해 각 분야의 방법론을 발전시키고, 공통의 문제에서는 연구 경험을 공유합니다.",
  },
  researchLede: {
    en: "We pursue research in control theory and algorithms, robot motion and coordination, and embedded computing and signal processing. Topics include dynamic systems with delays and uncertainty, robot interaction with the environment, and real-time processing and inference on resource-constrained devices. We develop each area independently and connect them where the research calls for it.",
    ko: "제어 이론과 알고리즘, 로봇의 운동과 협업, 임베디드 연산과 신호처리를 연구합니다. 지연과 불확실성을 갖는 동적 시스템, 환경과 상호작용하는 로봇, 제한된 자원에서 실시간 처리와 추론을 수행하는 장치가 주요 연구 대상입니다. 각 분야의 독립적인 연구를 수행하며, 주제에 따라 분야를 연결하는 공동 연구도 진행합니다.",
  },
  /* The two loops on the research page. Each block is keyed by the id its
     module in assets/ registers, so the physics and the words stay apart.
     One line each: the figure is the explanation, and on a phone every line
     here is a line of it pushed off the screen. */
  sims: {
    arm: {
      tab: "Sampled-data PD",
      note: {
        en: "A two-link arm tracing a circle under sampled PD feedback, with six kilogrammes landing on it at five seconds — past a spectral radius of one, the loop diverges.",
        ko: "샘플드데이터 PD로 원을 그리는 2관절 팔 — 5초에 6 kg이 실리고, 스펙트럼 반경이 1을 넘으면 발산합니다.",
      },
      foot: {
        en: "The radius is taken at the worst pose on the circle and at whatever the arm is carrying, so it moves when the payload lands.",
        ko: "반경은 원 위에서 가장 나쁜 자세와 그 순간의 적재 질량 기준이라, 페이로드가 실릴 때 함께 움직입니다.",
      },
    },
    contact: {
      tab: "Admittance contact",
      note: {
        en: "One machine pressed on a wall, wired both ways round: measure force and command motion, or measure motion and command force — a hard enough contact breaks the first, a slow enough clock the second.",
        ko: "같은 기계를 벽에 누르되 인과만 뒤집습니다 — 힘을 재서 위치를 지령하거나(어드미턴스), 위치를 재서 힘을 지령하거나(임피던스). 딱딱한 접촉은 앞쪽을, 느린 클럭은 뒤쪽을 먼저 무너뜨립니다.",
      },
      foot: {
        en: "The radius is the selected loop taken in contact, and past one it chatters; the stiffness that matters is not the wall's own but that of the sensor and the tool in series with it.",
        ko: "반경은 선택한 루프를 접촉 상태에서 잡은 값이고 1을 넘으면 떨립니다. 실제로 문제가 되는 강성은 벽 자체가 아니라 직렬로 놓인 힘센서와 툴의 유연성입니다.",
      },
    },
  },

  notFound: {
    en: "The address may have changed, or it may never have been here. Everything on the site is reachable from the menu above.",
    ko: "요청하신 페이지를 찾을 수 없습니다. 주소를 확인하거나 상단 메뉴에서 원하시는 페이지로 이동해 주세요.",
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
      image: "assets/img/area-control.svg",
      label: "Control Algorithms",
      blurb: {
        en: "We study how dynamic systems can remain stable and achieve desired performance under uncertainty and external disturbances. Our research addresses the effects of limited sensing, communication delays and resource constraints on system behavior, and develops control theory and algorithms that account for these conditions. We seek to establish when stability and performance can be guaranteed, and to expand those guarantees.",
        ko: "불확실성과 외란이 존재하는 환경에서 동적 시스템의 안정성을 확보하고 원하는 성능을 달성하는 방법을 연구합니다. 제한된 관측 정보, 통신 지연, 자원 제약이 시스템의 동작에 미치는 영향을 분석하고, 이를 고려한 제어 이론과 알고리즘을 개발합니다. 안정성과 성능을 보장할 수 있는 조건을 규명하고 그 범위를 넓히는 것이 주요 연구 목표입니다.",
      },
      keywords: [
        "System stability",
        "Control performance",
        "Uncertain systems",
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
        en: "We study motion, environmental interaction and coordination in robot manipulators and mobile robots. Topics include trajectory tracking under uncertainty, admittance-based force tracking for contact tasks, and reinforcement-learning-based navigation. We investigate adaptive sliding mode control and neural-network-assisted time-delay estimation, as well as multi-robot coordination under unreliable communication.",
        ko: "로봇 매니퓰레이터와 이동 로봇의 운동, 환경과의 상호작용, 다중 로봇의 협업을 연구합니다. 불확실한 환경에서의 궤적 추종, 접촉 작업을 위한 어드미턴스 기반 힘 추종, 강화학습 기반 자율주행이 주요 주제입니다. 적응 슬라이딩 모드 제어와 신경망 기반 시간지연 추정 기법을 다루며, 통신이 불안정한 환경에서 여러 로봇이 협조하는 방법도 탐구합니다.",
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
      image: "assets/img/area-embedded.svg",
      label: "Embedded Systems",
      blurb: {
        en: "We study real-time computing, sensor signal processing and on-device AI in embedded systems. Topics include learning-based estimation and classification with low-resolution sensors, on-device inference for manufacturing, motor drives and sensor interfaces. We also investigate networked and V2X platforms, accounting for quantization, limited bandwidth and sampling jitter in system design and implementation.",
        ko: "임베디드 시스템의 실시간 연산, 센서 신호처리, 온디바이스 AI를 연구합니다. 저해상도 센서를 활용한 학습 기반 추정과 분류, 제조 현장을 위한 온디바이스 추론, 모터 구동 및 센서 인터페이스를 다룹니다. 네트워크 및 V2X 플랫폼도 연구하며, 양자화, 대역폭 제한, 샘플링 지터 등 실제 장치의 제약을 고려하여 시스템을 설계하고 구현합니다.",
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
