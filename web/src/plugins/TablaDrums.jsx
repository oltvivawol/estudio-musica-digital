// Tabla para armar ritmos de batería: grilla de 16 pasos por sonido, BPM
// ajustable. Usa el Scheduler de precisión (lookahead sobre el reloj real
// del AudioContext) para que no se desincronice, y sonidos sintetizados
// (sin archivos que cargar) de ../plugins/tambores.js.
import { useEffect, useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { obtenerContextoCompartido } from '../lib/audioEngine.js';
import { Scheduler } from './scheduler.js';
import { SONIDOS } from './tambores.js';

const PASOS = 16;
function grillaVacia() {
	return Object.fromEntries(SONIDOS.map((s) => [s.id, Array(PASOS).fill(false)]));
}

export default function TablaDrums() {
	const ctx = obtenerContextoCompartido();
	const [grilla, setGrilla] = useState(grillaVacia);
	const [bpm, setBpm] = useState(120);
	const [sonando, setSonando] = useState(false);
	const [pasoActual, setPasoActual] = useState(-1);
	const grillaRef = useRef(grilla);
	grillaRef.current = grilla;
	const schedulerRef = useRef(null);

	useEffect(() => {
		schedulerRef.current = new Scheduler(ctx, {
			pasos: PASOS,
			onPaso: (indice, tiempo) => {
				for (const { id, fn } of SONIDOS) {
					if (grillaRef.current[id][indice]) fn(ctx, ctx.destination, tiempo);
				}
				setPasoActual(indice);
			},
		});
		return () => schedulerRef.current.detener();
	}, [ctx]);

	useEffect(() => {
		if (schedulerRef.current) schedulerRef.current.bpm = bpm;
	}, [bpm]);

	function toggle(sonidoId, paso) {
		setGrilla((g) => ({
			...g,
			[sonidoId]: g[sonidoId].map((v, i) => (i === paso ? !v : v)),
		}));
	}

	function togglePlay() {
		if (sonando) {
			schedulerRef.current.detener();
			setSonando(false);
			setPasoActual(-1);
		} else {
			if (ctx.state === 'suspended') ctx.resume();
			schedulerRef.current.iniciar();
			setSonando(true);
		}
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center gap-4">
				<button
					type="button"
					onClick={togglePlay}
					className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-white"
					style={{ background: 'var(--vawol-accion)' }}
				>
					{sonando ? <Square size={14} /> : <Play size={14} />} {sonando ? 'Detener' : 'Tocar'}
				</button>
				<label className="flex items-center gap-2 text-xs text-white/60">
					BPM
					<input
						type="range" min="60" max="200" value={bpm}
						onChange={(e) => setBpm(Number(e.target.value))}
						className="w-32 accent-[var(--vawol-accion)]"
					/>
					<span className="w-8 font-mono">{bpm}</span>
				</label>
			</div>

			<div className="flex flex-col gap-1.5 overflow-x-auto">
				{SONIDOS.map(({ id, nombre }) => (
					<div key={id} className="flex items-center gap-2">
						<span className="w-24 shrink-0 text-right text-xs text-white/50">{nombre}</span>
						<div className="flex gap-1">
							{grilla[id].map((activo, paso) => (
								<button
									key={paso}
									type="button"
									onClick={() => toggle(id, paso)}
									className="h-7 w-7 shrink-0 rounded"
									style={{
										background: activo ? 'var(--vawol-accion)' : paso === pasoActual ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
										outline: paso % 4 === 0 ? '1px solid rgba(255,255,255,0.15)' : 'none',
									}}
								/>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
