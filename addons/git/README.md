# git

optional extension by may. enable in settings → addons, then open the repository root as your workspace. click the git status pill or use the git commands in the palette.

Git opens in the shared, resizable sidebar. Its view appears in the titlebar picker and supports pinning. Branches, changes, diffs, and commit controls stay beside the editor; commit-message drafts survive hiding or switching views while the addon remains enabled. Refresh reads repository status without locking editing.

## explorer integration

the explorer shows `M` for modified files, `A` for additions, `U` for untracked files, `R` for renames, and `!` for merge conflicts. changed files and their parent folders use theme status colors; folder dots and the workspace heading include change counts in their descriptions/tooltips. tooltips distinguish staged and unstaged changes. the existing unsaved-edit dot stays independent: git compares files on disk with the index and commit.

collapsed folders stay collapsed when status refreshes. renames mark both old and new parent folders. deleted files disappear from the normal explorer but still mark their remaining parent folders; the git sidebar lists them as `D`. folder counts also include changed files that the markdown explorer does not display.

status refreshes after workspace filesystem events, explicit refresh, and window focus. reads are debounced and run through a read-only native query without locking editor/save actions. git optional index writes are disabled to prevent refresh loops. when a linked worktree's git metadata lives outside the opened folder, focus or refresh updates changes made there by another git client. switching workspaces or disabling the extension clears its markers and ignores stale requests. ordinary folders show no git markers.

decorations use the shared [explorer decoration api](../../../docs/extensions/explorer-decorations.md). themes can override `status-success`, `status-warning`, `status-danger`, and `status-info`; older themes receive defaults.

- view branch, changed files, staged/unstaged diffs, and ahead/behind counts.
- stage or unstage individual paths, and commit staged changes with a message.
- switch local branches or create a tracking branch from a known remote branch.
- pull with fast-forward only, or push to the configured upstream. no forced pushes, resets, automatic merges, or automatic stashes.

pull and branch switching require a clean working tree and no unsaved editor changes. successful operations reload the active file and refresh the explorer. diffs and commits use disk/index content; save editor edits before staging them. remote operations run only after choosing their button or palette command. authentication is noninteractive: ssh uses your agent/configuration, and macos https uses git's keychain helper. other platforms can use ssh. credentials never appear in command arguments or plugin logs; error messages redact passwords in http urls.

git must be installed. operations time out after 90 seconds and cap output at 4 mib. hibi disables repository hooks, fsmonitor commands, custom credential helpers, external diff/textconv, automatic maintenance, and submodule recursion. external filters are not executed; files requiring a filter must be staged in a git client that supports that filter, preserving their encoding. commit signing is disabled for these noninteractive commits. repositories using special hooks, filters, signing, or divergent-history merges should use their normal git client for those operations.

git lives in trusted native addon code and uses argument arrays, never an interpolated shell command. branch and file operations must target names returned by fresh repository state. see [git hooks](https://git-scm.com/docs/githooks), [configuration](https://git-scm.com/docs/git-config), and [attributes](https://git-scm.com/docs/gitattributes).
