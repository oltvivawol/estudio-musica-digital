// Scheduler de precisión para secuenciadores (patrón estándar de Web Audio:
// "A Tale of Two Clocks" de Chris Wilson). setInterval/setTimeout del
// navegador no son precisos para el tiempo musical, así que en vez de sonar
// un evento "ahora", se programan con antelación contra ctx.currentTime
// (el reloj real del hardware de audio) y solo se revisa cada tanto si hay
// que programar el próximo.
export class Scheduler {
	constructor(ctx, { pasos, onPaso, subdivision = 4 }) {
		this.ctx = ctx;
		this.pasos = pasos;
		this.onPaso = onPaso; // (indicePaso, tiempoAudio) => void
		this.subdivision = subdivision; // 4 = dieciseisavos, 1 = negras
		this.bpm = 120;
		this.pasoActual = 0;
		this.proximoTiempo = 0;
		this.timerId = null;
		this.sonando = false;
		this.anticipacion = 0.1; // segundos: cuánto se programa por adelantado
		this.intervaloRevision = 25; // ms: cada cuánto se revisa si hay que programar más
	}

	get duracionPaso() {
		return 60 / this.bpm / this.subdivision;
	}

	iniciar() {
		if (this.sonando) return;
		this.sonando = true;
		this.pasoActual = 0;
		this.proximoTiempo = this.ctx.currentTime + 0.05;
		this._tick();
	}

	detener() {
		this.sonando = false;
		if (this.timerId) clearTimeout(this.timerId);
	}

	_tick() {
		if (!this.sonando) return;
		while (this.proximoTiempo < this.ctx.currentTime + this.anticipacion) {
			this.onPaso(this.pasoActual, this.proximoTiempo);
			this.proximoTiempo += this.duracionPaso;
			this.pasoActual = (this.pasoActual + 1) % this.pasos;
		}
		this.timerId = setTimeout(() => this._tick(), this.intervaloRevision);
	}
}
