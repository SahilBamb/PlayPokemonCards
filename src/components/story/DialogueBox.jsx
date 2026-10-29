import { useState } from "react";
import { FaArrowRight, FaCoins } from "react-icons/fa";
import { AtlasPortrait } from "./StoryAtlas.jsx";
import { StoryModal } from "./StoryModal.jsx";

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
  cancelLabel = "Return to map",
  context,
  sceneStyle,
}) {
  const beats = dialogueBeats({ scene, name, image, lines });
  const [i, setI] = useState(0);
  const beat = beats[i] ?? {};
  const last = i >= beats.length - 1;
  const speaker = beat.name ?? name;
  const portrait = beat.image ?? image;
  const advance = () => {
    if (!last) setI(i + 1);
  };

  return (
    <StoryModal
      label={`${speaker ?? "Story"} dialogue`}
      onClose={onCancel}
      className="atlas-conversation-modal"
      testId="dialogue"
    >
      <div
        className="atlas-conversation-scene"
        style={
          sceneStyle ?? { backgroundImage: "url(/story-atlas/oak-lab.webp)" }
        }
      >
        <div className="atlas-conversation-title">
          <span className="atlas-eyebrow">
            KANTO · {context?.location ?? "A NEW CHAPTER"}
          </span>
          <h2>
            {context?.badge
              ? "The next badge awaits."
              : context?.coins
                ? "A challenger awaits."
                : "Your story continues."}
          </h2>
        </div>
        {portrait && (
          <AtlasPortrait
            name={speaker}
            image={portrait}
            className="atlas-conversation-character"
          />
        )}
      </div>
      <div className="atlas-conversation-copy">
        <span className="atlas-conversation-speaker">{speaker}</span>
        <button
          className="atlas-conversation-line"
          data-testid="dialogue-line"
          data-autofocus
          onClick={advance}
          aria-disabled={last}
        >
          {beat.text}
        </button>
        {!!context?.coins && (
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
            <small>
              {last ? "Ready when you are" : "Click the dialogue to continue"}
            </small>
          </span>
          <div>
            {onCancel && (
              <button
                className="atlas-button secondary"
                onClick={onCancel}
                data-testid="dialogue-cancel"
              >
                {cancelLabel}
              </button>
            )}
            {last ? (
              <button
                className="atlas-button primary"
                onClick={onDone}
                data-testid="dialogue-done"
              >
                {doneLabel}
                <FaArrowRight />
              </button>
            ) : (
              <button className="atlas-button primary" onClick={advance}>
                Continue
                <FaArrowRight />
              </button>
            )}
          </div>
        </div>
      </div>
    </StoryModal>
  );
}
