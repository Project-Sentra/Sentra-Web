from flask import request, jsonify
from datetime import datetime
from math import ceil
import httpx
from app import app, supabase

# LPR Service Configuration
LPR_SERVICE_URL = "http://127.0.0.1:5001"

# ==========================================
# User Registration (Sign Up) API
# ==========================================
@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    # Check if user already exists
    result = supabase.table('users').select('*').eq('email', email).execute()
    if result.data:
        return jsonify({'message': 'User already exists!'}), 400

    # Create new user
    new_user = {
        'email': email,
        'password': password,
        'role': 'admin'
    }
    supabase.table('users').insert(new_user).execute()

    return jsonify({'message': 'User created successfully!'}), 201

# ==========================================
# User Login API
# ==========================================
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    # Find user by email
    result = supabase.table('users').select('*').eq('email', email).execute()

    if result.data and result.data[0]['password'] == password:
        user = result.data[0]
        return jsonify({
            'message': 'Login successful!',
            'role': user['role'],
            'email': user['email']
        }), 200
    else:
        return jsonify({'message': 'Invalid email or password'}), 401

# ==========================================
# Get All Parking Spots API
# ==========================================
@app.route('/api/spots', methods=['GET'])
def get_spots():
    try:
        result = supabase.table('parking_spots').select('*').order('id').execute()

        output = []
        for spot in result.data:
            spot_data = {
                'id': spot['id'],
                'name': spot['spot_name'],
                'is_occupied': spot['is_occupied']
            }
            output.append(spot_data)

        return jsonify({'spots': output}), 200
    except Exception as e:
        return jsonify({'message': 'Error fetching spots', 'error': str(e)}), 500

# ==========================================
# Initialize Spots (One-time setup)
# ==========================================
@app.route('/api/init-spots', methods=['POST'])
def init_spots():
    # Check if spots already exist
    result = supabase.table('parking_spots').select('id').limit(1).execute()
    if result.data:
        return jsonify({'message': 'Spots already initialized!'}), 400

    # Create 32 spots from A-01 to A-32
    spots = []
    for i in range(1, 33):
        spot_name = f'A-{str(i).zfill(2)}'
        spots.append({'spot_name': spot_name, 'is_occupied': False})

    supabase.table('parking_spots').insert(spots).execute()
    return jsonify({'message': '32 Parking spots created successfully!'}), 201

# ==========================================
# Vehicle Entry API
# ==========================================
@app.route('/api/vehicle/entry', methods=['POST'])
def vehicle_entry():
    data = request.get_json()
    plate_number = data.get('plate_number')

    if not plate_number:
        return jsonify({'message': 'License plate number is required!'}), 400

    # Check for existing active session
    active_result = supabase.table('parking_sessions').select('*').eq('plate_number', plate_number).is_('exit_time', 'null').execute()
    if active_result.data:
        session = active_result.data[0]
        return jsonify({'message': f'Vehicle {plate_number} is already parked at {session["spot_name"]}'}), 409

    # Find first free spot
    free_spot_result = supabase.table('parking_spots').select('*').eq('is_occupied', False).order('id').limit(1).execute()

    if free_spot_result.data:
        free_spot = free_spot_result.data[0]

        # Mark spot as occupied
        supabase.table('parking_spots').update({'is_occupied': True}).eq('id', free_spot['id']).execute()

        # Create parking session
        new_session = {
            'plate_number': plate_number,
            'spot_name': free_spot['spot_name'],
            'entry_time': datetime.utcnow().isoformat()
        }
        supabase.table('parking_sessions').insert(new_session).execute()

        return jsonify({
            'message': f'Vehicle {plate_number} parked at {free_spot["spot_name"]}',
            'spot': free_spot['spot_name'],
            'status': 'assigned'
        }), 200
    else:
        return jsonify({'message': 'Parking is full!'}), 404

# ==========================================
# Vehicle Exit API
# ==========================================
@app.route('/api/vehicle/exit', methods=['POST'])
def vehicle_exit():
    data = request.get_json() or {}
    plate_number = data.get('plate_number')

    if not plate_number:
        return jsonify({'message': 'License plate number is required!'}), 400

    # Find active session
    session_result = supabase.table('parking_sessions').select('*').eq('plate_number', plate_number).is_('exit_time', 'null').order('entry_time', desc=True).limit(1).execute()

    if not session_result.data:
        return jsonify({'message': f'No active session found for {plate_number}'}), 404

    session = session_result.data[0]

    # Free up the parking spot
    supabase.table('parking_spots').update({'is_occupied': False}).eq('spot_name', session['spot_name']).execute()

    # Calculate duration and amount
    entry_time = datetime.fromisoformat(session['entry_time'].replace('Z', '+00:00'))
    exit_time = datetime.utcnow()
    duration_minutes = int((exit_time - entry_time).total_seconds() // 60)
    billed_hours = max(1, ceil(duration_minutes / 60))
    amount_lkr = billed_hours * 150

    # Update session
    supabase.table('parking_sessions').update({
        'exit_time': exit_time.isoformat(),
        'duration_minutes': duration_minutes,
        'amount_lkr': amount_lkr
    }).eq('id', session['id']).execute()

    return jsonify({
        'message': f'Spot {session["spot_name"]} is now free!',
        'duration_minutes': duration_minutes,
        'amount_charged': amount_lkr
    }), 200

# ==========================================
# Parking Logs API
# ==========================================
@app.route('/api/logs', methods=['GET'])
def get_logs():
    result = supabase.table('parking_sessions').select('*').order('entry_time', desc=True).limit(50).execute()

    output = []
    for s in result.data:
        output.append({
            'id': s['id'],
            'plate_number': s['plate_number'],
            'spot': s['spot_name'],
            'entry_time': s['entry_time'],
            'exit_time': s['exit_time'],
            'duration_minutes': s['duration_minutes'],
            'amount_lkr': s['amount_lkr'],
        })

    return jsonify({'logs': output}), 200


# ==========================================
# LPR Service Integration APIs
# ==========================================

@app.route('/api/lpr/status', methods=['GET'])
def lpr_status():
    """Check if the SentraAI LPR service is connected and running"""
    try:
        response = httpx.get(f"{LPR_SERVICE_URL}/api/health", timeout=5.0)
        if response.status_code == 200:
            data = response.json()
            return jsonify({
                'connected': True,
                'service': data.get('service', 'SentraAI'),
                'version': data.get('version', 'unknown'),
                'cameras_active': data.get('cameras_active', 0),
                'camera_mode': data.get('camera_mode', 'unknown')
            }), 200
        else:
            return jsonify({'connected': False, 'message': 'Service unavailable'}), 503
    except Exception as e:
        return jsonify({'connected': False, 'message': str(e)}), 503


@app.route('/api/cameras', methods=['GET'])
def get_cameras():
    """Get all configured cameras"""
    result = supabase.table('cameras').select('*').order('id').execute()

    output = []
    for cam in result.data:
        output.append({
            'id': cam['id'],
            'camera_id': cam['camera_id'],
            'name': cam['name'],
            'type': cam['camera_type'],
            'source_url': cam.get('source_url', ''),
            'is_active': cam['is_active']
        })
    return jsonify({'cameras': output}), 200


@app.route('/api/cameras', methods=['POST'])
def add_camera():
    """Add a new camera configuration"""
    data = request.get_json()

    camera_id = data.get('camera_id')
    name = data.get('name')
    camera_type = data.get('type')
    source_url = data.get('source_url', '')

    if not all([camera_id, name, camera_type]):
        return jsonify({'message': 'camera_id, name, and type are required'}), 400

    if camera_type not in ['entry', 'exit']:
        return jsonify({'message': 'type must be "entry" or "exit"'}), 400

    # Check if camera exists
    existing = supabase.table('cameras').select('id').eq('camera_id', camera_id).execute()
    if existing.data:
        return jsonify({'message': f'Camera {camera_id} already exists'}), 409

    new_camera = {
        'camera_id': camera_id,
        'name': name,
        'camera_type': camera_type,
        'source_url': source_url,
        'is_active': True
    }
    result = supabase.table('cameras').insert(new_camera).execute()

    return jsonify({'message': f'Camera {name} added successfully', 'id': result.data[0]['id']}), 201


@app.route('/api/cameras/<camera_id>', methods=['DELETE'])
def delete_camera(camera_id):
    """Delete a camera configuration"""
    existing = supabase.table('cameras').select('id').eq('camera_id', camera_id).execute()
    if not existing.data:
        return jsonify({'message': f'Camera {camera_id} not found'}), 404

    supabase.table('cameras').delete().eq('camera_id', camera_id).execute()
    return jsonify({'message': f'Camera {camera_id} deleted'}), 200


@app.route('/api/cameras/init', methods=['POST'])
def init_cameras():
    """Initialize default entry and exit cameras"""
    existing = supabase.table('cameras').select('id').limit(1).execute()
    if existing.data:
        return jsonify({'message': 'Cameras already initialized'}), 400

    cameras = [
        {'camera_id': 'entry_cam_01', 'name': 'Entry Gate 01', 'camera_type': 'entry', 'is_active': True},
        {'camera_id': 'exit_cam_01', 'name': 'Exit Gate 01', 'camera_type': 'exit', 'is_active': True},
    ]

    supabase.table('cameras').insert(cameras).execute()
    return jsonify({'message': '2 cameras initialized successfully'}), 201


@app.route('/api/detection-logs', methods=['GET'])
def get_detection_logs():
    """Get recent plate detection logs"""
    limit = request.args.get('limit', 50, type=int)

    result = supabase.table('detection_logs').select('*').order('detected_at', desc=True).limit(limit).execute()

    output = []
    for log in result.data:
        output.append({
            'id': log['id'],
            'camera_id': log['camera_id'],
            'plate_number': log['plate_number'],
            'confidence': log['confidence'],
            'detected_at': log['detected_at'],
            'action_taken': log['action_taken'],
            'vehicle_class': log.get('vehicle_class')
        })

    return jsonify({'logs': output}), 200


@app.route('/api/detection-logs', methods=['POST'])
def add_detection_log():
    """Log a new plate detection (called by LPR service)"""
    data = request.get_json()

    camera_id = data.get('camera_id')
    plate_number = data.get('plate_number')
    confidence = data.get('confidence', 0.0)
    action_taken = data.get('action_taken', 'pending')
    vehicle_class = data.get('vehicle_class')

    if not all([camera_id, plate_number]):
        return jsonify({'message': 'camera_id and plate_number are required'}), 400

    new_log = {
        'camera_id': camera_id,
        'plate_number': plate_number,
        'confidence': confidence,
        'action_taken': action_taken,
        'vehicle_class': vehicle_class,
        'detected_at': datetime.utcnow().isoformat()
    }
    result = supabase.table('detection_logs').insert(new_log).execute()

    return jsonify({'message': 'Detection logged', 'id': result.data[0]['id']}), 201


@app.route('/api/detection-logs/<int:log_id>/action', methods=['PATCH'])
def update_detection_action(log_id):
    """Update the action taken for a detection log"""
    data = request.get_json()
    action = data.get('action')

    if action not in ['entry', 'exit', 'ignored']:
        return jsonify({'message': 'action must be entry, exit, or ignored'}), 400

    existing = supabase.table('detection_logs').select('id').eq('id', log_id).execute()
    if not existing.data:
        return jsonify({'message': 'Detection log not found'}), 404

    supabase.table('detection_logs').update({'action_taken': action}).eq('id', log_id).execute()

    return jsonify({'message': f'Action updated to {action}'}), 200
