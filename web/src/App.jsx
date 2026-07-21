import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage.jsx';
import EstudioPage from './pages/EstudioPage.jsx';
import ChatJano from './components/ChatJano.jsx';

export default function App() {
	return (
		<>
			<Routes>
				<Route path="/" element={<LandingPage />} />
				<Route path="/estudio" element={<EstudioPage />} />
			</Routes>
			<ChatJano />
		</>
	);
}
