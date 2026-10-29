import { useEffect, useRef, useState } from "react";
import { FaArrowRight, FaCoins } from "react-icons/fa";
import { AtlasPortrait } from "./StoryAtlas.jsx";

// Kept public for the existing story progression checks.
// eslint-disable-next-line react-refresh/only-export-components
export function dialogueBeats({ scene, name, image, lines }) {
  if (Array.isArray(scene) && scene.length) return scene;
  return (lines ?? []).map((text) => ({ name, image, text }));
}

export function DialogueBox({
  name,
  image,
  lines,
  scene,
  onDone,
  doneLabel = "Continue",
  onCancel,
  cancelLabel = "Maybe Later",
  context,
  sceneStyle,
}) {
  const beats = dialogueBeats({ scene, name, image, lines });
  const [i, setI] = useState(0);
  const container = useRef(null);
  const beat = beats[i] ?? {};
  const last = i >= beats.length - 1;
  const speaker = beat.name ?? name;
  const portrait = beat.image ?? image;
  const advance = () => (last ? onDone?.() : setI(i + 1));
  useEffect(() => {
    const previous = document.activeElement;
    container.current?.querySelector("button")?.focus();
    return () => previous?.focus?.();
  }, []);
  const keys = (event) => {
    if (event.key === "Escape" && onCancel) {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const buttons = [
      ...container.current.querySelectorAll("button:not(:disabled)"),
    ];
    const first = buttons[0];
    const final = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      final.focus();
    } else if (!event.shiftKey && document.activeElement === final) {
      event.preventDefault();
      first.focus();
    }
  };
  return (
    <div
      className="atlas-dialogue"
      data-testid="dialogue"
      role="dialog"
      aria-modal="true"
      aria-label={`${speaker ?? "Story"} dialogue`}
      onKeyDown={keys}
      ref={container}
    >
      <div
        className="atlas-dialogue-scene"
        style={
          sceneStyle ?? { backgroundImage: "url(/story-atlas/oak-lab.webp)" }
        }
      />
      <div className="atlas-dialogue-chapter">
        <span className="atlas-eyebrow">
          {context?.location ?? "A NEW CHAPTER"}
        </span>
        <h2>
          {context?.badge
            ? "The next badge awaits."
            : "Every journey has a story."}
        </h2>
      </div>
      {portrait && (
        <AtlasPortrait
          name={speaker}
          image={portrait}
          className="atlas-dialogue-character"
        />
      )}
      <section className="atlas-dialogue-box">
        <span className="atlas-speaker">{speaker}</span>
        <button
          className="atlas-dialogue-line"
          data-testid="dialogue-line"
          onClick={advance}
        >
          {beat.text}
        </button>
        {context?.coins && (
          <div className="atlas-dialogue-reward">
            <span>
              <FaCoins />
              {context.coins} coins
            </span>
            {context.badge && (
              <span>
                <img src={context.badge.image} alt="" />
                {context.badge.name}
              </span>
            )}
            <small>Victory rewards</small>
          </div>
        )}
        <div className="atlas-dialogue-controls">
          <span>
            {i + 1} / {beats.length}
            <small>Click the dialogue to continue</small>
          </span>
          <div>
            {last ? (
              <>
                {onCancel && (
                  <button
                    className="atlas-button secondary"
                    onClick={onCancel}
                    data-testid="dialogue-cancel"
                  >
                    {cancelLabel}
                  </button>
                )}
                <button
                  className="atlas-button primary"
                  onClick={onDone}
                  data-testid="dialogue-done"
                >
                  {doneLabel}
                  <FaArrowRight />
                </button>
              </>
            ) : (
              <button className="atlas-button primary" onClick={advance}>
                Continue
                <FaArrowRight />
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
