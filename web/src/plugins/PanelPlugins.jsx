// Panel de plugins: cada uno emula una herramienta real de estudio/DJ.
// El código de cada plugin recién se descarga (chunk separado de Vite) cuando
// el usuario lo abre por primera vez — React.lazy() + Suspense hacen que el
// import() no se dispare hasta que el componente se monta de verdad. Así el
// Estudio no carga de entrada el peso de los 4 plugins, solo el que se use.
import { lazy, Suspense, useState } from 'react';
import { X, Piano, Drum, Clock3, SlidersHorizontal, Disc3, AudioLines } from 'lucide-react';

const Sintetizador = lazy(() => import('./Sintetizador.jsx'));
const TablaDrums = lazy(() => import('./TablaDrums.jsx'));
const Metronomo = lazy(() => import('./Metronomo.jsx'));
const Sampler = lazy(() => import('./Sampler.jsx'));

const CATALOGO = [
	{ id: 'sintetizador', nombre: 'Sintetizador + MIDI', icon: Piano, Componente: Sintetizador, disponible: true },
	{ id: 'sampler', nombre: 'Sampler (tu instrumento)', icon: AudioLines, Componente: Sampler, disponible: true },
	{ id: 'drums', nombre: 'Tabla de Drums', icon: Drum, Componente: TablaDrums, disponible: true },
	{ id: 'metronomo', nombre: 'Metrónomo', icon: Clock3, Componente: Metronomo, disponible: true },
	{ id: 'mixer', nombre: 'Mixer', icon: SlidersHorizontal, disponible: false },
	{ id: 'dj', nombre: 'Discos de DJ', icon: Disc3, disponible: false },
];

export default function PanelPlugins({ onCerrar, pluginInicial = null }) {
	const [abierto, setAbierto] = useState(pluginInicial);
	const plugin = CATALOGO.find((p) => p.id === abierto);

	return (
		<div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onCerrar}>
			<div
				className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-white/10 bg-[var(--vawol-principal-hondo)] p-6 sm:rounded-2xl"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="mb-5 flex items-center justify-between">
					<h2 className="text-base font-medium text-white">
						{plugin ? plugin.nombre : 'Plugins — herramientas de estudio'}
					</h2>
					<button type="button" onClick={plugin ? () => setAbierto(null) : onCerrar} className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white">
						<X size={18} />
					</button>
				</div>

				{plugin ? (
					<Suspense fallback={<p className="py-12 text-center text-sm text-white/40">Cargando {plugin.nombre}…</p>}>
						<plugin.Componente />
					</Suspense>
				) : (
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						{CATALOGO.map(({ id, nombre, icon: Icon, disponible }) => (
							<button
								key={id}
								type="button"
								disabled={!disponible}
								onClick={() => setAbierto(id)}
								className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-30"
							>
								<Icon size={26} style={{ color: 'var(--vawol-accion-claro)' }} />
								<span className="text-xs text-white/70">{nombre}</span>
								{!disponible && <span className="text-[10px] text-white/30">Próximamente</span>}
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
