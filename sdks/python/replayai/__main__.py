"""Allow ``python -m replayai`` as an alternative to the ``replayai`` script.

This avoids the Windows PATH warning that occurs when installing with
``pip install --user`` (the script is installed to a user-scripts directory
that may not be on PATH).

Usage::

    python -m replayai ui
    python -m replayai record my_agent.py --project support
    python -m replayai test tests/replay/
"""
import sys

from .cli import main

if __name__ == "__main__":
    sys.exit(main())
