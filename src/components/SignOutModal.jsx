import { useEffect } from "react";
import { LogOut, X } from "lucide-react";
import "./SignOutModal.css";

export default function SignOutModal({ isOpen, onClose, onConfirm }) {
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="signout-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="signout-modal-title"
    >
      <div
        className="signout-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="signout-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="signout-modal-icon-wrap">
          <LogOut size={24} />
        </div>

        <h3 id="signout-modal-title" className="signout-modal-title">
          Sign Out
        </h3>
        <p className="signout-modal-desc">
          Are you sure you want to sign out? You will need to sign in again to access your account.
        </p>

        <div className="signout-modal-actions">
          <button
            type="button"
            className="signout-modal-btn cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="signout-modal-btn confirm"
            onClick={onConfirm}
          >
            Yes, Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
