import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
 
// ✅ CORRECCIÓN #1: URL centralizada — si cambia el dominio, se edita en UN solo lugar
const API_URL = 'https://aceros-backend-production.up.railway.app'
 
function PanelDuena({ usuarioActual, onCerrarSesion }) {
  const [pedidos, setPedidos] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [cargando, setCargando] = useState(false)
  const [vistaActiva, setVistaActiva] = useState('pedidos')
  const [horaActual, setHoraActual] = useState(new Date())
 
  // Reloj visual (cada segundo)
  useEffect(() => {
    const intervalo = setInterval(() => setHoraActual(new Date()), 1000)
    return () => clearInterval(intervalo)
  }, [])
 
  // Estados de Control
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null)
  const [pedidoDetalle, setPedidoDetalle] = useState(null)
  const [decision, setDecision] = useState('Aprobado')
  const [sucursalDestino, setSucursalDestino] = useState('')
  const [procesando, setProcesando] = useState(false)
 
  const [creandoUsuario, setCreandoUsuario] = useState(false)
  const [nuevoEmpleado, setNuevoEmpleado] = useState({ nombre_completo: '', username: '', password: '', rol: 'ventas', sucursal_id: '' })
  const [creandoSucursal, setCreandoSucursal] = useState(false)
  const [nuevaSucursal, setNuevaSucursal] = useState({ nombre: '', direccion: '', telefono: '', tiene_produccion: false })
 
  const [empleadoEditando, setEmpleadoEditando] = useState(null)
  const [sucursalEditando, setSucursalEditando] = useState(null)
 
  const [mostrarTraspaso, setMostrarTraspaso] = useState(false)
  const [archivoTraspaso, setArchivoTraspaso] = useState(null)
  const [nombreArchivoTraspaso, setNombreArchivoTraspaso] = useState('Ningún archivo seleccionado')
  const [origenTraspaso, setOrigenTraspaso] = useState('')
  const [destinoTraspaso, setDestinoTraspaso] = useState('')
  const [notasTraspaso, setNotasTraspaso] = useState('')
  const [enviandoTraspaso, setEnviandoTraspaso] = useState(false)
 
  const [imagenAmpliando, setImagenAmpliando] = useState(null)
  const [confirmacion, setConfirmacion] = useState(null)
 
  // ==============================================
  // NOTIFICACIONES GERENCIALES
  // ==============================================
  const [permisoNotificaciones, setPermisoNotificaciones] = useState(
    'Notification' in window ? Notification.permission : 'default'
  )
  const notificacionesEnviadas = useRef(new Set())
  // ✅ CORRECCIÓN #2: Ref para el audio — evita recrearlo en cada render
  const audioRef = useRef(null)
 
  const solicitarPermisoNotificaciones = async () => {
    if (!('Notification' in window)) {
      alert('Tu navegador en celular no soporta notificaciones de escritorio, pero verás los cambios en pantalla.')
      return
    }
    const permiso = await Notification.requestPermission()
    setPermisoNotificaciones(permiso)
    if (permiso === 'granted') {
      new Notification('¡Tablero Conectado! ⚖️', {
        body: 'Recibirás alertas de autorizaciones pendientes y retrasos críticos.'
      })
    }
  }
 
  // ✅ CORRECCIÓN #4: useCallback para no recrear la función en cada render
  const obtenerDatosIniciales = useCallback(async () => {
    setCargando(true)
    try {
      const [resPedidos, resSucursales, resUsuarios] = await Promise.all([
        fetch(`${API_URL}/pedidos/`),
        fetch(`${API_URL}/sucursales/`),
        fetch(`${API_URL}/usuarios/`)
      ])
      if (resPedidos.ok) setPedidos(await resPedidos.json())
      if (resUsuarios.ok) setEmpleados(await resUsuarios.json())
      if (resSucursales.ok) {
        const listaSucs = await resSucursales.json()
        setSucursales(listaSucs)
        // ✅ CORRECCIÓN #13: Preselección de sucursal desacoplada de la carga de datos
        if (listaSucs.length > 0) {
          setNuevoEmpleado(prev =>
            prev.sucursal_id ? prev : { ...prev, sucursal_id: listaSucs[0].id }
          )
        }
      }
    } catch (error) {
      console.error('Error al cargar datos:', error)
    }
    setCargando(false)
  }, [])
 
  // ✅ CORRECCIÓN #6: vistaActiva eliminada de las dependencias — el intervalo
  // ya no se reinicia al cambiar de pestaña
  useEffect(() => {
    obtenerDatosIniciales()
    const intervaloDatos = setInterval(obtenerDatosIniciales, 60000)
    return () => clearInterval(intervaloDatos)
  }, [obtenerDatosIniciales])
 
  const getNombreSucursal = (id) => {
    const suc = sucursales.find(s => s.id === parseInt(id))
    return suc ? suc.nombre : (id ? `Sucursal ${id}` : 'Por asignar')
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
 
  const obtenerTiempoTranscurrido = (fecha_aprobacion) => {
    if (!fecha_aprobacion) return '00:00:00'
    const inicio = new Date(fecha_aprobacion.endsWith('Z') ? fecha_aprobacion : fecha_aprobacion + 'Z')
    const diff = Math.max(0, horaActual - inicio)
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
 
  // ✅ CORRECCIÓN #5: useMemo — los filtros no se recalculan en cada render
  const pedidosActivos = useMemo(
    () => pedidos.filter(p => p.estado !== 'Entregado' && p.estado !== 'Rechazado'),
    [pedidos]
  )
  const pedidosHistorial = useMemo(
    () => pedidos.filter(p => p.estado === 'Entregado' || p.estado === 'Rechazado'),
    [pedidos]
  )
 
  // ==============================================
  // ✅ CORRECCIÓN #2: MOTOR DE VIGILANCIA — audio fuera del ciclo del reloj
  // El efecto ya NO depende de horaActual para el audio
  // ==============================================
  useEffect(() => {
    if (permisoNotificaciones !== 'granted') return
 
    let hayPendientes = false
    let hayRetrasosCriticos = false
 
    pedidosActivos.forEach(pedido => {
      if (pedido.estado === 'Pendiente' && !notificacionesEnviadas.current.has(`${pedido.id}-pendiente`)) {
        hayPendientes = true
        notificacionesEnviadas.current.add(`${pedido.id}-pendiente`)
      }
 
      if ((pedido.estado === 'Aprobado' || pedido.estado === 'En_Produccion') && pedido.fecha_aprobacion) {
        const inicio = new Date(pedido.fecha_aprobacion.endsWith('Z') ? pedido.fecha_aprobacion : pedido.fecha_aprobacion + 'Z')
        const diffHrs = Math.floor((new Date() - inicio) / (1000 * 60 * 60))
        if (diffHrs >= 2 && !notificacionesEnviadas.current.has(`${pedido.id}-retraso`)) {
          hayRetrasosCriticos = true
          notificacionesEnviadas.current.add(`${pedido.id}-retraso`)
        }
      }
    })
 
    if (hayPendientes || hayRetrasosCriticos) {
      // ✅ Audio solo cuando hay eventos nuevos, no cada segundo
      if (!audioRef.current) {
        audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
      }
      audioRef.current.play().catch(() => {})
 
      if (hayPendientes && 'Notification' in window) {
        new Notification('¡Requiere tu Autorización! ⚖️', {
          body: 'Han ingresado nuevos tickets. Revísalos para liberar el corte.'
        })
      }
      if (hayRetrasosCriticos && 'Notification' in window) {
        new Notification('🚨 ¡RETRASO CRÍTICO EN TALLER!', {
          body: 'Foco rojo: Tienes material atorado en producción por más de 2 horas.'
        })
      }
    }
  // ✅ Solo depende de pedidosActivos y el permiso — NO de horaActual
  }, [pedidosActivos, permisoNotificaciones])
 
  const historialAgrupadoPorFecha = useMemo(() =>
    pedidosHistorial.reduce((grupos, pedido) => {
      const fecha = pedido.fecha_creacion
        ? new Date(pedido.fecha_creacion).toLocaleDateString()
        : 'Registros Anteriores'
      if (!grupos[fecha]) grupos[fecha] = []
      grupos[fecha].push(pedido)
      return grupos
    }, {}),
    [pedidosHistorial]
  )
 
  const handleFileTraspaso = (e) => {
    const file = e.target.files[0]
    if (file) { setArchivoTraspaso(file); setNombreArchivoTraspaso(file.name) }
  }
 
  const generarTraspaso = async (e) => {
    e.preventDefault()
    if (!archivoTraspaso) return alert('Por favor sube la foto del inventario o vale de salida.')
    if (origenTraspaso === destinoTraspaso) return alert('La sucursal de origen y destino no pueden ser la misma.')
    setEnviandoTraspaso(true)
    const formData = new FormData()
    formData.append('sucursal_id', origenTraspaso)
    formData.append('creador_id', usuarioActual.id)
    formData.append('notas', `📦 **TRASPASO INTERNO**\n📍 De: ${getNombreSucursal(parseInt(origenTraspaso))}\n📍 Para: ${getNombreSucursal(parseInt(destinoTraspaso))}\n📝 Detalles: ${notasTraspaso}`)
    formData.append('foto', archivoTraspaso)
    formData.append('requiere_matriz', 'false')
    formData.append('requiere_produccion', 'false')
    formData.append('tipo_orden', 'Traspaso')
    formData.append('sucursal_destino_id', destinoTraspaso)
    try {
      const respuesta = await fetch(`${API_URL}/pedidos/`, { method: 'POST', body: formData })
      if (respuesta.ok) {
        setMostrarTraspaso(false); setArchivoTraspaso(null)
        setNombreArchivoTraspaso('Ningún archivo seleccionado')
        setNotasTraspaso(''); setOrigenTraspaso(''); setDestinoTraspaso('')
        obtenerDatosIniciales()
      } else alert('Error al generar el traspaso.')
    } catch (error) { alert('Error de conexión.') }
    setEnviandoTraspaso(false)
  }
 
  const ejecutarAprobacion = async () => {
    setProcesando(true)
    const datosAprobacion = {
      estado: decision,
      requiere_produccion: decision === 'Aprobado' ? false : false,
      sucursal_destino_id: decision === 'Aprobado' ? parseInt(sucursalDestino) : null
    }
    try {
      const res = await fetch(`${API_URL}/pedidos/${pedidoSeleccionado.id}/aprobar`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datosAprobacion)
      })
      if (res.ok) { setPedidoSeleccionado(null); obtenerDatosIniciales() }
    } catch (e) { alert('❌ Error de conexión') }
    setProcesando(false)
  }
 
  const registrarSucursal = async (e) => {
    e.preventDefault(); setCreandoSucursal(true)
    try {
      const res = await fetch(`${API_URL}/sucursales/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nuevaSucursal)
      })
      if (res.ok) {
        setNuevaSucursal({ nombre: '', direccion: '', telefono: '', tiene_produccion: false })
        obtenerDatosIniciales()
      }
    } catch (e) { alert('❌ Error al conectar') }
    setCreandoSucursal(false)
  }
 
  const actualizarSucursal = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch(`${API_URL}/sucursales/${sucursalEditando.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sucursalEditando)
      })
      if (res.ok) { setSucursalEditando(null); obtenerDatosIniciales() }
    } catch (e) { alert('❌ Error') }
  }
 
  const registrarEmpleado = async (e) => {
    e.preventDefault(); setCreandoUsuario(true)
    try {
      const res = await fetch(`${API_URL}/usuarios/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...nuevoEmpleado, sucursal_id: parseInt(nuevoEmpleado.sucursal_id) })
      })
      if (res.ok) {
        setNuevoEmpleado({ nombre_completo: '', username: '', password: '', rol: 'ventas', sucursal_id: sucursales.length > 0 ? sucursales[0].id : '' })
        obtenerDatosIniciales()
      } else alert('❌ Verifica que el usuario no exista.')
    } catch (e) { alert('❌ Error') }
    setCreandoUsuario(false)
  }
 
  const actualizarEmpleado = async (e) => {
    e.preventDefault()
    const datosAMandar = { ...empleadoEditando }
    if (!datosAMandar.password) delete datosAMandar.password
    try {
      const res = await fetch(`${API_URL}/usuarios/${empleadoEditando.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datosAMandar)
      })
      if (res.ok) { setEmpleadoEditando(null); obtenerDatosIniciales() }
    } catch (e) { alert('❌ Error') }
  }
 
  const intentarCerrarSesion = () => {
    setConfirmacion({ titulo: '¿Cerrar Sesión?', mensaje: '¿Estás segura de que deseas salir del Panel de Gerencia?', textoBoton: 'Sí, Salir', colorBoton: 'bg-red-600 hover:bg-red-700', accion: onCerrarSesion })
  }
  const intentarEliminarEmpleado = (emp) => {
    setConfirmacion({
      titulo: `¿Eliminar a ${emp.nombre_completo}?`,
      mensaje: 'Esta persona perderá acceso al sistema de inmediato. Esta acción no se puede deshacer.',
      textoBoton: 'Sí, Eliminar Personal', colorBoton: 'bg-red-600 hover:bg-red-700',
      accion: async () => {
        setConfirmacion(null)
        try {
          const res = await fetch(`${API_URL}/usuarios/${emp.id}`, { method: 'DELETE' })
          if (res.ok) obtenerDatosIniciales(); else alert('❌ Error al eliminar.')
        } catch (e) { alert('❌ Error de conexión') }
      }
    })
  }
  const intentarEliminarSucursal = (suc) => {
    setConfirmacion({
      titulo: `¿Eliminar la ${suc.nombre}?`,
      mensaje: 'Asegúrate de que no haya empleados ni pedidos activos asignados a esta sucursal. Esta acción es irreversible.',
      textoBoton: 'Sí, Eliminar Sucursal', colorBoton: 'bg-red-600 hover:bg-red-700',
      accion: async () => {
        setConfirmacion(null)
        try {
          const res = await fetch(`${API_URL}/sucursales/${suc.id}`, { method: 'DELETE' })
          if (res.ok) obtenerDatosIniciales(); else alert('❌ Error. Es probable que aún tenga empleados o pedidos asignados.')
        } catch (e) { alert('❌ Error de conexión') }
      }
    })
  }
  const intentarEnviarAprobacion = (e) => {
    e.preventDefault()
    const esAprobado = decision === 'Aprobado'
    setConfirmacion({
      titulo: esAprobado ? '¿Aprobar y Enviar a Taller?' : '¿Rechazar Pedido?',
      mensaje: esAprobado
        ? `¿Confirmas que la orden #${pedidoSeleccionado.id} está correcta y lista para producción?`
        : `¿Confirmas que deseas cancelar y rechazar la orden #${pedidoSeleccionado.id}?`,
      textoBoton: esAprobado ? 'Sí, Aprobar' : 'Sí, Rechazar',
      colorBoton: esAprobado ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700',
      accion: () => { setConfirmacion(null); ejecutarAprobacion() }
    })
  }
 
  const iconosRoles = { 'ventas': '📝 Ventas', 'produccion': '⚙️ Producción', 'logistica': '🚚 Logística', 'duena': '⚖️ Admin' }
 
  // ✅ CORRECCIÓN #11: Lógica de estadísticas extraída del JSX
  const estadisticas = useMemo(() => {
    const entregadosDelMes = pedidosHistorial.filter(p => {
      if (!p.fecha_creacion) return false
      const fecha = new Date(p.fecha_creacion.endsWith('Z') ? p.fecha_creacion : p.fecha_creacion + 'Z')
      const hoy = new Date()
      return p.estado === 'Entregado' && fecha.getMonth() === hoy.getMonth() && fecha.getFullYear() === hoy.getFullYear()
    })
    const totalEntregados = entregadosDelMes.length
    const totalTraspasosMes = entregadosDelMes.filter(p => p.tipo_orden === 'Traspaso').length
    const rechazadosDelMes = pedidosHistorial.filter(p => {
      if (!p.fecha_creacion) return false
      const fecha = new Date(p.fecha_creacion.endsWith('Z') ? p.fecha_creacion : p.fecha_creacion + 'Z')
      const hoy = new Date()
      return p.estado === 'Rechazado' && fecha.getMonth() === hoy.getMonth() && fecha.getFullYear() === hoy.getFullYear()
    }).length
    const totalFinalizados = totalEntregados + rechazadosDelMes
    const tasaCierreVentas = totalFinalizados > 0 ? ((totalEntregados / totalFinalizados) * 100).toFixed(0) : 0
 
    const ventasPorSucursal = entregadosDelMes.reduce((acc, p) => {
      const sucId = parseInt(p.sucursal_id); acc[sucId] = (acc[sucId] || 0) + 1; return acc
    }, {})
    const rankingVentas = Object.entries(ventasPorSucursal).sort(([, a], [, b]) => b - a).slice(0, 5)
    const maxVentasSucursal = rankingVentas.length > 0 ? rankingVentas[0][1] : 1
 
    const cortesPorTaller = entregadosDelMes.filter(p => p.requiere_produccion && p.sucursal_destino_id).reduce((acc, p) => {
      const tallerId = parseInt(p.sucursal_destino_id); acc[tallerId] = (acc[tallerId] || 0) + 1; return acc
    }, {})
    const rankingTrabajoTaller = Object.entries(cortesPorTaller).sort(([, a], [, b]) => b - a).slice(0, 5)
    const maxCortesTaller = rankingTrabajoTaller.length > 0 ? rankingTrabajoTaller[0][1] : 1
 
    const tiemposSucursal = entregadosDelMes.filter(p => p.fecha_aprobacion && p.estado === 'Entregado').reduce((acc, p) => {
      const sucId = parseInt(p.sucursal_id)
      if (!acc[sucId]) acc[sucId] = { sum: 0, count: 0 }
      const fin = new Date(p.fecha_actualizacion.endsWith('Z') ? p.fecha_actualizacion : p.fecha_actualizacion + 'Z')
      const ini = new Date(p.fecha_aprobacion.endsWith('Z') ? p.fecha_aprobacion : p.fecha_aprobacion + 'Z')
      const diffMs = fin - ini
      if (diffMs > 0) { acc[sucId].sum += diffMs; acc[sucId].count += 1 }
      return acc
    }, {})
 
    const eficienciaGrid = Object.entries(tiemposSucursal).map(([sucId, { sum, count }]) => {
      const avgTimeMs = sum / count
      const avgTimeHrs = Math.floor(avgTimeMs / (1000 * 60 * 60))
      return { sucId: parseInt(sucId), avgTimeHrs }
    }).sort((a, b) => a.avgTimeHrs - b.avgTimeHrs).slice(0, 10)
 
    const tendenciaDiaria = entregadosDelMes.reduce((acc, p) => {
      const dia = new Date(p.fecha_creacion).getDate(); acc[dia] = (acc[dia] || 0) + 1; return acc
    }, {})
 
    return { totalEntregados, totalTraspasosMes, tasaCierreVentas, rankingVentas, maxVentasSucursal, rankingTrabajoTaller, maxCortesTaller, eficienciaGrid, tendenciaDiaria }
  }, [pedidosHistorial])
 
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8 relative text-gray-950">
      <div className="max-w-7xl mx-auto">
 
        {/* Barra Superior Gerencial */}
        <div className="bg-slate-800 rounded-2xl shadow-xl p-5 sm:p-6 flex flex-col sm:flex-row gap-5 justify-between items-center mb-6">
          <div className="flex flex-col items-center sm:items-start w-full justify-center sm:justify-start">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-3xl sm:text-4xl">⚖️</span>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white text-center sm:text-left leading-tight"> Gerencia Central </h1>
            </div>
            <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2">
              <span className="bg-red-600/20 text-red-200 border border-red-500/30 text-xs font-bold px-3 py-1.5 rounded-full shadow-inner flex items-center gap-1.5 whitespace-nowrap"> Panel de Administración </span>
              <span className="bg-slate-700 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-full shadow-inner whitespace-nowrap"> Sistema Operativo Maestro </span>
            </div>
          </div>
 
          <div className="flex items-center gap-4 w-full sm:w-auto justify-between border-t border-slate-700 pt-5 sm:border-0 sm:pt-0 shrink-0">
            {permisoNotificaciones !== 'granted' && (
              <button
                onClick={solicitarPermisoNotificaciones}
                className="bg-yellow-500 hover:bg-yellow-400 text-yellow-950 font-bold p-3 rounded-full shadow-lg transition active:scale-95 animate-bounce"
                title="Activar Notificaciones de Gerencia"
              >🔕</button>
            )}
            {permisoNotificaciones === 'granted' && (
              <div className="bg-slate-700 p-3 rounded-full shadow-inner text-yellow-400" title="Alertas de Gerencia Activadas">🔔</div>
            )}
            <div className="text-right text-white hidden sm:block border-r border-slate-600 pr-4">
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Gerente Activa:</p>
              <p className="text-sm font-bold leading-tight">{usuarioActual.nombre_completo}</p>
            </div>
            <button onClick={intentarCerrarSesion} className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-5 rounded-xl transition active:scale-95 text-sm shadow-md whitespace-nowrap"> Cerrar Sesión </button>
          </div>
        </div>
 
        {/* ✅ CORRECCIÓN #10: Menú con scroll visible en móvil */}
        <div className="flex gap-2 sm:gap-4 mb-8 bg-white p-2 rounded-xl border border-gray-200 shadow-sm overflow-x-auto scrollbar-thin">
          {[
            { id: 'pedidos', label: '📋 Pedidos Activos' },
            { id: 'historial', label: '🗂️ Historial' },
            { id: 'estadisticas', label: '📊 Estadísticas' },
            { id: 'personal', label: '👥 Personal' },
            { id: 'sucursales', label: '🏗️ Sucursales' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setVistaActiva(tab.id)}
              className={`flex-shrink-0 px-4 sm:px-6 py-3 rounded-lg font-bold transition-all text-sm whitespace-nowrap min-h-[44px] ${vistaActiva === tab.id ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
 
        {/* =========================================
            VISTA 1: PEDIDOS ACTIVOS
            ========================================= */}
        {vistaActiva === 'pedidos' && (
          <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-6 md:p-8 border border-gray-100 animate-in fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-950">Control de Pedidos en Curso</h2>
              <div className="flex gap-3 w-full sm:w-auto">
                <button onClick={obtenerDatosIniciales} className="flex-1 sm:flex-none text-center text-sm bg-gray-100 text-gray-700 px-5 py-3 rounded-xl hover:bg-gray-200 transition font-semibold min-h-[44px]"> ↻ Actualizar </button>
                <button onClick={() => setMostrarTraspaso(true)} className="flex-1 sm:flex-none text-center text-sm bg-purple-600 text-white px-5 py-3 rounded-xl font-bold shadow-md min-h-[44px]"> 📦 Nuevo Traspaso </button>
              </div>
            </div>
            {cargando && pedidosActivos.length === 0 ? (
              <div className="text-center py-20 flex flex-col items-center gap-4">
                <div className="h-10 w-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin"></div>
              </div>
            ) : pedidosActivos.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <span className="text-5xl block mb-3">✅</span>
                <p className="text-gray-600 font-medium text-lg">No hay pedidos activos.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
                {pedidosActivos.map((pedido) => (
                  <div key={pedido.id} className={`bg-white rounded-2xl overflow-hidden shadow-sm transition-all duration-300 flex flex-col animate-in slide-in-from-bottom-2 ${pedido.estado === 'Pendiente' ? 'border-yellow-400 border-2 ring-4 ring-yellow-50' : (pedido.tipo_orden === 'Traspaso' ? 'border-purple-300 border-2 shadow-inner bg-purple-50' : 'border-slate-800 border-2 shadow-inner bg-slate-50/50')}`}>
                    {/* ✅ CORRECCIÓN #8: loading="lazy" en imágenes */}
                    <div onClick={() => setImagenAmpliando(pedido.url_foto_ticket)} className="h-48 bg-gray-100 overflow-hidden relative group cursor-pointer border-b border-gray-200 shrink-0">
                      <img src={pedido.url_foto_ticket} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Ticket" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition duration-300">
                        <span className="text-white text-sm bg-gray-900/80 px-4 py-2 rounded-full font-bold shadow-lg flex items-center gap-2 backdrop-blur-sm">🔍 Ver Ticket</span>
                      </div>
                    </div>
                    <div className="p-5 flex flex-col flex-grow">
                      <div className="flex justify-between items-start mb-4 gap-2">
                        <div>
                          {pedido.estado === 'Pendiente' ? (
                            <span className="text-sm font-black text-yellow-950 bg-yellow-100 px-2.5 py-1 rounded-md border-2 border-yellow-200 shrink-0">ID: #{pedido.id}</span>
                          ) : (
                            <span className="text-sm font-black text-gray-700 bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200 shrink-0">ID: #{pedido.id}</span>
                          )}
                          {pedido.numero_ticket && <p className="text-sm font-black text-gray-900 mt-1.5 leading-tight">Folio: {pedido.numero_ticket}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {pedido.tipo_orden === 'Traspaso' && <span className="text-[10px] font-bold px-2.5 py-1 rounded-full shadow-inner border bg-purple-100 text-purple-900 border-purple-200">📦 TRASPASO</span>}
                          <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-inner flex items-center gap-1 ${pedido.estado === 'Pendiente' ? 'bg-yellow-100 text-yellow-950 border-2 border-yellow-200' : pedido.estado === 'Aprobado' ? 'bg-blue-100 text-blue-800 border-2 border-blue-200' : pedido.estado === 'En_Produccion' ? 'bg-orange-500 text-white border-2 border-orange-600 animate-pulse' : 'bg-green-500 text-white border-2 border-green-600'}`}>
                            {pedido.estado === 'Pendiente' ? '⏳ Pendiente Gerencia' : pedido.estado === 'Aprobado' ? '⚙️ En Taller' : pedido.estado === 'En_Produccion' ? '🔥 Cortando' : pedido.estado === 'En_Logistica' ? '🚚 Listo' : pedido.estado}
                          </span>
                        </div>
                      </div>
                      <div className="mb-4">
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-0.5">Vendido en:</p>
                        <h4 className="font-bold text-gray-900 text-base leading-tight">{getNombreSucursal(pedido.sucursal_id)}</h4>
                        <p className="text-[11px] text-gray-500 font-medium mt-1">Ingreso: 🕒 {formatearFechaYHora(pedido.fecha_creacion)}</p>
                        {pedido.sucursal_destino_id && pedido.estado !== 'Pendiente' && (
                          <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg p-2.5 flex items-center gap-2.5">
                            <span className="text-lg">🏭</span>
                            <div>
                              <p className="text-[9px] text-blue-500 font-black uppercase tracking-widest">Asignado a taller:</p>
                              <p className="text-sm font-bold text-blue-900 leading-tight">{getNombreSucursal(pedido.sucursal_destino_id)}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className={`p-4 rounded-xl flex-grow mb-5 overflow-hidden ${pedido.estado === 'Pendiente' ? 'bg-yellow-100 border-2 border-yellow-200' : 'bg-gray-50 border border-gray-100'}`}>
                        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap break-words line-clamp-3">{pedido.notas}</p>
                      </div>
                      <div className="mt-auto pt-4 border-t border-gray-100">
                        {pedido.estado === 'Pendiente' ? (
                          <button
                            onClick={() => {
                              setPedidoSeleccionado(pedido); setDecision('Aprobado')
                              const sucursalesConTaller = sucursales.filter(s => s.tiene_produccion)
                              setSucursalDestino(sucursalesConTaller.length > 0 ? sucursalesConTaller[0].id : '')
                            }}
                            className="w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-950 font-extrabold py-3.5 rounded-xl transition shadow-md text-sm flex items-center justify-center gap-2 active:scale-95 border-2 border-yellow-300 min-h-[44px]"
                          >
                            <span>🔎</span> Revisar y Autorizar
                          </button>
                        ) : (
                          <div className="flex flex-col gap-3">
                            {(pedido.estado === 'Aprobado' || pedido.estado === 'En_Produccion') && (
                              <div className="flex justify-between items-center bg-slate-800 text-white px-4 py-2.5 rounded-xl shadow-inner">
                                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Tiempo en Taller:</span>
                                <span className={`font-mono font-bold tracking-widest text-lg ${pedido.estado === 'En_Produccion' ? 'text-orange-400' : 'text-blue-300'}`}>{obtenerTiempoTranscurrido(pedido.fecha_aprobacion)}</span>
                              </div>
                            )}
                            <button onClick={() => setPedidoDetalle(pedido)} className="w-full bg-white hover:bg-slate-50 text-slate-700 font-bold py-3 rounded-xl transition text-sm border-2 border-slate-200 shadow-sm min-h-[44px]"> 📄 Ver Detalles Completos </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
 
        {/* =========================================
            VISTA 2: HISTORIAL
            ========================================= */}
        {vistaActiva === 'historial' && (
          <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-6 md:p-8 border border-gray-100 animate-in fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-950">Historial de Pedidos Finalizados</h2>
              <button onClick={obtenerDatosIniciales} className="w-full sm:w-auto text-center text-sm bg-gray-100 text-gray-700 px-5 py-3 rounded-xl hover:bg-gray-200 transition font-semibold min-h-[44px]">↻ Actualizar Historial</button>
            </div>
            {Object.keys(historialAgrupadoPorFecha).length === 0 ? (
              <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-gray-600 font-medium text-lg">El historial está vacío.</p>
              </div>
            ) : (
              Object.keys(historialAgrupadoPorFecha).map((fecha) => (
                <div key={fecha} className="mb-10 last:mb-0">
                  <h3 className="text-lg font-bold text-blue-800 border-b-2 border-blue-100 pb-2 mb-4">📅 {fecha}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {historialAgrupadoPorFecha[fecha].map((pedido) => (
                      <div key={pedido.id} className="bg-slate-50/50 border-2 border-slate-800 rounded-2xl overflow-hidden shadow-inner hover:shadow-md transition-all flex flex-col">
                        {/* ✅ CORRECCIÓN #8: loading="lazy" en imágenes de historial */}
                        <div onClick={() => setImagenAmpliando(pedido.url_foto_ticket)} className="h-32 bg-gray-200 overflow-hidden relative group cursor-pointer border-b-2 border-slate-800 shrink-0">
                          <img src={pedido.url_foto_ticket} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Ticket" />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                            <span className="text-white text-xs bg-gray-900/80 px-3 py-1 rounded-full font-bold flex items-center gap-2">🔍 Ver Foto</span>
                          </div>
                        </div>
                        <div className="p-4 flex flex-col flex-grow">
                          <div className="flex justify-between items-start mb-2 gap-2">
                            <div>
                              <span className="text-sm font-black text-gray-700 bg-gray-100 px-2.5 py-1 rounded-md border border-gray-300 shrink-0">ID: #{pedido.id}</span>
                              {pedido.numero_ticket && <p className="text-[11px] font-black text-gray-800 mt-1.5 leading-tight">Folio: {pedido.numero_ticket}</p>}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {pedido.tipo_orden === 'Traspaso' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shadow-inner border bg-purple-100 text-purple-800 border-purple-300">📦 TRASPASO</span>}
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-inner border-2 ${pedido.estado === 'Entregado' ? 'bg-green-100 text-green-800 border-green-300' : 'bg-red-100 text-red-800 border-red-300'}`}>
                                {pedido.estado === 'Entregado' ? '✅ Entregado' : '❌ Rechazado'}
                              </span>
                            </div>
                          </div>
                          <div className="mb-3 border-b border-gray-200 pb-2">
                            <h4 className="font-bold text-gray-800 text-sm leading-tight mb-1">{getNombreSucursal(pedido.sucursal_id)}</h4>
                            <p className="text-[10px] text-gray-500 font-medium flex items-center gap-1">🕒 {formatearFechaYHora(pedido.fecha_creacion)}</p>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-gray-200 flex-grow shadow-sm">
                            <p className="text-gray-600 text-xs leading-relaxed whitespace-pre-wrap break-words">{pedido.notas}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
 
        {/* =========================================
            VISTA 3: ESTADÍSTICAS
            ========================================= */}
        {vistaActiva === 'estadisticas' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              <div className="bg-slate-50/50 border-2 border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-inner">
                <div>
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-6 border-2 border-blue-200 shadow-sm"><span className="text-2xl">✅</span></div>
                  <p className="text-gray-600 font-bold uppercase tracking-widest text-[10px] text-center mb-1">Pedidos Completados (Mes)</p>
                  <h3 className="text-slate-900 text-center font-black text-5xl tracking-tight">{estadisticas.totalEntregados}</h3>
                </div>
                <p className="text-[10px] text-gray-500 font-medium text-center border-t border-gray-100 pt-3 mt-5">Actualizado a este mes</p>
              </div>
              <div className="bg-slate-50/50 border-2 border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-inner">
                <div>
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-purple-100 mb-6 border-2 border-purple-200 shadow-sm"><span className="text-2xl">📦</span></div>
                  <p className="text-gray-600 font-bold uppercase tracking-widest text-[10px] text-center mb-1">Movimiento de Inventario</p>
                  <h3 className="text-purple-950 text-center font-black text-5xl tracking-tight">{estadisticas.totalTraspasosMes} <span className="text-2xl font-black text-gray-500">Traspasos</span></h3>
                </div>
                <p className="text-[10px] text-gray-500 font-medium text-center border-t border-gray-100 pt-3 mt-5">Carga operativa interna</p>
              </div>
              <div className="bg-slate-50/50 border-2 border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-inner">
                <div>
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-orange-100 mb-6 border-2 border-orange-200 shadow-sm"><span className="text-2xl">🏆</span></div>
                  <p className="text-gray-600 font-bold uppercase tracking-widest text-[10px] text-center mb-1">Tasa de Cierre de Ventas</p>
                  <h3 className="text-orange-950 text-center font-black text-5xl tracking-tight">{estadisticas.tasaCierreVentas}%</h3>
                </div>
                <p className="text-[10px] text-gray-500 font-medium text-center border-t border-gray-100 pt-3 mt-5">Total de pedidos cerrados con éxito</p>
              </div>
            </div>
 
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white border-2 border-slate-800 rounded-3xl p-6 shadow-inner">
                <h4 className="text-base font-black text-slate-900 uppercase tracking-wider mb-6 pb-3 border-b border-gray-100">🏆 Ranking de Ventas por Sucursal (Unidades)</h4>
                <div className="space-y-4">
                  {estadisticas.rankingVentas.map(([sucId, total], index) => {
                    const sucObj = sucursales.find(s => s.id === parseInt(sucId))
                    const porcentaje = (total / estadisticas.maxVentasSucursal) * 100
                    return (
                      <div key={sucId} className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center gap-4">
                        <div className="w-full">
                          <p className="text-slate-900 text-sm font-bold truncate">{(index + 1)}. {sucObj ? sucObj.nombre : 'Cargando...'}</p>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 relative overflow-hidden">
                            <div className={`absolute inset-0 bg-blue-600 rounded-full ${index === 0 ? 'animate-pulse bg-emerald-600' : ''}`} style={{ width: `${porcentaje}%` }}></div>
                          </div>
                        </div>
                        <span className={`text-xl font-black shrink-0 ${index === 0 ? 'text-emerald-700' : 'text-slate-700'}`}>{total}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="bg-white border-2 border-slate-800 rounded-3xl p-6 shadow-inner">
                <h4 className="text-base font-black text-slate-900 uppercase tracking-wider mb-6 pb-3 border-b border-gray-100">🏭 Carga de Trabajo por Taller de Cortes</h4>
                <div className="space-y-4">
                  {estadisticas.rankingTrabajoTaller.map(([tallerId, total], index) => {
                    const sucObj = sucursales.find(s => s.id === parseInt(tallerId))
                    const porcentaje = (total / estadisticas.maxCortesTaller) * 100
                    return (
                      <div key={tallerId} className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center gap-4">
                        <div className="w-full">
                          <p className="text-slate-900 text-sm font-bold truncate">⚙️ {sucObj ? sucObj.nombre : 'Cargando...'}</p>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 relative overflow-hidden">
                            <div className={`absolute inset-0 bg-orange-500 rounded-full ${index === 0 ? 'animate-pulse bg-red-600' : ''}`} style={{ width: `${porcentaje}%` }}></div>
                          </div>
                        </div>
                        <span className={`text-xl font-black shrink-0 ${index === 0 ? 'text-red-700' : 'text-orange-700'}`}>{total}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
 
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-slate-800 border-2 border-slate-950 rounded-3xl p-6 shadow-xl">
                <h4 className="text-base font-black text-white uppercase tracking-widest mb-6 pb-3 border-b border-slate-700 flex items-center gap-2"><span>🔍</span> Inteligencia de Negocio: Eficiencia en Taller</h4>
                <p className="text-xs text-slate-300 font-medium mb-5 whitespace-pre-wrap">Promedio de horas desde que se aprueba el pedido hasta que se entrega.{'\n(Verde: Eficiente / Rojo: Retraso)'}</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {estadisticas.eficienciaGrid.map(({ sucId, avgTimeHrs }) => {
                    const sucObj = sucursales.find(s => s.id === sucId)
                    return (
                      <div key={sucId} className={`p-4 rounded-xl border-2 text-center flex flex-col justify-center items-center shadow-inner ${avgTimeHrs <= 4 ? 'bg-emerald-100 border-emerald-300' : avgTimeHrs <= 12 ? 'bg-yellow-100 border-yellow-300' : 'bg-red-100 border-red-300'}`}>
                        <p className={`text-[11px] font-bold ${avgTimeHrs <= 4 ? 'text-emerald-900' : avgTimeHrs <= 12 ? 'text-yellow-950' : 'text-red-950'} truncate`}>{sucObj ? sucObj.nombre : 'Cargando...'}</p>
                        <p className={`text-3xl font-black ${avgTimeHrs <= 4 ? 'text-emerald-700' : avgTimeHrs <= 12 ? 'text-yellow-800' : 'text-red-700'}`}>{avgTimeHrs}<span className="text-sm">h</span></p>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="bg-white border-2 border-slate-800 rounded-3xl p-6 shadow-inner">
                <h4 className="text-base font-black text-slate-900 uppercase tracking-wider mb-6 pb-3 border-b border-gray-100">Tendencia Diaria de Entregas del Mes</h4>
                <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1 text-sm text-gray-600">
                  {Object.entries(estadisticas.tendenciaDiaria).sort(([a], [b]) => b - a).map(([dia, total]) => (
                    <p key={dia} className="p-2.5 border border-gray-100 bg-gray-50 rounded-lg flex justify-between font-medium">
                      <span>Día {dia} del mes:</span> <b>{total} material entregado(s)</b>
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
 
        {/* =========================================
            VISTAS 4 y 5: PERSONAL Y SUCURSALES
            ========================================= */}
        {vistaActiva === 'personal' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-8 border border-gray-100">
              <h2 className="text-xl font-bold text-gray-950 mb-6 border-b pb-4">Personal Activo</h2>
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {empleados.map(emp => (
                  <div key={emp.id} className="p-4 border border-gray-200 rounded-xl bg-gray-50 hover:bg-white hover:shadow-md transition-all flex justify-between items-center gap-2">
                    <div>
                      <p className="font-bold text-gray-950">{emp.nombre_completo}</p>
                      <p className="text-sm text-gray-500">@{emp.username} • {iconosRoles[emp.rol]}</p>
                      <p className="text-xs font-semibold text-blue-600 mt-1">{getNombreSucursal(emp.sucursal_id)}</p>
                    </div>
                    {/* ✅ CORRECCIÓN #9: Botones con tamaño mínimo 44px para touch */}
                    <div className="flex flex-col gap-2 shrink-0">
                      <button onClick={() => setEmpleadoEditando(emp)} className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition" title="Editar">✏️</button>
                      <button onClick={() => intentarEliminarEmpleado(emp)} className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition" title="Eliminar">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-8 border border-gray-100 h-fit">
              <h2 className="text-xl font-bold text-gray-950 mb-6 border-b pb-4">Alta de Personal</h2>
              <form onSubmit={registrarEmpleado} className="space-y-5">
                {/* ✅ CORRECCIÓN #7: autoComplete correcto en cada input */}
                <input type="text" value={nuevoEmpleado.nombre_completo} onChange={(e) => setNuevoEmpleado({ ...nuevoEmpleado, nombre_completo: e.target.value })} autoComplete="name" className="w-full border p-3 rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-blue-100" placeholder="Nombre Completo" required />
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" value={nuevoEmpleado.username} onChange={(e) => setNuevoEmpleado({ ...nuevoEmpleado, username: e.target.value })} autoComplete="username" inputMode="text" className="w-full border p-3 rounded-xl bg-gray-50 outline-none" placeholder="Usuario" required />
                  <input type="password" value={nuevoEmpleado.password} onChange={(e) => setNuevoEmpleado({ ...nuevoEmpleado, password: e.target.value })} autoComplete="new-password" className="w-full border p-3 rounded-xl bg-gray-50 outline-none" placeholder="Contraseña" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <select value={nuevoEmpleado.sucursal_id} onChange={(e) => setNuevoEmpleado({ ...nuevoEmpleado, sucursal_id: e.target.value })} className="w-full border p-3 rounded-xl bg-white outline-none cursor-pointer" required>
                    <option value="" disabled>Sucursal...</option>
                    {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                  <select value={nuevoEmpleado.rol} onChange={(e) => setNuevoEmpleado({ ...nuevoEmpleado, rol: e.target.value })} className="w-full border p-3 rounded-xl bg-white outline-none cursor-pointer">
                    <option value="ventas">📝 Ventas</option>
                    <option value="produccion">⚙️ Producción</option>
                    <option value="logistica">🚚 Logística</option>
                    <option value="duena">⚖️ Gerencia</option>
                  </select>
                </div>
                <button type="submit" disabled={creandoUsuario} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow min-h-[44px]">➕ Registrar</button>
              </form>
            </div>
          </div>
        )}
 
        {vistaActiva === 'sucursales' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-8 border border-gray-100">
              <h2 className="text-xl font-bold text-gray-950 mb-6 border-b pb-4">Sucursales Activas</h2>
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {sucursales.map(suc => (
                  <div key={suc.id} className="p-4 border border-gray-200 rounded-xl bg-gray-50 hover:bg-white hover:shadow-md transition-all flex justify-between items-center gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5 mb-0.5">
                        <p className="font-bold text-gray-950 text-lg">🏗️ {suc.nombre}</p>
                        {suc.tiene_produccion && (
                          <span className="inline-flex items-center gap-1 bg-slate-800 text-white text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-md shadow-sm whitespace-nowrap">⚙️ Con Producción</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">📍 {suc.direccion || 'Sin dirección'} | 📞 {suc.telefono || 'Sin teléfono'}</p>
                    </div>
                    {/* ✅ CORRECCIÓN #9: Botones touch-friendly */}
                    <div className="flex flex-col gap-2 shrink-0">
                      <button onClick={() => setSucursalEditando(suc)} className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition" title="Editar">✏️</button>
                      <button onClick={() => intentarEliminarSucursal(suc)} className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition" title="Eliminar">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
 
            <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-8 border border-gray-100 h-fit">
              <h2 className="text-xl font-bold text-gray-950 mb-6 border-b pb-4">Alta de Sucursal</h2>
              <form onSubmit={registrarSucursal} className="space-y-5">
                <input type="text" value={nuevaSucursal.nombre} onChange={(e) => setNuevaSucursal({ ...nuevaSucursal, nombre: e.target.value })} autoComplete="organization" className="w-full border p-3.5 rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-blue-100" placeholder="Nombre Comercial" required />
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" value={nuevaSucursal.direccion} onChange={(e) => setNuevaSucursal({ ...nuevaSucursal, direccion: e.target.value })} autoComplete="street-address" className="w-full border p-3.5 rounded-xl bg-gray-50 outline-none" placeholder="Dirección (Opcional)" />
                  {/* ✅ CORRECCIÓN #7: inputMode="tel" para teclado numérico en móvil */}
                  <input type="text" value={nuevaSucursal.telefono} onChange={(e) => setNuevaSucursal({ ...nuevaSucursal, telefono: e.target.value })} inputMode="tel" autoComplete="tel" className="w-full border p-3.5 rounded-xl bg-gray-50 outline-none" placeholder="Teléfono (Opcional)" />
                </div>
                <label className="flex items-center justify-between gap-4 p-3 bg-white border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">⚙️ Tiene Taller de Producción</p>
                    <p className="text-xs text-gray-500">Activa esto si la sucursal cuenta con cortadoras</p>
                  </div>
                  <div className="relative shrink-0">
                    <input type="checkbox" checked={nuevaSucursal.tiene_produccion} onChange={(e) => setNuevaSucursal({ ...nuevaSucursal, tiene_produccion: e.target.checked })} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </div>
                </label>
                <button type="submit" disabled={creandoSucursal} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow mt-2 transition min-h-[44px]">🏗️ Crear Sucursal</button>
              </form>
            </div>
          </div>
        )}
      </div>
 
      {/* ==============================================
          MODALES
          ============================================== */}
 
      {/* ✅ CORRECCIÓN #3: overscrollBehavior para evitar problemas con teclado en móvil */}
      {mostrarTraspaso && (
        <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-purple-800 p-5 flex justify-between items-center text-white shrink-0">
              <h3 className="font-extrabold text-xl sm:text-2xl flex items-center gap-2">📦 Movimiento de Inventario</h3>
              <button onClick={() => setMostrarTraspaso(false)} className="text-purple-300 hover:text-white text-3xl font-bold min-h-[44px] min-w-[44px] flex items-center justify-center">&times;</button>
            </div>
            <form onSubmit={generarTraspaso} className="p-5 sm:p-8 space-y-6 overflow-y-auto overscroll-contain">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2 ml-1">Vale de salida o evidencia</label>
                <div className="relative group border-2 border-dashed border-gray-200 rounded-2xl hover:border-purple-400 hover:bg-purple-50 transition p-1">
                  <input type="file" accept="image/*" onChange={handleFileTraspaso} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" required />
                  <div className="p-4 sm:p-6 text-center flex flex-col items-center justify-center gap-3">
                    <span className="text-4xl group-hover:scale-110 transition-transform">📸</span>
                    <p className="text-gray-900 font-semibold text-sm break-all">{nombreArchivoTraspaso}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 ml-1">📤 De (Origen):</label>
                  <select value={origenTraspaso} onChange={(e) => setOrigenTraspaso(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 bg-white text-gray-950 outline-none focus:ring-2 focus:ring-purple-300" required>
                    <option value="" disabled>Selecciona origen...</option>
                    {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 ml-1">📥 Para (Destino):</label>
                  <select value={destinoTraspaso} onChange={(e) => setDestinoTraspaso(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 bg-white text-gray-950 outline-none focus:ring-2 focus:ring-purple-300" required>
                    <option value="" disabled>Selecciona destino...</option>
                    {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2 ml-1">📝 ¿Qué material se mueve?</label>
                <textarea value={notasTraspaso} onChange={(e) => setNotasTraspaso(e.target.value)} className="w-full border border-gray-200 rounded-2xl p-4 text-gray-950 text-sm bg-white placeholder:text-gray-400 focus:ring-2 focus:ring-purple-200 transition resize-none h-20 outline-none" placeholder="Ej. 10 Bultos de cemento, 5 armex..." required></textarea>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setMostrarTraspaso(false)} className="w-full sm:w-auto px-6 py-3.5 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold text-gray-700 min-h-[44px]">Cancelar</button>
                <button type="submit" disabled={enviandoTraspaso} className="w-full sm:w-auto px-8 py-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow transition min-h-[44px]">{enviandoTraspaso ? 'Generando...' : '🚚 Enviar a Logística'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
 
      {pedidoSeleccionado && (
        <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-yellow-500 p-5 sm:p-6 flex justify-between items-center text-yellow-950 border-b border-yellow-600 shrink-0">
              <h3 className="font-extrabold text-xl sm:text-2xl">🔎 Autorizar Orden #{pedidoSeleccionado.id}</h3>
              <button onClick={() => setPedidoSeleccionado(null)} className="text-yellow-800 hover:text-yellow-950 text-3xl font-bold min-h-[44px] min-w-[44px] flex items-center justify-center">&times;</button>
            </div>
            <form onSubmit={intentarEnviarAprobacion} className="p-5 sm:p-8 space-y-6 overflow-y-auto overscroll-contain">
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl mb-4">
                <div className="flex justify-between items-center mb-2 border-b border-gray-200 pb-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Folio: {pedidoSeleccionado.numero_ticket}</p>
                  <span className="text-xs font-semibold text-gray-500">🕒 {formatearFechaYHora(pedidoSeleccionado.fecha_creacion)}</span>
                </div>
                <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap break-words pt-1">{pedidoSeleccionado.notas}</p>
                <button type="button" onClick={() => setImagenAmpliando(pedidoSeleccionado.url_foto_ticket)} className="mt-3 text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-1">🔍 Ver foto del ticket original</button>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2 ml-1">¿Qué procedencia tiene esta orden?</label>
                <select value={decision} onChange={(e) => setDecision(e.target.value)} className="w-full border border-gray-200 rounded-xl p-4 bg-white text-xl font-bold outline-none focus:ring-4 focus:ring-yellow-300">
                  <option value="Aprobado">✅ Aprobar y Mandar a Cortar</option>
                  <option value="Rechazado">❌ Rechazar / Cancelar</option>
                </select>
              </div>
              {decision === 'Aprobado' && (
                <div className="space-y-6 pt-6 border-t border-gray-100">
                  <div>
                    <label className="block text-sm font-semibold mb-2 ml-1">¿En qué sucursal se corta el material?</label>
                    <select value={sucursalDestino} onChange={(e) => setSucursalDestino(e.target.value)} className="w-full border border-gray-200 rounded-xl p-4 bg-white text-xl font-bold focus:ring-4 focus:ring-yellow-300" required>
                      {sucursales.filter(s => s.tiene_produccion).map(s => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </select>
                    {sucursales.filter(s => s.tiene_produccion).length === 0 && (
                      <p className="text-xs text-red-600 mt-2 font-bold">⚠️ No tienes sucursales con Taller registrado. Ve a la pestaña "Sucursales" y actívale la opción a alguna.</p>
                    )}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 mt-8">
                <button type="button" onClick={() => setPedidoSeleccionado(null)} className="w-full sm:w-auto px-6 py-3.5 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold min-h-[44px]">Cancelar</button>
                <button type="submit" disabled={procesando} className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 text-white rounded-xl font-bold shadow hover:bg-blue-700 transition min-h-[44px]">💾 Guardar Decisión</button>
              </div>
            </form>
          </div>
        </div>
      )}
 
      {pedidoDetalle && (
        <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-slate-800 p-5 sm:p-6 flex justify-between items-center text-white shrink-0">
              <div>
                <h3 className="font-extrabold text-xl sm:text-2xl flex items-center gap-2">📄 Detalles de la Orden #{pedidoDetalle.id}</h3>
                {pedidoDetalle.numero_ticket && <p className="text-slate-300 text-sm mt-1">Folio: {pedidoDetalle.numero_ticket}</p>}
              </div>
              <button onClick={() => setPedidoDetalle(null)} className="text-slate-400 hover:text-white text-3xl font-bold min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-slate-700 transition">&times;</button>
            </div>
            <div className="p-5 sm:p-8 space-y-6 overflow-y-auto bg-gray-50 flex-grow overscroll-contain">
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Estatus de la Operación</h4>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{pedidoDetalle.estado === 'Aprobado' ? '⏳' : pedidoDetalle.estado === 'En_Produccion' ? '🔥' : '🚚'}</span>
                    <div>
                      <p className="text-xl font-black text-gray-900">{pedidoDetalle.estado === 'Aprobado' ? 'En Fila de Taller' : pedidoDetalle.estado === 'En_Produccion' ? 'Cortando Material' : 'Listo en Logística'}</p>
                      {pedidoDetalle.sucursal_destino_id && (<p className="text-sm font-semibold text-blue-700">📍 En: {getNombreSucursal(pedidoDetalle.sucursal_destino_id)}</p>)}
                    </div>
                  </div>
                  {(pedidoDetalle.estado === 'Aprobado' || pedidoDetalle.estado === 'En_Produccion') && (
                    <div className="bg-gray-900 px-5 py-3 rounded-xl text-center shadow-inner min-w-[140px]">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Tiempo de Taller</p>
                      <p className={`font-mono text-2xl font-bold ${pedidoDetalle.estado === 'En_Produccion' ? 'text-orange-400 animate-pulse' : 'text-blue-300'}`}>{obtenerTiempoTranscurrido(pedidoDetalle.fecha_aprobacion)}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Material a Surtir / Cortar</h4>
                  <button onClick={() => setImagenAmpliando(pedidoDetalle.url_foto_ticket)} className="text-blue-600 hover:text-blue-800 text-sm font-bold flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-lg transition min-h-[44px]">🔍 Ver Foto del Ticket</button>
                </div>
                <div className="bg-yellow-50/50 p-4 rounded-xl border border-yellow-100">
                  <textarea readOnly value={pedidoDetalle.notas} className="w-full bg-transparent text-gray-800 text-base font-medium leading-relaxed resize-none outline-none h-48 whitespace-pre-wrap"></textarea>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 font-medium">Pedido generado originalmente por la sucursal: <b>{getNombreSucursal(pedidoDetalle.sucursal_id)}</b></p>
                <p className="text-xs text-gray-400 mt-1">Fecha de ingreso: {formatearFechaYHora(pedidoDetalle.fecha_creacion)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
 
      {empleadoEditando && (
        <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-blue-800 p-5 flex justify-between items-center text-white">
              <h3 className="font-bold text-xl">Editar Empleado</h3>
              <button onClick={() => setEmpleadoEditando(null)} className="text-xl min-h-[44px] min-w-[44px] flex items-center justify-center">&times;</button>
            </div>
            <form onSubmit={actualizarEmpleado} className="p-6 space-y-4">
              <input type="text" value={empleadoEditando.nombre_completo} onChange={e => setEmpleadoEditando({ ...empleadoEditando, nombre_completo: e.target.value })} autoComplete="name" className="w-full border p-3 rounded-xl" placeholder="Nombre" required />
              <input type="text" value={empleadoEditando.username} onChange={e => setEmpleadoEditando({ ...empleadoEditando, username: e.target.value })} autoComplete="username" className="w-full border p-3 rounded-xl" placeholder="Usuario" required />
              <input type="password" onChange={e => setEmpleadoEditando({ ...empleadoEditando, password: e.target.value })} autoComplete="new-password" className="w-full border p-3 rounded-xl" placeholder="Nueva Contraseña (Opcional)" />
              <div className="grid grid-cols-2 gap-3">
                <select value={empleadoEditando.sucursal_id} onChange={e => setEmpleadoEditando({ ...empleadoEditando, sucursal_id: e.target.value })} className="w-full border p-3 rounded-xl bg-white">
                  {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
                <select value={empleadoEditando.rol} onChange={e => setEmpleadoEditando({ ...empleadoEditando, rol: e.target.value })} className="w-full border p-3 rounded-xl bg-white">
                  <option value="ventas">Ventas</option>
                  <option value="produccion">Producción</option>
                  <option value="logistica">Logística</option>
                  <option value="duena">Gerencia</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setEmpleadoEditando(null)} className="flex-1 bg-gray-100 py-3 rounded-xl font-bold text-gray-700 hover:bg-gray-200 min-h-[44px]">Cancelar</button>
                <button type="submit" className="flex-1 bg-blue-600 py-3 rounded-xl font-bold text-white shadow hover:bg-blue-700 min-h-[44px]">💾 Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
 
      {sucursalEditando && (
        <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-blue-800 p-5 flex justify-between items-center text-white">
              <h3 className="font-bold text-xl">Editar Sucursal</h3>
              <button onClick={() => setSucursalEditando(null)} className="text-xl min-h-[44px] min-w-[44px] flex items-center justify-center">&times;</button>
            </div>
            <form onSubmit={actualizarSucursal} className="p-6 space-y-4">
              <input type="text" value={sucursalEditando.nombre} onChange={e => setSucursalEditando({ ...sucursalEditando, nombre: e.target.value })} autoComplete="organization" className="w-full border p-3 rounded-xl outline-none" placeholder="Nombre Comercial" required />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" value={sucursalEditando.direccion || ''} onChange={e => setSucursalEditando({ ...sucursalEditando, direccion: e.target.value })} autoComplete="street-address" className="w-full border p-3 rounded-xl outline-none" placeholder="Dirección" />
                {/* ✅ CORRECCIÓN #7: inputMode="tel" para teclado numérico en móvil */}
                <input type="text" value={sucursalEditando.telefono || ''} onChange={e => setSucursalEditando({ ...sucursalEditando, telefono: e.target.value })} inputMode="tel" autoComplete="tel" className="w-full border p-3 rounded-xl outline-none" placeholder="Teléfono" />
              </div>
              <label className="flex items-center justify-between gap-4 p-3 bg-white border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition">
                <div>
                  <p className="font-bold text-gray-900 text-sm">⚙️ Tiene Taller</p>
                  <p className="text-[10px] text-gray-500">¿Cuenta con cortadoras?</p>
                </div>
                <div className="relative shrink-0">
                  <input type="checkbox" checked={sucursalEditando.tiene_produccion} onChange={(e) => setSucursalEditando({ ...sucursalEditando, tiene_produccion: e.target.checked })} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </div>
              </label>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setSucursalEditando(null)} className="flex-1 bg-gray-100 py-3 rounded-xl font-bold text-gray-700 hover:bg-gray-200 min-h-[44px]">Cancelar</button>
                <button type="submit" className="flex-1 bg-blue-600 py-3 rounded-xl font-bold text-white shadow hover:bg-blue-700 min-h-[44px]">💾 Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
 
      {imagenAmpliando && (
        <div className="fixed inset-0 bg-gray-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in zoom-in duration-200">
          <button onClick={() => setImagenAmpliando(null)} className="absolute top-4 right-4 sm:top-8 sm:right-8 text-white bg-gray-800 hover:bg-gray-700 rounded-full w-12 h-12 flex items-center justify-center text-3xl font-bold transition shadow-xl active:scale-95 min-h-[44px] min-w-[44px]">
            &times;
          </button>
          <img src={imagenAmpliando} alt="Ticket Ampliado" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl border border-gray-800" />
        </div>
      )}
 
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
 
export default PanelDuena