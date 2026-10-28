// The garden notes in the demo's sidebar, welcome first.
import butterflies from "./demo-notes/butterflies.md?raw";
import compost from "./demo-notes/compost.md?raw";
import gardenJournal from "./demo-notes/garden journal.md?raw";
import goldenAngle from "./demo-notes/golden angle.md?raw";
import plantingPlan from "./demo-notes/planting plan.md?raw";
import watering from "./demo-notes/watering.md?raw";
import welcome from "./demo-notes/welcome.md?raw";

export default [
  { name: "welcome.md", markdown: welcome },
  { name: "garden journal.md", markdown: gardenJournal },
  { name: "planting plan.md", markdown: plantingPlan },
  { name: "golden angle.md", markdown: goldenAngle },
  { name: "butterflies.md", markdown: butterflies },
  { name: "watering.md", markdown: watering },
  { name: "compost.md", markdown: compost },
];
