<div align="center">
  <img src="admin_frontend/src/assets/logo_notext.png" alt="Sentra" width="72" height="72" />
  
  <h1>Sentra – LPR Parking System</h1>
  <p>A modern, admin‑friendly parking management platform powered by License Plate Recognition.</p>
</div>

## 📋 Overview

This repository contains the complete source code for the **Sentra LPR Parking System**. It consists of a React-based admin dashboard and a Flask backend that manages parking sessions, facilities, and live updates with real-time license plate recognition integration.

### Key Features
- 🚗 **Real-time parking monitoring** - Track occupancy and vehicle movements live
- 💰 **Automated revenue tracking** - Calculate parking fees based on duration
- 📊 **Live statistics dashboard** - View real-time analytics and reports
- 🔔 **WebSocket integration** - Instant updates for vehicle entry/exit events
- 🅿️ **Spot management** - Monitor and manage parking spot availability
- ♻️ **System Reset** - One-click reset functionality for demo purposes (Clear all sessions)
- 📝 **Comprehensive logs** - Detailed entry/exit history with timestamps
- 🎯 **License plate confirmation** - Manual approval system for detected plates

## 🛠️ Tech Stack

- **Frontend:** React 19, Vite 7, Tailwind CSS v4, Axios
- **Backend:** Python 3.10+, Flask, Flask-CORS
- **Database:** Supabase (PostgreSQL)
- **Real-time:** WebSocket for live updates
- **Integration:** SentraAI Model API for license plate detection

## 📦 Prerequisites

Before running the project, ensure you have the following installed:

### Required Software
1.  **Node.js** (v18 or higher)
    - Download: [nodejs.org](https://nodejs.org/)
    - Verify: `node -v` and `npm -v`
    
2.  **Python** (v3.10 or higher)
    - Download: [python.org](https://www.python.org/)
    - Verify: `python --version` or `python3 --version`
    
3.  **Supabase Account** (Free tier available)
    - Sign up at: [supabase.com](https://supabase.com)
    - You'll need your project URL and API key

## 🚀 Quick Start Guide

### Step 1: Clone the Repository

```bash
git clone https://github.com/Project-Sentra/lpr-parking-system.git
cd lpr-parking-system
```

### Step 2: Database Setup (Supabase)

1.  **Create a Supabase project:**
    - Go to [supabase.com](https://supabase.com) and create a new project
    - Wait for the project to finish provisioning (~2 minutes)

2.  **Run the database schema:**
    - Navigate to SQL Editor in your Supabase dashboard
    - Copy the contents of `admin_backend/supabase_schema.sql`
    - Paste and run it in the SQL Editor
    - This will create all necessary tables (users, parking_spots, parking_sessions, cameras, detection_logs)

3.  **Get your Supabase credentials:**
    - Go to Project Settings → API
    - Copy your `Project URL` and `anon public` API key

### Step 3: Backend Setup (Python/Flask)

1.  **Navigate to the backend directory:**
    ```bash
    cd admin_backend
    ```

2.  **Create a virtual environment (Recommended):**
    
    **Windows:**
    ```bash
    python -m venv venv
    venv\Scripts\activate
    ```
    
    **macOS/Linux:**
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```

3.  **Install Python dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configure environment variables:**
    - Create a `.env` file in the `admin_backend` directory
    - Add your Supabase credentials:
    ```env
    SUPABASE_URL=your_supabase_project_url
    SUPABASE_KEY=your_supabase_anon_key
    ```
    
    **OR** edit `app.py` directly (lines 17-18):
    ```python
    SUPABASE_URL = os.getenv('SUPABASE_URL', 'your_supabase_url_here')
    SUPABASE_KEY = os.getenv('SUPABASE_KEY', 'your_supabase_key_here')
    ```

5.  **Initialize parking spots (Optional):**
    If you want to populate the database with initial parking spots:
    ```bash
    python reset_db.py
    ```
    This creates spots A01-A10, B01-B10, C01-C10 (30 spots total)

6.  **Start the Flask server:**
    ```bash
    python app.py
    ```
    ✅ You should see: `Server starting on port 5000...` and `Connected to Supabase: <your-url>`

### Step 4: Frontend Setup (React)

1.  **Open a NEW terminal window** (keep the backend running)

2.  **Navigate to the frontend directory:**
    ```bash
    cd admin_frontend
    ```

3.  **Install Node dependencies:**
    ```bash
    npm install
    ```

4.  **Start the development server:**
    ```bash
    npm run dev
    ```
    ✅ You should see: `Local: http://localhost:5173`

### Step 5: Access the Application

1.  Open your browser and navigate to: **http://localhost:5173**
2.  You should see the Sentra Admin Dashboard

## 🎯 Usage Guide

### Testing Without Physical Cameras

Since physical LPR cameras may not be connected initially, you can test the system in two ways:

#### Option 1: Using SentraAI Model (Recommended)

Follow the setup instructions in the [SentraAI-model repository](https://github.com/Project-Sentra/SentraAI-model) to enable real-time license plate detection with simulated or live camera feeds.

#### Option 2: Manual API Testing

Use **Postman**, **cURL**, or **Thunder Client** to simulate vehicle entry/exit:

**Vehicle Entry:**
```bash
POST http://127.0.0.1:5000/api/vehicle/entry
Content-Type: application/json

{
  "plate_number": "WP CA-1234"
}
```

**Vehicle Exit:**
```bash
POST http://127.0.0.1:5000/api/vehicle/exit
Content-Type: application/json

{
  "plate_number": "WP CA-1234"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Vehicle entered successfully",
  "data": {
    "id": 1,
    "plate_number": "WP CA-1234",
    "spot_name": "A01",
    "entry_time": "2026-01-20T15:30:00"
  }
}
```

The dashboard will update automatically via WebSocket!

### Dashboard Features

- **📊 Live Statistics:** Total spots, occupied spots, available spots, today's revenue
- **🚗 Active Vehicles:** Real-time list of parked vehicles with entry times
- **📝 Entry/Exit Logs:** Complete history with timestamps, duration, and fees
- **🔔 Real-time Updates:** Instant notifications when vehicles enter or exit

## 🔧 Configuration

### Backend Configuration (app.py)

```python
# Supabase Configuration
SUPABASE_URL = 'your_supabase_project_url'
SUPABASE_KEY = 'your_supabase_anon_key'

# Server Port (default: 5000)
app.run(debug=True, port=5000)
```

### Frontend Configuration

The frontend automatically connects to `http://localhost:5000` for API calls and WebSocket. To change this, edit:
- `admin_frontend/src/services/lprService.js` - API base URL
- `admin_frontend/src/hooks/useWebSocket.js` - WebSocket URL

### Parking Fee Calculation

Default rate: **LKR 100 per hour**

Modify in `admin_backend/routes.py`:
```python
def calculate_parking_fee(duration_minutes):
    RATE_PER_HOUR = 100  # Change this value
    hours = duration_minutes / 60
    return int(hours * RATE_PER_HOUR)
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Database Connection Error
```
Error: Could not connect to Supabase
```
**Solutions:**
- Verify your Supabase URL and API key in `.env` or `app.py`
- Check that your Supabase project is active
- Ensure you've run the schema SQL in Supabase SQL Editor

#### 2. Port Already in Use
```
Error: Address already in use: Port 5000
```
**Solutions:**
- Find and kill the process using the port:
  ```bash
  # macOS/Linux
  lsof -ti:5000 | xargs kill -9
  
  # Windows
  netstat -ano | findstr :5000
  taskkill /PID <process_id> /F
  ```
- Or change the port in `app.py`

#### 3. Module Not Found Error
```
ModuleNotFoundError: No module named 'flask'
```
**Solutions:**
- Ensure virtual environment is activated (you should see `(venv)` in terminal)
- Re-run: `pip install -r requirements.txt`

#### 4. CORS Errors in Browser
```
Access to XMLHttpRequest blocked by CORS policy
```
**Solutions:**
- Ensure Flask backend is running
- Check Flask-CORS is installed: `pip install flask-cors`
- Verify `CORS(app)` is called in `app.py`

#### 5. WebSocket Connection Failed
**Solutions:**
- Backend must be running on port 5000
- Check browser console for connection errors
- Verify WebSocket URL matches backend address

#### 6. Empty Dashboard / No Parking Spots
**Solutions:**
- Run the initialization script:
  ```bash
  cd admin_backend
  python reset_db.py
  ```
- Or manually insert spots via Supabase SQL Editor

## 📁 Project Structure

```
lpr-parking-system/
├── admin_frontend/              # React Frontend Application
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── PlateConfirmModal.jsx   # License plate confirmation modal
│   │   │   └── ...
│   │   ├── pages/               # Main application pages
│   │   │   ├── Dashboard.jsx    # Main dashboard with stats
│   │   │   ├── InOut.jsx        # Entry/exit logs page
│   │   │   └── ...
│   │   ├── services/
│   │   │   └── lprService.js    # API service layer
│   │   ├── hooks/
│   │   │   └── useWebSocket.js  # WebSocket custom hook
│   │   ├── assets/              # Images and static files
│   │   ├── App.jsx              # Root component
│   │   └── main.jsx             # Application entry point
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
│
├── admin_backend/               # Flask Backend API
│   ├── app.py                   # Main Flask application & Supabase setup
│   ├── routes.py                # API endpoints & business logic
│   ├── reset_db.py              # Database initialization script
│   ├── supabase_schema.sql      # Database schema (run in Supabase)
│   ├── requirements.txt         # Python dependencies
│   └── .env                     # Environment variables (create this)
│
├── LICENSE
└── README.md                    # This file
```

## 🔌 API Endpoints

### Vehicle Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/vehicle/entry` | Record vehicle entry |
| `POST` | `/api/vehicle/exit` | Process vehicle exit |
| `GET` | `/api/vehicles/active` | Get all currently parked vehicles |

### Parking Spots

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/spots` | Get all parking spots |
| `GET` | `/api/spots/available` | Get available spots count |

### Statistics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/stats` | Get dashboard statistics |
| `GET` | `/api/sessions/recent` | Get recent parking sessions |

### WebSocket

| Endpoint | Description |
|----------|-------------|
| `WS /ws` | Real-time updates for vehicle entry/exit |

## 🔗 Integration with SentraAI

This system is designed to work seamlessly with **SentraAI-model** for automated license plate recognition:

1. **SentraAI detects** a license plate from camera feed
2. **WebSocket notification** sent to frontend with plate number
3. **Operator confirms** entry/exit via modal popup
4. **This backend processes** the confirmation and updates database
5. **Dashboard updates** in real-time via WebSocket

See [SentraAI-model README](https://github.com/Project-Sentra/SentraAI-model) for AI service setup.

## 🚀 Running the Full System

To run the complete Sentra Parking System with AI capabilities:

**Terminal 1 - Backend:**
```bash
cd lpr-parking-system/admin_backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
python app.py
```

**Terminal 2 - Frontend:**
```bash
cd lpr-parking-system/admin_frontend
npm run dev
```

**Terminal 3 - AI Service (Optional):**
```bash
cd SentraAI-model/service
uvicorn main:app --port 5001 --reload
```

Access Points:
- 🖥️ Frontend: http://localhost:5173
- 🔧 Backend API: http://localhost:5000
- 🤖 AI Service: http://localhost:5001

## 🛡️ Security Notes

**⚠️ For Production Deployment:**

1. **Never commit `.env` files** - Add to `.gitignore`
2. **Use environment variables** for sensitive data
3. **Enable Supabase RLS** policies properly
4. **Use HTTPS** for all communications
5. **Add authentication** for admin dashboard
6. **Implement rate limiting** on APIs
7. **Validate all inputs** server-side

## 📝 License

This project is part of the Sentra Parking System ecosystem.

## 🤝 Related Repositories

- **SentraAI-model** - License Plate Recognition AI Service
- **Sentra-Mobile-App** - Flutter mobile application
- **Sentra-Infrastructure** - Deployment and infrastructure as code

## 📞 Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review Supabase logs in the dashboard
3. Check browser console for frontend errors
4. Review Flask terminal output for backend errors

---

Made with ❤️ by the Sentra Team

