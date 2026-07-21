// Metrónomo simple: mismo mecanismo de scheduling preciso que la tabla de
// drums, pero un click por negra (4/4), con acento en el primer tiempo.
import { useEffect, useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { obtenerContextoCompartido } from '../lib/audioEngine.js';
import { Scheduler } from './scheduler.js';

function click(ctx, destino, t, acentuado) {
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = 'sine';
	osc.frequency.value = acentuado ? 1500 : 1000;
	gain.gain.setValueAtTime(acentuado ? 0.9 : 0.5, t);
	gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
	osc.connect(gain).connect(destino);
	osc.start(t);
	osc.stop(t + 0.06);
}

export default function Metronomo() {
	const ctx = obtenerContextoCompartido();
	const [bpm, setBpm] = useState(120);
	const [sonando, setSonando] = useState(false);
	const [tiempo, setTiempo] = useState(-1);
	const schedulerRef = useRef(null);

	useEffect(() => {
		schedulerRef.current = new Scheduler(ctx, {
			pasos: 4,
			subdivision: 1, // negras
			onPaso: (indice, t) => {
				click(ctx, ctx.destination, t, indice === 0);
				setTiempo(indice);
			},
		});
		return () => schedulerRef.current.detener();
	}, [ctx]);

	useEffect(() => {
		if (schedulerRef.current) schedulerRef.current.bpm = bpm;
	}, [bpm]);

	function togglePlay() {
		if (sonando) {
			schedulerRef.current.detener();
			setSonando(false);
			setTiempo(-1);
		} else {
			if (ctx.state === 'suspended') ctx.resume();
			schedulerRef.current.iniciar();
			setSonando(true);
		}
	}

	return (
		<div className="flex flex-col items-center gap-5 py-4">
			<div className="flex gap-2">
				{[0, 1, 2, 3].map((i) => (
					<span
						key={i}
						className="h-4 w-4 rounded-full"
						style={{ background: tiempo === i ? 'var(--vawol-accion)' : 'rgba(255,255,255,0.15)' }}
					/>
				))}
			</div>
			<button
				type="button"
				onClick={togglePlay}
				className="flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium text-white"
				style={{ background: 'var(--vawol-accion)' }}
			>
				{sonando ? <Square size={14} /> : <Play size={14} />} {sonando ? 'Detener' : 'Metrónomo'}
			</button>
			<label className="flex items-center gap-2 text-xs text-white/60">
				BPM
				<input type="range" min="40" max="240" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="w-40 accent-[var(--vawol-accion)]" />
				<span className="w-8 font-mono">{bpm}</span>
			</label>
		</div>
	);
}
