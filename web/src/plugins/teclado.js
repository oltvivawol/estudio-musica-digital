// Layout del teclado on-screen (una octava y media) + utilidad de notas,
// compartido entre Sintetizador y Sampler para no duplicarlo.
export const TECLAS = [
	{ nota: 60, tecla: 'a', negra: false }, { nota: 61, tecla: 'w', negra: true },
	{ nota: 62, tecla: 's', negra: false }, { nota: 63, tecla: 'e', negra: true },
	{ nota: 64, tecla: 'd', negra: false },
	{ nota: 65, tecla: 'f', negra: false }, { nota: 66, tecla: 't', negra: true },
	{ nota: 67, tecla: 'g', negra: false }, { nota: 68, tecla: 'y', negra: true },
	{ nota: 69, tecla: 'h', negra: false }, { nota: 70, tecla: 'u', negra: true },
	{ nota: 71, tecla: 'j', negra: false },
	{ nota: 72, tecla: 'k', negra: false },
];

export function notaAFrecuencia(nota) {
	return 440 * 2 ** ((nota - 69) / 12);
}
