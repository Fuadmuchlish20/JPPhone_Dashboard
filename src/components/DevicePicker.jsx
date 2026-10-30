import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PLAN_THEMES, planBySlug } from "../api";
import { preciseLeft } from "../api/format";
import { ChevronDownIcon } from "./Icons";

/** "Please choose cloud phone" card; picking another device navigates to pathFor(id). */
export function DevicePicker({ device, devices, pathFor, detail }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className={`rp-device${open ? " is-open" : ""}`} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <DeviceSummary device={device} detail={detail} />
        <ChevronDownIcon />
      </button>
      {open && (
        <ul className="rp-device-list">
          {devices
            .filter((d) => d.id !== device.id)
            .map((d) => (
              <li key={d.id}>
                <button
                  className={`rp-device dm-${PLAN_THEMES[d.planSlug] ?? "slate"}`}
                  onClick={() => {
                    setOpen(false);
                    navigate(pathFor(d.id), { replace: true });
                  }}
                >
                  <DeviceSummary device={d} detail={detail} />
                </button>
              </li>
            ))}
        </ul>
      )}
    </>
  );
}

function DeviceSummary({ device, detail = (d) => `Android ${d.androidVersion}` }) {
  const plan = planBySlug(device.planSlug);
  return (
    <>
      <span className="rp-avatar" aria-hidden>
        {plan.name.charAt(0)}
      </span>
      <span className="rp-device-meta">
        <strong>
          {device.name} <em>{plan.name}</em> <em>{device.region.toUpperCase()}</em>
        </strong>
        <small>
          {detail(device)} · Time left: {preciseLeft(device.expiresAt)}
        </small>
      </span>
    </>
  );
}
