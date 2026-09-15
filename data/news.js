/* ---------------------------------------------------------------
   Short-lived announcements for the top of the home page.

   The band shows the NEWS_MAX_ITEMS newest items, but only while at
   least one of them is younger than NEWS_WINDOW_DAYS. So posting
   something fresh brings the previous couple of items back up with it,
   and once everything has been quiet for that long the whole band
   vanishes -- no empty heading, no gap. Nothing needs to be deleted by
   hand; old entries can simply be left in the list, or cleared out
   whenever it suits.

   Add an item at the top:

     {
       date: "2026-09-15",                 // YYYY-MM-DD, the day it happened
       title: {
         en: "Paper accepted to Automatica.",
         ko: "Automatica 논문 게재 확정.",
       },
       href: "publications.html",          // optional, omit for plain text
     },

   Notes
   - `date` is read as a local calendar day, so there is no timezone drift.
   - An item dated in the future stays hidden until that day arrives, so
     something can be queued up in advance.
   - `title` follows the language toggle. A plain string is shown as-is
     in both languages.
   - `links: [{ label: { en, ko }, href }]` adds links below the title.
     For a specific paper, use `publications.html?q=` plus its encoded DOI.
   - Newest first is not required; the list is sorted by date anyway.
   --------------------------------------------------------------- */

/* How new an item has to be to hold the band open, in days. */
const NEWS_WINDOW_DAYS = 14;

/* How many items the band shows at most, newest first. The rest stay in
   the list below without appearing on the page. */
const NEWS_MAX_ITEMS = 3;

const NEWS = [
  {
    date: "2026-09-07",
    title: {
      en: "Sejong University News features our research on stability analysis and stabilization of asynchronous sampled-data systems in Mathematics and Computers in Simulation.",
      ko: "비동기 샘플드데이터 시스템의 안정성 해석 및 안정화 연구가 Mathematics and Computers in Simulation에 게재되어 세종대학교 뉴스룸에 소개되었습니다.",
    },
    links: [
      {
        label: { en: "News article", ko: "기사 원문" },
        href: "https://www.sejong.ac.kr/news/people/faculty.do?mode=view&articleNo=892863",
      },
      {
        label: { en: "Publication", ko: "해당 논문" },
        href: "publications.html?q=10.1016%2Fj.matcom.2025.11.031",
      },
    ],
  },
  {
    date: "2026-09-07",
    title: {
      en: "The ICaR Lab website has been redesigned.",
      ko: "ICaR 연구실 홈페이지를 새롭게 개편했습니다.",
    },
  },
];
