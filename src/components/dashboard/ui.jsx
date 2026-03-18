import React from "react";
import { getPriorityMeta, getShotStatusMeta, getStatusMeta } from "../dashboardModel.js";

export function ViewTab({ isActive, label, shortLabel, onClick }) {
  return (
    <button type="button" className={`view-tab ${isActive ? "is-active" : ""}`} onClick={onClick}>
      <span className="view-tab-dot" />
      <span className="view-tab-icon">{shortLabel}</span>
      <span className="view-tab-label">{label}</span>
    </button>
  );
}

export function OrbiterMark({ tone = "accent", small = false }) {
  return <span className={`orbiter-mark tone-${tone} ${small ? "is-small" : ""}`} aria-hidden="true" />;
}

export function StatusBadge({ value, kind = "status" }) {
  const meta =
    kind === "priority" ? getPriorityMeta(value) : kind === "shot" ? getShotStatusMeta(value) : getStatusMeta(value);
  return <span className={`status-badge kind-${kind} tone-${meta.tone}`}>{meta.label}</span>;
}

export function ProgressBar({ value, tone = "accent", striped = false, compact = false }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={`progress-bar tone-${tone} ${striped ? "is-striped" : ""} ${compact ? "is-compact" : ""}`}>
      <div className="progress-bar-fill" style={{ width: `${safeValue}%` }} />
    </div>
  );
}

export function DataPair({ label, value, meta }) {
  return (
    <div className="data-pair">
      <span>{label}</span>
      <strong>{value}</strong>
      {meta ? <small>{meta}</small> : null}
    </div>
  );
}
