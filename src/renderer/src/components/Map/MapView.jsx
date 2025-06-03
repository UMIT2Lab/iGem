import { useParams, useNavigate } from 'react-router-dom'
import { Button } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import Map from './Map'
import { useCases } from '../../context/CasesContext'

const MapView = () => {
  const { caseId } = useParams()
  const navigate = useNavigate()
  const { getCaseById } = useCases()
  
  const caseData = getCaseById(caseId)
  console.log(caseId)
  return (
      <div className="map-container">
        <Map 
          caseId={caseId}
          caseData={caseData} 
          onClose={() => navigate('/')} 
        />
      </div>
  )
}

export default MapView
