"""Configuration for the ReplayAI Python SDK.

Reads from environment variables on import; overrides are applied via
:func:`configure`. Redaction patterns default to common secret shapes.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from typing import List, Optional


# Default redaction patterns. Each is applied as a regex against the textual
# representation of every step input/output before it is written.
#
# NOTE: the overly-broad ``[A-Z0-9]{28,}`` heuristic that earlier versions
# used is intentionally removed — it produced false positives on short UUIDs,
# hashes, and Base64 fragments. High-entropy detection in ``redact.py``
# handles those cases more precisely with a whitelist guard.
DEFAULT_REDACT_PATTERNS: List[str] = [
    # OpenAI API keys: sk-, sk-proj-, sk-svcacct-, sk-admin- prefixes.
    r"sk-(?:proj|svcacct|admin)?-?[a-zA-Z0-9]{20,}",
    r"Bearer\s+[a-zA-Z0-9._\-]+",    # Authorization headers / tokens
    r"password=[^\s&]+",             # password=... in URLs / form bodies
    r"[\"']?api[_-]?key[\"']?\s*[:=]\s*[\"']?[a-zA-Z0-9]{20,}",  # api_key=...
]


def _parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_float(value: str | None, default: float) -> float:
    if value is None or value.strip() == "":
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _parse_patterns(raw: Optional[str]) -> Optional[List[str]]:
    """Split a comma-separated string of regex patterns into a list."""
    if raw is None or raw.strip() == "":
        return None
    return [p.strip() for p in raw.split(",") if p.strip()]


@dataclass
class Config:
    """Runtime configuration for the SDK."""

    project: Optional[str] = None
    token: Optional[str] = None
    storage: str = "cloud"
    storage_path: str = "./ReplayAI"
    api_url: str = "http://localhost:3000"
    dashboard_url: str = "http://localhost:3000"
    sample_rate: float = 1.0
    strict: bool = False
    # HTTP request timeout in seconds (applies to every store request).
    timeout: float = 30.0
    # Hard ceiling on the number of steps persisted per session.
    max_steps: int = 200
    # When True, sampling that would drop a session is bypassed if the
    # session ended in ``failed`` status — failures are always recorded.
    always_record_failures: bool = True
    redact_patterns: List[str] = field(
        default_factory=lambda: list(DEFAULT_REDACT_PATTERNS)
    )
    # Compiled patterns cached for the redactor.
    _compiled_patterns: List[re.Pattern] = field(
        default_factory=list, init=False, repr=False
    )

    def __post_init__(self) -> None:
        self._recompile()

    def _recompile(self) -> None:
        self._compiled_patterns = [
            re.compile(p) for p in self.redact_patterns if p
        ]

    @property
    def compiled_redact_patterns(self) -> List[re.Pattern]:
        return self._compiled_patterns

    def to_dict(self) -> dict:
        return {
            "project": self.project,
            "token": self.token,
            "storage": self.storage,
            "storage_path": self.storage_path,
            "api_url": self.api_url,
            "dashboard_url": self.dashboard_url,
            "sample_rate": self.sample_rate,
            "strict": self.strict,
            "timeout": self.timeout,
            "max_steps": self.max_steps,
            "always_record_failures": self.always_record_failures,
            "redact_patterns": list(self.redact_patterns),
        }


def _load_from_env() -> Config:
    """Build a Config from the documented environment variables."""
    project = os.environ.get("REPLAYAI_PROJECT")
    token = os.environ.get("REPLAYAI_TOKEN")
    storage = os.environ.get("REPLAYAI_STORAGE", "cloud")
    storage_path = os.environ.get("REPLAYAI_STORAGE_PATH", "./ReplayAI")
    api_url = os.environ.get("REPLAYAI_API_URL", "http://localhost:3000")
    dashboard_url = os.environ.get("REPLAYAI_DASHBOARD_URL", "http://localhost:3000")
    sample_rate = _parse_float(os.environ.get("REPLAYAI_SAMPLE_RATE"), 1.0)
    strict = _parse_bool(os.environ.get("REPLAYAI_STRICT"), False)
    timeout = _parse_float(os.environ.get("REPLAYAI_TIMEOUT"), 30.0)
    max_steps_env = os.environ.get("REPLAYAI_MAX_STEPS")
    try:
        max_steps = int(max_steps_env) if max_steps_env and max_steps_env.strip() else 200
    except (TypeError, ValueError):
        max_steps = 200
    always_record_failures = _parse_bool(
        os.environ.get("REPLAYAI_ALWAYS_RECORD_FAILURES"), True
    )

    env_patterns = _parse_patterns(os.environ.get("REPLAYAI_REDACT_PATTERNS"))
    redact_patterns = env_patterns if env_patterns else list(DEFAULT_REDACT_PATTERNS)

    return Config(
        project=project,
        token=token,
        storage=storage,
        storage_path=storage_path,
        api_url=api_url.rstrip("/"),
        dashboard_url=dashboard_url,
        sample_rate=sample_rate,
        strict=strict,
        timeout=timeout,
        max_steps=max_steps,
        always_record_failures=always_record_failures,
        redact_patterns=redact_patterns,
    )


# Module-level singleton. Imported throughout the SDK; mutated by `configure`.
_config: Config = _load_from_env()

# Module-level strict flag — also exposed as `replayai.strict_mode`.
# Mirrored from the config so callers can do `replayai.strict_mode = True`.
strict_mode: bool = _config.strict


def get_config() -> Config:
    """Return the active Config singleton."""
    return _config


def configure(
    *,
    project: Optional[str] = None,
    token: Optional[str] = None,
    storage: Optional[str] = None,
    storage_path: Optional[str] = None,
    api_url: Optional[str] = None,
    dashboard_url: Optional[str] = None,
    sample_rate: Optional[float] = None,
    strict: Optional[bool] = None,
    timeout: Optional[float] = None,
    max_steps: Optional[int] = None,
    always_record_failures: Optional[bool] = None,
    redact_patterns: Optional[List[str]] = None,
) -> Config:
    """Override SDK configuration programmatically.

    Only the supplied keyword arguments are changed; others retain their
    current value. Returns the updated Config for chaining.
    """
    global strict_mode
    if project is not None:
        _config.project = project
    if token is not None:
        _config.token = token
    if storage is not None:
        _config.storage = storage
    if storage_path is not None:
        _config.storage_path = storage_path
    if api_url is not None:
        _config.api_url = api_url.rstrip("/")
    if dashboard_url is not None:
        _config.dashboard_url = dashboard_url
    if sample_rate is not None:
        _config.sample_rate = float(sample_rate)
    if strict is not None:
        _config.strict = bool(strict)
        strict_mode = _config.strict
    if timeout is not None:
        _config.timeout = float(timeout)
    if max_steps is not None:
        _config.max_steps = int(max_steps)
    if always_record_failures is not None:
        _config.always_record_failures = bool(always_record_failures)
    if redact_patterns is not None:
        _config.redact_patterns = list(redact_patterns)
        _config._recompile()
    return _config


def _sync_strict_flag() -> None:
    """Keep the module-level strict_mode flag in sync with config.strict."""
    global strict_mode
    strict_mode = _config.strict
