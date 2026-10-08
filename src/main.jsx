import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'

const App = lazy(() => import('./App.jsx'))
const KiteiApp = lazy(() => import('./KiteiApp.jsx'))

const path = window.location.pathname.replace(/\/+$/, '') || '/'
const Root = path === '/kitei' ? KiteiApp : App

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback={null}>
      <Root />
    </Suspense>
  </React.StrictMode>,
)
