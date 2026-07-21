import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { Volume2, VolumeX, Scissors, Trash2 } from 'lucide-react';
import { audioBufferAWav } from '../lib/wavEncoder.js';

const Pista = forwardRef(function Pista({ pista, motor, onCambio, onEliminar }, ref) {
	const contenedorRef = useRef(null);
	const wsRef = useRef(null);
	const [regionSeleccionada, setRegionSeleccionada] = useState(null);

	// (Re)carga la forma de onda cada vez que cambia el buffer de la pista
	// (ej. despues de un recorte). WaveSurfer acá es solo visual + selección
	// de regiones; la reproducción real la maneja el motor (Web Audio directo).
	useEffect(() => {
		const regions = RegionsPlugin.create();

		const ws = WaveSurfer.create({
			container: contenedorRef.current,
			height: 56,
			waveColor: 'rgba(255,255,255,0.25)',
			progressColor: pista.color,
			cursorColor: 'transparent',
			interact: false, // el transporte lo maneja el motor, no clicks acá
			plugins: [regions],
		});

		const blob = audioBufferAWav(pista.buffer);
		ws.loadBlob(blob);

		regions.enableDragSelection({ color: 'rgba(230,126,34,0.25)' });
		regions.on('region-updated', (region) => setRegionSeleccionada(region));
		regions.on('region-created', (region) => {
			// Solo una región de selección por vez
			for (const r of regions.getRegions()) if (r.id !== region.id) r.remove();
			setRegionSeleccionada(region);
		});

		wsRef.current = ws;
		return () => ws.destroy();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pista.buffer]);

	useImperativeHandle(ref, () => ({
		moverPlayhead(segundos) {
			const ws = wsRef.current;
			if (!ws || !pista.duracion) return;
			ws.seekTo(Math.min(1, Math.max(0, segundos / pista.duracion)));
		},
	}), [pista.duracion]);

	function aplicarRecorte() {
		if (!regionSeleccionada) return;
		motor.recortarPista(pista.id, regionSeleccionada.start, regionSeleccionada.end);
		regionSeleccionada.remove();
		setRegionSeleccionada(null);
		onCambio();
	}

	return (
		<div className="flex items-stretch gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
			<div className="flex w-28 shrink-0 flex-col justify-between">
				<div className="flex items-center gap-2">
					<span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: pista.color }} />
					<span className="truncate text-sm font-medium text-white">{pista.nombre}</span>
				</div>
				<div className="flex items-center gap-1.5">
					<button
						type="button"
						onClick={() => { motor.toggleMute(pista.id); onCambio(); }}
						className={`rounded px-2 py-1 text-xs font-semibold transition ${pista.muteada ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50'}`}
					>
						{pista.muteada ? <VolumeX size={13} /> : <Volume2 size={13} />}
					</button>
					<button
						type="button"
						onClick={() => { motor.toggleSolo(pista.id); onCambio(); }}
						className={`rounded px-2 py-1 text-xs font-semibold transition ${pista.soleada ? 'text-black' : 'bg-white/5 text-white/50'}`}
						style={pista.soleada ? { background: pista.color } : undefined}
					>
						S
					</button>
					<input
						type="range"
						min={0}
						max={1.5}
						step={0.01}
						defaultValue={pista.volumen}
						onChange={(e) => motor.setVolumen(pista.id, Number(e.target.value))}
						className="h-1 w-16 accent-white/70"
					/>
				</div>
			</div>

			<div ref={contenedorRef} className="min-w-0 flex-1 self-center" />

			<div className="flex shrink-0 flex-col justify-center gap-1.5">
				<button
					type="button"
					disabled={!regionSeleccionada}
					onClick={aplicarRecorte}
					title="Recortar a la selección"
					className="rounded p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-20"
				>
					<Scissors size={15} />
				</button>
				<button
					type="button"
					onClick={() => onEliminar(pista.id)}
					title="Eliminar pista"
					className="rounded p-1.5 text-white/60 transition hover:bg-red-500/20 hover:text-red-400"
				>
					<Trash2 size={15} />
				</button>
			</div>
		</div>
	);
});

export default Pista;
