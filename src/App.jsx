import { useState, useEffect } from 'react'
// Importamos nuestras piezas
import Login from './components/Login'
import PanelVentas from './components/PanelVentas'
import PanelDuena from './components/PanelDuena'
import PanelProduccion from './components/PanelProduccion'
import PanelLogistica from './components/PanelLogistica'

// ============================================================
// 🔐 SESIÓN PERSISTENTE (7 días con renovación automática)
// ============================================================
const SESION_KEY = 'aceros_sesion_activa'
const DURACION_SESION_DIAS = 7  // ⬅️ cámbialo si quieres más/menos días

// Guarda el usuario en localStorage con fecha de expiración
const guardarSesion = (usuario) => {
  const ahora = Date.now()
  const expira = ahora + (DURACION_SESION_DIAS * 24 * 60 * 60 * 1000)
  localStorage.setItem(SESION_KEY, JSON.stringify({
    usuario,
    expira,
    guardado: ahora
  }))
}

// Lee la sesión guardada — devuelve null si no existe o ya expiró
const leerSesion = () => {
  try {
    const raw = localStorage.getItem(SESION_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (Date.now() > data.expira) {
      localStorage.removeItem(SESION_KEY)
      return null
    }
    return data.usuario
  } catch (e) {
    localStorage.removeItem(SESION_KEY)
    return null
  }
}

// Borra la sesión guardada (al cerrar sesión manualmente)
const borrarSesion = () => {
  localStorage.removeItem(SESION_KEY)
}


function App() {
  // Al iniciar la app, intentamos cargar la sesión guardada
  const [usuarioActual, setUsuarioActual] = useState(() => leerSesion())

  // Cada vez que el usuario cambia (login exitoso), guardamos la sesión
  useEffect(() => {
    if (usuarioActual) {
      guardarSesion(usuarioActual)
    }
  }, [usuarioActual])

  // Mientras estén logueados, renovamos la fecha de expiración cada hora
  // Así, si entran al menos una vez por semana, la sesión NUNCA expira
  useEffect(() => {
    if (!usuarioActual) return
    const intervalo = setInterval(() => {
      guardarSesion(usuarioActual)
    }, 60 * 60 * 1000) // cada hora
    return () => clearInterval(intervalo)
  }, [usuarioActual])

  // Función para borrar los datos y regresar al Login
  const cerrarSesion = () => {
    borrarSesion()
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