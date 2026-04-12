import { useState } from 'react'

function Login({ onLoginExitoso }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false);

  const iniciarSesion = async (e) => {
    e.preventDefault() 
    setCargando(true);
    try {
      const respuesta = await fetch('https://aceros-backend-production.up.railway.app/usuarios/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      if (respuesta.ok) {
        const datos = await respuesta.json()
        onLoginExitoso(datos.usuario)
      } else {
        alert('Usuario o contraseña incorrectos ❌')
      }
    } catch (error) {
      alert('Error al conectar con el servidor 🔌')
    }
    setCargando(false);
  }

  return (
    // min-h-screen asegura fondo total, p-4 para margen en móvil
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Tarjeta principal con sombra suave y bordes muy redondeados */}
      <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-xl w-full max-w-md border border-gray-100 animate-in fade-in zoom-in duration-300">
        
        <div className="text-center mb-10">
          {/* Logo o Icono visual */}
          <div className="mx-auto h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-inner">
            <span className="text-4xl">🏗️</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-950 tracking-tight">Aceros del Bajío</h1>
          <p className="text-gray-600 mt-3 text-base sm:text-lg">Gestión de Pedidos</p>
        </div>

        <form onSubmit={iniciarSesion} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5 ml-1">Usuario técnico</label>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              className="w-full px-5 py-3.5 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition text-lg bg-white text-gray-950 placeholder:text-gray-400" 
              placeholder="Ej. ana_ventas" 
              required 
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5 ml-1">Contraseña</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="w-full px-5 py-3.5 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition text-lg bg-white text-gray-950 placeholder:text-gray-400" 
              placeholder="••••••••" 
              required 
            />
          </div>

          <button 
            type="submit" 
            disabled={cargando}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-2xl transition duration-200 text-lg shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-3"
          >
            {cargando ? (
              <>
                <div className="h-5 w-5 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                Verificando...
              </>
            ) : (
              'Entrar al Sistema →'
            )}
          </button>
        </form>
        
        <p className="text-center text-xs text-gray-400 mt-10">v1.0 | Desarrollado para Aceros del Bajío</p>
      </div>
    </div>
  )
}

export default Login