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
     module in assets/ registers, so the physics and the words stay apart. */
  sims: {
    arm: {
      tab: "Sampled-data PD",
      note: {
        en: "A two-link arm traces a circle under proportional-derivative feedback, measured on a clock instead of continuously and acted on a few samples late. One lap in, two kilogrammes arrive at the end effector, and nothing about the controller changes: the arm is simply heavier than the gains were chosen for, so it lags, and the laden laps swing wider than the first one. With no sampling period and no delay, any positive pair of gains would hold it. Give the loop a clock and a delay and that stops being true, which is what our work is about: the readout is the spectral radius of the sampled-data loop, and the figure diverges exactly when it passes one.",
        ko: "2관절 팔이 비례-미분 피드백으로 원을 그립니다. 다만 연속이 아니라 일정한 주기로 측정하고, 몇 샘플 뒤늦게 작용합니다. 한 바퀴를 돈 5초에 2 kg이 엔드이펙터에 실리지만 제어기는 그대로입니다. 이득을 정할 때 가정한 것보다 팔이 무거워졌을 뿐인데, 그만큼 뒤처지고, 이후의 궤적은 첫 바퀴보다 바깥으로 부풉니다. 샘플링 주기와 지연이 없다면 양의 이득 조합은 언제나 안정하지만, 클럭과 지연이 끼어들면 그렇지 않습니다. 이 지점이 연구실의 주제입니다. 위 수치는 샘플드데이터 루프의 스펙트럼 반경이며, 그 값이 1을 넘는 순간 그림도 발산합니다.",
      },
      foot: {
        en: "The radius is the loop linearised about the pose being tracked, taken at the worst point of the circle and at whatever the arm is carrying — which is why it moves when the payload lands. More inertia makes a sampled loop better damped for the same gains, so a load can carry the radius down at the same time as it makes the tracking worse. The two numbers measure different things.",
        ko: "반경은 추종 중인 자세에서 선형화한 루프의 값이며, 원 위에서 가장 나쁜 지점과 그 순간 팔이 들고 있는 질량을 기준으로 계산합니다. 페이로드가 실릴 때 값이 움직이는 이유입니다. 같은 이득이라면 관성이 클수록 샘플드데이터 루프의 감쇠는 좋아지므로, 하중이 추종 오차를 키우면서 반경은 오히려 낮출 수 있습니다. 두 수치는 서로 다른 것을 재고 있습니다.",
      },
    },
    contact: {
      tab: "Admittance contact",
      note: {
        en: "Here the tool is asked for a force, not a position: against a stiff surface a millimetre either way is the difference between no contact and far too much. So the force error drives a virtual mass, spring and damper, and wherever that settles is where the robot is sent. Two things are worth finding on the sliders. The virtual spring has to be held somewhere, and holding it costs force, so the loop settles short of what was asked for — wind the stiffness down to zero and the offset goes with it. Then make the wall hard and the virtual mass and damping light, and the tool starts chattering against the surface: contact instability, which is why this is a research problem and not a formula.",
        ko: "여기서 도구에 지시하는 것은 위치가 아니라 힘입니다. 단단한 표면에서는 1 mm 차이가 접촉하지 않음과 지나치게 누름을 가르기 때문입니다. 그래서 힘 오차가 가상의 질량-스프링-감쇠기를 구동하고, 그 결과로 정해지는 위치를 로봇에게 지령합니다. 슬라이더로 확인할 것이 두 가지입니다. 가상 스프링을 눌러 두려면 힘이 들기 때문에 루프는 요구한 값에 못 미치는 지점에서 멈춥니다. 가상 강성을 0으로 내리면 그 오차도 함께 사라집니다. 다음으로 벽을 단단하게 하고 가상 질량과 감쇠를 작게 하면 도구가 표면을 두드리기 시작합니다. 접촉 불안정이며, 이것이 이 주제가 공식이 아니라 연구 문제인 이유입니다.",
      },
      foot: {
        en: "The pole is the rightmost eigenvalue of the loop while it is in contact, where the wall closes a path from the tool straight back into the admittance; out of contact the two halves come apart and the question does not arise. The force beside it is where the loop settles, which is the target only when the virtual stiffness is zero.",
        ko: "극점은 접촉 중인 루프의 가장 오른쪽 고윳값입니다. 접촉 상태에서는 벽이 도구에서 어드미턴스로 되돌아가는 경로를 닫아 주며, 접촉이 없으면 두 부분이 분리되어 이 문제가 성립하지 않습니다. 옆의 힘은 루프가 실제로 머무는 값이고, 가상 강성이 0일 때에만 목표값과 일치합니다.",
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
