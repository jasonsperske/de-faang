import { useEffect, useState } from "react";
import { Home } from "./pages/Home";
import { Room } from "./pages/Room";
import { Lesson } from "./pages/Lesson";

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
  const lesson = hash.match(/^#\/lesson\/([\w.-]+)\/([\w-]+)/);
  if (lesson) return <Lesson key={hash} sessionId={lesson[1]} lessonId={lesson[2]} />;
  const m = hash.match(/^#\/session\/([\w.-]+)/);
  return m ? <Room key={m[1]} id={m[1]} /> : <Home key={hash} />;
}
