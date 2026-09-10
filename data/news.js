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
   - Newest first is not required; the list is sorted by date anyway.
   --------------------------------------------------------------- */

/* How new an item has to be to hold the band open, in days. */
const NEWS_WINDOW_DAYS = 14;

/* How many items the band shows at most, newest first. The rest stay in
   the list below without appearing on the page. */
const NEWS_MAX_ITEMS = 3;

const NEWS = [
  {
    date: "2026-09-10",
    title: {
      en: "The ICaR Lab website has been redesigned.",
      ko: "ICaR 연구실 홈페이지를 새롭게 개편했습니다.",
    },
  },
];
