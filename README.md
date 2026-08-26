# nw

**Puts a new project in the right place with git already correct — and finds it again later.**

`nw` asks where the project belongs, creates the folder, runs `git init`, makes the first commit,
creates the private GitHub repo, wires `origin`, sets the upstream, copies `cd <path>` to your
clipboard, and opens it in your editor.

`nw go` is the other half: type any part of a name and it finds the project among the 200-odd
under `C:\dev\`, then opens that.

```
nw trackify product

  product/trackify

  ✓ git init + first commit
  ✓ github.com/Visalan-H/trackify (private)

  → cd C:\dev\product\trackify  (copied)
```

```
nw go track

  product/trackify

  → cd C:\dev\product\trackify  (copied)
```

## Why

An audit of this machine turned up 189 projects. Of those: **71 had no git at all**, 10 had no
remote, and 17 had a remote but no upstream — one of them a paid client project with zero version
control.

Every one is a decision that got skipped at minute zero, because `mkdir` doesn't ask anything.
`nw` asks once, then never lets you skip git again.

## Install

```bash
winget install --id GitHub.cli -e   # for the GitHub step
gh auth login

npm install
npm link                            # `nw` is now on your PATH
```

Node 22+. Nothing to build — `npm link` means source edits are live.

## Usage

```bash
nw                                  # ask everything
nw trackify                         # ask for the bucket
nw trackify product                 # just go
nw trackify product --public        # public repo
nw trackify product --no-github     # local git only
nw trackify product --open cursor   # open it when it's done
nw trackify product -e              # short for --open code
nw clone <url> [bucket]             # clone into a bucket, not Downloads
```

Run bare, it asks four things: **name**, **bucket**, **GitHub** (private / public / none), and
**open in**. Give it both positionals and it asks nothing — every answer has a flag.

Repos are private by default. Decline GitHub entirely and it still does `git init` and the first
commit — **a project is never created without git.** That's the one hard rule.

## Finding it again

```bash
nw go trackify                      # straight there
nw go track                         # partial is fine
nw go qs                            # so are initials — letters in order, anywhere in the name
nw go                               # list everything
```

One match goes straight through — it tells you which one it found before asking anything else.
Several give you a menu of just those, each labelled with the bucket it lives in. Then it opens
the project and puts `cd <path>` on your clipboard.

It doesn't `cd` you there, because it can't — a CLI is a child process and can't change its
parent shell's directory. Pick `terminal` and you get a tab that's already sitting in the folder,
which is the same thing by another route.

## Buckets

Root is `C:\dev\`. The cut is **motive** — why does this exist — not stack, not language.

| Bucket | For |
|---|---|
| `work` | paid or obligated |
| `club/primeproject` | hackathon entries |
| `club/techsociety` | |
| `product` | things you wanted to exist |
| `product/packages` | the published npm line |
| `learning` | built to understand something |
| `play` | fun, or one joke |
| `_cold` | dead, stalled, or untouched since 2024 |

The picker shows one menu per level and nests as deep as you like. `club` never holds loose
projects — you have to go deeper. `_cold` sits last, out of the way of an accidental pick.

Adding a bucket at any depth is an edit to the array in `src/buckets.js`:

```js
{ name: 'clients', hint: 'paid client work', here: true, children: [{ name: 'acme' }] }
```

`here: true` lets a project sit directly in that folder; `hint` is the description shown on the
highlighted row. `work/clients/acme` is then a real target, in the picker and as a flag.

Buckets that name a client or an employer don't belong in a repo, so they go in
`src/buckets.private.json`, which is gitignored. Same shape, keyed by the bucket they hang off:

```json
{ "work": [{ "name": "acme", "hint": "retainer" }] }
```

Without that file `work` is just an ordinary bucket that holds projects directly.

## Opening

The last prompt, or `--open <name>`:

| name | opens |
|---|---|
| `code` | VS Code |
| `cursor` | Cursor |
| `antigravity` | Antigravity IDE |
| `terminal` | a new Windows Terminal tab, in the window you're already in |
| `claude` | the same tab, running `claude` |

`nothing` is first and starts highlighted, so Enter straight through behaves exactly as it did
before the question existed. One at a time.

Opening happens **after** the report prints — a new terminal tab takes focus the moment it lands,
and anything printed after that scrolls past in a window you're no longer watching.

## When something fails

Nothing is rolled back. The folder stays, and you get what worked, what didn't, and the fix:

```
  product/trackify

  ✓ git init + first commit
  ✗ github.com/Visalan-H/trackify — gh auth: not logged in

  ! not everything worked — the folder is still there
    gh auth login
    cd C:\dev\product\trackify
    gh repo create --source=. --remote=origin --push
```

Deleting a folder you just asked for is scarier than a clear message.

A failed *open* isn't a failed run — it prints one line and the command to do it by hand, and the
exit code stays 0. Git and the remote are the contract; the editor is a convenience.

## Built with

Plain JS with JSDoc types, no build step, no tests. [`@clack/prompts`](https://github.com/bombshell-dev/clack)
for the prompts, [`ora`](https://github.com/sindresorhus/ora) for the spinner,
[`picocolors`](https://github.com/alexeyraspopov/picocolors) for colour.
