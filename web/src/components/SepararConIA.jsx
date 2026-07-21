// Conecta directo con el notebook de Colab en modo servidor (ver
// colab/separar_instrumentos.ipynb, sección B) — sube la canción a la URL
// del túnel, recibe el .zip de instrumentos ya separados, y lo importa al
// Estudio sin que el usuario tenga que bajar/subir nada a mano.
import { useState } from 'react';
import { toast } from 'sonner';
import { X, Sparkles } from 'lucide-react';
import { importarArchivos } from '../lib/importarStems.js';

const CLAVE_URL_GUARDADA = 'vawol-estudio-url-colab';

export default function SepararConIA({ onListo, onCerrar, urlInicial }) {
	const [url, setUrl] = useState(() => urlInicial || localStorage.getItem(CLAVE_URL_GUARDADA) || '');
	const [modelo, setModelo] = useState('htdemucs_6s');
	const [archivo, setArchivo] = useState(null);
	const [procesando, setProcesando] = useState(false);

	async function separar() {
		if (!url || !archivo) return;
		localStorage.setItem(CLAVE_URL_GUARDADA, url);
		setProcesando(true);
		try {
			const form = new FormData();
			form.append('archivo', archivo);
			form.append('modelo', modelo);
			const resp = await fetch(`${url.replace(/\/$/, '')}/separar`, { method: 'POST', body: form });
			if (!resp.ok) throw new Error(`El servidor de Colab respondió ${resp.status}`);
			const blob = await resp.blob();
			const stems = await importarArchivos([new File([blob], 'instrumentos.zip')]);
			if (!stems.length) throw new Error('La respuesta no tenía audio reconocible');
			onListo(stems);
			toast.success(`${stems.length} pista(s) separada(s) con IA`);
		} catch (e) {
			toast.error(`No pude separar: ${e.message}. ¿Sigue corriendo esa sesión de Colab?`);
		} finally {
			setProcesando(false);
		}
	}

	return (
		<div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCerrar}>
			<div className="w-full max-w-md rounded-2xl border border-white/10 bg-[var(--vawol-principal-hondo)] p-6" onClick={(e) => e.stopPropagation()}>
				<div className="mb-4 flex items-center justify-between">
					<h2 className="flex items-center gap-2 text-base font-medium text-white">
						<Sparkles size={16} style={{ color: 'var(--vawol-accion-claro)' }} /> Separar con IA
					</h2>
					<button type="button" onClick={onCerrar} className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white">
						<X size={18} />
					</button>
				</div>

				<p className="mb-4 text-xs text-white/50">
					Necesitás tener corriendo la sección "B) Servidor vivo" del notebook de Colab
					(<code className="text-white/70">separar_instrumentos.ipynb</code>) — te da una URL
					pública. Pegala acá una vez y queda guardada para la próxima.
				</p>

				<div className="flex flex-col gap-3">
					<label className="flex flex-col gap-1 text-xs text-white/60">
						URL del servidor de Colab
						<input
							type="url"
							placeholder="https://algo-random.trycloudflare.com"
							value={url}
							onChange={(e) => setUrl(e.target.value)}
							className="rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/25"
						/>
					</label>

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
						onClick={separar}
						disabled={!url || !archivo || procesando}
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
