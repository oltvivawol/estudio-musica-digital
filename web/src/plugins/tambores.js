// Sonidos de batería sintetizados con Web Audio API (sin archivos de audio
// que descargar/pesar) — misma técnica clásica de las cajas de ritmo tipo
// TR-808: osciladores con pitch-drop para el bombo, ruido filtrado para
// platillos/redoblante/clap.

let bufferRuido = null;
function obtenerRuido(ctx) {
	if (!bufferRuido || bufferRuido.sampleRate !== ctx.sampleRate) {
		const duracion = 1; // 1s de ruido blanco, se reusa recortado según el sonido
		bufferRuido = ctx.createBuffer(1, ctx.sampleRate * duracion, ctx.sampleRate);
		const datos = bufferRuido.getChannelData(0);
		for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
	}
	return bufferRuido;
}

function fuenteRuido(ctx) {
	const fuente = ctx.createBufferSource();
	fuente.buffer = obtenerRuido(ctx);
	return fuente;
}

export function bombo(ctx, destino, t) {
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = 'sine';
	osc.frequency.setValueAtTime(150, t);
	osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
	gain.gain.setValueAtTime(1, t);
	gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
	osc.connect(gain).connect(destino);
	osc.start(t);
	osc.stop(t + 0.4);
}

export function redoblante(ctx, destino, t) {
	const ruido = fuenteRuido(ctx);
	const pasaBanda = ctx.createBiquadFilter();
	pasaBanda.type = 'bandpass';
	pasaBanda.frequency.value = 1800;
	const gainRuido = ctx.createGain();
	gainRuido.gain.setValueAtTime(0.8, t);
	gainRuido.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
	ruido.connect(pasaBanda).connect(gainRuido).connect(destino);
	ruido.start(t);
	ruido.stop(t + 0.2);

	const osc = ctx.createOscillator();
	const gainOsc = ctx.createGain();
	osc.type = 'triangle';
	osc.frequency.value = 180;
	gainOsc.gain.setValueAtTime(0.6, t);
	gainOsc.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
	osc.connect(gainOsc).connect(destino);
	osc.start(t);
	osc.stop(t + 0.15);
}

function hiHat(ctx, destino, t, abierto) {
	const ruido = fuenteRuido(ctx);
	const pasaAlto = ctx.createBiquadFilter();
	pasaAlto.type = 'highpass';
	pasaAlto.frequency.value = 7000;
	const gain = ctx.createGain();
	const duracion = abierto ? 0.3 : 0.05;
	gain.gain.setValueAtTime(0.5, t);
	gain.gain.exponentialRampToValueAtTime(0.01, t + duracion);
	ruido.connect(pasaAlto).connect(gain).connect(destino);
	ruido.start(t);
	ruido.stop(t + duracion + 0.02);
}
export const hihatCerrado = (ctx, destino, t) => hiHat(ctx, destino, t, false);
export const hihatAbierto = (ctx, destino, t) => hiHat(ctx, destino, t, true);

export function clap(ctx, destino, t) {
	// tres ráfagas cortas de ruido casi simultáneas simulan el "flam" de un clap
	for (const retraso of [0, 0.01, 0.02]) {
		const ruido = fuenteRuido(ctx);
		const pasaBanda = ctx.createBiquadFilter();
		pasaBanda.type = 'bandpass';
		pasaBanda.frequency.value = 1500;
		const gain = ctx.createGain();
		const inicio = t + retraso;
		gain.gain.setValueAtTime(0.6, inicio);
		gain.gain.exponentialRampToValueAtTime(0.01, inicio + 0.08);
		ruido.connect(pasaBanda).connect(gain).connect(destino);
		ruido.start(inicio);
		ruido.stop(inicio + 0.1);
	}
}

export function tom(ctx, destino, t) {
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = 'sine';
	osc.frequency.setValueAtTime(220, t);
	osc.frequency.exponentialRampToValueAtTime(90, t + 0.18);
	gain.gain.setValueAtTime(0.8, t);
	gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
	osc.connect(gain).connect(destino);
	osc.start(t);
	osc.stop(t + 0.3);
}

export const SONIDOS = [
	{ id: 'bombo', nombre: 'Bombo', fn: bombo },
	{ id: 'redoblante', nombre: 'Redoblante', fn: redoblante },
	{ id: 'hihatCerrado', nombre: 'Hi-hat cerrado', fn: hihatCerrado },
	{ id: 'hihatAbierto', nombre: 'Hi-hat abierto', fn: hihatAbierto },
	{ id: 'clap', nombre: 'Palmas', fn: clap },
	{ id: 'tom', nombre: 'Tom', fn: tom },
];
