from flask import Flask
from flask_cors import CORS
from supabase import create_client, Client
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# ==========================================
# Configurations & Initialization
# ==========================================
app = Flask(__name__)
CORS(app)

# Supabase Configuration
SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://zjbzxbymneuouuhenown.supabase.co')
SUPABASE_KEY = os.getenv('SUPABASE_KEY', 'sb_publishable_dcAdQIkVJygdHSi7FG67jQ_RqRpI__L')

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ==========================================
# Import Routes (APIs)
# ==========================================
from routes import *

# ==========================================
# Main Execution
# ==========================================
if __name__ == '__main__':
    print(f"Connected to Supabase: {SUPABASE_URL}")
    print("Server starting on port 5000...")
    app.run(debug=True, port=5000)
