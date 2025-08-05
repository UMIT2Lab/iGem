import { createContext, useState, useContext, useEffect } from 'react'

const CasesContext = createContext()

export const CasesProvider = ({ children }) => {
  // Try to load cases from localStorage or start with empty array
  const [cases, setCases] = useState(() => {
    const savedCases = localStorage.getItem('cases')
    return savedCases ? JSON.parse(savedCases) : []
  })

  // Save cases to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('cases', JSON.stringify(cases))
  }, [cases])

  const addCase = (newCase) => {
    setCases([...cases, newCase])
  }

  const getCaseById = (id) => {
    return cases.find(c => c.id === id) || null
  }

  const updateCase = (updatedCase) => {
    setCases(cases.map(c => c.id === updatedCase.id ? updatedCase : c))
  }

  const deleteCase = async (id) => {
    try {
      const result = await window.electron.ipcRenderer.invoke('delete-case', id);
      if (result.success) {
        setCases(prevCases => prevCases.filter(c => c.id !== id));
      } else {
        console.error('Failed to delete case:', result.error);
        // Optionally show a UI message here
      }
    } catch (error) {
      console.error('IPC error during case deletion:', error);
      // Optionally show a UI message here
    }
  };

  return (
    <CasesContext.Provider value={{
      cases,
      setCases,
      addCase,
      getCaseById,
      updateCase,
      deleteCase
    }}>
      {children}
    </CasesContext.Provider>
  )
}

export const useCases = () => useContext(CasesContext)
