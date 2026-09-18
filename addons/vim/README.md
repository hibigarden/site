# Vim

Turn on **Vim** in **Settings → Addons** to use Vim keys and commands in source views.

Use `:w` to save and `:q` to close a file. Shell commands, Vimscript, external Vim plugins, and `:w filename` are not supported.

In **Settings → Vim**, choose whether to start in insert mode. See the [Vim guide](../../../docs/guides/vim.md) for editing examples.

Turn on **Use Vim/Neovim config** to import your key mappings. This experimental option is off by default. Hibi looks for your Neovim config or `.vimrc`; use **Choose config…** for a separate keymap file and **Reload** after editing it. Your config is left unchanged.

Mappings can use Hibi's Vim commands and recorded macros. Lua functions, Vimscript expressions, and external plugin actions are unsupported. The settings page lists skipped mappings.

## Credits

The engine is by the [CodeMirror Vim contributors](https://github.com/replit/codemirror-vim). License notices are in Hibi's **Open source licenses**.
