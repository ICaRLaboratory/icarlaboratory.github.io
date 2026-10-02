"""Regression checks for the static application guide and home actions."""
from pathlib import Path
import unittest
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[1]

class GuideParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.guide = None
        self.links = []
        self.localized = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id') == 'application-guide':
            self.guide = attrs
        if tag == 'a':
            self.links.append(attrs)
        if attrs.get('data-ko'):
            self.localized.append(attrs)

class ApplicationGuideTests(unittest.TestCase):
    def test_static_guide_is_native_focusable_destination(self):
        parser = GuideParser()
        parser.feed((ROOT / 'members.html').read_text())
        self.assertIsNotNone(parser.guide)
        assert parser.guide is not None
        self.assertEqual(parser.guide.get('tabindex'), '-1')
        self.assertEqual(parser.guide.get('aria-labelledby'), 'application-guide-heading')
        self.assertTrue(any(x.get('href', '').startswith('mailto:lsy@sejong.ac.kr') for x in parser.links))
    def test_guide_gives_nonmandatory_inquiry_context(self):
        text = (ROOT / 'members.html').read_text()
        self.assertIn('참여 희망 시기', text)
        self.assertIn('대학원 진학 문의', text)
        self.assertIn('학부 연구 참여 문의', text)
        guide = text.split('id="application-guide"', 1)[1].split('</section>', 1)[0]
        self.assertIn('필수 제출 서류가 아니라 상담을 위한 안내입니다.', guide)
        self.assertIn('These are suggestions for an initial inquiry, not mandatory application documents.', guide)
        self.assertIn('이력서가 있다면 함께 보내 주셔도 됩니다.', guide)
        self.assertIn('data-en=', guide)
    def test_home_actions_are_localized_without_losing_destinations(self):
        parser = GuideParser()
        parser.feed((ROOT / 'index.html').read_text())
        for href, label in [('research.html', '연구 분야 보기'), ('members.html', '연구실 구성원')]:
            links = [x for x in parser.links if x.get('href') == href]
            self.assertTrue(links)
            self.assertTrue(any(x.get('data-ko') == label for x in parser.localized))

if __name__ == '__main__':
    unittest.main()
