import { BrowserRouter, Routes, Route } from "react-router-dom";
import DocumentPage from "./DocumentPage";
import SignPage from "./SignPage";
import AdminPage from "./AdminPage";
import UserPage from "./UserPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DocumentPage />} />
        <Route path="/sign" element={<SignPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/user" element={<UserPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
