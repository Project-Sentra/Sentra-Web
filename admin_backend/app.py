from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime
import os

# ==========================================
# Configurations & Initialization
# ==========================================
app = Flask(__name__)
CORS(app) # Frontend එකට සම්බන්ධ වෙන්න ඉඩ දෙනවා

# Database Configuration
# Mac වල Postgres.app සමඟ password අවශ්‍ය නොවන අවස්ථා සඳහා
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://localhost/sentra_db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# ==========================================
# Database Models (Tables)
# ==========================================

# User Table - පරිශීලක තොරතුරු
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), default='admin')

    def __repr__(self):
        return f'<User {self.email}>'

# ParkingSpot Table - වාහන නැවැත්වීමේ ස්ථාන
class ParkingSpot(db.Model):
    __tablename__ = 'parking_spots'
    id = db.Column(db.Integer, primary_key=True)
    spot_name = db.Column(db.String(10), unique=True, nullable=False) # (Example: A1, A2)
    is_occupied = db.Column(db.Boolean, default=False)

# ParkingSession Table - In/Out log with timestamps
class ParkingSession(db.Model):
    __tablename__ = 'parking_sessions'
    id = db.Column(db.Integer, primary_key=True)
    plate_number = db.Column(db.String(20), nullable=False)
    spot_name = db.Column(db.String(10), nullable=False)
    entry_time = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    exit_time = db.Column(db.DateTime)
    duration_minutes = db.Column(db.Integer)
    amount_lkr = db.Column(db.Integer)

# ==========================================
# Import Routes (APIs) - වැදගත්ම කොටස
# ==========================================
# අපි හදපු routes.py file එක මෙතනදී සම්බන්ධ කරනවා.
# මේක අනිවාර්යයෙන්ම 'app' සහ 'db' හැදුවට පස්සේ වෙන්න ඕනේ.
# ඒ වගේම main execution block එකට කලින් වෙන්න ඕනේ.
from routes import *

# ==========================================
# Main Execution (ප්‍රධාන ක්‍රියාකාරීත්වය)
# ==========================================
if __name__ == '__main__':
    # App context එක තුළ database tables සාදයි (නැත්නම්)
    with app.app_context():
        db.create_all()
        print("Database tables checked/created successfully!")

    # Flask server එක debug mode එකේ ආරම්භ කරයි
    app.run(debug=True, port=5000)