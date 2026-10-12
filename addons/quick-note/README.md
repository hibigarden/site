# Quick note

Quick note captures a Markdown note while Hibi is running, even when another application has focus. Enable the addon in **Settings → Addons**. Its default global shortcut is `Cmd/Ctrl+Alt+N`. You can also choose **Quick note: capture** from the command palette.

In **Settings → Quick note**, choose the current workspace, a recent workspace, or use **Choose workspace…** to select another folder as a workspace. Then select its root or a folder. Set a different global shortcut using an Electron accelerator such as `CommandOrControl+Alt+N`, or clear the field to disable it. Press **Save settings** to apply your choices. If another application owns the shortcut, choose a different one; the command palette action remains available.

The shortcut and the command open a capture window of its own, above other applications and on the display with the pointer. Hibi's main window is not shown or brought forward. The window is a small Hibi editor with the formatting toolbar. Press **Save** or `Cmd/Ctrl+Enter` to create a new `.md` file in the selected folder; the window confirms the save and closes.

The note's first heading becomes its file name; without one, Hibi uses the default title. **Ask for a title** starts each note with the default title as its heading. Repeated names receive a number so an existing note is never replaced.

Press `Escape`, `Cmd/Ctrl+W`, or **Cancel** to close the window without saving. Your unsaved note is kept, even if Hibi quits unexpectedly, and shown the next time the window opens. A note saves to the destination currently set, which the bar at the bottom of the window shows. Only one capture window is open at a time, and Hibi remembers its size and position on each display.

The shortcut works only while Hibi is running. On macOS, it keeps working after you close Hibi's last window. Quitting Hibi releases the shortcut.
