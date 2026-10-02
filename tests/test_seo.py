"""Search-visible metadata and no-JavaScript advisor regression checks."""
import json
from html.parser import HTMLParser
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self, filename):
        super().__init__()
        self.meta = {}
        self.title = ''
        self.lang = None
        self.in_title = False
        self.feed((ROOT / filename).read_text())

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'html':
            self.lang = attrs.get('lang')
        if tag == 'meta':
            self.meta[attrs.get('name', attrs.get('property'))] = attrs.get('content')
        if tag == 'title':
            self.in_title = True

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data


class SEOTests(unittest.TestCase):
    def test_home_korean_identity_metadata_matches_social_preview(self):
        page = Page('index.html')
        for value in (page.title, page.meta['description']):
            for identity in ('세종대학교', '이석영', 'ICaR Lab'):
                self.assertIn(identity, value)
        self.assertIn('Intelligent Control and Robotics', page.title)
        self.assertEqual(page.title, page.meta['og:title'])
        self.assertEqual(page.meta['description'], page.meta['og:description'])
        self.assertEqual(page.meta['og:locale'], 'ko_KR')
        self.assertEqual(page.meta['og:locale:alternate'], 'en_US')

    def test_home_schema_keeps_english_names_with_korean_aliases(self):
        source = (ROOT / 'index.html').read_text()
        schema = json.loads(source.split('<script type="application/ld+json">')[1].split('</script>')[0])
        self.assertEqual(schema['@type'], 'ResearchOrganization')
        self.assertEqual(schema['name'], 'Intelligent Control and Robotics Laboratory')
        for alias in ('ICaR Lab', '지능제어 및 로보틱스 연구실', '세종대학교 ICaR Lab'):
            self.assertIn(alias, schema['alternateName'])
        self.assertEqual(schema['employee']['name'], 'Seok Young Lee')
        self.assertEqual(schema['employee']['alternateName'], '이석영')
        for university in (schema['parentOrganization'], schema['employee']['affiliation']):
            self.assertEqual(university['name'], 'Sejong University')
            self.assertEqual(university['alternateName'], '세종대학교')

    def test_default_documents_and_home_faculty_link_are_search_visible(self):
        for filename in ('index.html', 'members.html'):
            self.assertEqual(Page(filename).lang, 'ko', filename)
        source = (ROOT / 'index.html').read_text()
        hero = source.split('<div class="hero__copy">')[1].split('<div class="cta-row">')[0]
        self.assertIn('href="members.html#advisor-section"', hero)
        for value in ('이석영', '세종대학교', 'Seok Young Lee', 'Sejong University'):
            self.assertIn(value, hero)

    def test_advisor_core_profile_exists_before_javascript(self):
        source = (ROOT / 'members.html').read_text()
        advisor = source.split('<div class="advisor" id="advisor">')[1].split('</section>')[0]
        for value in ('이석영', '세종대학교 지능정보융합학과', '부교수',
                      'Control theory', '경력', '학력', '대양 AI센터 526호',
                      'mailto:lsy@sejong.ac.kr', 'https://orcid.org/0000-0002-9071-4837',
                      'https://scholar.google.com/citations?user=ME5-sE0AAAAJ',
                      'assets/cv/CV_Seok_Young_Lee.pdf'):
            self.assertIn(value, advisor)
        self.assertNotIn('data-reveal', advisor, 'No-JS profile must remain visibly readable')
        self.assertEqual(source.count('id="advisor"'), 1)

    def test_generated_advisor_is_fresh_and_check_never_writes(self):
        result = subprocess.run(['node', 'scripts/build-static-advisor.mjs', '--check'],
                                cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for name in ('scripts/build-static-advisor.mjs', 'data/site.js', 'assets/site.js', 'members.html'):
                destination = root / name
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / name, destination)
            data = root / 'data/site.js'
            data.write_text(data.read_text().replace('nameKo: "이석영"', 'nameKo: "이석영 & <확인>"'))
            page = root / 'members.html'
            before = page.read_bytes()
            checked = subprocess.run(['node', 'scripts/build-static-advisor.mjs', '--check'],
                                     cwd=root, capture_output=True, text=True)
            self.assertEqual(checked.returncode, 1)
            self.assertIn('stale', checked.stderr)
            self.assertEqual(page.read_bytes(), before)
            built = subprocess.run(['node', 'scripts/build-static-advisor.mjs'],
                                   cwd=root, capture_output=True, text=True)
            self.assertEqual(built.returncode, 0, built.stderr)
            self.assertIn('이석영 &amp; &lt;확인&gt;', page.read_text())
            checked = subprocess.run(['node', 'scripts/build-static-advisor.mjs', '--check'],
                                     cwd=root, capture_output=True, text=True)
            self.assertEqual(checked.returncode, 0, checked.stderr)

    def test_home_faculty_identity_shows_only_selected_language(self):
        source = (ROOT / 'index.html').read_text()
        faculty = source.split('<p class="hero__faculty">')[1].split('</p>')[0]
        self.assertIn('data-ko="세종대학교 지능정보융합학과 · 지도교수 이석영"', faculty)
        self.assertIn('data-en="Seok Young Lee · Sejong University"', faculty)
        self.assertNotIn('lang="en"', faculty, 'English must not be a permanent second identity row')


if __name__ == '__main__':
    unittest.main()
