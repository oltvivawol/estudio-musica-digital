import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Play, Pause, Square, Mic, Download, Upload, ArrowLeft, Gauge, Blocks, Activity, Sparkles } from 'lucide-react';
import { MotorAudio, Pista as PistaModelo, decodificarArchivo } from '../lib/audioEngine.js';
import { importarArchivos } from '../lib/importarStems.js';
import { audioBufferAWav, descargarBlob } from '../lib/wavEncoder.js';
import PistaUI from '../components/Pista.jsx';
import PanelPlugins from '../plugins/PanelPlugins.jsx';
import SepararConIA from '../components/SepararConIA.jsx';

const COLOR_GRABACION = '#ff6b6b';

function formatearTiempo(segundos) {
	const s = Math.max(0, Math.floor(segundos));
	return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function EstudioPage() {
	const motorRef = useRef(null);
	if (!motorRef.current) motorRef.current = new MotorAudio();
	const motor = motorRef.current;

	const [pistas, setPistas] = useState([]);
	const [reproduciendo, setReproduciendo] = useState(false);
	const [tiempo, setTiempo] = useState(0);
	const [grabando, setGrabando] = useState(false);
	const [cargando, setCargando] = useState(false);
	const [velocidad, setVelocidad] = useState(1);
	const [pluginsAbierto, setPluginsAbierto] = useState(false);
	const [iaAbierta, setIaAbierta] = useState(false);
	const pistaRefs = useRef({});
	const mediaRecorderRef = useRef(null);

	const refrescar = useCallback(() => setPistas([...motor.pistas]), [motor]);

	motor.onTick((seg) => {
		setTiempo(seg);
		for (const p of motor.pistas) pistaRefs.current[p.id]?.moverPlayhead(seg);
	});

	function agregarStems(stems) {
		for (const s of stems) {
			motor.agregarPista(new PistaModelo({ id: crypto.randomUUID(), ...s }));
		}
		refrescar();
	}

	async function manejarArchivos(fileList) {
		const archivos = Array.from(fileList);
		if (!archivos.length) return;
		setCargando(true);
		try {
			const stems = await importarArchivos(archivos);
			if (!stems.length) {
				toast.error('No encontré audio ahí — ¿es el .zip que bajaste de Colab?');
				return;
			}
			agregarStems(stems);
			toast.success(`${stems.length} pista(s) importada(s)`);
		} catch (e) {
			toast.error(`No pude importar: ${e.message}`);
		} finally {
			setCargando(false);
		}
	}

	function togglePlay() {
		if (!pistas.length) return;
		if (reproduciendo) {
			motor.pausar();
			setReproduciendo(false);
		} else {
			motor.play();
			setReproduciendo(true);
		}
	}

	function detener() {
		motor.detener();
		setReproduciendo(false);
		setTiempo(0);
		for (const p of motor.pistas) pistaRefs.current[p.id]?.moverPlayhead(0);
	}

	async function toggleGrabar() {
		if (grabando) {
			mediaRecorderRef.current?.stop();
			return;
		}
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mr = new MediaRecorder(stream);
			const trozos = [];
			mr.ondataavailable = (e) => trozos.push(e.data);
			mr.onstop = async () => {
				stream.getTracks().forEach((t) => t.stop());
				const blob = new Blob(trozos, { type: mr.mimeType });
				const buffer = await decodificarArchivo(new File([blob], 'grabacion.webm'));
				motor.agregarPista(new PistaModelo({
					id: crypto.randomUUID(),
					nombre: `Grabación ${pistas.length + 1}`,
					color: COLOR_GRABACION,
					buffer,
				}));
				refrescar();
				setGrabando(false);
				motor.pausar();
				setReproduciendo(false);
				toast.success('Pista grabada y agregada');
			};
			mediaRecorderRef.current = mr;
			mr.start();
			setGrabando(true);
			// Arranca la reproducción del resto de las pistas al mismo tiempo
			motor.play();
			setReproduciendo(true);
		} catch {
			toast.error('No pude acceder al micrófono (¿diste permiso?)');
		}
	}

	function cambiarVelocidad(valor) {
		setVelocidad(valor);
		motor.setVelocidad(valor);
	}

	async function detectarBPM() {
		if (!pistas.length) return;
		try {
			toast.info('Analizando el tempo…');
			// Preferimos la pista de batería para detectar el BPM (más precisa
			// para esto que voz/piano); si no hay, usamos la primera disponible.
			const candidata = pistas.find((p) => /bater/i.test(p.nombre)) ?? pistas[0];
			const { guess } = await import('web-audio-beat-detector');
			const { bpm } = await guess(candidata.buffer);
			toast.success(`BPM detectado: ${Math.round(bpm)} (de "${candidata.nombre}")`);
		} catch (e) {
			toast.error(`No pude detectar el BPM: ${e.message}`);
		}
	}

	function eliminarPista(id) {
		motor.quitarPista(id);
		delete pistaRefs.current[id];
		refrescar();
	}

	async function exportarMezcla() {
		if (!pistas.length) return;
		try {
			toast.info('Renderizando la mezcla…');
			const buffer = await motor.renderizarMezcla();
			const blob = audioBufferAWav(buffer);
			descargarBlob(blob, 'mi-mezcla-vawol.wav');
			toast.success('Mezcla descargada');
		} catch (e) {
			toast.error(`No pude exportar: ${e.message}`);
		}
	}

	return (
		<div className="flex min-h-screen flex-col">
			<header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
				<Link to="/" className="flex items-center gap-2 text-sm text-white/50 hover:text-white">
					<ArrowLeft size={16} /> VAWOL · Arte
				</Link>
				<h1 className="text-sm font-medium text-white/80">Estudio de Música Digital</h1>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => setIaAbierta(true)}
						className="flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-1.5 text-sm font-medium text-white/80 transition hover:bg-white/10"
					>
						<Sparkles size={14} /> Separar con IA
					</button>
					<button
						type="button"
						onClick={detectarBPM}
						disabled={!pistas.length}
						className="flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-1.5 text-sm font-medium text-white/80 transition hover:bg-white/10 disabled:opacity-30"
					>
						<Activity size={14} /> BPM
					</button>
					<button
						type="button"
						onClick={() => setPluginsAbierto(true)}
						className="flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-1.5 text-sm font-medium text-white/80 transition hover:bg-white/10"
					>
						<Blocks size={14} /> Plugins
					</button>
					<button
						type="button"
						onClick={exportarMezcla}
						disabled={!pistas.length}
						className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium text-white transition disabled:opacity-30"
						style={{ background: 'var(--vawol-accion)' }}
					>
						<Download size={14} /> Exportar
					</button>
				</div>
			</header>

			{pluginsAbierto && <PanelPlugins onCerrar={() => setPluginsAbierto(false)} />}
			{iaAbierta && (
				<SepararConIA
					onListo={(stems) => { agregarStems(stems); setIaAbierta(false); }}
					onCerrar={() => setIaAbierta(false)}
				/>
			)}

			<main className="flex-1 px-6 py-6">
				{!pistas.length ? (
					<div className="flex h-80 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-white/15 text-white/50">
						<button
							type="button"
							onClick={() => setIaAbierta(true)}
							className="flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-white transition hover:brightness-110"
							style={{ background: 'var(--vawol-accion)' }}
						>
							<Sparkles size={16} /> Separar una canción con IA
						</button>
						<span className="text-xs text-white/30">o</span>
						<label className="flex cursor-pointer flex-col items-center gap-2 text-sm transition hover:text-white/70">
							<Upload size={22} />
							{cargando ? 'Importando…' : 'Subí un .zip ya separado o archivos de audio sueltos'}
							<input
								type="file"
								multiple
								accept=".zip,.wav,.mp3,.m4a,.ogg,.flac"
								className="hidden"
								onChange={(e) => manejarArchivos(e.target.files)}
							/>
						</label>
					</div>
				) : (
					<div className="flex flex-col gap-3">
						{pistas.map((p) => (
							<PistaUI
								key={p.id}
								ref={(el) => { pistaRefs.current[p.id] = el; }}
								pista={p}
								motor={motor}
								onCambio={refrescar}
								onEliminar={eliminarPista}
							/>
						))}
						<label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-3 text-sm text-white/40 transition hover:border-white/30 hover:text-white/70">
							<Upload size={14} /> Agregar más pistas
							<input
								type="file"
								multiple
								accept=".zip,.wav,.mp3,.m4a,.ogg,.flac"
								className="hidden"
								onChange={(e) => manejarArchivos(e.target.files)}
							/>
						</label>
					</div>
				)}
			</main>

			{!!pistas.length && (
				<footer className="sticky bottom-0 flex items-center justify-center gap-4 border-t border-white/10 bg-[var(--vawol-principal-hondo)]/95 px-6 py-4 backdrop-blur">
					<button
						type="button"
						onClick={detener}
						className="rounded-full p-2.5 text-white/60 transition hover:bg-white/10 hover:text-white"
					>
						<Square size={16} />
					</button>
					<button
						type="button"
						onClick={togglePlay}
						className="rounded-full p-3.5 text-white transition hover:brightness-110"
						style={{ background: 'var(--vawol-accion)' }}
					>
						{reproduciendo ? <Pause size={18} /> : <Play size={18} />}
					</button>
					<button
						type="button"
						onClick={toggleGrabar}
						className={`rounded-full p-2.5 transition ${grabando ? 'animate-pulse bg-red-500 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
						title="Grabar una pista nueva"
					>
						<Mic size={16} />
					</button>
					<span className="ml-2 font-mono text-sm text-white/50">
						{formatearTiempo(tiempo)} / {formatearTiempo(motor.duracionTotal)}
					</span>
					<span className="ml-4 flex items-center gap-2 text-white/50">
						<Gauge size={15} />
						<input
							type="range"
							min="0.5"
							max="2"
							step="0.05"
							value={velocidad}
							onChange={(e) => cambiarVelocidad(Number(e.target.value))}
							className="w-24 accent-[var(--vawol-accion)]"
							title="Velocidad de toda la mezcla"
						/>
						<span className="w-9 font-mono text-xs">{velocidad.toFixed(2)}x</span>
					</span>
				</footer>
			)}
		</div>
	);
}
