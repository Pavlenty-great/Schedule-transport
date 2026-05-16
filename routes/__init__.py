from flask import Blueprint
from .main import main_bp
from .auth import auth_bp
from .dispatcher import dispatcher_bp
from .admin import admin_bp


def register_blueprints(app):
    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(dispatcher_bp)
    app.register_blueprint(admin_bp)