import { useEffect, useRef } from "react";
import { FaTimes } from "react-icons/fa";

// Shared focused layer for story setup and conversations. The hub stays mounted.
export function StoryModal({
  children,
  label,
  onClose,
  className = "",
  testId,
}) {
  const panel = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (
      panel.current?.querySelector("[data-autofocus]") ??
      panel.current?.querySelector("button:not(:disabled)")
    )?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  const keys = (event) => {
    if (event.key === "Escape" && onClose) {
      event.preventDefault();
      onClose();
    }
    if (event.key !== "Tab") return;
    const items = [
      ...panel.current.querySelectorAll(
        'button:not(:disabled), select, input, [tabindex="0"]',
      ),
    ];
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <div
      className="atlas-modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-testid={testId}
        className={`atlas-modal-panel ${className}`}
        onKeyDown={keys}
      >
        {onClose && (
          <button
            className="atlas-modal-close"
            onClick={onClose}
            aria-label="Return to map"
          >
            <FaTimes />
          </button>
        )}
        {children}
      </section>
    </div>
  );
}
