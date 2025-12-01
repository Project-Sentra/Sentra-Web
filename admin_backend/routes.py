from flask import request, jsonify
from app import app, db, User, ParkingSpot # Importing app instance, database, and models
import uuid # For generating unique IDs if needed (currently unused but good practice)

# ==========================================
# User Registration (Sign Up) API
# ==========================================
# Handles POST requests to create a new user account
@app.route('/api/signup', methods=['POST'])
def signup():
    # Get JSON data sent from the Frontend
    data = request.get_json()
    email = data.get('email')
    password = data.get('password') # Note: In a real project, this password should be hashed!

    # Check if a user already exists with this email
    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        return jsonify({'message': 'User already exists!'}), 400 # 400 means Bad Request

    # Create a new user object
    # We default the role to 'admin' for this initial setup
    new_user = User(email=email, password=password, role='admin')

    # Add the new user to the database and commit changes
    db.session.add(new_user)
    db.session.commit()

    return jsonify({'message': 'User created successfully!'}), 201 # 201 means Created

# ==========================================
# User Login API
# ==========================================
# Handles POST requests to authenticate a user
@app.route('/api/login', methods=['POST'])
def login():
    # Get email and password sent from the Frontend
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    # Check if a user with this email exists in the Database
    user = User.query.filter_by(email=email).first()

    # If user exists and the password matches
    if user and user.password == password:
        # Note: In a real project, you should generate and return a JWT token here.
        # For now, we return a success message along with the user role and email.
        return jsonify({
            'message': 'Login successful!',
            'role': user.role,
            'email': user.email
        }), 200
    else:
        # If email or password is incorrect
        return jsonify({'message': 'Invalid email or password'}), 401 # 401 means Unauthorized

# ==========================================
# Get All Parking Spots API
# ==========================================
# Handles GET requests to retrieve the status of all parking spots
@app.route('/api/spots', methods=['GET'])
def get_spots():
    try:
        # Fetch all parking spots from the database, ordered by ID
        spots = ParkingSpot.query.order_by(ParkingSpot.id).all()
        
        # Convert Python objects to a JSON-serializable list
        output = []
        for spot in spots:
            spot_data = {
                'id': spot.id,
                'name': spot.spot_name,
                'is_occupied': spot.is_occupied
            }
            output.append(spot_data)
            
        return jsonify({'spots': output}), 200
    except Exception as e:
        return jsonify({'message': 'Error fetching spots', 'error': str(e)}), 500

# ==========================================
# Initialize Spots (One-time setup)
# ==========================================
# Use this API to automatically populate the database with parking spots (e.g., A-01 to A-32)
@app.route('/api/init-spots', methods=['POST'])
def init_spots():
    # Check if spots are already initialized to prevent duplicates
    if ParkingSpot.query.first():
        return jsonify({'message': 'Spots already initialized!'}), 400
        
    # Create 32 spots from A-01 to A-32
    for i in range(1, 33):
        spot_name = f'A-{str(i).zfill(2)}' # Formats as A-01, A-02...
        new_spot = ParkingSpot(spot_name=spot_name, is_occupied=False)
        db.session.add(new_spot)
    
    db.session.commit()
    return jsonify({'message': '32 Parking spots created successfully!'}), 201