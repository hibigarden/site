# github markdown

enabled by default. adds alerts, tables, task lists, strikethrough, and automatic links through the flavor api. ordinary markdown remains compatible.

## alerts

[github alerts](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#alerts) support `NOTE`, `TIP`, `IMPORTANT`, `WARNING`, and `CAUTION`:

```markdown
> [!WARNING]
> hello
```

normal and split view show an editable callout; source mode keeps the original markdown. in the rich editor, type `> `, then `[!WARNING]` and enter to create one. formatted paragraphs, lists, and code blocks work inside alerts. exported documentation uses the same styles and theme colors. unrecognized markers remain ordinary quotes.

## flavors

settings → syntax offers separate switches for tables, tasks, strikethrough, and alerts. disabled features remain literal markdown in rich editing and exported documentation; re-enabling restores formatting.

automatic mode accepts enabled dialect features and identifies github syntax when present. choose an explicit dialect from the flavor status pill or command palette. choosing plain markdown or disabling this extension keeps unsupported source intact; use source view to edit those constructs until their flavor is enabled again.

author: may. uses mit-licensed tiptap and marked, credited in hibi's open source licenses.
