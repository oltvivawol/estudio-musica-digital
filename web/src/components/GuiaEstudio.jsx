// Guía rápida del Estudio: qué se puede hacer hoy y cómo. Mismo patrón visual
// que PanelPlugins.jsx (modal con overlay), para no meter una librería nueva.
import { X, Mic, Sparkles, Blocks, Gauge, Download, MessageCircle } from 'lucide-react';

const SECCIONES = [
	{
		icon: Sparkles,
		titulo: 'Separar una canción con IA',
		texto:
			'Pegá el link de tu Colab (el que imprime la celda "Servidor vivo" del notebook separador) o subí un .zip ya separado. Mientras el Colab esté corriendo, separa voz/batería/bajo/etc. en vivo, sin pasos manuales.',
	},
	{
		icon: Mic,
		titulo: 'Grabar y editar pistas',
		texto:
			'Grabá tu voz o instrumento por encima de las pistas ya cargadas (quedan sincronizadas entre sí). Cada pista se puede mutear, solear, subir/bajar de volumen y recortar desde su propio panel.',
	},
	{
		icon: Blocks,
		titulo: 'Plugins',
		texto:
			'Sintetizador + MIDI (tocá con teclado real o el de la compu), Sampler (grabá o subí tu propio instrumento, guardalo en tu librería personal y tocalo en cualquier tono), Tabla de Drums (secuenciador de 16 pasos) y Metrónomo. Mixer y Discos de DJ están en camino.',
	},
	{
		icon: Gauge,
		titulo: 'Velocidad global',
		texto: 'El control de velocidad cambia el tempo de toda la mezcla junta, sin perder la sincronización entre pistas.',
	},
	{
		icon: Download,
		titulo: 'Exportar',
		texto: 'Bajá la mezcla final como un .wav con todo lo que armaste.',
	},
	{
		icon: MessageCircle,
		titulo: 'El agente (el chat)',
		texto:
			'No es solo un chat: le podés pedir que mutee/solee/cambie volumen o velocidad, que abra un plugin o el separador, y lo hace de verdad sobre tu sesión. Además sabe de teoría musical, ritmos y tradiciones de distintas culturas y épocas, y de por qué el ritmo y la armonía nos mueven — para acompañarte a producir, no solo para operar botones.',
	},
];

export default function GuiaEstudio({ onCerrar }) {
	return (
		<div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onCerrar}>
			<div
				className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-white/10 bg-[var(--vawol-principal-hondo)] p-6 sm:rounded-2xl"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="mb-5 flex items-center justify-between">
					<h2 className="text-base font-medium text-white">Guía del Estudio</h2>
					<button type="button" onClick={onCerrar} className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white">
						<X size={18} />
					</button>
				</div>

				<div className="flex flex-col gap-4">
					{SECCIONES.map(({ icon: Icon, titulo, texto }) => (
						<div key={titulo} className="flex gap-3 rounded-xl bg-white/[0.03] p-4">
							<Icon size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--vawol-accion-claro)' }} />
							<div>
								<p className="text-sm font-medium text-white/90">{titulo}</p>
								<p className="mt-1 text-xs leading-relaxed text-white/60">{texto}</p>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
