import React from 'react'
import { Route, Routes } from 'react-router'
import Home from './pages/Home'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'

export default function App() {
  return (
    <div className='bg-sentraBlack h-full'>
      <Routes>
        <Route path='/' element={<Home/>}/>
        <Route path='signin' element={<SignIn/>}/>
        <Route path='signup' element={<SignUp/>}/>
      </Routes>
    </div>
  )
}
