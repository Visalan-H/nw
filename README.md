# nw

Makes a new project in the right place, with git already correct.

`mkdir` doesn't ask anything — which is why 71 of 189 projects on this machine ended up with
no git at all, 10 with no remote, and 17 with no upstream. `nw` makes those decisions
unskippable at minute zero.

## Install

```bash
winget install --id GitHub.cli -e   # required for the GitHub step
gh auth login

git clone <this repo> && cd nw
npm install
npm link                            # `nw` is now on your PATH
```

Node 22+. `npm link` means edits to the source are live — no reinstall.

## Use

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

Three prompts when run bare: **name**, **bucket**, then **open in** — one bucket menu per level,
as deep as the tree goes. Each bucket’s description shows as a hint on the highlighted row, so the
menu stays a short list of names.

## What it does

```
nw trackify product

  product/trackify

  ✓ git init + first commit
  ✓ github.com/Visalan-H/trackify (private)

  → cd C:\dev\product\trackify  (copied)
```

`cd <path>` goes on your clipboard on every run that produced a folder — that’s what `(copied)`
means. The line stays even when something was opened: after an open it isn’t an instruction any
more, it’s a receipt, because a clipboard written silently is a small theft.

The prompts use a framed style; the result doesn’t. Once there is nothing left to answer the
frame closes and the run reports as plain indented lines. A spinner covers the slow part and
erases itself, so nothing half-finished stays on screen.

The GitHub step is one command:

```bash
gh repo create Visalan-H/<name> --private --source=. --remote=origin --push
```

That creates the repo, wires `origin`, **and sets the upstream** — the last part being the `-u`
whose absence left 17 repos silently unpushable. Don't replace this with `git remote add` +
`git push`; that path is how the problem happened.

Repos are **private by default**. Flip to public when it's time to publish.

If you decline GitHub, it still runs `git init` and the first commit. A project is never created
without git. That's the one hard rule.

## Buckets

Root is `C:\dev\`. The cut is **motive** — why does this exist — not stack, not git status.

| Bucket | For |
|---|---|
| `work/internal` | paid or obligated |
| `work/clients` | acme, beta, gamma, delta |
| `club/primeproject` | hackathon entries |
| `club/techsociety` | |
| `product` | things you wanted to exist |
| `product/packages` | the published npm line |
| `learning` | built to understand something |
| `play` | fun, or one joke |
| `_cold` | dead, stalled, or untouched since 2024 |

`_cold` sits last in the list, out of the way of an accidental pick.
`archive` exists on disk but isn't in the picker.

### Nesting

The tree goes **as deep as you want** — the picker shows one menu per level and keeps going until
it runs out. Two flags on each node control it:

| | |
|---|---|
| `here: true` | a project can sit directly in this folder — the picker offers `. (here)` |
| `hint` | the description; shown only on the highlighted row, so the menu stays short |
| `here: false` | container only, you must go deeper — this is `work` and `club` |
| no `children` | it's a leaf, the picker stops there |

So to give a client its own folder of projects, edit `src/buckets.js`:

```js
{
  name: 'clients',
  hint: 'paid client work',
  here: true,
  children: [{ name: 'acme' }],
}
```

and `work/clients/acme` becomes a real target — both in the picker and as a flag
(`nw thing work/clients/acme`). There's no depth limit.

Top level never offers `. (here)` — nothing is created loose in `C:\dev\`.

## Opening

The last prompt, or `--open <name>`:

| name | opens |
|---|---|
| `code` | VS Code |
| `cursor` | Cursor |
| `antigravity` | Antigravity IDE (`antigravity-ide`) |
| `terminal` | a new Windows Terminal **tab in the window you're already in** |
| `claude` | the same tab, running `claude` |

`nothing` is the first option and starts highlighted, so pressing Enter straight through does
exactly what this tool did before the question existed. One at a time — no opening two things.

Claude Code arrives as a terminal tab rather than the desktop app because the desktop app can't
be handed a directory: it registers a `claude:` URI scheme, but no documented URL points it at a
folder, and an invented one breaks silently on the next update.

**It doesn't remember your last pick.** That would be a state file in `%APPDATA%` — invisible
state that makes an identical command do different things, which is the same failure as the
registry file below. Use `-e` if you want VS Code every time without thinking.

`nw trackify product` asks nothing at all, so it opens nothing. Adding a stop sign to the path
whose whole point is "just go" is how a tool starts losing to `mkdir`. Pass `--open` there.

A failed open is **not** a failed run:

```
  ✓ git init + first commit
  ✓ github.com/Visalan-H/trackify (private)

  → cd C:\dev\product\trackify  (copied)

  ! couldn't open Antigravity — `antigravity-ide` isn't on your PATH
    antigravity-ide C:\dev\product\trackify
```

Exit code 0, no yellow block. Git and the remote are the contract; the editor is a convenience.
If a missing editor turned a correct project into a failure, you'd learn to ignore the yellow
block — and that block is the one thing here that has to stay worth reading.

The opening happens **after** the report is printed. A new terminal tab takes focus the instant it
lands, so anything printed after it scrolls past in a window you're no longer watching. The trade
is that a successful open can't be a `✓` in the report; it hasn't happened yet. That's fine — the
window appearing on your screen is the confirmation, and a *failed* open steals no focus, so its
warning lands exactly where you're still looking.

## When it breaks halfway

Nothing is rolled back. The folder stays, and it tells you what worked, what didn't, and the fix:

```
  product/trackify

  ✓ git init + first commit
  ✗ github.com/Visalan-H/trackify — gh auth: not logged in

  ! not everything worked — the folder is still there
    gh auth login
    cd C:\dev\product\trackify
    gh repo create --source=. --remote=origin --push
```

Deleting a folder you just made is scarier than a clear message.

## Files

| File | |
|---|---|
| `src/index.js` | args, prompts, validation |
| `src/buckets.js` | the bucket tree |
| `src/openers.js` | the apps a finished project can be opened in |
| `src/clip.js` | puts `cd <path>` on the clipboard |
| `src/create.js` | create + clone steps, failure report |
| `src/ui.js` | everything the tool prints — frame, steps, spinner, failures |
| `src/run.js` | command runner, `gh` checks |
| `src/tty.js` | tells clack and ora this console can draw box characters |
| `src/gitignore.js` | the baseline ignore file |

`@clack/prompts` for the prompts, `ora` for the spinner (clack’s own always commits a line when
it stops, which would split the report in two), `picocolors` for colour.

Everything the spinner covers runs through `spawn`, not `spawnSync` — a synchronous child blocks
the event loop, so the spinner would freeze on its first frame for the whole push.

In a plain PowerShell console, clack and ora both decide Unicode isn’t supported and the frame
degrades to `T`, `o` and `|`. It isn’t true — the console draws `✓` fine — so `src/tty.js` says
so before they load. `NW_ASCII=1` opts out.

Plain JS with JSDoc types. No build step, no tests, not published — `npm link` and go.

## Deliberately not here

- **A registry file.** An earlier draft appended every create to `C:\dev\.registry.tsv`. Once the
  "why does this exist?" prompt was cut, every remaining column (path, bucket, name, date, remote)
  was already readable off disk — so the file was a copy that would drift the moment anything got
  renamed. Read the folders instead.
- **A README generator.** Without a "why" line it was just `# name` and nothing else.
- **`adopt` / `doctor`.** `nw` only helps from now on. The 71 already-broken folders need a
  different tool.
- **A remembered "open in" preference.** Same species as the registry file — invisible state that
  changes what an identical command does. `-e` covers the case it was meant to solve.
- **Opening two things at once.** An editor *and* a terminal is a real want, but it doubles the
  focus-stealing problem for a keystroke you'd save twice a week.
- **The Claude desktop app**, until it documents a way to be handed a directory.
