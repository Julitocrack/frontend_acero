import { useState, useEffect, useCallback, useMemo } from 'react'

// ✅ URL centralizada
const API_URL = 'https://aceros-backend-production.up.railway.app'

function PanelVentas({ usuarioActual, onCerrarSesion }) {
  const [solicitudes, setSolicitudes] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [cargando, setCargando] = useState(false)
  const [vistaActiva, setVistaActiva] = useState('activas')

  const [imagenAmpliando, setImagenAmpliando] = useState(null)
  const [confirmacion, setConfirmacion] = useState(null)

  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [archivoSeleccionado, setArchivoSeleccionado] = useState(null)
  const [nombreArchivo, setNombreArchivo] = useState('Ningún archivo seleccionado')
  const [enviando, setEnviando] = useState(false)

  const [leyendoIA, setLeyendoIA] = useState(false)
  const [errorIA, setErrorIA] = useState(false)
  const [numeroTicket, setNumeroTicket] = useState('')
  const [notasNuevoPedido, setNotasNuevoPedido] = useState('')

  // ✅ useCallback — no se recrea en cada render
  const obtenerDatosIniciales = useCallback(async () => {
    setCargando(true)
    try {
      const [resPedidos, resSucursales] = await Promise.all([
        fetch(`${API_URL}/pedidos/`),
        fetch(`${API_URL}/sucursales/`)
      ])
      if (resSucursales.ok) setSucursales(await resSucursales.json())
      if (resPedidos.ok) {
        const todosLosPedidos = await resPedidos.json()
        setSolicitudes(todosLosPedidos.filter(p => p.sucursal_id === usuarioActual.sucursal_id))
      }
    } catch (error) { console.error('Error:', error) }
    setCargando(false)
  }, [usuarioActual.sucursal_id])

  // ✅ Refresco automático cada 60 segundos — el vendedor ve cambios de estado sin recargar
  useEffect(() => {
    obtenerDatosIniciales()
    const intervalo = setInterval(obtenerDatosIniciales, 60000)
    return () => clearInterval(intervalo)
  }, [obtenerDatosIniciales])

  const getNombreSucursal = (id) => {
    const suc = sucursales.find(s => s.id === parseInt(id))
    return suc ? suc.nombre : 'Cargando...'
  }

  const formatearFechaYHora = (fechaIso) => {
    if (!fechaIso) return 'Fecha desconocida'
    const fecha = fechaIso.endsWith('Z') ? new Date(fechaIso) : new Date(fechaIso + 'Z')
    return fecha.toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    })
  }

  // ✅ useMemo — no se recalculan en cada render
  const miSucursal = useMemo(
    () => sucursales.find(s => s.id === parseInt(usuarioActual.sucursal_id)),
    [sucursales, usuarioActual.sucursal_id]
  )
  const sucursalTieneTaller = miSucursal ? miSucursal.tiene_produccion : false

  const solicitudesActivas = useMemo(
    () => solicitudes.filter(p => p.estado !== 'Entregado' && p.estado !== 'Rechazado'),
    [solicitudes]
  )
  const solicitudesHistorial = useMemo(
    () => solicitudes.filter(p => p.estado === 'Entregado' || p.estado === 'Rechazado'),
    [solicitudes]
  )
  const historialAgrupadoPorFecha = useMemo(() =>
    solicitudesHistorial.reduce((grupos, pedido) => {
      const fecha = pedido.fecha_creacion
        ? new Date(pedido.fecha_creacion).toLocaleDateString()
        : 'Registros Anteriores'
      if (!grupos[fecha]) grupos[fecha] = []
      grupos[fecha].push(pedido)
      return grupos
    }, {}),
    [solicitudesHistorial]
  )

  const iconosEstadoHistorial = {
    'Entregado': { icono: '✅', color: 'text-green-700 bg-green-100 border-green-300', texto: 'Entregado' },
    'Rechazado': { icono: '❌', color: 'text-red-700 bg-red-100 border-red-300', texto: 'Rechazado' },
  }

  // ✅ handleFileChange con manejo de error de IA separado
  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setArchivoSeleccionado(file)
    setNombreArchivo(file.name)
    setErrorIA(false)
    setLeyendoIA(true)
    const formDataInfo = new FormData()
    formDataInfo.append('foto', file)
    try {
      const res = await fetch(`${API_URL}/pedidos/analizar-ticket`, {
        method: 'POST', body: formDataInfo
      })
      if (res.ok) {
        const datosExtraidos = await res.json()
        if (datosExtraidos.numero_ticket) setNumeroTicket(datosExtraidos.numero_ticket)
        if (datosExtraidos.detalles) setNotasNuevoPedido(datosExtraidos.detalles)
      } else {
        setErrorIA(true)
      }
    } catch (err) {
      console.error('No se pudo leer el ticket con IA')
      setErrorIA(true)
    }
    setLeyendoIA(false)
  }

  const intentarEnviarPedido = (e) => {
    e.preventDefault()
    if (!archivoSeleccionado) return alert('Por favor selecciona una foto del ticket.')
    setConfirmacion({
      titulo: '¿Enviar Solicitud?',
      mensaje: '¿Estás seguro de que el material a cortar y el folio están correctos? Se enviará a Gerencia.',
      textoBoton: 'Sí, Enviar a Gerencia',
      colorBoton: 'bg-orange-600 hover:bg-orange-700',
      accion: ejecutarEnvioPedido
    })
  }

  const ejecutarEnvioPedido = async () => {
    setConfirmacion(null)
    setEnviando(true)
    const formData = new FormData()
    formData.append('sucursal_id', usuarioActual.sucursal_id)
    formData.append('creador_id', usuarioActual.id)
    formData.append('notas', notasNuevoPedido)
    formData.append('foto', archivoSeleccionado)
    formData.append('requiere_matriz', 'true')
    formData.append('requiere_produccion', 'true')
    formData.append('tipo_orden', 'Venta')
    if (numeroTicket) formData.append('numero_ticket', numeroTicket)
    try {
      const respuesta = await fetch(`${API_URL}/pedidos/`, { method: 'POST', body: formData })
      if (respuesta.ok) {
        setNotasNuevoPedido(''); setNumeroTicket('')
        setArchivoSeleccionado(null); setNombreArchivo('Ningún archivo seleccionado')
        setMostrarFormulario(false)
        obtenerDatosIniciales()
      } else { alert('Hubo un error al guardar el pedido ❌') }
    } catch (error) { alert('Error de conexión con el servidor 🔌') }
    setEnviando(false)
  }

  const intentarCerrarSesion = () => {
    setConfirmacion({
      titulo: '¿Cerrar Sesión?',
      mensaje: '¿Estás seguro de que deseas salir del sistema?',
      textoBoton: 'Sí, Salir',
      colorBoton: 'bg-red-600 hover:bg-red-700',
      accion: onCerrarSesion
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8 relative text-gray-950">
      <div className="max-w-7xl mx-auto">

        {/* Barra Superior */}
        <div className="bg-slate-800 rounded-2xl shadow-xl p-5 sm:p-6 flex flex-col sm:flex-row gap-5 justify-between items-center mb-6">
          <div className="flex flex-col items-center sm:items-start w-full justify-center sm:justify-start">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-3xl sm:text-4xl">📍</span>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white text-center sm:text-left leading-tight">
                {getNombreSucursal(usuarioActual.sucursal_id)}
              </h1>
            </div>
            <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2">
              <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-inner flex items-center gap-1.5">
                📝 Panel de Ventas
              </span>
              {sucursalTieneTaller ? (
                <span className="bg-orange-500/20 text-orange-300 border border-orange-500/30 text-xs font-bold px-3 py-1.5 rounded-full shadow-inner flex items-center gap-1.5">
                  ⚙️ Con Taller
                </span>
              ) : (
                <span className="bg-slate-700 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-full shadow-inner">
                  Punto de Venta
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-5 w-full sm:w-auto justify-between border-t border-slate-700 pt-5 sm:border-0 sm:pt-0 shrink-0">
            <div className="text-left sm:text-right text-white">
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Atendiendo:</p>
              <p className="text-lg font-bold leading-tight">{usuarioActual.nombre_completo}</p>
            </div>
            <button onClick={intentarCerrarSesion} className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-5 rounded-xl transition active:scale-95 text-sm shadow-md shrink-0 min-h-[44px]">
              Cerrar Sesión
            </button>
          </div>
        </div>

        {/* ✅ Pestañas con min-h touch-friendly */}
        <div className="flex gap-2 sm:gap-4 mb-8 bg-white p-2 rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          {[
            { id: 'activas', label: '📋 Solicitudes en Curso' },
            { id: 'historial', label: '🗂️ Historial de Ventas' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setVistaActiva(tab.id)}
              className={`flex-1 sm:flex-none px-6 py-3 rounded-lg font-bold transition-all text-sm whitespace-nowrap min-h-[44px] ${vistaActiva === tab.id ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-6 md:p-8 border border-gray-100 animate-in fade-in">

          {/* ✅ Botón flotante con margen extra para la home bar de iPhone */}
          <button
            onClick={() => setMostrarFormulario(true)}
            className="sm:hidden fixed bottom-8 right-6 h-16 w-16 bg-orange-600 text-white rounded-full shadow-2xl flex items-center justify-center text-3xl z-40 active:scale-95 transition-transform"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >+</button>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <h2 className="text-xl sm:text-2xl font-extrabold" style={{WebkitFontSmoothing: 'antialiased', color: '#111827'}}>
              {vistaActiva === 'activas' ? 'Seguimiento de Material' : 'Registro Histórico'}
            </h2>
            <div className="flex gap-3 w-full sm:w-auto">
              <button onClick={obtenerDatosIniciales} className="flex-1 sm:flex-none text-center text-sm bg-gray-100 text-gray-700 px-5 py-3 rounded-xl hover:bg-gray-200 transition font-semibold min-h-[44px]">
                ↻ Actualizar
              </button>
              <button onClick={() => setMostrarFormulario(true)} className="flex-1 sm:flex-none text-center text-sm bg-orange-600 hover:bg-orange-700 text-white px-5 py-3 rounded-xl font-bold transition shadow active:scale-95 min-h-[44px]">
                + Pedir Material
              </button>
            </div>
          </div>

          {cargando ? (
            <div className="text-center py-20 flex flex-col items-center gap-4">
              <div className="h-10 w-10 border-4 border-gray-200 border-t-orange-600 rounded-full animate-spin"></div>
              <p className="text-gray-500 font-medium">Cargando...</p>
            </div>
          ) : vistaActiva === 'activas' ? (
            solicitudesActivas.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <span className="text-5xl block mb-3">📦</span>
                <p className="text-gray-600 font-medium text-lg">No tienes solicitudes en curso.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {solicitudesActivas.map(solicitud => (
                  <div key={solicitud.id} className="bg-white border rounded-2xl overflow-hidden shadow-sm flex flex-col">
                    {/* ✅ loading="lazy" en imágenes */}
                    <div onClick={() => setImagenAmpliando(solicitud.url_foto_ticket)} className="h-40 bg-gray-100 overflow-hidden relative group cursor-pointer border-b shrink-0">
                      <img src={solicitud.url_foto_ticket} loading="lazy" className="w-full h-full object-cover" alt="Ticket" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center transition opacity-0 group-hover:opacity-100">
                        <span className="text-white text-sm bg-gray-900/80 px-4 py-2 rounded-full font-bold shadow-lg flex items-center gap-2">🔍 Ver Foto</span>
                      </div>
                    </div>
                    <div className="p-5 bg-white flex flex-col flex-grow">
                      <div className="flex justify-between items-start mb-3 gap-2">
                        <div>
                          <span className="text-sm font-black text-gray-700 bg-gray-100 px-2 py-1 rounded-md border border-gray-200 shrink-0">#{solicitud.id}</span>
                          {solicitud.numero_ticket && (
                            <p className="text-xs font-black text-gray-800 mt-2">Folio: {solicitud.numero_ticket}</p>
                          )}
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded border uppercase tracking-wider h-fit ${
                          solicitud.estado === 'Pendiente' ? 'bg-yellow-100 text-yellow-900 border-yellow-200' :
                          solicitud.estado === 'Aprobado' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                          solicitud.estado === 'En_Produccion' ? 'bg-orange-500 text-white animate-pulse border-orange-600' :
                          'bg-green-500 text-white border-green-600'
                        }`}>
                          {solicitud.estado === 'Pendiente' ? '⏳ Pendiente Gerencia' :
                           solicitud.estado === 'Aprobado' ? '⚙️ En Fila Taller' :
                           solicitud.estado === 'En_Produccion' ? '🔥 Cortando' :
                           solicitud.estado === 'En_Logistica' ? '🚚 Listo en Logística' : solicitud.estado}
                        </span>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex-grow mb-4 overflow-hidden">
                        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap break-words line-clamp-3">{solicitud.notas}</p>
                      </div>
                      <p className="text-xs text-gray-400 font-medium border-t pt-3 mt-auto">🕑 Ingresó: {formatearFechaYHora(solicitud.fecha_creacion)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            Object.keys(historialAgrupadoPorFecha).length === 0 ? (
              <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-gray-600 font-medium text-lg">El historial está vacío.</p>
              </div>
            ) : (
              Object.keys(historialAgrupadoPorFecha).map((fecha) => (
                <div key={fecha} className="mb-10 last:mb-0">
                  <h3 className="text-lg font-bold text-blue-800 border-b-2 border-blue-100 pb-2 mb-4">📅 {fecha}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {historialAgrupadoPorFecha[fecha].map((pedido) => {
                      const config = iconosEstadoHistorial[pedido.estado] || {}
                      return (
                        <div key={pedido.id} className="bg-slate-50/50 border-2 border-slate-800 rounded-2xl overflow-hidden shadow-inner hover:shadow-md transition-all flex flex-col">
                          {/* ✅ loading="lazy" en historial */}
                          <div onClick={() => setImagenAmpliando(pedido.url_foto_ticket)} className="h-32 bg-gray-200 overflow-hidden relative group cursor-pointer border-b-2 border-slate-800 shrink-0">
                            <img src={pedido.url_foto_ticket} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Ticket" />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                              <span className="text-white text-xs bg-gray-900/80 px-3 py-1.5 rounded-full font-bold shadow-lg">🔍 Ver Foto</span>
                            </div>
                          </div>
                          <div className="p-4 flex flex-col flex-grow">
                            <div className="flex justify-between items-start mb-3 gap-2">
                              <div>
                                <span className="text-sm font-black text-gray-700 bg-gray-100 px-2.5 py-1 rounded-md border border-gray-300 shrink-0">#{pedido.id}</span>
                                {pedido.numero_ticket ? (
                                  <p className="text-[11px] font-black text-gray-800 mt-2 leading-tight">Folio: {pedido.numero_ticket}</p>
                                ) : (
                                  <p className="text-[10px] font-semibold text-gray-400 mt-2 leading-tight">Sin Folio</p>
                                )}
                              </div>
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border-2 uppercase tracking-widest h-fit shadow-inner ${config.color}`}>
                                {config.icono} {config.texto}
                              </span>
                            </div>
                            <div className="bg-white p-3 rounded-xl flex-grow mb-3 text-xs text-gray-600 border border-gray-200 shadow-sm">
                              <p className="line-clamp-3 whitespace-pre-wrap">{pedido.notas}</p>
                            </div>
                            <div className="mt-auto pt-3 border-t border-gray-200 flex flex-col gap-1.5">
                              <p className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
                                📥 Ingresó: {formatearFechaYHora(pedido.fecha_creacion)}
                              </p>
                              <p className="text-[10px] text-gray-900 font-bold bg-white px-2 py-1.5 rounded-lg border border-gray-200 shadow-sm w-fit flex items-center gap-1">
                                {pedido.estado === 'Entregado' ? '✅ Finalizado:' : '❌ Finalizado:'} {formatearFechaYHora(pedido.fecha_actualizacion)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>

      {/* Visor de Fotos */}
      {imagenAmpliando && (
        <div className="fixed inset-0 bg-gray-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in zoom-in duration-200">
          <button onClick={() => setImagenAmpliando(null)} className="absolute top-4 right-4 sm:top-8 sm:right-8 text-white bg-gray-800 hover:bg-gray-700 rounded-full w-12 h-12 flex items-center justify-center text-3xl font-bold transition shadow-xl active:scale-95 min-h-[44px] min-w-[44px]">
            &times;
          </button>
          <img src={imagenAmpliando} alt="Ticket Ampliado" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl border border-gray-800" />
        </div>
      )}

      {/* Modal de Nuevo Pedido */}
      {mostrarFormulario && (
        <div className="fixed inset-0 bg-gray-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in duration-300 flex flex-col max-h-[95vh]">
            <div className="bg-orange-600 p-5 flex justify-between items-center text-white shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚙️</span>
                <h3 className="font-extrabold text-xl sm:text-2xl tracking-tight">Pedir Material para Corte</h3>
              </div>
              <button onClick={() => setMostrarFormulario(false)} className="text-orange-200 hover:text-white text-3xl font-bold min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-orange-700 transition">&times;</button>
            </div>

            {/* ✅ overscroll-contain para evitar problemas con teclado en Android */}
            <form onSubmit={intentarEnviarPedido} className="p-5 sm:p-8 space-y-6 bg-white overflow-y-auto overscroll-contain flex-grow relative text-left">
              {leyendoIA && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center rounded-b-3xl">
                  <div className="h-16 w-16 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                  <h3 className="text-xl font-bold text-blue-800 animate-pulse">✨ La IA está leyendo...</h3>
                  <p className="text-gray-500 font-medium">Extrayendo folio y material</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2 ml-1">Foto clara del Ticket / Factura</label>
                <div className="relative group border-2 border-dashed border-gray-200 rounded-2xl hover:border-orange-400 hover:bg-orange-50 transition p-1 bg-gray-50">
                  <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" required />
                  <div className="p-4 sm:p-6 text-center flex flex-col items-center justify-center gap-3">
                    <span className="text-5xl group-hover:scale-110 transition-transform">📸</span>
                    <p className="text-gray-900 font-semibold text-base break-all bg-white px-2 rounded">{nombreArchivo}</p>
                    {/* ✅ Feedback claro si la IA falló */}
                    {errorIA ? (
                      <p className="text-xs text-red-600 font-bold bg-red-50 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-inner">⚠️ No se pudo leer — escribe el folio manualmente</p>
                    ) : (
                      <p className="text-xs text-blue-600 font-bold bg-blue-50 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-inner">✨ Toca aquí, la IA lo llenará</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2 ml-1">🧾 No. de Ticket / Folio</label>
                  {/* ✅ inputMode="numeric" — teclado numérico en móvil */}
                  <input
                    type="text"
                    value={numeroTicket}
                    onChange={(e) => setNumeroTicket(e.target.value)}
                    inputMode="numeric"
                    className="w-full border border-gray-300 rounded-xl p-4 text-gray-950 bg-yellow-50 focus:ring-2 focus:ring-orange-300 outline-none font-black text-xl shadow-inner placeholder:text-gray-300"
                    placeholder="Ej. 12939"
                    required
                  />
                  <p className="text-[10px] text-gray-500 mt-1.5 ml-1">Valida que la IA lo haya leído bien.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-orange-800 mb-2 ml-1">📝 Material para Corte (Extraído por IA)</label>
                  <textarea
                    value={notasNuevoPedido}
                    onChange={(e) => setNotasNuevoPedido(e.target.value)}
                    className="w-full border border-orange-200 rounded-2xl p-4 text-gray-950 text-base bg-orange-50/50 placeholder:text-gray-400 focus:ring-2 focus:ring-orange-300 transition resize-none h-48 outline-none shadow-inner whitespace-pre-wrap"
                    placeholder="Sube la foto o escribe aquí el material a cortar..."
                    required
                  ></textarea>
                </div>
              </div>

              {/* ✅ Botones con min-h touch-friendly */}
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 mt-4 bg-white border-t border-gray-100">
                <button type="button" onClick={() => setMostrarFormulario(false)} className="w-full sm:w-auto px-6 py-3.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition font-semibold text-base active:scale-95 flex items-center justify-center gap-2 min-h-[44px]">Cancelar</button>
                <button type="submit" disabled={enviando} className="w-full sm:w-auto px-10 py-3.5 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-xl transition font-bold text-base shadow active:scale-95 flex items-center justify-center gap-2.5 min-h-[44px]">
                  {enviando ? 'Enviando...' : '➕ Enviar a Gerencia'}
                </button>
              </div>
            </form>
          </div>
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
              <button onClick={() => setConfirmacion(null)} className="flex-1 bg-gray-100 py-3.5 rounded-xl font-bold text-gray-700 hover:bg-gray-200 transition active:scale-95 min-h-[44px]">
                Cancelar
              </button>
              <button onClick={confirmacion.accion} className={`flex-1 text-white py-3.5 rounded-xl font-bold shadow-md transition active:scale-95 min-h-[44px] ${confirmacion.colorBoton}`}>
                {confirmacion.textoBoton}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default PanelVentas