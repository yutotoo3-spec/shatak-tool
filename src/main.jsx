import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import KiteiApp from './KiteiApp.jsx'

const path = window.location.pathname.replace(/\/+$/, '') || '/'
const Root = path === '/kitei' ? KiteiApp : App

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
