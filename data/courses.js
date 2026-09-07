/* ---------------------------------------------------------------
   Teaching. `level` is LEVEL.ug or LEVEL.grad.
   --------------------------------------------------------------- */

const LEVEL = { ug: "Undergraduate", grad: "Graduate" };

/* nameKo is the official course title; it prints beside the English one. */
const c = (nameEn, nameKo, level, years) => ({ nameEn, nameKo, level, years });

const COURSES = {
  spring: [
    c("Probability and Statistics",  "확률및통계",        LEVEL.ug,   "2025"),
    c("C Programming and Practice",  "C프로그래밍및실습", LEVEL.ug,   "2025"),
    c("Engineering Mathematics II",  "공업수학 2",        LEVEL.ug,   "2026"),
    c("Linear Systems",              "선형시스템",        LEVEL.grad, "2025 – 2026"),
  ],
  fall: [
    c("Engineering Mathematics I",          "공업수학 1",             LEVEL.ug,   "2025"),
    c("Advanced C Programming and Practice", "고급C프로그래밍및실습", LEVEL.ug,   "2025"),
    c("Embedded Systems",                    "임베디드시스템",        LEVEL.ug,   "2026"),
    c("Nonlinear Systems",                   "비선형시스템",          LEVEL.grad, "2026"),
  ],
  /* Taught 2019-2024. */
  past: [
    c("Numerical Analysis",                "수치해석",         LEVEL.ug),
    c("Introduction to Engineering Design", "공학입문설계",     LEVEL.ug),
    c("Signals and Systems",               "신호및시스템",     LEVEL.ug),
    c("Control Engineering",               "제어공학",         LEVEL.ug),
    c("Embedded Programming",              "임베디드프로그래밍", LEVEL.ug),
    c("Digital Signal Processing",         "디지털신호처리",   LEVEL.ug),
    c("Motor Control Engineering",         "모터제어공학",     LEVEL.ug),
    c("Linear Systems",                    "선형시스템",       LEVEL.grad),
    c("Optimal Control",                   "최적제어",         LEVEL.grad),
    c("Nonlinear Systems",                 "비선형시스템",     LEVEL.grad),
  ],
};
