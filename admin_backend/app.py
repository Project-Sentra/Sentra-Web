"""
app.py - Main Flask Application Entry Point
=============================================
Initializes the Flask web server, configures CORS for cross-origin requests
from the React frontend, and establishes the Supabase database connection.

This file is the starting point of the admin backend. It:
  1. Loads environment variables from a .env file
  2. Creates a Flask app with CORS enabled (allows frontend at any origin)
  3. Connects to Supabase (hosted PostgreSQL) using URL + anon key
  4. Imports all API route modules from routes.py
  5. Starts the development server on port 5000

Environment Variables Required (in .env):
  SUPABASE_URL - Your Supabase project URL (e.g. https://xyz.supabase.co)
  SUPABASE_KEY - Your Supabase anon/public API key
"""

from flask import Flask, request, make_response
from flask_cors import CORS
from supabase import create_client, Client
from dotenv import load_dotenv
import os
import sys

# Load environment variables from .env file in the same directory
load_dotenv()

# Fix the __main__ / app double-import problem:
# When run via `python app.py`, this module is loaded as "__main__".
# Route files do `from app import app, supabase`, which would re-import
# this file as a *separate* module named "app", creating a second Flask
# instance.  All @app.route() decorators would register on that second
# instance while app.run() serves the first one → every route returns 404.
# The line below makes both names point to the same module object.
if __name__ == "__main__":
    sys.modules.setdefault("app", sys.modules["__main__"])

# ==========================================
# Flask App Initialization
# ==========================================

app = Flask(__name__)

# Enable CORS for all origins so the React frontend (port 5173) can call the API.
# In production, restrict this to your actual frontend domain.
CORS(app, resources={r"/api/*": {"origins": "*"}})


@app.before_request
def handle_preflight():
    """
    Catch all OPTIONS preflight requests early and return 200.
    The flask-cors after_request hook will add the CORS headers.
    """
    if request.method == "OPTIONS":
        return make_response(), 200

# ==========================================
# Supabase Database Configuration
# ==========================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Fail fast if credentials are missing - no point starting without a database
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError(
        "Missing required environment variables: SUPABASE_URL and SUPABASE_KEY must be set in .env file"
    )

# Create the Supabase client used by all route handlers in routes_*.py
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ==========================================
# Import Routes
# ==========================================

# All API endpoints are defined in routes_*.py and registered by routes.py.
# Importing routes registers them with the Flask app instance above.
import routes  # noqa: E402, F401

# ==========================================
# Development Server
# ==========================================

if __name__ == "__main__":
    print(f"Connected to Supabase: {SUPABASE_URL}")
    print("Server starting on http://127.0.0.1:5000 ...")
    # debug=True enables auto-reload on code changes and detailed error pages.
    # Do NOT use debug=True in production.
    app.run(debug=True, port=5000)
