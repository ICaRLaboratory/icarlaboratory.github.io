import unittest
from pathlib import Path
from html.parser import HTMLParser

class Section(HTMLParser):
    """Walks the #interactive section and records where the dashboard link
    sits relative to the simulator tablist row."""
    def __init__(self):
        super().__init__(); self.active=False; self.in_row=False; self.depth=0
        self.links=[]; self.heading=False; self.row_children=[]
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if tag=='section' and attrs.get('id')=='interactive': self.active=True
        if not self.active: return
        if tag=='h2': self.heading=True
        cls=attrs.get('class') or ''
        if tag=='div' and 'simtabs-row' in cls: self.in_row=True; self.depth=0; return
        if self.in_row:
            self.depth+=1
            if self.depth==1: self.row_children.append((tag,attrs))
        if tag=='a': self.links.append((attrs,self.in_row))
    def handle_endtag(self,tag):
        if tag=='section': self.active=False
        if self.in_row:
            if self.depth==0: self.in_row=False
            else: self.depth-=1

class SimulatorLinkTest(unittest.TestCase):
    def test_see_more_chip_shares_the_tab_row(self):
        p=Section();p.feed((Path(__file__).resolve().parents[1]/'research.html').read_text())
        self.assertTrue(p.heading)
        links=[(a,r) for a,r in p.links if a.get('href')=='/simulators/']
        self.assertEqual(len(links),1)
        link,in_row=links[0]
        self.assertTrue(in_row,'See-more link must sit inside .simtabs-row')
        classes=link.get('class','').split()
        self.assertIn('chip',classes)
        self.assertIn('simulator-more',classes)
        self.assertNotIn('role',link)  # a link, not a tab
        self.assertEqual(link.get('aria-label'),'See more control simulators')
        # tablist and link are siblings in the row
        kinds=[(t,a.get('id') or a.get('class','')) for t,a in p.row_children]
        self.assertIn(('div','simtabs'),kinds)
        css=(Path(__file__).resolve().parents[1]/'assets/style.css').read_text()
        self.assertIn('.simtabs-row',css)
        self.assertIn('.simulator-more:focus-visible',css)

if __name__=='__main__': unittest.main()
