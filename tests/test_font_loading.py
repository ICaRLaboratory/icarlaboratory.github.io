"""Regression checks for self-hosted, complete dynamic Pretendard loading."""
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]


class FontLoadingTests(unittest.TestCase):
    def test_pinned_asset_checksums(self):
        import hashlib
        manifest = ROOT / 'assets/fonts/Pretendard-SHA256SUMS'
        self.assertTrue(manifest.exists(), 'Pinned font assets need a checksum manifest')
        for line in manifest.read_text().splitlines():
            digest, name = line.split('  ', 1)
            self.assertEqual(hashlib.sha256((manifest.parent / name).read_bytes()).hexdigest(),
                             digest, name)

    def test_dynamic_coverage_and_loading(self):
        css = (ROOT / 'assets/style.css').read_text()
        self.assertIn('@import url("fonts/pretendardvariable-dynamic-subset.css");', css)
        self.assertNotIn('fonts/pretendard-subset.woff2', css)
        for path in ROOT.glob('*.html'):
            text = path.read_text()
            self.assertNotIn('fonts/pretendard-subset.woff2', text, path.name)
            self.assertIn('fonts/jetbrains-mono-subset.woff2', text, path.name)
        result = subprocess.run([sys.executable, str(ROOT / 'tools/check-font-coverage.py')],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('11172/11172 covered; 0 missing', result.stdout)
        self.assertIn('Dynamic chunks:', result.stdout)
        self.assertIn('Source-character chunk bytes:', result.stdout)


if __name__ == '__main__':
    unittest.main()
