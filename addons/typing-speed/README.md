# typing speed

optional extension by may. enable in settings → addons.

two status pills show estimated words/minute and characters/minute for the current typing session, marked with `≈`. divide typed characters by elapsed time from the first to latest input, then extrapolate to one minute. the first second uses a one-second minimum to avoid a single keystroke producing an extreme rate. one word means five characters, including spaces and line breaks.

the rate holds between keystrokes and resets after five seconds without typing. the next input begins a fresh session. these are speed estimates, not character or word totals.

counts committed editor typing, including ime input. paste, deletions, vim commands, shortcuts, search, and settings do not count. disabling the extension removes listeners, timer, and pills.

uses `context.editor.onInput` and `context.statusBar.register`. no note content is retained by the counter.
