import JSZip from 'jszip';
import { decodificarArchivo } from './audioEngine.js';

// Nombres que produce Demucs (htdemucs_6s / htdemucs_ft) - reconocidos sin
// importar mayusculas ni la carpeta de origen.
const RECONOCIDOS = [
	{ match: /vocals?/i, nombre: 'Voz', color: 'var(--pista-voz)' },
	{ match: /drums?/i, nombre: 'Batería', color: 'var(--pista-bateria)' },
	{ match: /bass/i, nombre: 'Bajo', color: 'var(--pista-bajo)' },
	{ match: /piano/i, nombre: 'Piano', color: 'var(--pista-piano)' },
	{ match: /guitar/i, nombre: 'Guitarra', color: 'var(--pista-guitarra)' },
	{ match: /other/i, nombre: 'Otros', color: 'var(--pista-otros)' },
];

function identificar(nombreArchivo, indice) {
	const reconocido = RECONOCIDOS.find((r) => r.match.test(nombreArchivo));
	if (reconocido) return reconocido;
	return { nombre: nombreArchivo.replace(/\.[^.]+$/, ''), color: 'var(--pista-otros)' };
}

const EXTENSIONES_AUDIO = /\.(wav|mp3|m4a|ogg|flac|aac)$/i;

/** Recibe un FileList/array de File (zip o audios sueltos) y devuelve
 * [{ nombre, color, buffer }] listos para crear Pista. */
export async function importarArchivos(archivos) {
	const resultado = [];
	for (const archivo of archivos) {
		if (/\.zip$/i.test(archivo.name)) {
			const zip = await JSZip.loadAsync(archivo);
			const entradas = Object.values(zip.files).filter(
				(f) => !f.dir && EXTENSIONES_AUDIO.test(f.name),
			);
			for (const [i, entrada] of entradas.entries()) {
				const blob = await entrada.async('blob');
				const archivoAudio = new File([blob], entrada.name);
				const buffer = await decodificarArchivo(archivoAudio);
				const { nombre, color } = identificar(entrada.name, i);
				resultado.push({ nombre, color, buffer });
			}
		} else if (EXTENSIONES_AUDIO.test(archivo.name)) {
			const buffer = await decodificarArchivo(archivo);
			const { nombre, color } = identificar(archivo.name, resultado.length);
			resultado.push({ nombre, color, buffer });
		}
	}
	return resultado;
}
