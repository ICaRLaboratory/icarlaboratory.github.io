"""Publishing integration tests: every commit/push targets disposable local repos."""
import os
import pty
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[1]


class PublishTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.repo = self.root / 'work'
        self.remote = self.root / 'remote.git'
        self.repo.mkdir()
        self.env = {**os.environ, 'GIT_CONFIG_NOSYSTEM': '1',
                    'GIT_CONFIG_GLOBAL': os.devnull, 'GIT_TERMINAL_PROMPT': '0'}
        self.run_cmd('git', 'init', '--bare', str(self.remote))
        self.git('init', '-b', 'main')
        self.git('config', 'user.name', 'Publish Test')
        self.git('config', 'user.email', 'test@example.invalid')
        for name in ('publish.sh', '.gitignore'):
            shutil.copy2(SOURCE / name, self.repo / name)
        self.put('site.js', 'const value = 1;\n')
        self.git('add', '.')
        self.git('commit', '-m', 'initial')
        self.git('remote', 'add', 'origin', str(self.remote))
        self.git('push', '-u', 'origin', 'main')
        self.initial = self.git('rev-parse', 'HEAD').stdout.strip()

    def run_cmd(self, *args, check=True, **kwargs):
        return subprocess.run(args, cwd=self.repo, env=self.env, text=True,
                              capture_output=True, check=check, **kwargs)

    def git(self, *args):
        return self.run_cmd('git', *args)

    def put(self, name, text):
        path = self.repo / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)

    def publish(self, *args):
        return self.run_cmd('bash', 'publish.sh', *args, check=False, input='')

    def remote_head(self):
        return self.git('--git-dir=' + str(self.remote), 'rev-parse', 'main').stdout.strip()

    def assert_refused(self, result):
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.git('rev-parse', 'HEAD').stdout.strip(), self.initial)
        self.assertEqual(self.remote_head(), self.initial)

    def test_noninteractive_refuses_without_staging(self):
        self.put('notes.txt', 'public note\n')
        self.assert_refused(self.publish('update'))
        self.assertEqual(self.git('diff', '--cached', '--name-only').stdout, '')

    def test_explicit_yes_publishes_exact_paths_and_message(self):
        self.put('notes with spaces.txt', 'public note\n')
        self.put(':(glob)*.txt', 'literal path\n')
        result = self.publish('--yes', 'Reviewed update')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('notes with spaces.txt', result.stdout)
        self.assertIn(':(glob)*.txt', result.stdout)
        self.assertEqual(self.git('log', '-1', '--format=%s').stdout.strip(), 'Reviewed update')
        self.assertEqual(self.remote_head(), self.git('rev-parse', 'HEAD').stdout.strip())

    def test_non_main_refused(self):
        self.git('checkout', '-b', 'feature')
        self.put('notes.txt', 'public\n')
        result = self.publish('--yes')
        self.assert_refused(result)
        self.assertIn('main', result.stderr)

    def test_sensitive_staged_paths_refused_without_content_leak(self):
        for name in ('.env', 'nested/credentials.json', 'deploy.key', '.ssh/id_ed25519'):
            self.put(name, 'SENTINEL_PRIVATE_CONTENT\n')
            self.git('add', '-f', '--', name)
        before = self.git('write-tree').stdout
        result = self.publish('--yes')
        self.assert_refused(result)
        self.assertIn('Sensitive', result.stderr)
        self.assertNotIn('SENTINEL_PRIVATE_CONTENT', result.stdout + result.stderr)
        self.assertEqual(self.git('write-tree').stdout, before)

    def test_ignore_local_files_but_allow_example_templates(self):
        ignored = ('.env', '.env.local', 'nested/.env.production', 'deploy.pem',
                   'credentials.json', 'secrets.yaml', '.venv/lib.py',
                   'node_modules/a.js', '__pycache__/x.pyc', 'debug.log')
        examples = ('.env.example', '.env.sample', 'credentials.json.template',
                    'deploy.key.example', 'nested/.env.example')
        for name in ignored + examples:
            self.put(name, 'placeholder\n')
        for name in ignored:
            with self.subTest(name=name):
                self.assertEqual(self.run_cmd('git', 'check-ignore', '-q', name,
                                             check=False).returncode, 0)
        for name in examples:
            with self.subTest(name=name):
                self.assertEqual(self.run_cmd('git', 'check-ignore', '-q', name,
                                             check=False).returncode, 1)
        result = self.publish('--yes')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        tracked = self.git('ls-files').stdout.splitlines()
        self.assertTrue(set(examples).issubset(tracked))
        self.assertFalse(set(ignored).intersection(tracked))

    def test_invalid_javascript_refused_before_staging(self):
        self.put('site.js', 'const broken = ; // SENTINEL_CONTENT\n')
        result = self.publish('--yes')
        self.assert_refused(result)
        self.assertIn('Syntax validation failed', result.stderr)
        self.assertNotIn('SENTINEL_CONTENT', result.stdout + result.stderr)
        self.assertEqual(self.git('diff', '--cached', '--name-only').stdout, '')

    def test_invalid_shell_refused_before_staging(self):
        self.put('helper.sh', '#!/bin/bash\nif then\n')
        result = self.publish('--yes')
        self.assert_refused(result)
        self.assertIn('Syntax validation failed', result.stderr)
        self.assertEqual(self.git('diff', '--cached', '--name-only').stdout, '')


    def test_sensitive_outgoing_history_refused_even_after_deletion(self):
        self.put('.env', 'SENTINEL_PRIVATE_CONTENT\n')
        self.git('add', '-f', '.env')
        self.git('commit', '-m', 'accidental local commit')
        self.git('rm', '.env')
        self.git('commit', '-m', 'delete is not history removal')
        head = self.git('rev-parse', 'HEAD').stdout
        result = self.publish('--yes')
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('Sensitive', result.stderr)
        self.assertNotIn('SENTINEL_PRIVATE_CONTENT', result.stdout + result.stderr)
        self.assertEqual(self.remote_head(), self.initial)
        self.assertEqual(self.git('rev-parse', 'HEAD').stdout, head)

    def test_clean_ahead_commit_is_reviewed_and_pushed(self):
        self.put('report.md', 'reviewed public content\n')
        self.git('add', 'report.md')
        self.git('commit', '-m', 'existing update')
        head = self.git('rev-parse', 'HEAD').stdout.strip()
        result = self.publish('--yes')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('report.md', result.stdout)
        self.assertEqual(self.remote_head(), head)
        self.assertEqual(self.git('rev-parse', 'HEAD').stdout.strip(), head)


    def test_symlink_refused_before_validation(self):
        outside = self.root / 'private-source'
        outside.write_text('const privateValue = 1;\n')
        (self.repo / 'linked.js').symlink_to(outside)
        result = self.publish('--yes')
        self.assert_refused(result)
        self.assertIn('Symlink', result.stderr)

    def test_partial_staging_refused_instead_of_overwritten(self):
        self.put('site.js', 'const staged = 2;\n')
        self.git('add', 'site.js')
        self.put('site.js', 'const unstaged = 3;\n')
        before = self.git('write-tree').stdout
        result = self.publish('--yes')
        self.assert_refused(result)
        self.assertIn('partially staged', result.stderr)
        self.assertEqual(self.git('write-tree').stdout, before)

    def interactive_publish(self, answer):
        master, slave = pty.openpty()
        try:
            proc = subprocess.Popen(['bash', 'publish.sh', 'interactive update'],
                                    cwd=self.repo, env=self.env, stdin=slave,
                                    stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                    text=True)
            os.write(master, (answer + '\n').encode())
            stdout, stderr = proc.communicate(timeout=15)
            return subprocess.CompletedProcess(proc.args, proc.returncode, stdout, stderr)
        finally:
            os.close(master)
            os.close(slave)

    def test_interactive_cancel_keeps_index_and_remote(self):
        self.put('notes.txt', 'public\n')
        result = self.interactive_publish('no')
        self.assert_refused(result)
        self.assertIn('Cancelled', result.stderr)
        self.assertEqual(self.git('diff', '--cached', '--name-only').stdout, '')

    def test_interactive_explicit_confirmation_publishes(self):
        self.put('notes.txt', 'public\n')
        result = self.interactive_publish('publish')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertLess(result.stdout.index('notes.txt'), result.stdout.index('Type publish'))
        self.assertEqual(self.remote_head(), self.git('rev-parse', 'HEAD').stdout.strip())

    def test_unchanged_tracked_sensitive_file_refused(self):
        self.put('credentials.json', 'SENTINEL_PRIVATE_CONTENT\n')
        self.git('add', '-f', 'credentials.json')
        self.git('commit', '-m', 'local unsafe commit')
        head = self.git('rev-parse', 'HEAD').stdout
        result = self.publish('--yes')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Sensitive', result.stderr)
        self.assertEqual(self.remote_head(), self.initial)
        self.assertEqual(self.git('rev-parse', 'HEAD').stdout, head)
        self.assertNotIn('SENTINEL_PRIVATE_CONTENT', result.stdout + result.stderr)

    def test_missing_remote_refused_before_commit(self):
        self.git('remote', 'remove', 'origin')
        self.put('notes.txt', 'public\n')
        self.assert_refused(self.publish('--yes'))
        self.assertEqual(self.git('diff', '--cached', '--name-only').stdout, '')


    def test_staged_rename_publishes_both_exact_paths(self):
        self.git('mv', 'site.js', 'renamed.js')
        result = self.publish('--yes')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("'site.js'", result.stdout)
        self.assertIn("'renamed.js'", result.stdout)
        self.assertEqual(self.remote_head(), self.git('rev-parse', 'HEAD').stdout.strip())

    def test_remote_ahead_refused_before_commit(self):
        self.put('remote-only.md', 'public\n')
        self.git('add', 'remote-only.md')
        self.git('commit', '-m', 'remote advance')
        self.git('push', 'origin', 'main')
        remote = self.remote_head()
        self.git('reset', '--hard', self.initial)
        self.put('notes.txt', 'local edit\n')
        result = self.publish('--yes')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('ahead or diverged', result.stderr)
        self.assertEqual(self.git('rev-parse', 'HEAD').stdout.strip(), self.initial)
        self.assertEqual(self.remote_head(), remote)
        self.assertEqual(self.git('diff', '--cached', '--name-only').stdout, '')


if __name__ == '__main__':
    unittest.main()
