# Dictionary and thesaurus

Look up a word's definitions and synonyms without leaving your document. Lookups support English, Chinese (Mandarin, in simplified or traditional characters), Cantonese, Japanese, Filipino, and French. Enable **Dictionary and thesaurus** under **Settings → Addons**. It is off by default because lookups use online services.

Place the cursor in a word or select a word or phrase, then choose **Define word** or **Find synonyms** from the command palette or the editor's right-click menu. **Find synonyms** also has the default shortcut `Shift+F7`, which you can change under **Settings → Hotkeys**. Both commands work in the formatted editor and in Source view.

**Define word** shows each part of speech with numbered definitions and an example when one is available. **Find synonyms** shows synonyms and antonyms. Choose one of these words to replace the word you looked up. A capitalized word stays capitalized, and one undo restores the original. Press Escape to close the results and return to your document. Each result names its source and license.

## Languages

Hibi chooses the language from the word's script. Words with kana are looked up in Japanese. Words written only in Chinese characters use the language chosen under **Settings → Dictionary and thesaurus → Words in Chinese characters**, then the other Chinese-character languages. Words in Latin letters use the language chosen under **Words in Latin letters**, then English, Filipino, and French. When the Wiktionary page for a word has entries in several of these languages, **Define word** shows all of them, the first language that has an entry on top, without sending another request. Korean and other scripts are not supported yet.

Chinese and Japanese text has no spaces between words, so Hibi finds the word at the cursor using the system's word boundaries. If it picks too few or too many characters, select the exact word first. Cantonese definitions come from Wiktionary's Chinese entries, which also cover Mandarin.

Synonyms are available online for English only. Other languages need an offline pack; when one can be installed, the results offer **Install offline pack**.

## Privacy

Hibi sends nothing while you type. When you run a lookup that no installed offline pack can answer, the word you looked up is sent to one of these services:

- **Define word** sends the word to [Wiktionary](https://en.wiktionary.org/) through the Wikimedia REST API at `en.wiktionary.org`.
- **Find synonyms** sends English words to the [Datamuse API](https://www.datamuse.com/api/) at `api.datamuse.com`, once for synonyms and once for antonyms.

Only the word is sent, never the rest of your document. Hibi may ask you to allow each request. Answers are kept in memory until the addon is disabled or Hibi closes, so looking up the same word again does not send another request. Datamuse says it keeps a log of queries until the end of the day and then discards it.

## Services and limits

Wiktionary text is available under the [Creative Commons Attribution-ShareAlike 4.0 license](https://creativecommons.org/licenses/by-sa/4.0/). Wikimedia limits clients that identify themselves to 200 requests a minute; Hibi identifies itself in each request as Wikimedia's [API policy](https://www.mediawiki.org/wiki/Wikimedia_APIs/Access_policy) requires.

Datamuse allows up to 100,000 requests a day without a key. Its [API page](https://www.datamuse.com/api/) says it will require an API key for every request starting in early 2027. Synonym lookups may stop working at that point until Hibi supports a key. Thanks to Datamuse for providing the API.

If a service cannot be reached, is limiting requests, or has no entry for the word, the results explain what happened. Choose **Try again** after reconnecting or waiting a minute.
