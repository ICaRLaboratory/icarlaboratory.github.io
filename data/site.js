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
    ko: "세종대학교 ICaR 연구실은 제어 알고리즘, 로보틱스, 임베디드 시스템을 연구합니다. 시스템 안정성 해석과 제어기 설계, 로봇의 운동 및 환경 상호작용, 실시간 연산과 온디바이스 AI를 주요 연구 주제로 다룹니다. 각 분야의 이론과 기술을 발전시키는 한편, 분야 간 융합 연구를 수행합니다.",
  },
  department: "Department of Artificial Intelligence and Information Technology",
  university: "Sejong University",
  since: 2019,

  /* Prose that used to sit in the HTML; here so it can follow the toggle. */
  homeNote: {
    en: "Our three research areas address distinct questions: how to analyze and control dynamic systems, how robots move and interact, and how embedded devices sense and compute. Signal processing and AI also form part of this work.",
    ko: "동적 시스템의 해석과 제어, 로봇의 운동과 상호작용, 임베디드 시스템의 센싱과 연산을 연구합니다. 신호처리와 AI를 포함한 각 분야의 방법론을 개발하고, 이를 연계한 융합 연구를 추진합니다.",
  },
  researchLede: {
    en: "We pursue research in control theory and algorithms, robot motion and coordination, and embedded computing and signal processing. Topics include dynamic systems with delays and uncertainty, robot interaction with the environment, and real-time processing and inference on resource-constrained devices. We develop each area independently and connect them where the research calls for it.",
    ko: "제어 이론과 알고리즘, 로봇의 운동과 협업, 임베디드 연산과 신호처리를 연구합니다. 시간 지연과 불확실성을 고려한 시스템 안정성 해석, 로봇과 환경의 상호작용, 자원 제약을 고려한 실시간 처리와 AI 추론을 다룹니다. 각 분야의 전문성을 바탕으로 융합 연구를 수행합니다.",
  },

  /* The standing recruiting band under the hero on the home page. Set
     `on: false` when a round closes: the band goes away and the wording
     stays here, ready to be switched back on. Nothing here expires by
     itself -- short-lived announcements belong in data/news.js instead.
     The address shown beside it is contact.email below. */
  recruiting: {
    on: true,
    title: {
      en: "We are recruiting undergraduate researchers and graduate students. Students interested in control algorithms, robotics or embedded systems are welcome to contact us by email.",
      ko: "ICaR 연구실은 학부연구생 및 대학원생을 모집하고 있습니다. 제어 알고리즘, 로보틱스, 임베디드 시스템 분야의 연구에 관심 있는 학생은 이메일로 연락해 주시기 바랍니다.",
    },
  },

  /* The two loops on the research page. Each block is keyed by the id its
     module in assets/ registers, so the physics and the words stay apart.
     One line each: the figure is the explanation, and on a phone every line
     here is a line of it pushed off the screen. */
  sims: {
    /* One tab, four control laws, and a note and a footnote for whichever
       of them has words to carry: the module reports which is selected and
       the shell reads the matching block out of modes, clearing the lines
       for a law that has none. */
    track: {
      tab: "Trajectory tracking",
      modes: {
        pd: {
          note: {
            en: "A two-link arm tracing a circle under sampled PD feedback, with ten kilogrammes landing on it at five seconds: proportional and derivative on each joint, nothing done about the coupling or the load, and the payload costs it centimetres.",
            ko: "샘플드데이터 PD 제어를 적용한 2관절 로봇 팔의 원 궤적 추종을 보여줍니다. 시작 5초 후 10 kg의 하중을 추가하여, 관절 간 결합과 하중 변화에 대한 보상이 없는 조건에서 추종 성능을 확인합니다.",
          },
          foot: {
            en: "What it reports is the error at the end effector — how far the point at the end of the arm is from the point the reference asks for, root-mean-squared over the last second — and the verdict is that error against a tenth of the circle being traced. The two joint errors belong to the panels below, not to this number.",
            ko: "위치 추종 오차는 최근 1초간 엔드이펙터와 목표 위치 사이 거리의 RMS 값입니다. 이 시뮬레이션에서는 원 궤적 반지름의 1/10을 기준으로 추종 성능을 판정하며, 관절별 오차는 각 패널에 표시합니다.",
          },
        },
        smc: {
          note: {
            en: "The same arm and the same ten kilogrammes, driven onto the surface s = e′ + λe instead of towards a point: sliding mode shrugs the load off, and pays for it by straddling that surface in a band that opens as the sampling period grows.",
            ko: "동일한 로봇 팔에 10 kg의 하중을 추가하는 조건에서 슬라이딩 모드 제어를 적용합니다. 샘플링 주기에 따른 슬라이딩 면 s = e′ + λe = 0 부근의 진동 특성을 비교합니다.",
          },
          foot: {
            en: "The band is the largest |s| over the run once the surface has been reached, and the shaded strip is (1+m)hη — how far a zero-order hold and m samples of delay let s run before the sign can change. The switch is left discontinuous, so the clock is what sets the chattering: a loop that is sliding stays about that wide, and one that has left the surface runs several times wider. The error beneath is measured at the end effector rather than at the joints — how far the point at the end of the arm is from the point being tracked, root-mean-squared over the last second.",
            ko: "진동 폭은 슬라이딩 면 도달 이후 |s|의 최댓값으로 정의합니다. 음영 영역의 (1+m)hη는 영차 홀드와 m 샘플 지연에 따른 슬라이딩 변수의 변화 폭을 나타냅니다. 이 시뮬레이션은 경계층 없이 불연속 제어를 적용하여 샘플링 주기와 지연에 따른 진동 특성을 비교합니다. 위치 추종 오차는 최근 1초간 엔드이펙터와 목표 위치 사이 거리의 RMS 값입니다.",
          },
        },
        asmc: {
          /* The reference is the whole caption; a plain string stands in
             both languages. */
          foot: "2024, doi:10.3390/electronics13193940",
        },
      },
    },
    contact: {
      tab: "Interaction control",
      note: {
        en: "One machine reaching for a wall and then pressing on it, wired both ways round: admittance measures the force and commands a motion, impedance measures the motion and commands a force. The same wall, the same clock and the same demand either way, so what each settles at can be read straight against the other: a stiffer virtual spring holds less of the force it was asked for, and stiffer still on a coarse clock it rings and then lets go.",
        ko: "벽면 접근과 접촉력 유지 과정을 어드미턴스 제어와 임피던스 제어로 비교합니다. 어드미턴스 제어는 측정한 힘을 바탕으로 위치를 제어하고, 임피던스 제어는 측정한 위치를 바탕으로 힘을 제어합니다. 벽면 특성, 샘플링 주기, 목표 힘을 동일하게 설정하여 정상상태 응답을 비교합니다. 이 모델에서는 가상 강성이 높아질수록 정상상태 접촉력이 목표값보다 낮아지며, 긴 샘플링 주기와 높은 가상 강성 조건에서는 진동이 발생하고 접촉이 해제될 수 있습니다.",
      },
      foot: {
        en: "The tool reaches the surface over the first second and is asked for no force until it is touching: with a zero demand both laws reduce to position control, so the reach needs no separate controller. What is read off the run is the force the loop settles at over the last second and the width it is swinging through; the stiffness that matters is not the wall's own but that of the sensor and the tool in series with it.",
        ko: "접촉 전에는 목표 힘을 0으로 설정하고, 두 제어법 모두 위치 제어로 첫 1초 동안 벽면에 접근합니다. 별도의 접근 제어기는 사용하지 않습니다. 접촉력 지표는 최근 1초간의 평균과 진동 폭이며, 유효 접촉 강성은 벽면과 직렬로 연결된 힘센서 및 툴의 유연성을 고려하여 산출합니다.",
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
        ko: "불확실성과 외란, 관측 정보와 자원의 제약, 통신 지연이 존재하는 환경에서 동적 시스템의 안정성과 성능을 보장하는 제어 이론과 알고리즘을 연구합니다. 이러한 제약이 시스템에 미치는 영향을 해석하고, 안정성과 성능의 보장 조건을 도출하여 제어기 설계에 반영합니다.",
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
        ko: "로봇 매니퓰레이터와 이동 로봇의 운동, 환경 상호작용 및 다중 로봇 협업을 연구합니다. 주요 주제는 불확실성을 고려한 궤적 추종, 어드미턴스 기반 힘 추종, 강화학습 기반 자율주행입니다. 적응 슬라이딩 모드 제어와 신경망 기반 시간지연 추정, 통신 제약을 고려한 다중 로봇 협업 기법을 개발합니다.",
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
        ko: "임베디드 시스템의 실시간 연산, 센서 신호처리 및 온디바이스 AI를 연구합니다. 저해상도 센서를 이용한 학습 기반 추정·분류, 제조 현장의 온디바이스 추론, 모터 구동과 센서 인터페이스를 다룹니다. 양자화, 통신 대역폭 및 샘플링 지터를 고려한 시스템 설계와 네트워크·V2X 플랫폼도 연구합니다.",
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
