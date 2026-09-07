/* ---------------------------------------------------------------
   Lab-wide information: identity, contact, advisor profile,
   research areas. Plain English throughout; the only Korean is the
   address line in the footer and the names on the members page.
   --------------------------------------------------------------- */

const SITE = {
  labShort: "ICaR",
  labName: "Intelligent Control and Robotics Laboratory",
  tagline:
    "Control algorithms built to be implemented — worked through in robotics and on embedded hardware.",
  intro:
    "Our goal is control algorithms that can actually be implemented, not only proved. We develop stability analysis and controller synthesis for time-delay, sampled-data, networked and descriptor systems, and we carry that work through in robotics and embedded systems — manipulators, mobile and multi-agent robots, and the real-time platforms they run on. From there it is extending from control into signal processing and AI.",
  department: "Department of Artificial Intelligence and Information Technology",
  university: "Sejong University",
  since: 2019,

  contact: {
    office: "Room 515, Daeyang AI Center",
    address: "209 Neungdong-ro, Gwangjin-gu, Seoul 05006, Republic of Korea",
    addressKo: "(05006) 서울시 광진구 능동로 209 세종대학교 대양AI센터 515호",
    email: "lsy@sejong.ac.kr",
    mapUrl: "https://maps.google.com/?q=Sejong+University+Daeyang+AI+Center",
  },

  /* Three areas, matching the three blocks of the hero figure. */
  areas: [
    {
      key: "control",
      image: "assets/img/area-control.jpg",
      label: "Control Algorithms",
      blurb:
        "The core of the lab. Stability analysis and controller synthesis for time-delay, sampled-data, networked and descriptor systems — integral and summation inequalities, looped functionals, LMI conditions. Held to a practical bar throughout: the condition has to stay solvable and the gain has to survive a real board.",
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
      blurb:
        "Manipulators first, but not only. Adaptive sliding mode control for disturbed arms, time-delay estimation assisted by neural networks, admittance-based force tracking for contact tasks, and trajectory tracking under uncertainty. Mobile robots and reinforcement-learning navigation sit here too, as do multi-agent and networked robot systems — several arms, or several vehicles, coordinating over a link that is not perfect.",
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
      blurb:
        "Everything between the algorithm and the machine. Real-time execution under quantization, limited bandwidth and sampling jitter; motor drives and sensor interfacing; networked and V2X platforms. Signal processing and AI increasingly run on the same device — on-device inference for manufacturing, and learning-based estimation and classification from low-resolution sensors.",
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
