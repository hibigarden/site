# keybeats for hibi

mechanical keyboard sounds for normal, markdown, and split source editors. enable **keybeats** in settings → addons. it is off by default. its settings page offers 13 keyboard profiles, volume, and mute. the toolbar action toggles mute; hiding the toolbar keeps keyboard sounds enabled.

ported by **may** (discord `1262793452236570667`) from [keyBeats by Yug Bhanushali](https://github.com/YugBhanushali/keyBeats), revision `570f9c84866be4aad100d3acac29990fba5c657a`. keyboard recordings originate from [kbsim by Thomas Lai](https://github.com/tplai/kbsim), revision `ba103f3b0afa9dab80447aa2e7e2ed80b6bd80e4`.

both projects use MIT licenses. their original notices remain in [LICENSE.keybeats.md](LICENSE.keybeats.md) and [LICENSE.kbsim.md](LICENSE.kbsim.md), and appear in hibi → open source licenses. the profile mappings and 150 shipped recordings preserve upstream keyboard sounds. unused recordings are omitted; missing MX Blue special-key samples use the original generic fallback.

the hibi port uses `context.editor.onKeyEvent` for editor-only press/release events and `context.toolbar` for mute. it does not monitor the system keyboard or request accessibility permissions. settings, search, palette, properties inputs, and dialogs do not produce sounds. command modifiers, composition events, and automatic key repeats are ignored. no keystrokes are stored or transmitted.

the audio engine loads on enable. only the chosen profile is fetched and decoded, locally; other profiles load on demand. buffers are cached while enabled. profile changes clear held keys, missing/not-yet-ready sounds are skipped, and stopping the addon removes listeners, toolbar actions, and the audio context. sounds already in progress stop on mute, blur, profile change, or disable. background test windows remain muted.
