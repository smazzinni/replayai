// Central place for site-wide constants (repo URLs, socials, contact email).
// Keeping these here means the header, footer, CTA, and API all reference the
// same source of truth.

/** Canonical GitHub repository (also used by the /api/github stars endpoint). */
export const GITHUB_REPO = "smazzinni/replayai";
export const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;
export const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}`;

/** Where partner-program form submissions are delivered. */
export const PARTNER_EMAIL_TO = "info@rioforge.com";

// Package registry links (kept in sync with the SDK package metadata).
export const NPM_URL = "https://www.npmjs.com/package/@smazzinni/sdk";
export const PYPI_URL = "https://pypi.org/project/replayai-sdk/";

/** Social / community links. GitHub is real; others are placeholders. */
export const SOCIALS = {
  github: GITHUB_URL,
  discord: "#",
  reddit: "#",
  twitter: "#",
  youtube: "#",
} as const;
