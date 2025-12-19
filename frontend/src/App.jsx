import { BrowserRouter, Routes, Route } from "react-router-dom";
import DocumentPage from "./DocumentPage";
import SignPage from "./SignPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DocumentPage />} />
        <Route path="/sign" element={<SignPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
