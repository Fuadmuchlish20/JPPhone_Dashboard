import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStore } from "../api";
import { Player } from "../components/Player";
import NotFound from "./NotFound";

/** /device/:id — opens the full-screen player directly (links from the device sheet and notifications). */
export default function Device() {
  const { id } = useParams();
  const navigate = useNavigate();
  const exists = useStore().devices.some((d) => d.id === id);
  const exit = useCallback(() => navigate("/"), [navigate]);

  if (!exists) return <NotFound />;
  return <Player deviceId={id} onExit={exit} />;
}
