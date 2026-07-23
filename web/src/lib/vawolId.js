// Cuenta VAWOL única para todo el ecosistema: el login habla directo con el
// PocketBase de app.vawol.com, así que la misma cuenta sirve acá, en la app
// y en cualquier subdominio futuro. La sesión queda en localStorage y se
// manda a la API como Bearer base64({token, record}) — el mismo formato que
// verifica el middleware pocketbase-auth del backend.
const PLATAFORMA = 'https://app.vawol.com/hcgi/platform';
const API = 'https://app.vawol.com/hcgi/api';
const CLAVE = 'vawol_auth';

export function sesionActual() {
	try {
		return JSON.parse(localStorage.getItem(CLAVE)) || null;
	} catch {
		return null;
	}
}

export function salirVawol() {
	localStorage.removeItem(CLAVE);
}

// btoa directo explota con caracteres fuera de Latin-1 (nombres con tildes ya
// zafan, pero un emoji no) — esta variante codifica UTF-8 de verdad.
function aBase64(texto) {
	return btoa(String.fromCharCode(...new TextEncoder().encode(texto)));
}

export function encabezadoAuth() {
	const sesion = sesionActual();
	if (!sesion) return {};
	return { Authorization: `Bearer ${aBase64(JSON.stringify(sesion))}` };
}

export async function ingresarVawol(email, password) {
	const r = await fetch(`${PLATAFORMA}/api/collections/users/auth-with-password`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ identity: email, password }),
	});
	const d = await r.json();
	if (!r.ok) throw new Error(d?.message || 'Email o contraseña incorrectos');
	localStorage.setItem(CLAVE, JSON.stringify({ token: d.token, record: d.record }));
	return d.record;
}

export async function registrarseVawol(nombre, email, password) {
	const r = await fetch(`${PLATAFORMA}/api/collections/users/records`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name: nombre, email, password, passwordConfirm: password }),
	});
	const d = await r.json();
	if (!r.ok) {
		const detalle = Object.values(d?.data || {})[0]?.message;
		throw new Error(detalle || d?.message || 'No pude crear la cuenta');
	}
	return ingresarVawol(email, password);
}

// --- API del Estudio (requiere sesión) ---

export async function cuentaEstudio() {
	const r = await fetch(`${API}/estudio/cuenta`, { headers: encabezadoAuth() });
	const d = await r.json();
	if (!r.ok) { const e = new Error(d?.message || d?.error || `HTTP ${r.status}`); e.status = r.status; throw e; }
	return d;
}

export async function linkPase() {
	const r = await fetch(`${API}/estudio/pase/preference`, { method: 'POST', headers: encabezadoAuth() });
	const d = await r.json();
	if (!r.ok) { const e = new Error(d?.message || d?.error || `HTTP ${r.status}`); e.status = r.status; throw e; }
	return d; // { id, init_point, precio }
}

export async function separarConGPU(archivo, modelo) {
	const form = new FormData();
	form.append('archivo', archivo);
	form.append('modelo', modelo);
	const r = await fetch(`${API}/estudio/separar`, { method: 'POST', headers: encabezadoAuth(), body: form });
	if (!r.ok) {
		let d = {};
		try { d = await r.json(); } catch { /* respuesta sin json */ }
		const e = new Error(d?.message || d?.error || `HTTP ${r.status}`);
		e.status = r.status;
		e.precio = d?.precio;
		throw e;
	}
	return r.blob(); // el .zip de instrumentos
}
