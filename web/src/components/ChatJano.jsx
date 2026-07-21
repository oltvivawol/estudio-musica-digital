// Chat con Jano embebido en arte.vawol.com. Usa el endpoint público
// /hcgi/api/jano/app de sura (pensado para clientes que no pueden guardar
// secretos con seguridad, como este sitio estático — mismo motivo que las
// apps móviles) en vez del endpoint interno /_ai/generate, que exige una
// clave que nunca debería viajar al navegador de un visitante.
import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';

const API_JANO = 'https://app.vawol.com/hcgi/api/jano/app';

export default function ChatJano() {
	const [abierto, setAbierto] = useState(false);
	const [mensajes, setMensajes] = useState([
		{ role: 'assistant', content: 'Hola, soy Jano. Preguntame lo que quieras del Estudio de Música — o de VAWOL en general.' },
	]);
	const [texto, setTexto] = useState('');
	const [enviando, setEnviando] = useState(false);
	const finRef = useRef(null);

	useEffect(() => {
		finRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [mensajes, abierto]);

	async function enviar(e) {
		e.preventDefault();
		const mensaje = texto.trim();
		if (!mensaje || enviando) return;
		const historial = [...mensajes, { role: 'user', content: mensaje }];
		setMensajes(historial);
		setTexto('');
		setEnviando(true);
		try {
			const resp = await fetch(API_JANO, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: mensaje, history: mensajes }),
			});
			const data = await resp.json();
			if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
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
				aria-label="Abrir chat con Jano"
			>
				<MessageCircle size={22} />
			</button>
		);
	}

	return (
		<div className="fixed bottom-24 right-5 z-50 flex h-[28rem] w-80 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--vawol-principal-hondo)] shadow-2xl">
			<div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
				<span className="text-sm font-medium text-white">Jano</span>
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
				{enviando && <div className="text-xs text-white/30">Jano está pensando…</div>}
				<div ref={finRef} />
			</div>

			<form onSubmit={enviar} className="flex items-center gap-2 border-t border-white/10 p-2">
				<input
					value={texto}
					onChange={(e) => setTexto(e.target.value)}
					placeholder="Escribile a Jano…"
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
