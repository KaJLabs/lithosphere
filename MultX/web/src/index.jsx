import ReactDOM from 'react-dom/client';
import Main from './Main';
import { initErrorTracking } from './services/errorTracking';
initErrorTracking();

ReactDOM.createRoot(document.getElementById('root')).render(<Main />);
