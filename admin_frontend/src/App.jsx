import React from 'react'
import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import Facilities from './pages/admin/Facilities'
import Dashboard from './pages/admin/Dashboard'
import InOut from './pages/admin/InOut'
import LiveFeed from './pages/admin/LiveFeed'

export default function App() {
  return (
    <div className='bg-sentraBlack h-full'>
      <Routes>
        <Route path='/' element={<Home/>}/>
        <Route path='signin' element={<SignIn/>}/>
        <Route path='signup' element={<SignUp/>}/>
        <Route path='admin' element={<Facilities/>} />
        <Route path='admin/:facilityId' element={<Dashboard/>} />
        <Route path='admin/:facilityId/inout' element={<InOut/>} />
        <Route path='admin/:facilityId/live' element={<LiveFeed/>} />
      </Routes>
    </div>
  )
}
