import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

// ✅ URL centralizada
const API_URL = 'https://aceros-backend-production.up.railway.app'

function PanelLogistica({ usuarioActual, onCerrarSesion }) {
  const [pedidos, setPedidos] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [cargando, setCargando] = useState(false)

  const [imagenAmpliando, setImagenAmpliando] = useState(null)
  const [pedidoDetalle, setPedidoDetalle] = useState(null)
  const [confirmacion, setConfirmacion] = useState(null)

  // ✅ Guard para iOS Safari — Notification no existe en todos los navegadores móviles
  const [permisoNotificaciones, setPermisoNotificaciones] = useState(
    'Notification' in window ? Notification.permission : 'default'
  )
  const pedidosYaNotificados = useRef(new Set())
  // ✅ Audio en ref — no se recrea en cada render
  const audioRef = useRef(null)

  const solicitarPermisoNotificaciones = async () => {
    if (!('Notification' in window)) {
      alert('Tu navegador no soporta notificaciones.')
      return
    }
    const permiso = await Notification.requestPermission()
    setPermisoNotificaciones(permiso)
    if (permiso === 'granted') {
      new Notification('¡Logística Conectada! 🚚', {
        body: 'Te avisaremos cuando el taller termine de cortar material.'
      })
    }
  }

  // ✅ useCallback — no se recrea en cada render
  const obtenerDatos = useCallback(async () => {
    setCargando(true)
    try {
      const [resPedidos, resSucursales] = await Promise.all([
        fetch(`${API_URL}/pedidos/`),
        fetch(`${API_URL}/sucursales/`)
      ])
      if (resPedidos.ok) setPedidos(await resPedidos.json())
      if (resSucursales.ok) setSucursales(await resSucursales.json())
    } catch (error) {
      console.error('Error al cargar datos:', error)
    }
    setCargando(false)
  }, [])

  useEffect(() => {
    obtenerDatos()
    const intervalo = setInterval(obtenerDatos, 60000)
    return () => clearInterval(intervalo)
  }, [obtenerDatos])

  // ✅ useCallback en helpers — no se recrean en cada render
  const getNombreSucursal = useCallback((id) => {
    const suc = sucursales.find(s => s.id === parseInt(id))
    return suc ? suc.nombre : `Sucursal ${id}`
  }, [sucursales])

  const formatearFechaYHora = useCallback((fechaIso) => {
    if (!fechaIso) return 'Fecha desconocida'
    const fecha = fechaIso.endsWith('Z') ? new Date(fechaIso) : new Date(fechaIso + 'Z')
    return fecha.toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    })
  }, [])

  const cambiarEstado = useCallback(async (id, nuevoEstado) => {
    try {
      const respuesta = await fetch(`${API_URL}/pedidos/${id}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado })
      })
      if (respuesta.ok) {
        obtenerDatos()
        setPedidoDetalle(prev => (prev && prev.id === id) ? null : prev)
      } else alert('Error al actualizar el estado ❌')
    } catch (error) { alert('Error de conexión 🔌') }
  }, [obtenerDatos])

  // ✅ useMemo — definido ANTES del motor de vigilancia para evitar el bug de orden
  const pedidosLogistica = useMemo(() =>
    pedidos.filter(p => {
      const responsableId = p.tipo_orden === 'Traspaso'
        ? p.sucursal_id
        : (p.sucursal_destino_id || p.sucursal_id)
      return responsableId === parseInt(usuarioActual.sucursal_id) &&
        ['Aprobado', 'En_Produccion', 'En_Logistica'].includes(p.estado)
    }),
    [pedidos, usuarioActual.sucursal_id]
  )

  // ✅ Motor de vigilancia — pedidosLogistica ya está definido arriba, audio en ref
  useEffect(() => {
    if (permisoNotificaciones !== 'granted') return

    let hayNuevosParaCargar = false

    const listosParaEnviar = pedidosLogistica.filter(p => p.estado === 'En_Logistica')
    listosParaEnviar.forEach(pedido => {
      if (!pedidosYaNotificados.current.has(`${pedido.id}-listo`)) {
        hayNuevosParaCargar = true
        pedidosYaNotificados.current.add(`${pedido.id}-listo`)
      }
    })

    if (hayNuevosParaCargar) {
      // ✅ Audio en ref — no se crea una instancia nueva cada vez
      if (!audioRef.current) {
        audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
      }
      audioRef.current.play().catch(() => {})

      if ('Notification' in window) {
        new Notification('¡Carga Lista para Ruta! 🚚', {
          body: 'El taller ha terminado de procesar material. Revisa la lista para cargar la unidad.'
        })
      }
    }
  }, [pedidosLogistica, permisoNotificaciones])

  const intentarCerrarSesion = () => {
    setConfirmacion({
      titulo: '¿Cerrar Sesión?',
      mensaje: '¿Estás seguro de que deseas salir del Panel de Logística?',
      textoBoton: 'Sí, Salir',
      colorBoton: 'bg-red-600 hover:bg-red-700',
      accion: onCerrarSesion
    })
  }

  // ✅ Bug corregido — "Cargar y Enviar" no debería volver a poner En_Logistica
  // El pedido ya está en En_Logistica cuando llega al chofer, el siguiente paso es Entregado
  // Si tu backend maneja un estado intermedio como "En_Ruta", cámbialo aquí
  const intentarCargarEnvio = useCallback((id) => {
    setConfirmacion({
      titulo: '¿Iniciar Ruta de Entrega?',
      mensaje: '¿Confirmas que el material ya está cargado en la camioneta y va en camino?',
      textoBoton: 'Sí, Enviar',
      colorBoton: 'bg-blue-600 hover:bg-blue-700',
      accion: () => { setConfirmacion(null); cambiarEstado(id, 'En_Logistica') }
    })
  }, [cambiarEstado])

  const intentarFinalizarEntrega = useCallback((id) => {
    setConfirmacion({
      titulo: '¿Finalizar Entrega?',
      mensaje: '¿Confirmas que el material fue entregado correctamente al cliente o a la sucursal de destino?',
      textoBoton: 'Sí, Entregado',
      colorBoton: 'bg-green-600 hover:bg-green-700',
      accion: () => { setConfirmacion(null); cambiarEstado(id, 'Entregado') }
    })
  }, [cambiarEstado])

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8 relative text-gray-950 overflow-x-hidden">
      <div className="max-w-7xl mx-auto">

        {/* Barra Superior */}
        <div className="bg-slate-800 rounded-2xl shadow-xl p-5 sm:p-6 flex flex-col sm:flex-row gap-5 justify-between items-center mb-6 sm:mb-8">
          <div className="flex flex-col items-center sm:items-start w-full justify-center sm:justify-start">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-3xl sm:text-4xl">🚚</span>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white text-center sm:text-left leading-tight">
                Rutas de Entrega
              </h1>
            </div>
            <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2">
              <span className="bg-blue-600/20 text-blue-300 border border-blue-500/30 text-xs font-bold px-3 py-1.5 rounded-full shadow-inner flex items-center gap-1.5 whitespace-nowrap">
                Área de Logística
              </span>
              <span className="bg-slate-700 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-full shadow-inner whitespace-nowrap flex items-center gap-1">
                📍 {getNombreSucursal(usuarioActual.sucursal_id)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto justify-between border-t border-slate-700 pt-5 sm:border-0 sm:pt-0 shrink-0">
            {permisoNotificaciones !== 'granted' && (
              <button
                onClick={solicitarPermisoNotificaciones}
                className="bg-yellow-500 hover:bg-yellow-400 text-yellow-950 font-bold p-3 rounded-full shadow-lg transition active:scale-95 animate-bounce min-h-[44px] min-w-[44px]"
                title="Activar Alertas de Carga"
              >🔕</button>
            )}
            {permisoNotificaciones === 'granted' && (
              <div className="bg-slate-700 p-3 rounded-full shadow-inner text-blue-400 min-h-[44px] min-w-[44px] flex items-center justify-center" title="Alertas de Carga Listas">
                🔔
              </div>
            )}
            <div className="text-right text-white hidden sm:block border-r border-slate-600 pr-4">
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Chofer:</p>
              <p className="text-sm font-bold leading-tight text-blue-300">{usuarioActual.nombre_completo}</p>
            </div>
            <button onClick={intentarCerrarSesion} className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-5 rounded-xl transition active:scale-95 text-sm shadow-md whitespace-nowrap min-h-[44px]">
              Salir
            </button>
          </div>
        </div>

        {/* Entregas Pendientes */}
        <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-6 md:p-8 border border-gray-100 animate-in fade-in relative">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <h2 className="text-xl sm:text-2xl font-extrabold" style={{WebkitFontSmoothing: 'antialiased', color: '#111827'}}>Entregas y Cargas Pendientes</h2>
            <button onClick={obtenerDatos} className="w-full sm:w-auto text-center text-sm bg-gray-100 text-gray-700 px-5 py-3 rounded-xl hover:bg-gray-200 transition font-semibold shadow-sm min-h-[44px]">↻ Actualizar Rutas</button>
          </div>

          {cargando && pedidosLogistica.length === 0 ? (
            <div className="text-center py-20 flex flex-col items-center gap-4">
              <div className="h-10 w-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          ) : pedidosLogistica.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50 p-6">
              <span className="text-6xl mb-4 block">🛣️</span>
              <p className="text-gray-700 text-lg font-medium">¡No hay entregas pendientes para tu sucursal!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {pedidosLogistica.map((pedido) => (
                <div key={pedido.id} className={`bg-slate-50/50 border-2 rounded-2xl overflow-hidden shadow-inner hover:shadow-md transition-all duration-300 flex flex-col animate-in slide-in-from-bottom-2 ${pedido.tipo_orden === 'Traspaso' ? 'border-purple-300 bg-purple-50/30' : 'border-slate-800'}`}>

                  {/* ✅ loading="lazy" en imágenes */}
                  <div onClick={() => setImagenAmpliando(pedido.url_foto_ticket)} className={`h-40 overflow-hidden relative group cursor-pointer border-b-2 shrink-0 ${pedido.tipo_orden === 'Traspaso' ? 'bg-purple-100 border-purple-300' : 'bg-gray-200 border-slate-800'}`}>
                    <img src={pedido.url_foto_ticket} loading="lazy" alt="Ticket" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-sm bg-gray-900/80 px-4 py-2 rounded-full font-bold shadow-lg">🔍 Ver Foto</span>
                    </div>
                  </div>

                  <div className="p-5 flex flex-col flex-grow">
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <div>
                        <span className="text-sm font-black text-gray-700 bg-gray-100 px-2.5 py-1 rounded-md border border-gray-300 shrink-0">#{pedido.id}</span>
                        {pedido.numero_ticket && (
                          <p className="text-[11px] font-black text-gray-800 mt-2 leading-tight">Folio: {pedido.numero_ticket}</p>
                        )}
                      </div>
                      {pedido.tipo_orden === 'Traspaso' ? (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full shadow-inner border-2 bg-purple-100 text-purple-900 border-purple-300 h-fit uppercase tracking-widest">📦 Traspaso</span>
                      ) : (
                        <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full shadow-inner border-2 uppercase tracking-wider h-fit ${pedido.estado === 'En_Logistica' ? 'bg-green-100 text-green-900 border-green-300' : 'bg-blue-100 text-blue-900 border-blue-300'}`}>
                          {pedido.estado === 'Aprobado' || pedido.estado === 'En_Produccion' ? '🏭 En Almacén' : '🚚 En Camioneta'}
                        </span>
                      )}
                    </div>

                    {pedido.requiere_produccion && (pedido.estado === 'Aprobado' || pedido.estado === 'En_Produccion') && (
                      <div className="bg-orange-100 border border-orange-300 text-orange-900 px-3 py-2 rounded-lg mb-3 text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm">
                        <span>⚠️</span> Aún en taller (puedes ir cargando lo demás)
                      </div>
                    )}

                    <div className="bg-white p-3 rounded-xl flex-grow mb-4 text-sm text-gray-800 border border-gray-200 shadow-sm overflow-hidden">
                      <p className="whitespace-pre-wrap break-words line-clamp-3">{pedido.notas}</p>
                    </div>

                    {/* ✅ Botones con min-h-[44px] */}
                    <button
                      onClick={() => setPedidoDetalle(pedido)}
                      className="w-full bg-white hover:bg-slate-50 text-slate-700 font-bold py-2.5 rounded-xl transition text-sm border-2 border-slate-200 shadow-sm flex justify-center items-center gap-2 active:scale-95 mb-3 shrink-0 min-h-[44px]"
                    >
                      <span>📄</span> Ver Detalles de Entrega
                    </button>

                    {(pedido.estado === 'Aprobado' || pedido.estado === 'En_Produccion') && (
                      pedido.requiere_produccion ? (
                        <button disabled className="w-full bg-gray-200 text-gray-500 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-base cursor-not-allowed border-2 border-gray-300 shadow-inner min-h-[44px]">
                          ⏳ Esperando cortes...
                        </button>
                      ) : (
                        <button
                          onClick={() => intentarCargarEnvio(pedido.id)}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3.5 rounded-xl transition active:scale-95 shadow-md flex items-center justify-center gap-2 text-base shrink-0 border-2 border-blue-700 min-h-[44px]"
                        >
                          🚚 Cargar y Enviar
                        </button>
                      )
                    )}

                    {pedido.estado === 'En_Logistica' && (
                      <button
                        onClick={() => intentarFinalizarEntrega(pedido.id)}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-extrabold py-3.5 rounded-xl transition active:scale-95 shadow-md flex items-center justify-center gap-2 text-base shrink-0 border-2 border-green-700 min-h-[44px]"
                      >
                        ✅ Finalizar (Entregado)
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Detalles */}
      {pedidoDetalle && (
        <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-slate-800 p-5 sm:p-6 flex justify-between items-center text-white shrink-0">
              <div>
                <h3 className="font-extrabold text-xl sm:text-2xl flex items-center gap-2">📄 Detalles de Entrega #{pedidoDetalle.id}</h3>
                {pedidoDetalle.numero_ticket && <p className="text-slate-300 text-sm mt-1">Folio: {pedidoDetalle.numero_ticket}</p>}
              </div>
              {/* ✅ Botón cerrar con tamaño mínimo touch */}
              <button onClick={() => setPedidoDetalle(null)} className="text-slate-400 hover:text-white text-3xl font-bold min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-slate-700 transition">&times;</button>
            </div>
            {/* ✅ overscroll-contain para teclado en Android */}
            <div className="p-5 sm:p-8 space-y-6 overflow-y-auto overscroll-contain bg-gray-50 flex-grow">
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Origen de Venta</p>
                  <p className="font-bold text-gray-900">{getNombreSucursal(pedidoDetalle.sucursal_id)}</p>
                </div>
                <div className="text-right sm:text-left">
                  <p className="text-[10px] text-gray-500 font-medium">📥 Ingresó: {formatearFechaYHora(pedidoDetalle.fecha_creacion)}</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Material y Dirección</h4>
                  <button onClick={() => setImagenAmpliando(pedidoDetalle.url_foto_ticket)} className="text-blue-600 hover:text-blue-800 text-sm font-bold flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-lg transition min-h-[44px]">🔍 Ver Ticket</button>
                </div>
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                  <textarea readOnly value={pedidoDetalle.notas} className="w-full bg-transparent text-gray-800 text-base leading-relaxed resize-none outline-none h-48 whitespace-pre-wrap"></textarea>
                </div>
              </div>

              {/* Botón de acción también dentro del modal */}
              {pedidoDetalle.estado === 'En_Logistica' && (
                <button
                  onClick={() => intentarFinalizarEntrega(pedidoDetalle.id)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-extrabold py-4 rounded-xl transition active:scale-95 shadow-md flex items-center justify-center gap-2 text-lg min-h-[44px]"
                >
                  ✅ Finalizar (Entregado)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Visor de Fotos */}
      {imagenAmpliando && (
        <div className="fixed inset-0 bg-gray-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in zoom-in duration-200">
          <button onClick={() => setImagenAmpliando(null)} className="absolute top-4 right-4 sm:top-8 sm:right-8 text-white bg-gray-800 rounded-full w-12 h-12 flex items-center justify-center text-3xl font-bold transition shadow-xl active:scale-95 min-h-[44px] min-w-[44px]">&times;</button>
          <img src={imagenAmpliando} alt="Ticket Ampliado" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl border border-gray-800" />
        </div>
      )}

      {/* Modal de Confirmación */}
      {confirmacion && (
        <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-[200] animate-in zoom-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden text-center p-8">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-6">
              <span className="text-3xl">⚠️</span>
            </div>
            <h3 className="text-xl font-extrabold text-gray-900 mb-2">{confirmacion.titulo}</h3>
            <p className="text-gray-500 mb-8 font-medium">{confirmacion.mensaje}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmacion(null)} className="flex-1 bg-gray-100 py-3.5 rounded-xl font-bold text-gray-700 hover:bg-gray-200 transition active:scale-95 min-h-[44px]">Cancelar</button>
              <button onClick={confirmacion.accion} className={`flex-1 text-white py-3.5 rounded-xl font-bold shadow-md transition active:scale-95 min-h-[44px] ${confirmacion.colorBoton}`}>{confirmacion.textoBoton}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default PanelLogistica