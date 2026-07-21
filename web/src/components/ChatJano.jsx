// Agente musical embebido en el Estudio. Usa /hcgi/api/jano/estudio (público,
// sin secretos — mismo motivo que las apps móviles: un sitio estático no
// puede guardar una clave con seguridad). El servidor solo DECLARA las
// acciones (tool-calling); quien las ejecuta de verdad es este componente,
// contra el MotorAudio real del navegador — el servidor no tiene forma de
// tocar el AudioContext del cliente.
import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';

const API_ESTUDIO = 'https://app.vawol.com/hcgi/api/jano/estudio';

function buscarPista(pistas, nombre) {
	const objetivo = String(nombre || '').toLowerCase().trim();
	return pistas.find((p) => p.nombre.toLowerCase() === objetivo)
		?? pistas.find((p) => p.nombre.toLowerCase().includes(objetivo) || objetivo.includes(p.nombre.toLowerCase()));
}

export default function ChatJano({ motor, pistas, onAbrirPlugin, onAbrirSeparador, onExportar, onCambiarVelocidad }) {
	const [abierto, setAbierto] = useState(false);
	const [mensajes, setMensajes] = useState([
		{ role: 'assistant', content: 'Hola, soy el asistente del Estudio. Pedime que mutee, cambie el volumen o la velocidad, abra un plugin, o preguntame de música — puedo hacerlo, no solo explicarlo.' },
	]);
	const [texto, setTexto] = useState('');
	const [enviando, setEnviando] = useState(false);
	const finRef = useRef(null);

	useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [mensajes, abierto]);

	function ejecutar(accion) {
		const { tipo } = accion;
		switch (tipo) {
			case 'reproducir': motor.play(); return 'reproduciendo';
			case 'pausar': motor.pausar(); return 'pausado';
			case 'mutear': case 'desmutear': case 'solear': case 'quitar_solo': {
				const pista = buscarPista(pistas, accion.pista);
				if (!pista) return `no encontré la pista "${accion.pista}"`;
				if (tipo === 'mutear' && !pista.muteada) motor.toggleMute(pista.id);
				if (tipo === 'desmutear' && pista.muteada) motor.toggleMute(pista.id);
				if (tipo === 'solear' && !pista.soleada) motor.toggleSolo(pista.id);
				if (tipo === 'quitar_solo' && pista.soleada) motor.toggleSolo(pista.id);
				return `${tipo} aplicado a "${pista.nombre}"`;
			}
			case 'cambiar_volumen': {
				const pista = buscarPista(pistas, accion.pista);
				if (!pista) return `no encontré la pista "${accion.pista}"`;
				motor.setVolumen(pista.id, Math.max(0, Math.min(1.5, Number(accion.volumen))));
				return `volumen de "${pista.nombre}" cambiado`;
			}
			case 'cambiar_velocidad':
				onCambiarVelocidad?.(Math.max(0.5, Math.min(2, Number(accion.velocidad))));
				return 'velocidad cambiada';
			case 'abrir_plugin': onAbrirPlugin?.(accion.nombre); return `plugin ${accion.nombre} abierto`;
			case 'abrir_separador': onAbrirSeparador?.(accion.url_colab); return 'separador abierto';
			case 'exportar': onExportar?.(); return 'exportando';
			default: return `acción desconocida: ${tipo}`;
		}
	}

	async function enviar(e) {
		e.preventDefault();
		const mensaje = texto.trim();
		if (!mensaje || enviando) return;
		const historialPrevio = mensajes;
		setMensajes((m) => [...m, { role: 'user', content: mensaje }]);
		setTexto('');
		setEnviando(true);
		try {
			const resp = await fetch(API_ESTUDIO, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: mensaje, history: historialPrevio, pistas: pistas.map((p) => p.nombre) }),
			});
			const data = await resp.json();
			if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
			for (const accion of data.acciones || []) {
				try { ejecutar(accion); } catch { /* una acción fallida no debería tumbar el chat */ }
			}
			setMensajes((m) => [...m, { role: 'assistant', content: data.reply }]);
		} catch (err) {
			setMensajes((m) => [...m, { role: 'assistant', content: `(No pude responder: ${err.message})` }]);
		} finally {
			setEnviando(false);
		}
	}

	if (!abierto) {
		return (
			<button
				type="button"
				onClick={() => setAbierto(true)}
				className="fixed bottom-24 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition hover:scale-105"
				style={{ background: 'var(--vawol-accion)' }}
				aria-label="Abrir el asistente del Estudio"
			>
				<MessageCircle size={22} />
			</button>
		);
	}

	return (
		<div className="fixed bottom-24 right-5 z-50 flex h-[28rem] w-80 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--vawol-principal-hondo)] shadow-2xl">
			<div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
				<span className="text-sm font-medium text-white">Asistente del Estudio</span>
				<button type="button" onClick={() => setAbierto(false)} className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white">
					<X size={16} />
				</button>
			</div>

			<div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
				{mensajes.map((m, i) => (
					<div
						key={i}
						className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${m.role === 'user' ? 'ml-auto text-white' : 'text-white/80'}`}
						style={{ background: m.role === 'user' ? 'var(--vawol-accion)' : 'rgba(255,255,255,0.06)' }}
					>
						{m.content}
					</div>
				))}
				{enviando && <div className="text-xs text-white/30">Pensando…</div>}
				<div ref={finRef} />
			</div>

			<form onSubmit={enviar} className="flex items-center gap-2 border-t border-white/10 p-2">
				<input
					value={texto}
					onChange={(e) => setTexto(e.target.value)}
					placeholder="Ej: muteá la batería…"
					className="flex-1 rounded-full bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none"
				/>
				<button
					type="submit"
					disabled={!texto.trim() || enviando}
					className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-30"
					style={{ background: 'var(--vawol-accion)' }}
				>
					<Send size={14} />
				</button>
			</form>
		</div>
	);
}
