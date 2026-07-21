// Motor de audio del Estudio: reproduccion multipista sincronizada al sample,
// mute/solo/volumen, velocidad global y render offline para exportar. Usa Web
// Audio API directo (no delega la reproduccion a wavesurfer) porque los
// AudioBufferSourceNode de una misma llamada a start() arrancan todos en el
// mismo instante exacto del reloj del AudioContext - es la unica forma de que
// las pistas no se desfasen.

let sharedContext = null;
function getContext() {
	if (!sharedContext) sharedContext = new (window.AudioContext || window.webkitAudioContext)();
	return sharedContext;
}

export class Pista {
	constructor({ id, nombre, color, buffer }) {
		this.id = id;
		this.nombre = nombre;
		this.color = color;
		this.buffer = buffer; // AudioBuffer decodificado
		this.volumen = 1;
		this.muteada = false;
		this.soleada = false;
		this._source = null;
		this._gain = null;
	}

	get duracion() {
		return this.buffer.duration;
	}
}

export class MotorAudio {
	constructor() {
		this.ctx = getContext();
		this.master = this.ctx.createGain();
		this.master.connect(this.ctx.destination);
		this.pistas = [];
		this.reproduciendo = false;
		this.velocidad = 1; // factor global: 1 = normal, 0.5 = mitad de velocidad, 2 = doble
		this._inicioCtxTime = 0; // ctx.currentTime cuando arranco play()
		this._offsetPausa = 0; // segundos (en tiempo de cancion) ya reproducidos antes de la pausa actual
		this._onTick = null;
		this._raf = null;
	}

	agregarPista(pista) {
		this.pistas.push(pista);
		return pista;
	}

	quitarPista(id) {
		this.pausar();
		this.pistas = this.pistas.filter((p) => p.id !== id);
	}

	get duracionTotal() {
		return this.pistas.reduce((max, p) => Math.max(max, p.duracion), 0);
	}

	_gananciaEfectiva(pista) {
		if (pista.muteada) return 0;
		const hayAlgunaSoleada = this.pistas.some((p) => p.soleada);
		if (hayAlgunaSoleada && !pista.soleada) return 0;
		return pista.volumen;
	}

	/**
	 * Arma el grafo source->gain->destino para una pista, sobre el AudioContext
	 * (en vivo) u OfflineAudioContext (render) que se le pase. Compartido entre
	 * play() y renderizarMezcla() para no duplicar la logica en dos lugares.
	 */
	_construirGrafo(ctx, pista, destino) {
		const source = ctx.createBufferSource();
		source.buffer = pista.buffer;
		source.playbackRate.value = this.velocidad;
		const gain = ctx.createGain();
		gain.gain.value = this._gananciaEfectiva(pista);
		source.connect(gain).connect(destino);
		return { source, gain };
	}

	setVolumen(id, valor) {
		const pista = this.pistas.find((p) => p.id === id);
		if (!pista) return;
		pista.volumen = valor;
		if (pista._gain) pista._gain.gain.setTargetAtTime(this._gananciaEfectiva(pista), this.ctx.currentTime, 0.01);
	}

	/** Velocidad global de toda la mezcla. Todas las pistas comparten el mismo
	 * factor, asi que se mantienen sincronizadas entre si (solo cambia el
	 * tempo real, no el desfasaje relativo). Aplica de inmediato si esta sonando. */
	setVelocidad(valor) {
		const estabaReproduciendo = this.reproduciendo;
		const posicion = this.posicionActual;
		this.velocidad = Math.max(0.25, Math.min(4, valor));
		if (estabaReproduciendo) {
			this.pausar();
			this._offsetPausa = posicion;
			this.play();
		}
	}

	toggleMute(id) {
		const pista = this.pistas.find((p) => p.id === id);
		if (!pista) return;
		pista.muteada = !pista.muteada;
		this._actualizarGanancias();
	}

	toggleSolo(id) {
		const pista = this.pistas.find((p) => p.id === id);
		if (!pista) return;
		pista.soleada = !pista.soleada;
		this._actualizarGanancias();
	}

	_actualizarGanancias() {
		for (const p of this.pistas) {
			if (p._gain) p._gain.gain.setTargetAtTime(this._gananciaEfectiva(p), this.ctx.currentTime, 0.01);
		}
	}

	get posicionActual() {
		if (!this.reproduciendo) return this._offsetPausa;
		// el tiempo real transcurrido se escala por la velocidad para saber
		// cuanto avanzo la cancion (playbackRate=2 -> avanza el doble de rapido)
		return this._offsetPausa + (this.ctx.currentTime - this._inicioCtxTime) * this.velocidad;
	}

	play() {
		if (this.reproduciendo) return;
		if (this.ctx.state === 'suspended') this.ctx.resume();
		const desde = this._offsetPausa;
		const cuando = this.ctx.currentTime + 0.05; // pequeño lookahead para arrancar todas exacto
		for (const pista of this.pistas) {
			if (desde >= pista.duracion) continue; // esta pista ya termino, no la arrancamos
			const { source, gain } = this._construirGrafo(this.ctx, pista, this.master);
			source.start(cuando, desde);
			pista._source = source;
			pista._gain = gain;
		}
		this._inicioCtxTime = cuando;
		this.reproduciendo = true;
		this._loopTick();
	}

	pausar() {
		if (!this.reproduciendo) return;
		this._offsetPausa = this.posicionActual;
		for (const pista of this.pistas) {
			try { pista._source?.stop(); } catch { /* ya estaba parado */ }
			pista._source = null;
		}
		this.reproduciendo = false;
		if (this._raf) cancelAnimationFrame(this._raf);
	}

	detener() {
		this.pausar();
		this._offsetPausa = 0;
	}

	buscar(segundos) {
		const estabaReproduciendo = this.reproduciendo;
		this.pausar();
		this._offsetPausa = Math.max(0, Math.min(segundos, this.duracionTotal));
		if (estabaReproduciendo) this.play();
	}

	onTick(callback) {
		this._onTick = callback;
	}

	_loopTick() {
		if (!this.reproduciendo) return;
		this._onTick?.(this.posicionActual);
		if (this.posicionActual >= this.duracionTotal) {
			this.detener();
			this._onTick?.(0);
			return;
		}
		this._raf = requestAnimationFrame(() => this._loopTick());
	}

	/** Recorta una pista entre inicio/fin (segundos), reemplazando su buffer. */
	recortarPista(id, inicio, fin) {
		const pista = this.pistas.find((p) => p.id === id);
		if (!pista) return;
		const { buffer } = pista;
		const sr = buffer.sampleRate;
		const desde = Math.max(0, Math.floor(inicio * sr));
		const hasta = Math.min(buffer.length, Math.floor(fin * sr));
		if (hasta <= desde) return;
		const nuevo = this.ctx.createBuffer(buffer.numberOfChannels, hasta - desde, sr);
		for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
			nuevo.copyToChannel(buffer.getChannelData(ch).subarray(desde, hasta), ch);
		}
		pista.buffer = nuevo;
	}

	/** Renderiza la mezcla completa (respetando volumen/mute/solo/velocidad
	 * actuales) a un AudioBuffer. La duracion offline tiene en cuenta la
	 * velocidad: al doble de velocidad, el render dura la mitad. */
	async renderizarMezcla() {
		const duracion = this.duracionTotal / this.velocidad;
		const sr = this.ctx.sampleRate;
		const offline = new OfflineAudioContext(2, Math.ceil(duracion * sr), sr);
		for (const pista of this.pistas) {
			const ganancia = this._gananciaEfectiva(pista);
			if (ganancia <= 0) continue;
			const { source } = this._construirGrafo(offline, pista, offline.destination);
			source.start(0);
		}
		return offline.startRendering();
	}
}

/** Decodifica un archivo/Blob de audio a un AudioBuffer usando el contexto compartido. */
export async function decodificarArchivo(archivo) {
	const arrayBuffer = await archivo.arrayBuffer();
	return getContext().decodeAudioData(arrayBuffer);
}

export function obtenerContextoCompartido() {
	return getContext();
}
