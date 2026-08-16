from __future__ import annotations

import os

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request

from app.utils.security import apply_security_headers

load_dotenv()


def create_app() -> Flask:
    app = Flask(
        __name__,
        template_folder=os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates"),
        static_folder=os.path.join(os.path.dirname(os.path.dirname(__file__)), "static"),
    )

    app.config["JSON_SORT_KEYS"] = False
    app.config["MAX_CONTENT_LENGTH"] = 1 * 1024 * 1024  # 1 MB request cap

    from app.routes import bp
    app.register_blueprint(bp)

    @app.after_request
    def _add_security_headers(response):
        return apply_security_headers(response)

    @app.errorhandler(404)
    def not_found(_err):
        if request.path.startswith("/api/"):
            return jsonify({"success": False, "error": "Not found."}), 404
        return render_template("index.html"), 404

    @app.errorhandler(500)
    def server_error(_err):
        return jsonify({"success": False, "error": "An unexpected server error occurred."}), 500

    return app
