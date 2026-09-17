const stage = document.querySelector(".demo");
const frame = stage.querySelector("iframe");
const shell = stage.querySelector(".demo-shell");
const loader = stage.querySelector(".demo-loader");

function scaleDemo() {
  const scale = Math.min(
    stage.clientWidth / Number(frame.width),
    stage.clientHeight / Number(frame.height),
    1,
  );
  shell.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

const observer = new ResizeObserver(scaleDemo);
observer.observe(stage);
scaleDemo();

let contentObserver;
let watchedDocument;
function watchEditor() {
  const demoDocument = frame.contentDocument;
  const demoRoot = demoDocument?.getElementById("root");
  if (!demoRoot || demoDocument === watchedDocument) return;
  watchedDocument = demoDocument;
  contentObserver?.disconnect();
  stage.dataset.ready = "false";
  stage.setAttribute("aria-busy", "true");
  frame.inert = true;
  frame.setAttribute("aria-hidden", "true");
  loader.removeAttribute("aria-hidden");

  const reveal = () => {
    if (!demoRoot.querySelector('.tiptap[contenteditable="true"]')) return;
    contentObserver.disconnect();
    demoDocument.fonts.ready.then(() =>
      requestAnimationFrame(() => {
        if (frame.contentDocument !== demoDocument) return;
        stage.dataset.ready = "true";
        stage.setAttribute("aria-busy", "false");
        frame.inert = false;
        frame.removeAttribute("aria-hidden");
        loader.setAttribute("aria-hidden", "true");
      }),
    );
  };
  contentObserver = new MutationObserver(reveal);
  contentObserver.observe(demoRoot, { childList: true, subtree: true });
  reveal();
}

frame.addEventListener("load", watchEditor);
if (frame.contentDocument?.readyState === "complete") watchEditor();
