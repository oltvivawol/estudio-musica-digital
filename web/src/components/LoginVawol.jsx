// Modal de ingreso/registro con la cuenta VAWOL (una sola cuenta para todo
// el ecosistema). Registrarse regala una separación con la GPU de VAWOL.
import { useState } from 'react';
import { toast } from 'sonner';
import { X, UserRound } from 'lucide-react';
import { useVawol } from '../context/AuthVawol.jsx';

export default function LoginVawol({ onCerrar, onListo }) {
	const { ingresar, registrarse } = useVawol();
	const [modo, setModo] = useState('ingresar'); // ingresar | registrarse
	const [nombre, setNombre] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [enviando, setEnviando] = useState(false);
	const [error, setError] = useState('');

	async function enviar(e) {
		e.preventDefault();
		if (enviando) return;
		setError('');
		setEnviando(true);
		try {
			if (modo === 'registrarse') {
				await registrarse(nombre.trim() || email.split('@')[0], email.trim(), password);
				toast.success('¡Cuenta VAWOL creada! Tenés 1 separación con GPU de regalo 🎁');
			} else {
				await ingresar(email.trim(), password);
				toast.success('Sesión iniciada');
			}
			onListo?.();
			onCerrar();
		} catch (err) {
			setError(err.message);
		} finally {
			setEnviando(false);
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCerrar}>
			<div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[var(--vawol-principal-hondo)] p-6" onClick={(e) => e.stopPropagation()}>
				<div className="mb-4 flex items-center justify-between">
					<h2 className="flex items-center gap-2 text-base font-medium text-white">
						<UserRound size={16} style={{ color: 'var(--vawol-accion-claro)' }} /> Cuenta VAWOL
					</h2>
					<button type="button" onClick={onCerrar} className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white">
						<X size={18} />
					</button>
				</div>

				<div className="mb-4 flex rounded-full border border-white/10 p-0.5 text-xs">
					{[['ingresar', 'Ingresar'], ['registrarse', 'Crear cuenta']].map(([id, etiqueta]) => (
						<button
							key={id}
							type="button"
							onClick={() => { setModo(id); setError(''); }}
							className={`flex-1 rounded-full px-3 py-1.5 font-medium transition ${modo === id ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
							style={modo === id ? { background: 'var(--vawol-accion)' } : undefined}
						>
							{etiqueta}
						</button>
					))}
				</div>

				{modo === 'registrarse' && (
					<p className="mb-4 text-xs leading-relaxed text-white/50">
						Una sola cuenta para todo VAWOL. Al crearla te regalamos{' '}
						<span className="text-white/80">1 separación de canción con nuestra GPU</span>.
					</p>
				)}

				<form onSubmit={enviar} className="flex flex-col gap-3">
					{modo === 'registrarse' && (
						<input
							value={nombre}
							onChange={(e) => setNombre(e.target.value)}
							placeholder="Tu nombre"
							className="rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/25"
						/>
					)}
					<input
						type="email"
						required
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="Email"
						className="rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/25"
					/>
					<input
						type="password"
						required
						minLength={8}
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder={modo === 'registrarse' ? 'Contraseña (mínimo 8 caracteres)' : 'Contraseña'}
						className="rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/25"
					/>
					{error && <p className="text-xs text-red-400">{error}</p>}
					<button
						type="submit"
						disabled={enviando || !email || !password}
						className="mt-1 rounded-full px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-30"
						style={{ background: 'var(--vawol-accion)' }}
					>
						{enviando ? 'Un momento…' : modo === 'registrarse' ? 'Crear mi cuenta VAWOL' : 'Ingresar'}
					</button>
				</form>
			</div>
		</div>
	);
}
