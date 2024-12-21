import Versions from './components/Versions'
import electronLogo from './assets/electron.svg'
import Map from './components/Map/Map'
function App() {
  const ipcHandle = () => window.electron.ipcRenderer.send('ping')

  return (
      <Map/>

  )
}

export default App

