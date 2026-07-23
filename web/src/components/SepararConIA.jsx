// Separar una canción en instrumentos, de dos maneras:
// - GPU de VAWOL (principal): nuestra GPU en la nube, sin Colab ni túneles.
//   Requiere cuenta VAWOL; la primera separación es de regalo y después se
//   usa el pase de 30 días (MercadoPago).
// - Colab manual (gratis): el notebook en modo servidor de siempre — corre
//   en TU sesión de Colab y el sitio le pega a la URL del túnel.
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { X, Sparkles, Zap, FlaskConical } from 'lucide-react';
import { importarArchivos } from '../lib/importarStems.js';
import { useVawol } from '../context/AuthVawol.jsx';
import { cuentaEstudio, linkPase, separarConGPU } from '../lib/vawolId.js';
import LoginVawol from './LoginVawol.jsx';

const CLAVE_URL_GUARDADA = 'vawol-estudio-url-colab';

export default function SepararConIA({ onListo, onCerrar, urlInicial }) {
	const { usuario } = useVawol();
	const [modo, setModo] = useState(urlInicial ? 'colab' : 'gpu'); // si el agente pasó URL de Colab, arrancamos ahí
	const [loginAbierto, setLoginAbierto] = useState(false);
	const [cuenta, setCuenta] = useState(null); // { trialDisponible, paseActivo, paseVence, precio, creador }
	const [url, setUrl] = useState(() => urlInicial || localStorage.getItem(CLAVE_URL_GUARDADA) || '');
	const [modelo, setModelo] = useState('htdemucs_6s');
	const [archivo, setArchivo] = useState(null);
	const [procesando, setProcesando] = useState(false);
	const [comprando, setComprando] = useState(false);

	useEffect(() => {
		if (!usuario) { setCuenta(null); return; }
		cuentaEstudio().then(setCuenta).catch(() => setCuenta(null));
	}, [usuario]);

	const puedeUsarGPU = cuenta && (cuenta.paseActivo || cuenta.trialDisponible);

	async function importarZip(blob) {
		const stems = await importarArchivos([new File([blob], 'instrumentos.zip')]);
		if (!stems.length) throw new Error('La respuesta no tenía audio reconocible');
		onListo(stems);
		toast.success(`${stems.length} pista(s) separada(s) con IA`);
	}

	async function separarGPU() {
		if (!archivo) return;
		setProcesando(true);
		try {
			const blob = await separarConGPU(archivo, modelo);
			await importarZip(blob);
			// Refresca el estado (si usó el trial, ya no lo tiene disponible)
			cuentaEstudio().then(setCuenta).catch(() => {});
		} catch (e) {
			if (e.status === 402) {
				toast.error('Tu prueba gratis ya fue usada — comprá el pase para seguir con la GPU.');
				cuentaEstudio().then(setCuenta).catch(() => {});
			} else if (e.status === 401) {
				setLoginAbierto(true);
			} else {
				toast.error(`No pude separar: ${e.message}`);
			}
		} finally {
			setProcesando(false);
		}
	}

	async function comprarPase() {
		setComprando(true);
		try {
			const { init_point } = await linkPase();
			window.location.href = init_point; // MercadoPago nos trae de vuelta a /estudio?pago=...
		} catch (e) {
			toast.error(`No pude armar el pago: ${e.message}`);
			setComprando(false);
		}
	}

	async function separarColab() {
		if (!url || !archivo) return;
		localStorage.setItem(CLAVE_URL_GUARDADA, url);
		setProcesando(true);
		try {
			const form = new FormData();
			form.append('archivo', archivo);
			form.append('modelo', modelo);
			const resp = await fetch(`${url.replace(/\/$/, '')}/separar`, { method: 'POST', body: form });
			if (!resp.ok) throw new Error(`El servidor de Colab respondió ${resp.status}`);
			await importarZip(await resp.blob());
		} catch (e) {
			toast.error(`No pude separar: ${e.message}. ¿Sigue corriendo esa sesión de Colab?`);
		} finally {
			setProcesando(false);
		}
	}

	function fechaCorta(iso) {
		try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
	}

	return (
		<div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCerrar}>
			{loginAbierto && <LoginVawol onCerrar={() => setLoginAbierto(false)} />}
			<div className="w-full max-w-md rounded-2xl border border-white/10 bg-[var(--vawol-principal-hondo)] p-6" onClick={(e) => e.stopPropagation()}>
				<div className="mb-4 flex items-center justify-between">
					<h2 className="flex items-center gap-2 text-base font-medium text-white">
						<Sparkles size={16} style={{ color: 'var(--vawol-accion-claro)' }} /> Separar con IA
					</h2>
					<button type="button" onClick={onCerrar} className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white">
						<X size={18} />
					</button>
				</div>

				<div className="mb-4 flex rounded-full border border-white/10 p-0.5 text-xs">
					{[['gpu', 'GPU de VAWOL', Zap], ['colab', 'Colab manual (gratis)', FlaskConical]].map(([id, etiqueta, Icon]) => (
						<button
							key={id}
							type="button"
							onClick={() => setModo(id)}
							className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition ${modo === id ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
							style={modo === id ? { background: 'var(--vawol-accion)' } : undefined}
						>
							<Icon size={12} /> {etiqueta}
						</button>
					))}
				</div>

				{modo === 'gpu' && !usuario && (
					<div className="mb-4 flex flex-col items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-6 text-center">
						<p className="text-xs leading-relaxed text-white/60">
							La GPU de VAWOL separa tu canción en la nube, sin Colab ni túneles.
							Con tu cuenta VAWOL (gratis) tenés <span className="text-white/90">1 separación de regalo</span>.
						</p>
						<button
							type="button"
							onClick={() => setLoginAbierto(true)}
							className="rounded-full px-5 py-2 text-xs font-medium text-white"
							style={{ background: 'var(--vawol-accion)' }}
						>
							Ingresar o crear cuenta
						</button>
					</div>
				)}

				{modo === 'gpu' && usuario && cuenta && (
					<div className="mb-4 rounded-xl bg-white/[0.03] px-4 py-3 text-xs text-white/60">
						{cuenta.creador ? (
							<span>👑 Acceso total (sos el Creador de la plataforma)</span>
						) : cuenta.paseActivo ? (
							<span>✅ Pase activo hasta el {fechaCorta(cuenta.paseVence)}</span>
						) : cuenta.trialDisponible ? (
							<span>🎁 Tenés 1 separación de regalo — probala con la canción que quieras</span>
						) : (
							<div className="flex flex-col gap-2">
								<span>Tu prueba gratis ya fue usada. El pase de 30 días te da separaciones sin límite.</span>
								<button
									type="button"
									onClick={comprarPase}
									disabled={comprando}
									className="self-start rounded-full px-4 py-1.5 font-medium text-white disabled:opacity-40"
									style={{ background: 'var(--vawol-accion)' }}
								>
									{comprando ? 'Armando el pago…' : `Comprar pase — $${Number(cuenta.precio).toLocaleString('es-AR')}`}
								</button>
							</div>
						)}
					</div>
				)}

				{modo === 'colab' && (
					<>
						<p className="mb-4 text-xs text-white/50">
							Necesitás tener corriendo la sección "B) Servidor vivo" del notebook de Colab
							(<code className="text-white/70">separar_instrumentos.ipynb</code>) — te da una URL
							pública. Pegala acá una vez y queda guardada para la próxima.
						</p>
						<label className="mb-3 flex flex-col gap-1 text-xs text-white/60">
							URL del servidor de Colab
							<input
								type="url"
								placeholder="https://algo-random.trycloudflare.com"
								value={url}
								onChange={(e) => setUrl(e.target.value)}
								className="rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/25"
							/>
						</label>
					</>
				)}

				<div className="flex flex-col gap-3">
					<label className="flex flex-col gap-1 text-xs text-white/60">
						Modelo
						<select value={modelo} onChange={(e) => setModelo(e.target.value)} className="rounded-md border border-white/15 bg-transparent px-2 py-1.5 text-white">
							<option value="htdemucs_6s">htdemucs_6s — con piano y guitarra separados</option>
							<option value="htdemucs_ft">htdemucs_ft — mejor calidad, 4 pistas</option>
						</select>
					</label>

					<label className="flex flex-col gap-1 text-xs text-white/60">
						Canción
						<input
							type="file"
							accept="audio/*"
							onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
							className="text-xs text-white/70"
						/>
					</label>

					<button
						type="button"
						onClick={modo === 'gpu' ? separarGPU : separarColab}
						disabled={procesando || !archivo || (modo === 'colab' ? !url : (!usuario || !puedeUsarGPU))}
						className="mt-2 rounded-full px-4 py-2.5 text-sm font-medium text-white disabled:opacity-30"
						style={{ background: 'var(--vawol-accion)' }}
					>
						{procesando ? 'Separando (puede tardar 1-3 min)…' : 'Separar instrumentos'}
					</button>
				</div>
			</div>
		</div>
	);
}
