import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";

const HomePage = lazy(async () => {
  const module = await import("./pages/HomePage");
  return { default: module.HomePage };
});

const ReaderPage = lazy(async () => {
  const module = await import("./pages/ReaderPage");
  return { default: module.ReaderPage };
});

const SettingsPage = lazy(async () => {
  const module = await import("./pages/SettingsPage");
  return { default: module.SettingsPage };
});

function App() {
  const { pathname } = useLocation();
  const padding = pathname === "/" ? "pt-15 md:pt-0" : "pt-15";

  return (
    <>
      <Navbar />
      <Suspense fallback={<main className="px-4 py-6 text-sm text-neutral-700 dark:text-neutral-300">...</main>}>
        <div className={`${padding}`}>
          <Routes>
            <Route
              path="/"
              element={<HomePage />}
            />
            <Route
              path="/leitura"
              element={<ReaderPage />}
            />
            <Route
              path="/config"
              element={<SettingsPage />}
            />
            <Route
              path="/catalogo"
              element={<Navigate
                to="/config"
                replace
              />}
            />
          </Routes>
        </div>
      </Suspense>
      <Footer />
    </>
  );
}

export default App;
