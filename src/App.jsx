import { BrowserRouter } from "react-router-dom";
import AppRouter from "../src/Approuter/Router";

function App() {
    return (
        <BrowserRouter>
            <AppRouter />
        </BrowserRouter>
    );
}

export default App;