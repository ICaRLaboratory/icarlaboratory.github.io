# ICaR 연구실 홈페이지 관리

세종대학교 ICaR 연구실 홈페이지의 수정·검수·배포 절차를 정리한 내부 운영 문서입니다.

- 홈페이지: https://icarlaboratory.github.io/
- 저장소: https://github.com/ICaRLaboratory/icarlaboratory.github.io
- 운영 브랜치: `main`
- HTML·CSS·JavaScript 정적 사이트이며, 홈페이지 실행을 위한 빌드나 패키지 설치는 없습니다.

## 수정할 파일

| 수정 내용 | 파일 |
|---|---|
| 연구실 소개, 연구 분야, 교수 소개·이력, 연락처, 모집 안내 | `data/site.js` |
| 대학원생·학부연구생·졸업생 | `data/members.js` |
| 학술지·학술대회 논문 | `data/publications.js` |
| 연구 과제 | `data/projects.js` |
| 강의 | `data/courses.js` |
| 사진 앨범 | `data/gallery.js` |
| 홈페이지 공지 | `data/news.js` |
| 각 페이지의 구조 | 루트의 `index.html`, `research.html`, `members.html`, `publications.html`, `lecture.html`, `gallery.html`, `contact.html` |
| 공통 디자인 / Publications 디자인 | `assets/style.css` / `assets/publications.css` |
| 메뉴·언어 전환·페이지 렌더링·검색·갤러리 | `assets/site.js` |
| 홈 화면 애니메이션 / Research 시뮬레이터 | `assets/hero.js` / `assets/sim*.js` |
| 사진·그림 | `assets/img/` |

일반적인 내용 갱신은 `data/`에서 합니다. 연구 소개를 수정할 때는 제어 알고리즘·로보틱스·임베디드 시스템을 각각 독립된 연구 분야로 다룹니다.

## 자주 하는 갱신

### 논문 추가

- `data/publications.js`의 해당 학술지·학술대회 목록에 기존 항목 형식으로 추가합니다.
- 제목, 저자, 학술지·학술대회명, 연도, 권·호·쪽 또는 논문 번호, DOI를 확인합니다.
- 목록은 연도와 `detail`의 영문 월 표기(`Jul. 2026` 등)로 정렬됩니다. 월이 없으면 해당 연도 뒤쪽에 배치됩니다.
- 교신저자는 기존 형식대로 `*`를 붙입니다. `S. Y. Lee`는 자동으로 굵게 표시됩니다.
- 국내 학술지·학술대회는 `domestic: true`를 지정합니다. Domestic은 Journal·Conference와 겹칠 수 있습니다.
- 논문 수와 연도별 목록은 자동 갱신됩니다. Publications의 기본값과 필터 초기화 상태는 **All**입니다.
- 검색은 제목·저자·학술지·학술대회명·DOI를 대상으로 합니다. 여러 단어는 모두 일치해야 하며, 직접 선택한 유형·연도는 검색 중에도 유지됩니다.
- Research 시뮬레이터에서 인용할 논문은 `data/site.js`의 해당 모드에 `ref: "DOI"`로 연결합니다. 인용문 자체를 중복 작성하지 않습니다.

### 구성원 갱신

- `data/members.js`의 `GRAD_STUDENTS`, `UNDERGRAD_STUDENTS`, `ALUMNI`에서 관리합니다.
- 학위·연구 주제는 파일 상단의 `DEG`, `TOPIC` 상수를 사용합니다.
- 사진은 `assets/img/`에 넣고 `photo`에 경로를 지정합니다. 사진이 없으면 이니셜이 표시됩니다.
- 졸업 시 해당 구성원을 `ALUMNI`로 옮기고 학위 완료 구분, `graduated`, 필요한 경우 `now`를 갱신합니다.

### 사진·공지·과제 갱신

- 사진 원본은 Git에서 제외되는 `_originals/gallery/`에 보관하고 별도로 백업합니다. 공개할 웹용 사본만 `assets/img/gallery/`에 넣습니다.
- 웹용 사진은 최종 리사이즈와 JPEG 인코딩을 한 번만 수행하고, EXIF·GPS 등 메타데이터를 제거합니다. 기존 갤러리는 1400px 크기를 기준으로 제작했습니다.
- `data/gallery.js`에는 최신 앨범부터 추가합니다. 연도 필터는 앨범 날짜에서 자동 생성됩니다.
- 공지는 `data/news.js`에서 관리합니다. 미래 날짜의 공지는 해당 날짜부터 노출되며, 최근 공지가 있는 동안 최신 공지 최대 3개를 표시합니다. 노출 기간 기준은 `NEWS_WINDOW_DAYS`입니다.
- 연구 과제의 `status`는 `ongoing` 또는 `completed`로 구분합니다.

## 로컬 확인

저장소 루트에서 실행합니다.

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

http://127.0.0.1:8000/ 에서 확인하고, 종료할 때는 `Ctrl+C`를 누릅니다. HTML 파일을 직접 여는 것보다 HTTP 서버로 확인해야 검색 URL·탐색 동작을 배포 환경과 가깝게 점검할 수 있습니다.

- 수정한 페이지를 한국어·영어로 각각 확인합니다. 기본 언어는 한국어이며, 설명문은 `{ en, ko }` 형식으로 관리합니다.
- 모바일 너비에서도 줄바꿈, 버튼, 이미지 잘림을 확인합니다.
- 화면이 비거나 기능이 멈추면 브라우저 개발자 도구의 Console에서 오류를 확인합니다.
- 모션 감소 설정에서는 애니메이션이 정지할 수 있습니다. 콘텐츠 오류와 구분해서 확인합니다.

## 검수

내용 수정 후 기본 확인:

```bash
node --check data/site.js
node --check data/publications.js
node --check assets/site.js
node --test tests/news.test.cjs
bash -n publish.sh
git diff --check
```

위 목록 외의 JavaScript 파일을 수정했으면 해당 파일도 `node --check 파일경로`로 확인합니다.

검색·메뉴·언어·갤러리·시뮬레이터·화면 배치를 수정했으면 전체 브라우저 검사를 실행합니다. Playwright 설치와 실행 명령은 [tests/README.md](tests/README.md)에 정리되어 있습니다. `tools/run-browser-checks.mjs`가 로컬 서버와 브라우저를 직접 시작하고 종료합니다.

`publish.sh`를 수정했을 때는 다음 검사도 실행합니다. 이 검사는 임시 저장소와 로컬 원격 저장소만 사용하며 실제 홈페이지에는 푸시하지 않습니다.

```bash
python3 -m unittest discover -s tests -p test_publish.py -v
```

폰트 변경 시에는 [assets/fonts/README.md](assets/fonts/README.md)의 출처·라이선스를 유지하고, `tests/README.md`의 한글 커버리지·체크섬 검사를 실행합니다.

## 커밋·푸시·배포 확인

현재 저장소의 `origin`과 `main`을 그대로 사용합니다. 새 조직·저장소를 만들거나 원격 주소를 다시 등록할 필요가 없습니다.

```bash
git status --short --branch
git diff
./publish.sh "Update publication list"
```

- 필요한 도구는 **Bash, Git, Python 3, Node.js**입니다. 일상적인 내용 배포에 Playwright나 fontTools 설치가 필수인 것은 아닙니다.
- `publish.sh`는 원격 상태와 JavaScript·셸 문법을 검사한 뒤, 변경 파일과 아직 푸시하지 않은 커밋을 보여 줍니다. 범위를 검토하고 **`publish`**를 입력하면 커밋·푸시합니다.
- 일부 변경만 스테이징한 파일이나 원격보다 뒤처지거나 분기된 상태에서는 중단됩니다. 강제 푸시로 넘기지 말고 상태를 먼저 확인합니다.
- 이미 커밋했더라도 미푸시 커밋이 있으면 빈 커밋 없이 푸시할 수 있습니다. 검토 중에는 파일 수정이나 다른 Git 작업을 하지 않습니다.
- `--yes`는 검토를 마친 자동화에서만 사용합니다. 확인 입력만 생략하며 안전 검사는 유지됩니다.
- 푸시 후 GitHub Actions의 **Site checks** 결과와 Pages 배포 상태를 확인하고, 실제 홈페이지에서 변경한 페이지를 다시 확인합니다. 검사 통과나 원격 커밋 일치만으로 화면 배포 완료를 판단하지 않습니다.

## 공개 파일 주의사항

이 저장소와 홈페이지에 올리는 파일은 공개 자료로 취급합니다. 사진 원본, 개인정보가 담긴 내부 문서, 인증 정보, 로컬 캐시를 커밋하지 않습니다.

`.gitignore`와 `publish.sh`의 경로 검사는 보조 장치이지 파일 내용에 대한 비밀정보 검사가 아닙니다. 인증 정보를 커밋했다면 현재 파일만 삭제해서 푸시하지 말고, 인증 정보 폐기·재발급과 Git 이력 정리를 먼저 해야 합니다.
