import unittest
from pathlib import Path
from html.parser import HTMLParser

class Section(HTMLParser):
    def __init__(self):
        super().__init__(); self.active=False; self.links=[]; self.heading=False
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if tag=='section' and attrs.get('id')=='interactive': self.active=True
        if self.active and tag=='h2': self.heading=True
        if self.active and tag=='a': self.links.append(attrs)
    def handle_endtag(self,tag):
        if tag=='section': self.active=False

class SimulatorLinkTest(unittest.TestCase):
    def test_interactive_heading_has_dashboard_chip(self):
        p=Section();p.feed((Path(__file__).resolve().parents[1]/'research.html').read_text())
        self.assertTrue(p.heading)
        links=[a for a in p.links if a.get('href')=='/simulators/']
        self.assertEqual(len(links),1)
        self.assertIn('section-chip',links[0].get('class',''))
        self.assertIn('simulator-more',links[0].get('class',''))
        css=(Path(__file__).resolve().parents[1]/'assets/style.css').read_text()
        self.assertIn('.simulator-more:focus-visible',css)
        self.assertIn('.simulator-more__arrow',css)
        self.assertEqual(links[0].get('aria-label'),'See more control simulators')

if __name__=='__main__': unittest.main()
