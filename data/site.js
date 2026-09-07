/* ---------------------------------------------------------------
   Lab-wide information: identity, contact, advisor profile,
   research areas. Edit the strings below; every page reads them.
   --------------------------------------------------------------- */

const SITE = {
  labShort: "ICaR",
  labName: "Intelligent Control and Robotics Laboratory",
  tagline: "Mathematical control theory, made to move real machines.",
  intro:
    "We develop advanced mathematical control theories and apply them to automation systems — networked control systems, multi-agent systems, sampled-data systems, and neural-network-based systems. Our applied work targets industrial robotics, with a strong emphasis on system modeling, robust control, and AI integration.",
  department: "Department of Artificial Intelligence and Information Technology",
  university: "Sejong University",
  since: 2019,

  contact: {
    office: "Room 515, Daeyang AI Center",
    addressEn: "209 Neungdong-ro, Gwangjin-gu, Seoul 05006, Republic of Korea",
    addressKo: "(05006) 서울시 광진구 능동로 209 세종대학교 대양AI센터 515호",
    email: "lsy@sejong.ac.kr",
    mapUrl: "https://maps.google.com/?q=Sejong+University+Daeyang+AI+Center",
  },

  /* Shown on the home page as the three pillars. */
  areas: [
    {
      key: "control",
      label: "Control Algorithms",
      blurb:
        "Stability analysis and controller synthesis for time-delay, sampled-data, and descriptor systems. We build integral and summation inequalities, looped functionals, and LMI-based conditions that make conservative criteria sharp.",
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
      label: "Robotics",
      blurb:
        "Adaptive sliding mode control for disturbed manipulators, time-delay estimation assisted by neural networks, admittance-based force tracking, and reinforcement learning for mobile robot navigation.",
      keywords: [
        "Robot manipulators",
        "Adaptive sliding mode",
        "Force / admittance control",
        "Reinforcement learning",
        "Multi-agent systems",
      ],
    },
    {
      key: "embedded",
      label: "Embedded Systems",
      blurb:
        "Getting theory onto hardware: real-time implementation under quantization, limited bandwidth, and sampling jitter — plus on-device AI for manufacturing platforms.",
      keywords: [
        "Real-time implementation",
        "Input quantization",
        "On-device AI",
        "Sensor fusion",
        "Motor control",
      ],
    },
  ],

  links: {
    scholar: "https://scholar.google.com/citations?user=",
    orcid: "https://orcid.org/0000-0002-9071-4837",
  },
};

const ADVISOR = {
  nameEn: "Seok Young Lee",
  nameKo: "이석영",
  title: "Associate Professor",
  affiliation:
    "Department of Artificial Intelligence and Information Technology, Sejong University",
  email: "lsy@sejong.ac.kr",
  office: "Room 515, Daeyang AI Center",
  orcid: "0000-0002-9071-4837",

  interests: [
    "Control theory",
    "Robust and networked control systems",
    "Applied mathematics via linear matrix inequalities",
    "Robot manipulators",
    "Neural-network-based systems",
  ],

  /* Newest first. */
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
      note: "",
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
      note:
        "Dissertation: “Stability Analysis of Systems with Time-varying Delays via Slack Matrix Based Approaches” · Advisor: Prof. PooGyeon Park",
    },
    {
      period: "2007.03 – 2011.02",
      degree: "B.S.",
      org: "POSTECH",
      note: "Electrical Engineering",
    },
  ],
};
