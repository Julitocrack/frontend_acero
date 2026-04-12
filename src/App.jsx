import { useState } from 'react'

// Importamos nuestras piezas
import Login from './components/Login'
import PanelVentas from './components/PanelVentas'
import PanelDuena from './components/PanelDuena'
import PanelProduccion from './components/PanelProduccion'
import PanelLogistica from './components/PanelLogistica'

function App() {
  const [usuarioActual, setUsuarioActual] = useState(null)

  // Función para borrar los datos y regresar al Login
  const cerrarSesion = () => {
    setUsuarioActual(null)
  }

  // Si nadie ha iniciado sesión, mostramos el componente Login
  if (!usuarioActual) {
    return <Login onLoginExitoso={setUsuarioActual} />
  }

  // EL ENRUTADOR: Dependiendo del rol, mostramos un componente distinto
  // CADA PANEL RECIBE: usuarioActual (datos) y onCerrarSesion (función)
  switch (usuarioActual.rol) {
    case 'ventas':
      return <PanelVentas usuarioActual={usuarioActual} onCerrarSesion={cerrarSesion} />
      
    case 'duena':
      return <PanelDuena usuarioActual={usuarioActual} onCerrarSesion={cerrarSesion} />
      
    case 'produccion':
      return <PanelProduccion usuarioActual={usuarioActual} onCerrarSesion={cerrarSesion} />
      
    case 'logistica':
      return <PanelLogistica usuarioActual={usuarioActual} onCerrarSesion={cerrarSesion} />
      
    default:
      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl text-center border border-gray-200 w-full max-w-md">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Rol Desconocido</h1>
            <p className="text-gray-600 mb-6">Hubo un error con los permisos de tu usuario.</p>
            <button 
              onClick={cerrarSesion} 
              className="w-full bg-gray-800 hover:bg-gray-900 text-white font-semibold py-3 px-4 rounded-xl transition duration-200 active:scale-95"
            >
              Volver al Login
            </button>
          </div>
        </div>
      )
  }
}

export default App