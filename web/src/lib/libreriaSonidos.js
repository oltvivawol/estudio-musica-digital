// Librería personal de sonidos/instrumentos, guardada en el propio navegador
// (IndexedDB) — cero backend, cero costo, cada quien tiene la suya en su
// dispositivo. Sirve para guardar instrumentos grabados o subidos al
// Sampler y reusarlos entre sesiones sin volver a grabar/cargar cada vez.
const DB_NOMBRE = 'vawol-estudio-libreria';
const DB_VERSION = 1;
const TIENDA = 'sonidos';

function abrirDB() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NOMBRE, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(TIENDA)) {
				db.createObjectStore(TIENDA, { keyPath: 'id', autoIncrement: true });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

/** Guarda un sonido (Blob de audio) con nombre + nota raíz (para el Sampler). */
export async function guardarSonido({ nombre, blob, notaRaiz = 60 }) {
	const db = await abrirDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(TIENDA, 'readwrite');
		const req = tx.objectStore(TIENDA).add({ nombre, blob, notaRaiz, creado: Date.now() });
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

/** Lista los sonidos guardados (sin el blob, para que sea liviano de mostrar). */
export async function listarSonidos() {
	const db = await abrirDB();
	return new Promise((resolve, reject) => {
		const req = db.transaction(TIENDA, 'readonly').objectStore(TIENDA).getAll();
		req.onsuccess = () => resolve(req.result.map(({ id, nombre, notaRaiz, creado }) => ({ id, nombre, notaRaiz, creado })));
		req.onerror = () => reject(req.error);
	});
}

/** Trae un sonido completo (con su blob) por id. */
export async function obtenerSonido(id) {
	const db = await abrirDB();
	return new Promise((resolve, reject) => {
		const req = db.transaction(TIENDA, 'readonly').objectStore(TIENDA).get(id);
		req.onsuccess = () => resolve(req.result || null);
		req.onerror = () => reject(req.error);
	});
}

export async function borrarSonido(id) {
	const db = await abrirDB();
	return new Promise((resolve, reject) => {
		const req = db.transaction(TIENDA, 'readwrite').objectStore(TIENDA).delete(id);
		req.onsuccess = () => resolve();
		req.onerror = () => reject(req.error);
	});
}
