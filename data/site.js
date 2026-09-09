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
    ko: "제어 알고리즘, 로보틱스, 임베디드 시스템의 이론과 기술을 연구합니다.",
  },
  intro: {
    en: "ICaR Lab at Sejong University conducts research in control algorithms, robotics and embedded systems. Our work addresses stability analysis and controller synthesis, robot motion and interaction, and real-time computing and on-device intelligence. Each field has its own research questions, with opportunities for joint work across them. We combine mathematical analysis, algorithm design and system experiments according to the problem at hand.",
    ko: "세종대학교 ICaR 연구실은 제어 알고리즘, 로보틱스, 임베디드 시스템을 연구합니다. 주요 연구 주제는 시스템 안정성 분석과 제어기 설계, 로봇의 움직임과 주변 환경과의 상호작용, 실시간 연산과 온디바이스 AI입니다. 각 분야의 연구를 독립적으로 진행하면서, 여러 분야의 지식이 필요한 문제는 함께 다룹니다. 연구 주제에 맞춰 수학적 해석, 알고리즘 개발, 실험을 수행합니다.",
  },
  department: "Department of Artificial Intelligence and Information Technology",
  university: "Sejong University",
  since: 2019,

  /* Prose that used to sit in the HTML; here so it can follow the toggle. */
  homeNote: {
    en: "Our three research areas address distinct questions: how to analyze and control dynamic systems, how robots move and interact, and how embedded devices sense and compute. Signal processing and AI also form part of this work.",
    ko: "동적 시스템의 해석과 제어, 로봇의 움직임과 상호작용, 임베디드 장치의 센싱과 연산을 연구합니다. 신호처리와 AI를 비롯한 다양한 방법을 활용하고 발전시키며, 여러 분야에 걸친 문제도 함께 연구합니다.",
  },
  researchLede: {
    en: "We pursue research in control theory and algorithms, robot motion and coordination, and embedded computing and signal processing. Topics include dynamic systems with delays and uncertainty, robot interaction with the environment, and real-time processing and inference on resource-constrained devices. We develop each area independently and connect them where the research calls for it.",
    ko: "제어 이론과 알고리즘, 로봇의 동작과 협업, 임베디드 시스템의 연산과 신호처리가 주요 연구 분야입니다. 시간 지연과 불확실성이 있는 시스템의 안정성, 로봇과 주변 환경의 상호작용, 연산 자원이 제한된 장치에서의 실시간 처리와 AI 추론 등을 다룹니다. 각 분야의 연구를 진행하면서, 주제에 따라 공동 연구도 수행합니다.",
  },
  /* The two loops on the research page. Each block is keyed by the id its
     module in assets/ registers, so the physics and the words stay apart.
     One line each: the figure is the explanation, and on a phone every line
     here is a line of it pushed off the screen. */
  sims: {
    /* One tab, two control laws, and a note and a footnote for each of
       them: the module reports which is selected and the shell reads the
       matching block out of modes. */
    track: {
      tab: "Trajectory tracking",
      modes: {
        pd: {
          note: {
            en: "A two-link arm tracing a circle under sampled PD feedback, with six kilogrammes landing on it at five seconds — past a spectral radius of one, the loop diverges.",
            ko: "샘플드데이터 PD 제어로 원 궤적을 따라 움직이는 2관절 로봇 팔입니다. 시작 5초 후 6 kg의 하중이 추가됩니다. 스펙트럼 반경이 1을 넘으면 제어계가 불안정해집니다.",
          },
          foot: {
            en: "The radius is taken at the worst pose on the circle and at whatever the arm is carrying, so it moves when the payload lands.",
            ko: "스펙트럼 반경은 원 궤적에서 안정성에 가장 불리한 자세와 현재 하중을 기준으로 계산합니다. 하중이 추가되면 이 값도 달라집니다.",
          },
        },
        smc: {
          note: {
            en: "The same arm and the same six kilogrammes, driven onto the surface s = e′ + λe instead of towards a point: sliding mode shrugs the load off, and pays for it by straddling that surface in a band that opens as the sampling period grows.",
            ko: "같은 로봇 팔에 6 kg의 하중을 추가하고, 슬라이딩 모드 제어로 s = e′ + λe = 0인 슬라이딩 면에 수렴하도록 합니다. 하중 변화에 대응하는 과정에서 슬라이딩 면 주변에 진동이 나타나며, 샘플링 주기가 길어질수록 진동 폭이 커집니다.",
          },
          foot: {
            en: "The band is the largest |s| over the run once the surface has been reached: inside the boundary layer Φ the law is continuous, and outside it the torque is hard over one way or the other and flipping every sample.",
            ko: "표시된 진동 폭은 슬라이딩 면에 도달한 이후 |s|의 최댓값입니다. 경계층 Φ 안에서는 제어 입력이 연속적으로 변하고, 밖에서는 불연속 제어 성분의 부호가 s에 따라 전환됩니다.",
          },
        },
      },
    },
    contact: {
      tab: "Interaction control",
      note: {
        en: "One machine pressed on a wall, wired both ways round: admittance measures the force and commands a motion, and gives way on a hard contact; impedance measures the motion and commands a force, and gives way as the sampling period grows.",
        ko: "같은 장치를 벽에 접촉시켜 두 제어 방식을 비교합니다. 어드미턴스 제어는 측정한 힘을 바탕으로 목표 위치를 정하고, 임피던스 제어는 측정한 위치를 바탕으로 힘을 정합니다. 이 모델에서는 접촉 강성이 높을 때 어드미턴스 제어가, 샘플링 주기가 길 때 임피던스 제어가 불안정해질 수 있습니다.",
      },
      foot: {
        en: "The radius is the selected loop taken in contact, and past one it chatters; the stiffness that matters is not the wall's own but that of the sensor and the tool in series with it.",
        ko: "스펙트럼 반경은 선택한 제어계의 접촉 상태를 기준으로 계산하며, 1을 넘으면 불안정해집니다. 접촉 강성은 벽의 강성뿐 아니라 직렬로 연결된 힘센서와 툴의 유연성에도 영향을 받습니다.",
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
        ko: "불확실성과 외란이 있는 상황에서도 시스템이 안정적으로 동작하고 목표 성능을 낼 수 있도록 제어 이론과 알고리즘을 연구합니다. 관측 정보의 부족, 통신 지연, 자원 제약이 시스템에 미치는 영향을 분석하고 이를 제어기 설계에 반영합니다. 시스템의 안정성과 성능을 보장하는 조건을 밝히고, 더 다양한 조건에서도 이를 보장할 수 있는 방법을 찾습니다.",
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
        ko: "로봇 매니퓰레이터와 이동 로봇의 동작, 주변 환경과의 상호작용, 여러 로봇의 협업을 연구합니다. 불확실한 환경에서 목표 궤적을 따라 움직이는 기술, 접촉 작업에서 어드미턴스 제어로 목표 힘을 따라가도록 하는 기술, 강화학습 기반 자율주행이 주요 주제입니다. 적응 슬라이딩 모드 제어와 신경망 기반 시간지연 추정 기법을 연구하고, 통신이 불안정한 상황에서도 여러 로봇이 협업할 수 있는 방법을 개발합니다.",
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
        ko: "임베디드 시스템의 실시간 연산, 센서 신호처리, 온디바이스 AI를 연구합니다. 저해상도 센서 데이터를 이용한 학습 기반 추정과 분류, 제조 현장의 기기에서 직접 실행하는 AI 추론, 모터 구동과 센서 인터페이스 등을 다룹니다. 네트워크 및 V2X 플랫폼도 연구하며, 양자화와 제한된 통신 대역폭, 샘플링 시점의 변동 등 실제 장치의 동작 조건을 고려해 시스템을 설계하고 구현합니다.",
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
