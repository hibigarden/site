# hibi website

hibi is a free markdown editor. [try it online](https://www.hibi.garden) or [download the app](https://github.com/schmayterling/hibi/releases).

visit the [addon catalog](https://www.hibi.garden/addons/), [documentation](https://docs.hibi.garden), or [discord](https://discord.gg/v9r4cABUP2).

link directly to an addon at `/addons/<id>`, such as [Doom](https://www.hibi.garden/addons/hibi-doom) or [Vim](https://www.hibi.garden/addons/vim). each page shows its authors, GitHub repository, and installation or opening link. community pages read the live directory, so new listings do not need a website build. addon and theme pages send their title, description, canonical URL, sharing metadata, structured data, and visible details in the initial HTML. `/sitemap.xml` includes built-in and live community entries; responses cache for five minutes. missing entries return 404, while an unavailable directory returns 503 so an outage does not remove listings from search.

the addon catalog lists the addons built into hibi and community addons from the [addon directory](https://github.com/hibigarden/addons-repository). the page reads the directory's public `catalog.json` when it opens; community entries cannot replace a built-in addon's ID. install links (`hibi://addons/install?id=…`) need a version of hibi that supports them, and hibi still checks signatures and asks before installing.
