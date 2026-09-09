/* ---------------------------------------------------------------
   Funded research projects. `status` is "ongoing" or "completed".

   Every field is a { en, ko } pair and follows the site's language toggle,
   so a card is in one language at a time -- no English-and-Korean together.

   The `ko` side is the OFFICIAL name, copied verbatim from the lab's own
   projects page: agency first, then the programme, as that page writes them.
   Never edit or "correct" it, spacing included. The `en` side is only a
   rendering of it, so when the two disagree it is the English that gets fixed.

   The page dates each grant to the day (e.g. 26.03.01~31.02.28); `period`
   keeps months, which is what the cards have always shown.
   --------------------------------------------------------------- */

const PROJECTS = [
  {
    status: "ongoing",
    title: {
      en: "An integrated data- and network-based resilient and robust control framework for reassembly systems using modular heterogeneous manipulators",
      ko: "모듈형 이종 매니퓰레이터 기반 재조립 시스템을 위한 데이터·네트워크 기반 회복탄력·강인 제어 통합 프레임워크 연구",
    },
    agency: {
      en: "National Research Foundation of Korea, Young Researcher Program (Type B)",
      ko: "한국연구재단, 신진연구(유형B)",
    },
    role: { en: "Principal Investigator", ko: "책임연구원" },
    period: "2026.03 – 2031.02",
  },
  {
    status: "ongoing",
    title: {
      en: "Training program for AX-based manufacturing process technology (on-device AI manufacturing platform)",
      ko: "AX기반제조공정활용기술전문인력양성 (온디바이스 AI 제조플랫폼)",
    },
    agency: {
      en: "Korea Institute for Advancement of Technology, Industrial Innovation Talent Growth Support (R&D)",
      ko: "한국산업기술진흥원, 산업혁신인재 성장지원 (R&D)",
    },
    role: { en: "Co-Investigator", ko: "참여연구원" },
    period: "2026.03 – 2031.02",
  },
  {
    status: "completed",
    title: {
      en: "Development and operation of a research curriculum on next-generation mobility communications",
      ko: "모빌리티 차세대통신 연구교육과정 개발 및 운영",
    },
    agency: {
      en: "IITP",
      ko: "정보통신기획평가원",
    },
    role: { en: "Co-Investigator", ko: "참여연구원" },
    period: "2024.07 – 2025.02",
  },
  {
    status: "completed",
    title: {
      en: "Control theory for networked systems and its application to platoon mobility control in V2X environments",
      ko: "네트워크 시스템 제어 이론 연구 및 V2X 환경에서의 군집 모빌리티 제어 기술로의 응용",
    },
    agency: {
      en: "Daejeon–Sejong–Chungnam Regional Innovation Platform",
      ko: "대전·세종·충남 지역혁신플랫폼",
    },
    role: { en: "Principal Investigator", ko: "책임연구원" },
    period: "2024.06 – 2025.01",
  },
  {
    status: "completed",
    title: {
      en: "RNA innovative talent development program for hyper-connected convergence industries",
      ko: "초연결 융합산업을 위한 RNA 혁신인재 양성사업단",
    },
    agency: {
      en: "IITP",
      ko: "정보통신기획평가원",
    },
    role: { en: "Co-Investigator", ko: "참여연구원" },
    period: "2023.01 – 2024.02",
  },
  {
    status: "completed",
    title: {
      en: "Robust sampled-data control for networked systems with uncertainties",
      ko: "불확실성을 지닌 네트워크 시스템에서의 표본 데이터 강인 제어",
    },
    agency: {
      en: "National Research Foundation of Korea, First Research Grant",
      ko: "한국연구재단, 생애첫연구",
    },
    role: { en: "Principal Investigator", ko: "책임연구원" },
    period: "2020.03 – 2023.02",
  },
];
