# Diagnostics

Inspect addon initialization, slow callbacks, frame stalls, and process CPU and memory use. Enable Diagnostics in **Settings → Addons**, then open its settings page. It is enabled by default with `npm run dev` and disabled by default in production builds. Your saved choice takes precedence.

Initialization timings include loading and starting each addon. Runtime activity covers callbacks called by Hibi and measured editor work. Async timings include waiting; they do not show how long the UI was blocked. A callback listed alongside a stall overlapped it, which is a clue rather than proof of its cause.

Measurements stay in memory. **Clear runtime samples** resets activity and stall counters without removing startup timings. Disabling the addon stops runtime recording. Hibi does not record document text or send these measurements anywhere.
