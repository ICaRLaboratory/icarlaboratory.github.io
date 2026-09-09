/* ---------------------------------------------------------------
   Funded research projects. `status` is "ongoing" or "completed".
   `titleKo` and `agencyKo` are the official Korean names, shown under and
   beside the English ones. Agencies are proper names, so the Korean belongs
   here whichever language the page is in -- it is the programme name that
   identifies the grant.
   --------------------------------------------------------------- */

const PROJECTS = [
  {
    status: "ongoing",
    titleEn: "An integrated data- and network-based resilient and robust control framework for reassembly systems using modular heterogeneous manipulators",
    titleKo: "모듈형 이종 매니퓰레이터 기반 재조립 시스템을 위한 데이터·네트워크 기반 회복탄력·강인 제어 통합 프레임워크 연구",
    agency: "National Research Foundation of Korea",
    agencyKo: "한국연구재단",
    period: "2026.03 – 2031.02",
    role: "Principal Investigator",
  },
  {
    status: "ongoing",
    titleEn: "Training program for AX-based manufacturing process technology (on-device AI manufacturing platform)",
    titleKo: "AX 기반 제조공정 활용기술 전문인력 양성 (온디바이스 AI 제조플랫폼)",
    agency: "Korea Institute for Advancement of Technology",
    agencyKo: "한국산업기술진흥원",
    period: "2026.03 – 2031.02",
    role: "Co-Investigator",
  },
  {
    status: "completed",
    titleEn: "Development and operation of a research curriculum on next-generation mobility communications",
    titleKo: "모빌리티 차세대통신 연구교육과정 개발 및 운영",
    agency: "IITP",
    agencyKo: "정보통신기획평가원",
    period: "2024.07 – 2025.02",
    role: "Co-Investigator",
  },
  {
    status: "completed",
    titleEn: "Control theory for networked systems and its application to platoon mobility control in V2X environments",
    titleKo: "네트워크 시스템 제어 이론 연구 및 V2X 환경에서의 군집 모빌리티 제어 기술로의 응용",
    agency: "Daejeon–Sejong–Chungnam Regional Innovation Platform",
    agencyKo: "대전·세종·충남 지역혁신플랫폼",
    period: "2024.06 – 2025.01",
    role: "Principal Investigator",
  },
  {
    status: "completed",
    titleEn: "RNA innovative talent development program for hyper-connected convergence industries",
    titleKo: "초연결 융합산업을 위한 RNA 혁신인재 양성사업단",
    agency: "IITP",
    agencyKo: "정보통신기획평가원",
    period: "2023.01 – 2024.02",
    role: "Co-Investigator",
  },
  {
    status: "completed",
    titleEn: "Robust sampled-data control for networked systems with uncertainties",
    titleKo: "불확실성을 지닌 네트워크 시스템에서의 표본 데이터 강인 제어",
    agency: "National Research Foundation of Korea (First Research Grant)",
    /* The professor's first grant, and it is the 생애첫연구 programme, which is
       not 신진연구 -- the original data had the Korean wrong and the English
       right. The 신진연구 grant is a separate one and is not on this list. */
    agencyKo: "한국연구재단 (생애첫연구사업)",
    period: "2020.03 – 2023.02",
    role: "Principal Investigator",
  },
];
