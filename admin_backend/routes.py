from flask import request, jsonify
from datetime import datetime
from math import ceil
from app import app, db, User, ParkingSpot, ParkingSession # Importing app instance, database, and models

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

# ... (කලින් තිබුන කේතයන් එලෙසම තියෙන්න දෙන්න)

# ==========================================
# Vehicle Entry Simulation API (LPR Camera එකෙන් දත්ත එන විදිය)
# ==========================================
@app.route('/api/vehicle/entry', methods=['POST'])
def vehicle_entry():
    data = request.get_json()
    plate_number = data.get('plate_number')

    if not plate_number:
        return jsonify({'message': 'License plate number is required!'}), 400

    # Prevent duplicate active sessions for same plate
    active_session = ParkingSession.query.filter_by(plate_number=plate_number, exit_time=None).first()
    if active_session:
        return jsonify({'message': f'Vehicle {plate_number} is already parked at {active_session.spot_name}'}), 409

    # 1. පළමු නිදහස් (Free) පාර්කින් ස්ථානය සොයාගැනීම
    # is_occupied = False වන පළමු spot එක ගන්නවා
    free_spot = ParkingSpot.query.filter_by(is_occupied=False).order_by(ParkingSpot.id).first()

    if free_spot:
        # 2. එම ස්ථානය Occupied ලෙස වෙනස් කිරීම
        free_spot.is_occupied = True
        new_session = ParkingSession(
            plate_number=plate_number,
            spot_name=free_spot.spot_name,
            entry_time=datetime.utcnow()
        )
        db.session.add(new_session)
        db.session.commit()
        
        return jsonify({
            'message': f'Vehicle {plate_number} parked at {free_spot.spot_name}',
            'spot': free_spot.spot_name,
            'status': 'assigned'
        }), 200
    else:
        # ඉඩ නැත්නම්
        return jsonify({'message': 'Parking is full!'}), 404

# ==========================================
# Vehicle Exit Simulation API (වාහනය පිටවීම)
# ==========================================
@app.route('/api/vehicle/exit', methods=['POST'])
def vehicle_exit():
    data = request.get_json() or {}
    plate_number = data.get('plate_number')

    if not plate_number:
        return jsonify({'message': 'License plate number is required!'}), 400

    session = (ParkingSession.query
               .filter_by(plate_number=plate_number, exit_time=None)
               .order_by(ParkingSession.entry_time.desc())
               .first())

    if not session:
        return jsonify({'message': f'No active session found for {plate_number}'}), 404

    spot = ParkingSpot.query.filter_by(spot_name=session.spot_name).first()
    if spot:
        spot.is_occupied = False

    exit_time = datetime.utcnow()
    duration_minutes = int((exit_time - session.entry_time).total_seconds() // 60)
    billed_hours = max(1, ceil(duration_minutes / 60))
    amount_lkr = billed_hours * 150

    session.exit_time = exit_time
    session.duration_minutes = duration_minutes
    session.amount_lkr = amount_lkr

    db.session.commit()

    return jsonify({
        'message': f'Spot {session.spot_name} is now free!',
        'duration_minutes': duration_minutes,
        'amount_charged': amount_lkr
    }), 200

# ==========================================
# Parking Logs API
# ==========================================
@app.route('/api/logs', methods=['GET'])
def get_logs():
    sessions = (ParkingSession.query
                .order_by(ParkingSession.entry_time.desc())
                .limit(50)
                .all())

    output = []
    for s in sessions:
        output.append({
            'id': s.id,
            'plate_number': s.plate_number,
            'spot': s.spot_name,
            'entry_time': s.entry_time.isoformat() if s.entry_time else None,
            'exit_time': s.exit_time.isoformat() if s.exit_time else None,
            'duration_minutes': s.duration_minutes,
            'amount_lkr': s.amount_lkr,
        })

    return jsonify({'logs': output}), 200