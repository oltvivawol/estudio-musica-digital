import { Link } from 'react-router-dom';
import { Music2, Mic2, Scissors, Download } from 'lucide-react';

const INSTRUMENTOS = [
	{ nombre: 'Voz', color: 'var(--pista-voz)' },
	{ nombre: 'Batería', color: 'var(--pista-bateria)' },
	{ nombre: 'Bajo', color: 'var(--pista-bajo)' },
	{ nombre: 'Piano', color: 'var(--pista-piano)' },
	{ nombre: 'Guitarra', color: 'var(--pista-guitarra)' },
	{ nombre: 'Otros', color: 'var(--pista-otros)' },
];

const PASOS = [
	{ icon: Music2, titulo: 'La IA separa', texto: 'Subís una canción y la separamos en cada instrumento: voz, batería, bajo, piano, guitarra.' },
	{ icon: Mic2, titulo: 'Grabás encima', texto: 'Tocá en vivo (por ejemplo un piano) mientras suenan las demás pistas de fondo.' },
	{ icon: Scissors, titulo: 'Editás cada pista', texto: 'Recortá, ajustá el volumen, muteá o soleá cualquier instrumento por separado.' },
	{ icon: Download, titulo: 'Exportás tu mezcla', texto: 'Descargá el resultado final, listo para compartir.' },
];

export default function LandingPage() {
	return (
		<div className="min-h-screen flex flex-col">
			<header className="flex items-center justify-between px-6 py-5 md:px-12">
				<span className="text-sm tracking-widest text-white/50 uppercase">VAWOL · Arte</span>
				<Link
					to="/estudio"
					className="rounded-full px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
					style={{ background: 'var(--vawol-accion)' }}
				>
					Abrir el Estudio
				</Link>
			</header>

			<main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center md:px-12">
				<div className="flex items-center gap-1.5 mb-8" aria-hidden="true">
					{INSTRUMENTOS.map((i) => (
						<span
							key={i.nombre}
							className="h-10 w-1.5 rounded-full opacity-80"
							style={{ background: i.color }}
						/>
					))}
				</div>

				<h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
					Estudio de Música Digital
				</h1>
				<p className="mt-5 max-w-xl text-lg text-white/60">
					Separá cualquier canción en sus instrumentos con IA, grabá encima,
					editá cada pista y llevate tu propia mezcla. Sin instalar nada.
				</p>

				<Link
					to="/estudio"
					className="mt-10 rounded-full px-8 py-3.5 text-base font-medium text-white shadow-lg transition hover:scale-105"
					style={{ background: 'var(--vawol-accion)' }}
				>
					Abrir el Estudio →
				</Link>

				<div className="mt-24 grid w-full max-w-5xl grid-cols-1 gap-6 text-left sm:grid-cols-2 lg:grid-cols-4">
					{PASOS.map(({ icon: Icon, titulo, texto }) => (
						<div
							key={titulo}
							className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
						>
							<Icon className="mb-4 h-6 w-6" style={{ color: 'var(--vawol-accion-claro)' }} />
							<h2 className="mb-2 text-base font-medium text-white">{titulo}</h2>
							<p className="text-sm leading-relaxed text-white/50">{texto}</p>
						</div>
					))}
				</div>
			</main>

			<footer className="px-6 py-6 text-center text-xs text-white/30 md:px-12">
				Parte del ecosistema VAWOL — arte.vawol.com
			</footer>
		</div>
	);
}
