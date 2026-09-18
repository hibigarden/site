# hibi website

hibi is a free markdown editor for local files. this repository contains its website and browser demo.

[visit the website](https://www.hibi.garden) · [download hibi](https://github.com/schmayterling/hibi/releases) · [read the docs](https://docs.hibi.garden) · [join discord](https://discord.gg/v9r4cABUP2)

## try the editor

type in the demo, switch editing modes, or change the theme. use save to download your document. your writing stays in the browser and is lost when you reload or close the page unless you save it.

keybeats plays typing sounds. use the speaker button in the formatting toolbar to mute them. settings, opening local files, and desktop addons are available in the desktop app.

browse the [addon catalog](https://www.hibi.garden/addons/) to see what each addon does and how to use it.

## run the website locally

```sh
npm ci
npm run dev
```

open the address printed in your terminal.

## check and publish changes

```sh
npm test
npm run build
npm run preview
```

the tests check addon loading and safe rendering of addon readmes. preview serves the built site locally. upload the contents of `dist/` to a static web host to publish it.

## source and maintenance

the demo uses [copied hibi components](vendor/hibi/README.md). addon descriptions sync from the main hibi repository; edit them there so the next sync keeps your changes.

[notes for ai agents](docs/ai-agents/site.md) cover the file layout, sync boundaries, and design constraints.
