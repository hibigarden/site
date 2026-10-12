export default {
  "id": "review",
  "name": "Review",
  "description": "Find repeated words and common English typos.",
  "apiVersion": 2,
  "kind": "extension",
  "version": "1.0.0",
  "authors": [
    {
      "discordId": "1262793452236570667",
      "displayName": "may"
    }
  ],
  "defaultEnabled": false,
  "analysis": {
    "entry": "analysis.js"
  },
  "capabilities": [
    "ui"
  ],
  "startup": "background"
}
