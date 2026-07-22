// Sampler: grabá tu propia voz/instrumento (o subí un audio) y tocalo en
// cualquier tono con el teclado o un MIDI real — el mismo sonido, pitcheado
// por playbackRate según la distancia en semitonos a la nota raíz (la
// técnica clásica de sampler simple, sin time-stretch). Guarda instrumentos
// en tu Librería de Sonidos personal (IndexedDB, local, sin backend).
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Mic, Square, Upload, Save, Trash2 } from 'lucide-react';
import { obtenerContextoCompartido, decodificarArchivo } from '../lib/audioEngine.js';
import { guardarSonido, listarSonidos, obtenerSonido, borrarSonido } from '../lib/libreriaSonidos.js';
import { TECLAS, notaAFrecuencia } from './teclado.js';

export default function Sampler() {
	const ctx = obtenerContextoCompartido();
	const [buffer, setBuffer] = useState(null);
	const [nombre, setNombre] = useState('');
	const [notaRaiz, setNotaRaiz] = useState(60);
	const [grabando, setGrabando] = useState(false);
	const [biblioteca, setBiblioteca] = useState([]);
	const [notasActivas, setNotasActivas] = useState(new Set());
	const bufferRef = useRef(null);
	const notaRaizRef = useRef(60);
	const mediaRecorderRef = useRef(null);
	bufferRef.current = buffer;
	notaRaizRef.current = notaRaiz;

	const refrescarBiblioteca = () => listarSonidos().then(setBiblioteca);
	useEffect(() => { refrescarBiblioteca(); }, []);

	function reproducirNota(nota, velocidad = 1) {
		if (!bufferRef.current) return;
		const source = ctx.createBufferSource();
		source.buffer = bufferRef.current;
		source.playbackRate.value = 2 ** ((nota - notaRaizRef.current) / 12);
		const gain = ctx.createGain();
		gain.gain.value = velocidad;
		source.connect(gain).connect(ctx.destination);
		source.start();
		setNotasActivas((prev) => new Set(prev).add(nota));
		source.onended = () => setNotasActivas((prev) => { const n = new Set(prev); n.delete(nota); return n; });
	}

	async function grabar() {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mr = new MediaRecorder(stream);
			const trozos = [];
			mr.ondataavailable = (e) => trozos.push(e.data);
			mr.onstop = async () => {
				stream.getTracks().forEach((t) => t.stop());
				const blob = new Blob(trozos, { type: mr.mimeType });
				const nuevoBuffer = await decodificarArchivo(new File([blob], 'muestra.webm'));
				setBuffer(nuevoBuffer);
				setNombre(`Grabación ${new Date().toLocaleTimeString()}`);
				setGrabando(false);
				toast.success('Muestra grabada — tocala con el teclado o guardala en tu librería');
			};
			mediaRecorderRef.current = mr;
			mr.start();
			setGrabando(true);
		} catch {
			toast.error('No pude acceder al micrófono (¿diste permiso?)');
		}
	}

	function detenerGrabacion() {
		mediaRecorderRef.current?.stop();
	}

	async function cargarArchivo(archivo) {
		if (!archivo) return;
		try {
			const nuevoBuffer = await decodificarArchivo(archivo);
			setBuffer(nuevoBuffer);
			setNombre(archivo.name.replace(/\.[^.]+$/, ''));
		} catch {
			toast.error('No pude leer ese archivo de audio');
		}
	}

	async function guardarEnLibreria() {
		// Reconstituimos un Blob reproducible desde el AudioBuffer decodificado
		// (guardamos el propio buffer no sirve para IndexedDB de forma simple;
		// lo simple y robusto es no perder el blob original, así que grabamos
		// directo un WAV chico del buffer actual para persistirlo).
		const { audioBufferAWav } = await import('../lib/wavEncoder.js');
		const blob = audioBufferAWav(buffer);
		await guardarSonido({ nombre: nombre || 'Sin nombre', blob, notaRaiz });
		toast.success(`"${nombre || 'Sin nombre'}" guardado en tu librería`);
		refrescarBiblioteca();
	}

	async function cargarDeLibreria(id) {
		const sonido = await obtenerSonido(id);
		if (!sonido) return;
		const nuevoBuffer = await decodificarArchivo(new File([sonido.blob], 'sonido.wav'));
		setBuffer(nuevoBuffer);
		setNombre(sonido.nombre);
		setNotaRaiz(sonido.notaRaiz);
		toast.success(`"${sonido.nombre}" cargado`);
	}

	async function eliminarDeLibreria(id, e) {
		e.stopPropagation();
		await borrarSonido(id);
		refrescarBiblioteca();
	}

	// Teclado de la computadora
	useEffect(() => {
		const mapa = Object.fromEntries(TECLAS.map((t) => [t.tecla, t.nota]));
		const onDown = (e) => { if (mapa[e.key] != null && !e.repeat) reproducirNota(mapa[e.key]); };
		window.addEventListener('keydown', onDown);
		return () => window.removeEventListener('keydown', onDown);
	}, []);

	// MIDI real
	useEffect(() => {
		if (!navigator.requestMIDIAccess) return;
		let activo = true;
		navigator.requestMIDIAccess().then((acceso) => {
			if (!activo) return;
			for (const entrada of acceso.inputs.values()) {
				entrada.onmidimessage = ({ data }) => {
					const [status, nota, velocidad] = data;
					if ((status & 0xf0) === 0x90 && velocidad > 0) reproducirNota(nota, velocidad / 127);
				};
			}
		}).catch(() => {});
		return () => { activo = false; };
	}, []);

	return (
		<div className="flex flex-col gap-5">
			<div className="flex flex-wrap items-center gap-3">
				<button
					type="button"
					onClick={grabando ? detenerGrabacion : grabar}
					className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-white ${grabando ? 'animate-pulse bg-red-500' : ''}`}
					style={!grabando ? { background: 'var(--vawol-accion)' } : undefined}
				>
					{grabando ? <Square size={14} /> : <Mic size={14} />} {grabando ? 'Detener' : 'Grabar mi instrumento'}
				</button>
				<label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10">
					<Upload size={14} /> Subir audio
					<input type="file" accept="audio/*" className="hidden" onChange={(e) => cargarArchivo(e.target.files?.[0])} />
				</label>
				{buffer && (
					<button type="button" onClick={guardarEnLibreria} className="flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10">
						<Save size={14} /> Guardar en mi librería
					</button>
				)}
			</div>

			{buffer && (
				<div className="flex flex-wrap items-center gap-4 rounded-xl bg-white/[0.03] p-3 text-xs text-white/60">
					<input
						value={nombre}
						onChange={(e) => setNombre(e.target.value)}
						placeholder="Nombre del instrumento"
						className="rounded-md border border-white/15 bg-transparent px-2 py-1 text-white placeholder:text-white/25"
					/>
					<label className="flex items-center gap-2">
						Nota raíz (a qué tecla suena "normal")
						<select value={notaRaiz} onChange={(e) => setNotaRaiz(Number(e.target.value))} className="rounded-md border border-white/15 bg-transparent px-2 py-1 text-white">
							{TECLAS.map((t) => <option key={t.nota} value={t.nota}>{t.tecla.toUpperCase()}</option>)}
						</select>
					</label>
				</div>
			)}

			<div className="relative flex h-40 select-none">
				{TECLAS.map(({ nota, tecla, negra }) => (
					<button
						key={nota}
						type="button"
						disabled={!buffer}
						onMouseDown={() => reproducirNota(nota)}
						onTouchStart={(e) => { e.preventDefault(); reproducirNota(nota); }}
						className={
							negra
								? 'relative z-10 -mx-3 h-24 w-6 rounded-b-md border border-black/40 text-[9px] text-white/50 disabled:opacity-40'
								: 'flex h-full flex-1 items-end justify-center rounded-b-md border border-white/10 pb-1 text-[10px] text-white/40 disabled:opacity-40'
						}
						style={{ background: notasActivas.has(nota) ? 'var(--vawol-accion)' : negra ? '#1a1720' : '#eef1f4' }}
					>
						<span className={negra ? '' : 'text-black/50'}>{tecla}</span>
					</button>
				))}
			</div>
			{!buffer && <p className="text-center text-xs text-white/30">Grabá o subí un sonido para poder tocarlo</p>}

			{biblioteca.length > 0 && (
				<div>
					<p className="mb-2 text-xs text-white/40">Tu librería de sonidos</p>
					<div className="flex flex-col gap-1">
						{biblioteca.map((s) => (
							<button
								key={s.id}
								type="button"
								onClick={() => cargarDeLibreria(s.id)}
								className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-left text-xs text-white/70 hover:bg-white/[0.06]"
							>
								<span>{s.nombre}</span>
								<Trash2 size={13} className="text-white/30 hover:text-red-400" onClick={(e) => eliminarDeLibreria(s.id, e)} />
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
