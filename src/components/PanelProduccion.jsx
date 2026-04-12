import { useState, useEffect, useRef } from 'react' // NUEVO: Importamos useRef

function PanelProduccion({ usuarioActual, onCerrarSesion }) {
  const [pedidos, setPedidos] = useState([])
  const [sucursales, setSucursales] = useState([]) 
  const [cargando, setCargando] = useState(false)
  const [horaActual, setHoraActual] = useState(new Date()) 
  
  const [imagenAmpliando, setImagenAmpliando] = useState(null)
  const [pedidoDetalle, setPedidoDetalle] = useState(null)
  const [confirmacion, setConfirmacion] = useState(null)

  // ==============================================
  // ESTADOS Y REFERENCIAS PARA NOTIFICACIONES
  // ==============================================
  const [permisoNotificaciones, setPermisoNotificaciones] = useState(Notification.permission)
  const pedidosYaNotificados = useRef(new Set()) // Memoria para no repetir alertas del mismo ticket

  const solicitarPermisoNotificaciones = async () => {
    if (!("Notification" in window)) {
      alert("Tu navegador no soporta notificaciones.")
      return
    }
    const permiso = await Notification.requestPermission()
    setPermisoNotificaciones(permiso)
    if (permiso === "granted") {
      new Notification("¡Alertas Activadas! ✅", { 
        body: "Te avisaremos cuando llegue material o se retrase un corte." 
      })
    }
  }

  const obtenerDatos = async () => {
    setCargando(true)
    try {
      const [resPedidos, resSucursales] = await Promise.all([
        fetch('https://aceros-backend-production.up.railway.app/pedidos/'),
        fetch('https://aceros-backend-production.up.railway.app/sucursales/') 
      ])
      
      if (resPedidos.ok) setPedidos(await resPedidos.json())
      if (resSucursales.ok) setSucursales(await resSucursales.json()) 
    } catch (error) {
      console.error("Error al cargar datos:", error)
    }
    setCargando(false)
  }

  // EL RELOJ (Actualiza cada minuto)
  useEffect(() => {
    obtenerDatos()
    const intervalo = setInterval(() => {
      setHoraActual(new Date())
      obtenerDatos() // Aprovechamos el reloj para buscar pedidos nuevos cada minuto automáticamente
    }, 60000)
    return () => clearInterval(intervalo)
  }, [])

  const getNombreSucursal = (id) => {
    const suc = sucursales.find(s => s.id === parseInt(id))
    return suc ? suc.nombre : `Sucursal ${id}`
  }

  const cambiarEstado = async (id, nuevoEstado) => {
    try {
      const respuesta = await fetch(`https://aceros-backend-production.up.railway.app/pedidos/${id}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado })
      })
      if (respuesta.ok) {
        obtenerDatos()
        if (pedidoDetalle && pedidoDetalle.id === id) setPedidoDetalle(null) 
      } else alert('Error al actualizar el estado ❌')
    } catch (error) { alert('Error de conexión 🔌') }
  }

  const intentarCerrarSesion = () => {
    setConfirmacion({
      titulo: '¿Cerrar Sesión?',
      mensaje: '¿Estás seguro de que deseas salir del Taller de Producción?',
      textoBoton: 'Sí, Salir',
      colorBoton: 'bg-red-600 hover:bg-red-700',
      accion: onCerrarSesion
    });
  }

  const intentarCompletarCorte = (id) => {
    setConfirmacion({
      titulo: '¿Material Cortado?',
      mensaje: '¿Confirmas que todo el material de este ticket ya fue procesado y está listo para que logística se lo lleve?',
      textoBoton: 'Sí, Listo para Logística',
      colorBoton: 'bg-emerald-600 hover:bg-emerald-700',
      accion: () => {
        setConfirmacion(null);
        cambiarEstado(id, 'En_Logistica');
      }
    });
  }

  const pedidosProduccion = pedidos.filter(p => {
    const responsableId = p.tipo_orden === 'Traspaso' ? p.sucursal_id : (p.sucursal_destino_id || p.sucursal_id);
    return responsableId === parseInt(usuarioActual.sucursal_id) && 
           ((p.estado === 'Aprobado' && p.requiere_produccion === true) || p.estado === 'En_Produccion');
  });

  const calcularTiempoTranscurrido = (fechaIso) => {
    if (!fechaIso) return { texto: 'Calculando...', horas: 0, minutos: 0, critico: false };
    const fechaOrigen = new Date(fechaIso.endsWith('Z') ? fechaIso : fechaIso + 'Z');
    const diffMs = horaActual - fechaOrigen;
    if (diffMs < 0) return { texto: 'Recién llegado', horas: 0, minutos: 0, critico: false };
    
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const esCritico = diffHrs >= 2;
    
    let texto = diffHrs > 0 ? `${diffHrs}h ${diffMins}m en cola` : `${diffMins} minutos en cola`;
    
    // Agregamos 'minutos' para que el sistema de notificaciones sepa si acaba de llegar
    return { texto, horas: diffHrs, minutos: diffMins, critico: esCritico }; 
  }

  // ==============================================
  // EL MOTOR DE VIGILANCIA (NOTIFICACIONES)
  // ==============================================
  useEffect(() => {
    // Si no ha dado permiso, no hacemos nada
    if (permisoNotificaciones !== 'granted') return;

    let hayNuevos = false;
    let hayCriticos = false;

    pedidosProduccion.forEach(pedido => {
      const tiempo = calcularTiempoTranscurrido(pedido.fecha_aprobacion || pedido.fecha_creacion);

      // 1. REGLA DE PEDIDO NUEVO (Tiene menos de 5 minutos y no le ha sonado la alarma)
      if (tiempo.horas === 0 && tiempo.minutos <= 5 && !pedidosYaNotificados.current.has(`${pedido.id}-nuevo`)) {
        hayNuevos = true;
        pedidosYaNotificados.current.add(`${pedido.id}-nuevo`); // Lo guardamos en memoria
      }

      // 2. REGLA DE PEDIDO CRÍTICO (Pasó a rojo y no le ha sonado la alarma de retraso)
      if (tiempo.critico && !pedidosYaNotificados.current.has(`${pedido.id}-critico`)) {
        hayCriticos = true;
        pedidosYaNotificados.current.add(`${pedido.id}-critico`); // Lo guardamos en memoria
      }
    });

    // Si encontramos algo, disparamos las alertas y el sonido
    if (hayNuevos || hayCriticos) {
      // Intentar reproducir sonido de notificación
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play().catch(err => console.log("El navegador bloqueó el sonido automático."));

      if (hayNuevos) {
        new Notification("¡Nuevo Material para Corte! ⚙️", { 
          body: "Acaba de llegar una nueva orden al taller. Revisa la pantalla."
        });
      }

      if (hayCriticos) {
        new Notification("🚨 ¡ALERTA DE RETRASO!", { 
          body: "Tienen un corte con más de 2 horas en espera. ¡Prioridad máxima!"
        });
      }
    }
  }, [pedidosProduccion, horaActual, permisoNotificaciones]); 
  // Este bloque se ejecuta solito cada que el reloj avanza o llegan datos nuevos

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8 relative text-gray-950">
      <div className="max-w-7xl mx-auto">
        
        {/* Barra Superior Producción */}
        <div className="bg-slate-800 rounded-2xl shadow-xl p-5 sm:p-6 flex flex-col sm:flex-row gap-5 justify-between items-center mb-6 sm:mb-8">
          <div className="flex flex-col items-center sm:items-start w-full justify-center sm:justify-start">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-3xl sm:text-4xl text-orange-500">⚙️</span>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white text-center sm:text-left leading-tight">
                Taller de Producción
              </h1>
            </div>
            <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2">
              <span className="bg-orange-600/20 text-orange-300 border border-orange-500/30 text-xs font-bold px-3 py-1.5 rounded-full shadow-inner flex items-center gap-1.5 whitespace-nowrap">
                 Centro de Corte
              </span>
              <span className="bg-slate-700 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-full shadow-inner whitespace-nowrap flex items-center gap-1">
                📍 {getNombreSucursal(usuarioActual.sucursal_id)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto justify-between border-t border-slate-700 pt-5 sm:border-0 sm:pt-0 shrink-0">
            
            {/* NUEVO: BOTÓN DE CAMPANITA PARA ACTIVAR ALERTAS */}
            {permisoNotificaciones !== 'granted' && (
              <button 
                onClick={solicitarPermisoNotificaciones}
                className="bg-yellow-500 hover:bg-yellow-400 text-yellow-950 font-bold p-3 rounded-full shadow-lg transition active:scale-95 animate-bounce"
                title="Activar Sonido y Alertas"
              >
                🔕
              </button>
            )}
            {permisoNotificaciones === 'granted' && (
              <div className="bg-slate-700 p-3 rounded-full shadow-inner text-emerald-400" title="Alertas Activadas">
                🔔
              </div>
            )}

            <div className="text-right text-white hidden sm:block border-r border-slate-600 pr-4">
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Operador:</p>
              <p className="text-sm font-bold leading-tight text-orange-400">{usuarioActual.nombre_completo}</p>
            </div>
            <button onClick={intentarCerrarSesion} className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-5 rounded-xl transition active:scale-95 text-sm shadow-md whitespace-nowrap">
              Salir
            </button>
          </div>
        </div>

        {/* Cola de Cortes Pendientes */}
        <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-6 md:p-8 border border-gray-100 animate-in fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-950">Cola de Cortes Pendientes</h2>
            <button onClick={obtenerDatos} className="w-full sm:w-auto text-center text-sm bg-gray-100 text-gray-700 px-5 py-3 rounded-xl hover:bg-gray-200 transition font-semibold">↻ Actualizar Lista</button>
          </div>

          {cargando && pedidosProduccion.length === 0 ? (
            <div className="text-center py-20 flex flex-col items-center gap-4">
               <div className="h-10 w-10 border-4 border-gray-200 border-t-orange-600 rounded-full animate-spin"></div>
            </div>
          ) : pedidosProduccion.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50 p-6">
              <span className="text-6xl mb-4 block">☕</span>
              <p className="text-gray-700 text-lg font-medium">¡No hay material pendiente para corte en esta sucursal!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {pedidosProduccion.map((pedido) => {
                const tiempo = calcularTiempoTranscurrido(pedido.fecha_aprobacion || pedido.fecha_creacion);
                
                return (
                  <div key={pedido.id} className={`bg-slate-50/50 border-2 rounded-2xl overflow-hidden shadow-inner hover:shadow-md transition-all duration-300 flex flex-col animate-in slide-in-from-bottom-2 ${tiempo.critico ? 'border-red-500 ring-4 ring-red-50 bg-red-50/50' : 'border-slate-800'}`}>
                    
                    <div onClick={() => setImagenAmpliando(pedido.url_foto_ticket)} className={`h-40 bg-gray-200 overflow-hidden relative group cursor-pointer border-b-2 shrink-0 ${tiempo.critico ? 'border-red-500' : 'border-slate-800'}`}>
                      <img src={pedido.url_foto_ticket} alt="Ticket" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition duration-300">
                          <span className="text-white text-sm bg-gray-900/80 px-4 py-2 rounded-full font-bold shadow-lg flex items-center gap-2 backdrop-blur-sm">🔍 Ver Foto</span>
                      </div>
                    </div>
                    
                    <div className="p-5 flex-grow flex flex-col">
                      <div className="flex justify-between items-start mb-3 gap-2">
                        <div>
                           <span className="text-sm font-black text-gray-700 bg-gray-100 px-2.5 py-1 rounded-md border border-gray-300 shrink-0">#{pedido.id}</span>
                           {pedido.numero_ticket && (
                              <p className="text-[11px] font-black text-gray-800 mt-2 leading-tight">Folio: {pedido.numero_ticket}</p>
                           )}
                        </div>
                        
                        {pedido.tipo_orden === 'Traspaso' ? (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full shadow-inner border bg-purple-100 text-purple-900 border-purple-200 h-fit">📦 TRASPASO</span>
                        ) : (
                          <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full shadow-inner border uppercase tracking-wider h-fit ${tiempo.critico ? 'bg-red-600 text-white border-red-700 animate-pulse' : 'bg-orange-100 text-orange-900 border-orange-300'}`}>
                            {tiempo.critico ? '🚨 URGENTE' : '⚙️ Pendiente de corte'}
                          </span>
                        )}
                      </div>
                      
                      <div className="bg-white p-3 rounded-xl flex-grow mb-4 text-sm text-gray-800 border border-gray-200 shadow-sm overflow-hidden">
                         <p className="whitespace-pre-wrap break-words line-clamp-3">{pedido.notas}</p>
                      </div>

                      <div className={`mb-3 p-3 rounded-xl flex items-center justify-between border shadow-inner ${tiempo.critico ? 'bg-red-100 border-red-300 text-red-900' : 'bg-slate-800 border-slate-900 text-white'}`}>
                        <div className="flex items-center gap-2 font-bold text-sm">
                          <span className={tiempo.critico ? 'animate-bounce text-xl' : 'text-lg'}>⏱️</span>
                          <span className="tracking-wide">{tiempo.texto}</span>
                        </div>
                        {tiempo.critico && <span className="text-[10px] font-black uppercase tracking-widest bg-red-600 text-white px-2 py-1 rounded">Retrasado</span>}
                      </div>

                      <button onClick={() => setPedidoDetalle(pedido)} className="w-full bg-white hover:bg-slate-50 text-slate-700 font-bold py-2.5 rounded-xl transition text-sm border-2 border-slate-200 shadow-sm flex justify-center items-center gap-2 active:scale-95 mb-3 shrink-0">
                        <span>📄</span> Ver Detalles Completos
                      </button>
                      
                      <button 
                        onClick={() => intentarCompletarCorte(pedido.id)}
                        className={`w-full text-white font-extrabold py-3.5 rounded-xl transition duration-200 active:scale-95 shadow-md flex items-center justify-center gap-2 text-base shrink-0 ${tiempo.critico ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                      >
                        ✅ Listo para Logística
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Ver Detalles Completos */}
      {pedidoDetalle && (() => {
        const tiempo = calcularTiempoTranscurrido(pedidoDetalle.fecha_aprobacion || pedidoDetalle.fecha_creacion);
        return (
          <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
              
              <div className="bg-slate-800 p-5 sm:p-6 flex justify-between items-center text-white shrink-0">
                <div>
                  <h3 className="font-extrabold text-xl sm:text-2xl flex items-center gap-2">
                    📄 Detalles de Corte #{pedidoDetalle.id}
                  </h3>
                  {pedidoDetalle.numero_ticket && <p className="text-slate-300 text-sm mt-1">Folio: {pedidoDetalle.numero_ticket}</p>}
                </div>
                <button onClick={() => setPedidoDetalle(null)} className="text-slate-400 hover:text-white text-3xl font-bold h-10 w-10 flex items-center justify-center rounded-full hover:bg-slate-700 transition">&times;</button>
              </div>
              
              <div className="p-5 sm:p-8 space-y-6 overflow-y-auto bg-gray-50 flex-grow">
                 <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                       <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Origen de la Orden</p>
                       <p className="font-bold text-gray-900">{getNombreSucursal(pedidoDetalle.sucursal_id)}</p>
                    </div>
                    <div className={`px-5 py-3 rounded-xl text-center shadow-inner min-w-[140px] ${tiempo.critico ? 'bg-red-100 text-red-900' : 'bg-gray-900 text-white'}`}>
                       <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${tiempo.critico ? 'text-red-700' : 'text-gray-400'}`}>Tiempo en Cola</p>
                       <p className={`font-mono text-xl font-bold ${tiempo.critico ? 'animate-pulse' : 'text-orange-400'}`}>
                          {tiempo.texto}
                       </p>
                    </div>
                 </div>

                 <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                       <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Material a Cortar</h4>
                       <button onClick={() => setImagenAmpliando(pedidoDetalle.url_foto_ticket)} className="text-blue-600 hover:text-blue-800 text-sm font-bold flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-lg transition">🔍 Ver Foto del Ticket</button>
                    </div>
                    <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100">
                       <textarea readOnly value={pedidoDetalle.notas} className="w-full bg-transparent text-gray-800 text-base font-medium leading-relaxed resize-none outline-none h-48 whitespace-pre-wrap"></textarea>
                    </div>
                 </div>

                 <button 
                    onClick={() => intentarCompletarCorte(pedidoDetalle.id)}
                    className={`w-full text-white font-extrabold py-4 rounded-xl transition duration-200 active:scale-95 shadow-md flex items-center justify-center gap-2 text-lg mt-4 ${tiempo.critico ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                  >
                    ✅ Marcar como Listo para Logística
                 </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Visor de Fotos */}
      {imagenAmpliando && (
        <div className="fixed inset-0 bg-gray-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in zoom-in duration-200">
          <button onClick={() => setImagenAmpliando(null)} className="absolute top-4 right-4 sm:top-8 sm:right-8 text-white bg-gray-800 hover:bg-gray-700 rounded-full w-12 h-12 flex items-center justify-center text-3xl font-bold transition shadow-xl active:scale-95">
            &times;
          </button>
          <img src={imagenAmpliando} alt="Ticket Ampliado" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl border border-gray-800" />
        </div>
      )}

      {/* MODAL GLOBAL DE DOBLE CONFIRMACIÓN */}
      {confirmacion && (
        <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-[200] animate-in zoom-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden text-center p-8">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-6">
              <span className="text-3xl">⚠️</span>
            </div>
            <h3 className="text-xl font-extrabold text-gray-900 mb-2">{confirmacion.titulo}</h3>
            <p className="text-gray-500 mb-8 font-medium">{confirmacion.mensaje}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmacion(null)} 
                className="flex-1 bg-gray-100 py-3.5 rounded-xl font-bold text-gray-700 hover:bg-gray-200 transition active:scale-95"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmacion.accion} 
                className={`flex-1 text-white py-3.5 rounded-xl font-bold shadow-md transition active:scale-95 ${confirmacion.colorBoton}`}
              >
                {confirmacion.textoBoton}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default PanelProduccion