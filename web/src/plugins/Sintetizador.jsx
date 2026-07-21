// Sintetizador tocable: osciladores + envolvente ADSR + filtro, con teclado
// on-screen y soporte real de MIDI (Web MIDI API nativa del navegador, sin
// librerías). Comparte el AudioContext del resto del Estudio.
import { useEffect, useRef, useState } from 'react';
import { obtenerContextoCompartido } from '../lib/audioEngine.js';

const TECLAS = [
	{ nota: 60, tecla: 'a', negra: false }, { nota: 61, tecla: 'w', negra: true },
	{ nota: 62, tecla: 's', negra: false }, { nota: 63, tecla: 'e', negra: true },
	{ nota: 64, tecla: 'd', negra: false },
	{ nota: 65, tecla: 'f', negra: false }, { nota: 66, tecla: 't', negra: true },
	{ nota: 67, tecla: 'g', negra: false }, { nota: 68, tecla: 'y', negra: true },
	{ nota: 69, tecla: 'h', negra: false }, { nota: 70, tecla: 'u', negra: true },
	{ nota: 71, tecla: 'j', negra: false },
	{ nota: 72, tecla: 'k', negra: false },
];

function notaAFrecuencia(nota) {
	return 440 * 2 ** ((nota - 69) / 12);
}

export default function Sintetizador() {
	const ctx = obtenerContextoCompartido();
	const [forma, setForma] = useState('sawtooth');
	const [corte, setCorte] = useState(4000);
	const [adsr, setAdsr] = useState({ attack: 0.02, decay: 0.15, sustain: 0.6, release: 0.3 });
	const [midiEstado, setMidiEstado] = useState('buscando'); // buscando | ok | sin-soporte | sin-dispositivos
	const [notasActivas, setNotasActivas] = useState(new Set());
	const vocesRef = useRef(new Map());
	const paramsRef = useRef({ forma, corte, adsr });
	paramsRef.current = { forma, corte, adsr };

	function noteOn(nota, velocidad = 1) {
		if (vocesRef.current.has(nota)) return;
		const { forma, corte, adsr } = paramsRef.current;
		const now = ctx.currentTime;

		const osc = ctx.createOscillator();
		osc.type = forma;
		osc.frequency.value = notaAFrecuencia(nota);

		const filtro = ctx.createBiquadFilter();
		filtro.type = 'lowpass';
		filtro.frequency.value = corte;

		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0, now);
		gain.gain.linearRampToValueAtTime(velocidad, now + adsr.attack);
		gain.gain.linearRampToValueAtTime(velocidad * adsr.sustain, now + adsr.attack + adsr.decay);

		osc.connect(filtro).connect(gain).connect(ctx.destination);
		osc.start(now);
		vocesRef.current.set(nota, { osc, gain });
		setNotasActivas((prev) => new Set(prev).add(nota));
	}

	function noteOff(nota) {
		const voz = vocesRef.current.get(nota);
		if (!voz) return;
		const { adsr } = paramsRef.current;
		const now = ctx.currentTime;
		voz.gain.gain.cancelScheduledValues(now);
		voz.gain.gain.setValueAtTime(voz.gain.gain.value, now);
		voz.gain.gain.linearRampToValueAtTime(0, now + adsr.release);
		voz.osc.stop(now + adsr.release + 0.05);
		vocesRef.current.delete(nota);
		setNotasActivas((prev) => { const n = new Set(prev); n.delete(nota); return n; });
	}

	// Teclado de la computadora
	useEffect(() => {
		const mapa = Object.fromEntries(TECLAS.map((t) => [t.tecla, t.nota]));
		const onDown = (e) => { if (mapa[e.key] != null && !e.repeat) noteOn(mapa[e.key]); };
		const onUp = (e) => { if (mapa[e.key] != null) noteOff(mapa[e.key]); };
		window.addEventListener('keydown', onDown);
		window.addEventListener('keyup', onUp);
		return () => {
			window.removeEventListener('keydown', onDown);
			window.removeEventListener('keyup', onUp);
		};
	}, []);

	// MIDI real: navigator.requestMIDIAccess() es una API nativa del navegador.
	useEffect(() => {
		if (!navigator.requestMIDIAccess) { setMidiEstado('sin-soporte'); return; }
		let activo = true;
		navigator.requestMIDIAccess().then((acceso) => {
			if (!activo) return;
			const entradas = Array.from(acceso.inputs.values());
			if (!entradas.length) { setMidiEstado('sin-dispositivos'); return; }
			for (const entrada of entradas) {
				entrada.onmidimessage = ({ data }) => {
					const [status, nota, velocidad] = data;
					const tipo = status & 0xf0;
					if (tipo === 0x90 && velocidad > 0) noteOn(nota, velocidad / 127);
					else if (tipo === 0x80 || (tipo === 0x90 && velocidad === 0)) noteOff(nota);
				};
			}
			setMidiEstado('ok');
		}).catch(() => setMidiEstado('sin-soporte'));
		return () => { activo = false; };
	}, []);

	// Al desmontar: cortar cualquier voz que quedara sonando
	useEffect(() => () => {
		for (const nota of vocesRef.current.keys()) noteOff(nota);
	}, []);

	return (
		<div className="flex flex-col gap-5">
			<p className="text-xs text-white/40">
				{{
					buscando: 'Buscando dispositivos MIDI…',
					ok: '🎹 Teclado MIDI conectado',
					'sin-dispositivos': 'Sin teclado MIDI conectado — usá el teclado de la compu (fila A-K) o el mouse',
					'sin-soporte': 'Este navegador no soporta Web MIDI — usá el teclado de la compu o el mouse',
				}[midiEstado]}
			</p>

			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<label className="flex flex-col gap-1 text-xs text-white/60">
					Forma de onda
					<select value={forma} onChange={(e) => setForma(e.target.value)} className="rounded-md border border-white/15 bg-transparent px-2 py-1.5 text-white">
						<option value="sawtooth">Sierra</option>
						<option value="square">Cuadrada</option>
						<option value="sine">Seno</option>
						<option value="triangle">Triángulo</option>
					</select>
				</label>
				<label className="flex flex-col gap-1 text-xs text-white/60">
					Filtro (corte: {corte}Hz)
					<input type="range" min="200" max="12000" step="50" value={corte} onChange={(e) => setCorte(Number(e.target.value))} className="accent-[var(--vawol-accion)]" />
				</label>
				{['attack', 'decay', 'release'].map((k) => (
					<label key={k} className="flex flex-col gap-1 text-xs capitalize text-white/60">
						{k} ({adsr[k].toFixed(2)}s)
						<input
							type="range" min="0.01" max="1.5" step="0.01" value={adsr[k]}
							onChange={(e) => setAdsr((a) => ({ ...a, [k]: Number(e.target.value) }))}
							className="accent-[var(--vawol-accion)]"
						/>
					</label>
				))}
			</div>

			<div className="relative flex h-40 select-none">
				{TECLAS.map(({ nota, tecla, negra }) => (
					<button
						key={nota}
						type="button"
						onMouseDown={() => noteOn(nota)}
						onMouseUp={() => noteOff(nota)}
						onMouseLeave={() => notasActivas.has(nota) && noteOff(nota)}
						onTouchStart={(e) => { e.preventDefault(); noteOn(nota); }}
						onTouchEnd={(e) => { e.preventDefault(); noteOff(nota); }}
						className={
							negra
								? 'relative z-10 -mx-3 h-24 w-6 rounded-b-md border border-black/40 text-[9px] text-white/50'
								: 'flex h-full flex-1 items-end justify-center rounded-b-md border border-white/10 pb-1 text-[10px] text-white/40'
						}
						style={{ background: notasActivas.has(nota) ? 'var(--vawol-accion)' : negra ? '#1a1720' : '#eef1f4' }}
					>
						<span className={negra ? '' : 'text-black/50'}>{tecla}</span>
					</button>
				))}
			</div>
		</div>
	);
}
