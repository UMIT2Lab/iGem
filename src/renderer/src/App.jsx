import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import CasesPage from './components/Cases/CasesPage'
import MapView from './components/Map/MapView'

function App() {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#1890ff' } }}>
      <Router>
        <Routes>
          <Route path="/" element={<CasesPage />} />
          <Route path="/map/:caseId" element={<MapView />} />
        </Routes>
      </Router>
    </ConfigProvider>
  )
}

export default App
