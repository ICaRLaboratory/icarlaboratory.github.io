#!/usr/bin/env bash
# Review explicit paths, commit, and push main.
#   ./publish.sh                 -> commits as "Update site"
#   ./publish.sh "Add 2027 paper"
#   ./publish.sh --yes "Reviewed update" -> explicit automation approval
set -euo pipefail
cd "$(dirname "$0")"
# Keep the caller's stdin available for confirmation; Python's source uses stdin.
python3 - "$@" 3<&0 <<'PY'
import os
import fnmatch
from pathlib import Path
import shutil
import subprocess
import sys


def fail(message):
    sys.exit(message)


def git(*args):
    result = subprocess.run(['git', *args], stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE)
    if result.returncode:
        fail('Git command failed: ' + args[0] + ' (inspect Git locally).')
    return result.stdout


def paths(*args):
    return set(os.fsdecode(p) for p in git(*args).split(b'\0') if p)


def check_paths(names):
    # Filename-only checks: never open or echo suspected secret contents.
    private_dirs = {'.ssh', '.aws', '.gnupg', '.azure', '.gcloud', '_originals',
                    'node_modules', '.venv', 'venv', '__pycache__', '.idea', '.vscode'}
    patterns = ('.env', '.env.*', '*.pem', '*.key', '*.p12', '*.pfx', '*.keystore',
                'id_rsa*', 'id_ed25519*', 'id_ecdsa*', 'id_dsa*',
                '*credential*', '*secret*', '*token*', '.netrc', '.npmrc', '.pypirc',
                '*.log', '*.swp', '*.bak', '*.tmp', '*.pyc', '*:zone.identifier')
    blocked = []
    for name in names:
        parts = name.lower().split('/')
        template = parts[-1].endswith(('.example', '.sample', '.template'))
        if (any(part in private_dirs for part in parts) or
                (not template and any(fnmatch.fnmatchcase(part, pattern)
                                      for part in parts for pattern in patterns))):
            blocked.append(name)
    if blocked:
        fail('Sensitive/local paths blocked (names only):\n' +
             '\n'.join('  ' + repr(name) for name in sorted(blocked)))


args = sys.argv[1:]
yes = bool(args and args[0] == '--yes')
if yes:
    args.pop(0)
if len(args) > 1:
    fail('Usage: ./publish.sh [--yes] ["Commit message"]')
message = args[0] if args else 'Update site'
confirmation = os.fdopen(3)
if not yes and not confirmation.isatty():
    fail('Refusing noninteractive publishing; use --yes only after review.')
os.environ['GIT_LITERAL_PATHSPECS'] = '1'
if git('symbolic-ref', '--quiet', '--short', 'HEAD').strip() != b'main':
    fail('Publishing requires branch main.')
staged = paths('diff', '--cached', '--name-only', '-z', '--no-renames')
if staged & paths('diff', '--name-only', '-z', '--no-renames'):
    fail('Refusing partially staged files; finish staging or unstage them first.')
changed = (paths('diff', '--name-only', '-z', '--no-renames', 'HEAD') |
           staged |
           paths('ls-files', '--others', '--exclude-standard', '-z'))
check_paths(changed | paths('ls-files', '-z') |
            paths('ls-tree', '-r', '--name-only', '-z', 'HEAD'))
# Read origin/main before committing; refuse missing, behind or diverged remotes.
git('fetch', '--quiet', '--no-tags', 'origin', 'refs/heads/main')
remote_head = git('rev-parse', 'FETCH_HEAD').strip().decode('ascii')
if git('merge-base', 'HEAD', remote_head).strip().decode('ascii') != remote_head:
    fail('origin/main is ahead or diverged; synchronize and review first.')
outgoing = git('rev-list', remote_head + '..HEAD').decode('ascii').splitlines()
outgoing_paths = set()
for commit in outgoing:
    check_paths(paths('ls-tree', '-r', '--name-only', '-z', commit))
    outgoing_paths |= paths('diff-tree', '--root', '-m', '--no-commit-id',
                            '--name-only', '--no-renames', '-r', '-z', commit)
for command in ('node', 'bash'):
    if not shutil.which(command):
        fail('Required publishing dependency missing: ' + command)
for path in sorted(changed | paths('ls-files', '-z')):
    if any(part.is_symlink() for part in (Path(path), *Path(path).parents)):
        fail('Symlink paths are not publishable: ' + repr(path))
    if not os.path.isfile(path):
        continue  # Deletions have no source to validate.
    command = (['node', '--check'] if path.endswith(('.js', '.cjs', '.mjs')) else
               ['bash', '-n'] if path.endswith('.sh') else None)
    if command and subprocess.run(command + ['./' + path],
                                  stdout=subprocess.DEVNULL,
                                  stderr=subprocess.DEVNULL).returncode:
        fail('Syntax validation failed: ' + repr(path) +
             ' (run the syntax checker locally for details).')
print('Files to commit (quoted literal paths):', flush=True)
for path in sorted(changed):
    print('  ' + repr(path), flush=True)
print('Existing outgoing commits: ' + str(len(outgoing)), flush=True)
for commit in outgoing:
    print('  ' + commit, flush=True)
print('Files touched by existing outgoing commits:', flush=True)
for path in sorted(outgoing_paths):
    print('  ' + repr(path), flush=True)
if not changed and not outgoing:
    print('Nothing to publish.')
    sys.exit(0)
if not yes:
    print('Type publish to commit these files and push origin/main: ', end='', flush=True)
    if confirmation.readline().strip() != 'publish':
        fail('Cancelled; nothing staged or committed.')
if changed:
    # Already-staged deletions no longer have an index entry to add.
    indexed = paths('ls-files', '-z')
    to_add = sorted(path for path in changed if path in indexed or os.path.lexists(path))
    if to_add:
        git('add', '--', *to_add)
    if git('diff', '--cached', '--name-only'):
        git('commit', '-m', message)
git('push', 'origin', 'HEAD:refs/heads/main')
if git('ls-remote', 'origin', 'refs/heads/main').split()[0] != git('rev-parse', 'HEAD').strip():
    fail('Remote verification failed; inspect origin/main before retrying.')
print('Pushed origin/main. GitHub Pages normally redeploys within a minute or two.')
PY
