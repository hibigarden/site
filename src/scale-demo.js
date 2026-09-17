const stage = document.querySelector(".demo");
const frame = stage.querySelector("iframe");

function scaleDemo() {
  const scale = Math.min(
    stage.clientWidth / Number(frame.width),
    stage.clientHeight / Number(frame.height),
    1,
  );
  frame.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

const observer = new ResizeObserver(scaleDemo);
observer.observe(stage);
scaleDemo();
