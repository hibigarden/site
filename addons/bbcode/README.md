# BBCode

Enable BBCode in Settings → Addons to edit `.bbcode` and `.bbc` files. Side-by-side view shows a live preview. The toolbar inserts BBCode for emphasis, quotes, lists, code, links, and images. Choose **Export HTML** to save the preview.

Supported tags are `[b]`, `[i]`, `[u]`, `[s]`, `[quote]`, `[code]`, `[list]`, `[*]`, `[url]`, `[img]`, `[color]`, and `[size]`. Local images use paths relative to a saved document. HTTPS images are included in exported HTML but are blocked in the app’s offline preview. Forum-specific tags may appear as plain text.

```bbcode
[b]Hello[/b]
[url=https://example.com]Visit the site[/url]
```

## Credits

Parsing uses [BBob](https://github.com/JiLiZART/BBob), licensed under MIT.
