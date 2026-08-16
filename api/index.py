"""
Entry point used both by Vercel's Python runtime and local development.

Vercel's Python builder looks for a WSGI-compatible `app` object in this
file. Running this file directly (`python api/index.py`) also starts a
local Flask dev server for `http://127.0.0.1:5000`.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app  # noqa: E402

app = create_app()

if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "true").lower() == "true"
    port = int(os.environ.get("PORT", 5000))
    app.run(host="127.0.0.1", port=port, debug=debug)
