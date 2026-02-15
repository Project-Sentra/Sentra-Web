"""
routes.py - Route registry
=========================
Imports route modules so their Flask decorators register endpoints.
"""

# Shared helpers/constants
import routes_common  # noqa: F401

# Auth + admin
import routes_auth  # noqa: F401
import routes_users  # noqa: F401

# Core parking operations
import routes_vehicles  # noqa: F401
import routes_facilities  # noqa: F401
import routes_spots  # noqa: F401
import routes_reservations  # noqa: F401
import routes_sessions  # noqa: F401

# Billing
import routes_wallet  # noqa: F401
import routes_subscriptions  # noqa: F401

# Hardware + detections
import routes_cameras  # noqa: F401
import routes_gates  # noqa: F401
import routes_detections  # noqa: F401

# Notifications + analytics
import routes_notifications  # noqa: F401
import routes_dashboard  # noqa: F401

# System + compat
import routes_system  # noqa: F401
import routes_compat  # noqa: F401
