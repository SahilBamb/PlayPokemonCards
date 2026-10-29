import { useRef, useState } from "react";
import { FaArrowRight, FaHandPointer } from "react-icons/fa";
import "./card-opener.css";
import "./card-shop.css";

// One irregular seam keeps the cut, loose foil, and open wrapper aligned.
const TEAR_EDGE = [
  [0, 10],
  [9, 8],
  [16, 11],
  [22, 6],
  [25, 12],
  [35, 9],
  [44, 10],
  [50, 14],
  [55, 8],
  [65, 11],
  [73, 7],
  [79, 12],
  [88, 10],
  [96, 13],
  [101, 8],
  [113, 10],
  [122, 6],
  [127, 11],
  [138, 9],
  [146, 13],
  [153, 10],
  [162, 12],
  [168, 7],
  [174, 11],
  [184, 8],
  [193, 12],
  [202, 9],
  [208, 14],
  [214, 10],
  [224, 11],
  [233, 6],
  [238, 12],
  [249, 9],
  [258, 13],
  [264, 8],
  [275, 11],
  [283, 9],
  [292, 13],
  [297, 7],
  [305, 11],
  [313, 8],
  [320, 10],
];
const TEAR_POINTS = TEAR_EDGE.map(([x, y]) => `${x},${y}`).join(" ");
const OPEN_WRAPPER_CLIP = `polygon(${TEAR_EDGE.map(
  ([x, y]) => `${2 + x * 0.3}% ${14 + (y - 10) * 0.2}%`,
).join(", ")}, 97% 98%, 3% 98%)`;
const LOOSE_FOIL_CLIP = `polygon(0 0, 100% 0, ${[...TEAR_EDGE]
  .reverse()
  .map(([x, y]) => `${x / 3.2}% ${((13 + (y - 10) * 0.2) / 15) * 100}%`)
  .join(", ")})`;

export function PackTear({ set, tearing, onOpen, disabled }) {
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [started, setStarted] = useState(false);
  const drag = useRef(null);
  const imageStyle = {
    backgroundImage: `url("${set.image}")`,
    clipPath: LOOSE_FOIL_CLIP,
  };
  const updateDrag = (event) => {
    if (!drag.current || event.pointerId !== drag.current.pointerId) return;
    const amount = Math.max(
      drag.current.progress,
      Math.min(1, (event.clientX - drag.current.left) / drag.current.width),
    );
    drag.current.progress = amount;
    setProgress(amount);
    if (amount >= 0.96) {
      drag.current = null;
      setDragging(false);
      onOpen();
    }
  };
  const stopDrag = () => {
    drag.current = null;
    setDragging(false);
    // An interrupted gesture can be resumed from the torn edge.
  };
  return (
    <div
      className={`co-pack ${tearing ? "tearing" : ""} ${dragging ? "dragging" : ""} ${progress > 0 ? "partly-torn" : ""} ${started ? "tear-started" : ""}`}
      style={{
        "--co-tear-progress": progress,
        "--co-pack-open-edge": OPEN_WRAPPER_CLIP,
      }}
      data-testid="opener-pack"
    >
      <span className="co-pack-glow" />
      <span className="co-pack-body">
        <img
          src={set.image}
          alt={`${set.name} booster pack`}
          draggable={false}
        />
      </span>
      <span className="co-pack-strip" style={imageStyle} />
      <svg
        className="co-tear-line"
        viewBox="0 0 320 20"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polyline className="co-tear-cut" points={TEAR_POINTS} />
        <polyline className="co-tear-foil-upper" points={TEAR_POINTS} />
        <polyline className="co-tear-foil-lower" points={TEAR_POINTS} />
        <path
          className="co-tear-fibers"
          d="M22 6l-2 -3 M50 14l3 3 M101 8l-1 -4 M146 13l3 4 M208 14l-2 3 M233 6l2 -3 M292 13l3 3"
        />
      </svg>
      <span className="co-tear-spark" />
      {!tearing && (
        <>
          {!started && (
            <div className="co-tear-guide" aria-hidden="true">
              <span className="co-tear-dots" />
              <span className="co-tear-direction">
                <FaHandPointer />
                <FaArrowRight />
              </span>
            </div>
          )}
          <div
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-label={`Tear open ${set.name} pack from left to right`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-valuetext={`${Math.round(progress * 100)} percent torn. Drag right or press the right arrow. Press Enter to open.`}
            aria-disabled={disabled}
            className="co-tear-target"
            data-testid="opener-tear"
            onPointerDown={(event) => {
              if (
                disabled ||
                (event.pointerType === "mouse" && event.button !== 0)
              )
                return;
              const rect = event.currentTarget.getBoundingClientRect();
              const start = (event.clientX - rect.left) / rect.width;
              if (start > progress + 0.22) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = {
                pointerId: event.pointerId,
                left: rect.left,
                width: rect.width,
                progress,
              };
              setStarted(true);
              setDragging(true);
            }}
            onPointerMove={updateDrag}
            onPointerUp={(event) => {
              updateDrag(event);
              stopDrag();
            }}
            onPointerCancel={stopDrag}
            onLostPointerCapture={stopDrag}
            onKeyDown={(event) => {
              if (disabled) return;
              if (["Enter", " "].includes(event.key)) {
                event.preventDefault();
                setStarted(true);
                onOpen();
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                setStarted(true);
                const amount = Math.min(1, progress + 0.2);
                setProgress(amount);
                if (amount >= 0.96) onOpen();
              }
            }}
          />
          {!started && (
            <span className="co-pack-drag-label">
              Drag across the top <FaArrowRight />
            </span>
          )}
        </>
      )}
    </div>
  );
}
