// Codifica un AudioBuffer a bytes WAV (PCM 16-bit) - formato simple, sin
// licencias, reproducible en cualquier lado. Tecnica estandar (escribir el
// header RIFF a mano); no hay una libreria chica y mantenida que valga la
// pena sumar como dependencia solo para esto.

export function audioBufferAWav(buffer) {
	const numCanales = buffer.numberOfChannels;
	const frecuencia = buffer.sampleRate;
	const bitsPorMuestra = 16;
	const bytesPorMuestra = bitsPorMuestra / 8;
	const bloqueAlineado = numCanales * bytesPorMuestra;
	const datosLength = buffer.length * bloqueAlineado;

	const arrayBuffer = new ArrayBuffer(44 + datosLength);
	const view = new DataView(arrayBuffer);

	const escribirTexto = (offset, texto) => {
		for (let i = 0; i < texto.length; i++) view.setUint8(offset + i, texto.charCodeAt(i));
	};

	escribirTexto(0, 'RIFF');
	view.setUint32(4, 36 + datosLength, true);
	escribirTexto(8, 'WAVE');
	escribirTexto(12, 'fmt ');
	view.setUint32(16, 16, true); // tamaño del sub-chunk fmt
	view.setUint16(20, 1, true); // PCM
	view.setUint16(22, numCanales, true);
	view.setUint32(24, frecuencia, true);
	view.setUint32(28, frecuencia * bloqueAlineado, true); // byte rate
	view.setUint16(32, bloqueAlineado, true);
	view.setUint16(34, bitsPorMuestra, true);
	escribirTexto(36, 'data');
	view.setUint32(40, datosLength, true);

	const canales = [];
	for (let ch = 0; ch < numCanales; ch++) canales.push(buffer.getChannelData(ch));

	let offset = 44;
	for (let i = 0; i < buffer.length; i++) {
		for (let ch = 0; ch < numCanales; ch++) {
			const muestra = Math.max(-1, Math.min(1, canales[ch][i]));
			view.setInt16(offset, muestra < 0 ? muestra * 0x8000 : muestra * 0x7fff, true);
			offset += 2;
		}
	}

	return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export function descargarBlob(blob, nombreArchivo) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = nombreArchivo;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}
