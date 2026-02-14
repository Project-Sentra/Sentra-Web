/**
 * App.jsx - Root Application Component (v2.0)
 * ==============================================
 * Defines all client-side routes using React Router.
 *
 * Route Structure:
 *   /                              -> Landing page (Home)
 *   /signin                        -> Login form
 *   /signup                        -> Registration form
 *   /admin                         -> Facility selection page
 *   /admin/users                   -> User management (admin)
 *   /admin/vehicles                -> Vehicle registry (admin)
 *   /admin/reservations            -> Reservations overview (admin)
 *   /admin/:facilityId             -> Dashboard for a specific facility
 *   /admin/:facilityId/inout       -> Entry/exit logs for a facility
 *   /admin/:facilityId/live        -> Live camera feeds for a facility
 */

import React from 'react'
import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import Facilities from './pages/admin/Facilities'
import Dashboard from './pages/admin/Dashboard'
import InOut from './pages/admin/InOut'
import LiveFeed from './pages/admin/LiveFeed'
import Users from './pages/admin/Users'
import Vehicles from './pages/admin/Vehicles'
import Reservations from './pages/admin/Reservations'

export default function App() {
  return (
    <div className='bg-[#111] min-h-screen text-white font-poppins'>
      <Routes>
        {/* Public routes */}
        <Route path='/' element={<Home/>}/>
        <Route path='signin' element={<SignIn/>}/>
        <Route path='signup' element={<SignUp/>}/>

        {/* Admin routes - require authentication (enforced per-page) */}
        <Route path='admin' element={<Facilities/>} />
        <Route path='admin/users' element={<Users/>} />
        <Route path='admin/vehicles' element={<Vehicles/>} />
        <Route path='admin/reservations' element={<Reservations/>} />
        <Route path='admin/:facilityId' element={<Dashboard/>} />
        <Route path='admin/:facilityId/inout' element={<InOut/>} />
        <Route path='admin/:facilityId/live' element={<LiveFeed/>} />
      </Routes>
    </div>
  )
}