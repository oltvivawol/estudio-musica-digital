// Estado global de la sesión VAWOL (el único contexto de la app). Los
// componentes leen `usuario` y llaman ingresar/registrarse/salir; la
// persistencia real vive en lib/vawolId.js (localStorage).
import { createContext, useContext, useState } from 'react';
import { sesionActual, ingresarVawol, registrarseVawol, salirVawol } from '../lib/vawolId.js';

const Ctx = createContext(null);

export function AuthVawolProvider({ children }) {
	const [usuario, setUsuario] = useState(() => sesionActual()?.record || null);

	async function ingresar(email, password) {
		const record = await ingresarVawol(email, password);
		setUsuario(record);
		return record;
	}

	async function registrarse(nombre, email, password) {
		const record = await registrarseVawol(nombre, email, password);
		setUsuario(record);
		return record;
	}

	function salir() {
		salirVawol();
		setUsuario(null);
	}

	return <Ctx.Provider value={{ usuario, ingresar, registrarse, salir }}>{children}</Ctx.Provider>;
}

export function useVawol() {
	return useContext(Ctx);
}
