import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import './detail.css'
import './insights.css'
import './board.css'
import './launch.css'
import './followups.css'
import './import.css'
import './calendar.css'

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
