import { useEffect, useState } from "react";
import { Home } from "./pages/Home";
import { Room } from "./pages/Room";

function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return hash;
}

export function App() {
  const hash = useHash();
  const m = hash.match(/^#\/session\/([\w.-]+)/);
  return m ? <Room key={m[1]} id={m[1]} /> : <Home />;
}
